import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiTeams } from '../data/teams.js';
import { drivers } from '../data/drivers.js';
import { calendar } from '../data/calendar.js';
import { Team } from '../game/team.js';
import { state } from '../state.js';
import { ensureMarket } from '../game/transferMarket.js';
import { ensureFinanceState } from './financeSystem.js';
import {
  ensureAcademy, allocateFunds, signProspect, startProgramme, processAcademyDay, academySeasonEnd, ovr, potential,
  marketList, interestIn, estimate, assignScoutTask, moveSeries, loanOffers, sendOnLoan, recallLoan, standingsFor,
  upgradeFacility, facilityInfo, promoteToReserve, promoteToRaceSeat, superLicence, financeSummary, knownDriver,
} from '../game/academyEngine.js';

function fresh() {
  state.team = new Team('Test GP', 300, 88);
  ['Zhou Guanyu', 'Nyck de Vries'].forEach((n) => { const d = drivers.find((x) => x.name === n); d.contractYearsRemaining = 2; state.team.signDriver(d); });
  state.aiTeams = createAiTeams();
  state.season = { round: 1, year: 1, totalRounds: 24, currentDay: 1, calendar: [...calendar] };
  state.transferMarket = undefined;
  state.finance = undefined;
  state.academy = { level: 1, prospects: [], loanedOut: [], scouts: [] };
  ensureMarket(state);
  ensureFinanceState(state);
  return ensureAcademy(state);
}
function runDays(n) {
  for (let i = 0; i < n; i++) { state.season.currentDay += 1; processAcademyDay(state); }
}
/** A signable prospect: willing, unsigned, not a pool driver. */
function signable(ac) {
  return ac.market.filter((d) => interestIn(state, d) >= 30).sort((a, b) => potential(b) - ovr(b) - (potential(a) - ovr(a)))[0];
}

test('migration sets up facilities, scouts, a prospect market and AI junior programmes', () => {
  const ac = fresh();
  assert.equal(ac.devModel, 2);
  assert.equal(Object.keys(ac.facilities).length, 8);
  assert.ok(ac.scoutStaff.length >= 2);
  assert.ok(ac.market.length >= 14);
  assert.ok(Object.values(ac.aiJuniors).flat().length >= state.aiTeams.length);
  assert.ok(marketList(state).some((d) => d.poolDriver), 'real F2 drivers from the driver market are listed');
});

test('spending goes through the academy budget and the team budget funds it', () => {
  const ac = fresh();
  const d = signable(ac);
  assert.equal(signProspect(state, d.name).ok, false, 'no money yet');
  const teamBefore = state.team.budget;
  assert.ok(allocateFunds(state, 20).ok);
  assert.equal(state.team.budget, teamBefore - 20);
  assert.equal(allocateFunds(state, 10_000).ok, false);
  const res = signProspect(state, d.name);
  assert.ok(res.ok, res.text);
  assert.ok(ac.prospects.some((x) => x.name === d.name));
  assert.ok(!ac.market.some((x) => x.name === d.name));
  assert.ok(ac.budget < 20);
  assert.equal(financeSummary(state).by.allocation, 20);
});

test('estimates narrow as scouts learn about a driver', () => {
  const ac = fresh();
  allocateFunds(state, 10);
  const d = ac.market[0];
  ac.knowledge[d.name] = { k: 10, acc: 50 };
  const wide = estimate(state, d, 'potential', potential(d));
  const scout = ac.scoutStaff[0];
  assert.ok(assignScoutTask(state, scout.id, { type: 'evaluate', target: d.name }).ok);
  runDays(40);
  const narrow = estimate(state, d, 'potential', potential(d));
  assert.ok(ac.knowledge[d.name].k >= 99);
  assert.ok(narrow.high - narrow.low < wide.high - wide.low);
  assert.ok(ac.reports.some((r) => r.name === d.name));
});

test('a season of training develops a young prospect, never past potential', () => {
  const ac = fresh();
  allocateFunds(state, 60);
  const d = signable(ac);
  signProspect(state, d.name);
  d.age = 17; d.potentialCeiling = Math.max(potential(d), ovr(d) + 15); d.developmentRate = 80;
  const start = ovr(d);
  assert.ok(startProgramme(state, d.name, 'qualifying').ok);
  assert.equal(startProgramme(state, d.name, 'tyre').ok, false, 'one programme at a time');
  runDays(330);
  assert.ok(ovr(d) > start, `grew from ${start} to ${ovr(d)}`);
  assert.ok(ovr(d) <= potential(d));
  assert.ok(d.programmeCount.qualifying >= 1);
  assert.ok(d.juniorStats?.starts > 0, 'raced in the junior series');
  assert.ok(standingsFor(state, d.series).rows.length >= 20);
});

test('facilities are capped by academy level and have diminishing benefits', () => {
  const ac = fresh();
  allocateFunds(state, 100);
  assert.ok(upgradeFacility(state, 'simulator').ok);
  assert.equal(upgradeFacility(state, 'simulator').ok, false, 'level 1 academy caps facilities at 2');
  ac.level = 9;
  [3, 4, 5].forEach(() => upgradeFacility(state, 'simulator'));
  const info = facilityInfo(state, 'simulator');
  assert.equal(info.level, 5);
  assert.equal(info.next, null);
  assert.ok(facilityInfo(state, 'coaching').gain > 0);
});

test('loans move a driver out, track them and bring them back at season end', () => {
  const ac = fresh();
  allocateFunds(state, 40);
  const d = signable(ac);
  signProspect(state, d.name);
  const offer = loanOffers(state, d.name)[0];
  assert.ok(offer, 'has an offer');
  assert.ok(sendOnLoan(state, d.name, offer.id).ok);
  assert.ok(ac.loanedOut.some((x) => x.name === d.name));
  assert.ok(!ac.prospects.some((x) => x.name === d.name));
  if (!offer.recallClause) assert.equal(recallLoan(state, d.name).ok, false);
  runDays(200);
  academySeasonEnd(state, 1);
  if (offer.duration === 1) {
    assert.ok(ac.prospects.some((x) => x.name === d.name), 'returned');
    assert.ok(ac.loanReviews.some((r) => r.name === d.name));
  }
});

test('promotion uses the team reserve seat and the race seat needs a Super Licence', () => {
  const ac = fresh();
  allocateFunds(state, 40);
  const d = signable(ac);
  signProspect(state, d.name);
  moveSeries(state, d.name, 'f2');
  assert.equal(promoteToRaceSeat(state, d.name, 'Zhou Guanyu').ok, false, 'no Super Licence');
  d.age = 20; d.slHistory = [{ year: 1, series: 'f2', pts: 40 }];
  assert.ok(superLicence(d, state).eligible);
  state.team.reserveDriver = null;
  assert.ok(promoteToReserve(state, d.name).ok);
  assert.equal(state.team.reserveDriver.name, d.name);
  assert.ok(state.team.reserveDriver.academyGraduate);
  assert.equal(typeof state.team.reserveDriver.overallRating, 'function');
  assert.ok(promoteToRaceSeat(state, d.name, 'Zhou Guanyu').ok);
  assert.ok(state.team.drivers.some((x) => x.name === d.name));
  assert.equal(ac.stats.raceSeats, 1);
});

test('the market changes over a season and the academy saves as plain data', () => {
  const ac = fresh();
  allocateFunds(state, 30);
  const before = new Set(ac.market.map((d) => d.name));
  runDays(330);
  academySeasonEnd(state, 1);
  const after = new Set(ac.market.map((d) => d.name));
  assert.ok([...after].some((n) => !before.has(n)), 'new names appear');
  assert.ok(ac.news.length > 0);
  const copy = JSON.parse(JSON.stringify(ac));
  assert.equal(copy.market.length, ac.market.length);
  assert.ok(knownDriver(state, ac.market[0].name));
});
