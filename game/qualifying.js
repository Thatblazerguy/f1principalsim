import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";
import {
  DRIVER_QUALI_COEFF,
  QUALI_NOISE_BASE,
  QUALI_NOISE_RANGE,
  QUALI_PERF_BONUS_COEFF,
  WET_SPECIALIST_BONUS,
  WET_SPECIALIST_PENALTY,
  getTrackWetProbability,
} from "../utils/raceBalance.js";

function getQualifyingBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.qualifyingBoost || 0) + (effects.qualiBoost || 0);
}

/**
 * Per-driver qualifying noise.
 * Wider spread than before — grid can shuffle by 2-4 places for midfield.
 * Low consistency drivers: up to ±0.45s noise; top drivers: ±0.15s.
 * This is symmetric so it can both hurt AND help any driver.
 */
function qualiNoise(driver) {
  const c = driver.consistency ?? 80;
  const spread = QUALI_NOISE_BASE + ((100 - c) / 100) * QUALI_NOISE_RANGE;
  // Gaussian-ish approximation via summing two uniforms
  const u1 = Math.random() - 0.5;
  const u2 = Math.random() - 0.5;
  return (u1 + u2) * spread; // range ≈ ±spread
}



/**
 * simulateQualifying
 *
 * v2 changes:
 *  - Wider symmetrical noise (QUALI_NOISE_BASE + range) allows real grid shuffles
 *  - Driver form (last 5 races) influences qualifier performance
 *  - Weather (isWet) inverts the order partially — wet specialists move forward
 *  - Weekend confidence factor adds session-specific unpredictability
 *  - Qualifying boost from engine profiles preserved
 *
 * @param {Array}  teams        All teams with their drivers
 * @param {object} track        Calendar track entry
 * @param {object} weekendContext Pre-calculated performance context
 * @returns {{ grid: Array, isWet: boolean }}
 */
export function simulateQualifying(teams, track, weekendContext) {
  // Determine conditions
  const wetChance = getTrackWetProbability(track.name || track.circuit || "");
  const isWet = Math.random() < wetChance;

  const grid = teams
    .flatMap((t) =>
      t.drivers.map((d) => {
        // Base lap from driver quali skill + team performance
        const baseLap =
          track.baseTime -
          (d.quali + getQualifyingBoost(t)) * DRIVER_QUALI_COEFF -
          getTeamLapCredit(t, "quali") -
          getTeamPerformanceBonus(t) * QUALI_PERF_BONUS_COEFF;

        // Form modifier from weekend context
        const finalModifier = weekendContext?.drivers?.[d.name]?.finalModifier ?? 1.0;

        // Random lap noise (reduced in v3)
        const noise = qualiNoise(d);

        // Weather effects
        let weatherDelta = 0;
        if (isWet) {
          const wetAbove85 = Math.max(0, d.wet - 85);
          const wetBelow85 = Math.max(0, 85 - d.wet);
          // Specialists gain lap time (negative = faster)
          weatherDelta = -wetAbove85 * WET_SPECIALIST_BONUS
                        + wetBelow85 * WET_SPECIALIST_PENALTY;
        }

        // Effective lap time
        const lap = baseLap * finalModifier + noise + weatherDelta;

        return { driver: d, team: t, lap, isWet };
      })
    )
    .sort((a, b) => a.lap - b.lap);

  return { grid, isWet };
}
