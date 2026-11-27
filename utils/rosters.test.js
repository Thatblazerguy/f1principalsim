import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiTeams, reconcileRosters } from '../data/teams.js';
import { drivers } from '../data/drivers.js';
import { Team } from '../game/team.js';
import { state, getSerializedState, hydrateState } from '../state.js';

function allNames(player, ai) {
  const names = [];
  for (const t of [player, ...ai]) {
    t.drivers.forEach(d => names.push(d.name));
    if (t.reserveDriver) names.push(t.reserveDriver.name);
  }
  return names;
}

function playerWith(...names) {
  const team = new Team('My Team', 50, 90);
  names.forEach(n => team.signDriver(drivers.find(d => d.name === n)));
  return team;
}

test('player drivers are removed from AI teams and seats are refilled', () => {
  const ai = createAiTeams();
  const player = playerWith('Charles Leclerc', 'Lewis Hamilton');
  const changes = reconcileRosters(player, ai);

  const ferrari = ai.find(t => t.name === 'Ferrari');
  assert.ok(changes.some(c => c.removed === 'Charles Leclerc'));
  assert.ok(!ferrari.drivers.some(d => ['Charles Leclerc', 'Lewis Hamilton'].includes(d.name)));
  assert.equal(ferrari.drivers.length, 2, 'Ferrari still fields two race drivers');

  const names = allNames(player, ai);
  assert.equal(new Set(names).size, names.length, 'no driver appears twice');
});

test('reconcile is a no-op when rosters are already clean', () => {
  const ai = createAiTeams();
  const player = playerWith('Charles Leclerc', 'Lewis Hamilton');
  reconcileRosters(player, ai);
  assert.equal(reconcileRosters(player, ai).length, 0);
});

test('loading a save repairs duplicates and restores every saved system', () => {
  state.team = playerWith('Charles Leclerc', 'Lewis Hamilton');
  state.aiTeams = createAiTeams(); // deliberately duplicated: AI Ferrari still has both
  state.engineering = { driverPools: { x: 1 }, pendingPenalties: {}, reports: ['kept'] };
  state.setupLab = { samples: { 'Albert Park Circuit': [{ x: [0], y: 0.1 }] }, weekend: null };
  const saved = getSerializedState();

  state.engineering = null;
  state.setupLab = null;
  assert.ok(hydrateState(saved));

  const names = allNames(state.team, state.aiTeams);
  assert.equal(new Set(names).size, names.length, 'no duplicate drivers after load');
  assert.deepEqual(state.engineering.reports, ['kept']);
  assert.equal(state.setupLab.samples['Albert Park Circuit'].length, 1);
});
