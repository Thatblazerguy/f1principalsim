/**
 * setupLab.js
 * ───────────
 * Game-state integration for the Setup Lab: weekend setup, practice test runs,
 * the team's learned track correlation, and development-direction insights.
 *
 * State lives in `state.setupLab`:
 *   samples: { [circuitId]: [{ x, y, year, round }] }  — practice data, kept across seasons
 *   weekend: { year, round, circuitId, setup, runs: [], locked, source }
 */

import { SETUP_MODEL } from '../../data/setupModelWeights.js';
import {
  SETUP_KEYS, SETUP_OFFSET, CAR_FEATURE_KEYS, TRACK_FEATURE_KEYS,
  getCircuitRecord, getCircuitId, extractTrackFeatures, extractCarFeatures,
  setupToArray, arrayToSetup, buildFeatureVector, evaluateSetup,
  setupQualityFromDelta, driverFeedback, aiTeamSetupDelta, randn,
} from './carSetup.js';
import { predictLapDelta, optimiseSetup, suggestTestSetup, fitResidual } from './setupModel.js';

const MAX_SAMPLES_PER_CIRCUIT = 40;
const residualCache = new Map();

export function ensureSetupLab(state) {
  if (!state.setupLab || typeof state.setupLab !== 'object') state.setupLab = {};
  const lab = state.setupLab;
  if (!lab.samples || typeof lab.samples !== 'object') lab.samples = {};
  if (lab.weekend === undefined) lab.weekend = null;
  return lab;
}

export function getModelInfo() {
  return SETUP_MODEL.metrics || {};
}

/** Simulator facility drives how much running you get and how clean the data is. */
export function getPracticeBudget(state) {
  const level = Math.max(1, Math.min(5, state?.finance?.facilities?.simulator?.level ?? 1));
  return { simulatorLevel: level, runs: 4 + level, noiseSd: Number((0.04 - 0.004 * level).toFixed(3)) };
}

function weekendKey(state) {
  return `${state?.season?.year ?? 1}-${state?.season?.round ?? 1}`;
}

function baseVector(team, track, appState) {
  const tf = extractTrackFeatures(getCircuitRecord(track, appState));
  const cf = extractCarFeatures(team);
  return buildFeatureVector(tf, cf, new Array(6).fill(0.5));
}

export function getResidual(state, circuitId) {
  const lab = ensureSetupLab(state);
  const samples = lab.samples[circuitId] || [];
  if (!samples.length) return null;
  const { noiseSd } = getPracticeBudget(state);
  const key = `${circuitId}:${samples.length}:${samples[samples.length - 1].y}:${noiseSd}`;
  if (!residualCache.has(key)) residualCache.set(key, fitResidual(SETUP_MODEL, samples, noiseSd));
  return residualCache.get(key);
}

/** Confidence 0–100 from predictive std (0.12s prior quirk sd ≈ 40%). */
function confidenceFromStd(std) {
  return Math.round(Math.max(5, Math.min(99, 100 * Math.exp(-std / 0.13))));
}

/** The model's best setup for this car at this circuit, using everything learned so far. */
export function getRecommendation(state, team, track) {
  const circuitId = getCircuitId(track, state);
  const residual = getResidual(state, circuitId);
  const best = optimiseSetup(SETUP_MODEL, baseVector(team, track, state), { residual, seed: 5 });
  return {
    setup: arrayToSetup(best.setup),
    predictedDelta: best.mean,
    std: best.std,
    confidence: confidenceFromStd(best.std),
    samples: residual?.n || 0,
  };
}

export function predictForSetup(state, team, track, setup) {
  const circuitId = getCircuitId(track, state);
  const x = baseVector(team, track, state).slice(0, SETUP_OFFSET).concat(setupToArray(setup));
  const p = predictLapDelta(SETUP_MODEL, x, getResidual(state, circuitId));
  return { predictedDelta: p.mean, std: p.std, confidence: confidenceFromStd(p.std) };
}

/** Create this weekend's setup sheet (pre-filled with the model's recommendation). */
export function ensureWeekendSetup(state, team, track) {
  const lab = ensureSetupLab(state);
  const key = weekendKey(state);
  const circuitId = getCircuitId(track, state);
  if (!lab.weekend || lab.weekend.key !== key || lab.weekend.circuitId !== circuitId) {
    const rec = getRecommendation(state, team, track);
    lab.weekend = { key, circuitId, setup: rec.setup, runs: [], locked: false, source: 'model' };
  }
  return lab.weekend;
}

export function setWeekendSetup(state, setup, source = 'manual') {
  const lab = ensureSetupLab(state);
  if (!lab.weekend || lab.weekend.locked) return false;
  lab.weekend.setup = Object.fromEntries(SETUP_KEYS.map(k => [k, Math.max(0, Math.min(100, Math.round(setup[k] ?? 50)))]));
  lab.weekend.source = source;
  return true;
}

/** Parc fermé: no more changes once qualifying starts. */
export function lockWeekendSetup(state) {
  const lab = ensureSetupLab(state);
  if (lab.weekend) lab.weekend.locked = true;
}

export function getRunsRemaining(state) {
  const lab = ensureSetupLab(state);
  return Math.max(0, getPracticeBudget(state).runs - (lab.weekend?.runs?.length || 0));
}

/** Designed test setup: best guess ± a sweep, so the next run teaches the model the most. */
export function getSuggestedTestSetup(state, team, track) {
  const circuitId = getCircuitId(track, state);
  const lab = ensureSetupLab(state);
  const residual = getResidual(state, circuitId);
  const runIndex = (lab.samples[circuitId] || []).length;
  const t = suggestTestSetup(SETUP_MODEL, baseVector(team, track, state), { residual, runIndex, seed: 17 });
  return arrayToSetup(t.setup);
}

/**
 * Run one practice test programme on the current weekend setup.
 * Returns the observed lap delta (truth + noise), the model's prediction
 * before the run, and the driver's radio feedback.
 */
export function runPracticeTest(state, team, track, driver, rng = Math.random) {
  const lab = ensureSetupLab(state);
  const weekend = ensureWeekendSetup(state, team, track);
  if (weekend.locked) return { ok: false, reason: 'Parc fermé — setup is locked after qualifying.' };
  if (getRunsRemaining(state) <= 0) return { ok: false, reason: 'No practice running left this weekend.' };

  const { noiseSd } = getPracticeBudget(state);
  const before = predictForSetup(state, team, track, weekend.setup);
  const truth = evaluateSetup(track, team, weekend.setup, { appState: state });
  const observed = truth.lapDelta + randn(rng) * noiseSd;
  const arr = setupToArray(weekend.setup);
  const radio = driverFeedback(arr, truth.ideal, truth.tf, driver, rng);

  const x = baseVector(team, track, state).slice(0, SETUP_OFFSET).concat(arr);
  const list = lab.samples[weekend.circuitId] || (lab.samples[weekend.circuitId] = []);
  list.push({ x: x.map(v => Number(v.toFixed(4))), y: Number(observed.toFixed(4)), year: state.season?.year ?? 1, round: state.season?.round ?? 1 });
  if (list.length > MAX_SAMPLES_PER_CIRCUIT) list.splice(0, list.length - MAX_SAMPLES_PER_CIRCUIT);

  const run = {
    n: weekend.runs.length + 1,
    setup: { ...weekend.setup },
    driver: driver?.name || 'Driver',
    observed: Number(observed.toFixed(3)),
    predicted: Number(before.predictedDelta.toFixed(3)),
    feedback: radio,
  };
  weekend.runs.push(run);
  return { ok: true, run };
}

// ─── Weekend performance hook ─────────────────────────────────────────────

/**
 * 0..1 setup quality used by weekendForm. Player team: from the actual setup
 * sheet vs the true ideal. AI teams: engineering-strength-based estimate.
 */
export function getTeamSetupQuality(team, track, appState) {
  if (!appState) return null;
  const isPlayer = appState.team && team?.name === appState.team.name;
  if (isPlayer) {
    const weekend = ensureWeekendSetup(appState, appState.team, track);
    const { setupDelta } = evaluateSetup(track, appState.team, weekend.setup, { appState });
    return setupQualityFromDelta(setupDelta);
  }
  return setupQualityFromDelta(aiTeamSetupDelta(team, track, weekendKey(appState), appState));
}

// ─── Insights: track fit + development direction ──────────────────────────

const AVERAGE_CAR = { aero: 0.6, chassis: 0.6, power: 0.6, reliability: 0.6 };

function bestPredicted(track, cf, appState) {
  const tf = extractTrackFeatures(getCircuitRecord(track, appState));
  const baseX = buildFeatureVector(tf, cf, new Array(6).fill(0.5));
  return optimiseSetup(SETUP_MODEL, baseX, { restarts: 1, iters: 50, seed: 3 }).mean;
}

/**
 * Predicted lap-time advantage (s, negative = faster) of the team's car vs an
 * average car at each circuit, both on their model-optimal setups.
 */
export function getTrackFitForecast(state, team, tracks) {
  const cf = extractCarFeatures(team);
  return tracks.map(track => {
    const rec = getCircuitRecord(track, state);
    const delta = bestPredicted(track, cf, state) - bestPredicted(track, AVERAGE_CAR, state);
    return { round: track.round, name: track.name || rec?.name, circuitId: rec?.circuitId, delta: Number(delta.toFixed(3)) };
  });
}

const DEV_AREAS = [
  { key: 'aero', label: 'Aerodynamics' },
  { key: 'power', label: 'Power Unit' },
  { key: 'chassis', label: 'Chassis' },
  { key: 'reliability', label: 'Cooling / Reliability' },
];

/**
 * Model-estimated lap time gained across the given circuits from +5 spec points
 * in each area. Tells you which upgrade suits the rest of the calendar.
 */
export function getDevelopmentDirection(state, team, tracks) {
  if (!tracks.length) return [];
  const cf = extractCarFeatures(team);
  const step = 5 / 30; // +5 spec points on the 70..100 scale
  const baseline = tracks.map(t => bestPredicted(t, cf, state));
  return DEV_AREAS.map(area => {
    const upgraded = { ...cf, [area.key]: Math.min(1, cf[area.key] + step) };
    const gains = tracks.map((t, i) => baseline[i] - bestPredicted(t, upgraded, state));
    const avg = gains.reduce((a, b) => a + b, 0) / gains.length;
    const bestIdx = gains.indexOf(Math.max(...gains));
    return {
      ...area,
      avgGain: Number(avg.toFixed(3)),
      bestCircuit: tracks[bestIdx]?.name || '',
      bestGain: Number(gains[bestIdx].toFixed(3)),
    };
  }).sort((a, b) => b.avgGain - a.avgGain);
}

export function getLearnedCircuits(state) {
  const lab = ensureSetupLab(state);
  return Object.entries(lab.samples).map(([circuitId, list]) => {
    const residual = getResidual(state, circuitId);
    const shift = residual ? Math.sqrt(residual.mean.slice(1).reduce((a, v) => a + v * v, 0)) : 0;
    return { circuitId, runs: list.length, correlationShift: Number(shift.toFixed(3)) };
  }).sort((a, b) => b.runs - a.runs);
}

export { SETUP_KEYS, TRACK_FEATURE_KEYS, CAR_FEATURE_KEYS };
