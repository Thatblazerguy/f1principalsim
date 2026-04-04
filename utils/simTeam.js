const SPEC_BASE = 85;

function defaultSpecs(team) {
  const ovr = team.carPerformance ?? SPEC_BASE;
  if (!team.specs) {
    return { aero: ovr, chassis: ovr, reliability: ovr, ovr };
  }
  return {
    aero: team.specs.aero ?? ovr,
    chassis: team.specs.chassis ?? ovr,
    reliability: team.specs.reliability ?? ovr,
    ovr: team.specs.ovr ?? ovr,
  };
}

export function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

/**
 * Lap-time credit (subtracted from base lap time). Higher = faster car.
 * Engine supply-deal bonuses are applied separately in each session.
 * Sessions weight aero / chassis / reliability differently.
 */
export function getTeamLapCredit(team, session) {
  const s = defaultSpecs(team);
  const ovr = s.ovr;

  let credit = ovr * (session === "quali" ? 0.031 : 0.028);

  if (session === "practice") {
    credit += (s.aero - SPEC_BASE) * 0.014 + (s.chassis - SPEC_BASE) * 0.012;
  } else if (session === "quali") {
    credit += (s.aero - SPEC_BASE) * 0.024 + (s.chassis - SPEC_BASE) * 0.011;
  } else {
    credit +=
      (s.chassis - SPEC_BASE) * 0.015 +
      (s.aero - SPEC_BASE) * 0.01 +
      (s.reliability - SPEC_BASE) * 0.007;
  }

  return credit;
}
