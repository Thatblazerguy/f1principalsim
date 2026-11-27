/**
 * setupModel.js
 * ─────────────
 * Dependency-free ML for the Setup Lab.
 *
 * Two layers of learning:
 *
 * 1. Global model — an ensemble of small neural networks (MLP, tanh) trained
 *    offline by scripts/train-setup-model.mjs on generic setup physics across
 *    real and synthetic circuits. It maps
 *      [9 circuit features, 4 car features, 6 setup values] -> lap delta (s)
 *    and generalises to circuits it has never seen (including FIA custom ones).
 *    The spread between ensemble members is used as model uncertainty.
 *
 * 2. Track correlation — a per-circuit Bayesian linear regression on the
 *    residual (observed practice delta − global prediction). With a few noisy
 *    practice runs it learns the circuit's hidden setup quirk, with a proper
 *    posterior variance, so the team's model genuinely improves with running.
 */

import { mulberry32, randn, SETUP_OFFSET } from './carSetup.js';

// ─── MLP ──────────────────────────────────────────────────────────────────

export function createNet(sizes, seed = 1) {
  const rng = mulberry32(seed);
  const layers = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const nIn = sizes[l];
    const nOut = sizes[l + 1];
    const scale = Math.sqrt(1 / nIn);
    const W = new Array(nIn * nOut);
    for (let i = 0; i < W.length; i++) W[i] = randn(rng) * scale;
    layers.push({ nIn, nOut, W, b: new Array(nOut).fill(0) });
  }
  return { sizes: sizes.slice(), layers };
}

/** Forward pass. Returns the list of activations (input first, output last). */
function forwardAll(net, x) {
  const acts = [x];
  let a = x;
  const last = net.layers.length - 1;
  for (let l = 0; l <= last; l++) {
    const { nIn, nOut, W, b } = net.layers[l];
    const z = new Array(nOut);
    for (let o = 0; o < nOut; o++) {
      let s = b[o];
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) s += W[row + i] * a[i];
      z[o] = l === last ? s : Math.tanh(s);
    }
    acts.push(z);
    a = z;
  }
  return acts;
}

export function predictNet(net, x) {
  const acts = forwardAll(net, x);
  return acts[acts.length - 1][0];
}

/**
 * Backprop of the scalar output. Fills `grads` (same shape as layers) with
 * dOut/dParam scaled by `scale`, and returns dOut/dInput.
 */
function backward(net, acts, scale, grads) {
  let delta = [scale];
  const last = net.layers.length - 1;
  for (let l = last; l >= 0; l--) {
    const { nIn, nOut, W } = net.layers[l];
    const aIn = acts[l];
    if (grads) {
      const g = grads[l];
      for (let o = 0; o < nOut; o++) {
        const row = o * nIn;
        g.b[o] += delta[o];
        for (let i = 0; i < nIn; i++) g.W[row + i] += delta[o] * aIn[i];
      }
    }
    const prev = new Array(nIn).fill(0);
    for (let o = 0; o < nOut; o++) {
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) prev[i] += W[row + i] * delta[o];
    }
    if (l > 0) {
      for (let i = 0; i < nIn; i++) prev[i] *= 1 - aIn[i] * aIn[i]; // tanh'
    }
    delta = prev;
  }
  return delta;
}

export function inputGradient(net, x) {
  return backward(net, forwardAll(net, x), 1, null);
}

/** Mini-batch Adam on MSE. Mutates `net`. Returns final training MSE. */
export function trainNet(net, X, Y, { epochs = 30, lr = 0.003, batchSize = 64, l2 = 1e-5, seed = 7, onEpoch = null } = {}) {
  const rng = mulberry32(seed);
  const zeros = () => net.layers.map(L => ({ W: new Array(L.W.length).fill(0), b: new Array(L.b.length).fill(0) }));
  const m = zeros();
  const v = zeros();
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  let t = 0;
  const idx = X.map((_, i) => i);
  let mse = 0;

  for (let ep = 0; ep < epochs; ep++) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    let sse = 0;
    for (let start = 0; start < idx.length; start += batchSize) {
      const end = Math.min(idx.length, start + batchSize);
      const grads = zeros();
      for (let k = start; k < end; k++) {
        const n = idx[k];
        const acts = forwardAll(net, X[n]);
        const err = acts[acts.length - 1][0] - Y[n];
        sse += err * err;
        backward(net, acts, (2 * err) / (end - start), grads);
      }
      t++;
      const lrT = lr * Math.sqrt(1 - Math.pow(b2, t)) / (1 - Math.pow(b1, t));
      net.layers.forEach((L, l) => {
        for (const key of ['W', 'b']) {
          const P = L[key], G = grads[l][key], M = m[l][key], V = v[l][key];
          for (let p = 0; p < P.length; p++) {
            const g = G[p] + (key === 'W' ? l2 * P[p] : 0);
            M[p] = b1 * M[p] + (1 - b1) * g;
            V[p] = b2 * V[p] + (1 - b2) * g * g;
            P[p] -= lrT * M[p] / (Math.sqrt(V[p]) + eps);
          }
        }
      });
    }
    mse = sse / idx.length;
    if (onEpoch) onEpoch(ep, mse);
  }
  return mse;
}

// ─── Ensemble ─────────────────────────────────────────────────────────────

export function predictEnsemble(ensemble, x) {
  const preds = ensemble.nets.map(n => predictNet(n, x));
  const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
  const variance = preds.reduce((a, p) => a + (p - mean) ** 2, 0) / preds.length;
  return { mean, std: Math.sqrt(variance) };
}

function ensembleInputGradient(ensemble, x) {
  const g = new Array(x.length).fill(0);
  for (const n of ensemble.nets) {
    const gi = inputGradient(n, x);
    for (let i = 0; i < g.length; i++) g[i] += gi[i] / ensemble.nets.length;
  }
  return g;
}

// ─── Per-circuit Bayesian residual (track correlation) ────────────────────

const RESIDUAL_DIM = 7; // bias + 6 setup params
const PRIOR_SD = 0.3;   // prior on residual coefficients (seconds)

function residualBasis(x) {
  return [1, ...x.slice(SETUP_OFFSET, SETUP_OFFSET + 6)];
}

function solveSymmetric(A, bVec) {
  // Gaussian elimination with partial pivoting (small dense systems only).
  const n = bVec.length;
  const M = A.map((row, i) => [...row, bVec[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

function invert(A) {
  const n = A.length;
  return Array.from({ length: n }, (_, j) => {
    const e = new Array(n).fill(0); e[j] = 1;
    return solveSymmetric(A, e);
  }).reduce((inv, col, j) => { col.forEach((v, i) => { inv[i][j] = v; }); return inv; }, Array.from({ length: n }, () => new Array(n).fill(0)));
}

/**
 * Fit the residual posterior at one circuit from practice runs [{x, y}],
 * where y is a run's observed lap delta (noise sd = noiseSd).
 *
 * Driver radio is deliberately not used as data here: tested as
 * pseudo-observations it made recommendations worse (a single wrong call
 * outweighs a confident model). Feedback is advisory for the player.
 */
export function fitResidual(ensemble, samples, noiseSd) {
  const alpha = 1 / (PRIOR_SD * PRIOR_SD);
  const beta = 1 / (noiseSd * noiseSd);
  const A = Array.from({ length: RESIDUAL_DIM }, (_, i) => Array.from({ length: RESIDUAL_DIM }, (_, j) => (i === j ? alpha : 0)));
  const rhs = new Array(RESIDUAL_DIM).fill(0);
  for (const s of samples) {
    const phi = residualBasis(s.x);
    const r = s.y - predictEnsemble(ensemble, s.x).mean;
    for (let i = 0; i < RESIDUAL_DIM; i++) {
      rhs[i] += beta * phi[i] * r;
      for (let j = 0; j < RESIDUAL_DIM; j++) A[i][j] += beta * phi[i] * phi[j];
    }
  }
  return { mean: solveSymmetric(A, rhs), cov: invert(A), n: samples.length, noiseSd };
}

function residualPredict(residual, x) {
  if (!residual || !residual.n) return { mean: 0, std: 0 };
  const phi = residualBasis(x);
  const mean = phi.reduce((a, p, i) => a + p * residual.mean[i], 0);
  let variance = 0;
  for (let i = 0; i < RESIDUAL_DIM; i++) for (let j = 0; j < RESIDUAL_DIM; j++) variance += phi[i] * residual.cov[i][j] * phi[j];
  return { mean, std: Math.sqrt(Math.max(0, variance)) };
}

// ─── Public prediction + optimisation ─────────────────────────────────────

/** Combined prediction: global ensemble + circuit residual. */
export function predictLapDelta(ensemble, x, residual = null) {
  const g = predictEnsemble(ensemble, x);
  const r = residualPredict(residual, x);
  // Without local data the global model can't know the circuit's quirk:
  // add the prior quirk uncertainty so confidence starts honest.
  const quirkSd = residual?.n ? r.std : 0.12;
  return { mean: g.mean + r.mean, std: Math.sqrt(g.std ** 2 + quirkSd ** 2), modelStd: g.std, residualMean: r.mean };
}

/**
 * Find the setup that minimises predicted lap delta (projected gradient descent,
 * multi-start). `kappa` > 0 trades off exploration (lower confidence bound).
 * @returns {{setup:number[], mean:number, std:number}}
 */
export function optimiseSetup(ensemble, baseX, { residual = null, starts = [], restarts = 4, iters = 70, seed = 11, kappa = 0 } = {}) {
  const rng = mulberry32(seed);
  const candidates = [new Array(6).fill(0.5), ...starts.map(s => s.slice())];
  for (let r = 0; r < restarts; r++) candidates.push(Array.from({ length: 6 }, () => rng()));
  const resGrad = residual?.n ? residual.mean.slice(1) : new Array(6).fill(0);

  let best = null;
  for (const start of candidates) {
    let s = start.slice();
    let step = 0.06;
    for (let it = 0; it < iters; it++) {
      const x = baseX.slice(0, SETUP_OFFSET).concat(s);
      const g = ensembleInputGradient(ensemble, x).slice(SETUP_OFFSET, SETUP_OFFSET + 6).map((v, i) => v + resGrad[i]);
      const gn = Math.sqrt(g.reduce((a, v) => a + v * v, 0)) || 1;
      s = s.map((v, i) => Math.max(0, Math.min(1, v - step * g[i] / gn)));
      step *= 0.97;
    }
    const x = baseX.slice(0, SETUP_OFFSET).concat(s);
    const p = predictLapDelta(ensemble, x, residual);
    const score = p.mean - kappa * p.std;
    if (!best || score < best.score) best = { setup: s, mean: p.mean, std: p.std, score };
  }
  return best;
}

/**
 * Design the next practice test run: the current best guess plus a ±step
 * sweep on every parameter (random-sign design, like an engineer's setup
 * sweep). Spreading runs around the optimum is what makes the circuit
 * residual identifiable; running the same setup five times teaches nothing.
 */
export function suggestTestSetup(ensemble, baseX, { residual = null, runIndex = 0, seed = 1, step = 0.2 } = {}) {
  const best = optimiseSetup(ensemble, baseX, { residual, seed: seed + runIndex, restarts: 2 });
  const rng = mulberry32(seed * 31 + runIndex * 7919);
  const setup = best.setup.map(v => {
    const dir = rng() < 0.5 ? -1 : 1;
    let s = v + dir * step;
    if (s < 0 || s > 1) s = v - dir * step; // flip instead of clipping to keep the sweep informative
    return Math.max(0, Math.min(1, s));
  });
  const x = baseX.slice(0, SETUP_OFFSET).concat(setup);
  return { setup, ...predictLapDelta(ensemble, x, residual) };
}

// ─── Serialisation ────────────────────────────────────────────────────────

export function serialiseEnsemble(ensemble, digits = 5) {
  const r = (v) => Number(v.toFixed(digits));
  return {
    ...ensemble,
    nets: ensemble.nets.map(n => ({ sizes: n.sizes, layers: n.layers.map(L => ({ nIn: L.nIn, nOut: L.nOut, W: L.W.map(r), b: L.b.map(r) })) })),
  };
}
