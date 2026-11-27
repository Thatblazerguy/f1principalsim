#!/usr/bin/env node
/**
 * Train the pit-strategy network.
 *
 *   npm run train:strategy
 *
 * 1. Generate race states: simulate races on 19 calendar circuits with the
 *    rollout simulator (game/strategy/strategyRollout.js), stop at a random
 *    lap, pick a car, and sometimes push its tyres off the usual policy so the
 *    model also sees states a human player creates (running long, odd compounds).
 * 2. Label them: for every pit option, the expected finishing position from
 *    Monte Carlo rollouts (common random numbers across options).
 * 3. Train two 3-member MLP ensembles:
 *      value:     19 state features              -> average places gained/lost
 *      advantage: state + 8 option features      -> how much better/worse this
 *                 option is than the average one
 *    The option features include the race engineer's time-only cost for that
 *    option, so the network learns a correction on top of the physics.
 * 4. Evaluate on 5 circuits the model never saw, against a *fresh*,
 *    higher-precision oracle (independent seeds, 4x the rollouts):
 *      - MAE of the predicted finishing position
 *      - regret: positions lost vs the oracle's best option, for the model,
 *        for the race engineer's time-only planner, and for fixed rules
 *      - inference time vs running the oracle
 * 5. Write data/strategyModelWeights.js.
 *
 * Everything is seeded, so a re-run reproduces the same model.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calendar } from '../data/calendar.js';
import { createAiTeams } from '../data/teams.js';
import { buildPaceProfile, getOvertakingDifficulty, tyreLife, DRY_COMPOUNDS } from '../game/paceModel.js';
import {
  STRATEGY_ACTIONS, createStartSnapshot, advanceSnapshot, oracleEvaluate, timeOnlyChoice, validActions,
} from '../game/strategy/strategyRollout.js';
import { encodeState, buildFeatures, FEATURE_COUNT, STATE_FEATURE_COUNT, TARGET_SCALE, STATE_FEATURES, ACTION_FEATURES } from '../game/strategy/strategyFeatures.js';
import { createNet, trainNet, predictNet, serialiseEnsemble } from '../game/setup/setupModel.js';
import { mulberry32 } from '../game/setup/carSetup.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'strategyModelWeights.js');

const TRAIN_STATES = Number(process.env.STATES || 6000);
const TEST_STATES = Number(process.env.TEST_STATES || 600);
const LABEL_ROLLOUTS = 24;
const EVAL_ROLLOUTS = 96;
const ADV_SIZES = [FEATURE_COUNT, 32, 16, 1];
const VALUE_SIZES = [STATE_FEATURE_COUNT, 24, 1];
const MEMBERS = 3;
const EPOCHS = Number(process.env.EPOCHS || 40);
const HOLDOUT_ROUNDS = [3, 13, 18, 21, 23]; // Suzuka, Hungaroring, Singapore, Interlagos, Lusail

const rng = mulberry32(2026);
const trainTracks = calendar.filter((t) => !HOLDOUT_ROUNDS.includes(t.round));
const testTracks = calendar.filter((t) => HOLDOUT_ROUNDS.includes(t.round));

// ─── State generation ──────────────────────────────────────────────────────

function jitteredTeams(r) {
  return createAiTeams().map((t) => {
    const d = (r() - 0.5) * 6; // ±3 OVR so the order isn't always the same
    return {
      ...t,
      carPerformance: t.carPerformance + d,
      specs: t.specs ? { ...t.specs, ovr: (t.specs.ovr ?? t.carPerformance) + d, aero: (t.specs.aero ?? t.carPerformance) + d, chassis: (t.specs.chassis ?? t.carPerformance) + d } : undefined,
    };
  });
}

function randomState(tracks, r) {
  const track = tracks[Math.floor(r() * tracks.length)];
  const teams = jitteredTeams(r);
  const entries = teams.flatMap((t) => t.drivers.map((d) => ({ id: d.name, profile: buildPaceProfile({ team: t, driver: d, track }) })));
  const start = createStartSnapshot({ entries, track, totalLaps: track.laps, difficulty: getOvertakingDifficulty(track), rng: r });
  const lap = 2 + Math.floor(r() * (track.laps - 6));
  const snap = advanceSnapshot(start, lap, r);
  const egoIdx = Math.floor(r() * snap.cars.length);
  const ego = snap.cars[egoIdx];

  // Off-policy perturbations: players run long, or start on unusual tyres.
  if (r() < 0.35) ego.tyreAge += Math.floor(r() * 12);
  if (r() < 0.15) {
    const c = DRY_COMPOUNDS[Math.floor(r() * 3)];
    ego.compound = c;
    ego.usedCompounds[ego.usedCompounds.length - 1] = c;
    ego.tyreAge = Math.min(ego.tyreAge, Math.ceil(tyreLife(ego.profile, c) * 1.3));
  }
  return { snap, egoId: ego.id, track: track.name };
}

function makeDataset(n, tracks, r, rollouts, label) {
  const rows = [];
  const t0 = Date.now();
  for (let s = 0; s < n; s++) {
    const { snap, egoId, track } = randomState(tracks, r);
    if (validActions(snap, egoId).length < 2) { s--; continue; }
    const pos = snap.cars.findIndex((c) => c.id === egoId) + 1;
    const evals = oracleEvaluate(snap, egoId, { rollouts, seed: Math.floor(r() * 1e9) });
    rows.push({ snap, egoId, pos, track, enc: encodeState(snap, egoId), evals });
    if ((s + 1) % 500 === 0) console.log(`  ${label}: ${s + 1}/${n} states (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  return rows;
}

console.log(`Generating ${TRAIN_STATES} training states on ${trainTracks.length} circuits…`);
const train = makeDataset(TRAIN_STATES, trainTracks, rng, LABEL_ROLLOUTS, 'train');
console.log(`Generating ${TEST_STATES} test states on held-out circuits: ${testTracks.map((t) => t.name).join(', ')}…`);
const test = makeDataset(TEST_STATES, testTracks, mulberry32(77), EVAL_ROLLOUTS, 'test');

// ─── Training ──────────────────────────────────────────────────────────────

const XA = [];
const YA = [];
const XV = [];
const YV = [];
for (const row of train) {
  const mean = row.evals.reduce((a, e) => a + e.expectedPos, 0) / row.evals.length;
  XV.push(row.enc.state);
  YV.push((mean - row.pos) / TARGET_SCALE);
  for (const e of row.evals) {
    XA.push(buildFeatures(row.enc, e.action));
    YA.push((e.expectedPos - mean) / TARGET_SCALE);
  }
}
function trainEnsemble(name, sizes, X, Y, seed) {
  console.log(`Training ${MEMBERS} ${name} networks ${sizes.join('→')} on ${X.length} samples, ${EPOCHS} epochs…`);
  const nets = [];
  for (let m = 0; m < MEMBERS; m++) {
    const net = createNet(sizes, seed + m);
    const mse = trainNet(net, X, Y, { epochs: EPOCHS, lr: 0.003, batchSize: 64, l2: 1e-5, seed: seed + 100 + m });
    console.log(`  member ${m + 1}: train RMSE ${(Math.sqrt(mse) * TARGET_SCALE).toFixed(3)} places`);
    nets.push(net);
  }
  return nets;
}
const valueNets = trainEnsemble('value', VALUE_SIZES, XV, YV, 100);
const advNets = trainEnsemble('advantage', ADV_SIZES, XA, YA, 300);
const avg = (nets, x) => nets.reduce((a, n) => a + predictNet(n, x), 0) / nets.length;
const predictPos = (row, action) =>
  row.pos + TARGET_SCALE * (avg(valueNets, row.enc.state) + avg(advNets, buildFeatures(row.enc, action)));

// ─── Evaluation on held-out circuits ───────────────────────────────────────

let absErr = 0;
let nErr = 0;
const regret = { model: 0, timeOnly: 0, boxNow: 0, latest: 0, random: 0 };
let agree = 0;
const evalRng = mulberry32(9);
for (const row of test) {
  const byId = Object.fromEntries(row.evals.map((e) => [e.action.id, e.expectedPos]));
  const best = Math.min(...row.evals.map((e) => e.expectedPos));
  const oracleBest = row.evals.find((e) => e.expectedPos === best).action.id;
  row.evals.forEach((e) => { absErr += Math.abs(predictPos(row, e.action) - e.expectedPos); nErr++; });

  const modelPick = row.evals.map((e) => ({ id: e.action.id, p: predictPos(row, e.action) })).sort((a, b) => a.p - b.p)[0].id;
  const timePick = timeOnlyChoice(row.snap, row.egoId)?.id;
  const valid = row.evals.map((e) => e.action.id);
  const boxPick = valid.includes('box_0') ? 'box_0' : valid[0];
  const latestPick = valid.filter((id) => id !== 'no_stop').at(-1) ?? valid[0];
  const randomPick = valid[Math.floor(evalRng() * valid.length)];

  regret.model += byId[modelPick] - best;
  regret.timeOnly += byId[timePick] - best;
  regret.boxNow += byId[boxPick] - best;
  regret.latest += byId[latestPick] - best;
  regret.random += byId[randomPick] - best;
  if (modelPick === oracleBest) agree++;
}
const n = test.length;
const round3 = (v) => Number(v.toFixed(3));

// Speed: one model decision (encode state + score all options) vs one oracle decision
const sample = test[0];
let t0 = performance.now();
for (let i = 0; i < 2000; i++) {
  const enc = encodeState(sample.snap, sample.egoId);
  sample.evals.forEach((e) => predictPos({ ...sample, enc }, e.action));
}
const modelUs = ((performance.now() - t0) / 2000) * 1000;
t0 = performance.now();
for (let i = 0; i < 5; i++) oracleEvaluate(sample.snap, sample.egoId, { rollouts: EVAL_ROLLOUTS, seed: i });
const oracleMs = (performance.now() - t0) / 5;

const metrics = {
  trainedAt: new Date().toISOString().slice(0, 10),
  trainStates: train.length,
  trainSamples: XA.length,
  labelRollouts: LABEL_ROLLOUTS,
  testStates: n,
  testRollouts: EVAL_ROLLOUTS,
  trainCircuits: trainTracks.length,
  holdoutCircuits: testTracks.map((t) => t.name),
  epochs: EPOCHS,
  members: MEMBERS,
  holdoutMAEPositions: round3(absErr / nErr),
  holdoutBestActionAgreement: round3(agree / n),
  meanRegretPositions: {
    model: round3(regret.model / n),
    engineerTimeOnly: round3(regret.timeOnly / n),
    alwaysBoxNow: round3(regret.boxNow / n),
    alwaysLatest: round3(regret.latest / n),
    random: round3(regret.random / n),
  },
  inferenceMicroseconds: Number(modelUs.toFixed(1)),
  oracleMilliseconds: Number(oracleMs.toFixed(1)),
};
console.log(JSON.stringify(metrics, null, 2));

const model = {
  version: 1,
  stateFeatures: STATE_FEATURES,
  actionFeatures: ACTION_FEATURES,
  actions: STRATEGY_ACTIONS.map((a) => a.id),
  targetScale: TARGET_SCALE,
  value: serialiseEnsemble({ sizes: VALUE_SIZES, nets: valueNets }),
  advantage: serialiseEnsemble({ sizes: ADV_SIZES, nets: advNets }),
  metrics,
};
writeFileSync(OUT, `// AUTO-GENERATED by scripts/train-strategy-model.mjs — do not edit by hand.
// Re-train with: npm run train:strategy
export const STRATEGY_MODEL = ${JSON.stringify(model)};
`);
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
