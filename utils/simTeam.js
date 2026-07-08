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

const SPEC_BASE = 85;

function getCarSpecs(team) {
  // Check if this is the player team and we have engineering.carSpecs
  if (team.isPlayerTeam && state.engineering?.carSpecs) {
    const cs = state.engineering.carSpecs;
    // Derive aero, chassis, reliability from carSpecs
    const aero = (cs.cornering + cs.downforce) / 2;
    const chassis = (cs.mechanicalGrip + cs.balance + cs.tyreWear) / 3;
    const reliability = cs.reliability;
    const topSpeed = cs.topSpeed;
    const acceleration = cs.acceleration;
    const fuelEfficiency = cs.fuelEfficiency;
    // Calculate overall performance based on carSpecs
    const ovr = Math.round(
      (aero + chassis + reliability + topSpeed + acceleration + fuelEfficiency) / 6
    );
    return {
      aero,
      chassis,
      reliability,
      ovr,
      topSpeed,
      acceleration,
      fuelEfficiency,
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
export function getTeamLapCredit(team, session) {
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

  // Non-linear top-end bonus: top teams (ovr > 92) get a small extra edge
  // that represents development maturity, not just raw spec numbers.
  // This keeps top teams fast without making the gap enormous.
  if (ovr > 92) {
    const topEndBonus = (ovr - 92) * 0.004; // max +0.028s for a 99-ovr car
    credit += topEndBonus;
  }

  return credit;
}
