/**
 * championshipModel.js
 * ────────────────────
 * One read-only model for both championships, derived from completed race
 * results (state.raceHistory). Nothing in here increments counters on its own:
 * every number is recomputed from the race records each time.
 *
 *   - Points        → sum of driverResults[].points (constructor = sum of its cars)
 *   - Wins/podiums  → classified finishing positions in Grand Prix records
 *   - Poles         → driverResults[].gridPos === 1
 *   - Positions     → points, then FIA-style count-back (see compareStandings)
 *   - Progression   → the same calculation replayed after every completed round
 *
 * A race that was recorded twice (same season + round) is only counted once:
 * the latest record for that round wins. Sprint records (type: 'sprint') add
 * points but never count as Grand Prix wins, podiums or count-back results.
 */

export const GP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
/** Most points one car can take from a Grand Prix, and one constructor (P1 + P2). */
const MAX_DRIVER_RACE_PTS = 25;
const MAX_TEAM_RACE_PTS = 43;

export const isSprintRecord = (r) => r?.type === 'sprint' || r?.sprint === true || r?.isSprint === true;
const seasonOf = (r) => r?.season ?? 1;

/** Seasons that have race records, plus the current one. Newest first. */
export function getRecordedSeasons(state) {
  const set = new Set((state?.raceHistory || []).map(seasonOf));
  set.add(state?.season?.year || 1);
  return [...set].sort((a, b) => b - a);
}

/** One record per round and type for a season; the latest write for a round wins. */
export function getSeasonEvents(raceHistory, season) {
  const gp = new Map();
  const sprint = new Map();
  for (const r of raceHistory || []) {
    if (seasonOf(r) !== season) continue;
    (isSprintRecord(r) ? sprint : gp).set(r.round, r);
  }
  const sorted = (m) => [...m.values()].sort((a, b) => a.round - b.round);
  return { grandsPrix: sorted(gp), sprints: sorted(sprint) };
}

// ─── Accumulators ────────────────────────────────────────────────────────────

function blank(name, kind) {
  return {
    name, kind,
    points: 0, gpPoints: 0, sprintPoints: 0,
    starts: 0, finishes: 0, dnfs: 0,
    wins: 0, p2: 0, p3: 0, podiums: 0, poles: 0,
    sprintWins: 0, sprintPodiums: 0,
    counts: [],          // counts[pos] = classified Grand Prix finishes in that position
    best: new Map(),     // round → best classified finish that round (count-back fallback)
    finSum: 0, gridSum: 0, gridN: 0,
    bestFinish: null,
    team: null, teams: [], drivers: [],
    races: [],           // per-round rows (drivers: one result; teams: aggregate)
  };
}

const get = (map, name, kind) => {
  if (!map.has(name)) map.set(name, blank(name, kind));
  return map.get(name);
};
const addUnique = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function applyFinish(acc, pos, round) {
  acc.finishes++;
  acc.finSum += pos;
  acc.counts[pos] = (acc.counts[pos] || 0) + 1;
  if (pos === 1) acc.wins++;
  if (pos === 2) acc.p2++;
  if (pos === 3) acc.p3++;
  if (pos <= 3) acc.podiums++;
  if (acc.bestFinish == null || pos < acc.bestFinish) acc.bestFinish = pos;
  const prev = acc.best.get(round);
  if (prev == null || pos < prev) acc.best.set(round, pos);
}

function applyGrandPrix(race, drivers, teams) {
  const perTeam = new Map();
  const results = [...(race.driverResults || [])].sort((a, b) => a.finishPos - b.finishPos);
  for (const dr of results) {
    if (!dr?.name) continue;
    const pts = num(dr.points);
    const pos = Number(dr.finishPos);
    // Retirements past 90% distance are classified: they count for count-back too
    const classified = (!dr.retired || dr.classified === true) && Number.isFinite(pos) && pos > 0;
    const teamName = dr.team || 'Unknown';

    const d = get(drivers, dr.name, 'driver');
    d.team = teamName;
    addUnique(d.teams, teamName);
    d.starts++;
    d.points += pts;
    d.gpPoints += pts;
    if (dr.gridPos) { d.gridN++; d.gridSum += dr.gridPos; if (dr.gridPos === 1) d.poles++; }
    if (classified) applyFinish(d, pos, race.round);
    if (dr.retired) d.dnfs++;
    d.races.push({
      round: race.round, name: race.name, circuit: race.circuit, season: seasonOf(race),
      finishPos: pos, gridPos: dr.gridPos ?? null, points: pts, retired: !!dr.retired, team: teamName,
    });

    const t = get(teams, teamName, 'team');
    addUnique(t.drivers, dr.name);
    t.points += pts;
    t.gpPoints += pts;
    if (dr.gridPos === 1) t.poles++;
    if (classified) applyFinish(t, pos, race.round);
    if (dr.retired) t.dnfs++;
    if (!perTeam.has(teamName)) perTeam.set(teamName, { points: 0, positions: [], podiums: 0, bestPos: null, allRetired: true });
    const agg = perTeam.get(teamName);
    agg.points += pts;
    agg.positions.push({ name: dr.name, finishPos: pos, retired: !!dr.retired, points: pts });
    if (classified) {
      agg.allRetired = false;
      if (pos <= 3) agg.podiums++;
      if (agg.bestPos == null || pos < agg.bestPos) agg.bestPos = pos;
    }
  }
  for (const [teamName, agg] of perTeam) {
    const t = teams.get(teamName);
    t.starts++;
    t.races.push({
      round: race.round, name: race.name, circuit: race.circuit, season: seasonOf(race),
      points: agg.points, podiums: agg.podiums, positions: agg.positions,
      bestPos: agg.bestPos, finishPos: agg.bestPos, retired: agg.allRetired,
    });
  }
}

function applySprint(race, drivers, teams) {
  for (const dr of race.driverResults || []) {
    if (!dr?.name) continue;
    const pts = num(dr.points);
    const pos = Number(dr.finishPos);
    const d = get(drivers, dr.name, 'driver');
    d.points += pts;
    d.sprintPoints += pts;
    if (!dr.retired && pos === 1) d.sprintWins++;
    if (!dr.retired && pos <= 3) d.sprintPodiums++;
    const t = get(teams, dr.team || 'Unknown', 'team');
    t.points += pts;
    t.sprintPoints += pts;
    if (!dr.retired && pos === 1) t.sprintWins++;
    if (!dr.retired && pos <= 3) t.sprintPodiums++;
  }
}

// ─── Tie-breaks ──────────────────────────────────────────────────────────────

/**
 * Championship order. Equal points are split by count-back: most wins, then
 * most second places, then thirds, and so on through every classified finish.
 * If two records are still identical, the better result in the most recent
 * round where they differ decides (the simulation's final rule). Only if the
 * records are completely identical does the name keep the order stable.
 */
export function compareStandings(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  const n = Math.max(a.counts.length, b.counts.length);
  for (let p = 1; p < n; p++) {
    const d = (b.counts[p] || 0) - (a.counts[p] || 0);
    if (d) return d;
  }
  const rounds = [...new Set([...a.best.keys(), ...b.best.keys()])].sort((x, y) => y - x);
  for (const r of rounds) {
    const pa = a.best.get(r) ?? Infinity;
    const pb = b.best.get(r) ?? Infinity;
    if (pa !== pb) return pa - pb;
  }
  return a.name.localeCompare(b.name);
}

const COUNT_LABEL = (p, n) => {
  if (p === 1) return n === 1 ? 'win' : 'wins';
  if (p === 2) return n === 1 ? 'second place' : 'second places';
  if (p === 3) return n === 1 ? 'third place' : 'third places';
  return n === 1 ? `P${p} finish` : `P${p} finishes`;
};

/** Why `ahead` is above `behind` when both have the same points. */
export function explainTie(ahead, behind) {
  const n = Math.max(ahead.counts.length, behind.counts.length);
  for (let p = 1; p < n; p++) {
    const ca = ahead.counts[p] || 0;
    const cb = behind.counts[p] || 0;
    if (ca !== cb) return { rule: 'countback', pos: p, ahead: ca, behind: cb, text: `${ca} ${COUNT_LABEL(p, ca)} to ${cb}` };
  }
  const rounds = [...new Set([...ahead.best.keys(), ...behind.best.keys()])].sort((x, y) => y - x);
  for (const r of rounds) {
    const pa = ahead.best.get(r);
    const pb = behind.best.get(r);
    if ((pa ?? Infinity) !== (pb ?? Infinity)) {
      return { rule: 'recent', round: r, text: `identical count-back; better result in round ${r} (${pa ? `P${pa}` : 'DNF'} vs ${pb ? `P${pb}` : 'DNF'})` };
    }
  }
  return { rule: 'identical', text: 'identical records; order kept stable' };
}

function rank(list) {
  const sorted = [...list].sort(compareStandings);
  sorted.forEach((e, i) => { e.pos = i + 1; e.tieNotes = []; });
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (a.points !== b.points) continue;
    if (a.starts === 0 && b.starts === 0) continue;
    const why = explainTie(a, b);
    a.tieNotes.push(`Level on ${a.points} pts with ${b.name}. Ahead on count-back: ${why.text}.`);
    b.tieNotes.push(`Level on ${b.points} pts with ${a.name}. Behind on count-back: ${why.text}.`);
  }
  return sorted;
}

// ─── Momentum ────────────────────────────────────────────────────────────────

/**
 * Momentum from the last races only. Two parts, equally weighted:
 *  - form:  share of the points available over the last 3 races
 *  - trend: points per race over the last 3 vs the 3 before (or the season before them)
 * 50 is steady; above 60 is rising, below 40 is falling. Null with fewer than 2 races.
 */
export function computeMomentum(races, maxPerRace) {
  if (!races || races.length < 2) return null;
  const pts = races.map((r) => r.points || 0);
  const recent = pts.slice(-3);
  const before = pts.slice(-6, -3).length ? pts.slice(-6, -3) : pts.slice(0, -3);
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const recentAvg = avg(recent);
  const priorAvg = before.length ? avg(before) : avg(pts.slice(0, -1));
  const trend = recentAvg - priorAvg;
  const formPart = Math.min(100, (recentAvg / maxPerRace) * 100);
  const trendPart = Math.max(0, Math.min(100, 50 + (trend / maxPerRace) * 100));
  const score = Math.round(formPart * 0.5 + trendPart * 0.5);
  const direction = trend > 0.5 ? 'up' : trend < -0.5 ? 'down' : 'flat';
  return { score, trend: Math.round(trend * 10) / 10, recentAvg: Math.round(recentAvg * 10) / 10, direction };
}

// ─── Build ───────────────────────────────────────────────────────────────────

function finalize(acc, kind) {
  const races = acc.races;
  const last5 = races.slice(-5);
  return {
    ...acc,
    avgFinish: acc.finishes ? acc.finSum / acc.finishes : null,
    avgGrid: acc.gridN ? acc.gridSum / acc.gridN : null,
    form: last5,
    lastRace: races[races.length - 1] || null,
    last5Points: last5.reduce((s, r) => s + (r.points || 0), 0),
    last5Podiums: kind === 'team'
      ? last5.reduce((s, r) => s + (r.podiums || 0), 0)
      : last5.filter((r) => !r.retired && r.finishPos <= 3).length,
    momentum: computeMomentum(races, kind === 'team' ? MAX_TEAM_RACE_PTS : MAX_DRIVER_RACE_PTS),
  };
}

const snapshot = (map) => {
  const ranked = rank([...map.values()]);
  const out = {};
  ranked.forEach((e) => { out[e.name] = { points: e.points, pos: e.pos }; });
  return out;
};

const cache = new WeakMap();

/**
 * Everything the standings screen needs for one season.
 * @param {object} state  game state
 * @param {object} [opts] { season } — defaults to the current season
 */
export function buildChampionship(state, opts = {}) {
  const currentSeason = state?.season?.year || 1;
  const season = opts.season ?? currentSeason;
  const isCurrent = season === currentSeason;
  const history = state?.raceHistory || [];
  const playerTeam = state?.team?.name || null;
  const liveTeams = [state?.team, ...(state?.aiTeams || [])].filter(Boolean);

  const key = `${season}|${history.length}|${playerTeam}|${liveTeams.map((t) => t.name).join(',')}|${state?.season?.round}|${state?.season?.totalRounds}`;
  const hit = cache.get(history);
  if (hit && hit.key === key && hit.last === history[history.length - 1]) return hit.value;

  const { grandsPrix, sprints } = getSeasonEvents(history, season);
  const drivers = new Map();
  const teams = new Map();
  if (isCurrent) liveTeams.forEach((t) => get(teams, t.name, 'team'));

  // Replay rounds in order; snapshot both tables after each completed Grand Prix.
  const rounds = [...new Set([...grandsPrix, ...sprints].map((r) => r.round))].sort((a, b) => a - b);
  const progression = { rounds: [], drivers: [], teams: [] };
  for (const round of rounds) {
    const sp = sprints.find((r) => r.round === round);
    if (sp) applySprint(sp, drivers, teams);
    const gp = grandsPrix.find((r) => r.round === round);
    if (!gp) continue;
    applyGrandPrix(gp, drivers, teams);
    progression.rounds.push({ round, name: gp.name, circuit: gp.circuit });
    progression.drivers.push(snapshot(drivers));
    progression.teams.push(snapshot(teams));
  }

  // Legacy saves: standings exist but no race records were kept for this season.
  const legacy = isCurrent && grandsPrix.length === 0 && sprints.length === 0 &&
    Object.values(state?.standings?.teams || {}).some((v) => v > 0);
  if (legacy) {
    for (const [n, p] of Object.entries(state.standings.drivers || {})) get(drivers, n, 'driver').points = num(p);
    for (const [n, p] of Object.entries(state.standings.teams || {})) get(teams, n, 'team').points = num(p);
  }

  const driverRows = rank([...drivers.values()]).map((d) => finalize(d, 'driver'));
  const teamRows = rank([...teams.values()]).map((t) => finalize(t, 'team'));

  // Driver's constructor: the team they raced for most recently, or their current seat.
  const seatOf = new Map();
  if (isCurrent) liveTeams.forEach((t) => (t.drivers || []).forEach((d) => d?.name && seatOf.set(d.name, t.name)));
  driverRows.forEach((d) => { d.team = d.team || seatOf.get(d.name) || null; });

  const prevD = progression.drivers[progression.drivers.length - 2] || null;
  const prevT = progression.teams[progression.teams.length - 2] || null;
  const decorate = (rows, prev) => rows.forEach((r) => {
    r.prevPos = prev?.[r.name]?.pos ?? null;
    r.posChange = r.prevPos != null ? r.prevPos - r.pos : null;
  });
  decorate(driverRows, prevD);
  decorate(teamRows, prevT);

  driverRows.forEach((d) => { d.isPlayer = !!playerTeam && d.team === playerTeam; });
  teamRows.forEach((t) => {
    t.isPlayer = t.name === playerTeam;
    // Position change over the last five rounds, for the momentum timeline.
    const idx = progression.teams.length - 1;
    const from = progression.teams[Math.max(0, idx - 5)];
    t.posChange5 = idx > 0 && from?.[t.name] ? from[t.name].pos - t.pos : null;
    t.posChange5From = idx > 0 ? progression.rounds[Math.max(0, idx - 5)].round : null;
  });

  const totalRounds = isCurrent
    ? (state?.season?.totalRounds || state?.season?.calendar?.length || 24)
    : Math.max(grandsPrix.length, ...grandsPrix.map((r) => r.round), 0);
  const completed = grandsPrix.length;

  const value = {
    season, isCurrent, legacy,
    grandsPrix, sprints, hasSprints: sprints.length > 0,
    totalRounds, completed, remaining: Math.max(0, totalRounds - completed),
    currentRound: isCurrent ? Math.min(state?.season?.round || 1, totalRounds) : totalRounds,
    seasonOver: completed >= totalRounds,
    drivers: driverRows,
    teams: teamRows,
    progression,
    latestRace: grandsPrix[grandsPrix.length - 1] || null,
    playerTeam,
  };
  cache.set(history, { key, last: history[history.length - 1], value });
  return value;
}

// ─── Small selectors other screens use ───────────────────────────────────────

/** Constructors in championship order: [{ name, points, pos }]. */
export function getConstructorOrder(state) {
  return buildChampionship(state).teams.map((t) => ({ name: t.name, points: t.points, pos: t.pos }));
}

/** Drivers in championship order: [{ name, team, points, pos }]. */
export function getDriverOrder(state) {
  return buildChampionship(state).drivers.map((d) => ({ name: d.name, team: d.team, points: d.points, pos: d.pos }));
}

/** [name, points] pairs in championship order — drop-in for Object.entries(...).sort(). */
export const constructorEntries = (state) => getConstructorOrder(state).map((t) => [t.name, t.points]);
export const driverEntries = (state) => getDriverOrder(state).map((d) => [d.name, d.points]);

/** Gap label that never shows "-0". */
export function formatGap(points, { sign = true } = {}) {
  const n = Math.round(Math.abs(points || 0));
  if (n === 0) return '0 PTS';
  if (!sign) return `${n} PTS`;
  return `${points > 0 ? '+' : '−'}${n} PTS`;
}

/** The player's constructors summary: position, points, the team ahead/behind and round counts. */
export function getTeamSummary(champ, teamName) {
  const rows = champ.teams;
  const i = rows.findIndex((t) => t.name === teamName);
  const me = rows[i] || null;
  const ahead = i > 0 ? rows[i - 1] : null;
  const behind = i >= 0 && i < rows.length - 1 ? rows[i + 1] : null;
  return {
    team: me,
    pos: me && champ.completed > 0 ? me.pos : null,
    points: me?.points || 0,
    ahead: ahead ? { name: ahead.name, gap: ahead.points - me.points } : null,
    behind: behind ? { name: behind.name, gap: me.points - behind.points } : null,
    leader: rows[0] || null,
    gapToLeader: rows[0] && me ? rows[0].points - me.points : 0,
  };
}

/** Drivers with at least one Grand Prix podium, most first (wins, then P2s, then P3s split ties). */
export function getPodiumLeaders(champ) {
  return champ.drivers
    .filter((d) => d.podiums > 0)
    .sort((a, b) => b.podiums - a.podiums || b.wins - a.wins || b.p2 - a.p2 || b.p3 - a.p3 || a.pos - b.pos);
}

/**
 * One driver's numbers for the comparison panel.
 * scope: 'season' (this season), 'last5' (their last five starts this season), 'career' (every recorded season).
 */
export function getDriverScopeStats(state, name, scope = 'season', season = state?.season?.year || 1) {
  const history = state?.raceHistory || [];
  let races;
  if (scope === 'career') {
    races = getRecordedSeasons(state).sort((a, b) => a - b).flatMap((s) => getSeasonEvents(history, s).grandsPrix);
  } else {
    races = getSeasonEvents(history, season).grandsPrix;
  }
  let rows = [];
  for (const race of races) {
    const dr = race.driverResults?.find((d) => d.name === name);
    if (dr) rows.push({ race, dr });
  }
  if (scope === 'last5') rows = rows.slice(-5);
  const out = { starts: rows.length, points: 0, wins: 0, podiums: 0, poles: 0, dnfs: 0, bestFinish: null, avgFinish: null, avgGrid: null, form: [], stdDev: null };
  const fins = [];
  const grids = [];
  for (const { race, dr } of rows) {
    out.points += num(dr.points);
    if (dr.gridPos) { grids.push(dr.gridPos); if (dr.gridPos === 1) out.poles++; }
    if (dr.retired) out.dnfs++;
    else {
      fins.push(dr.finishPos);
      if (dr.finishPos === 1) out.wins++;
      if (dr.finishPos <= 3) out.podiums++;
      if (out.bestFinish == null || dr.finishPos < out.bestFinish) out.bestFinish = dr.finishPos;
    }
    out.form.push({ round: race.round, name: race.name, circuit: race.circuit, season: seasonOf(race), finishPos: dr.finishPos, points: num(dr.points), retired: !!dr.retired });
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  if (fins.length) {
    out.avgFinish = mean(fins);
    const m = out.avgFinish;
    out.stdDev = fins.length > 1 ? Math.sqrt(fins.reduce((s, v) => s + (v - m) ** 2, 0) / fins.length) : null;
  }
  if (grids.length) out.avgGrid = mean(grids);
  out.form = out.form.slice(-5);
  return out;
}

/**
 * Rewrite state.standings for the current season from the race records, when
 * those records cover every completed round. Keeps every screen that reads
 * state.standings directly in step with the results. Returns the corrections made.
 */
export function syncStandingsFromHistory(state) {
  const season = state?.season?.year || 1;
  const { grandsPrix } = getSeasonEvents(state?.raceHistory, season);
  if (!grandsPrix.length) return [];
  const contiguous = grandsPrix.every((r, i) => r.round === i + 1);
  const expected = Math.max(0, (state.season?.round || 1) - 1);
  if (!contiguous || grandsPrix.length < Math.min(expected, state.season?.totalRounds || expected)) return [];

  const champ = buildChampionship(state, { season });
  const fixes = [];
  const sync = (table, rows) => {
    for (const r of rows) {
      const cur = table[r.name];
      if (cur !== r.points) { fixes.push({ name: r.name, from: cur ?? null, to: r.points }); table[r.name] = r.points; }
    }
  };
  state.standings = state.standings || { drivers: {}, teams: {} };
  state.standings.drivers = state.standings.drivers || {};
  state.standings.teams = state.standings.teams || {};
  sync(state.standings.drivers, champ.drivers);
  sync(state.standings.teams, champ.teams);
  return fixes;
}

/** Subtle constructor colours (used as thin markers only). */
export const TEAM_COLORS = {
  Mercedes: '#27F4D2', Ferrari: '#E8002D', McLaren: '#FF8000', 'Red Bull Racing': '#3671C6',
  Haas: '#B6BABD', Alpine: '#0093CC', 'Racing Bulls': '#6692FF', Williams: '#64C4FF',
  Audi: '#C0C6CC', Cadillac: '#C9A54A', 'Aston Martin': '#229971',
};
export const teamColor = (name, playerTeam) => (name && name === playerTeam ? '#E10600' : TEAM_COLORS[name] || '#85858b');
