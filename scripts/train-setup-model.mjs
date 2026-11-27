#!/usr/bin/env node
/**
 * Train the Setup Lab's global neural-network ensemble.
 *
 *   npm run train:setup
 *
 * Generates "CFD/simulator" data from the generic setup physics
 * (game/setup/carSetup.js, without circuit quirks) across real and synthetic
 * circuits, trains a 3-member MLP ensemble, evaluates on held-out real
 * circuits, and writes data/setupModelWeights.js.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CIRCUIT_LIBRARY } from '../fia/circuitLibrary.js';
import {
  FEATURE_COUNT, TRACK_FEATURE_KEYS, CAR_FEATURE_KEYS, SETUP_OFFSET,
  extractTrackFeatures, genericIdealSetup, trueIdealSetup, setupPenalty, matchDelta,
  buildFeatureVector, mulberry32, randn,
} from '../game/setup/carSetup.js';
import { createNet, trainNet, predictEnsemble, optimiseSetup, suggestTestSetup, fitResidual, serialiseEnsemble } from '../game/setup/setupModel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'setupModelWeights.js');
const SIZES = [FEATURE_COUNT, 24, 16, 1];
const MEMBERS = 3;
const SAMPLES = 24000;
const EPOCHS = Number(process.env.EPOCHS || 30);
const HOLDOUT_COUNT = 8;
const LABEL_NOISE = 0.03;

const rng = mulberry32(2026);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ─── Circuits ──────────────────────────────────────────────────────────────
const real = CIRCUIT_LIBRARY.map(c => ({ id: c.circuitId, tf: extractTrackFeatures(c) }));
const shuffled = real.slice().sort(() => rng() - 0.5);
const holdout = shuffled.slice(0, HOLDOUT_COUNT);
const trainReal = shuffled.slice(HOLDOUT_COUNT);
const synthetic = Array.from({ length: 400 }, (_, i) => ({
  id: `synthetic-${i}`,
  tf: Object.fromEntries(TRACK_FEATURE_KEYS.map(k => [k, rng()])),
}));
const trainCircuits = [...trainReal, ...synthetic];

const randomCar = () => Object.fromEntries(CAR_FEATURE_KEYS.map(k => [k, 0.15 + 0.85 * rng()]));

function randomSetupNear(ideal) {
  if (rng() < 0.5) return Array.from({ length: 6 }, () => rng());
  return ideal.map(v => clamp01(v + randn(rng) * 0.15));
}

function genericTarget(tf, cf, s) {
  return setupPenalty(s, genericIdealSetup(tf, cf), tf) + matchDelta(tf, cf);
}

function makeDataset(circuits, n) {
  const X = [], Y = [];
  for (let i = 0; i < n; i++) {
    const { tf } = circuits[Math.floor(rng() * circuits.length)];
    const cf = randomCar();
    const s = randomSetupNear(genericIdealSetup(tf, cf));
    X.push(buildFeatureVector(tf, cf, s));
    Y.push(genericTarget(tf, cf, s) + randn(rng) * LABEL_NOISE);
  }
  return { X, Y };
}

// ─── Train ─────────────────────────────────────────────────────────────────
const t0 = Date.now();
const { X, Y } = makeDataset(trainCircuits, SAMPLES);
const nets = [];
for (let m = 0; m < MEMBERS; m++) {
  const net = createNet(SIZES, 100 + m);
  const mse = trainNet(net, X, Y, {
    epochs: EPOCHS, lr: 0.004, batchSize: 64, seed: 500 + m,
    onEpoch: (ep, e) => { if ((ep + 1) % 10 === 0) console.log(`  member ${m + 1} epoch ${ep + 1}/${EPOCHS}  train RMSE ${Math.sqrt(e).toFixed(4)}s`); },
  });
  console.log(`member ${m + 1} done, train RMSE ${Math.sqrt(mse).toFixed(4)}s`);
  nets.push(net);
}
const ensemble = { version: 1, sizes: SIZES, nets };

// ─── Evaluate on held-out real circuits ────────────────────────────────────
const evalRng = mulberry32(99);
let absErr = 0, nErr = 0;
const gaps = { generic: [], quirkBefore: [], quirkAfter: [], baseline: [] };
const PRACTICE_NOISE = Number(process.env.NOISE || 0.03);
const PRACTICE_RUNS = Number(process.env.RUNS || 8);

for (const c of holdout) {
  for (let k = 0; k < 400; k++) {
    const cf = randomCar();
    const s = Array.from({ length: 6 }, () => evalRng());
    const x = buildFeatureVector(c.tf, cf, s);
    absErr += Math.abs(predictEnsemble(ensemble, x).mean - genericTarget(c.tf, cf, s));
    nErr++;
  }
  for (let k = 0; k < 12; k++) {
    const cf = randomCar();
    const baseX = buildFeatureVector(c.tf, cf, new Array(6).fill(0.5));
    const trueIdeal = trueIdealSetup(c.tf, cf, c.id);
    const genIdeal = genericIdealSetup(c.tf, cf);
    const rec = optimiseSetup(ensemble, baseX, { seed: k });
    gaps.baseline.push(setupPenalty(new Array(6).fill(0.5), trueIdeal, c.tf));
    gaps.generic.push(setupPenalty(rec.setup, genIdeal, c.tf));
    gaps.quirkBefore.push(setupPenalty(rec.setup, trueIdeal, c.tf));

    // Simulate a practice programme of designed test runs, learning the circuit residual.
    const samples = [];
    let residual = null;
    for (let run = 0; run < PRACTICE_RUNS; run++) {
      const s = suggestTestSetup(ensemble, baseX, { residual, runIndex: run, seed: 40 + k }).setup;
      const y = setupPenalty(s, trueIdeal, c.tf) + matchDelta(c.tf, cf) + randn(evalRng) * PRACTICE_NOISE;
      samples.push({ x: baseX.slice(0, SETUP_OFFSET).concat(s), y });
      residual = fitResidual(ensemble, samples, PRACTICE_NOISE);
    }
    const tuned = optimiseSetup(ensemble, baseX, { residual, seed: 77 });
    gaps.quirkAfter.push(setupPenalty(tuned.setup, trueIdeal, c.tf));
  }
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const metrics = {
  trainedAt: new Date().toISOString().slice(0, 10),
  samples: SAMPLES,
  epochs: EPOCHS,
  members: MEMBERS,
  holdoutCircuits: holdout.map(c => c.id),
  practiceRuns: PRACTICE_RUNS,
  practiceNoiseSd: PRACTICE_NOISE,
  holdoutMAE: Number((absErr / nErr).toFixed(4)),
  setupLoss: {
    neutralSetup: Number(avg(gaps.baseline).toFixed(4)),
    modelVsGenericPhysics: Number(avg(gaps.generic).toFixed(4)),
    modelBeforePractice: Number(avg(gaps.quirkBefore).toFixed(4)),
    modelAfterPracticeRuns: Number(avg(gaps.quirkAfter).toFixed(4)),
  },
};
ensemble.metrics = metrics;
console.log('\nHoldout metrics:', JSON.stringify(metrics, null, 2));

const body = `// AUTO-GENERATED by scripts/train-setup-model.mjs — do not edit by hand.\n// Re-train with: npm run train:setup\nexport const SETUP_MODEL = ${JSON.stringify(serialiseEnsemble(ensemble))};\n`;
writeFileSync(OUT, body);
console.log(`\nWrote ${path.relative(ROOT, OUT)} (${(body.length / 1024).toFixed(1)} KB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
