import { getDevelopmentConvergenceMult } from "./raceBalance.js";

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
  team.specs.aero      = team.specs.aero      ?? base;
  team.specs.chassis   = team.specs.chassis   ?? base;
  team.specs.reliability = team.specs.reliability ?? base;
  team.specs.ovr       = team.specs.ovr       ?? base;
}

/**
 * R&D step after each race weekend for one team.  v2 — Diminishing Returns.
 *
 * Key change: teams with a high ovr rating develop more slowly (they are
 * already near the performance ceiling), while backmarker teams develop
 * slightly faster.  This creates realistic convergence over a season —
 * the gap between P1 and P10 in the constructors' gradually narrows,
 * preventing runaway dominance.
 *
 * Budget multiplier by current ovr:
 *   ovr ≥ 94  →  0.40×  (elite teams near diminishing returns ceiling)
 *   ovr ≥ 91  →  0.60×
 *   ovr ≥ 88  →  0.80×
 *   ovr ≥ 85  →  1.00×  (baseline — field average)
 *   ovr ≥ 82  →  1.20×
 *   ovr  < 82 →  1.35×  (backmarkers catch up fastest)
 */
export function applyRoundCarDevelopment(team) {
  normalizeTeamSpecs(team);

  const currentOvr = team.specs.ovr ?? team.carPerformance ?? 85;
  const convergenceMult = getDevelopmentConvergenceMult(currentOvr);
  const atrMult = team.atrMultiplier ?? 1.0;

  // Raw R&D budget this round (slightly wider range for more variety)
  const rawBudget = 0.16 + Math.random() * 0.26;
  const budget = rawBudget * convergenceMult * atrMult;

  // Random allocation weights across the four spec areas
  const wA = Math.random();
  const wC = Math.random();
  const wR = Math.random();
  const wO = Math.random();
  const sum = wA + wC + wR + wO;

  team.specs.aero        = clampStat(team.specs.aero        + (budget * wA) / sum);
  team.specs.chassis     = clampStat(team.specs.chassis     + (budget * wC) / sum);
  // Reliability develops more slowly (harder to improve near the cap)
  team.specs.reliability = clampStat(team.specs.reliability + (budget * wR * 0.85) / sum);
  team.specs.ovr         = clampStat(team.specs.ovr         + (budget * wO * 0.80) / sum);

  // Overall car performance bump (drives lap-time calcs in simTeam.js)
  const perfBump =
    (budget * 0.30) / sum + (Math.random() - 0.5) * 0.04;
  team.carPerformance = clampStat(team.carPerformance + perfBump);
}

export function applyRoundCarDevelopmentAll(state) {
  if (!state?.team) return;
  applyRoundCarDevelopment(state.team);
  (state.aiTeams || []).forEach(applyRoundCarDevelopment);
}
