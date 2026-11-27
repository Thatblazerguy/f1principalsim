import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiTeams } from '../data/teams.js';
import { drivers } from '../data/drivers.js';
import { calendar } from '../data/calendar.js';
import { Team } from '../game/team.js';
import { state } from '../state.js';
import { ensureMarket } from '../game/transferMarket.js';
import { ensureFinanceState } from './financeSystem.js';
import { getRoundRaceDay, canSimulateNextDay } from './seasonTimeline.js';
import {
  getCalendarEvents, simulateSeasonDay, runSeasonDays, getTargetDay, dayKind, getArrivalBriefing, ensureSeasonSim,
} from './seasonSimulation.js';

function fresh({ round = 2 } = {}) {
  state.team = new Team('Test GP', 200, 88);
  ['Zhou Guanyu', 'Nyck de Vries'].forEach((n) => {
    const d = drivers.find((x) => x.name === n);
    d.contractYearsRemaining = 2;
    state.team.signDriver(d);
  });
  state.team.car = { aero: 3, engine: 3, chassis: 3, reliability: 3 };
  state.team.pendingUpgrades = [];
  state.aiTeams = createAiTeams();
  const raceDay = getRoundRaceDay(round - 1);
  state.season = { round, year: 1, totalRounds: 24, currentDay: raceDay, calendar: [...calendar] };
  state.weekendProgress = null;
  state.standings = { drivers: {}, teams: {} };
  state.raceHistory = [];
  state.transferMarket = undefined;
  state.finance = undefined;
  state.seasonSim = undefined;
  state.raceWeekend = null;
  state.academy = { level: 1, prospects: [], loanedOut: [], scouts: [] };
  ensureMarket(state);
  ensureFinanceState(state);
}

test('calendar is built from the season calendar and live projects', () => {
  fresh();
  const raceDay = getRoundRaceDay(2);
  state.team.pendingUpgrades.push({ id: 'aero-x', part: 'aero', cost: 1, requestedDay: raceDay - 13, readyDay: raceDay - 5 });
  const events = getCalendarEvents(state, raceDay - 13, raceDay);
  assert.equal(events[raceDay].find((e) => e.type === 'race').title, calendar[1].name);
  assert.ok(events[raceDay - 1].some((e) => e.type === 'qualifying'));
  assert.ok(events[raceDay - 2].some((e) => e.type === 'practice'));
  assert.ok(events[raceDay - 5].some((e) => e.key === 'upg:aero-x'));
  assert.equal(dayKind(state, raceDay), 'race');
  assert.equal(dayKind(state, raceDay - 7), 'rest');
});

test('runs through the shared tick and stops at the race weekend', () => {
  fresh();
  const raceDay = getRoundRaceDay(2);
  assert.equal(getTargetDay(state, 'race'), raceDay);
  const log = runSeasonDays(state, 100);
  assert.equal(state.season.currentDay, raceDay);
  assert.ok(log.at(-1).arrived);
  assert.equal(canSimulateNextDay(state), false);
  assert.equal(simulateSeasonDay(state).advanced, false);
});

test('pausing and resuming gives the same days and never repeats feed items', () => {
  fresh();
  runSeasonDays(state, 3);
  runSeasonDays(state, 2);
  runSeasonDays(state, 100);
  const split = state.seasonSim.feed.map((f) => f.key).sort();
  const day = state.season.currentDay;

  fresh();
  runSeasonDays(state, 100);
  const straight = state.seasonSim.feed.map((f) => f.key).sort();
  assert.equal(state.season.currentDay, day);
  assert.deepEqual(split, straight);
  assert.equal(new Set(straight).size, straight.length, 'feed keys are unique');
});

test('completed upgrades surface as important and apply through the existing system', () => {
  fresh();
  const start = state.season.currentDay;
  state.team.pendingUpgrades.push({ id: 'eng-1', part: 'engine', cost: 1, requestedDay: start - 4, readyDay: start + 2 });
  const log = runSeasonDays(state, 20, { stopOnImportant: true });
  assert.equal(state.season.currentDay, start + 2);
  assert.ok(log.at(-1).important);
  assert.equal(state.team.car.engine, 4);
  assert.equal(state.team.pendingUpgrades.length, 0);
  assert.ok(state.seasonSim.feed.some((f) => f.key === 'done:upg:eng-1'));
});

test('weather forecast comes from the round weekend data', () => {
  fresh();
  runSeasonDays(state, 100);
  const wx = state.seasonSim.feed.find((f) => f.type === 'weather');
  assert.ok(wx);
  assert.match(wx.detail, new RegExp(`${state.raceWeekend.weather.rainProbability}% chance`));
  const brief = getArrivalBriefing(state);
  assert.equal(brief.round, 2);
  assert.equal(brief.weather, state.raceWeekend.weather);
});

test('rival development is reported only from real spec changes', () => {
  fresh();
  ensureSeasonSim(state);
  const rival = state.aiTeams[0];
  rival.specs = { ...(rival.specs || {}), aero: (rival.specs?.aero || 80) + 0.6 };
  state.season.round = 3; // a race was completed since the snapshot
  state.season.currentDay = getRoundRaceDay(2) + 1;
  simulateSeasonDay(state);
  const item = state.seasonSim.feed.find((f) => f.type === 'rival' && f.team === rival.name);
  assert.ok(item);
  assert.match(item.detail, /aero \+0\.6/);
});
