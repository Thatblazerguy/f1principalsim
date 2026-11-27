// Read-only helpers for the Race weekend screens (overview + preparation).
//
// Everything comes from existing state and engines:
//   - state.weekendProgress / state.raceWeekend      → sessions, weather, objectives
//   - engineeringSystem driver pools                 → power unit wear and allocation
//   - state.engineering.projects, team.pendingUpgrades, team.upgradeHistory → factory
//   - state.standings + raceHistory                  → championship situation
//   - state.aiTeams                                  → rival intelligence
//   - state.notifications + weekend events           → communications timeline
//   - finance.raceReports[].bonuses                  → bonus challenge history
// Nothing here mutates state.

import { constructorEntries, driverEntries, getConstructorOrder } from "./championshipModel.js";
import { CIRCUIT_LIBRARY } from "../fia/circuitLibrary.js";
import { COMPONENT_CATALOG, getActiveComponent, ensureEngineeringState } from "./engineeringSystem.js";
import { formatSeasonDate } from "./seasonTimeline.js";

const ord = (n) => { const s = ["th", "st", "nd", "rd"]; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export { ord };

// ─── Sessions ────────────────────────────────────────────────────────────────
/**
 * Where the weekend is. Practice is optional in the game; qualifying unlocks
 * the race. All track sessions run on race day once the window opens.
 */
export function getSessionState({ raceWindowOpen, daysUntilRace, weekendProgress, practiceRun, sprintWeekend = false }) {
  const qualiDone = !!weekendProgress?.qualifyingComplete;
  const raceDone = !!weekendProgress?.raceComplete;
  // Sprint weekends: the sprint runs from the qualifying grid before the Grand Prix
  const sprintDone = !sprintWeekend || !!weekendProgress?.sprintComplete;
  const steps = [
    { id: "practice", label: "Practice", status: !raceWindowOpen ? "locked" : practiceRun || qualiDone ? "done" : "open" },
    { id: "qualifying", label: "Qualifying", status: !raceWindowOpen ? "locked" : qualiDone ? "done" : "next" },
    ...(sprintWeekend ? [{ id: "sprint", label: "Sprint", status: !raceWindowOpen || !qualiDone ? "locked" : sprintDone ? "done" : "next" }] : []),
    { id: "race", label: "Race", status: !raceWindowOpen ? "locked" : raceDone ? "done" : qualiDone && sprintDone ? "next" : "locked" },
  ];
  let current; let next;
  if (raceDone) { current = "Race complete"; next = "Simulate days to reach the next round"; }
  else if (!raceWindowOpen) { current = "Factory days"; next = `Track opens in ${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"}`; }
  else if (!qualiDone) { current = practiceRun ? "Practice run" : "Track open"; next = "Qualifying today"; }
  else if (!sprintDone) { current = "Parc fermé"; next = "Sprint today"; }
  else { current = "Parc fermé"; next = "Race today"; }
  const practiceDone = !!(practiceRun || weekendProgress?.practiceComplete || qualiDone);
  return { steps, current, next, practiceDone, qualiDone, sprintWeekend, sprintDone, raceDone, live: raceWindowOpen && !raceDone };
}

// ─── Power unit ──────────────────────────────────────────────────────────────
const PU_ORDER = ["ICE", "TC", "MGUH", "MGUK", "ES", "CE", "GB"];

export function getPowerUnitReadiness(appState, driverName) {
  ensureEngineeringState(appState);
  const pool = appState.engineering?.driverPools?.[driverName] || {};
  return PU_ORDER.filter((k) => COMPONENT_CATALOG[k]).map((k) => {
    const c = getActiveComponent(appState, driverName, k);
    const wear = c ? Math.max(0, Math.min(100, c.wear || 0)) : null;
    const health = wear == null ? null : 100 - wear;
    const used = Array.isArray(pool[k]) ? pool[k].length : 0;
    const allocation = COMPONENT_CATALOG[k].allocation;
    const status = health == null ? "No data" : health < 30 ? "Critical" : health < 55 ? "Worn" : health < 80 ? "Used" : "Fresh";
    return { key: k, name: COMPONENT_CATALOG[k].name, health, used, allocation, overAllocation: used > allocation, status };
  });
}

// ─── Factory ─────────────────────────────────────────────────────────────────
export function getFactoryStatus(appState) {
  const round = appState.season?.round || 1;
  const day = appState.season?.currentDay || 1;
  const projects = appState.engineering?.projects || [];
  const active = projects.filter((p) => p.status === "active").map((p) => {
    const span = Math.max(1, (p.completionRound || round) - (p.startRound || round));
    return { id: p.id, label: p.label, eta: p.completionRound, progress: Math.max(0, Math.min(1, (round - (p.startRound || round)) / span)), gain: p.expectedGain, tab: "projects" };
  });
  const introduced = projects.filter((p) => ["success", "overperform", "underperform"].includes(p.status)).slice(-3).reverse()
    .map((p) => ({ id: p.id, label: p.label, outcome: p.status, gain: p.expectedGain, tab: "projects" }));
  const queue = (appState.team?.pendingUpgrades || []).slice().sort((a, b) => a.readyDay - b.readyDay)
    .map((u, i) => ({ id: `q${i}`, label: u.part, daysLeft: Math.max(0, u.readyDay - day), readyDate: formatSeasonDate(appState.season?.year || 1, u.readyDay), gain: u.expectedGain, tab: "development" }));
  const history = appState.team?.upgradeHistory || [];
  const latest = history.length ? history[history.length - 1] : null;
  return { active, introduced, queue, latest, carPerformance: appState.team?.carPerformance ?? null, carLevel: appState.team?.carLevel ?? null };
}

// ─── Championship ────────────────────────────────────────────────────────────

export function getChampionshipSituation(appState, activeDrivers) {
  // Championship order with count-back tie-breaks (utils/championshipModel.js).
  const teams = constructorEntries(appState);
  const drivers = driverEntries(appState);
  const anyPoints = teams.some(([, v]) => v > 0);
  const me = appState.team?.name;
  const tIdx = teams.findIndex(([n]) => n === me);
  const myPts = tIdx >= 0 ? teams[tIdx][1] : 0;
  const ahead = tIdx > 0 ? { name: teams[tIdx - 1][0], gap: teams[tIdx - 1][1] - myPts } : null;
  const behind = tIdx >= 0 && tIdx < teams.length - 1 ? { name: teams[tIdx + 1][0], gap: myPts - teams[tIdx + 1][1] } : null;
  const driverRows = (activeDrivers || []).map((d) => {
    const i = drivers.findIndex(([n]) => n === d.name);
    return { name: d.name, pos: anyPoints && i >= 0 ? i + 1 : null, points: i >= 0 ? drivers[i][1] : 0 };
  });
  const leader = teams[0] || null;
  return {
    anyPoints,
    teamPos: anyPoints && tIdx >= 0 ? tIdx + 1 : null,
    teamPoints: myPts,
    fieldSize: teams.length || (1 + (appState.aiTeams?.length || 0)),
    ahead, behind,
    leader: leader ? { name: leader[0], points: leader[1] } : null,
    drivers: driverRows,
  };
}

// ─── Rivals ──────────────────────────────────────────────────────────────────
/**
 * The three teams nearest to us: by points once anyone has scored, otherwise
 * by car performance. Threat: rival car quicker than ours and close on points
 * = High; car within 2 points of performance = Medium; otherwise Low.
 */
export function getRivalIntel(appState) {
  const me = appState.team;
  const myPerf = me?.carPerformance ?? 0;
  const pts = appState.standings?.teams || {};
  const anyPoints = Object.values(pts).some((v) => v > 0);
  const all = [me, ...(appState.aiTeams || [])].filter(Boolean);
  const order = anyPoints
    ? (() => { const pos = new Map(getConstructorOrder(appState).map((t) => [t.name, t.pos])); return [...all].sort((a, b) => (pos.get(a.name) ?? 99) - (pos.get(b.name) ?? 99)); })()
    : [...all].sort((a, b) => (b.carPerformance || 0) - (a.carPerformance || 0));
  const myIdx = order.findIndex((t) => t.name === me?.name);
  const near = order
    .map((t, i) => ({ t, i, dist: Math.abs(i - myIdx) + (i < myIdx ? 0 : 0.5) }))
    .filter((x) => x.t.name !== me?.name)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i);
  return {
    basis: anyPoints ? "points" : "car performance",
    rivals: near.map(({ t, i }) => {
      const perf = t.carPerformance ?? null;
      const perfGap = perf == null ? 0 : perf - myPerf;
      const pointsGap = (pts[t.name] || 0) - (pts[me?.name] || 0);
      const facilities = Object.values(t.finance?.facilities || {}).reduce((s, f) => s + Math.max(0, (f?.level || 1) - 1), 0);
      const threat = perfGap > 1 && Math.abs(pointsGap) <= 15 ? "High" : Math.abs(perfGap) <= 2 ? "Medium" : perfGap > 0 ? "High" : "Low";
      return {
        name: t.name, rank: i + 1, points: pts[t.name] || 0, pointsGap, perf, perfGap,
        drivers: (t.drivers || []).slice(0, 2).map((d) => ({ name: d.name, rating: Math.round(((d.pace || 0) + (d.quali || 0) + (d.racecraft || 0) + (d.consistency || 0)) / 4) })),
        facilities, threat,
      };
    }),
  };
}

// ─── Circuit intelligence ───────────────────────────────────────────────────
export function getCircuitIntel(round) {
  if (!round) return null;
  const lib = CIRCUIT_LIBRARY.find((c) => c.name === round.circuit || c.circuitId === round.circuit) || CIRCUIT_LIBRARY.find((c) => c.grandPrix === round.name);
  return {
    grandPrix: round.name, circuit: round.circuit, country: round.country || lib?.country, region: lib?.region || null,
    type: lib?.type || null, laps: round.laps ?? lib?.laps ?? null, lengthKm: lib?.lengthKm ?? null, corners: lib?.corners ?? null,
    longestStraightM: lib?.longestStraightM ?? null, elevationM: lib?.elevationChangeM ?? null, overtaking: lib?.overtakingDifficulty ?? null,
    downforce: lib?.downforceDemand ?? null, tyreSeverity: lib?.tyreSeverity ?? null, description: lib?.description ?? null,
    perf: lib?.perf || null, characteristics: lib?.keyCharacteristics || [], idealCar: lib?.idealCar || null,
    sprint: !!round.sprint, baseTime: round.baseTime ?? null, tyreWear: round.tyreWear ?? null,
  };
}

// ─── Communications ─────────────────────────────────────────────────────────
const DEPTS = [
  { re: /upgrade|facility|engineering|component|power unit|penalt/i, dept: "Engineering", screen: "engineering" },
  { re: /academy|loan|prospect/i, dept: "Academy", screen: "academy" },
  { re: /sponsor|budget|finance|\$/i, dept: "Commercial", screen: "finance" },
  { re: /contract|signed|released|driver/i, dept: "Driver management", screen: "drivers" },
];
const URGENT = /expired|penalt|failed|critical|left the|refused|over allocation/i;

export function getCommsTimeline(appState, { weekendProgress, setupRuns = [], raceDay = null, raceWindowOpen = false } = {}) {
  const year = appState.season?.year || 1;
  const items = (appState.notifications || []).slice(0, 10).map((n, i) => {
    const msg = String(n.message || "");
    const d = DEPTS.find((x) => x.re.test(msg));
    return { id: `n${i}`, day: n.day ?? null, when: n.day ? formatSeasonDate(year, n.day) : "", from: d?.dept || "Team manager", text: msg, urgent: URGENT.test(msg), screen: d?.screen || null };
  });
  const weekend = [];
  if (raceWindowOpen && raceDay != null) {
    const when = formatSeasonDate(year, raceDay);
    setupRuns.slice(-2).forEach((r) => weekend.push({ id: `run${r.n}`, day: raceDay, when, from: "Race engineering", text: `Setup run ${r.n} with ${r.driver}: ${r.observed >= 0 ? "+" : ""}${r.observed.toFixed(3)}s against a predicted ${r.predicted >= 0 ? "+" : ""}${r.predicted.toFixed(3)}s.`, urgent: false, screen: "prep" }));
    const locked = Object.keys(weekendProgress?.selectedStrategies || {});
    if (locked.length) weekend.push({ id: "strat", day: raceDay, when, from: "Strategy", text: `Race strategy locked for ${locked.map((n) => n.split(" ").pop()).join(" and ")}.`, urgent: false, screen: "prep" });
    if (weekendProgress?.qualifyingComplete) weekend.push({ id: "parc", day: raceDay, when, from: "Race control", text: "Parc fermé is in force. The setup can no longer change.", urgent: true, screen: null });
  }
  return [...weekend.reverse(), ...items].slice(0, 9);
}

// ─── Bonus challenges ───────────────────────────────────────────────────────
export const CHALLENGE_RULES = {
  fastest_lap: "One of your drivers sets the race's fastest lap.",
  double_points: "Both drivers finish in the points.",
  gain_positions: "Your drivers gain 5 places in total from the grid.",
  no_dnf: "Neither driver retires.",
  beat_rival: "Score 6 points or more, or a driver finishes P8 or better.",
  one_stop: "Both drivers finish and one finishes in the top 10.",
};

/** Last result for each challenge id from the race reports. */
export function getChallengeHistory(appState) {
  const out = {};
  (appState.finance?.raceReports || []).forEach((r) => (r.bonuses || []).forEach((b) => {
    out[b.id] = out[b.id] || { attempts: 0, done: 0 };
    out[b.id].attempts += 1;
    if (b.complete) out[b.id].done += 1;
    out[b.id].last = { round: r.round, complete: !!b.complete };
  }));
  return out;
}
