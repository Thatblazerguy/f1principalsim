/**
 * qualifying.js
 * ─────────────
 * Qualifying on the shared pace model (game/paceModel.js), the same one both
 * race engines use, so the car is counted once and a grid lines up with race
 * pace. Before, qualifying multiplied the whole lap by a weekend modifier that
 * already contained the car rating, so the car counted twice and the fastest
 * team took almost every pole.
 *
 * A qualifying lap = the car's race-pace profile (car, driver, circuit fit,
 * setup quality, form, PU health, wet skill) on low fuel and fresh softs (or
 * intermediates in the wet) + the driver's one-lap skill relative to race
 * pace + any engine qualifying boost + lap-to-lap noise from consistency.
 */

import { state } from "../state.js";
import { buildPaceProfile, expectedLapTime, gaussian, clamp, DRIVER_SECONDS_PER_POINT } from "./paceModel.js";
import { makeRng, newRaceSeed, getRaceRules, decideRaceWeather } from "./raceEvents.js";
import { DRIVER_QUALI_COEFF } from "../utils/raceBalance.js";

/** One-lap noise (s): consistent drivers repeat their laps more closely. */
const QUALI_SIGMA_BASE = 0.12;
const QUALI_SIGMA_PER_POINT = 0.006; // per point of consistency below 100

function getQualifyingBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.qualifyingBoost || 0) + (effects.qualiBoost || 0);
}

/**
 * @param {Array}  teams          all teams with their drivers
 * @param {object} track          calendar round
 * @param {object} weekendContext per-driver setup/form for the weekend
 * @param {object} [options]      { seed, isWet }
 * @returns {{ grid: Array, isWet: boolean, seed: number }}
 */
export function simulateQualifying(teams, track, weekendContext, options = {}) {
  const seed = options.seed ?? newRaceSeed();
  const rng = makeRng(seed);
  const rules = getRaceRules(state);
  const isWet = typeof options.isWet === "boolean"
    ? options.isWet
    : decideRaceWeather(track, null, rules, rng);
  const totalLaps = track.laps || 57;

  const grid = teams
    .flatMap((t) =>
      t.drivers.map((d) => {
        const profile = buildPaceProfile({ team: t, driver: d, track, isWet, weekendContext, appState: state });
        // Low fuel, fully rubbered-in track, a fresh set of the fastest tyre
        const base = expectedLapTime(profile, {
          compound: isWet ? "Intermediate" : "Soft",
          tyreAge: 1,
          lap: totalLaps,
          totalLaps,
          fuelFrac: 0.05,
        });
        // One-lap specialists vs race-pace drivers
        const qualiSkillDelta = -((d.quali ?? d.pace ?? 85) - profile.raceSkill) * DRIVER_SECONDS_PER_POINT;
        const boost = -getQualifyingBoost(t) * DRIVER_QUALI_COEFF;
        const sigma = (QUALI_SIGMA_BASE + (100 - (d.consistency ?? 85)) * QUALI_SIGMA_PER_POINT) * (isWet ? 1.8 : 1);
        const noise = clamp(gaussian(rng) * sigma, -2.5 * sigma, 2.5 * sigma);
        const lap = base + qualiSkillDelta + boost + noise;
        return { driver: d, team: t, lap, isWet };
      })
    )
    .sort((a, b) => a.lap - b.lap);

  return { grid, isWet, seed };
}
