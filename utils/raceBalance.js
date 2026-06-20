/**
 * raceBalance.js
 * ──────────────
 * Central registry for all simulation balance constants and derived helpers.
 * Tune values here to adjust championship competitiveness without touching
 * the simulation logic in raceSimulator.js or qualifying.js.
 *
 * Key design goals:
 *  - Top teams are consistently stronger but NOT unbeatable
 *  - Midfield teams score points regularly (~P6–P10 territory)
 *  - DNF rates: top teams ~4%, backmarkers ~11%
 *  - Weather and form create genuine upset potential
 */

// ─── Performance Spread Constants ─────────────────────────────────────────────

/** How much each ovr point is worth as a lap-time credit in race sessions */
export const RACE_OVR_COEFF = 0.035;       // was 0.018
export const QUALI_OVR_COEFF = 0.040;      // was 0.022

/** Spec delta multipliers (applied on top of ovr deviation from SPEC_BASE) */
export const RACE_AERO_COEFF    = 0.006;   // was 0.010
export const RACE_CHASSIS_COEFF = 0.008;   // was 0.015
export const RACE_REL_COEFF     = 0.005;   // was 0.007
export const QUALI_AERO_COEFF   = 0.014;   // was 0.024
export const QUALI_CHASSIS_COEFF = 0.007;  // was 0.011

/** Driver attribute multipliers in race laps */
export const DRIVER_PACE_COEFF      = 0.035; // was 0.018
export const DRIVER_RACECRAFT_COEFF = 0.015; // was 0.010
export const DRIVER_QUALI_COEFF     = 0.038; // was 0.045 — qualifying

/** Engine/performance bonus dampening */
export const RACE_PERF_BONUS_COEFF  = 0.015; // was 0.025
export const QUALI_PERF_BONUS_COEFF = 0.016; // was 0.022
export const RACE_ENGINE_BOOST_COEFF = 0.45; // was 0.5 (inside getRaceBoost)

// ─── Qualifying Noise ──────────────────────────────────────────────────────────

/** 
 * Quali lap noise: symmetrical ±spread around driver's true pace.
 * Higher spread = more grid randomness.
 * Base spread ensures even perfect drivers can vary ±0.15s.
 * Consistency reduces this noise.
 */
export const QUALI_NOISE_BASE  = 0.05; // was 0.15
export const QUALI_NOISE_RANGE = 0.15; // was 0.30

// ─── Lap Variance Constants ────────────────────────────────────────────────────

export const LAP_VARIANCE_BASE        = 0.08;  // was 0.15 — base random noise per lap
export const LAP_CONSISTENCY_NOISE    = 0.002; // was 0.004 — per consistency-point below 100
export const SAFETY_CAR_COMPRESSION   = 4.5;   // seconds bunched under SC

// ─── Weather System ────────────────────────────────────────────────────────────

/** Probability of a wet race per round (global default — can be per-track) */
export const WET_RACE_PROBABILITY = 0.18;

/** Wet weather specialist bonus: per point of `wet` attribute above 85 */
export const WET_SPECIALIST_BONUS  = 0.006; // Alonso wet=97 → +0.072s/lap FASTER
/** Wet weather non-specialist penalty: per point of `wet` below 85 */
export const WET_SPECIALIST_PENALTY = 0.007; // Low wet driver → slower

// ─── Reliability / DNF System ─────────────────────────────────────────────────

/**
 * Per-lap DNF probability.
 * Base: 0.0005/lap for any car (baseline mechanical chance).
 * Reliability modifier: each point below 99 adds this amount per lap.
 * 
 * Example results over 58 laps:
 *   Reliability 94 (Mercedes): base + (99-94)*0.000040 = 0.000700/lap → ~3.9% DNF/race
 *   Reliability 91 (Ferrari):  base + (99-91)*0.000040 = 0.000820/lap → ~4.6% DNF/race
 *   Reliability 65 (Aston):    base + (99-65)*0.000040 = 0.001860/lap → ~10.1% DNF/race
 */
export const DNF_BASE_PER_LAP         = 0.0005;
export const DNF_RELIABILITY_PER_POINT = 0.000040;

/** Extra DNF probability per lap when using a high-risk strategy */
export const DNF_RISK_STRATEGY_BONUS  = 0.000150;

/** Engine modifier from engineProfile (unchanged) */
export const DNF_ENGINE_MODIFIER_PASS = 1.0; // passed through directly

// ─── Form / Confidence System ─────────────────────────────────────────────────

/**
 * Driver weekend form multiplier range: 0.92 – 1.08
 * Applied to effective lap time (lower = faster, so good form = lower multiplier).
 */
export const FORM_MULTIPLIER_MIN  = 0.92;
export const FORM_MULTIPLIER_MAX  = 1.08;
export const FORM_NEUTRAL         = 1.00;

/** How many past races are used to compute current form */
export const FORM_LOOKBACK_RACES  = 5;



// ─── Grid Start System ─────────────────────────────────────────────────────────

/** Time penalty added per grid position behind P1 */
export const START_POSITION_PENALTY = 0.08; // was 0.12 — slightly less deterministic

/** Probability of a first-lap incident per race (affects 1–3 drivers) */
export const START_INCIDENT_PROB    = 0.42; // ~42% of races have a start incident
export const START_INCIDENT_MIN     = 1.5;  // seconds lost in incident
export const START_INCIDENT_MAX     = 8.0;  // worst first-lap incident

// ─── Strategy Archetype System ────────────────────────────────────────────────

/**
 * Returns the strategy archetype for an AI team based on ovr rating.
 * Archetypes control which strategy rank the team is most likely to choose.
 *
 * "elite"       — Top teams, often pick rank1 but occasionally go bold
 * "calculated"  — Strong teams, reliable optimal choices
 * "opportunistic" — Midfield, mix of rank1/2 with occasional gambles
 * "aggressive"  — Backmarkers, throw caution to wind for upset potential
 */
export function getTeamArchetype(team) {
  const ovr = team.specs?.ovr ?? team.carPerformance ?? 85;
  if (ovr >= 92) return "elite";
  if (ovr >= 87) return "calculated";
  if (ovr >= 83) return "opportunistic";
  return "aggressive";
}

/**
 * Given an archetype, returns the probability table for strategy rank selection.
 * Returns [rank1Weight, rank2Weight, rank3Weight, rank4Weight]
 */
export function getArchetypeWeights(archetype) {
  switch (archetype) {
    case "elite":         return [0.68, 0.22, 0.08, 0.02];
    case "calculated":    return [0.55, 0.30, 0.10, 0.05];
    case "opportunistic": return [0.38, 0.32, 0.20, 0.10];
    case "aggressive":    return [0.25, 0.28, 0.27, 0.20];
    default:              return [0.55, 0.30, 0.10, 0.05];
  }
}

// ─── Reliability Helper ───────────────────────────────────────────────────────

/**
 * Calculate per-lap DNF probability for a driver + team combo.
 * @param {object} team
 * @param {object} driver
 * @param {boolean} isHighRiskStrategy
 * @returns {number} probability of retiring on any given lap
 */
export function getDNFPerLap(team, driver, isHighRiskStrategy = false) {
  const engineModifier = team.engineProfile?.effects?.retirementModifier || 0;
  const reliabilityScore = team.specs?.reliability ?? 82;

  const base = DNF_BASE_PER_LAP
    + (99 - reliabilityScore) * DNF_RELIABILITY_PER_POINT
    + engineModifier
    + (isHighRiskStrategy ? DNF_RISK_STRATEGY_BONUS : 0);

  return Math.max(DNF_BASE_PER_LAP * 0.5, base);
}

// ─── Form Helper ─────────────────────────────────────────────────────────────

/**
 * Compute a form multiplier (0.92–1.08) for a driver based on recent race history.
 * Lower value = performing better than average (good form).
 * 1.00 = neutral form.
 *
 * @param {string} driverName
 * @param {Array}  raceHistory - state.raceHistory
 * @returns {number} multiplier to apply to effectiveLap
 */
export function getDriverFormMultiplier(driverName, raceHistory) {
  if (!raceHistory?.length) return FORM_NEUTRAL;

  const recent = raceHistory
    .slice(-FORM_LOOKBACK_RACES)
    .map(race => race.driverResults?.find(d => d.name === driverName))
    .filter(Boolean);

  if (!recent.length) return FORM_NEUTRAL;

  // Score: DNF=-8, P1=+8, P2=+6, P3=+4, top10=+2, else=0
  // Weight newer results more heavily
  let weightedScore = 0;
  let totalWeight = 0;

  recent.forEach((r, i) => {
    const weight = (i + 1) / recent.length; // newer = higher weight
    let score;
    if (r.retired) {
      score = -8;
    } else if (r.finishPos === 1) {
      score = 8;
    } else if (r.finishPos <= 3) {
      score = 5;
    } else if (r.finishPos <= 6) {
      score = 2;
    } else if (r.finishPos <= 10) {
      score = 1;
    } else {
      score = -1;
    }
    weightedScore += score * weight;
    totalWeight += weight;
  });

  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Map score range (-8 to +8) to multiplier (1.08 to 0.92)
  // Good form (positive score) → lower multiplier (faster)
  const rawMultiplier = FORM_NEUTRAL - (normalizedScore / 8) * 0.08;
  return Math.min(FORM_MULTIPLIER_MAX, Math.max(FORM_MULTIPLIER_MIN, rawMultiplier));
}

// ─── Track Weather Probability ────────────────────────────────────────────────

/**
 * Some tracks are historically wetter than others.
 * Returns per-race wet probability for a given track name.
 */
export function getTrackWetProbability(trackName = "") {
  const t = trackName.toLowerCase();
  if (t.includes("spa") || t.includes("belgian"))    return 0.40;
  if (t.includes("brazil") || t.includes("paulo"))   return 0.35;
  if (t.includes("britain") || t.includes("silver"))  return 0.30;
  if (t.includes("japan") || t.includes("suzuka"))    return 0.25;
  if (t.includes("china") || t.includes("shanghai"))  return 0.22;
  if (t.includes("singapore") || t.includes("marina")) return 0.20;
  if (t.includes("canada") || t.includes("gilles"))   return 0.20;
  if (t.includes("monaco"))                           return 0.18;
  if (t.includes("baku") || t.includes("azerbaijan")) return 0.10;
  if (t.includes("bahrain") || t.includes("saudi") || t.includes("abu dhabi")) return 0.03;
  return WET_RACE_PROBABILITY;
}

// ─── Development Diminishing Returns ─────────────────────────────────────────

/**
 * Returns a development budget multiplier based on current ovr.
 * High-ovr teams develop more slowly (diminishing returns at the top).
 * Low-ovr teams develop slightly faster (field convergence).
 */
export function getDevelopmentConvergenceMult(ovrRating) {
  if (ovrRating >= 94) return 0.40;
  if (ovrRating >= 91) return 0.60;
  if (ovrRating >= 88) return 0.80;
  if (ovrRating >= 85) return 1.00;
  if (ovrRating >= 82) return 1.20;
  return 1.35; // backmarkers catch up fastest
}
