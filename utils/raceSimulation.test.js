import test from 'node:test';
import assert from 'node:assert/strict';
import { state, resetAiTeams } from '../state.js';
import { calendar } from '../data/calendar.js';
import { buildPaceProfile, expectedLapTime, chooseNextCompound, tyreLife, overtakeChance } from '../game/paceModel.js';
import { simulateRaceEvent } from '../game/raceSimulator.js';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { RaceEngineer } from '../game/RaceEngineer.js';

const track = calendar[3]; // Bahrain
const car = (ovr, chassis = ovr) => ({ name: `Car${ovr}`, carPerformance: ovr, specs: { ovr, aero: ovr, chassis, reliability: 90 } });
const driver = (name, skill, extra = {}) => ({ name, pace: skill, racecraft: skill, consistency: skill, tyre: skill, wet: skill, quali: skill, ...extra });
const lap = (team, drv) => expectedLapTime(buildPaceProfile({ team, driver: drv, track }), { compound: 'Medium', tyreAge: 5, lap: 20, totalLaps: 57 });

test('car is worth more than driver, but an elite driver can beat a slightly better car', () => {
  const carSpread = lap(car(80), driver('A', 88)) - lap(car(95), driver('A', 88));
  const driverSpread = lap(car(88), driver('Slow', 78)) - lap(car(88), driver('Fast', 98));
  assert.ok(carSpread > 1.0 && carSpread < 1.4, `car spread ${carSpread}`);
  assert.ok(driverSpread > 0.5 && driverSpread < 0.8, `driver spread ${driverSpread}`);
  // Elite driver, car 3 points worse, beats an average driver
  assert.ok(lap(car(89), driver('Elite', 98)) < lap(car(92), driver('Avg', 85)));
  // ...but not a car 10 points better
  assert.ok(lap(car(84), driver('Elite', 98)) > lap(car(94), driver('Avg', 85)));
});

test('tyre management extends stints; softs fastest when fresh', () => {
  const good = buildPaceProfile({ team: car(88), driver: driver('Good', 88, { tyre: 97 }), track });
  const poor = buildPaceProfile({ team: car(88), driver: driver('Poor', 88, { tyre: 77 }), track });
  assert.ok(tyreLife(good, 'Medium') > tyreLife(poor, 'Medium') * 1.2);
  const soft = expectedLapTime(good, { compound: 'Soft', tyreAge: 1, lap: 10, totalLaps: 57 });
  const hard = expectedLapTime(good, { compound: 'Hard', tyreAge: 1, lap: 10, totalLaps: 57 });
  assert.ok(soft < hard);
  // Two-compound rule: after a Medium-only race so far, never pick Medium again
  assert.notEqual(chooseNextCompound(good, 20, ['Medium']), 'Medium');
});

test('overtaking needs a pace edge, more so at hard tracks', () => {
  const easy = overtakeChance({ paceAdvantage: 0.8, difficulty: 0.3 });
  const monaco = overtakeChance({ paceAdvantage: 0.8, difficulty: 0.95 });
  assert.ok(easy > 0.5 && monaco < 0.4);
});

test('quick sim: every finisher has laps, legal stints and the field is spread realistically', () => {
  resetAiTeams();
  state.season = { year: 1, rules: { weather: false } };
  const { finishers, replayData } = simulateRaceEvent(state.aiTeams, track, track.laps, null, {}, null);
  const running = finishers.filter((f) => !f.retired);
  assert.ok(running.length > 10);
  running.forEach((f) => {
    assert.equal(f.lapTimes.length, track.laps);
    assert.ok(new Set(f.stints.map((s) => s.compound)).size >= 2, `${f.driver.name} used one compound`);
  });
  const lastGap = running[running.length - 1].time - running[0].time;
  assert.ok(lastGap > 20 && lastGap < 200, `winner to last finisher ${lastGap}s`);
  assert.ok(Array.isArray(replayData.events));
});

test('live race with the engineer on auto finishes and records lap data', () => {
  resetAiTeams();
  state.season = { year: 1, rules: { weather: false } };
  const me = state.aiTeams[3];
  const strat = Object.fromEntries(me.drivers.map((d) => [d.name, 'str_4_1']));
  const e = new LiveRaceEngine(state.aiTeams, track, 20, null, strat, null);
  const eng = new RaceEngineer(e, { objective: 'points' });
  e.cars.filter((c) => c.isPlayer).forEach((c) => eng.setAuto(c.id, true));
  let sawCall = false;
  while (!e.raceCompleted) {
    e.tick(1.0);
    eng.update();
    const c = e.cars.find((x) => x.isPlayer && !x.retired);
    if (c && eng.getBriefing(c.id)?.calls?.length) sawCall = true;
  }
  assert.ok(sawCall, 'engineer made at least one call');
  const mine = e.finalClassification.results.filter((r) => r.team.name === me.name && !r.retired);
  mine.forEach((r) => {
    assert.equal(r.lapTimes.length, 20);
    assert.ok(r.stints.length >= 2, 'engineer pitted the car');
  });
  assert.ok(e.comms.some((c) => c.sender === 'Engineer'));
});
