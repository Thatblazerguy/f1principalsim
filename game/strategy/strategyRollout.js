/**
 * strategyRollout.js
 * ──────────────────
 * The "oracle" for the strategy model: a fast, lap-by-lap Monte Carlo
 * simulation of the rest of a race, built on the shared pace model
 * (game/paceModel.js) and mirroring the live race engine's rules:
 *
 *   - lap times from expectedLapTime + per-lap noise and mistakes
 *   - dirty air when following within 1.5s
 *   - passing needs an underlying pace edge and an overtakeChance roll,
 *     otherwise the car is held up behind
 *   - pit stops cost PIT_LOSS_BASE + 0–1.5s; cars on an in-lap are passed freely
 *   - rivals pit like the live engine's AI (near the end of tyre life, with the
 *     two-compound rule) and pick compounds with chooseNextCompound
 *
 * Given a race snapshot and one of our pit options, `oracleEvaluate` runs many
 * rollouts and returns the expected finishing position. That is too slow to do
 * live for every option every few seconds, so the strategy network
 * (strategyModel.js) is trained to predict it instead.
 *
 * Unlike the race engineer's planner (pure stint-time arithmetic), these
 * rollouts see track position: traffic on the rejoin, being stuck behind
 * slower cars, undercuts and overcuts against rivals who are stopping too.
 *
 * All randomness comes from a seeded RNG, so results are reproducible.
 */

import {
  expectedLapTime,
  tyreLife,
  chooseNextCompound,
  overtakeChance,
  dirtyAirPenalty,
  gaussian,
  clamp,
  DRY_COMPOUNDS,
  PIT_LOSS_BASE,
} from "../paceModel.js";
import { mulberry32 } from "../setup/carSetup.js";

/** Our pit options: stop in k laps (0 = this lap), or run to the flag without stopping. */
export const STRATEGY_ACTIONS = [
  { id: "box_0", k: 0, label: "Box this lap" },
  { id: "box_2", k: 2, label: "Box in 2 laps" },
  { id: "box_4", k: 4, label: "Box in 4 laps" },
  { id: "box_7", k: 7, label: "Box in 7 laps" },
  { id: "box_11", k: 11, label: "Box in 11 laps" },
  { id: "no_stop", k: null, label: "No stop: run to the flag" },
];

const HOLD_GAP = 0.3; // seconds behind a car you couldn't pass

export const needsCompoundRule = (car, isWet = false) =>
  !isWet && new Set(car.usedCompounds.filter((c) => DRY_COMPOUNDS.includes(c))).size < 2;

/** Which of our options make sense for this car right now. */
export function validActions(snapshot, carId) {
  const car = snapshot.cars.find((c) => c.id === carId);
  if (!car) return [];
  const lapsLeft = snapshot.totalLaps - snapshot.lap;
  return STRATEGY_ACTIONS.filter((a) => {
    if (a.k === null) return !needsCompoundRule(car, snapshot.isWet);
    return a.k <= lapsLeft - 2;
  });
}

/** Deep-enough copy for a rollout (profiles are shared and read-only). */
function cloneSnapshot(snapshot) {
  return {
    ...snapshot,
    cars: snapshot.cars.map((c) => ({ ...c, usedCompounds: c.usedCompounds.slice() })),
  };
}

/** Live-engine AI rule: pit near the end of tyre life, or late if the two-compound rule isn't met yet. */
function aiWantsToPit(car, lap, totalLaps, isWet) {
  const lapsLeft = totalLaps - lap;
  if (lapsLeft <= 2) return false;
  const life = tyreLife(car.profile, car.compound);
  const needsRule = needsCompoundRule(car, isWet);
  const canReachEnd = car.tyreAge + lapsLeft <= life * 1.1;
  const wornOut = car.tyreAge >= life * car.pitThreshold;
  const ruleDeadline = needsRule && lapsLeft < 12 && car.tyreAge > 6;
  return (wornOut && !(canReachEnd && !needsRule)) || ruleDeadline;
}

/**
 * Advance the snapshot by one lap. `decide(car, lap)` returns true if the car
 * pits this lap. Mutates `snap`.
 */
export function stepLap(snap, rng, decide) {
  const lap = snap.lap + 1; // the lap being driven
  const cars = snap.cars;   // ordered by `time` (gap to leader at the line)
  const difficulty = snap.difficulty;

  const results = cars.map((car, i) => {
    const pitting = decide(car, lap);
    const base = expectedLapTime(car.profile, { compound: car.compound, tyreAge: car.tyreAge, lap, totalLaps: snap.totalLaps });
    let t = base + clamp(gaussian(rng) * car.profile.noiseSigma, -2.5 * car.profile.noiseSigma, 2.5 * car.profile.noiseSigma);
    if (rng() < car.profile.mistakeChance) t += 1 + rng() * 2;
    const ahead = cars[i - 1];
    if (ahead) t += dirtyAirPenalty(car.time - ahead.time, difficulty);
    if (pitting) t += PIT_LOSS_BASE + rng() * 1.5;
    return { car, base, newTime: car.time + t, pitting };
  });

  // Resolve passing front to back in the old running order.
  for (let i = 1; i < results.length; i++) {
    const r = results[i];
    const a = results[i - 1];
    if (r.newTime >= a.newTime) continue;
    if (a.pitting || r.pitting) continue; // in-lap traffic doesn't fight
    const edge = a.base - r.base;
    let passed = false;
    if (edge > 0) {
      const p = overtakeChance({
        paceAdvantage: edge,
        attackerRacecraft: r.car.profile.racecraft,
        defenderRacecraft: a.car.profile.racecraft,
        difficulty,
        drs: lap > 2,
        tyreAgeDelta: a.car.tyreAge - r.car.tyreAge,
      });
      passed = rng() < p;
    }
    if (!passed) r.newTime = a.newTime + HOLD_GAP;
  }

  // Apply tyres/stops and re-order.
  for (const r of results) {
    const car = r.car;
    car.time = r.newTime;
    if (r.pitting) {
      const lapsLeft = snap.totalLaps - lap;
      const next = chooseNextCompound(car.profile, lapsLeft, car.usedCompounds, { lap, totalLaps: snap.totalLaps });
      car.compound = next;
      car.tyreAge = 0;
      car.stops += 1;
      car.usedCompounds.push(next);
    } else {
      car.tyreAge += 1;
    }
  }
  cars.sort((x, y) => x.time - y.time);
  const leader = cars[0].time;
  cars.forEach((c) => { c.time -= leader; });
  snap.lap = lap;
}

/** A car that finishes without meeting the two-compound rule is classified last (disqualified). */
function finishingPosition(snap, carId) {
  const legal = snap.cars.filter((c) => !needsCompoundRule(c, snap.isWet));
  const idx = legal.findIndex((c) => c.id === carId);
  return idx >= 0 ? idx + 1 : snap.cars.length;
}

/**
 * Simulate the rest of the race with our car following `action` and everyone
 * else (and our car after its committed stop) following the AI pit rule.
 */
export function simulateRest(snapshot, carId, action, rng) {
  const snap = cloneSnapshot(snapshot);
  const startLap = snap.lap;
  let committedStopDone = false;
  const decide = (car, lap) => {
    if (car.id !== carId) return aiWantsToPit(car, lap - 1, snap.totalLaps, snap.isWet);
    if (action.k === null) return false;
    if (!committedStopDone) {
      if (lap - 1 - startLap === action.k) { committedStopDone = true; return true; }
      return false;
    }
    return aiWantsToPit(car, lap - 1, snap.totalLaps, snap.isWet);
  };
  while (snap.lap < snap.totalLaps) stepLap(snap, rng, decide);
  return finishingPosition(snap, carId);
}

/**
 * Expected finishing position for each valid action, from `rollouts` seeded
 * Monte Carlo runs. Rollout i uses the same random seed for every action
 * (common random numbers), so the comparison between actions is low-noise.
 */
export function oracleEvaluate(snapshot, carId, { rollouts = 16, seed = 1, actions = null } = {}) {
  const acts = actions || validActions(snapshot, carId);
  return acts.map((action) => {
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < rollouts; i++) {
      const pos = simulateRest(snapshot, carId, action, mulberry32((seed * 7919 + i * 104729) >>> 0));
      sum += pos;
      sumSq += pos * pos;
    }
    const mean = sum / rollouts;
    return { action, expectedPos: mean, sd: Math.sqrt(Math.max(0, sumSq / rollouts - mean * mean)) };
  });
}

/**
 * Deterministic race time (s) for each option with no traffic or rivals: the
 * same stint arithmetic the race engineer's planner uses. Returns
 * { [actionId]: seconds }.
 */
export function timeOnlyCosts(snapshot, carId) {
  const car = snapshot.cars.find((c) => c.id === carId);
  const lapsLeft = snapshot.totalLaps - snapshot.lap;
  const opts = { totalLaps: snapshot.totalLaps };
  const stint = (compound, age, laps, startLap) => {
    let t = 0;
    for (let i = 0; i < laps; i++) t += expectedLapTime(car.profile, { compound, tyreAge: age + i, lap: startLap + i, ...opts });
    return t;
  };
  const costs = {};
  for (const action of validActions(snapshot, carId)) {
    if (action.k === null) {
      costs[action.id] = stint(car.compound, car.tyreAge, lapsLeft, snapshot.lap + 1);
      continue;
    }
    const atLap = snapshot.lap + 1 + action.k;
    const rest = lapsLeft - action.k;
    const next = chooseNextCompound(car.profile, rest, car.usedCompounds, { lap: atLap, totalLaps: snapshot.totalLaps });
    let cost = stint(car.compound, car.tyreAge, action.k, snapshot.lap + 1) + PIT_LOSS_BASE;
    if (tyreLife(car.profile, next) * 1.1 >= rest) {
      cost += stint(next, 0, rest, atLap);
    } else {
      // The new set can't make it: split the rest over two stints
      const half = Math.ceil(rest / 2);
      cost += stint(next, 0, half, atLap) + PIT_LOSS_BASE + stint(next, 0, rest - half, atLap + half);
    }
    costs[action.id] = cost;
  }
  return costs;
}

/** Baseline: the race engineer's time-only planner, restricted to the same options. */
export function timeOnlyChoice(snapshot, carId) {
  const costs = timeOnlyCosts(snapshot, carId);
  const best = Object.entries(costs).sort((a, b) => a[1] - b[1])[0];
  return best ? STRATEGY_ACTIONS.find((a) => a.id === best[0]) : null;
}

/**
 * Snapshot at the start, from a given grid order. Dry races start on a mix of
 * compounds; wet races on intermediates.
 * @param grid [{ id, profile }] in grid order (pole first)
 */
export function createGridSnapshot({ grid, totalLaps, difficulty, isWet = false, trackName = "", rng }) {
  const cars = grid.map(({ id, profile }, i) => {
    const startCompound = isWet ? "Intermediate" : rng() < 0.6 ? "Medium" : rng() < 0.5 ? "Soft" : "Hard";
    return {
      id,
      profile,
      compound: startCompound,
      tyreAge: 0,
      usedCompounds: [startCompound],
      stops: 0,
      pitThreshold: 0.82 + rng() * 0.18,
      time: i * 0.6,
    };
  });
  return { lap: 0, totalLaps, difficulty, isWet, trackName, cars };
}

/**
 * Build a race snapshot from start: grid by pace with noise, everyone on a
 * strategy-appropriate start compound. Used to generate training states.
 */
export function createStartSnapshot({ entries, track, totalLaps, difficulty, rng }) {
  const grid = entries
    .map((e) => ({ ...e, score: e.profile.staticDelta + gaussian(rng) * 0.35 }))
    .sort((a, b) => a.score - b.score);
  return createGridSnapshot({ grid, totalLaps, difficulty, isWet: false, trackName: track?.name || "", rng });
}

/** Run the race forward with every car on the AI rule (used to reach realistic mid-race states). */
export function advanceSnapshot(snapshot, laps, rng) {
  const snap = cloneSnapshot(snapshot);
  for (let i = 0; i < laps && snap.lap < snap.totalLaps; i++) {
    stepLap(snap, rng, (car, lap) => aiWantsToPit(car, lap - 1, snap.totalLaps, snap.isWet));
  }
  return snap;
}
