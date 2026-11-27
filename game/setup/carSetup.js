/**
 * carSetup.js
 * ───────────
 * Car setup "physics" for the Setup Lab.
 *
 * This file is the hidden ground truth the game runs on. The team never sees
 * it directly: it only sees noisy practice-run lap deltas and driver feedback,
 * and the ML model in setupModel.js has to learn the mapping
 *   (circuit features, car features, setup) -> lap-time delta.
 *
 * Two parts make up the lap delta (seconds, lower is better):
 *   matchDelta – how well the car's design suits the circuit (development lever)
 *   setupDelta – how far the setup is from this circuit's ideal window (weekend lever)
 *
 * Each real circuit also has a hidden "quirk": a fixed offset to its ideal
 * setup that the generic physics (what the team's CFD / simulator knows)
 * does not capture. Practice running is how the team discovers it.
 */

import { CIRCUIT_LIBRARY } from '../../fia/circuitLibrary.js';

export const SETUP_PARAMS = [
  { key: 'frontWing',    label: 'Front Wing',    low: 'Low',     high: 'High' },
  { key: 'rearWing',     label: 'Rear Wing',     low: 'Low',     high: 'High' },
  { key: 'rideHeight',   label: 'Ride Height',   low: 'Low',     high: 'High' },
  { key: 'suspension',   label: 'Suspension',    low: 'Soft',    high: 'Stiff' },
  { key: 'brakeBias',    label: 'Brake Bias',    low: 'Rearward', high: 'Forward' },
  { key: 'differential', label: 'Differential',  low: 'Open',    high: 'Locked' },
];

export const SETUP_KEYS = SETUP_PARAMS.map(p => p.key);
export const TRACK_FEATURE_KEYS = ['engine', 'downforce', 'mech', 'tyreDeg', 'braking', 'cooling', 'straight', 'cornerDensity', 'elevation'];
export const CAR_FEATURE_KEYS = ['aero', 'chassis', 'power', 'reliability'];
export const FEATURE_COUNT = TRACK_FEATURE_KEYS.length + CAR_FEATURE_KEYS.length + SETUP_KEYS.length;
export const SETUP_OFFSET = TRACK_FEATURE_KEYS.length + CAR_FEATURE_KEYS.length;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const norm = (v, lo, hi) => clamp01((v - lo) / (hi - lo));

// ─── Deterministic helpers ────────────────────────────────────────────────

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Feature extraction ───────────────────────────────────────────────────

const DOWNFORCE_WORDS = { 'Very Low': 2, Low: 3, Medium: 5, 'Medium-High': 6.5, High: 8, 'Very High': 9.5 };

/** Find the circuit record for a calendar round, a circuit id, or a custom circuit object. */
export function getCircuitRecord(track, appState = null) {
  if (!track) return null;
  if (typeof track === 'object' && track.perf) return track;
  const id = typeof track === 'string' ? track : (track.circuit || track.circuitId || track.name);
  const fromLibrary = CIRCUIT_LIBRARY.find(c => c.circuitId === id || c.name === id || c.grandPrix === id);
  if (fromLibrary) return fromLibrary;
  const custom = appState?.fia?.customCircuits?.find?.(c => c.circuitId === id || c.name === id);
  if (custom) return custom;
  return typeof track === 'object' ? track : { circuitId: id, name: id };
}

export function getCircuitId(track, appState = null) {
  const rec = getCircuitRecord(track, appState);
  return rec?.circuitId || rec?.name || 'unknown';
}

/** 9 circuit features, each 0..1. Works for library, custom and partial circuits. */
export function extractTrackFeatures(circuit) {
  const c = circuit || {};
  const p = c.perf || {};
  const dfGuess = DOWNFORCE_WORDS[c.downforceDemand] ?? 5;
  const lengthKm = c.lengthKm || 5;
  const corners = c.corners || 16;
  return {
    engine:        norm(p.engineImportance ?? (11 - dfGuess), 1, 10),
    downforce:     norm(p.downforceRequirement ?? dfGuess, 1, 10),
    mech:          norm(p.mechanicalGripImportance ?? 5, 1, 10),
    tyreDeg:       norm(p.tyreDegradation ?? ((c.tyreWear ?? 1.2) * 4), 1, 10),
    braking:       norm(p.brakingIntensity ?? 5, 1, 10),
    cooling:       norm(p.coolingRequirement ?? 5, 1, 10),
    straight:      norm(c.longestStraightM ?? 900, 250, 2100),
    cornerDensity: norm(corners / lengthKm, 1.8, 6),
    elevation:     norm(c.elevationChangeM ?? 20, 0, 100),
  };
}

/** 4 car features, each 0..1, from a Team object. */
export function extractCarFeatures(team) {
  const t = team || {};
  const ovr = t.specs?.ovr ?? t.carPerformance ?? 85;
  return {
    aero:        norm(t.specs?.aero ?? ovr, 70, 100),
    chassis:     norm(t.specs?.chassis ?? ovr, 70, 100),
    power:       norm(t.carPerformance ?? ovr, 70, 100),
    reliability: norm(t.specs?.reliability ?? ovr, 70, 100),
  };
}

export function setupToArray(setup) {
  return SETUP_KEYS.map(k => clamp01((setup?.[k] ?? 50) / 100));
}

export function arrayToSetup(arr) {
  return Object.fromEntries(SETUP_KEYS.map((k, i) => [k, Math.round(clamp01(arr[i]) * 100)]));
}

export function buildFeatureVector(trackF, carF, setupArr) {
  return [
    ...TRACK_FEATURE_KEYS.map(k => trackF[k]),
    ...CAR_FEATURE_KEYS.map(k => carF[k]),
    ...setupArr,
  ];
}

// ─── Ground-truth physics ─────────────────────────────────────────────────

/** Ideal setup (0..1 per param) from generic physics — no circuit quirk. */
export function genericIdealSetup(tf, cf) {
  const rearWing = clamp01(0.2 + 0.7 * tf.downforce - 0.3 * tf.straight - 0.15 * tf.engine + 0.2 * (0.6 - cf.aero));
  return [
    clamp01(rearWing + 0.08 + 0.12 * tf.cornerDensity - 0.1 * tf.tyreDeg),          // frontWing
    rearWing,                                                                        // rearWing
    clamp01(0.2 + 0.35 * tf.elevation + 0.2 * (1 - cf.chassis) + 0.15 * tf.cornerDensity - 0.15 * tf.downforce), // rideHeight
    clamp01(0.25 + 0.5 * tf.downforce - 0.3 * tf.cornerDensity - 0.15 * tf.elevation + 0.1 * cf.chassis),       // suspension
    clamp01(0.35 + 0.35 * tf.braking - 0.1 * tf.mech + 0.1 * tf.tyreDeg),          // brakeBias
    clamp01(0.3 + 0.45 * tf.mech - 0.25 * tf.tyreDeg + 0.1 * (1 - cf.chassis)),   // differential
  ];
}

const QUIRK_AMPLITUDE = 0.22;

/** Fixed hidden offset to the ideal setup for a given circuit id. */
export function circuitQuirk(circuitId) {
  const rng = mulberry32(hashString(`quirk:${circuitId}`));
  return SETUP_KEYS.map(() => (rng() * 2 - 1) * QUIRK_AMPLITUDE);
}

/** True ideal setup, including the circuit's hidden quirk when an id is given. */
export function trueIdealSetup(tf, cf, circuitId = null) {
  const base = genericIdealSetup(tf, cf);
  if (!circuitId) return base;
  const q = circuitQuirk(circuitId);
  return base.map((v, i) => clamp01(v + q[i]));
}

function sensitivities(tf) {
  return [
    0.6,                                              // frontWing
    1.2 * (0.5 + 0.5 * tf.downforce + 0.5 * tf.straight), // rearWing
    0.8,                                              // rideHeight (too high); too low handled below
    0.7,                                              // suspension
    0.5 * (0.5 + tf.braking),                         // brakeBias
    0.6 * (0.5 + tf.mech),                            // differential
  ];
}

/** Seconds lost to setup error. 0 at the ideal, grows quadratically. */
export function setupPenalty(setupArr, ideal, tf) {
  const w = sensitivities(tf);
  let pen = 0;
  for (let i = 0; i < 6; i++) {
    const e = setupArr[i] - ideal[i];
    const wi = (i === 2 && e < 0) ? 2.0 : w[i]; // running too low bottoms out the floor
    pen += wi * e * e;
  }
  const balanceErr = (setupArr[0] - ideal[0]) - (setupArr[1] - ideal[1]);
  pen += 0.8 * balanceErr * balanceErr;
  return pen;
}

/** Seconds gained/lost from how the car's design suits the circuit. ~0 for an average car. */
export function matchDelta(tf, cf) {
  return 0.5 * tf.downforce * (0.6 - cf.aero)
       + 0.5 * tf.engine * (0.6 - cf.power)
       + 0.4 * tf.mech * (0.6 - cf.chassis)
       + 0.2 * tf.cooling * (0.6 - cf.reliability);
}

/**
 * Full truth for one car + setup at one circuit.
 * @param {boolean} withQuirk false = generic physics (what CFD/simulator data looks like)
 */
export function evaluateSetup(circuit, team, setup, { withQuirk = true, appState = null } = {}) {
  const rec = getCircuitRecord(circuit, appState);
  const tf = extractTrackFeatures(rec);
  const cf = extractCarFeatures(team);
  const arr = Array.isArray(setup) ? setup : setupToArray(setup);
  const ideal = trueIdealSetup(tf, cf, withQuirk ? (rec?.circuitId || rec?.name) : null);
  const setupDelta = setupPenalty(arr, ideal, tf);
  const match = matchDelta(tf, cf);
  return { setupDelta, matchDelta: match, lapDelta: setupDelta + match, ideal, tf, cf };
}

/** Map seconds of setup loss to the 0..1 setup quality score used by weekendForm. */
export function setupQualityFromDelta(setupDelta) {
  return clamp01(1 - setupDelta);
}

// ─── Driver feedback ──────────────────────────────────────────────────────

const FEEDBACK_TEXT = {
  frontWing:    { low: 'Understeer on turn-in — the front is washing out.', high: 'Front is too pointy, rear feels nervous on entry.' },
  rearWing:     { low: 'Rear is loose in the fast stuff, not enough downforce.', high: 'We are a sitting duck on the straights — too much drag.' },
  rideHeight:   { low: 'The floor is bottoming out over the bumps.', high: 'Car feels lazy, like the floor isn\'t working.' },
  suspension:   { low: 'Car rolls too much in the high-speed changes of direction.', high: 'Too stiff — it\'s skipping over the kerbs.' },
  brakeBias:    { low: 'Rears are locking into the big stops.', high: 'Fronts are locking under heavy braking.' },
  differential: { low: 'Poor traction out of the slow corners, inside wheel spinning.', high: 'Diff is too locked, it pushes on entry and eats the rears.' },
};

/**
 * Driver radio after a run. Better `feedback` stat = more likely to point at the
 * real biggest problem; weaker drivers sometimes chase the wrong thing.
 */
export function driverFeedback(setupArr, ideal, tf, driver, rng = Math.random) {
  const w = sensitivities(tf);
  const errors = setupArr.map((v, i) => {
    const e = v - ideal[i];
    return { i, e, cost: ((i === 2 && e < 0) ? 2.0 : w[i]) * e * e };
  }).sort((a, b) => b.cost - a.cost);

  const skill = (driver?.feedback ?? 75) / 100;
  const accuracy = 0.45 + 0.5 * skill;
  const messages = [];
  const top = errors.slice(0, 2).filter(x => x.cost > 0.012);

  if (!top.length) {
    messages.push({ param: null, text: 'Balance is really nice. I would not touch much.', reliable: true });
    return messages;
  }
  for (const err of top) {
    if (rng() < accuracy) {
      const key = SETUP_KEYS[err.i];
      messages.push({ param: key, direction: err.e < 0 ? 'low' : 'high', text: FEEDBACK_TEXT[key][err.e < 0 ? 'low' : 'high'], reliable: true });
    } else {
      const wrong = SETUP_KEYS[Math.floor(rng() * SETUP_KEYS.length)];
      const dir = rng() < 0.5 ? 'low' : 'high';
      messages.push({ param: wrong, direction: dir, text: FEEDBACK_TEXT[wrong][dir], reliable: false });
    }
  }
  return messages;
}

// ─── AI teams ─────────────────────────────────────────────────────────────

/**
 * AI teams don't run the model; they land near the true ideal with an error
 * that shrinks with the team's engineering strength. Deterministic per weekend.
 */
export function aiTeamSetupDelta(team, circuit, seedKey, appState = null) {
  const rec = getCircuitRecord(circuit, appState);
  const tf = extractTrackFeatures(rec);
  const cf = extractCarFeatures(team);
  const ideal = trueIdealSetup(tf, cf, rec?.circuitId || rec?.name);
  const engineering = norm(team?.specs?.ovr ?? team?.carPerformance ?? 85, 75, 100);
  const sd = 0.05 + 0.13 * (1 - engineering);
  const rng = mulberry32(hashString(`ai:${seedKey}:${team?.name}`));
  const arr = ideal.map(v => clamp01(v + randn(rng) * sd));
  return setupPenalty(arr, ideal, tf);
}
