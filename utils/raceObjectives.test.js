import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../state.js';
import { calendar } from '../data/calendar.js';
import {
  generateRaceObjectives, getWeekendWeather, evaluateObjective, getCircuitHistoryStats,
} from './raceObjectives.js';
import { ensureFinanceState } from './financeSystem.js';
import { ensureEngineeringState } from './engineeringSystem.js';

const bahrain = calendar.find((t) => t.name === 'Bahrain Grand Prix');
const monaco = calendar.find((t) => t.name === 'Monaco Grand Prix');
const SIMS = 150;

/** Make AI team `name` the player's team. */
function playAs(name) {
  resetAiTeams();
  const team = state.aiTeams.find((t) => t.name === name);
  state.aiTeams = state.aiTeams.filter((t) => t !== team);
  state.team = team;
  state.season = { year: 1, round: 4, totalRounds: 24, currentDay: 1, calendar: [...calendar], rules: { weather: true } };
  state.standings = { drivers: {}, teams: {} };
  state.raceHistory = [];
  state.weekendProgress = null;
  state.finance = undefined;
  state.engineering = undefined;
  ensureFinanceState(state);
  ensureEngineeringState(state);
  return team;
}

const primaryOf = (o) => o.objectives.find((x) => x.type === 'primary');
const gridWith = (teamName, slot) => {
  const all = [state.team, ...state.aiTeams].flatMap((t) => t.drivers.map((d) => ({ driver: d, team: t })));
  const ours = all.filter((g) => g.team.name === teamName);
  const rest = all.filter((g) => g.team.name !== teamName);
  rest.splice(slot - 1, 0, ...ours);
  return rest;
};

test('a stronger team is set a more ambitious target than a weaker one at the same track', () => {
  const merc = primaryOf(generateRaceObjectives(playAs('Mercedes'), bahrain, false, { sims: SIMS }));
  const aston = primaryOf(generateRaceObjectives(playAs('Aston Martin'), bahrain, false, { sims: SIMS }));
  assert.ok(merc.targetPosition < aston.targetPosition, `Mercedes P${merc.targetPosition} vs Aston P${aston.targetPosition}`);
  // The primary target is pitched where the odds are meaningful
  assert.ok(merc.successProbability >= 40 && aston.successProbability >= 40);
});

test('success probabilities are simulated frequencies and follow the grid', () => {
  const team = playAs('Alpine');
  const front = generateRaceObjectives(team, bahrain, false, { sims: SIMS, grid: gridWith('Alpine', 1) });
  const back = generateRaceObjectives(team, bahrain, false, { sims: SIMS, grid: gridWith('Alpine', 19) });
  assert.ok(front.finishDistribution.expectedFinish < back.finishDistribution.expectedFinish,
    `from the front P${front.finishDistribution.expectedFinish}, from the back P${back.finishDistribution.expectedFinish}`);
  assert.ok(front.forecast.usesGrid && back.forecast.usesGrid);
  assert.match(primaryOf(front).rationale, /simulated races/);
});

test('track conditions: hard-to-pass circuits ask us to hold position, easier ones to gain places', () => {
  // Haas starting out of position, behind slower cars
  const team = playAs('Haas');
  const mon = generateRaceObjectives(team, monaco, false, { sims: SIMS, grid: gridWith('Haas', 15) });
  const bah = generateRaceObjectives(team, bahrain, false, { sims: SIMS, grid: gridWith('Haas', 15) });
  assert.ok(mon.objectives.some((o) => o.id === 'protect-position'));
  assert.ok(!mon.objectives.some((o) => o.id === 'gain-positions'));
  assert.ok(bah.objectives.some((o) => o.id === 'gain-positions'));
  // ...but nobody is asked to gain places from pole
  const pole = generateRaceObjectives(team, bahrain, false, { sims: SIMS, grid: gridWith('Haas', 1) });
  assert.ok(!pole.objectives.some((o) => o.id === 'gain-positions'));
});

test('weather: a forecast before qualifying, qualifying weather after, stable between calls', () => {
  playAs('Ferrari');
  const spa = calendar.find((t) => t.name === 'Belgian Grand Prix');
  const before = getWeekendWeather(state, spa);
  assert.equal(before.known, false);
  assert.equal(before.rainProbability, 40);
  assert.deepEqual(getWeekendWeather(state, spa), before, 'no random re-roll');

  state.weekendProgress = { round: spa.round, qualifyingComplete: true, isWet: true };
  const after = getWeekendWeather(state, spa);
  assert.equal(after.known, true);
  assert.equal(after.isWet, true);

  state.season.rules.weather = false;
  state.weekendProgress = null;
  assert.equal(getWeekendWeather(state, spa).rainProbability, 0);
});

test('a known wet race changes the forecast and is explained', () => {
  const team = playAs('Ferrari');
  const wet = generateRaceObjectives(team, bahrain, true, { sims: SIMS });
  assert.ok(wet.objectives.some((o) => /wet race/i.test(o.rationale)));
});

test("the player's engineering upgrades raise the forecast", () => {
  const team = playAs('Haas');
  const base = generateRaceObjectives(team, bahrain, false, { sims: SIMS });
  Object.keys(state.engineering.carSpecs).forEach((k) => {
    if (typeof state.engineering.carSpecs[k] === 'number' && !['dragRatio', 'pitStopTime', 'pitErrorRate'].includes(k)) state.engineering.carSpecs[k] += 6;
  });
  const upgraded = generateRaceObjectives(team, bahrain, false, { sims: SIMS });
  assert.ok(upgraded.forecast.expectedBest < base.forecast.expectedBest - 0.5,
    `before P${base.forecast.expectedBest.toFixed(1)}, after P${upgraded.forecast.expectedBest.toFixed(1)}`);
});

test('objectives are judged the way they were set', () => {
  const team = playAs('McLaren');
  const [a, b] = team.drivers;
  const res = (drivers) => drivers.map(([d, t, retired = false]) => ({ driver: d, team: t, retired }));
  const other = state.aiTeams[0];
  const rival = state.aiTeams[1];
  const grid = [{ driver: other.drivers[0] }, { driver: rival.drivers[0] }, { driver: a }, { driver: b }];

  const results = res([[a, team], [other.drivers[0], other], [rival.drivers[0], rival], [b, team, true]]);
  const judge = (evaluation, extra = {}) => evaluateObjective({ evaluation, ...extra }, results, grid, team).status;

  assert.equal(judge({ kind: 'bestPos', target: 1 }), 'Achieved');
  assert.equal(judge({ kind: 'bothPos', target: 10 }), 'Partially Achieved', 'one car retired');
  assert.equal(judge({ kind: 'beatTeam', team: rival.name }), 'Achieved');
  assert.equal(judge({ kind: 'gain', positions: 2 }), 'Achieved', 'P3 on the grid to P1');
  assert.equal(judge({ kind: 'classified' }), 'Partially Achieved');
});

test('circuit history reads our real results from race history', () => {
  const team = playAs('Mercedes');
  state.raceHistory = [{
    circuit: bahrain.circuit, round: 4, season: 1,
    driverResults: [
      { name: team.drivers[0].name, team: team.name, finishPos: 2, retired: false },
      { name: team.drivers[1].name, team: team.name, finishPos: 18, retired: true },
    ],
  }];
  const h = getCircuitHistoryStats(bahrain.circuit, team.name);
  assert.equal(h.sampleSize, 1);
  assert.equal(h.bestFinish, 2);
  assert.equal(h.dnfRate, 50);
});
