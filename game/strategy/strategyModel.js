/**
 * strategyModel.js
 * ────────────────
 * In-game inference for the pit-strategy network trained by
 * scripts/train-strategy-model.mjs.
 *
 *   expected finishing position(option) = position
 *       + value(race state)              how the race is going anyway
 *       + advantage(race state, option)  what this pit option adds or costs
 *
 * Both parts are 3-member MLP ensembles; the spread between members is
 * reported as uncertainty. The advantage net also gets the race engineer's
 * time-only cost for each option, so it learns what that arithmetic misses:
 * traffic on the rejoin, being held up, and rivals who still have to stop.
 *
 * One decision (all options) takes tens of microseconds, against ~100 ms for
 * the Monte Carlo rollouts it was trained to imitate.
 */

import { STRATEGY_MODEL } from "../../data/strategyModelWeights.js";
import { predictNet } from "../setup/setupModel.js";
import { STRATEGY_ACTIONS, validActions, timeOnlyChoice } from "./strategyRollout.js";
import { encodeState, buildFeatures, snapshotFromEngine } from "./strategyFeatures.js";

export const strategyModelMetrics = STRATEGY_MODEL.metrics;

function ensemble(nets, x) {
  const preds = nets.map((n) => predictNet(n, x));
  const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
  const sd = Math.sqrt(preds.reduce((a, p) => a + (p - mean) ** 2, 0) / preds.length);
  return { mean, sd };
}

/**
 * Score every valid pit option for one car in a race snapshot.
 * @returns {null | {
 *   position, options: [{ id, label, k, expectedPos, uncertainty }],
 *   best, plannerPick, agreesWithPlanner, gainVsPlanner
 * }}
 */
export function predictStrategy(snapshot, carId) {
  if (!snapshot) return null;
  const actions = validActions(snapshot, carId);
  if (actions.length === 0) return null;
  const position = snapshot.cars.findIndex((c) => c.id === carId) + 1;
  const enc = encodeState(snapshot, carId);
  const scale = STRATEGY_MODEL.targetScale;
  const value = ensemble(STRATEGY_MODEL.value.nets, enc.state);

  const options = actions.map((action) => {
    const adv = ensemble(STRATEGY_MODEL.advantage.nets, buildFeatures(enc, action));
    return {
      id: action.id,
      label: action.label,
      k: action.k,
      expectedPos: Math.max(1, position + scale * (value.mean + adv.mean)),
      uncertainty: scale * Math.sqrt(value.sd ** 2 + adv.sd ** 2),
    };
  }).sort((a, b) => a.expectedPos - b.expectedPos);

  const best = options[0];
  const plannerAction = timeOnlyChoice(snapshot, carId);
  const plannerPick = options.find((o) => o.id === plannerAction?.id) || null;
  return {
    position,
    options,
    best,
    plannerPick,
    agreesWithPlanner: !plannerPick || plannerPick.id === best.id,
    gainVsPlanner: plannerPick ? plannerPick.expectedPos - best.expectedPos : 0,
  };
}

/** Convenience: advice for one of our cars in a live LiveRaceEngine (null when it doesn't apply). */
export function adviseLiveCar(engine, carId) {
  return predictStrategy(snapshotFromEngine(engine, carId), carId);
}

export { STRATEGY_ACTIONS };
