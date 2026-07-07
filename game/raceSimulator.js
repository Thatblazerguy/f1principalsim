/**
 * raceSimulator.js  v2
 * ────────────────────
 * Complete rewrite for realistic F1-style championship progression.
 *
 * Key changes from v1:
 *  1. Compressed team performance spread (via simTeam.js coefficients)
 *  2. Wider lap variance — enough to create real position changes
 *  3. Driver form/confidence from recent race history (0.92–1.08×)
 *  4. Per-weekend setup quality per driver (random each race)
 *  5. Weather creates genuine wet-weather specialist advantage
 *  6. Track grip evolution builds over race distance
 *  7. Realistic DNF model — top teams ~4%, backmarkers ~11%
 *  8. First-lap start incidents (42% of races affect 1–3 drivers)
 *  9. Strategy archetype system — not all AI chooses optimal strategy
 * 10. Safety car bunching — compresses gaps and creates undercut opportunities
 * 11. Tyre degradation mid-race position swaps based on delta pace
 */

import { state } from "../state.js";
import { 
  rollForFailures, 
  applySessionWear, 
  getDriverPuPerformance 
} from "../utils/engineeringSystem.js";
import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";
import { strategies } from "../data/strategies.js";
import {
  DRIVER_PACE_COEFF,
  DRIVER_RACECRAFT_COEFF,
  RACE_ENGINE_BOOST_COEFF,
  RACE_PERF_BONUS_COEFF,
  LAP_VARIANCE_BASE,
  LAP_CONSISTENCY_NOISE,
  WET_SPECIALIST_BONUS,
  WET_SPECIALIST_PENALTY,
  START_POSITION_PENALTY,
  START_INCIDENT_PROB,
  START_INCIDENT_MIN,
  START_INCIDENT_MAX,
  SAFETY_CAR_COMPRESSION,
  getDNFPerLap,
  getTrackWetProbability,
  getTeamArchetype,
  getArchetypeWeights,
} from "../utils/raceBalance.js";

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Race Boost from Engine Profile ──────────────────────────────────────────

function getRaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.raceBoost || 0) + (effects.paceBoost || 0) * RACE_ENGINE_BOOST_COEFF;
}

// ─── Pit Stop Loss ────────────────────────────────────────────────────────────

/**
 * Simulates time lost in the pit lane.
 * Good tyre management reduces degradation and the need for early stops.
 */
function pitStopLoss(driver, lap, totalLaps) {
  // Tyre attribute reduces the wear component
  const tyreWear = clamp((lap / totalLaps) * (100 - driver.tyre), 0, 25);
  // Random element: good pit crews vs slow pit crews
  const pitCrew = 19.5 + Math.random() * 2.5;
  return pitCrew + tyreWear * 0.10 + Math.random() * 0.60;
}

// ─── Grid Position Helper ─────────────────────────────────────────────────────

function gridPosition(qualifyingGrid, driver) {
  if (!qualifyingGrid?.length) return 0;
  const idx = qualifyingGrid.findIndex((e) => e.driver.name === driver.name);
  return idx < 0 ? qualifyingGrid.length : idx;
}

// ─── Lap Variance ─────────────────────────────────────────────────────────────

/**
 * Per-lap time variance.
 *
 * Sources:
 *  - Base random noise (wider than v1)
 *  - Consistency noise (poor consistency = bigger variance)
 *  - Wet specialist advantage/penalty
 *  - Track grip evolution (track gets faster as rubber goes down)
 *  - Tyre degradation ramp (car gets slower as tyres wear)
 */
function lapVariance(driver, track, isWet, lap, totalLaps) {
  // Base noise — symmetric but wider than v1
  const consistencyNoise = (100 - driver.consistency) * LAP_CONSISTENCY_NOISE;
  const baseNoise = (Math.random() * LAP_VARIANCE_BASE) - (LAP_VARIANCE_BASE * 0.3);

  // Wet weather: specialists gain, others lose
  let weatherDelta = 0;
  if (isWet) {
    const wetAbove85 = Math.max(0, driver.wet - 85);
    const wetBelow85 = Math.max(0, 85 - driver.wet);
    weatherDelta = -wetAbove85 * WET_SPECIALIST_BONUS
                 + wetBelow85 * WET_SPECIALIST_PENALTY;
  }

  // Track grip evolution: track gets ~0.018s faster across the whole race distance
  const gripEvolution = -(lap / totalLaps) * 0.018;

  // Tyre degradation ramp: car gets slower in the last 30% of stint
  const stintFraction = lap / totalLaps;
  const tyreDeg = stintFraction > 0.70
    ? (stintFraction - 0.70) * (100 - driver.tyre) * 0.003
    : 0;

  return baseNoise + (Math.random() - 0.5) * consistencyNoise + weatherDelta + gripEvolution + tyreDeg;
}

// ─── Strategy Selection ───────────────────────────────────────────────────────

/**
 * AI strategy selection using team archetypes.
 * Different teams have different risk profiles — not everyone picks rank1.
 */
function selectAIStrategy(roundStrategies, team) {
  if (!roundStrategies.length) return null;

  const archetype = getTeamArchetype(team);
  const weights = getArchetypeWeights(archetype);

  const r1 = roundStrategies.find(s => s.rank === 1);
  const r2 = roundStrategies.find(s => s.rank === 2);
  const r3 = roundStrategies.find(s => s.rank === 3);
  const r4 = roundStrategies.find(s => s.rank === 4);

  const roll = Math.random();
  const [w1, w2, w3, w4] = weights;

  if (roll < w1 && r1) return r1;
  if (roll < w1 + w2 && r2) return r2;
  if (roll < w1 + w2 + w3 && r3) return r3;
  if (r4) return r4;
  return roundStrategies[0];
}

// ─── First-Lap Incidents ──────────────────────────────────────────────────────

/**
 * Generates a set of drivers who suffer first-lap incidents.
 * Happens in ~42% of races, affecting 1–3 drivers.
 * Lower-grid drivers are more vulnerable, but anyone can be caught.
 */
function generateStartIncidents(finishers) {
  const incidentMap = new Map();
  if (Math.random() >= START_INCIDENT_PROB) return incidentMap;

  const numIncidents = Math.random() < 0.7 ? 1 : Math.random() < 0.6 ? 2 : 3;

  // Weight toward mid/back of grid
  const pool = [...finishers]
    .filter(f => !f.retired)
    .sort((a, b) => b.gridPos - a.gridPos); // back of grid first

  const chosen = new Set();
  for (let i = 0; i < Math.min(numIncidents, pool.length); i++) {
    // More likely to pick from back half of grid
    const backBias = Math.floor(Math.random() * Math.random() * pool.length);
    const target = pool[backBias];
    if (target && !chosen.has(target.driver.name)) {
      chosen.add(target.driver.name);
      const penalty = START_INCIDENT_MIN + Math.random() * (START_INCIDENT_MAX - START_INCIDENT_MIN);
      incidentMap.set(target.driver.name, penalty);
    }
  }

  return incidentMap;
}

// ─── Main Simulation ──────────────────────────────────────────────────────────

/**
 * simulateRaceEvent  v2
 *
 * @param {Array}  teams                   All teams (player first, then AI)
 * @param {object} track                   Calendar track object
 * @param {number} laps                    Race distance in laps
 * @param {Array}  [qualifyingGrid=null]   Pre-sorted qualifying grid
 * @param {object} [playerSelectedStrategies={}]  Player driver name → strategy id
 * @param {object} [weekendContext=null]   Pre-calculated performance context
 * @returns {Array} Sorted finisher list (P1 first, DNFs last)
 */
export function simulateRaceEvent(
  teams,
  track,
  laps,
  qualifyingGrid = null,
  playerSelectedStrategies = {},
  weekendContext = null,
  selectedObjective = 'points'
) {
  const roundStrategies = track.round ? (strategies[track.round] || []) : [];

  // Race-wide conditions (determined once per race)
  const wetChance = getTrackWetProbability(track.name || track.circuit || "");
  const isWet = Math.random() < wetChance;

  // Safety car: ~28% of races
  const hasSafetyCar = Math.random() < 0.28;
  const safetyCarLap = hasSafetyCar
    ? Math.floor(laps * (0.25 + Math.random() * 0.50))
    : null;

  // Virtual safety car: separate from full SC, ~15% additional
  const hasVSC = !hasSafetyCar && Math.random() < 0.15;
  const vscLap = hasVSC
    ? Math.floor(laps * (0.30 + Math.random() * 0.40))
    : null;

  // ── Build finisher array ──────────────────────────────────────────────────

  const finishers = teams.flatMap((team) =>
    team.drivers.map((driver) => {
      // ── Strategy selection ──────────────────────────────────────────────
      let chosenStrat = null;
      if (playerSelectedStrategies[driver.name]) {
        chosenStrat = roundStrategies.find(s => s.id === playerSelectedStrategies[driver.name]);
      } else if (roundStrategies.length > 0) {
        chosenStrat = selectAIStrategy(roundStrategies, team);
      }

      const winMod  = chosenStrat ? chosenStrat.winModifier  : 0;
      const riskMod = chosenStrat ? chosenStrat.riskModifier : 0;
      const isHighRisk = riskMod >= 0.05;

      const isPlayer = playerSelectedStrategies[driver.name] !== undefined;

      // ── Objective Modifiers (Player Only) ───────────────────────────────
      let objPaceMod = 0;
      let objVarMod = 1.0;
      let objDnfMod = 1.0;

      if (isPlayer) {
        if (selectedObjective === 'win') { objPaceMod = -0.15; objVarMod = 1.6; objDnfMod = 1.3; }
        else if (selectedObjective === 'podium') { objPaceMod = -0.08; objVarMod = 1.3; objDnfMod = 1.15; }
        else if (selectedObjective === 'points') { objPaceMod = 0; objVarMod = 1.0; objDnfMod = 1.0; }
        else if (selectedObjective === 'conservative') { objPaceMod = 0.15; objVarMod = 0.5; objDnfMod = 0.5; }
        else if (selectedObjective === 'gamble') { objPaceMod = -0.05; objVarMod = 2.5; objDnfMod = 1.2; }
        // For beat rivals, we just use a balanced pace
      }

      // ── Grid position ───────────────────────────────────────────────────
      const pos = gridPosition(qualifyingGrid, driver);
      const gridPos = pos; // store for incident targeting

      // ── Base lap time ───────────────────────────────────────────────────
      const baseLap =
        track.baseTime -
        (driver.pace + getRaceBoost(team)) * DRIVER_PACE_COEFF -
        driver.racecraft * DRIVER_RACECRAFT_COEFF -
        getTeamLapCredit(team, "race") -
        getTeamPerformanceBonus(team) * RACE_PERF_BONUS_COEFF;

      // ── Strategy win modifier ───────────────────────────────────────────
      const adjustedBaseLap = baseLap * (1 - winMod * 0.035);

      // ── Effective base lap with weekend context ─────────────────────────
      // The context has form, outliers, and track suitability baked in
      const finalModifier = weekendContext?.drivers?.[driver.name]?.finalModifier ?? 1.0;
      
      // ── Power Unit Wear Penalty ─────────────────────────────────────────
      const puPerfMod = getDriverPuPerformance(state, driver.name); // 1.0 is healthy, lower is worse
      const puPenalty = (1.0 - puPerfMod) * 3.5; // Up to 3.5 seconds per lap penalty for ruined engine

      const effectiveBaseLap = adjustedBaseLap * finalModifier + objPaceMod + puPenalty;

      // ── Risk strategy: more variance and potential for incidents ─────────
      const riskVarianceMultiplier = (1 + (riskMod * 2.0)) * objVarMod;
      const riskTriggered = Math.random() < riskMod;
      const riskPenaltyApplied = riskTriggered
        ? (Math.random() < 0.30 ? "DNF" : "+35s")
        : false;

      // ── Grid start penalty ──────────────────────────────────────────────
      const startPenalty = qualifyingGrid?.length ? pos * START_POSITION_PENALTY : 0;

      // ── Pit stop strategy ───────────────────────────────────────────────
      // Two-stop strategies get a random second pit lap
      const plannedPitLap  = Math.floor(laps * (0.38 + Math.random() * 0.18));
      const hasSecondStop  = winMod > 0.08 && Math.random() < 0.30; // ~30% chance of 2-stopper for rank1
      const secondPitLap   = hasSecondStop
        ? Math.floor(laps * (0.65 + Math.random() * 0.15))
        : null;

      return {
        driver,
        team,
        gridPos,
        effectiveBaseLap,
        riskVarianceMultiplier,
        riskPenaltyApplied,
        startPenalty,
        plannedPitLap,
        secondPitLap,
        isHighRisk,
        riskMod,
        time: startPenalty,
        retired: riskPenaltyApplied === "DNF",
        isPlayer,
        objDnfMod
      };
    })
  );

  // ── Apply first-lap incidents ─────────────────────────────────────────────
  const startIncidents = generateStartIncidents(finishers);
  finishers.forEach(f => {
    const incidentPenalty = startIncidents.get(f.driver.name);
    if (incidentPenalty) {
      f.time += incidentPenalty;
    }
  });

  // ── Snapshots for Replay Data ─────────────────────────────────────────────
  const snapshots = [];

  // ── Run lap-by-lap simulation ─────────────────────────────────────────────
  finishers.forEach((f) => {
    f.lapTimes = []; // individual lap times
    f.cumulativeTimes = []; // Store cumulative time for snapshots
    if (f.retired) return;

    // DNF processing via new Engineering System
    // We roll for failures once per race based on overall stress, 
    // and assign a random failure lap if they DNF.
    const stressMod = f.isHighRisk ? 1.2 : 1.0;
    const failures = rollForFailures(state, f.driver.name, stressMod * f.objDnfMod);
    const dnfLap = failures.length > 0 ? Math.floor(Math.random() * laps) + 1 : -1;

    for (let lap = 1; lap <= laps; lap++) {
      if (f.retired) break;

      let prevTime = f.time;

      // Check Engineering DNF
      if (lap === dnfLap) {
        f.retired = true;
        f.time = 99999 - (Math.random() * 1000); // slight spread among DNFs
        f.dnfReason = `PU Failure: ${failures[0].type}`;
        break;
      }

      // Lap time with variance
      const lapVar = lapVariance(f.driver, track, isWet, lap, laps)
        * f.riskVarianceMultiplier;
      f.time += f.effectiveBaseLap + lapVar;

      // Pit stop: first stop
      if (lap === f.plannedPitLap) {
        f.time += pitStopLoss(f.driver, lap, laps);
      }

      // Pit stop: second stop (if two-stopper)
      if (f.secondPitLap && lap === f.secondPitLap) {
        f.time += pitStopLoss(f.driver, lap, laps);
      }

      // Safety car: compresses the field
      if (safetyCarLap && lap === safetyCarLap) {
        // SC compression: leaders lose more time (field bunches)
        // We approximate this by adding a fixed time to everyone
        f.time += SAFETY_CAR_COMPRESSION + Math.random() * 2.0;
      }

      // Virtual safety car: smaller compression
      if (vscLap && lap === vscLap) {
        f.time += 1.5 + Math.random() * 1.0;
      }

      let lapTime = f.time - prevTime;
      f.lapTimes.push(lapTime);
      f.cumulativeTimes.push(f.time);
    }

    // Post-race: risk strategy time penalty (collision damage, stop-go, etc.)
    if (!f.retired && f.riskPenaltyApplied === "+35s") {
      f.time += 35 + Math.random() * 10;
    }
  });

  // Generate Replay Snapshots (approximated for Quick Sim)
  // We don't have true lap-by-lap simultaneous state, so we construct a synthetic timeline
  for (let lap = 1; lap <= laps; lap++) {
    const lapSnapshot = { lap, time: lap * track.baseTime, cars: [] };
    finishers.forEach(f => {
      const isRetiredLap = f.retired && (!f.cumulativeTimes || lap > f.cumulativeTimes.length);
      const cTime = f.cumulativeTimes && f.cumulativeTimes[lap - 1] ? f.cumulativeTimes[lap - 1] : (f.cumulativeTimes && f.cumulativeTimes.length > 0 ? f.cumulativeTimes[f.cumulativeTimes.length - 1] : lap * track.baseTime);
      
      if (isRetiredLap) {
        lapSnapshot.cars.push({ id: f.driver.name, distance: f.cumulativeTimes ? f.cumulativeTimes.length : 0, cumulativeTime: cTime, retired: true });
      } else {
        lapSnapshot.cars.push({ id: f.driver.name, distance: lap, cumulativeTime: cTime, retired: false });
      }
    });
    snapshots.push(lapSnapshot);
  }

  // ── Sort: finishers first (by time), DNFs last ────────────────────────────
  const finalFinishers = finishers.sort((a, b) => {
    if (a.retired && !b.retired) return 1;
    if (!a.retired && b.retired) return -1;
    if (a.retired && b.retired) return a.time - b.time;
    return a.time - b.time;
  });

  // ── Apply Component Wear ──────────────────────────────────────────────────
  finishers.forEach(f => {
    const aggression = f.isHighRisk ? 1.2 : 0.9;
    const trackIntensity = track.speed || 1.0;
    applySessionWear(state, f.driver.name, trackIntensity, aggression, true);
  });

  return { finishers: finalFinishers, replayData: { totalLaps: laps, snapshots, events: [] } };
}
