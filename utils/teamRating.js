/**
 * teamRating.js
 * ─────────────
 * Weighted engineering model for Team Overall Rating (OVR).
 *
 * DISPLAY LAYER ONLY — race simulation continues to use team.carPerformance
 * unchanged. This module is the analytics / UI source of truth for constructor
 * competitiveness and is architecturally aligned with the same underlying
 * engineering attributes so a future sim migration is straightforward.
 *
 * Formula (car-first, driver-secondary):
 *
 *   OVR = carPerformance  × 0.45   ← dominant factor
 *       + aero            × 0.10
 *       + mechanicalGrip  × 0.10
 *       + reliability     × 0.08
 *       + driverPair      × 0.15   ← scaled to 55-99 range
 *       + devRate         × 0.07
 *       + teamOps         × 0.05
 *
 * Result naturally spans 80–97 across a realistic 2026 grid.
 *
 * LONG-TERM NOTE: once the simulation rebalance is complete, simTeam.js
 * can call computeTeamOVR() instead of raw carPerformance. The data sources
 * are already shared (team.carPerformance, team.specs.*, team.drivers).
 */

const STAT_FLOOR = 55;
const STAT_CAP   = 99;

function clamp(v) {
  return Math.max(STAT_FLOOR, Math.min(STAT_CAP, v || STAT_FLOOR));
}

/**
 * Driver-pair strength (55-99 scale, compressed).
 * Elite pair adds ~2-3 OVR pts max; rookies subtract ~2-3.
 */
function driverPairStrength(team) {
  const racers = Array.isArray(team.drivers) ? team.drivers : [];
  if (racers.length === 0) return 80;

  const ratings = racers.map(d => {
    if (typeof d.overallRating === 'function') return d.overallRating();
    return Math.round(((d.pace || 80) + (d.quali || 80) + (d.racecraft || 80) + (d.consistency || 80)) / 4);
  });

  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  // Compress: maps avg=98→87, avg=85→78, avg=73→69
  return clamp(55 + (avg - 55) * 0.75);
}

/**
 * Development rate proxy (55-99).
 * Grows with car level (R&D progress) and budget.
 */
function devRate(team) {
  const level = team.carLevel || 1;
  const base = 68 + Math.min(level * 2, 18); // level 1→70, level 10→88
  const budgetBonus = Math.min((team.budget || 0) / 200, 6);
  return clamp(base + budgetBonus);
}

/**
 * Team Operations score (55-99).
 * A well-balanced spec sheet scores higher than an uneven one.
 */
function teamOps(aero, chassis, rel) {
  const avg = (aero + chassis + rel) / 3;
  const spread = Math.abs(aero - chassis) + Math.abs(chassis - rel) + Math.abs(aero - rel);
  return clamp(avg - spread * 0.33);
}

/**
 * Compute full attribute breakdown for a team.
 *
 * @param {object} team
 * @returns {{
 *   carPerf: number,
 *   aero: number,
 *   mechanicalGrip: number,
 *   reliability: number,
 *   driverPair: number,
 *   devRate: number,
 *   teamOps: number,
 *   overall: number
 * }}
 */
export function computeTeamBreakdown(team) {
  const specs = team.specs || {};
  const carPerf        = clamp(team.carPerformance || 80);
  const aero           = clamp(specs.aero || carPerf);
  const mechanicalGrip = clamp(specs.chassis || carPerf);
  const reliability    = clamp(specs.reliability || carPerf);
  const pair           = driverPairStrength(team);
  const dev            = devRate(team);
  const ops            = teamOps(aero, mechanicalGrip, reliability);

  // Calibration: teams start at carLevel=1 / budget=0 which suppresses devRate.
  // A +5 constant lifts the season-1 grid into the realistic 83-96 range while
  // preserving all relative separations. As devRate grows with carLevel over a
  // season, this constant will become less dominant (by design).
  const RAW_BASE = 5;

  const overall = Math.round(
    carPerf        * 0.45 +
    aero           * 0.10 +
    mechanicalGrip * 0.10 +
    reliability    * 0.08 +
    pair           * 0.15 +
    dev            * 0.07 +
    ops            * 0.05 +
    RAW_BASE
  );

  return {
    carPerf,
    aero,
    mechanicalGrip,
    reliability,
    driverPair: Math.round(pair),
    devRate:    Math.round(dev),
    teamOps:    Math.round(ops),
    overall:    clamp(overall),
  };
}

/**
 * Convenience shorthand — just the overall number (80-97 range).
 * @param {object} team
 * @returns {number}
 */
export function computeTeamOVR(team) {
  return computeTeamBreakdown(team).overall;
}
