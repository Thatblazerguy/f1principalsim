/**
 * Season rollover: everything that happens between the last race of one
 * season and round 1 of the next, as plain functions so it can be tested
 * outside React.
 *
 * Order (see screens/offseason.tsx):
 *   1. runSeasonEnd(state)          — once, when the offseason screen opens.
 *      Snapshots the final classification, pays prize money / TV rights,
 *      sets ATR allowances, then runs the driver market's season end
 *      (contracts of race/reserve drivers tick down there).
 *   2. applySeasonRollover(state)   — once, when the player starts the next
 *      season, BEFORE standings are cleared. AI car development, driver
 *      progression (age curve + results), academy development (academy
 *      contracts tick down there) and AI facility development all use the
 *      final classification of the season just finished.
 *
 * Contract ownership (each contract decrements exactly once per rollover):
 *   - Race and reserve drivers on any team (player + AI):
 *       game/transferMarket.js processMarketSeasonEnd (guarded by market.seasonEnd)
 *   - Academy prospects and academy drivers out on loan:
 *       game/development.js processSeasonDevelopment (guarded by academy.lastProcessedYear)
 *   An academy driver is never on a team roster at the same time (promotion
 *   removes them from the academy), so the two sets do not overlap.
 */
import { constructorEntries, driverEntries } from "../utils/championshipModel.js";
import { getDevelopmentConvergenceMult } from "../utils/raceBalance.js";
import { processMarketSeasonEnd } from "./transferMarket.js";
import { processSeasonDevelopment } from "./development.js";
import { drivers as DRIVER_POOL } from "../data/drivers.js";

// ─── Tuning ──────────────────────────────────────────────────────────────────
/** AI car OVR never goes above this in the offseason step. */
export const AI_OVR_CAP = 97;
export const AI_OVR_FLOOR = 70;
const SPEC_CAP = 99;
const SPEC_FLOOR = 40;
/** A sub-spec (aero/chassis/reliability) may sit at most this far above OVR after offseason growth. */
const SPEC_ABOVE_OVR = 5;

export const DRIVER_STAT_KEYS = ["pace", "quali", "racecraft", "consistency", "tyre", "wet"];
export const DRIVER_STAT_MIN = 40;
export const DRIVER_STAT_MAX = 99;

export const PRIZE_MONEY = [68.0, 58.0, 50.0, 43.0, 37.0, 31.0, 25.0, 20.0, 15.0, 10.0];
export const TV_RIGHTS_SHARE = [33.0, 28.6, 26.4, 24.2, 22.0, 19.8, 17.6, 15.4, 13.2, 11.0];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// ─── Final classification ────────────────────────────────────────────────────
const allTeams = (state) => [state.team, ...(state.aiTeams || [])].filter(Boolean);

/**
 * Constructors in official order (count-back included) for the season that is
 * ending. Teams missing from the championship table are appended by points.
 */
export function getFinalConstructorOrder(state) {
  const ordered = constructorEntries(state).map(([name]) => name);
  const seen = new Set(ordered);
  const pts = state.standings?.teams || {};
  const missing = allTeams(state).map((t) => t.name).filter((n) => !seen.has(n))
    .sort((a, b) => (pts[b] || 0) - (pts[a] || 0));
  const live = new Set(allTeams(state).map((t) => t.name));
  return [...ordered, ...missing].filter((n) => live.has(n));
}

/** Drivers in official order for the season that is ending. */
export function getFinalDriverOrder(state) {
  return driverEntries(state).map(([name]) => name);
}

/**
 * Snapshot of the final classification, stored on the season so later steps
 * (which may run after other screens touched state) use the same order.
 */
export function snapshotFinalClassification(state) {
  const year = state.season?.year || 1;
  const existing = state.season?.finalClassification;
  if (existing && existing.year === year) return existing;
  const snap = { year, teams: getFinalConstructorOrder(state), drivers: getFinalDriverOrder(state) };
  if (state.season) state.season.finalClassification = snap;
  return snap;
}

// ─── ATR (wind tunnel / CFD allowance) ───────────────────────────────────────
/**
 * Aerodynamic testing allowance for a finishing position (0-based index).
 * P1 gets 70%, each place below adds 5% (P10 115%, P11 120%), capped at 125%
 * so a very large grid still gets a defined, non-decreasing value.
 */
export function getAtrMultiplier(index, teamCount = 10) {
  const last = Math.max(0, (teamCount || 1) - 1);
  const i = clamp(Number.isFinite(index) ? index : last, 0, last);
  return r2(Math.min(1.25, 0.70 + 0.05 * i));
}

// ─── AI car development ──────────────────────────────────────────────────────
/**
 * Offseason OVR change for one AI car. Raw development is scaled by the ATR
 * allowance and by getDevelopmentConvergenceMult (diminishing returns) and
 * tapers to zero near the cap. A team that climbs well above its own
 * long-run level (`baseline`, its rating when the save first rolled over)
 * loses ground as rivals copy its ideas, so the field compresses and drifts
 * up slowly but keeps a spread instead of piling up at the cap.
 */
export function computeAiCarGain(ovr, atrMultiplier = 1, rng = Math.random, baseline = ovr) {
  const base = 0.8 + rng() * 2.4;                              // 0.8–3.2 raw development
  const conv = getDevelopmentConvergenceMult(ovr);             // 0.40–1.35
  const headroom = clamp((AI_OVR_CAP - ovr) / 10, 0, 1);       // 0 at the cap
  const erosion = Math.max(0, ovr - (baseline + 2)) * 0.25;
  return base * atrMultiplier * conv * headroom - erosion;
}

/** Apply offseason development to one AI team, keeping carPerformance and specs in step. */
export function developAiCar(team, atrMultiplier = 1, rng = Math.random) {
  const ovr = Number(team.carPerformance) || Number(team.specs?.ovr) || 85;
  if (!Number.isFinite(team.devBaseline)) team.devBaseline = ovr;
  const next = r1(clamp(ovr + computeAiCarGain(ovr, atrMultiplier, rng, team.devBaseline), AI_OVR_FLOOR, AI_OVR_CAP));
  const delta = next - ovr;
  team.carPerformance = next;
  if (!team.specs || typeof team.specs !== "object") team.specs = {};
  for (const key of ["aero", "chassis", "reliability"]) {
    const cur = Number(team.specs[key]);
    if (!Number.isFinite(cur)) { team.specs[key] = next; continue; }
    const ceiling = Math.max(Math.min(cur, SPEC_CAP), Math.min(SPEC_CAP, next + SPEC_ABOVE_OVR));
    team.specs[key] = r1(clamp(cur + delta, SPEC_FLOOR, ceiling));
  }
  team.specs.ovr = next;
  return delta;
}

/**
 * Offseason car development for every AI team, by finishing position.
 * @param {object} state
 * @param {string[]} finalOrder constructor names in official order
 */
export function developAiCars(state, finalOrder, rng = Math.random) {
  const teams = allTeams(state);
  const order = finalOrder?.length ? finalOrder : getFinalConstructorOrder(state);
  const n = Math.max(order.length, teams.length);
  for (const t of state.aiTeams || []) {
    const idx = order.indexOf(t.name);
    const atr = getAtrMultiplier(idx === -1 ? n - 1 : idx, n);
    t.atrMultiplier = atr;
    developAiCar(t, atr, rng);
  }
}

// ─── Driver progression ──────────────────────────────────────────────────────
/**
 * Expected rating change per season from age alone (age during the season
 * just finished). Young drivers improve, 26–31 is the peak plateau, decline
 * starts after 33 and speeds up after 36.
 */
export function ageCurveDelta(age) {
  const a = Number.isFinite(age) ? age : 27;
  if (a <= 20) return 2.0;
  if (a < 24) return 2.0 - (a - 20) * 0.3;   // 21: 1.7 … 23: 1.1
  if (a < 26) return 0.6;
  if (a <= 31) return 0.15;
  if (a <= 33) return -0.3;
  if (a <= 36) return -0.8 - (a - 34) * 0.2; // 34: -0.8 … 36: -1.2
  return Math.max(-3.0, -1.6 - (a - 37) * 0.35);
}

/** Results component: champion +0.6, median 0, last -0.6. Unranked drivers -0.2. */
export function performanceDelta(percentile) {
  if (percentile == null || !Number.isFinite(percentile)) return -0.2;
  return (clamp(percentile, 0, 1) - 0.5) * 1.2;
}

// Experience protects racecraft/consistency/tyre management from the age decline.
const DECLINE_WEIGHT = { pace: 1, quali: 1, wet: 0.8, racecraft: 0.6, consistency: 0.5, tyre: 0.5 };

/**
 * One season of progression for one driver. Mutates and returns the change.
 * @param {object} d driver
 * @param {{ percentile?: number|null, rng?: () => number, ageUp?: boolean }} opts
 */
export function progressDriver(d, { percentile = null, rng = Math.random, ageUp = true } = {}) {
  const age = typeof d.age === "number" ? d.age : 27;
  const ageDelta = ageCurveDelta(age);
  const perf = performanceDelta(percentile);
  const ceiling = Number.isFinite(d.potentialCeiling) ? Math.max(d.potentialCeiling + 3, 0) : DRIVER_STAT_MAX;
  let total = 0, count = 0;
  for (const k of DRIVER_STAT_KEYS) {
    if (typeof d[k] !== "number") continue;
    const ageK = ageDelta < 0 ? ageDelta * (DECLINE_WEIGHT[k] ?? 1) : ageDelta;
    let change = ageK + perf + (rng() - 0.5) * 0.8;
    // Growth slows near the driver's ceiling and the global max.
    if (change > 0) {
      const room = Math.min(ceiling, DRIVER_STAT_MAX) - d[k];
      change = room <= 0 ? 0 : change * clamp(room / 6, 0.15, 1);
    }
    const next = r1(clamp(d[k] + change, DRIVER_STAT_MIN, DRIVER_STAT_MAX));
    total += next - d[k]; count += 1;
    d[k] = next;
  }
  const avg = count ? total / count : 0;
  if (typeof d.market === "number") {
    const ageMarket = age >= 34 ? -1 : 0;
    d.market = r1(clamp(d.market + avg * 2 + ageMarket, 10, 99));
  }
  if (ageUp && typeof d.age === "number") d.age += 1;
  return avg;
}

/**
 * Progress every driver on a team roster (race + reserve, player + AI).
 * Drivers in `skip` were already aged and developed this offseason (the
 * market's season end does that for free agents) and are left alone.
 */
export function progressRosterDrivers(state, driverOrder, { rng = Math.random, skip = null } = {}) {
  const order = driverOrder?.length ? driverOrder : getFinalDriverOrder(state);
  const total = order.length;
  const done = new Set();
  for (const t of allTeams(state)) {
    for (const d of [...(t.drivers || []), ...(t.reserveDriver ? [t.reserveDriver] : [])]) {
      if (!d || done.has(d) || skip?.has(d)) continue;
      done.add(d);
      const idx = order.indexOf(d.name);
      const percentile = idx === -1 || !total ? null : (total - idx) / total;
      progressDriver(d, { percentile, rng });
    }
  }
}

// ─── End-of-season finance ───────────────────────────────────────────────────
const SPONSOR_SLOTS = [
  { key: "title", label: "Title sponsor" },
  { key: "kit", label: "Kit sponsor" },
  { key: "sidepod", label: "Sidepod sponsor" },
  { key: "rearWing", label: "Rear wing sponsor" },
  { key: "halo", label: "Halo sponsor" },
];

/**
 * Prize money, TV rights and ATR allowance by official classification, plus
 * the player's sponsor payouts. Money is paid once per season
 * (season.reportProcessed); the report is returned every call.
 * @returns {{ report: object|null, changed: boolean }}
 */
export function processEndOfSeasonFinancials(state) {
  if (!state.team) return { report: null, changed: false };
  const order = state.season?.finalClassification?.year === (state.season?.year || 1)
    ? state.season.finalClassification.teams
    : getFinalConstructorOrder(state);
  const byName = new Map(allTeams(state).map((t) => [t.name, t]));
  const teamList = order.map((n) => byName.get(n)).filter(Boolean);
  for (const t of allTeams(state)) if (!teamList.includes(t)) teamList.push(t);

  const alreadyProcessed = state.season.reportProcessed === state.season.year;
  const n = teamList.length;
  let playerReport = null;

  teamList.forEach((team, index) => {
    const pos = index + 1;
    const prize = PRIZE_MONEY[index] ?? PRIZE_MONEY[PRIZE_MONEY.length - 1];
    const tvRights = TV_RIGHTS_SHARE[index] ?? TV_RIGHTS_SHARE[TV_RIGHTS_SHARE.length - 1];
    const atrMultiplier = getAtrMultiplier(index, n);
    team.atrMultiplier = atrMultiplier;
    if (!alreadyProcessed) team.budget = r1((team.budget || 0) + prize + tvRights);

    if (team === state.team) {
      let sponsorTotal = 0;
      const sponsorDetails = [];
      SPONSOR_SLOTS.forEach((slot) => {
        const sponsor = state.team.sponsorSlots?.[slot.key];
        if (!sponsor) return;
        const payout = r1((sponsor.monthlyIncome || 0) * 5 + (sponsor.performanceBonus || 0) * ((sponsor.relationshipLevel || 100) / 100) * 2);
        sponsorTotal += payout;
        sponsorDetails.push({ name: sponsor.name, slot: slot.label, payout });
        if (!alreadyProcessed) state.team.budget = r1(state.team.budget + payout);
      });
      const carRank = [...teamList].sort((a, b) => b.carPerformance - a.carPerformance).indexOf(team) + 1;
      const performanceEvaluation = pos < carRank ? "Overperformed car rank" : pos > carRank ? "Underperformed car rank" : "Met expectations";
      playerReport = { position: pos, carRank, performanceEvaluation, prize, tvRights, atrMultiplier, sponsorTotal, sponsorDetails };
    }
  });

  if (!alreadyProcessed) state.season.reportProcessed = state.season.year;
  return { report: playerReport, changed: !alreadyProcessed };
}

// ─── Step 1: season end (offseason screen opens) ─────────────────────────────
function knownDrivers(state) {
  const list = [...DRIVER_POOL];
  for (const t of allTeams(state)) list.push(...(t.drivers || []), ...(t.reserveDriver ? [t.reserveDriver] : []));
  return list.filter(Boolean);
}

/**
 * Season-end processing. Safe to call any number of times: each part is
 * guarded per season. Call it from an event/navigation handler, never from
 * inside a React render.
 * @returns {{ report: object|null, changed: boolean }} changed → caller should save
 */
export function runSeasonEnd(state) {
  const year = state.season?.year || 1;
  snapshotFinalClassification(state);
  const fin = processEndOfSeasonFinancials(state);

  // The market's season end ages and develops free agents/prospects. Record
  // who it touched so the rollover does not age them a second time if they
  // are signed during the offseason.
  const before = new Map(knownDrivers(state).map((d) => [d, d.age]));
  const market = processMarketSeasonEnd(state);
  if (market.processed) {
    const aged = state.season.marketAgedDrivers || [];
    for (const [d, age] of before) if (typeof age === "number" && d.age > age && !aged.includes(d.name)) aged.push(d.name);
    state.season.marketAgedDrivers = aged;
  }
  return { report: fin.report, changed: fin.changed || market.processed, year };
}

// ─── Step 2: rollover (player starts the next season) ────────────────────────
/**
 * Development and progression for the season just finished. Must run before
 * standings are reset. Guarded so it runs once per season.
 * @param {object} state
 * @param {{ upcomingCalendar?: any[], rng?: () => number }} [opts]
 * @returns {{ processed: boolean }}
 */
export function applySeasonRollover(state, { upcomingCalendar = null, rng = Math.random } = {}) {
  const year = state.season?.year || 1;
  if (state.seasonRolloverYear === year) return { processed: false };
  const snap = snapshotFinalClassification(state);

  developAiCars(state, snap.teams, rng);

  const marketAged = new Set(state.season?.marketAgedDrivers || []);
  const skip = new Set();
  for (const t of allTeams(state)) {
    for (const d of [...(t.drivers || []), ...(t.reserveDriver ? [t.reserveDriver] : [])]) {
      if (d && marketAged.has(d.name)) skip.add(d);
    }
  }
  progressRosterDrivers(state, snap.drivers, { rng, skip });

  processSeasonDevelopment(state, { finalOrder: snap.teams, upcomingCalendar });

  state.seasonRolloverYear = year;
  return { processed: true };
}
