import {
  RACE_OVR_COEFF,
  QUALI_OVR_COEFF,
  RACE_AERO_COEFF,
  RACE_CHASSIS_COEFF,
  RACE_REL_COEFF,
  QUALI_AERO_COEFF,
  QUALI_CHASSIS_COEFF,
} from "./raceBalance.js";

const SPEC_BASE = 85;

function defaultSpecs(team) {
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
    ovr: ovr, // Use the real carPerformance which tracks manual upgrades accurately
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
export function getTeamLapCredit(team, session) {
  const s = defaultSpecs(team);
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

  // Non-linear top-end bonus: top teams (ovr > 92) get a small extra edge
  // that represents development maturity, not just raw spec numbers.
  // This keeps top teams fast without making the gap enormous.
  if (ovr > 92) {
    const topEndBonus = (ovr - 92) * 0.004; // max +0.028s for a 99-ovr car
    credit += topEndBonus;
  }

  return credit;
}
