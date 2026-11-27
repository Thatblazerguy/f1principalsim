// Season rollover regression tests: AI development uses the final standings,
// AI car OVR is clamped and does not pile up at the cap, ATR allowance exists
// for every finishing position, drivers follow an age curve, contracts tick
// exactly once per rollover, and prize money follows the official order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../state.js';
import { drivers } from '../data/drivers.js';
import { calendar } from '../data/calendar.js';
import { Team } from '../game/team.js';
import { Driver } from '../game/driver.js';
import { ensureMarket } from '../game/transferMarket.js';
import { processAiTeamDevelopment, getAiUpgradeChance } from '../game/development.js';
import {
  AI_OVR_CAP,
  getAtrMultiplier,
  developAiCars,
  developAiCar,
  progressDriver,
  ageCurveDelta,
  processEndOfSeasonFinancials,
  getFinalConstructorOrder,
  runSeasonEnd,
  applySeasonRollover,
  DRIVER_STAT_KEYS,
} from '../game/seasonRollover.js';

/** Deterministic PRNG (mulberry32). */
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fresh() {
  resetAiTeams();
  state.team = new Team('Test GP', 200, 85);
  ['Zhou Guanyu', 'Nyck de Vries'].forEach((n) => {
    const d = drivers.find((x) => x.name === n);
    d.contractYearsRemaining = 2;
    state.team.signDriver(d);
  });
  state.team.activeDrivers = state.team.drivers.map((d) => d.name);
  state.season = { round: 24, year: 1, totalRounds: 24, currentDay: 300, calendar: [...calendar] };
  state.standings = { drivers: {}, teams: {} };
  state.raceHistory = [];
  state.notifications = [];
  state.transferMarket = undefined;
  state.finance = undefined;
  state.seasonRolloverYear = undefined;
  state.academy = { level: 1, prospects: [], loanedOut: [], scouts: [], facilities: { simulator: 1, fitness: 1, coaching: 1, sportsPsychology: 1 } };
  ensureMarket(state);
  return state;
}

/** Legacy-style standings: points only, in the given order (first = champion). */
function setStandings(order) {
  state.standings.teams = Object.fromEntries(order.map((name, i) => [name, (order.length - i) * 20]));
}

function withRandom(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = orig; }
}

const facilityTotal = (t) => Object.values(t.finance?.facilities || {}).reduce((s, f) => s + (f.level - 1), 0);

// ─── 1. AI development uses the final standings ──────────────────────────────

test('AI facility development follows the final classification, not cleared standings', () => {
  fresh();
  const champ = state.aiTeams.find((t) => t.name === 'Aston Martin');
  const last = state.aiTeams.find((t) => t.name === 'Mercedes');
  const order = [champ.name, ...state.aiTeams.filter((t) => t !== champ && t !== last).map((t) => t.name), state.team.name, last.name];
  assert.equal(getAiUpgradeChance(1), 0.8);
  assert.equal(getAiUpgradeChance(order.length), 0.3);

  // Standings already cleared (as after the reset): the snapshot still decides.
  state.standings = { drivers: {}, teams: {} };
  withRandom(0.6, () => processAiTeamDevelopment(state, order));
  assert.equal(facilityTotal(champ), 1, 'champion (80% chance) upgraded a facility');
  assert.equal(facilityTotal(last), 0, 'last place (30% chance) did not');
});

test('rollover snapshots final standings before reset and runs once', () => {
  fresh();
  const names = state.aiTeams.map((t) => t.name);
  const order = [...names].reverse().concat(state.team.name); // Aston Martin champions
  setStandings(order);
  assert.deepEqual(getFinalConstructorOrder(state).slice(0, 3), order.slice(0, 3));

  const champ = state.aiTeams.find((t) => t.name === order[0]);
  const lastAi = state.aiTeams.find((t) => t.name === order[order.length - 2]);
  withRandom(0.6, () => applySeasonRollover(state));
  assert.equal(champ.atrMultiplier, 0.70, 'champion gets the smallest ATR allowance');
  assert.ok(lastAi.atrMultiplier > 1.1, 'a backmarker gets a big ATR allowance');
  assert.equal(facilityTotal(champ), 1);
  assert.equal(facilityTotal(lastAi), 0);
  assert.equal(state.season.finalClassification.teams[0], order[0]);

  const perf = state.aiTeams.map((t) => t.carPerformance);
  assert.equal(applySeasonRollover(state).processed, false, 'guarded per season');
  assert.deepEqual(state.aiTeams.map((t) => t.carPerformance), perf);
});

// ─── 2. OVR clamp and convergence ────────────────────────────────────────────

test('AI car OVR stays under the cap over 10 seasons and the field keeps a spread', () => {
  fresh();
  const rng = rngFrom(42);
  for (let season = 0; season < 10; season++) {
    const order = [...state.aiTeams].sort((a, b) => b.carPerformance - a.carPerformance).map((t) => t.name);
    developAiCars(state, order, rng);
    for (const t of state.aiTeams) {
      assert.ok(t.carPerformance <= AI_OVR_CAP, `${t.name} ${t.carPerformance}`);
      assert.equal(t.specs.ovr, t.carPerformance, `${t.name} specs.ovr in step`);
      for (const k of ['aero', 'chassis', 'reliability']) assert.ok(t.specs[k] <= 99 && t.specs[k] >= 40);
    }
  }
  const perf = state.aiTeams.map((t) => t.carPerformance);
  const atCap = perf.filter((p) => p >= AI_OVR_CAP - 0.5).length;
  assert.ok(atCap < perf.length / 2, `not everyone at the cap (${atCap})`);
  assert.ok(Math.max(...perf) - Math.min(...perf) >= 3, `field spread ${Math.max(...perf) - Math.min(...perf)}`);
});

test('a car at the cap cannot pass it even with maximum development', () => {
  const t = new Team('Cap', 0, AI_OVR_CAP - 0.1);
  t.specs = { aero: 98, chassis: 97, reliability: 96, ovr: AI_OVR_CAP - 0.1 };
  t.devBaseline = AI_OVR_CAP;
  for (let i = 0; i < 20; i++) developAiCar(t, 1.25, () => 0.9999);
  assert.ok(t.carPerformance <= AI_OVR_CAP);
});

// ─── 3. ATR for every position ───────────────────────────────────────────────

test('ATR multiplier is defined and increasing for every position with 11 teams', () => {
  const values = Array.from({ length: 11 }, (_, i) => getAtrMultiplier(i, 11));
  values.forEach((v, i) => assert.ok(Number.isFinite(v), `P${i + 1}`));
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1], `P${i + 1} > P${i}`);
  assert.equal(values[0], 0.70);
  assert.equal(Math.max(...values), values[10], 'last place gets the biggest allowance');
  // Never decreasing for any team count
  for (const n of [2, 10, 12, 20]) {
    for (let i = 1; i < n; i++) assert.ok(getAtrMultiplier(i, n) >= getAtrMultiplier(i - 1, n));
  }
});

test('end-of-season finance gives the 11th team the largest ATR', () => {
  fresh();
  state.aiTeams = state.aiTeams.slice(0, 10); // player + 10 AI = 11 teams
  const order = [state.team.name, ...state.aiTeams.map((t) => t.name)];
  setStandings(order);
  processEndOfSeasonFinancials(state);
  const last = state.aiTeams[state.aiTeams.length - 1];
  assert.equal(last.atrMultiplier, 1.20);
  for (const t of state.aiTeams.slice(0, -1)) assert.ok(t.atrMultiplier < last.atrMultiplier);
});

// ─── 4. Age curve ────────────────────────────────────────────────────────────

function averageChange(age, percentile, trials = 300) {
  const rng = rngFrom(age * 1000 + Math.round(percentile * 100));
  let sum = 0;
  for (let i = 0; i < trials; i++) {
    const d = new Driver('X', 75, 75, 75, 75, 75, 75, 50, 5, age, 'F1');
    d.potentialCeiling = 95;
    sum += progressDriver(d, { percentile, rng });
  }
  return sum / trials;
}

test('young drivers improve, veterans decline, even a 40-year-old champion', () => {
  assert.ok(ageCurveDelta(20) > ageCurveDelta(28));
  assert.ok(ageCurveDelta(37) < ageCurveDelta(34));
  assert.ok(averageChange(20, 0.5) > 1, 'a 20-year-old midfielder improves');
  assert.ok(averageChange(38, 0.5) < -0.5, 'a 38-year-old midfielder declines');
  assert.ok(averageChange(40, 1) < 0, 'a 40-year-old champion declines');
  assert.ok(averageChange(28, 1) > averageChange(28, 0.05), 'results still matter at the peak');
});

test('driver progression ages once and keeps ratings in bounds', () => {
  const rng = rngFrom(7);
  const star = new Driver('Star', 98.9, 98.9, 98.9, 98.9, 98.9, 98.9, 99, 30, 19, 'F1');
  star.potentialCeiling = 99;
  const old = new Driver('Old', 40.2, 40.2, 40.2, 40.2, 40.2, 40.2, 10, 1, 44, 'F1');
  for (let i = 0; i < 10; i++) { progressDriver(star, { percentile: 1, rng }); progressDriver(old, { percentile: 0, rng }); }
  for (const k of DRIVER_STAT_KEYS) {
    assert.ok(star[k] <= 99, `star ${k} ${star[k]}`);
    assert.ok(old[k] >= 40, `old ${k} ${old[k]}`);
  }
  assert.equal(star.age, 29);
});

// ─── 5. Contracts tick once ──────────────────────────────────────────────────

test('every contract decrements exactly once per season rollover', () => {
  fresh();
  for (const t of state.aiTeams) t.budget = 0; // no AI transfer swaps in this test
  const rostered = [state.team, ...state.aiTeams].flatMap((t) => [...t.drivers, ...(t.reserveDriver ? [t.reserveDriver] : [])]);
  rostered.forEach((d) => { d.contractYearsRemaining = 3; });

  const prospect = new Driver('Academy Kid', 60, 60, 60, 60, 60, 60, 10, 0.5, 17, 'F2');
  prospect.contractYearsRemaining = 3;
  const loaned = new Driver('Loan Kid', 62, 62, 62, 62, 62, 62, 10, 0.5, 18, 'F2');
  loaned.contractYearsRemaining = 3;
  loaned.loanStatus = { destination: 'none', seasonYear: 99 };
  state.academy.prospects.push(prospect);
  state.academy.loanedOut.push(loaned);
  setStandings([...state.aiTeams.map((t) => t.name), state.team.name]);

  // The offseason screen can open several times; the player can click twice.
  runSeasonEnd(state);
  runSeasonEnd(state);
  applySeasonRollover(state);
  applySeasonRollover(state);

  const stillRostered = rostered.filter((d) => [state.team, ...state.aiTeams].some((t) => t.hasDriver(d.name)));
  assert.ok(stillRostered.length > 15, 'most drivers kept their seats');
  stillRostered.forEach((d) => assert.equal(d.contractYearsRemaining, 2, `${d.name}`));
  assert.equal(prospect.contractYearsRemaining, 2, 'academy prospect');
  assert.equal(loaned.contractYearsRemaining, 2, 'loaned driver');
});

// ─── 7. Prize money follows count-back ───────────────────────────────────────

test('prize money uses the official classification with count-back', () => {
  fresh();
  const audi = state.aiTeams.find((t) => t.name === 'Audi');
  const williams = state.aiTeams.find((t) => t.name === 'Williams');
  const [a1] = audi.drivers;
  const [w1, w2] = williams.drivers;
  // Tied on 25 points; Audi has a win, Williams has a P3 and a P5.
  state.raceHistory = [
    { season: 1, round: 1, name: 'R1', circuit: 'c1', driverResults: [{ name: a1.name, team: 'Audi', finishPos: 1, points: 25 }] },
    { season: 1, round: 2, name: 'R2', circuit: 'c2', driverResults: [
      { name: w1.name, team: 'Williams', finishPos: 3, points: 15 },
      { name: w2.name, team: 'Williams', finishPos: 5, points: 10 },
    ] },
  ];
  state.standings.teams = { Audi: 25, Williams: 25 };
  const order = getFinalConstructorOrder(state);
  assert.ok(order.indexOf('Audi') < order.indexOf('Williams'), 'Audi ahead on count-back');

  const audiBefore = audi.budget || 0;
  const williamsBefore = williams.budget || 0;
  const { changed } = processEndOfSeasonFinancials(state);
  assert.equal(changed, true);
  assert.ok(audi.budget - audiBefore > williams.budget - williamsBefore, 'Audi gets the bigger payout');
  assert.ok(audi.atrMultiplier < williams.atrMultiplier);
  assert.equal(processEndOfSeasonFinancials(state).changed, false, 'paid once per season');
});
