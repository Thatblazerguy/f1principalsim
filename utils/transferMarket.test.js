import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiTeams } from '../data/teams.js';
import { drivers } from '../data/drivers.js';
import { calendar } from '../data/calendar.js';
import { Team } from '../game/team.js';
import { state, getSerializedState, hydrateState } from '../state.js';
import {
  ensureMarket, assessInterest, sellingStance, personalDemands, offerPersonalTerms, bidTransferFee,
  completeSigning, dealBlockers, agreePreContract, preContractEligibility, processMarketSeasonEnd,
  processMarketDay, assignScout, scoutLevel, findDriver, contractedDrivers,
} from '../game/transferMarket.js';

function fresh({ round = 1, budget = 200 } = {}) {
  state.team = new Team('Test GP', budget, 88);
  ['Zhou Guanyu', 'Nyck de Vries'].forEach((n) => {
    const d = drivers.find((x) => x.name === n);
    d.contractYearsRemaining = 2;
    state.team.signDriver(d);
  });
  state.team.activeDrivers = state.team.drivers.map((d) => d.name);
  state.aiTeams = createAiTeams();
  state.season = { round, year: 1, totalRounds: 24, currentDay: 1 + (round - 1) * 14, calendar: [...calendar] };
  state.standings = { drivers: {}, teams: {} };
  state.raceHistory = [];
  state.transferMarket = undefined;
  state.finance = undefined;
  state.academy = { level: 1, prospects: [], loanedOut: [], scouts: [] };
  ensureMarket(state);
}

test('interest is deterministic, bounded and explained', () => {
  fresh();
  const a = assessInterest(state, 'Lando Norris');
  const b = assessInterest(state, 'Lando Norris');
  assert.equal(a.score, b.score);
  assert.ok(a.score >= 0 && a.score <= 100);
  Object.values(a.components).forEach((v) => assert.ok(v >= 0 && v <= 100));
  assert.ok(a.reasons.length > 0);
});

test('a contracted driver cannot be signed without an agreed fee', () => {
  fresh();
  const name = 'Lance Stroll';
  const dem = personalDemands(state, name);
  offerPersonalTerms(state, name, { salary: dem.salary + 5, bonus: dem.bonus + 2, years: 2, role: 'reserve' });
  const blockers = dealBlockers(state, name);
  assert.ok(blockers.some((b) => /transfer fee/i.test(b)));
  assert.equal(completeSigning(state, name).ok, false);
});

test('longer contracts cost more to buy out', () => {
  fresh();
  const name = 'Pierre Gasly';
  const l = findDriver(state, name);
  l.driver.contractYearsRemaining = 1;
  const one = sellingStance(state, name).fee;
  l.driver.contractYearsRemaining = 3;
  const three = sellingStance(state, name).fee;
  assert.ok(three > one, `${three} should exceed ${one}`);
});

test('a full transfer moves the driver and the money', () => {
  fresh({ budget: 300 });
  state.team.releaseDriver('Nyck de Vries');
  const name = 'Franco Colapinto';
  const l = findDriver(state, name);
  const seller = l.team;
  l.driver.contractYearsRemaining = 1;
  state.transferMarket.relations[seller.name] = 100;
  const st = sellingStance(state, name);
  assert.notEqual(st.stance, 'refuse');
  const dem = personalDemands(state, name);
  const terms = offerPersonalTerms(state, name, { salary: dem.salary, bonus: dem.bonus, years: 2, role: 'race' });
  assert.equal(terms.outcome, 'accepted', terms.text);
  const bid = bidTransferFee(state, name, st.fee);
  assert.equal(bid.outcome, 'accepted');
  const before = state.team.budget; const sellerBefore = seller.budget;
  const done = completeSigning(state, name);
  assert.equal(done.ok, true, done.text);
  assert.ok(state.team.drivers.some((d) => d.name === name));
  assert.ok(!seller.drivers.some((d) => d.name === name));
  assert.equal(Math.round((before - state.team.budget) * 10) / 10, Math.round((st.fee + dem.bonus) * 10) / 10);
  assert.ok(seller.budget > sellerBefore);
  assert.equal(seller.drivers.length, 2, 'seller refilled the seat');
});

test('pre-contracts respect contract expiry, are unique, and execute at season end', () => {
  fresh({ round: 1 });
  const name = 'Esteban Ocon';
  const l = findDriver(state, name);
  l.driver.contractYearsRemaining = 1;
  assert.equal(preContractEligibility(state, name).ok, false, 'not before the second half');
  state.season.round = 15;
  state.team.drivers[1].contractYearsRemaining = 1; // frees a race seat next season
  const dem = personalDemands(state, name);
  const res = agreePreContract(state, name, { salary: dem.salary + 2, bonus: dem.bonus + 1, years: 2, role: 'race' });
  assert.equal(res.outcome, 'accepted', res.text);
  assert.equal(preContractEligibility(state, name).ok, false, 'no duplicate agreement');
  assert.ok(findDriver(state, name).team.name !== state.team.name, 'not released early');
  const budget = state.team.budget;
  processMarketSeasonEnd(state);
  assert.ok(state.team.drivers.some((d) => d.name === name), 'joined at season end');
  assert.ok(state.team.budget < budget, 'bonus paid on arrival');
  assert.equal(processMarketSeasonEnd(state).processed, false, 'runs once per season');
});

test('AI teams keep full lineups and non-negative budgets through a season end', () => {
  fresh();
  contractedDrivers(state).forEach(({ driver }) => { driver.contractYearsRemaining = 1; });
  processMarketSeasonEnd(state);
  for (const t of state.aiTeams) {
    assert.equal(t.drivers.length, 2, `${t.name} has two race drivers`);
    assert.ok(t.budget >= 0, `${t.name} budget ${t.budget}`);
  }
  const names = state.aiTeams.flatMap((t) => [...t.drivers, ...(t.reserveDriver ? [t.reserveDriver] : [])].map((d) => d.name));
  assert.equal(new Set(names).size, names.length, 'no driver on two teams');
});

test('scouting takes time and money', () => {
  fresh();
  const budget = state.team.budget;
  assert.equal(assignScout(state, 'Max Verstappen').ok, true);
  assert.ok(state.team.budget < budget);
  assert.equal(scoutLevel(state, 'Max Verstappen'), 0);
  for (let i = 0; i < 30; i++) { state.season.currentDay += 1; processMarketDay(state); }
  assert.ok(scoutLevel(state, 'Max Verstappen') >= 2);
});

test('market state survives a save and reload', () => {
  fresh();
  state.transferMarket.shortlist.push('Oscar Piastri');
  assignScout(state, 'Oscar Piastri');
  const json = getSerializedState();
  state.transferMarket = undefined;
  hydrateState(json);
  assert.deepEqual(state.transferMarket.shortlist, ['Oscar Piastri']);
  assert.ok(state.transferMarket.scouting['Oscar Piastri'].active);
});
