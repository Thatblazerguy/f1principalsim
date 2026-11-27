/**
 * seasonSimulation.js
 * ───────────────────
 * Drives the dashboard's "Advance time" experience on top of the existing
 * season clock. It never invents gameplay: every day is advanced through
 * seasonTimeline.simulateNextDay (the same tick the rest of the game uses),
 * and every calendar marker / news item is read from, or diffed against, real
 * game state:
 *
 *   race weekends        state.season.calendar + getRoundRaceDay
 *   development          team.pendingUpgrades, engineering.projects
 *   factory              finance.facilityProjects
 *   academy scouting     academy.scouts
 *   driver market        transferMarket.news / lastAiDay / pre-contract window
 *   contracts            driver.contractYearsRemaining (expire at season end)
 *   sponsors             team.sponsorSlots objectives & expiry, race bonus targets
 *   board                finance board reviews (after even rounds)
 *   rival development    AI team spec deltas applied after each race
 *   weather              state.raceWeekend.weather for the upcoming round
 *
 * Feed items carry deterministic keys and are de-duplicated against
 * state.seasonSim.seen, so pausing / resuming / reloading never repeats one.
 */
import { simulateNextDay, canSimulateNextDay, getRoundRaceDay, getSeasonDate, ensureSeasonTimeline } from "./seasonTimeline.js";
import { generateRaceBonusChallenges, FACILITY_CATALOG } from "./financeSystem.js";
import { generateUnifiedRaceWeekend } from "./raceObjectives.js";
import { SPONSOR_SLOTS } from "../data/sponsors.js";
import { getConstructorOrder, getDriverOrder } from "./championshipModel.js";

const FEED_LIMIT = 80;
const SEEN_LIMIT = 600;
const FORECAST_DAYS_OUT = 4;
const SPONSOR_BRIEF_DAYS_OUT = 6;
const MARKET_AI_INTERVAL = 14;

export const EVENT_META = {
  race:        { label: "Race day",      short: "Race" },
  qualifying:  { label: "Qualifying",    short: "Quali" },
  practice:    { label: "Practice",      short: "FP" },
  development: { label: "Development",   short: "R&D" },
  factory:     { label: "Factory",       short: "Factory" },
  contract:    { label: "Contracts",     short: "Contract" },
  market:      { label: "Driver market", short: "Market" },
  sponsor:     { label: "Commercial",    short: "Sponsor" },
  scouting:    { label: "Academy",       short: "Academy" },
  board:       { label: "Board",         short: "Board" },
  weather:     { label: "Weather",       short: "Weather" },
  rival:       { label: "Paddock",       short: "Rivals" },
};

const PART_NAMES = { aero: "Aerodynamics", engine: "Power unit", chassis: "Chassis", reliability: "Reliability" };

const seasonYear = (state) => state.season?.year || 1;
const totalRounds = (state) => Math.min(state.season?.totalRounds || (state.season?.calendar || []).length || 24, (state.season?.calendar || []).length || 24);
const r1 = (v) => Math.round(v * 10) / 10;
const shortTeam = (name = "") => name.replace(/\s+(F1 Team|Racing|Formula One Team|HP)$/i, "").trim();

// ─── Persistent sim state ───────────────────────────────────────────────────
export function ensureSeasonSim(state) {
  if (!state.seasonSim || typeof state.seasonSim !== "object") state.seasonSim = {};
  const sim = state.seasonSim;
  if (!Array.isArray(sim.feed)) sim.feed = [];
  if (!Array.isArray(sim.seen)) sim.seen = [];
  if (!Array.isArray(sim.rivalQueue)) sim.rivalQueue = [];
  if (!sim.rivalSnap) sim.rivalSnap = snapshotTeams(state);
  return sim;
}

function snapshotTeams(state) {
  const teams = {};
  for (const t of [state.team, ...(state.aiTeams || [])].filter(Boolean)) {
    teams[t.name] = {
      aero: t.specs?.aero ?? 0,
      chassis: t.specs?.chassis ?? 0,
      reliability: t.specs?.reliability ?? 0,
      perf: t.carPerformance ?? 0,
    };
  }
  return { round: state.season?.round || 1, year: seasonYear(state), teams };
}

// ─── Calendar ───────────────────────────────────────────────────────────────
export function dayInfo(state, day) {
  const date = getSeasonDate(seasonYear(state), day);
  return {
    day,
    date,
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    dayOfMonth: date.getUTCDate(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
  };
}

/** Which round's weekend (Fri–Sun) a day belongs to, if any. */
function weekendFor(state, day) {
  for (const r of state.season?.calendar || []) {
    if (r.round > totalRounds(state)) continue;
    const raceDay = getRoundRaceDay(r.round);
    if (day >= raceDay - 2 && day <= raceDay) return { round: r, raceDay, offset: raceDay - day };
  }
  return null;
}

function isRoundComplete(state, round) {
  if (round < (state.season?.round || 1)) return true;
  return round === state.season?.round && !!(state.weekendProgress?.round === round && state.weekendProgress?.raceComplete);
}

/**
 * Every scheduled event between two days (inclusive), from live game state.
 * Returns { [day]: Event[] } where Event = { key, day, type, title, detail, important }.
 */
export function getCalendarEvents(state, fromDay, toDay) {
  ensureSeasonTimeline(state);
  const out = {};
  const add = (day, ev) => {
    if (day < fromDay || day > toDay) return;
    (out[day] = out[day] || []).push({ day, ...ev });
  };
  const yr = seasonYear(state);
  const total = totalRounds(state);
  const calendar = (state.season?.calendar || []).filter((r) => r.round <= total);

  // Race weekends
  for (const r of calendar) {
    const raceDay = getRoundRaceDay(r.round);
    const done = isRoundComplete(state, r.round);
    add(raceDay - 2, { key: `fp:${yr}:${r.round}`, type: "practice", title: r.sprint ? "FP1 · Sprint qualifying" : "Free practice", detail: `${r.name} · ${r.circuit}`, round: r.round, done });
    add(raceDay - 1, { key: `q:${yr}:${r.round}`, type: "qualifying", title: r.sprint ? "Sprint · Qualifying" : "Qualifying", detail: r.name, round: r.round, done });
    add(raceDay, { key: `race:${yr}:${r.round}`, type: "race", title: r.name, detail: `Round ${r.round} · ${r.laps} laps`, round: r.round, done, important: true });
  }

  // Timed component upgrades (Office)
  for (const u of state.team?.pendingUpgrades || []) {
    add(u.readyDay, { key: `upg:${u.id}`, type: "development", title: `${PART_NAMES[u.part] || u.part} upgrade ready`, detail: "Factory build completes", important: true });
  }

  // Engineering development projects deliver for a round's weekend
  for (const p of state.engineering?.projects || []) {
    if (p.status !== "active") continue;
    const round = Math.min(p.completionRound, total);
    add(getRoundRaceDay(round) - 2, { key: `proj:${p.id}`, type: "development", title: `${p.label} due`, detail: `Debuts at Round ${round}`, important: true });
  }

  // Facility construction
  for (const f of state.finance?.facilityProjects || []) {
    add(f.readyDay, { key: `fac:${f.facilityId}:${f.readyDay}`, type: "factory", title: `${f.name} upgrade complete`, detail: "Facility build finishes", important: true });
  }

  // Academy scouting assignments
  for (const s of state.academy?.scouts || []) {
    if (s.complete || s.dismissed || s.signed) continue;
    add(s.completionDay, { key: `scout:${s.id}`, type: "scouting", title: "Scouting report due", detail: `${s.regionLabel || s.regionKey} · ${s.tierLabel || s.tier}`, important: true });
  }

  // Driver market: AI teams review line-ups every 14 days (processMarketDay)
  const lastAi = state.transferMarket?.lastAiDay || 0;
  if (state.transferMarket) {
    for (let d = lastAi + MARKET_AI_INTERVAL; d <= toDay; d += MARKET_AI_INTERVAL) {
      const lateSeason = d > getRoundRaceDay(Math.ceil(total / 2));
      add(d, { key: `mkt:${yr}:${d}`, type: "market", title: "Rival line-up reviews", detail: lateSeason ? "AI teams fill seats and chase pre-contracts" : "AI teams fill any open seats" });
    }
  }

  // Pre-contract window opens once half the season has been raced
  const halfRound = Math.ceil(total / 2);
  if ((state.season?.round || 1) <= halfRound) {
    add(getRoundRaceDay(halfRound) + 1, { key: `precontract:${yr}`, type: "contract", title: "Pre-contract window opens", detail: "Drivers in their final year can agree future moves", important: true });
  }

  // Contracts expiring at season end
  const lastRaceDay = getRoundRaceDay(total);
  const expiringMine = (state.team?.drivers || []).filter((d) => (d.contractYearsRemaining ?? 2) <= 1).map((d) => d.name);
  const expiringAll = [state.team, ...(state.aiTeams || [])].filter(Boolean).flatMap((t) => t.drivers || []).filter((d) => (d.contractYearsRemaining ?? 2) <= 1).length;
  if (expiringAll) {
    add(lastRaceDay, {
      key: `expiry:${yr}`, type: "contract", title: "Driver contracts expire",
      detail: expiringMine.length ? `${expiringMine.join(", ")} · ${expiringAll} drivers in total` : `${expiringAll} drivers across the grid`,
      important: expiringMine.length > 0,
    });
  }

  // Sponsors: objective deadlines and contract expiry
  for (const slot of SPONSOR_SLOTS) {
    const sp = state.team?.sponsorSlots?.[slot.key];
    if (!sp) continue;
    for (const o of sp.objectives || []) {
      if (o.complete || !o.deadline || o.deadline > total) continue;
      add(getRoundRaceDay(o.deadline), { key: `spobj:${sp.id || slot.key}:${o.id}:${o.deadline}`, type: "sponsor", title: `${sp.name || slot.label}: ${o.label}`, detail: `Deadline Round ${o.deadline} · $${o.reward}M reward` });
    }
    if (sp.expiresRound && sp.expiresRound <= total) {
      add(getRoundRaceDay(sp.expiresRound), { key: `spexp:${sp.id || slot.key}:${sp.expiresRound}`, type: "sponsor", title: `${sp.name || slot.label} deal ends`, detail: slot.label, important: true });
    }
  }

  // Board reviews follow even-numbered rounds (maybeCreateBoardReview)
  for (const r of calendar) {
    if (r.round % 2 !== 0 || isRoundComplete(state, r.round)) continue;
    add(getRoundRaceDay(r.round) + 1, { key: `board:${yr}:${r.round}`, type: "board", title: "Board review", detail: `Finances and results after Round ${r.round}` });
  }

  return out;
}

/** The kind of day for the timeline strip. */
export function dayKind(state, day) {
  const wk = weekendFor(state, day);
  if (!wk) return "rest";
  return wk.offset === 0 ? "race" : wk.offset === 1 ? "qualifying" : "practice";
}

/** Next N scheduled events after the current day. */
export function getUpcomingEvents(state, limit = 6, horizon = 60) {
  const today = state.season?.currentDay || 1;
  const map = getCalendarEvents(state, today + 1, today + horizon);
  return Object.keys(map).map(Number).sort((a, b) => a - b)
    .flatMap((d) => map[d].filter((e) => e.type !== "practice" && e.type !== "qualifying"))
    .slice(0, limit);
}

/** Day the given mode would run to (for the progress bar). */
export function getTargetDay(state, mode, days = 1) {
  const today = state.season?.currentDay || 1;
  const raceDay = getRoundRaceDay(state.season?.round || 1);
  if (mode === "race") return Math.max(today, raceDay);
  if (mode === "event") {
    const map = getCalendarEvents(state, today + 1, raceDay);
    const next = Object.keys(map).map(Number).sort((a, b) => a - b)[0];
    return Math.min(next ?? raceDay, raceDay);
  }
  return Math.min(today + days, raceDay);
}

// ─── Daily runner ───────────────────────────────────────────────────────────
function pushFeed(state, items) {
  const sim = ensureSeasonSim(state);
  const seen = new Set(sim.seen);
  const fresh = [];
  for (const it of items) {
    if (!it || seen.has(it.key)) continue;
    seen.add(it.key);
    sim.seen.push(it.key);
    fresh.push(it);
  }
  if (sim.seen.length > SEEN_LIMIT) sim.seen = sim.seen.slice(-SEEN_LIMIT);
  sim.feed = [...fresh.slice().reverse(), ...sim.feed].slice(0, FEED_LIMIT);
  return fresh;
}

function ensureRaceWeekend(state) {
  if (!state.team) return null;
  if (!state.raceWeekend || state.raceWeekend.round !== state.season.round) {
    state.raceWeekend = generateUnifiedRaceWeekend(state.team, state.season.round);
  }
  return state.raceWeekend;
}

function crossedHalf(start, end, before, after) {
  const half = start + (end - start) / 2;
  return end - start >= 4 && before < half && after >= half;
}

/**
 * Advance exactly one day through the shared season tick and report what
 * happened. Safe to call repeatedly; the caller decides when to stop.
 *
 * Returns { advanced, reason, day, items, important, arrived }
 *   items     — new feed items generated by this day (already stored)
 *   important — true when something the player should look at happened
 *   arrived   — the race weekend just opened
 */
export function simulateSeasonDay(state) {
  const sim = ensureSeasonSim(state);
  if (!canSimulateNextDay(state)) return { advanced: false, reason: "race_weekend_open", items: [], important: false, arrived: false };

  const yr = seasonYear(state);
  const prevDay = state.season.currentDay;
  const round = state.season.round;
  const calRound = (state.season.calendar || []).find((r) => r.round === round);

  // Before-state for diffs
  const upgradesBefore = (state.team?.pendingUpgrades || []).map((u) => ({ ...u }));
  const facilitiesBefore = (state.finance?.facilityProjects || []).map((f) => ({ ...f }));
  const scoutsBefore = new Map((state.academy?.scouts || []).map((s) => [s.id, !!s.complete]));
  const newsIdsBefore = new Set((state.transferMarket?.news || []).map((n) => n.id));

  const tick = simulateNextDay(state);
  if (!tick.advanced) return { advanced: false, reason: tick.reason, items: [], important: false, arrived: false };

  const day = state.season.currentDay;
  const daysUntilRace = tick.daysUntilRace;
  const items = [];
  const item = (key, type, title, extra = {}) => items.push({ key, type, title, day, year: yr, ...extra });

  // Player development
  for (const u of tick.completedUpgrades || []) {
    item(`done:upg:${u.id}`, "development", `${PART_NAMES[u.part] || u.part} upgrade signed off`, {
      dept: "Engineering", detail: `Now level ${state.team?.car?.[u.part] ?? "—"}. Car performance rises to ${(state.team?.carPerformance || 0).toFixed(1)}.`, important: true,
    });
  }
  for (const u of upgradesBefore) {
    if ((tick.completedUpgrades || []).some((c) => c.id === u.id)) continue;
    if (crossedHalf(u.requestedDay, u.readyDay, prevDay, day)) {
      item(`half:upg:${u.id}`, "development", `${PART_NAMES[u.part] || u.part} build passes halfway`, { dept: "Engineering", detail: `${u.readyDay - day} days until the parts are ready.` });
    }
  }
  for (const p of state.engineering?.projects || []) {
    if (p.status !== "active") continue;
    const due = getRoundRaceDay(Math.min(p.completionRound, totalRounds(state))) - 2;
    if (due - day === 7) item(`eta:proj:${p.id}`, "development", `${p.label} on schedule`, { dept: "Engineering", detail: `Expected ${p.expectedGain} · ${p.confidence}% confidence · arrives in a week.` });
  }

  // Factory
  for (const f of tick.completedFacilities || []) {
    item(`done:fac:${f.facilityId}:${f.readyDay}`, "factory", `${f.name} upgrade complete`, { dept: "Factory", detail: `Facility now level ${f.level}.`, important: true });
  }
  for (const f of facilitiesBefore) {
    if ((tick.completedFacilities || []).some((c) => c.facilityId === f.facilityId)) continue;
    const buildDays = FACILITY_CATALOG.find((c) => c.id === f.facilityId)?.buildDays || 0;
    if (buildDays && crossedHalf(f.readyDay - buildDays, f.readyDay, prevDay, day)) {
      item(`half:fac:${f.facilityId}:${f.readyDay}`, "factory", `${f.name} construction halfway`, { dept: "Factory", detail: `${f.readyDay - day} days to completion.` });
    }
  }

  // Academy scouting
  for (const s of state.academy?.scouts || []) {
    if (s.complete && scoutsBefore.has(s.id) && !scoutsBefore.get(s.id)) {
      item(`done:scout:${s.id}`, "scouting", `Scouting report in: ${s.regionLabel || s.regionKey}`, {
        dept: "Academy", detail: s.prospect ? `${s.prospect.name}, ${s.prospect.age ?? "?"}, is ready to review in the Academy.` : "A prospect is ready to review.", important: true,
      });
    }
  }

  // Driver market news written by processMarketDay this tick
  const myTeam = state.team?.name;
  const followed = new Set([...(state.transferMarket?.shortlist || []), ...Object.keys(state.transferMarket?.talks || {})]);
  for (const n of [...(state.transferMarket?.news || [])].reverse()) {
    if (newsIdsBefore.has(n.id)) continue;
    const mine = n.team === myTeam || followed.has(n.driver) || n.type === "scouting" || n.type === "reminder";
    const type = n.type === "pre_contract" || n.type === "reminder" ? "contract" : "market";
    item(`news:${n.id}`, type, n.text, { dept: mine ? "Driver market" : "Paddock", important: mine && n.type !== "scouting" });
  }

  // Rival development: specs move after each race (applyRoundCarDevelopmentAll)
  if (sim.rivalSnap.round !== round || sim.rivalSnap.year !== yr) {
    const now = snapshotTeams(state);
    const nextName = calRound?.name || "the next round";
    const gains = Object.entries(now.teams).map(([name, v]) => {
      const was = sim.rivalSnap.teams?.[name];
      if (!was) return null;
      const da = r1(v.aero - was.aero), dc = r1(v.chassis - was.chassis), dr = r1(v.reliability - was.reliability), dp = r1(v.perf - was.perf);
      const sum = da + dc + dr + dp;
      if (sum <= 0.05) return null;
      return { name, da, dc, dr, dp, sum, round, next: nextName, mine: name === myTeam };
    }).filter(Boolean).sort((a, b) => b.sum - a.sum);
    sim.rivalQueue = gains.slice(0, 6);
    sim.rivalSnap = now;
  }
  for (const g of sim.rivalQueue.splice(0, 2)) {
    const parts = [g.da > 0 && `aero +${g.da}`, g.dc > 0 && `chassis +${g.dc}`, g.dr > 0 && `reliability +${g.dr}`].filter(Boolean).join(", ");
    if (g.mine) {
      item(`dev:${yr}:${g.round}:${g.name}`, "development", "Rolling development lands on our car", { dept: "Engineering", detail: `${parts || "Small gains"} ahead of the ${g.next}.` });
    } else {
      item(`dev:${yr}:${g.round}:${g.name}`, "rival", `${shortTeam(g.name)} bring an upgrade package`, { dept: "Paddock", detail: `${parts || "Minor gains"} for the ${g.next}.`, team: g.name });
    }
  }

  // Next race: commercial brief and weather forecast
  if (calRound) {
    if (daysUntilRace === SPONSOR_BRIEF_DAYS_OUT) {
      const targets = generateRaceBonusChallenges(state, calRound).map((c) => c.label);
      if (targets.length) item(`spbrief:${yr}:${round}`, "sponsor", `Partners set bonus targets for the ${calRound.name}`, { dept: "Commercial", detail: targets.join(" · ") });
      const due = SPONSOR_SLOTS.map((s) => state.team?.sponsorSlots?.[s.key]).filter(Boolean)
        .flatMap((sp) => (sp.objectives || []).filter((o) => !o.complete && o.deadline === round).map((o) => `${sp.name}: ${o.label}`));
      if (due.length) item(`spdue:${yr}:${round}`, "sponsor", "Sponsor objectives due this weekend", { dept: "Commercial", detail: due.join(" · "), important: true });
    }
    if (daysUntilRace === FORECAST_DAYS_OUT) {
      const w = ensureRaceWeekend(state)?.weather;
      if (w) item(`wx:${yr}:${round}`, "weather", `${calRound.name.replace(" Grand Prix", "")} forecast: ${w.isWet ? "rain expected" : "dry"}`, {
        dept: "Strategy", detail: `${w.rainProbability}% chance of rain · air ${w.airTemperature}°C · track ${w.trackTemperature}°C`,
      });
    }
  }

  // Scheduled calendar markers for today (market reviews, board, windows, weekend start)
  const todays = getCalendarEvents(state, day, day)[day] || [];
  for (const ev of todays) {
    if (ev.type === "race" || ev.type === "qualifying" || ev.type === "development" || ev.type === "factory" || ev.type === "scouting") continue;
    if (ev.type === "practice") {
      item(`arrive:${ev.key}`, "race", `Paddock opens in ${calRound?.country || "the next venue"}`, { dept: "Team", detail: `Freight and crew arrive at ${calRound?.circuit || "the circuit"}.` });
      continue;
    }
    item(`cal:${ev.key}`, ev.type, ev.title, { dept: EVENT_META[ev.type]?.label, detail: ev.detail, important: !!ev.important });
  }

  const arrived = daysUntilRace === 0;
  if (arrived && calRound) {
    item(`live:${yr}:${round}`, "race", `${calRound.name} weekend is live`, { dept: "Team", detail: `${calRound.circuit} · Round ${round}`, important: true });
  }

  const fresh = pushFeed(state, items);
  return {
    advanced: true,
    reason: "ok",
    day,
    items: fresh,
    important: fresh.some((i) => i.important && i.type !== "race"),
    arrived,
  };
}

/**
 * Advance up to `maxDays` without any animation (same tick, same stop rules).
 * Used by tests and non-visual callers; the panel animates simulateSeasonDay itself.
 */
export function runSeasonDays(state, maxDays, { stopOnImportant = false } = {}) {
  const log = [];
  for (let i = 0; i < maxDays; i++) {
    const res = simulateSeasonDay(state);
    if (!res.advanced) break;
    log.push(res);
    if (res.arrived || (stopOnImportant && res.important)) break;
  }
  return log;
}

// ─── Arrival briefing ───────────────────────────────────────────────────────
/** Everything the race-weekend arrival card shows, from live state. */
export function getArrivalBriefing(state) {
  const round = state.season?.round || 1;
  const cal = (state.season?.calendar || []).find((r) => r.round === round);
  if (!cal) return null;
  const weekend = ensureRaceWeekend(state);
  // Same championship order (with count-back) the dashboard and standings use
  const teamOrder = getConstructorOrder(state);
  const driverOrder = getDriverOrder(state);
  const mine = teamOrder.find((t) => t.name === state.team?.name) || { pos: teamOrder.length, points: 0 };
  const myDrivers = (state.team?.drivers || []).slice(0, 2).map((d) => {
    const row = driverOrder.find((x) => x.name === d.name);
    return { name: d.name, pts: row?.points || 0, pos: row?.pos || 0 };
  });

  // Changes since the previous race weekend, from the stored feed
  const prevRaceDay = round > 1 ? getRoundRaceDay(round - 1) : 0;
  const yr = seasonYear(state);
  const changes = (state.seasonSim?.feed || [])
    .filter((f) => f.year === yr && f.day > prevRaceDay && (f.type === "rival" || ((f.type === "development" || f.type === "factory") && (f.important || f.key.startsWith("dev:")))))
    .slice(0, 4)
    .map((f) => ({ title: f.title, detail: f.detail, type: f.type }));
  const delivering = (state.engineering?.projects || []).filter((p) => p.status === "active" && p.completionRound <= round)
    .map((p) => ({ title: `${p.label} ready to fit`, detail: `Expected ${p.expectedGain}`, type: "development" }));

  return {
    round,
    totalRounds: totalRounds(state),
    name: cal.name,
    circuit: cal.circuit,
    country: cal.country,
    laps: cal.laps,
    sprint: !!cal.sprint,
    date: dayInfo(state, getRoundRaceDay(round)).label,
    weather: weekend?.weather || null,
    objective: weekend?.recommendedObjective?.label || null,
    rival: weekend?.standingsImpact?.nearestRival || null,
    rivalGap: weekend?.standingsImpact?.gapToRival ?? null,
    team: { pos: mine.pos, pts: mine.points || 0, of: teamOrder.length, leader: { name: teamOrder[0]?.name, pts: teamOrder[0]?.points || 0 } },
    drivers: myDrivers,
    changes: [...delivering, ...changes].slice(0, 4),
  };
}
