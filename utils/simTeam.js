import { state } from "../state.js";
import {
  RACE_OVR_COEFF,
  QUALI_OVR_COEFF,
  RACE_AERO_COEFF,
  RACE_CHASSIS_COEFF,
  RACE_REL_COEFF,
  QUALI_AERO_COEFF,
  QUALI_CHASSIS_COEFF,
} from "./raceBalance.js";
import { getDriverPuPerformance } from "./engineeringSystem.js";
import { ensureFinanceState } from "./financeSystem.js";

const SPEC_BASE = 85;

// Get bonuses from facilities and staff
function getTeamBonusFactors(appState) {
  const finance = ensureFinanceState(appState);
  const facilities = finance.facilities || {};
  const staff = finance.staff || [];

  // Facility bonuses (each level 1-5 gives 0.5 bonus, max 2.5 each)
  const windTunnelBonus = (facilities.windTunnel?.level || 1) * 0.5;
  const cfdBonus = (facilities.cfdDepartment?.level || 1) * 0.5;
  const simulatorBonus = (facilities.simulator?.level || 1) * 0.3;
  const puLabBonus = (facilities.powerUnitLab?.level || 1) * 0.4;
  const relCentreBonus = (facilities.reliabilityCentre?.level || 1) * 0.3;

  // Staff bonuses (each rating 60-99 gives up to 2.0 bonus)
  const techDir = staff.find(s => s.id === "technicalDirector")?.rating || 70;
  const chiefDes = staff.find(s => s.id === "chiefDesigner")?.rating || 70;
  const headAero = staff.find(s => s.id === "headAero")?.rating || 70;
  const perfEng = staff.find(s => s.id === "performanceEngineer")?.rating || 70;

  const staffBonus = ((techDir + chiefDes + headAero + perfEng) / 4 - 60) * (2.0 / 39); // ~0 to 2.0

  return {
    aero: windTunnelBonus + cfdBonus + staffBonus * 0.7,
    chassis: simulatorBonus + staffBonus * 0.5,
    reliability: relCentreBonus + puLabBonus * 0.3 + staffBonus * 0.3,
    powerUnit: puLabBonus + staffBonus * 0.4,
  };
}

/** Seeding multipliers used by ensureDevProjectsState, plus the mean of its 0–5 random term. */
const SEED_MULTIPLIERS = {
  cornering: 0.95, downforce: 0.93, mechanicalGrip: 0.90, tyreWear: 0.92, balance: 0.94,
  topSpeed: 0.96, acceleration: 0.91, fuelEfficiency: 0.89, reliability: 0.93,
};
const SEED_RANDOM_MEAN = 2.5;

/** Expected starting carSpecs for a car of rating `cp` (for saves made before baselines were stored). */
function estimateSeedSpecs(cp) {
  return Object.fromEntries(Object.entries(SEED_MULTIPLIERS).map(([k, m]) => [k, cp * m + SEED_RANDOM_MEAN]));
}

/** Engineering ratings derived from carSpecs plus facility/staff bonuses. Unrounded. */
function deriveEngineeringRatings(cs, bonuses) {
  const aero = ((cs.cornering + cs.downforce) / 2) + bonuses.aero;
  const chassis = ((cs.mechanicalGrip + cs.balance + cs.tyreWear) / 3) + bonuses.chassis;
  const reliability = cs.reliability + bonuses.reliability;
  const topSpeed = cs.topSpeed + bonuses.powerUnit;
  const acceleration = cs.acceleration + bonuses.powerUnit;
  const fuelEfficiency = cs.fuelEfficiency + bonuses.powerUnit * 0.5;
  const ovr = (aero + chassis + reliability + topSpeed + acceleration + fuelEfficiency) / 6;
  return { aero, chassis, reliability, topSpeed, acceleration, fuelEfficiency, ovr };
}

const clampSpec = (v) => Math.min(99, Math.max(40, v));

/**
 * The player's team. Nothing in the game sets an `isPlayerTeam` flag, so match
 * by identity (the race engines receive the same `state.team` object). Name
 * matching is avoided because a player can name their team after an AI team.
 */
export const isPlayerTeam = (team) => Boolean(team && (team.isPlayerTeam || (state.team && team === state.team)));

export function getCarSpecs(team) {
  // Player team: engineering work is applied as a *delta* on top of the same
  // team ratings the AI uses. Before, the player's car was rated from its raw
  // carSpecs, which are seeded ~7% below carPerformance, so taking over a team
  // made its car 3–4 OVR slower than the AI version. The OVR is also no longer
  // rounded, so small upgrades show up in lap time instead of vanishing.
  if (isPlayerTeam(team) && state.engineering?.carSpecs) {
    const eng = state.engineering;
    const cp = team.carPerformance ?? SPEC_BASE;
    const bonuses = getTeamBonusFactors(state);
    if (!eng.bonusBaseline) eng.bonusBaseline = { ...bonuses };
    const baselineSpecs = eng.carSpecsBaseline || estimateSeedSpecs(eng.baselineCarPerformance ?? cp);

    const now = deriveEngineeringRatings(eng.carSpecs, bonuses);
    const base = deriveEngineeringRatings({ ...eng.carSpecs, ...baselineSpecs }, eng.bonusBaseline);
    const delta = (key) => now[key] - base[key];

    const anchor = {
      aero: team.specs?.aero ?? cp,
      chassis: team.specs?.chassis ?? cp,
      reliability: team.specs?.reliability ?? cp,
    };
    return {
      aero: clampSpec(anchor.aero + delta("aero")),
      chassis: clampSpec(anchor.chassis + delta("chassis")),
      reliability: clampSpec(anchor.reliability + delta("reliability")),
      topSpeed: clampSpec(cp + delta("topSpeed")),
      acceleration: clampSpec(cp + delta("acceleration")),
      fuelEfficiency: clampSpec(cp + delta("fuelEfficiency")),
      ovr: clampSpec(cp + delta("ovr")),
    };
  }

  // Fallback to original system for AI teams or if no engineering.carSpecs
  const ovr = team.carPerformance ?? SPEC_BASE;
  
  let baseAero = team.specs?.aero ?? ovr;
  let baseChassis = team.specs?.chassis ?? ovr;
  let baseReliability = team.specs?.reliability ?? ovr;
  
  // Apply manual player upgrades on top of base specs
  if (team.car) {
    baseAero += (team.car.aero - 1) * 1.5;
    baseChassis += (team.car.chassis - 1) * 1.5;
    baseReliability += (team.car.reliability - 1) * 1.5;
  }
  
  return {
    aero: baseAero,
    chassis: baseChassis,
    reliability: baseReliability,
    ovr: ovr,
  };
}

export function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

/**
 * Lap-time credit (subtracted from base lap time). Higher = faster car.
 *
 * Rebalanced in v2:
 *  - Overall OVR coefficient reduced ~35% to compress the field
 *  - Spec delta multipliers halved so spec differences matter less in absolute seconds
 *  - Non-linear top-end bonus: teams above 92 ovr still pull ahead, but more gently
 *
 * Sessions weight aero / chassis / reliability differently.
 */
export function getTeamLapCredit(team, session, driverName) {
  const s = getCarSpecs(team);
  const ovr = s.ovr;

  // Base credit from overall rating (compressed coefficients)
  let credit = ovr * (session === "quali" ? QUALI_OVR_COEFF : RACE_OVR_COEFF);

  if (session === "practice") {
    credit +=
      (s.aero - SPEC_BASE)    * RACE_AERO_COEFF +
      (s.chassis - SPEC_BASE) * RACE_CHASSIS_COEFF;
  } else if (session === "quali") {
    credit +=
      (s.aero - SPEC_BASE)    * QUALI_AERO_COEFF +
      (s.chassis - SPEC_BASE) * QUALI_CHASSIS_COEFF;
  } else {
    credit +=
      (s.chassis - SPEC_BASE)     * RACE_CHASSIS_COEFF +
      (s.aero - SPEC_BASE)        * RACE_AERO_COEFF +
      (s.reliability - SPEC_BASE) * RACE_REL_COEFF;
  }

  // Apply Power Unit component performance modifier (player team only)
  if (isPlayerTeam(team) && driverName) {
    const puModifier = getDriverPuPerformance(state, driverName);
    // puModifier is 0.4-1.0, convert to a lap credit bonus/penalty
    const puBonus = (puModifier - 0.7) * 0.05; // -0.015 to +0.015 seconds
    credit += puBonus;
  }

  // Non-linear top-end bonus: top teams (ovr > 92) get a small extra edge
  // that represents development maturity, not just raw spec numbers.
  // This keeps top teams fast without making the gap enormous.
  if (ovr > 92) {
    const topEndBonus = (ovr - 92) * 0.004; // max +0.028s for a 99-ovr car
    credit += topEndBonus;
  }

  return credit;
}
