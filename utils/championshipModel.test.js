import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChampionship, compareStandings, formatGap, getTeamSummary, getPodiumLeaders,
  getDriverScopeStats, syncStandingsFromHistory, getSeasonEvents, GP_POINTS,
} from './championshipModel.js';
import { recordRaceHistory } from '../game/raceHistory.js';
import { updateStandings } from '../game/standings.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────
// Four teams, two drivers each. `order` is the finishing order by driver code.
const TEAMS = {
  RED: ['R1', 'R2'], BLU: ['B1', 'B2'], GRN: ['G1', 'G2'], YEL: ['Y1', 'Y2'],
};
const teamOf = (d) => Object.keys(TEAMS).find((t) => TEAMS[t].includes(d));

function race(round, order, { season = 1, retired = [], grid = null, type } = {}) {
  return {
    round, season, name: `GP ${round}`, circuit: `Circuit ${round}`, ...(type ? { type } : {}),
    driverResults: order.map((name, i) => ({
      name, team: teamOf(name), finishPos: i + 1,
      gridPos: grid ? grid.indexOf(name) + 1 : null,
      points: retired.includes(name) ? 0 : (GP_POINTS[i] || 0),
      retired: retired.includes(name),
    })),
  };
}

function makeState(history, { season = 1, round } = {}) {
  return {
    team: { name: 'RED', drivers: [{ name: 'R1' }, { name: 'R2' }] },
    aiTeams: ['BLU', 'GRN', 'YEL'].map((n) => ({ name: n, drivers: TEAMS[n].map((d) => ({ name: d })) })),
    season: { year: season, round: round ?? history.filter((r) => (r.season ?? 1) === season).length + 1, totalRounds: 6 },
    standings: { drivers: {}, teams: {} },
    raceHistory: history,
  };
}

// ─── Tie-breakers ────────────────────────────────────────────────────────────

test('equal points are split by most wins, not alphabetically', () => {
  const h = [
    race(1, ['R1', 'G1', 'B1', 'G2', 'Y1', 'Y2', 'R2', 'B2']),                       // R1 25, B1 15
    race(2, ['G1', 'G2', 'Y1', 'Y2', 'B1', 'B2', 'R2', 'R1'], { retired: ['R1'] }),  // B1 10, R1 DNF
  ];
  const champ = buildChampionship(makeState(h));
  const r1 = champ.drivers.find((d) => d.name === 'R1');
  const b1 = champ.drivers.find((d) => d.name === 'B1');
  assert.equal(r1.points, 25);
  assert.equal(b1.points, 25);
  assert.ok(r1.pos < b1.pos, 'R1 (1 win) ranks above B1 even though B sorts first');
  assert.match(r1.tieNotes[0], /Ahead on count-back: 1 win to 0/);
  // Comparator on its own.
  const alpha = { name: 'Alpha', points: 85, counts: [0, 1, 2], best: new Map() };
  const zulu = { name: 'Zulu', points: 85, counts: [0, 2, 0], best: new Map() };
  assert.ok(compareStandings(zulu, alpha) < 0);
});

test('constructors tied on points: more wins ranks higher, with a tooltip reason', () => {
  // RED: P1 + P8 (25+4=29) and P4+P6 (12+8=20) => 49, one win
  // BLU: P2 + P3 (18+15=33) and P5+P9... craft equal totals:
  const h = [
    race(1, ['R1', 'B1', 'B2', 'G1', 'G2', 'Y1', 'Y2', 'R2']), // RED 25+4=29, BLU 18+15=33
    race(2, ['B1', 'G1', 'R1', 'R2', 'G2', 'B2', 'Y1', 'Y2']), // RED 15+12=27, BLU 25+8=33
  ];
  // RED 56, BLU 66 — not tied. Add race 3 where RED gains exactly 10 more than BLU.
  h.push(race(3, ['G1', 'R1', 'G2', 'Y1', 'B1', 'Y2', 'R2', 'B2'])); // RED 18+6=24, BLU 10+4=14
  const champ = buildChampionship(makeState(h));
  const red = champ.teams.find((t) => t.name === 'RED');
  const blu = champ.teams.find((t) => t.name === 'BLU');
  assert.equal(red.points, 80);
  assert.equal(blu.points, 80);
  assert.equal(red.wins, 1);
  assert.equal(blu.wins, 1);
  // Wins are level; second places decide: RED has 1 (R1 in race 3), BLU has 1 (B1 race 1)… then thirds.
  // RED thirds: R1 race 2 → 1. BLU thirds: B2 race 1 → 1. Fourths: RED R2 race 2 → 1; BLU none → RED ahead.
  assert.ok(red.pos < blu.pos, 'RED wins on count-back (more fourth places)');
  assert.match(red.tieNotes[0], /Level on 80 pts with BLU\. Ahead on count-back: 1 P4 finish to 0/);
  assert.match(blu.tieNotes[0], /Behind on count-back/);
});

test('constructor tie decided by wins even when the name sorts later', () => {
  const h = [
    race(1, ['Y1', 'B1', 'B2', 'G1', 'G2', 'R1', 'R2', 'Y2']), // YEL 25, BLU 33
    race(2, ['B1', 'Y1', 'Y2', 'G1', 'G2', 'R1', 'R2', 'B2']), // YEL 33, BLU 25
  ];
  // YEL 58 (1 win, 1 P2, 1 P3) vs BLU 58 (1 win, 1 P2, 1 P3) — identical counts down to P8:
  // YEL: P1, P8, P2, P3. BLU: P2, P3, P1, P8 → identical. Most recent round decides: BLU won round 2.
  const champ = buildChampionship(makeState(h));
  const yel = champ.teams.find((t) => t.name === 'YEL');
  const blu = champ.teams.find((t) => t.name === 'BLU');
  assert.equal(yel.points, blu.points);
  assert.ok(blu.pos < yel.pos, 'better result in the latest round decides an identical count-back');
  assert.match(blu.tieNotes[0], /better result in round 2/);
});

// ─── Podiums ─────────────────────────────────────────────────────────────────

test('a constructor with P1 and P3 in one race gets two podiums; drivers reconcile', () => {
  const h = [race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2'])];
  const champ = buildChampionship(makeState(h));
  const red = champ.teams.find((t) => t.name === 'RED');
  assert.equal(red.podiums, 2);
  assert.equal(red.wins, 1);
  assert.equal(red.p3, 1);
  assert.equal(red.points, 25 + 15);
  const driverPodiums = champ.drivers.reduce((s, d) => s + d.podiums, 0);
  const teamPodiums = champ.teams.reduce((s, t) => s + t.podiums, 0);
  assert.equal(driverPodiums, 3);
  assert.equal(teamPodiums, 3, 'constructor podiums equal driver podiums across the grid');
  const leaders = getPodiumLeaders(champ);
  assert.deepEqual(leaders.map((d) => d.name), ['R1', 'B1', 'R2']);
});

test('retired drivers score nothing and earn no podium', () => {
  const h = [race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2'], { retired: ['R2'] })];
  const champ = buildChampionship(makeState(h));
  const r2 = champ.drivers.find((d) => d.name === 'R2');
  assert.equal(r2.points, 0);
  assert.equal(r2.podiums, 0);
  assert.equal(r2.dnfs, 1);
  assert.equal(champ.teams.find((t) => t.name === 'RED').podiums, 1);
});

test('updateStandings agrees with the race record when a DNF sits inside the top ten', () => {
  const res = ['R1', 'B1', 'R2'].map((n, i) => ({ driver: { name: n }, team: { name: teamOf(n) }, retired: n === 'R2' }));
  const s = updateStandings(res, { drivers: {}, teams: {} });
  assert.equal(s.drivers.R2, 0);
  assert.equal(s.teams.RED, 25);
});

// ─── Repeated processing ─────────────────────────────────────────────────────

test('a round recorded twice is only counted once', () => {
  const r = race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2']);
  const champ = buildChampionship(makeState([r, { ...r }]));
  assert.equal(champ.completed, 1);
  assert.equal(champ.drivers.find((d) => d.name === 'R1').wins, 1);
  assert.equal(champ.teams.find((t) => t.name === 'RED').points, 40);
});

test('recordRaceHistory replaces an existing record for the same round', () => {
  const state = makeState([]);
  const results = ['R1', 'B1', 'R2'].map((n) => ({ driver: { name: n }, team: { name: teamOf(n) }, retired: false }));
  recordRaceHistory(1, 'GP 1', 'C1', results, state.standings, state);
  recordRaceHistory(1, 'GP 1', 'C1', results, state.standings, state);
  assert.equal(state.raceHistory.length, 1);
});

// ─── Seasons & progression ───────────────────────────────────────────────────

test('season reset: the new season starts from zero and old seasons stay intact', () => {
  const h = [
    race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2'], { season: 1 }),
    race(2, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2'], { season: 1 }),
    race(1, ['B1', 'R1', 'G1', 'R2', 'G2', 'B2', 'Y1', 'Y2'], { season: 2 }),
  ];
  const s2 = buildChampionship(makeState(h, { season: 2 }));
  assert.equal(s2.completed, 1);
  assert.equal(s2.drivers.find((d) => d.name === 'R1').points, 18);
  assert.equal(s2.drivers.find((d) => d.name === 'R1').wins, 0);
  const s1 = buildChampionship(makeState(h, { season: 2 }), { season: 1 });
  assert.equal(s1.drivers.find((d) => d.name === 'R1').points, 50);
  const career = getDriverScopeStats(makeState(h, { season: 2 }), 'R1', 'career');
  assert.equal(career.wins, 2);
  assert.equal(career.points, 68);
});

test('progression has one point per completed round and accumulates correctly', () => {
  const h = [
    race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2']),
    race(2, ['B1', 'R1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2']),
  ];
  const champ = buildChampionship(makeState(h, { round: 3 }));
  assert.equal(champ.progression.rounds.length, 2, 'no rounds fabricated beyond the completed ones');
  assert.deepEqual(champ.progression.drivers.map((s) => s.R1.points), [25, 43]);
  assert.deepEqual(champ.progression.drivers.map((s) => s.B1.points), [18, 43]);
  // Level on 43 after round 2: R1 has 1 win + 1 P2, B1 has 1 win + 1 P2 → identical; round 2 decides (B1 won).
  assert.equal(champ.progression.drivers[1].B1.pos, 1);
  assert.equal(champ.drivers.find((d) => d.name === 'B1').posChange, 1);
  assert.equal(champ.remaining, 4);
});

test('sprint points count toward the title but not toward Grand Prix podiums', () => {
  const h = [
    race(1, ['Y1', 'Y2', 'R1', 'G1', 'G2', 'B2', 'B1', 'R2'], { type: 'sprint' }),
    race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2']),
  ];
  // Sprint records here reuse GP points for simplicity; only the separation matters.
  const champ = buildChampionship(makeState(h));
  const y1 = champ.drivers.find((d) => d.name === 'Y1');
  assert.equal(y1.sprintWins, 1);
  assert.equal(y1.wins, 0);
  assert.equal(y1.podiums, 0);
  assert.equal(y1.sprintPoints, 25);
  assert.equal(getSeasonEvents(h, 1).grandsPrix.length, 1);
  assert.equal(champ.completed, 1);
});

// ─── Summary & save sync ─────────────────────────────────────────────────────

test('gap labels never show -0 and use championship order', () => {
  assert.equal(formatGap(0), '0 PTS');
  assert.equal(formatGap(-0), '0 PTS');
  assert.equal(formatGap(-12), '−12 PTS');
  assert.equal(formatGap(8), '+8 PTS');
  const h = [
    race(1, ['B1', 'R1', 'B2', 'R2', 'G1', 'G2', 'Y1', 'Y2']), // BLU 40, RED 30
    race(2, ['R1', 'B1', 'R2', 'B2', 'G1', 'G2', 'Y1', 'Y2']), // RED 40, BLU 30
  ];
  const champ = buildChampionship(makeState(h));
  const sum = getTeamSummary(champ, 'RED');
  // Both on 70 with identical count-back; RED won the latest round → RED P1.
  assert.equal(sum.pos, 1);
  assert.equal(sum.ahead, null);
  assert.equal(sum.behind.name, 'BLU');
  assert.equal(formatGap(sum.behind.gap), '0 PTS');
});

test('loading a save realigns stored standings with the race records', () => {
  const h = [race(1, ['R1', 'B1', 'R2', 'G1', 'G2', 'B2', 'Y1', 'Y2'], { retired: ['R2'] })];
  const state = makeState(h, { round: 2 });
  state.standings = { drivers: { R1: 25, B1: 18, R2: 15 }, teams: { RED: 40, BLU: 18 } }; // R2 wrongly scored
  const fixes = syncStandingsFromHistory(state);
  assert.equal(state.standings.drivers.R2, 0);
  assert.equal(state.standings.teams.RED, 25);
  assert.ok(fixes.length >= 2);
  // Gaps in the records (a missing round) leave stored standings alone.
  const gappy = makeState([race(2, ['R1', 'B1'])], { round: 3 });
  gappy.standings = { drivers: { R1: 50 }, teams: { RED: 50 } };
  assert.deepEqual(syncStandingsFromHistory(gappy), []);
  assert.equal(gappy.standings.teams.RED, 50);
});
