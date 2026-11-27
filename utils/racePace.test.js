import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseDriverLaps, detectPitLaps, analyseRace, getDriverSeasonPace, getTeamsSeasonPace, buildRaceTrace } from './racePace.js';

// 30-lap race, base 90s, +0.05s/lap deg, pit on lap 15 (+21s), slow lap-1
function makeLaps(base, { pit = 15, deg = 0.05, laps = 30, noise = 0 } = {}) {
  const out = [];
  let stintLap = 0;
  for (let l = 1; l <= laps; l++) {
    stintLap++;
    let t = base + stintLap * deg + (l % 2 ? noise : -noise);
    if (l === 1) t += 3;
    if (l === pit) { t += 21; stintLap = 0; }
    out.push(t);
  }
  return out;
}

test('detects pit lap from outlier and excludes in/out laps', () => {
  const laps = makeLaps(90);
  assert.deepEqual(detectPitLaps(laps), [15]);
  const a = analyseDriverLaps(laps, { pitLaps: [15] });
  assert.equal(a.stints.length, 2);
  assert.equal(a.cleanLapCount, 30 - 4); // lap1 + 14,15,16
  assert.ok(Math.abs(a.stints[0].trend - 0.05) < 1e-6);
  assert.ok(a.consistency >= 99);
});

test('ranks drivers and teams by median clean pace', () => {
  const results = [
    { name: 'A', team: 'T1', finishPos: 1, lapTimes: makeLaps(90) },
    { name: 'B', team: 'T2', finishPos: 2, lapTimes: makeLaps(90.5) },
    { name: 'C', team: 'T1', finishPos: 3, lapTimes: makeLaps(90.8) },
    { name: 'D', team: 'T2', finishPos: 4, retired: true, lapTimes: makeLaps(89, { laps: 3 }) },
  ];
  const a = analyseRace(results, { scLaps: [20, 22] });
  assert.deepEqual(a.ranked.map(d => d.name), ['A', 'B', 'C']);
  assert.equal(a.drivers.find(d => d.name === 'D').rankable, false);
  assert.deepEqual(a.teams.map(t => t.team), ['T1', 'T2']);
  assert.ok(Math.abs(a.teams[1].gapToFastest - 0.5) < 1e-6);
  const trace = buildRaceTrace(results);
  assert.equal(trace.traces[0].gaps.length, 30);
});

test('season aggregation', () => {
  const rec = (round, aBase) => ({ round, season: 1, name: `R${round}`, driverResults: [
    { name: 'A', team: 'T1', finishPos: 1, lapTimes: makeLaps(aBase) },
    { name: 'C', team: 'T1', finishPos: 2, lapTimes: makeLaps(90.3) },
    { name: 'B', team: 'T2', finishPos: 3, lapTimes: makeLaps(90.6) },
  ]});
  const history = [rec(1, 90), rec(2, 90.5), rec(3, 90.1)];
  const p = getDriverSeasonPace('A', history, 1);
  assert.equal(p.races.length, 3);
  assert.equal(p.summary.teammateAhead, 2);
  const t = getTeamsSeasonPace(history, 1);
  assert.equal(t.teams[0].team, 'T1');
  assert.equal(t.analysedRaces, 3);
});
