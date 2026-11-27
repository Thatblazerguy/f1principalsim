import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../../state.js';
import { calendar } from '../../data/calendar.js';
import { createAiTeams } from '../../data/teams.js';
import { buildPaceProfile, getOvertakingDifficulty, tyreLife } from '../paceModel.js';
import { mulberry32 } from '../setup/carSetup.js';
import { LiveRaceEngine } from '../LiveRaceEngine.js';
import { RaceEngineer } from '../RaceEngineer.js';
import {
  createStartSnapshot, advanceSnapshot, oracleEvaluate, simulateRest, validActions, STRATEGY_ACTIONS,
} from './strategyRollout.js';
import { encodeState, buildFeatures, FEATURE_COUNT, snapshotFromEngine } from './strategyFeatures.js';
import { predictStrategy, strategyModelMetrics } from './strategyModel.js';

const track = calendar[3]; // Bahrain

function midRaceSnapshot(seed = 1, lap = 20) {
  const rng = mulberry32(seed);
  const entries = createAiTeams().flatMap((t) => t.drivers.map((d) => ({ id: d.name, profile: buildPaceProfile({ team: t, driver: d, track }) })));
  const start = createStartSnapshot({ entries, track, totalLaps: track.laps, difficulty: getOvertakingDifficulty(track), rng });
  return advanceSnapshot(start, lap, rng);
}

test('rollouts are reproducible from their seed', () => {
  const snap = midRaceSnapshot();
  const ego = snap.cars[6].id;
  const a = simulateRest(snap, ego, STRATEGY_ACTIONS[0], mulberry32(42));
  const b = simulateRest(snap, ego, STRATEGY_ACTIONS[0], mulberry32(42));
  assert.equal(a, b);
  assert.equal(snap.lap, 20, 'the input snapshot is not mutated');
});

test('no-stop is only offered once the two-compound rule is met', () => {
  const snap = midRaceSnapshot();
  const car = snap.cars[5];
  car.usedCompounds = ['Medium'];
  assert.ok(!validActions(snap, car.id).some((a) => a.id === 'no_stop'));
  car.usedCompounds = ['Medium', 'Hard'];
  assert.ok(validActions(snap, car.id).some((a) => a.id === 'no_stop'));
});

function wornOutCase() {
  const snap = midRaceSnapshot(3, 25);
  const car = snap.cars[8];
  car.compound = 'Soft';
  car.usedCompounds = ['Medium', 'Soft'];
  car.tyreAge = Math.ceil(tyreLife(car.profile, 'Soft') * 2.2);
  return { snap, id: car.id };
}

test('oracle: on dead tyres with 30 laps left, stopping beats running to the flag', () => {
  const { snap, id } = wornOutCase();
  const evals = Object.fromEntries(oracleEvaluate(snap, id, { rollouts: 12, seed: 5 }).map((e) => [e.action.id, e.expectedPos]));
  assert.ok(evals.box_0 < evals.no_stop, `box now P${evals.box_0} vs no stop P${evals.no_stop}`);
});

test('model: scores every valid option with sane positions, best first', () => {
  const snap = midRaceSnapshot(7, 18);
  const id = snap.cars[10].id;
  const enc = encodeState(snap, id);
  assert.equal(buildFeatures(enc, STRATEGY_ACTIONS[0]).length, FEATURE_COUNT);
  const advice = predictStrategy(snap, id);
  assert.equal(advice.options.length, validActions(snap, id).length);
  advice.options.forEach((o, i) => {
    assert.ok(Number.isFinite(o.expectedPos) && o.expectedPos >= 1 && o.expectedPos <= snap.cars.length + 1, `${o.id} P${o.expectedPos}`);
    if (i > 0) assert.ok(o.expectedPos >= advice.options[i - 1].expectedPos);
  });
  assert.equal(advice.best.id, advice.options[0].id);
});

test('model: on dead tyres it also prefers stopping to running to the flag', () => {
  const { snap, id } = wornOutCase();
  const byId = Object.fromEntries(predictStrategy(snap, id).options.map((o) => [o.id, o.expectedPos]));
  assert.ok(byId.box_0 < byId.no_stop, `box now P${byId.box_0} vs no stop P${byId.no_stop}`);
});

test('trained model beats the time-only planner on held-out circuits', () => {
  const r = strategyModelMetrics.meanRegretPositions;
  assert.ok(r.model < r.engineerTimeOnly, `model regret ${r.model} vs planner ${r.engineerTimeOnly}`);
  assert.ok(r.model < r.random && r.model < r.alwaysBoxNow);
});

test('live race: the engineer briefs with the strategy model and auto-pits with it', () => {
  resetAiTeams();
  state.season = { year: 1, rules: { weather: false } };
  const me = state.aiTeams[4];
  const strat = Object.fromEntries(me.drivers.map((d) => [d.name, 'str_4_1']));
  // Seeded and dry: the strategy model only covers dry races.
  const realRandom = Math.random;
  let seed = 11;
  let e;
  let sawModel = false;
  do {
    Math.random = mulberry32(seed++);
    e = new LiveRaceEngine(state.aiTeams, track, 30, null, strat, null);
  } while (e.isWet);
  try {
    const eng = new RaceEngineer(e, { objective: 'points', strategyBrain: 'model' });
    e.cars.filter((c) => c.isPlayer).forEach((c) => eng.setAuto(c.id, true));
    while (!e.raceCompleted) {
      e.tick(1.0);
      eng.update();
      const c = e.cars.find((x) => x.isPlayer && !x.retired);
      if (c && eng.getBriefing(c.id)?.strategyModel) sawModel = true;
      if (c && !sawModel && e.cars.indexOf(c) >= 0 && Math.floor(c.distance) === 5) {
        const snap = snapshotFromEngine(e, c.id);
        if (snap) assert.ok(snap.cars.every((x, i) => i === 0 || x.time >= snap.cars[i - 1].time), 'snapshot ordered by gap');
      }
    }
  } finally {
    Math.random = realRandom;
  }
  assert.ok(sawModel, 'briefing carried strategy model advice');
  e.finalClassification.results
    .filter((r) => r.team.name === me.name && !r.retired)
    .forEach((r) => assert.ok(r.stints.length >= 2, `${r.driver.name} stopped at least once`));
});
