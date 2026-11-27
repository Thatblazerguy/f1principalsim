import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUIT_LIBRARY } from '../../fia/circuitLibrary.js';
import {
  extractTrackFeatures, genericIdealSetup, trueIdealSetup, setupPenalty, evaluateSetup,
  buildFeatureVector, arrayToSetup, mulberry32, randn, SETUP_OFFSET,
} from './carSetup.js';
import { createNet, trainNet, predictNet, optimiseSetup, suggestTestSetup, fitResidual } from './setupModel.js';
import { SETUP_MODEL } from '../../data/setupModelWeights.js';
import {
  ensureWeekendSetup, runPracticeTest, getRunsRemaining, lockWeekendSetup, getTeamSetupQuality, getDevelopmentDirection,
} from './setupLab.js';

const avgCar = { aero: 0.6, chassis: 0.6, power: 0.6, reliability: 0.6 };

test('setup penalty is zero at the ideal and positive elsewhere', () => {
  const tf = extractTrackFeatures(CIRCUIT_LIBRARY[0]);
  const ideal = genericIdealSetup(tf, avgCar);
  assert.equal(setupPenalty(ideal, ideal, tf), 0);
  assert.ok(setupPenalty(ideal.map(v => Math.min(1, v + 0.2)), ideal, tf) > 0.05);
});

test('MLP learns a simple quadratic', () => {
  const rng = mulberry32(1);
  const X = Array.from({ length: 800 }, () => [rng(), rng()]);
  const Y = X.map(([a, b]) => (a - 0.3) ** 2 + (b - 0.7) ** 2);
  const net = createNet([2, 12, 1], 3);
  const mse = trainNet(net, X, Y, { epochs: 60, lr: 0.01, batchSize: 32 });
  assert.ok(mse < 0.002, `mse ${mse}`);
  assert.ok(Math.abs(predictNet(net, [0.3, 0.7])) < 0.06);
});

test('pretrained model finds near-ideal setups on an unseen circuit', () => {
  const holdout = SETUP_MODEL.metrics.holdoutCircuits[0];
  const c = CIRCUIT_LIBRARY.find(x => x.circuitId === holdout);
  const tf = extractTrackFeatures(c);
  const best = optimiseSetup(SETUP_MODEL, buildFeatureVector(tf, avgCar, new Array(6).fill(0.5)));
  assert.ok(setupPenalty(best.setup, genericIdealSetup(tf, avgCar), tf) < 0.02);
});

test('practice runs teach the model the circuit quirk', () => {
  const rng = mulberry32(9);
  let before = 0, after = 0;
  for (const c of CIRCUIT_LIBRARY.slice(0, 10)) {
    const tf = extractTrackFeatures(c);
    const ideal = trueIdealSetup(tf, avgCar, c.circuitId);
    const baseX = buildFeatureVector(tf, avgCar, new Array(6).fill(0.5));
    before += setupPenalty(optimiseSetup(SETUP_MODEL, baseX).setup, ideal, tf);
    const samples = [];
    let residual = null;
    for (let run = 0; run < 8; run++) {
      const s = suggestTestSetup(SETUP_MODEL, baseX, { residual, runIndex: run, seed: 4 }).setup;
      samples.push({ x: baseX.slice(0, SETUP_OFFSET).concat(s), y: setupPenalty(s, ideal, tf) + randn(rng) * 0.03 });
      residual = fitResidual(SETUP_MODEL, samples, 0.03);
    }
    after += setupPenalty(optimiseSetup(SETUP_MODEL, baseX, { residual }).setup, ideal, tf);
  }
  assert.ok(after < before * 0.7, `before ${before.toFixed(3)} after ${after.toFixed(3)}`);
});

test('setup lab weekend flow: runs, budget, parc fermé, quality', () => {
  const team = { name: 'Test Racing', carPerformance: 88, specs: { aero: 88, chassis: 87, reliability: 90, ovr: 88 } };
  const state = { team, season: { year: 1, round: 1 }, finance: { facilities: { simulator: { level: 2 } } } };
  const track = { round: 1, name: 'Australian Grand Prix', circuit: 'Albert Park Circuit' };
  const weekend = ensureWeekendSetup(state, team, track);
  assert.equal(Object.keys(weekend.setup).length, 6);
  assert.equal(getRunsRemaining(state), 6);
  const res = runPracticeTest(state, team, track, { name: 'Driver A', feedback: 80 }, mulberry32(2));
  assert.ok(res.ok);
  assert.equal(getRunsRemaining(state), 5);
  assert.equal(state.setupLab.samples['Albert Park Circuit'].length, 1);
  const q = getTeamSetupQuality(team, track, state);
  assert.ok(q >= 0 && q <= 1);
  lockWeekendSetup(state);
  assert.equal(runPracticeTest(state, team, track, { name: 'Driver A' }).ok, false);
  const truth = evaluateSetup(track, team, arrayToSetup(trueIdealSetup(extractTrackFeatures(CIRCUIT_LIBRARY[0]), { aero: 0.6, chassis: 0.57, power: 0.6, reliability: 0.67 }, 'Albert Park Circuit')));
  assert.ok(truth.setupDelta < 0.01);
});

test('development direction favours the area the calendar demands', () => {
  const team = { name: 'T', carPerformance: 85, specs: { aero: 85, chassis: 85, reliability: 85, ovr: 85 } };
  const monza = [{ round: 1, name: 'Italian GP', circuit: 'Autodromo Nazionale Monza' }];
  const dir = getDevelopmentDirection({ team }, team, monza);
  assert.equal(dir.length, 4);
  assert.ok(dir.find(d => d.key === 'power').avgGain > dir.find(d => d.key === 'reliability').avgGain);
});
