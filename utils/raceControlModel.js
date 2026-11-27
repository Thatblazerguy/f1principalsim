/*
 * Read-only views over a running LiveRaceEngine for the race control screen.
 * Nothing here changes the race: it turns engine.cars / engine.events into
 * timing-tower rows, battles, a classified event feed and per-lap history.
 */

import { TEAM_COLORS } from "./championshipModel.js";
import { DRIVE_MODES, PIT_LOSS_BASE, tyreLife } from "../game/paceModel.js";

export const lastName = (n) => String(n || "").split(" ").pop();
export const carCode = (n) => lastName(n).normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3).toUpperCase();
export const teamColor = (team, playerTeam) => (team && team === playerTeam ? "#E10600" : TEAM_COLORS[team] || "#85858b");
export { PIT_LOSS_BASE, DRIVE_MODES };

export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
export function fmtLap(sec) {
  if (!Number.isFinite(sec) || sec <= 0 || sec >= 900) return "–";
  const m = Math.floor(sec / 60); const r = sec - m * 60;
  return m ? `${m}:${r.toFixed(3).padStart(6, "0")}` : r.toFixed(3);
}

/** Reference lap time for converting distance gaps into seconds. */
const refLap = (engine, car) => car?.targetLapTime || car?.basePace || engine.track.baseTime || 90;

/** Time gap from `front` back to `back` (seconds), or laps when a lap or more apart. */
export function gapBetween(engine, front, back) {
  if (!front || !back) return null;
  const finishedBoth = front.distance >= engine.totalLaps && back.distance >= engine.totalLaps;
  if (finishedBoth) return { sec: Math.max(0, back.totalTime - front.totalTime), laps: 0 };
  const d = front.distance - back.distance;
  if (d >= 1) return { sec: d * refLap(engine, back), laps: Math.floor(d) };
  return { sec: Math.max(0, d * refLap(engine, back)), laps: 0 };
}
export const fmtGap = (g) => (!g ? "–" : g.laps ? `+${g.laps} lap${g.laps > 1 ? "s" : ""}` : `+${g.sec.toFixed(g.sec < 10 ? 3 : 1)}`);

/** Average speed on the current lap in km/h (0 when stationary in the pits). */
export function speedKmh(car, lengthKm) {
  if (!lengthKm || car.retired || car.pitStopStatus === "Pitting") return 0;
  return Math.round((car.currentSpeed || 0) * lengthKm * 3600);
}

export function pitState(car, totalLaps) {
  if (car.retired) return "out";
  if (car.distance >= totalLaps) return "finished";
  if (car.pitStopStatus === "Pitting") return "pitting";
  if (car.pitStopStatus === "InLap") return "inlap";
  if (car.pitStopStatus === "OutLap") return "outlap";
  return "running";
}

/** Timing tower rows in race order. */
export function towerRows(engine, playerTeam) {
  const cars = engine.cars;
  const leader = cars[0];
  const drsOpen = (leader?.lap || 0) > 2;
  return cars.map((car, i) => {
    const ahead = i > 0 ? cars[i - 1] : null;
    const interval = ahead && !car.retired ? gapBetween(engine, ahead, car) : null;
    const toLeader = i > 0 && !car.retired ? gapBetween(engine, leader, car) : null;
    const state = pitState(car, engine.totalLaps);
    const running = state !== "out" && state !== "finished";
    const aheadRunning = ahead && !ahead.retired && ahead.distance < engine.totalLaps;
    const close = running && aheadRunning && interval && !interval.laps && interval.sec < 1.0
      && car.pitStopStatus === "None" && ahead.pitStopStatus === "None";
    return {
      id: car.id, car, pos: i + 1, code: carCode(car.driver.name), name: car.driver.name,
      team: car.team.name, color: teamColor(car.team.name, playerTeam), isPlayer: !!car.isPlayer,
      interval, toLeader, compound: car.tireCompound, tyreAge: car.tyreAge, wear: car.tireWear, stops: car.stops,
      state, grid: car.gridPos + 1, change: car.retired ? 0 : car.gridPos + 1 - (i + 1),
      inBattle: !!close, drs: !!close && drsOpen, lastLap: car.lastLapTime, bestLap: car.bestLapTime,
      lap: car.lap, fastest: engine.fastestLap?.driver === car.id,
    };
  });
}

/**
 * Battles: runs of consecutive running cars each within 1.0s of the car ahead
 * (the engine's DRS range for an overtake attempt).
 */
export function findBattles(engine, rows, history) {
  const battles = [];
  // The standing start bunches the whole grid: battles count from lap 2
  if ((engine.cars[0]?.lap || 0) < 2 || engine.raceCompleted) return battles;
  let cur = null;
  rows.forEach((r, i) => {
    if (r.inBattle) {
      if (cur && cur.cars.length >= 3) cur = null; // long trains split into fights of up to three
      if (!cur) { cur = { cars: [rows[i - 1]] }; battles.push(cur); }
      cur.cars.push(r);
    } else cur = null;
  });
  return battles.map((b) => {
    const front = b.cars[0]; const back = b.cars[1];
    const pos = front.pos;
    const players = b.cars.filter((c) => c.isPlayer);
    const category = pos === 1 ? "lead" : pos <= 3 ? "podium" : pos <= 10 ? "points" : "other";
    const gap = back.interval?.sec ?? 0;
    const pace = (front.car.basePace ?? 0) - (back.car.basePace ?? 0); // + = chaser quicker per lap
    return {
      key: b.cars.map((c) => c.id).join("|"), cars: b.cars, pos, category, involvesPlayer: players.length > 0,
      label: pos === 1 ? "For the lead" : pos <= 3 ? `For P${pos} (podium)` : pos <= 10 ? `For P${pos} (points)` : `For P${pos}`,
      gap, trend: pairTrend(history, front.id, back.id), drs: back.drs, pace,
      tyreAgeDelta: front.car.tyreAge - back.car.tyreAge, // + = chaser on fresher tyres
      frontTyre: front.compound, backTyre: back.compound,
      rank: (players.length ? 0 : 10) + (category === "lead" ? 0 : category === "podium" ? 1 : category === "points" ? 2 : 3),
    };
  }).sort((a, b) => a.rank - b.rank || a.pos - b.pos);
}

/* ─── Per-lap history (sampled as each car completes a lap) ─────────────── */

export function createHistory() { return { cars: {}, leaderLaps: 0 }; }

export function recordHistory(h, engine) {
  const leader = engine.cars.find((c) => !c.retired) || engine.cars[0];
  engine.cars.forEach((car, i) => {
    const n = car.lapTimes.length;
    const list = h.cars[car.id] || (h.cars[car.id] = []);
    if (!n || list.length && list[list.length - 1].lap >= n) return;
    const g = car === leader ? { sec: 0, laps: 0 } : gapBetween(engine, leader, car);
    list.push({
      lap: n, pos: i + 1, lapTime: car.lastLapTime, gapLeader: g ? g.sec : null,
      wear: car.tireWear, fuel: car.fuel, ers: car.ers, compound: car.tireCompound,
      pit: car.stints.length > 1 && car.stints[car.stints.length - 1].startLap === n + 1,
    });
  });
}

/** Gap change per lap between two cars over their last three common laps (+ = growing). */
export function pairTrend(h, frontId, backId) {
  const a = h?.cars?.[frontId]; const b = h?.cars?.[backId];
  if (!a?.length || !b?.length) return null;
  const byLap = new Map(a.map((x) => [x.lap, x.gapLeader]));
  const common = b.filter((x) => byLap.has(x.lap) && x.gapLeader != null && byLap.get(x.lap) != null).slice(-4);
  if (common.length < 3) return null;
  const gap = (x) => x.gapLeader - byLap.get(x.lap);
  return (gap(common[common.length - 1]) - gap(common[0])) / (common[common.length - 1].lap - common[0].lap || 1);
}

/* ─── Event feed ────────────────────────────────────────────────────────── */

const KIND_FROM_MSG = [
  [/^lights out/i, "start"], [/overtakes/i, "overtake"], [/ pits:/i, "pit"], [/is OUT of the race/i, "retire"],
  [/^chequered/i, "finish"], [/^fastest lap/i, "fastest"],
];
export const EVENT_KINDS = {
  start: { label: "Start", severity: "info" },
  overtake: { label: "Overtake", severity: "notice" },
  pit: { label: "Pit stop", severity: "info" },
  fastest: { label: "Fastest lap", severity: "notice" },
  retire: { label: "Retirement", severity: "critical" },
  finish: { label: "Chequered flag", severity: "info" },
  other: { label: "Race control", severity: "info" },
};

/** Normalise an engine event into feed fields. */
export function describeEvent(ev, engine, playerIds) {
  const kind = ev.kind || (KIND_FROM_MSG.find(([re]) => re.test(ev.msg))?.[1]) || "other";
  const car = ev.driver ? engine.cars.find((c) => c.id === ev.driver) : null;
  const other = ev.other ? engine.cars.find((c) => c.id === ev.other) : null;
  const ours = !!(car?.isPlayer || other?.isPlayer || (ev.driver && playerIds.has(ev.driver)));
  let title = ev.msg; let detail = "";
  if (kind === "overtake" && car && other) { title = `${lastName(car.driver.name)} passes ${lastName(other.driver.name)}`; detail = `Now P${ev.pos}`; }
  else if (kind === "pit" && car) { title = `${lastName(car.driver.name)} pits`; detail = `${ev.from} to ${ev.to}, rejoins P${ev.pos}`; }
  else if (kind === "retire" && car) { title = `${lastName(car.driver.name)} retires`; detail = ev.reason || "Mechanical failure"; }
  else if (kind === "fastest" && car) { title = `Fastest lap, ${lastName(car.driver.name)}`; detail = fmtLap(ev.lapTime); }
  else if (kind === "finish") { title = "Chequered flag"; detail = car ? `${car.driver.name} wins` : ""; }
  else if (kind === "start") { title = "Lights out"; detail = `${engine.totalLaps} laps`; }
  const severity = kind === "overtake" && ev.pos <= 3 ? "warn" : EVENT_KINDS[kind]?.severity || "info";
  return { ...ev, kind, title, detail, ours, severity, car, other, lap: ev.lap ?? null };
}

/* ─── Strategy helpers for the pit wall ─────────────────────────────────── */

/** Laps remaining on this set before the compound's cliff, from the pace model. */
export function tyreOutlook(car, totalLaps) {
  const life = tyreLife(car.profile, car.tireCompound);
  const lapsLeft = Math.max(0, totalLaps - car.distance);
  const wearRate = DRIVE_MODES[car.driverMode]?.wear ?? 1;
  return { life, lapsToCliff: Math.max(0, (life - car.tyreAge) / wearRate), lapsLeft, wearRate };
}

/** Stint plan for the timeline: completed stints, the current one, and the planned next. */
export function stintTimeline(car, totalLaps, briefing) {
  const done = car.lapTimes.length;
  const stints = car.stints.map((s, i) => ({
    compound: s.compound, start: s.startLap, end: s.endLap ?? Math.max(s.startLap, done), current: i === car.stints.length - 1 && !car.retired,
  }));
  const plan = briefing?.pitPlan;
  let next = null;
  if (car.pitStopStatus === "InLap") next = { compound: car.nextTire || plan?.compound || null, onLap: done + 1, confirmed: true };
  else if (car.scheduledStop) next = { compound: car.scheduledStop.compound, onLap: car.scheduledStop.lap, confirmed: true };
  else if (plan && (plan.action === "box" || plan.action === "window")) next = { compound: plan.compound, onLap: plan.onLap ?? done + 1, confirmed: false };
  return { stints, next, total: totalLaps, done };
}
