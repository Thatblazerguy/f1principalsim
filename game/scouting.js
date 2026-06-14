import { generateAcademyProspect, SCOUTING_TIERS, REGIONS } from "./academy.js";

/**
 * Create a new scouting assignment.
 * @param {string} regionKey — key in REGIONS
 * @param {string} tier — 'basic' | 'advanced' | 'elite'
 * @param {number} currentDay — season day when assignment starts
 * @param {number} academyLevel — team's academy level
 * @returns {{ ok: boolean, assignment?: object, reason?: string }}
 */
export function createScoutingAssignment(regionKey, tier, currentDay, academyLevel, academyBudget) {
  if (!REGIONS[regionKey]) return { ok: false, reason: "Unknown region." };
  const tierData = SCOUTING_TIERS[tier];
  if (!tierData) return { ok: false, reason: "Unknown scouting tier." };
  if (academyBudget < tierData.cost) return { ok: false, reason: "Insufficient academy budget." };

  const duration = tierData.duration - Math.floor(academyLevel * 0.5); // Higher level = faster scouting
  const completionDay = currentDay + Math.max(7, duration);

  // Pre-generate the prospect that will be "found"
  const prospect = generateAcademyProspect(regionKey, academyLevel, tier);
  prospect.scoutRevealLevel = 0;

  const assignment = {
    id: `scout-${regionKey}-${currentDay}-${Math.random().toString(36).slice(2, 6)}`,
    regionKey,
    regionLabel: REGIONS[regionKey].label,
    tier,
    tierLabel: tierData.label,
    cost: tierData.cost,
    startDay: currentDay,
    completionDay,
    totalDuration: completionDay - currentDay,
    prospect,      // The discovered prospect (revealed progressively)
    complete: false,
    signed: false,  // Whether the player signed this prospect
    dismissed: false,
  };

  return { ok: true, assignment, cost: tierData.cost };
}

/**
 * Process one sim-day for all active scouting assignments.
 * Updates reveal levels and marks completions.
 * @param {object} state — game state
 */
export function processScoutingDay(state) {
  if (!state.academy?.scouts) return;

  const currentDay = state.season.currentDay;

  for (const scout of state.academy.scouts) {
    if (scout.complete || scout.dismissed) continue;

    const elapsed = currentDay - scout.startDay;
    const totalDays = scout.totalDuration;

    // Progressive reveal: every ~20% of total time reveals a new level
    const revealThresholds = [0, 0.15, 0.30, 0.50, 0.70, 0.90];
    const progress = elapsed / totalDays;
    let newReveal = 0;
    for (let i = revealThresholds.length - 1; i >= 0; i--) {
      if (progress >= revealThresholds[i]) {
        newReveal = i;
        break;
      }
    }
    if (scout.prospect && newReveal > scout.prospect.scoutRevealLevel) {
      scout.prospect.scoutRevealLevel = newReveal;
    }

    // Completion
    if (currentDay >= scout.completionDay) {
      scout.complete = true;
      if (scout.prospect) scout.prospect.scoutRevealLevel = 5; // Full reveal
    }
  }
}

/**
 * Get active (non-dismissed, non-signed) scouting assignments.
 */
export function getActiveScouts(state) {
  if (!state.academy?.scouts) return [];
  return state.academy.scouts.filter(s => !s.dismissed && !s.signed);
}

/**
 * Get completed, unsigned scouting assignments (prospects ready to sign).
 */
export function getCompletedProspects(state) {
  if (!state.academy?.scouts) return [];
  return state.academy.scouts.filter(s => s.complete && !s.signed && !s.dismissed);
}

/**
 * Clean up old dismissed/signed scouts (keep last 10 for history).
 */
export function cleanupScouts(state) {
  if (!state.academy?.scouts) return;
  const active = state.academy.scouts.filter(s => !s.dismissed && !s.signed);
  const history = state.academy.scouts.filter(s => s.dismissed || s.signed).slice(-10);
  state.academy.scouts = [...active, ...history];
}
