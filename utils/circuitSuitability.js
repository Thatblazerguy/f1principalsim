/**
 * circuitSuitability.js
 * ─────────────────────
 * Circuit-specific performance modifier for the F1 Principal Simulator.
 *
 * Computes a per-team suitability score and lap-time delta based on
 * how well the team's car attributes match a circuit's performance demands.
 *
 * Score: 0–100 (50 = neutral, >50 = well-suited, <50 = ill-suited)
 * Time delta: seconds (negative = faster, positive = slower), bounded ±1.2s
 *
 * Pillars (weights must sum to 1.0):
 *   POWER   0.20 – engine/ERS vs engineImportance
 *   AERO    0.18 – aero spec vs downforceRequirement
 *   MECH    0.18 – chassis vs mechanicalGripImportance
 *   TYRES   0.16 – driver tyre avg vs tyreDegradation
 *   BRAKING 0.12 – racecraft avg vs brakingIntensity
 *   COOLING 0.08 – reliability vs coolingRequirement
 *   WET     0.08 – driver wet avg vs wetWeatherSensitivity
 */

import { CIRCUIT_LIBRARY } from '../fia/circuitLibrary.js';

const SUITABILITY_AMPLITUDE = 1.2; // ±1.2s at extreme ends

const PILLAR_WEIGHTS = {
  power:   0.20,
  aero:    0.18,
  mech:    0.18,
  tyres:   0.16,
  braking: 0.12,
  cooling: 0.08,
  wet:     0.08,
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function normCar(v, lo = 55, hi = 99) { return clamp((v - lo) / (hi - lo), 0, 1); }
function normCircuit(v, lo = 1, hi = 10) { return clamp((v - lo) / (hi - lo), 0, 1); }

function powerPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.engineImportance ?? 5);
  return demand * normCar(team.carPerformance || 80);
}
function aeroPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.downforceRequirement ?? 5);
  const aeroStat = clamp((team.specs?.aero || team.carPerformance || 80), 55, 99);
  return demand * normCar(aeroStat);
}
function mechPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.mechanicalGripImportance ?? 5);
  const chassisStat = clamp((team.specs?.chassis || team.carPerformance || 80), 55, 99);
  return demand * normCar(chassisStat);
}
function tyresPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.tyreDegradation ?? 5);
  const drivers = Array.isArray(team.drivers) ? team.drivers : [];
  const avgTyre = drivers.length ? drivers.reduce((s, d) => s + (d.tyre || 75), 0) / drivers.length : 75;
  return demand * normCar(clamp(avgTyre, 55, 99));
}
function brakingPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.brakingIntensity ?? 5);
  const drivers = Array.isArray(team.drivers) ? team.drivers : [];
  const avgCraft = drivers.length ? drivers.reduce((s, d) => s + (d.racecraft || 78), 0) / drivers.length : 78;
  return demand * normCar(clamp(avgCraft, 55, 99));
}
function coolingPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.coolingRequirement ?? 5);
  const relStat = clamp((team.specs?.reliability || team.carPerformance || 80), 55, 99);
  return demand * normCar(relStat);
}
function wetPillar(team, circuit) {
  const demand = normCircuit(circuit.perf?.wetWeatherSensitivity ?? 3);
  const drivers = Array.isArray(team.drivers) ? team.drivers : [];
  const avgWet = drivers.length ? drivers.reduce((s, d) => s + (d.wet || 78), 0) / drivers.length : 78;
  return demand * normCar(clamp(avgWet, 55, 99));
}

function computeRawSuitability(team, circuit) {
  if (!circuit.perf) return 0.5;
  const pillars = {
    power:   powerPillar(team, circuit),
    aero:    aeroPillar(team, circuit),
    mech:    mechPillar(team, circuit),
    tyres:   tyresPillar(team, circuit),
    braking: brakingPillar(team, circuit),
    cooling: coolingPillar(team, circuit),
    wet:     wetPillar(team, circuit),
  };
  let weighted = 0;
  for (const [key, weight] of Object.entries(PILLAR_WEIGHTS)) {
    weighted += (pillars[key] || 0) * weight;
  }
  return clamp(weighted, 0, 1);
}

function rawToTimeDelta(raw) {
  return SUITABILITY_AMPLITUDE * (0.5 - raw) * 2;
}

export function computeCircuitSuitability(team, circuitId) {
  const circuit = typeof circuitId === 'string'
    ? CIRCUIT_LIBRARY.find(c => c.circuitId === circuitId)
    : circuitId;

  if (!circuit || !circuit.perf) {
    return {
      suitabilityScore: 50,
      timeDelta: 0,
      pillars: {},
      strengths: [],
      weaknesses: [],
      explanation: circuit
        ? `${circuit.name} — no performance profile, neutral assumed.`
        : 'Circuit not found — neutral assumed.',
    };
  }

  const pillars = {
    Power:   powerPillar(team, circuit),
    Aero:    aeroPillar(team, circuit),
    Mech:    mechPillar(team, circuit),
    Tyres:   tyresPillar(team, circuit),
    Braking: brakingPillar(team, circuit),
    Cooling: coolingPillar(team, circuit),
    Wet:     wetPillar(team, circuit),
  };

  const raw = computeRawSuitability(team, circuit);
  const timeDelta = rawToTimeDelta(raw);
  const suitabilityScore = Math.round(raw * 100);

  const pillarEntries = Object.entries(pillars).sort((a, b) => b[1] - a[1]);
  const strengths = pillarEntries.filter(([, v]) => v > 0.52).slice(0, 2).map(([k]) => k);
  const weaknesses = pillarEntries.filter(([, v]) => v < 0.48).slice(-2).reverse().map(([k]) => k);

  const direction = timeDelta < -0.3 ? 'expected to perform well'
    : timeDelta > 0.3 ? 'likely to struggle'
    : 'expected to be competitive';

  let explanation = `${team.name || 'This team'} is ${direction} at ${circuit.name}.`;
  if (strengths.length > 0) explanation += ` Strengths: ${strengths.join(', ')}.`;
  if (weaknesses.length > 0) explanation += ` Challenges: ${weaknesses.join(', ')}.`;

  return { suitabilityScore, timeDelta, pillars, strengths, weaknesses, explanation };
}

export function applyCircuitSuitability(baseLapTime, team, circuit) {
  const { timeDelta } = computeCircuitSuitability(team, circuit);
  return baseLapTime + timeDelta;
}

export function rankTeamsBySuitability(teams, circuit) {
  return teams
    .map(team => ({ team, ...computeCircuitSuitability(team, circuit) }))
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}
