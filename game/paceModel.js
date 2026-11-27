/**
 * paceModel.js
 * ────────────
 * One race-pace model shared by the quick simulator, the live race engine and
 * the AI race engineer, so all three agree on what a lap should cost.
 *
 * Balance philosophy — car first, driver second, but drivers matter:
 *
 *   Car       ~0.075s per OVR point   (best→worst car ≈ 1.2s/lap)
 *   Driver    ~0.034s per skill point (best→worst driver ≈ 0.65s/lap)
 *
 *   Over a season the car explains ~60% of results and the driver ~40%. A great
 *   driver is worth about five car OVR points: an elite driver in a good car can
 *   beat an average driver in a slightly better one, but not one in a much
 *   better car. In the rain the car counts for less and the driver for more.
 *
 * Drivers also win races in ways raw pace doesn't show, and that's where the
 * rest of their attributes come in:
 *   tyre         → slower degradation, longer stints, later cliff
 *   consistency  → less lap-to-lap scatter, fewer mistakes
 *   racecraft    → better launches, more successful overtakes, harder to pass
 *   wet          → big swing in wet races
 *
 * And the car contributes beyond OVR: chassis rating eases tyre wear.
 */

import { computeCircuitSuitability } from "../utils/circuitSuitability.js";
import { getCarSpecs } from "../utils/simTeam.js";
import { getDriverPuPerformance } from "../utils/engineeringSystem.js";
import { getDriverFormMultiplier } from "../utils/raceBalance.js";

// ─── Balance constants ───────────────────────────────────────────────────────

export const CAR_SECONDS_PER_OVR = 0.075;
export const DRIVER_SECONDS_PER_POINT = 0.034;
const CAR_REFERENCE_OVR = 85;
const DRIVER_REFERENCE = 88;

export const FUEL_EFFECT_FULL_TANK = 3.0;   // seconds slower on a full tank than empty
export const TRACK_EVOLUTION = 0.5;         // seconds gained across the race as rubber goes down
export const PIT_LOSS_BASE = 21.0;          // pit lane time loss at racing speed
export const SC_PIT_FACTOR = 0.55;          // pitting under a safety car costs ~55%
export const VSC_PIT_FACTOR = 0.65;

/** Compound behaviour. `deg` is seconds lost per lap of age; `life` is laps to the cliff. */
export const COMPOUNDS = {
  Soft:         { key: "S", offset: -0.55, deg: 0.075, life: 16, wetOffset: 7.0 },
  Medium:       { key: "M", offset: 0.0,   deg: 0.045, life: 26, wetOffset: 7.0 },
  Hard:         { key: "H", offset: 0.40,  deg: 0.028, life: 38, wetOffset: 7.5 },
  Intermediate: { key: "I", offset: 4.0,   deg: 0.060, life: 30, wetOffset: 0.0, wetDeg: 0.035 },
  Wet:          { key: "W", offset: 6.0,   deg: 0.080, life: 35, wetOffset: 0.6, wetDeg: 0.03 },
};
export const DRY_COMPOUNDS = ["Soft", "Medium", "Hard"];

const KEY_TO_COMPOUND = { S: "Soft", M: "Medium", H: "Hard", I: "Intermediate", W: "Wet" };

/** Driver pace modes (live race). Negative delta = faster. */
export const DRIVE_MODES = {
  Attack:   { delta: -0.45, wear: 1.8 },
  Push:     { delta: -0.25, wear: 1.35 },
  Balanced: { delta: 0,     wear: 1.0 },
  Defend:   { delta: 0.10,  wear: 1.1 },
  Conserve: { delta: 0.35,  wear: 0.65 },
};

export const ERS_DELTA = { Overtake: -0.30, Deploy: -0.15, Balanced: 0, Harvest: 0.18 };

// ─── Small helpers ───────────────────────────────────────────────────────────

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Standard normal sample (Box–Muller). */
export function gaussian(rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** How hard it is to pass at this circuit (0 = easy, 1 = Monaco). */
export function getOvertakingDifficulty(track) {
  const t = `${track?.name || ""} ${track?.circuit || ""}`.toLowerCase();
  if (t.includes("monaco")) return 0.95;
  if (t.includes("singapore") || t.includes("marina")) return 0.75;
  if (t.includes("hungar") || t.includes("zandvoort") || t.includes("dutch")) return 0.7;
  if (t.includes("imola") || t.includes("madrid") || t.includes("suzuka") || t.includes("japan")) return 0.6;
  if (t.includes("monza") || t.includes("bahrain") || t.includes("spa") || t.includes("baku") ||
      t.includes("jeddah") || t.includes("saudi") || t.includes("vegas") || t.includes("shanghai") ||
      t.includes("chin") || t.includes("interlagos") || t.includes("paulo")) return 0.3;
  return 0.5;
}

/** Parse a strategy label like "S -> M -> H (Balanced)" into compound names. */
export function parseStrategyCompounds(label) {
  if (!label) return [];
  const head = String(label).split("(")[0];
  const tokens = head.split(/->|→|,|\s+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  const out = [];
  tokens.forEach((t) => {
    if (KEY_TO_COMPOUND[t]) out.push(KEY_TO_COMPOUND[t]);
    else {
      const full = Object.keys(COMPOUNDS).find((c) => c.toUpperCase() === t || c.toUpperCase().startsWith(t));
      if (full && t.length > 1) out.push(full);
    }
  });
  return out;
}

// ─── Driver / car profile ────────────────────────────────────────────────────

function safeSpecs(team) {
  try {
    return getCarSpecs(team);
  } catch (_) {
    const ovr = team?.specs?.ovr ?? team?.carPerformance ?? CAR_REFERENCE_OVR;
    return { ovr, aero: team?.specs?.aero ?? ovr, chassis: team?.specs?.chassis ?? ovr, reliability: team?.specs?.reliability ?? ovr };
  }
}

/**
 * Build the static pace profile for one driver/car for this race.
 * Everything that doesn't change lap to lap lives here.
 */
export function buildPaceProfile({ team, driver, track, isWet = false, weekendContext = null, appState = null }) {
  const specs = safeSpecs(team);
  const carOvr = Number.isFinite(specs.ovr) ? specs.ovr : CAR_REFERENCE_OVR;
  const chassis = Number.isFinite(specs.chassis) ? specs.chassis : carOvr;

  const pace = driver?.pace ?? 85;
  const racecraft = driver?.racecraft ?? 85;
  const consistency = driver?.consistency ?? 85;
  const tyreSkill = driver?.tyre ?? 85;
  const wetSkill = driver?.wet ?? 85;

  // Raw pace. In the rain the car matters less and the driver more.
  const carDelta = -(carOvr - CAR_REFERENCE_OVR) * CAR_SECONDS_PER_OVR * (isWet ? 0.75 : 1);
  const raceSkill = pace * 0.8 + racecraft * 0.1 + consistency * 0.1;
  const driverDelta = -(raceSkill - DRIVER_REFERENCE) * DRIVER_SECONDS_PER_POINT;

  // Circuit fit (car attributes vs circuit demands), damped
  let circuitDelta = 0;
  try {
    circuitDelta = (computeCircuitSuitability(team, track?.circuit || track?.name || "").timeDelta || 0) * 0.4;
  } catch (_) { /* neutral */ }

  // Weekend: setup quality, form, explainable outliers, PU health
  const wc = weekendContext?.drivers?.[driver?.name];
  let weekendDelta = 0;
  let narrative = null;
  if (wc) {
    weekendDelta += -((wc.setupQualityScore ?? 0.5) - 0.5) * 0.30;
    weekendDelta += ((wc.formMult ?? 1) - 1) * 1.5;
    weekendDelta += ((wc.outlierMult ?? 1) - 1) * (track?.baseTime ?? 95) * 0.5;
    narrative = wc.narrativeEvent?.label ?? null;
  } else if (appState?.raceHistory) {
    weekendDelta += (getDriverFormMultiplier(driver?.name, appState.raceHistory) - 1) * 1.5;
  }
  let puDelta = 0;
  if (appState) {
    try { puDelta = (1 - getDriverPuPerformance(appState, driver?.name)) * 0.8; } catch (_) { /* healthy */ }
  }

  const wetDelta = isWet ? -(wetSkill - 85) * 0.03 : 0;

  // Tyre wear multiplier: driver tyre skill and chassis both help
  const wearMult = clamp(1 + (85 - tyreSkill) * 0.012 + (85 - chassis) * 0.006, 0.7, 1.35);

  return {
    driverName: driver?.name,
    teamName: team?.name,
    carOvr,
    raceSkill,
    racecraft,
    consistency,
    baseTime: track?.baseTime ?? 95,
    trackWear: track?.tyreWear ?? 1.2,
    isWet,
    carDelta,
    driverDelta,
    circuitDelta,
    weekendDelta,
    puDelta,
    wetDelta,
    wearMult,
    narrative,
    // Lap-to-lap scatter and mistake rate come from consistency
    noiseSigma: (0.10 + (100 - consistency) * 0.012) * (isWet ? 1.8 : 1),
    mistakeChance: (0.003 + (100 - consistency) * 0.0004) * (isWet ? 2.5 : 1),
    /** Sum of the static pace terms, seconds relative to track base time. */
    staticDelta: carDelta + driverDelta + circuitDelta + weekendDelta + puDelta + wetDelta,
  };
}

// ─── Tyres ───────────────────────────────────────────────────────────────────

/** Effective life (laps to the cliff) for this driver/car on this compound. */
export function tyreLife(profile, compound) {
  const c = COMPOUNDS[compound] || COMPOUNDS.Medium;
  const wetMismatch = isWrongTyre(compound, profile.isWet);
  const base = profile.isWet && c.wetDeg ? c.life * 1.1 : c.life;
  return Math.max(4, (base / (profile.trackWear * profile.wearMult)) * (wetMismatch ? 0.5 : 1));
}

function isWrongTyre(compound, isWet) {
  const wetTyre = compound === "Intermediate" || compound === "Wet";
  return isWet ? !wetTyre : wetTyre;
}

/** Seconds lost to tyre wear at a given tyre age, before the compound offset. */
export function tyreDegPenalty(profile, compound, age, wearRate = 1) {
  const c = COMPOUNDS[compound] || COMPOUNDS.Medium;
  const degPerLap = (profile.isWet && c.wetDeg ? c.wetDeg : c.deg) * profile.trackWear * profile.wearMult * wearRate;
  const life = tyreLife(profile, compound) / wearRate;
  let pen = degPerLap * age;
  if (age > life) pen += Math.min(4, 0.12 * Math.pow(age - life, 1.4)); // the cliff, capped
  if (age < 1) pen += 0.6 * (1 - age); // cold tyres on the out-lap
  return pen;
}

/** Compound pace offset for the conditions. */
export function compoundOffset(profile, compound) {
  const c = COMPOUNDS[compound] || COMPOUNDS.Medium;
  if (profile.isWet) return c.wetOffset;
  return c.offset;
}

/** Wear percentage (0–100) for UI; 100 means at the cliff. */
export function tyreWearPct(profile, compound, age, wearRate = 1) {
  return clamp((age * wearRate / tyreLife(profile, compound)) * 100, 0, 100);
}

// ─── Lap time ────────────────────────────────────────────────────────────────

/**
 * Deterministic lap time for the given state (no random noise, no traffic).
 * @param profile  from buildPaceProfile
 * @param s.compound, s.tyreAge, s.lap, s.totalLaps, s.fuelFrac (1 → full), s.modeDelta
 */
export function expectedLapTime(profile, { compound = "Medium", tyreAge = 5, lap = 1, totalLaps = 57, fuelFrac = null, modeDelta = 0, wearRate = 1 } = {}) {
  const lapFrac = clamp(lap / Math.max(1, totalLaps), 0, 1);
  const fuel = fuelFrac == null ? 1 - lapFrac : clamp(fuelFrac, 0, 1);
  const wetBase = profile.isWet ? profile.baseTime * 0.08 : 0;
  return (
    profile.baseTime +
    wetBase +
    profile.staticDelta +
    compoundOffset(profile, compound) +
    tyreDegPenalty(profile, compound, tyreAge, wearRate) +
    fuel * FUEL_EFFECT_FULL_TANK -
    lapFrac * TRACK_EVOLUTION +
    modeDelta
  );
}

/**
 * Sum of expected lap times for `laps` laps starting at tyre age `startAge`.
 * Used by the engineer and AI to compare strategies.
 */
export function stintTime(profile, compound, startAge, laps, { startLap = 1, totalLaps = 57, wearRate = 1 } = {}) {
  let t = 0;
  for (let i = 0; i < laps; i++) {
    t += expectedLapTime(profile, { compound, tyreAge: startAge + i, lap: startLap + i, totalLaps, wearRate });
  }
  return t;
}

/**
 * Pick the compound for the next stint: the fastest one that can make it to
 * the flag (with a 10% margin), respecting the two-dry-compound rule.
 */
export function chooseNextCompound(profile, lapsRemaining, usedCompounds = [], { lap = 1, totalLaps = 57 } = {}) {
  if (profile.isWet) return "Intermediate";
  const usedDry = new Set(usedCompounds.filter((c) => DRY_COMPOUNDS.includes(c)));
  const mustBeNew = usedDry.size === 1;
  let best = null;
  DRY_COMPOUNDS.forEach((c) => {
    if (mustBeNew && usedDry.has(c)) return;
    const life = tyreLife(profile, c) * 1.05;
    // Stops still needed if we keep using this compound to the flag
    const stopsNeeded = Math.max(0, Math.ceil(lapsRemaining / life) - 1);
    const stintLaps = Math.max(1, Math.round(lapsRemaining / (stopsNeeded + 1)));
    const perLap = stintTime(profile, c, 0, stintLaps, { startLap: lap, totalLaps }) / stintLaps;
    const t = perLap * lapsRemaining + stopsNeeded * PIT_LOSS_BASE;
    if (!best || t < best.t) best = { c, t };
  });
  return best ? best.c : "Medium";
}

/**
 * Probability that an attacking car completes a pass this lap.
 * @param paceAdvantage seconds per lap the attacker is quicker (this lap)
 */
export function overtakeChance({ paceAdvantage, attackerRacecraft = 85, defenderRacecraft = 85, difficulty = 0.5, drs = false, tyreAgeDelta = 0 }) {
  const threshold = 0.3 + difficulty * 1.0; // pace needed for a 50/50 move
  let p = 0.5 + (paceAdvantage - threshold) * 0.8;
  p += (attackerRacecraft - defenderRacecraft) * 0.012;
  p += clamp(tyreAgeDelta, -20, 20) * 0.006; // fresher tyres help
  if (drs) p += 0.15 * (1 - difficulty * 0.5);
  return clamp(p, 0.02, 0.92);
}

/** Time lost following another car closely (dirty air). */
export function dirtyAirPenalty(gapSeconds, difficulty = 0.5) {
  if (gapSeconds >= 1.5 || gapSeconds < 0) return 0;
  return (1.5 - gapSeconds) / 1.5 * (0.15 + difficulty * 0.25);
}
