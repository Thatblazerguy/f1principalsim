// Regression tests for the Tier 1 audit fixes: ERS battery direction, emergency
// finance limits and loan repayment, save compaction and per-user save slots,
// and player car rating parity with the AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../state.js';
import { calendar } from '../data/calendar.js';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { Team } from '../game/team.js';
import { getCarSpecs } from './simTeam.js';
import { ensureEngineeringState } from './engineeringSystem.js';
import {
  ensureFinanceState,
  applyEmergencyFinanceAction,
  getEmergencyActionAvailability,
  processRaceFinance,
} from './financeSystem.js';
import { compactSave, saveGame, loadGame, REPLAYS_KEPT } from './storage.js';
import { getSessionState } from './weekendModel.js';

const track = calendar[3];

function freshPlayerState() {
  resetAiTeams();
  const team = new Team('Test Racing', 100, 90);
  team.specs = { aero: 91, chassis: 90, reliability: 89, ovr: 90 };
  state.team = team;
  state.season = { round: 1, year: 1, rules: { weather: false } };
  state.finance = undefined;
  state.engineering = undefined;
  ensureFinanceState(state);
  ensureEngineeringState(state);
  return team;
}

// ─── ERS ──────────────────────────────────────────────────────────────────

function ersAfter(mode, startErs) {
  resetAiTeams();
  state.season = { year: 1, rules: { weather: false } };
  const me = state.aiTeams[0];
  const strat = Object.fromEntries(me.drivers.map((d) => [d.name, 'str_4_1']));
  const e = new LiveRaceEngine(state.aiTeams, track, 20, null, strat, null);
  const car = e.cars.find((c) => c.isPlayer);
  car.ers = startErs;
  e.playerCommand(car.id, 'ERS', mode);
  for (let i = 0; i < 60; i++) { e.tick(1.0); car.ersMode = mode; }
  return car.ers;
}

test('ERS: deploying drains the battery and harvesting recharges it', () => {
  assert.ok(ersAfter('Overtake', 60) < 60, 'Overtake should drain');
  assert.ok(ersAfter('Deploy', 60) < 60, 'Deploy should drain');
  assert.ok(ersAfter('Harvest', 20) > 20, 'Harvest should recharge');
});

// ─── Finance ──────────────────────────────────────────────────────────────

test('emergency finance actions can be used once per season', () => {
  freshPlayerState();
  const before = state.team.budget;
  assert.equal(applyEmergencyFinanceAction(state, 'minority_sale').ok, true);
  const second = applyEmergencyFinanceAction(state, 'minority_sale');
  assert.equal(second.ok, false);
  assert.equal(state.team.budget, before + 55, 'second sale paid nothing');
  assert.equal(getEmergencyActionAvailability(state, 'minority_sale').available, false);

  state.season.year = 2;
  assert.equal(getEmergencyActionAvailability(state, 'minority_sale').available, true, 'resets next season');
});

test('minority stake can never pass 49%', () => {
  freshPlayerState();
  for (let year = 1; year <= 10; year++) {
    state.season.year = year;
    applyEmergencyFinanceAction(state, 'minority_sale');
  }
  assert.ok(state.finance.minorityOwnershipSold <= 49);
  assert.equal(state.finance.emergencyActions.filter((a) => a.id === 'minority_sale').length, 6);
});

test('loans are repaid race by race', () => {
  freshPlayerState();
  applyEmergencyFinanceAction(state, 'loan');
  assert.equal(state.finance.loanBalance, 42);
  const race = { round: 1, season: 1, name: 'Test GP', driverResults: [] };
  const report = processRaceFinance(state, race, 1);
  assert.ok(report.loanRepayment > 0);
  assert.ok(state.finance.loanBalance < 42);
  for (let r = 2; r <= 30; r++) processRaceFinance(state, { ...race, round: r }, r);
  assert.equal(state.finance.loanBalance, 0, 'paid off within the term');
});

test('running in debt keeps costing board confidence', () => {
  freshPlayerState();
  state.team.budget = -50;
  const start = state.finance.boardConfidence;
  for (let r = 1; r <= 3; r++) processRaceFinance(state, { round: r, season: 1, name: 'GP', driverResults: [] }, r);
  assert.ok(state.finance.racesInDebt >= 3);
  assert.ok(state.finance.boardConfidence <= start - 15);
});

// ─── Saves ────────────────────────────────────────────────────────────────

function stubLocalStorage(quotaBytes = Infinity) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > quotaBytes) throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
  };
  return store;
}

test('saves keep full replays only for the latest races', () => {
  const raceHistory = Array.from({ length: 8 }, (_, i) => ({ round: i + 1, replayData: { snapshots: [1, 2, 3] } }));
  const compacted = compactSave({ raceHistory });
  const withReplay = compacted.raceHistory.filter((r) => r.replayData);
  assert.equal(withReplay.length, REPLAYS_KEPT);
  assert.deepEqual(withReplay.map((r) => r.round), [6, 7, 8]);
  assert.ok(raceHistory[0].replayData, 'input not mutated');
});

test('save slots are per user and never shared between accounts', () => {
  stubLocalStorage();
  assert.equal(saveGame({ team: { name: 'Alice GP' } }, 'user-a'), true);
  assert.equal(loadGame('user-a').team.name, 'Alice GP');
  assert.equal(loadGame('user-b'), null);
  assert.ok(loadGame('user-a')._savedAt, 'save is timestamped');
});

test('legacy shared save is only inherited by the offline profile', () => {
  stubLocalStorage();
  localStorage.setItem('f1-save', JSON.stringify({ team: { name: 'Old Save' } }));
  assert.equal(loadGame('offline-user').team.name, 'Old Save');
  assert.equal(loadGame('some-cloud-user'), null);
});

test('a save that exceeds the quota falls back to dropping replays instead of failing', () => {
  stubLocalStorage(5000);
  const bigReplay = { snapshots: 'x'.repeat(3000) };
  const save = { raceHistory: [{ round: 1, replayData: bigReplay }, { round: 2, replayData: bigReplay }] };
  assert.equal(saveGame(save, 'u'), true);
  assert.ok(loadGame('u').raceHistory.every((r) => !r.replayData));
});

// ─── Weekend sessions ─────────────────────────────────────────────────────

test('practice and qualifying report as done once run', () => {
  const open = getSessionState({ raceWindowOpen: true, daysUntilRace: 0, weekendProgress: { qualifyingComplete: false }, practiceRun: false });
  assert.equal(open.practiceDone, false);
  assert.equal(open.qualiDone, false);
  const practiced = getSessionState({ raceWindowOpen: true, daysUntilRace: 0, weekendProgress: { practiceComplete: true }, practiceRun: false });
  assert.equal(practiced.practiceDone, true, 'practice flag survives a reload via weekendProgress');
});

// ─── Player car rating ────────────────────────────────────────────────────

test('player car is rated the same as the AI would rate it at the start', () => {
  const team = freshPlayerState();
  const specs = getCarSpecs(team);
  assert.ok(Math.abs(specs.ovr - team.carPerformance) < 1e-9, `ovr ${specs.ovr} vs ${team.carPerformance}`);
  assert.ok(Math.abs(specs.aero - team.specs.aero) < 1e-9);
});

test('player engineering upgrades change the car rating, even small ones', () => {
  const team = freshPlayerState();
  const before = getCarSpecs(team).ovr;
  state.engineering.carSpecs.cornering += 0.5;
  const after = getCarSpecs(team).ovr;
  assert.ok(after > before, `a +0.5 cornering upgrade should count (${before} -> ${after})`);
});

test('a copy of the player team flagged isPlayerTeam gets the upgrades too', () => {
  const team = freshPlayerState();
  state.engineering.carSpecs.topSpeed += 6;
  const copy = { ...team, isPlayerTeam: true };
  assert.ok(getCarSpecs(copy).ovr > team.carPerformance);
  // An AI team is untouched by the player's engineering
  const ai = state.aiTeams[0];
  assert.equal(getCarSpecs(ai).ovr, ai.carPerformance);
});
