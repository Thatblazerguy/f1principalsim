/**
 * strategyFeatures.js
 * ───────────────────
 * Turns a race snapshot + one of our pit options into the input vector of the
 * strategy network, and turns a live LiveRaceEngine into a snapshot.
 *
 * Every feature is scaled to roughly [-1, 1] and describes the race from our
 * car's point of view: race phase, tyre state, gaps and pace relative to the
 * cars around us, how much traffic a stop would drop us into, and how many
 * rivals around us still have a stop to make.
 */

import { expectedLapTime, tyreLife, clamp, DRY_COMPOUNDS, PIT_LOSS_BASE, getOvertakingDifficulty } from "../paceModel.js";
import { STRATEGY_ACTIONS, needsCompoundRule, timeOnlyCosts } from "./strategyRollout.js";

export const STATE_FEATURES = [
  "lapFrac", "lapsLeft", "position", "soft", "medium", "hard",
  "tyreAgeOfLife", "tyreMargin", "needsStop", "gapAhead", "gapBehind",
  "paceVsAhead", "paceVsBehind", "rejoinTraffic", "rivalsAheadToStop",
  "rivalsBehindToStop", "fieldPace", "overtakeDifficulty", "trackWear",
];
/** Per-option inputs: which option (one-hot), when we'd stop, and the physics planner's time cost. */
export const ACTION_FEATURES = [...STRATEGY_ACTIONS.map((a) => a.id), "stopLapFrac", "timeCostVsBest"];
export const STATE_FEATURE_COUNT = STATE_FEATURES.length;
export const FEATURE_COUNT = STATE_FEATURES.length + ACTION_FEATURES.length;

/** Position-change scale used for the network's target: output × 5 = places. */
export const TARGET_SCALE = 5;

function owesStop(car, snap) {
  const lapsLeft = snap.totalLaps - snap.lap;
  if (lapsLeft <= 2) return false;
  return needsCompoundRule(car, snap.isWet) || car.tyreAge + lapsLeft > tyreLife(car.profile, car.compound) * 1.3;
}

/** Feature vector for our car's state (without the action part). */
export function stateFeatures(snap, carId) {
  const cars = snap.cars;
  const i = cars.findIndex((c) => c.id === carId);
  const car = cars[i];
  const ahead = cars[i - 1] || null;
  const behind = cars[i + 1] || null;
  const lap = snap.lap + 1;
  const lapsLeft = snap.totalLaps - snap.lap;
  const lapArgs = { lap, totalLaps: snap.totalLaps };
  const myLap = expectedLapTime(car.profile, { compound: car.compound, tyreAge: car.tyreAge, ...lapArgs });
  const lapOf = (c) => expectedLapTime(c.profile, { compound: c.compound, tyreAge: c.tyreAge, ...lapArgs });
  const life = tyreLife(car.profile, car.compound);

  const behindUs = cars.slice(i + 1);
  const aheadOfUs = cars.slice(0, i);
  const rejoinTraffic = behindUs.filter((c) => c.time - car.time < PIT_LOSS_BASE).length;
  const nearAhead = aheadOfUs.filter((c) => car.time - c.time < PIT_LOSS_BASE * 1.5);
  const nearBehind = behindUs.filter((c) => c.time - car.time < PIT_LOSS_BASE * 1.5);
  const sorted = cars.map((c) => c.profile.staticDelta).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return [
    clamp(snap.lap / snap.totalLaps, 0, 1),
    clamp(lapsLeft / 70, 0, 1),
    (i + 1) / cars.length,
    car.compound === "Soft" ? 1 : 0,
    car.compound === "Medium" ? 1 : 0,
    car.compound === "Hard" ? 1 : 0,
    clamp(car.tyreAge / life, 0, 2) - 0.5,
    clamp((life - car.tyreAge) / Math.max(1, lapsLeft), -1, 2) / 2,
    needsCompoundRule(car, snap.isWet) ? 1 : 0,
    ahead ? clamp(car.time - ahead.time, 0, 30) / 30 : 1,
    behind ? clamp(behind.time - car.time, 0, 30) / 30 : 1,
    ahead ? clamp(lapOf(ahead) - myLap, -3, 3) / 3 : 0,
    behind ? clamp(lapOf(behind) - myLap, -3, 3) / 3 : 0,
    rejoinTraffic / 15,
    nearAhead.length ? nearAhead.filter((c) => owesStop(c, snap)).length / 8 : 0,
    nearBehind.length ? nearBehind.filter((c) => owesStop(c, snap)).length / 8 : 0,
    clamp(car.profile.staticDelta - median, -1.5, 1.5) / 1.5,
    snap.difficulty,
    clamp((car.profile.trackWear - 1.2) / 0.5, -1, 1),
  ];
}

/**
 * Option-specific inputs. `timeCosts` comes from timeOnlyCosts(): feeding the
 * planner's answer in lets the network learn what the arithmetic misses
 * (traffic, rivals' stops, being held up) instead of relearning tyre maths.
 */
export function actionFeatures(action, timeCosts, lapsLeft) {
  const best = Math.min(...Object.values(timeCosts));
  const delta = (timeCosts[action.id] ?? best) - best;
  return [
    ...STRATEGY_ACTIONS.map((a) => (a.id === action.id ? 1 : 0)),
    action.k === null ? 1 : clamp(action.k / Math.max(1, lapsLeft), 0, 1),
    clamp(delta / 20, 0, 2),
  ];
}

/** Everything the network needs about one race state, computed once per decision. */
export function encodeState(snap, carId) {
  return {
    state: stateFeatures(snap, carId),
    timeCosts: timeOnlyCosts(snap, carId),
    lapsLeft: snap.totalLaps - snap.lap,
  };
}

export const buildFeatures = (encoded, action) =>
  [...encoded.state, ...actionFeatures(action, encoded.timeCosts, encoded.lapsLeft)];

/**
 * Snapshot of a live race (LiveRaceEngine) in the rollout format. Returns null
 * when the model doesn't apply: wet races, or our car in the middle of a stop.
 */
export function snapshotFromEngine(engine, carId) {
  if (!engine || engine.isWet) return null;
  const running = engine.cars.filter((c) => !c.retired);
  const me = running.find((c) => c.id === carId);
  if (!me || me.pitStopStatus === "InLap" || me.pitStopStatus === "Pitting") return null;
  const leader = running[0];
  const ref = leader.basePace || engine.track.baseTime;
  const lap = Math.floor(me.distance);
  if (lap < 1 || engine.totalLaps - lap < 3) return null;
  return {
    lap,
    totalLaps: engine.totalLaps,
    difficulty: engine.overtakingDifficulty ?? getOvertakingDifficulty(engine.track),
    isWet: false,
    trackName: engine.track?.name || "",
    cars: running.map((c) => ({
      id: c.id,
      profile: c.profile,
      compound: DRY_COMPOUNDS.includes(c.tireCompound) ? c.tireCompound : "Medium",
      tyreAge: c.tyreAge,
      usedCompounds: c.usedCompounds.slice(),
      stops: c.stops,
      pitThreshold: c.aiPitThreshold || 0.9,
      // A car mid-stop is effectively the rest of its pit loss further back.
      time: (leader.distance - c.distance) * ref + (c.pitStopStatus === "Pitting" ? c.pitTimer || 0 : 0),
    })).sort((a, b) => a.time - b.time),
  };
}
