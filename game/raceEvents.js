/**
 * raceEvents.js
 * ─────────────
 * Race events and rules shared by both race engines (the quick sim in
 * raceSimulator.js and the live race in LiveRaceEngine.js), so a Grand Prix
 * plays by the same rules whichever button the player presses:
 *
 *   - season rules: weather on/off, safety-car frequency, failure rate,
 *     AI aggressiveness
 *   - safety car / VSC windows
 *   - first-lap incidents
 *   - AI strategy choice by team archetype
 *   - retirements: tracked component wear for the player's cars, the team's
 *     reliability rating (getDNFPerLap) for everyone else
 *   - the two-compound rule and the 90% classification rule
 *
 * Every random roll takes an `rng` so races can be seeded and replayed.
 */

import { mulberry32, hashString } from "./setup/carSetup.js";
import { rollForFailures } from "../utils/engineeringSystem.js";
import {
  START_INCIDENT_PROB,
  START_INCIDENT_MIN,
  START_INCIDENT_MAX,
  getTeamArchetype,
  getArchetypeWeights,
  getDNFPerLap,
  getTrackWetProbability,
} from "../utils/raceBalance.js";
import { DRY_COMPOUNDS } from "./paceModel.js";

// ─── Seeds ───────────────────────────────────────────────────────────────────

/** A fresh race seed (stored with the race so it can be replayed). */
export const newRaceSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Seeded RNG from a number or string seed. */
export function makeRng(seed) {
  return mulberry32(typeof seed === "number" ? seed >>> 0 : hashString(String(seed)));
}

// ─── Season rules ────────────────────────────────────────────────────────────

/**
 * Season rule settings (from SeasonSetup) as numbers the engines use.
 * aiAggressiveness shifts AI racecraft, mistakes and how early/late AI teams pit.
 */
export function getRaceRules(appState) {
  const r = appState?.season?.rules || {};
  const aggression = r.aiAggressiveness === "low" ? -1 : r.aiAggressiveness === "high" ? 1 : 0;
  return {
    weatherEnabled: r.weather !== false,
    scFrequency: r.scFrequency === "low" ? 0.4 : r.scFrequency === "high" ? 1.8 : 1.0,
    failureRate: r.failures === "low" ? 0.3 : r.failures === "high" ? 2.0 : 1.0,
    aiAggression: aggression,
    /** Racecraft bonus for AI drivers (overtaking and defending). */
    aiRacecraftDelta: aggression * 4,
    /** Multiplier on AI driver mistakes. */
    aiMistakeMult: 1 + aggression * 0.35,
    /** Shift to the fraction of tyre life at which AI teams pit (aggressive = earlier, fresher tyres). */
    aiPitShift: -aggression * 0.06,
    sprints: r.sprints !== false,
  };
}

/** Race weather: the weekend's (decided at qualifying) if known, else a roll. */
export function decideRaceWeather(track, weekendContext, rules, rng) {
  if (typeof weekendContext?.isWet === "boolean") return weekendContext.isWet;
  if (!rules.weatherEnabled) return false;
  return rng() < getTrackWetProbability(`${track.name || ""} ${track.circuit || ""}`);
}

// ─── Safety car / VSC ────────────────────────────────────────────────────────

/**
 * Neutralisation windows as [firstLap, lastLap] (inclusive), or null.
 * ~28% of races get a safety car and ~15% of the rest a VSC, scaled by the
 * season's safety-car setting.
 */
export function rollNeutralisations(laps, rules, rng) {
  const hasSafetyCar = rng() < 0.28 * rules.scFrequency;
  const scLap = hasSafetyCar ? Math.max(2, Math.floor(laps * (0.15 + rng() * 0.65))) : null;
  const scRange = scLap ? [scLap, Math.min(laps - 1, scLap + 3)] : null;
  const hasVSC = !hasSafetyCar && rng() < 0.15 * rules.scFrequency;
  const vscLap = hasVSC ? Math.max(2, Math.floor(laps * (0.2 + rng() * 0.6))) : null;
  const vscRange = vscLap ? [vscLap, Math.min(laps - 1, vscLap + 1)] : null;
  return { scRange, vscRange };
}

export const inRange = (range, lap) => Boolean(range && lap >= range[0] && lap <= range[1]);

// ─── Start ───────────────────────────────────────────────────────────────────

/**
 * First-lap incidents: ~42% of races, 1–3 drivers, biased to the back of the
 * grid. Returns Map(driverName -> seconds lost).
 * @param entries [{ name, gridPos }]
 */
export function rollStartIncidents(entries, rng) {
  const incidentMap = new Map();
  if (rng() >= START_INCIDENT_PROB) return incidentMap;
  const numIncidents = rng() < 0.7 ? 1 : rng() < 0.6 ? 2 : 3;
  const pool = [...entries].sort((a, b) => b.gridPos - a.gridPos); // back of grid first
  for (let i = 0; i < Math.min(numIncidents, pool.length); i++) {
    const target = pool[Math.floor(rng() * rng() * pool.length)];
    if (target && !incidentMap.has(target.name)) {
      incidentMap.set(target.name, START_INCIDENT_MIN + rng() * (START_INCIDENT_MAX - START_INCIDENT_MIN));
    }
  }
  return incidentMap;
}

// ─── AI strategy ─────────────────────────────────────────────────────────────

/**
 * AI strategy choice by team archetype: elite teams mostly take the optimal
 * plan, aggressive backmarkers gamble more. Higher AI aggressiveness shifts
 * every team toward the riskier options.
 */
export function selectAIStrategy(roundStrategies, team, rng, rules = null) {
  if (!roundStrategies?.length) return null;
  let weights = getArchetypeWeights(getTeamArchetype(team)).slice();
  if (rules?.aiAggression) {
    const shift = 0.1 * rules.aiAggression;
    weights = [Math.max(0.05, weights[0] - shift), weights[1], weights[2] + shift / 2, weights[3] + shift / 2];
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const byRank = [1, 2, 3, 4].map((r) => roundStrategies.find((s) => s.rank === r));
  let roll = rng() * total;
  for (let i = 0; i < 4; i++) {
    roll -= weights[i];
    if (roll <= 0 && byRank[i]) return byRank[i];
  }
  return byRank.find(Boolean) || roundStrategies[0];
}

// ─── Reliability ─────────────────────────────────────────────────────────────

const AI_FAILURE_TYPES = ["Engine", "Gearbox", "Hydraulics", "Brakes", "Electrical"];

/**
 * Decide whether (and when) a car retires.
 * Player cars use tracked component wear (engineering system); everyone else
 * uses their team's reliability rating. Returns null or
 * { lap, distance, type, reason }.
 */
export function rollRetirement({ team, driver, isPlayer, laps, rules, stress = 1, appState, rng, highRisk = false }) {
  const hasPool = Boolean(appState?.engineering?.driverPools?.[driver.name]);
  if (isPlayer || hasPool) {
    const failures = rollForFailures(appState, driver.name, stress * rules.failureRate, rng);
    if (failures.length > 0) {
      const lap = 1 + Math.floor(rng() * laps);
      return { lap, distance: lap - 1 + rng(), type: failures[0].type, reason: `PU failure: ${failures[0].type}` };
    }
    if (isPlayer) return null;
  }
  const perLap = getDNFPerLap(team, driver, highRisk) * rules.failureRate * stress;
  if (rng() < 1 - Math.pow(1 - perLap, laps)) {
    const lap = 1 + Math.floor(rng() * laps);
    const type = AI_FAILURE_TYPES[Math.floor(rng() * AI_FAILURE_TYPES.length)];
    return { lap, distance: lap - 1 + rng(), type, reason: `${type} failure` };
  }
  return null;
}

// ─── Sporting rules ──────────────────────────────────────────────────────────

/** Dry races must use two different dry compounds. */
export function breaksCompoundRule(usedCompounds, isWet) {
  if (isWet) return false;
  const usedWetTyres = usedCompounds.some((c) => !DRY_COMPOUNDS.includes(c));
  if (usedWetTyres) return false; // a wet-tyre stint exempts the car, as in F1
  return new Set(usedCompounds.filter((c) => DRY_COMPOUNDS.includes(c))).size < 2;
}

/** A retired car is still classified (and can score) if it completed 90% of the distance. */
export const isClassified = (lapsCompleted, totalLaps) => lapsCompleted >= Math.floor(totalLaps * 0.9);
