#!/usr/bin/env node
/**
 * End-to-end check of the strategy model in the real live race engine.
 *
 *   npm run eval:strategy            (RACES=120 by default)
 *
 * For each race: pick a held-out circuit and one team as "ours", put the race
 * engineer on auto for both cars, and run the full race in LiveRaceEngine
 * twice: once with pit calls from the time-only planner, once from the
 * strategy model. Both runs start from the same random seed (Math.random is
 * replaced by a seeded generator), so the comparison is paired.
 *
 * Reports the average finishing position of our cars under each brain and
 * the paired difference with its standard error.
 */
import { calendar } from '../data/calendar.js';
import { state, resetAiTeams } from '../state.js';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { RaceEngineer } from '../game/RaceEngineer.js';
import { mulberry32 } from '../game/setup/carSetup.js';
import { strategyModelMetrics } from '../game/strategy/strategyModel.js';

const RACES = Number(process.env.RACES || 120);
const holdout = calendar.filter((t) => strategyModelMetrics.holdoutCircuits.includes(t.name));
const realRandom = Math.random;

function runRace(track, teamIdx, brain, seed) {
  Math.random = mulberry32(seed);
  try {
    resetAiTeams();
    state.season = { year: 1, rules: { weather: false } };
    const me = state.aiTeams[teamIdx];
    const strat = Object.fromEntries(me.drivers.map((d) => [d.name, 'auto']));
    const e = new LiveRaceEngine(state.aiTeams, track, track.laps, null, strat, null);
    if (e.isWet) return null; // the model only covers dry races; both runs share the seed, so both are wet
    const eng = new RaceEngineer(e, { objective: 'points', strategyBrain: brain });
    e.cars.filter((c) => c.isPlayer).forEach((c) => eng.setAuto(c.id, true));
    let guard = 0;
    while (!e.raceCompleted && guard++ < 20000) { e.tick(1.0); eng.update(); }
    const res = e.finalClassification.results;
    return res
      .map((r, i) => ({ r, pos: i + 1 }))
      .filter(({ r }) => r.team.name === me.name)
      .map(({ r, pos }) => (r.retired ? null : pos))
      .filter((p) => p != null);
  } finally {
    Math.random = realRandom;
  }
}

const diffs = [];
let sumPlanner = 0;
let sumModel = 0;
let n = 0;
const t0 = Date.now();
for (let i = 0; i < RACES; i++) {
  const track = holdout[i % holdout.length];
  const teamIdx = 2 + (i % 8); // midfield-heavy: where strategy changes results most
  const seed = 1000 + i;
  const a = runRace(track, teamIdx, 'planner', seed);
  const b = runRace(track, teamIdx, 'model', seed);
  if (!a || !b || a.length !== b.length || a.length === 0) continue; // a retirement in one run only: skip the pair
  const meanA = a.reduce((x, y) => x + y, 0) / a.length;
  const meanB = b.reduce((x, y) => x + y, 0) / b.length;
  sumPlanner += meanA;
  sumModel += meanB;
  diffs.push(meanA - meanB);
  n++;
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${RACES} races (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
const mean = diffs.reduce((x, y) => x + y, 0) / n;
const sd = Math.sqrt(diffs.reduce((x, d) => x + (d - mean) ** 2, 0) / Math.max(1, n - 1));
const se = sd / Math.sqrt(n);
const wins = diffs.filter((d) => d > 0).length;
const losses = diffs.filter((d) => d < 0).length;
console.log(JSON.stringify({
  pairedRaces: n,
  circuits: holdout.map((t) => t.name),
  avgFinishPlanner: Number((sumPlanner / n).toFixed(2)),
  avgFinishModel: Number((sumModel / n).toFixed(2)),
  placesGainedPerCar: Number(mean.toFixed(3)),
  standardError: Number(se.toFixed(3)),
  modelBetter: wins,
  plannerBetter: losses,
  same: n - wins - losses,
}, null, 2));
