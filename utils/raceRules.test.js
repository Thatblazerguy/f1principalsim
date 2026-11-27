// Tier 2 race rules: shared events and rules in both engines, seeded races,
// sporting rules, qualifying on the shared pace model, objective trade-offs, sprints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../state.js';
import { calendar } from '../data/calendar.js';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { simulateRaceEvent } from '../game/raceSimulator.js';
import { simulateQualifying } from '../game/qualifying.js';
import { recordRaceHistory, recordSprintHistory } from '../game/raceHistory.js';
import { getRaceRules, rollNeutralisations, makeRng, breaksCompoundRule, isClassified } from '../game/raceEvents.js';
import { getSessionState } from './weekendModel.js';

const bahrain = calendar[3];
const spa = calendar.find((t) => t.name === 'Belgian Grand Prix');
const withRules = (rules) => { state.season = { year: 1, round: 1, rules }; };
const order = (results) => results.map((r) => r.driver.name + (r.retired ? '*' : '')).join(',');

function runLive(seed, { laps = 25, track = bahrain, strat = null, weekendContext = null } = {}) {
  resetAiTeams();
  const e = new LiveRaceEngine(state.aiTeams, track, laps, null, strat, weekendContext, { seed });
  while (!e.raceCompleted) e.tick(1.0);
  return e;
}

test('races replay exactly from their seed, in both engines', () => {
  withRules({ weather: true });
  assert.equal(order(runLive(11).finalClassification.results), order(runLive(11).finalClassification.results));
  resetAiTeams();
  const a = simulateRaceEvent(state.aiTeams, bahrain, 57, null, {}, null, 'points', { seed: 5 });
  resetAiTeams();
  const b = simulateRaceEvent(state.aiTeams, bahrain, 57, null, {}, null, 'points', { seed: 5 });
  assert.equal(order(a.finishers), order(b.finishers));
  assert.equal(a.replayData.seed, 5);
});

test('season rules reach both engines: weather off means no rain, anywhere', () => {
  withRules({ weather: false });
  for (let i = 0; i < 25; i++) {
    resetAiTeams();
    assert.equal(simulateRaceEvent(state.aiTeams, spa, 10, null, {}, null, 'points', { seed: i }).replayData.weather, 'dry');
    resetAiTeams();
    assert.equal(new LiveRaceEngine(state.aiTeams, spa, 10, null, null, null, { seed: i }).isWet, false);
  }
});

test('safety-car frequency setting changes how often neutralisations happen', () => {
  const count = (scFrequency) => {
    const rules = getRaceRules({ season: { rules: { scFrequency } } });
    let n = 0;
    for (let i = 0; i < 1000; i++) if (rollNeutralisations(57, rules, makeRng(i)).scRange) n++;
    return n / 1000;
  };
  const low = count('low');
  const normal = count('normal');
  const high = count('high');
  assert.ok(low < normal && normal < high, `${low} < ${normal} < ${high}`);
  assert.ok(Math.abs(normal - 0.28) < 0.05);
});

test('failure-rate setting changes retirements, with one model for both engines', () => {
  const dnfs = (failures) => {
    withRules({ weather: false, failures });
    let n = 0;
    for (let i = 0; i < 30; i++) {
      resetAiTeams();
      n += simulateRaceEvent(state.aiTeams, bahrain, 57, null, {}, null, 'points', { seed: 100 + i }).finishers.filter((f) => f.retired).length;
    }
    return n / 30;
  };
  assert.ok(dnfs('high') > dnfs('low') * 2);
});

test('the live race has safety cars: announced, no passing, cheap stops taken', () => {
  withRules({ weather: false });
  resetAiTeams();
  const e = new LiveRaceEngine(state.aiTeams, bahrain, 40, null, null, null, { seed: 3 });
  e.scRange = [12, 15];
  e.vscRange = null;
  // Under the safety car nobody on track gains a place except through the pits
  let overtakesBefore = null;
  let passedUnderSC = 0;
  while (!e.raceCompleted) {
    e.tick(1.0);
    const total = e.cars.reduce((a, c) => a + c.overtakes, 0);
    if (e.neutralisation === 'SC') {
      if (overtakesBefore == null) overtakesBefore = total;
      passedUnderSC = total - overtakesBefore;
    }
  }
  assert.ok(e.events.some((ev) => /SAFETY CAR deployed/.test(ev.msg)));
  assert.ok(e.events.some((ev) => /green flag/i.test(ev.msg)));
  assert.ok(e.pitLog.some((p) => p.lap >= 12 && p.lap <= 16), 'someone took the cheap stop');
  assert.equal(e.getReplayData().scLaps.join(), '12,15');
  assert.equal(passedUnderSC, 0, 'no overtakes under the safety car');
});

test('two-compound rule: a dry race on one compound is a disqualification', () => {
  assert.equal(breaksCompoundRule(['Medium'], false), true);
  assert.equal(breaksCompoundRule(['Medium', 'Hard'], false), false);
  assert.equal(breaksCompoundRule(['Intermediate'], false), false);
  assert.equal(breaksCompoundRule(['Medium'], true), false);

  // A player car nobody pits (no engineer on auto) is disqualified at the flag
  withRules({ weather: false, failures: 'low' });
  resetAiTeams();
  const me = state.aiTeams[2];
  const strat = Object.fromEntries(me.drivers.map((d) => [d.name, 'str_4_1']));
  const e = new LiveRaceEngine(state.aiTeams, bahrain, 15, null, strat, { isWet: false }, { seed: 9 });
  while (!e.raceCompleted) e.tick(1.0);
  const ours = e.finalClassification.results.filter((r) => r.team.name === me.name && !r.dnfReason?.includes('failure'));
  assert.ok(ours.length > 0);
  ours.forEach((r) => {
    assert.equal(r.disqualified, true);
    assert.equal(r.classified, false);
  });
  const last = e.finalClassification.results.slice(-ours.length);
  ours.forEach((r) => assert.ok(last.includes(r), 'disqualified cars are classified last'));
});

test('90% rule: a late retirement is classified and scores', () => {
  assert.equal(isClassified(52, 57), true);
  assert.equal(isClassified(40, 57), false);
  resetAiTeams();
  const t = state.aiTeams;
  const res = [
    { driver: t[0].drivers[0], team: t[0], retired: false, lapTimes: [] },
    { driver: t[0].drivers[1], team: t[0], retired: true, classified: true, lapTimes: [] },
    { driver: t[1].drivers[0], team: t[1], retired: true, classified: false, lapTimes: [] },
  ];
  const s = { raceHistory: [], season: { year: 1 } };
  recordRaceHistory(1, 'GP', 'X', res, { drivers: {}, teams: {} }, s, null, null);
  const dr = s.raceHistory[0].driverResults;
  assert.equal(dr[1].points, 18);
  assert.equal(dr[2].points, 0);
});

test('qualifying counts the car once: the fastest team does not take every pole', () => {
  withRules({ weather: false });
  resetAiTeams();
  const poles = {};
  for (let i = 0; i < 120; i++) {
    const { grid } = simulateQualifying(state.aiTeams, calendar[i % 24], null, { seed: i, isWet: false });
    poles[grid[0].team.name] = (poles[grid[0].team.name] || 0) + 1;
  }
  const top = Math.max(...Object.values(poles));
  assert.ok(Object.keys(poles).length >= 2, JSON.stringify(poles));
  assert.ok(top / 120 < 0.75, `top team took ${top}/120 poles`);
  // ...but the grid still follows pace
  const { grid } = simulateQualifying(state.aiTeams, bahrain, null, { seed: 1, isWet: false });
  const backTeams = grid.slice(-6).map((g) => g.team.carPerformance);
  const frontTeams = grid.slice(0, 6).map((g) => g.team.carPerformance);
  assert.ok(Math.min(...frontTeams) >= Math.max(...backTeams) - 4);
});

test('race objectives trade pace for risk: none is a free speed boost', () => {
  withRules({ weather: false });
  const avgFinish = (objective) => {
    let sum = 0, n = 0;
    for (let i = 0; i < 120; i++) {
      resetAiTeams();
      const me = state.aiTeams[5];
      const teams = [{ ...me, isPlayerTeam: true }, ...state.aiTeams.filter((t) => t !== me)];
      simulateRaceEvent(teams, bahrain, 57, null, {}, null, objective, { seed: 7000 + i }).finishers
        .forEach((f, idx) => { if (f.team.name === me.name) { sum += f.retired ? 22 : idx + 1; n++; } });
    }
    return sum / n;
  };
  const points = avgFinish('points');
  for (const o of ['win', 'podium', 'gamble']) {
    assert.ok(avgFinish(o) > points - 0.5, `${o} should not be much faster on average than points`);
  }
});

test('sprints: short, no mandatory stop, 8-to-1 points, recorded as a sprint', () => {
  withRules({ weather: false, sprints: true });
  resetAiTeams();
  const { finishers } = simulateRaceEvent(state.aiTeams, bahrain, 19, null, {}, null, 'points', { seed: 4, sprint: true });
  assert.ok(finishers.every((f) => !f.disqualified), 'no compound rule in a sprint');
  assert.ok(finishers.filter((f) => !f.retired).every((f) => f.stops === 0 && f.lapTimes.length === 19));
  const s = { raceHistory: [{ round: 6, season: 1, type: undefined, driverResults: [] }], season: { year: 1 } };
  recordSprintHistory(6, 'Miami Grand Prix', 'Miami', finishers, s);
  const sprint = s.raceHistory[0];
  assert.equal(sprint.type, 'sprint');
  assert.equal(sprint.driverResults.filter((d) => d.points > 0 && !d.retired).length <= 8, true);
  assert.equal(sprint.driverResults[0].points, finishers[0].retired ? 0 : 8);

  const sess = getSessionState({ raceWindowOpen: true, daysUntilRace: 0, weekendProgress: { qualifyingComplete: true }, practiceRun: true, sprintWeekend: true });
  assert.equal(sess.sprintDone, false);
  assert.equal(sess.steps.find((x) => x.id === 'race').status, 'locked', 'race waits for the sprint');
  assert.equal(sess.steps.find((x) => x.id === 'sprint').status, 'next');
});

test('AI aggressiveness setting changes how the AI races', () => {
  const lo = getRaceRules({ season: { rules: { aiAggressiveness: 'low' } } });
  const hi = getRaceRules({ season: { rules: { aiAggressiveness: 'high' } } });
  assert.ok(hi.aiRacecraftDelta > lo.aiRacecraftDelta);
  assert.ok(hi.aiMistakeMult > lo.aiMistakeMult);
  withRules({ weather: false, aiAggressiveness: 'high' });
  resetAiTeams();
  const e = new LiveRaceEngine(state.aiTeams, bahrain, 5, null, null, null, { seed: 1 });
  withRules({ weather: false, aiAggressiveness: 'low' });
  resetAiTeams();
  const e2 = new LiveRaceEngine(state.aiTeams, bahrain, 5, null, null, null, { seed: 1 });
  const rc = (eng) => eng.cars.reduce((a, c) => a + c.profile.racecraft, 0);
  assert.ok(rc(e) > rc(e2));
});
