const STAT_CAP = 99;
const STAT_FLOOR = 55;

function clampStat(value) {
  return Math.round(Math.min(STAT_CAP, Math.max(STAT_FLOOR, value)) * 10) / 10;
}

/** Ensure team has specs object so development always has something to mutate. */
export function normalizeTeamSpecs(team) {
  const base = Number(team.carPerformance) || 85;
  if (!team.specs || typeof team.specs !== "object") {
    team.specs = {
      aero: base,
      chassis: base,
      reliability: base,
      ovr: base,
    };
    return;
  }
  team.specs.aero = team.specs.aero ?? base;
  team.specs.chassis = team.specs.chassis ?? base;
  team.specs.reliability = team.specs.reliability ?? base;
  team.specs.ovr = team.specs.ovr ?? base;
}

/**
 * Subtle R&D step after each race weekend for one team.
 * Uses a small random "budget" split across aero / chassis / reliability / overall pace
 * so the field creeps forward without big jumps.
 */
export function applyRoundCarDevelopment(team) {
  normalizeTeamSpecs(team);

  const budget = 0.18 + Math.random() * 0.22;
  const wA = Math.random();
  const wC = Math.random();
  const wR = Math.random();
  const wO = Math.random();
  const sum = wA + wC + wR + wO;

  team.specs.aero = clampStat(team.specs.aero + (budget * wA) / sum);
  team.specs.chassis = clampStat(team.specs.chassis + (budget * wC) / sum);
  team.specs.reliability = clampStat(team.specs.reliability + (budget * wR * 0.92) / sum);
  team.specs.ovr = clampStat(team.specs.ovr + (budget * wO * 0.85) / sum);

  const perfBump =
    (budget * 0.32) / sum + (Math.random() - 0.5) * 0.05;
  team.carPerformance = clampStat(team.carPerformance + perfBump);
}

export function applyRoundCarDevelopmentAll(state) {
  if (!state?.team) return;
  applyRoundCarDevelopment(state.team);
  (state.aiTeams || []).forEach(applyRoundCarDevelopment);
}
