/**
 * racePace.js
 * ───────────
 * Shared race-pace analytics built from recorded lap times.
 *
 * Used by:
 *   - the post-race report (single race, full detail)
 *   - My Drivers (per-driver season pace profile)
 *   - Teams (per-constructor season pace table)
 *
 * Methodology (mirrors how F1 analysts read long-run pace):
 *   1. Lap 1 is dropped (standing start).
 *   2. Pit laps are detected from recorded pit events and from lap-time outliers;
 *      the in-lap, the pit lap and the out-lap are dropped.
 *   3. Safety car / VSC laps are dropped.
 *   4. Anything slower than 107% of the remaining median is dropped (traffic, mistakes).
 *   5. "Race pace" is the median of what's left; it's robust to the odd bad lap.
 *   6. Per stint, a least-squares slope gives the lap-time trend (tyre drop-off net of fuel burn).
 *   7. Consistency is the spread of laps around each stint's trend line, so a
 *      driver isn't punished for the natural fuel/tyre curve.
 */

// ─── Small stats helpers ─────────────────────────────────────────────────────

const sum = (a) => a.reduce((s, v) => s + v, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);

export function median(a) {
  if (!a || a.length === 0) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1));
}

/** Least-squares slope and intercept of ys against xs. */
function linearFit(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Lap classification ──────────────────────────────────────────────────────

const PIT_OUTLIER_SECONDS = 8; // a lap this far over the median is a stop (pit loss is ~20s)
const SLOW_LAP_RATIO = 1.07;
const MIN_RANKABLE_LAPS = 5;

/** Expand [start, end] lap ranges (SC, VSC) into a Set of lap numbers. */
export function neutralisedLapSet(replayData) {
  const set = new Set();
  const add = (range) => {
    if (Array.isArray(range) && range.length === 2) {
      for (let l = range[0]; l <= range[1]; l++) set.add(l);
    }
  };
  add(replayData?.scLaps);
  add(replayData?.vscLaps);
  return set;
}

/** Pit laps recorded as events for one driver (quick sim records these). */
export function pitLapsFromEvents(driverName, replayData) {
  const events = Array.isArray(replayData?.events) ? replayData.events : [];
  return events
    .filter((e) => e && e.type === 'PIT_STOP' && e.driver === driverName && Number.isFinite(e.lap))
    .map((e) => e.lap);
}

/**
 * Detect pit laps from lap-time outliers. Neutralised laps are ignored so a
 * safety-car lap isn't mistaken for a stop. Returns sorted lap numbers (1-based).
 */
export function detectPitLaps(lapTimes, { knownPitLaps = [], neutralLaps = new Set() } = {}) {
  const pits = new Set(knownPitLaps.filter((l) => l >= 1 && l <= lapTimes.length));
  const base = median(lapTimes.slice(1).filter((t, i) => !neutralLaps.has(i + 2)));
  if (base > 0) {
    lapTimes.forEach((t, i) => {
      const lap = i + 1;
      if (lap === 1 || neutralLaps.has(lap)) return;
      if (t > base + PIT_OUTLIER_SECONDS) {
        // Don't double count: the stationary time can land on the lap after the in-lap.
        if (!pits.has(lap - 1) && !pits.has(lap + 1)) pits.add(lap);
      }
    });
  }
  return [...pits].sort((a, b) => a - b);
}

/**
 * Analyse one driver's race from their lap times.
 * @returns null when there isn't enough data, otherwise a full breakdown.
 */
export function analyseDriverLaps(lapTimes, { pitLaps = [], neutralLaps = new Set() } = {}) {
  const times = (lapTimes || []).filter((t) => Number.isFinite(t) && t > 0);
  if (times.length < 3) return null;

  const pitSet = new Set(pitLaps);
  const excluded = new Set();
  pitLaps.forEach((p) => { excluded.add(p - 1); excluded.add(p); excluded.add(p + 1); });

  // First pass: lap classification
  const laps = times.map((time, i) => {
    const lap = i + 1;
    let type = 'clean';
    if (lap === 1) type = 'start';
    else if (pitSet.has(lap)) type = 'pit';
    else if (excluded.has(lap)) type = pitSet.has(lap - 1) ? 'out' : 'in';
    else if (neutralLaps.has(lap)) type = 'neutral';
    return { lap, time, type, stint: 0 };
  });

  // Second pass: drop slow laps against the clean median
  const preMedian = median(laps.filter((l) => l.type === 'clean').map((l) => l.time));
  if (preMedian > 0) {
    laps.forEach((l) => {
      if (l.type === 'clean' && l.time > preMedian * SLOW_LAP_RATIO) l.type = 'slow';
    });
  }

  // Stints: a new stint starts on the lap after each stop
  let stint = 0;
  laps.forEach((l) => {
    l.stint = stint;
    if (pitSet.has(l.lap)) stint++;
  });

  const clean = laps.filter((l) => l.type === 'clean');
  if (clean.length === 0) return null;
  const cleanTimes = clean.map((l) => l.time);

  // Stint breakdown with trend line
  const stints = [];
  const residuals = [];
  for (let s = 0; s <= stint; s++) {
    const stintLaps = laps.filter((l) => l.stint === s);
    if (stintLaps.length === 0) continue;
    const stintClean = stintLaps.filter((l) => l.type === 'clean');
    const fit = stintClean.length >= 3
      ? linearFit(stintClean.map((l) => l.lap), stintClean.map((l) => l.time))
      : { slope: 0, intercept: mean(stintClean.map((l) => l.time)) };
    stintClean.forEach((l) => residuals.push(l.time - (fit.intercept + fit.slope * l.lap)));
    const ct = stintClean.map((l) => l.time);
    stints.push({
      index: s + 1,
      startLap: stintLaps[0].lap,
      endLap: stintLaps[stintLaps.length - 1].lap,
      laps: stintLaps.length,
      cleanLaps: stintClean.length,
      median: ct.length ? median(ct) : null,
      best: ct.length ? Math.min(...ct) : null,
      // s/lap; positive = getting slower. Only meaningful with enough laps.
      trend: stintClean.length >= 4 ? fit.slope : null,
      // Pace of the first and last three clean laps — shows the drop-off in plain seconds
      opening: ct.length >= 3 ? mean(ct.slice(0, 3)) : null,
      closing: ct.length >= 6 ? mean(ct.slice(-3)) : null,
    });
  }

  const residualSd = residuals.length >= 3 ? stdev(residuals) : stdev(cleanTimes);
  const trends = stints.filter((s) => s.trend !== null);
  const weightedTrend = trends.length
    ? sum(trends.map((s) => s.trend * s.cleanLaps)) / sum(trends.map((s) => s.cleanLaps))
    : null;

  const half = Math.ceil(times.length / 2);
  const firstHalf = clean.filter((l) => l.lap <= half).map((l) => l.time);
  const secondHalf = clean.filter((l) => l.lap > half).map((l) => l.time);

  return {
    lapsCompleted: times.length,
    laps,
    pitLaps: [...pitSet].sort((a, b) => a - b),
    cleanLapCount: clean.length,
    excludedLapCount: times.length - clean.length,
    median: median(cleanTimes),
    mean: mean(cleanTimes),
    best: Math.min(...cleanTimes),
    bestLapOverall: Math.min(...times.slice(1).length ? times.slice(1) : times),
    worst: Math.max(...cleanTimes),
    stdev: stdev(cleanTimes),
    residualSd,
    // 0.0s scatter → 100, 0.1s → 75, 0.2s → 50, 0.4s+ → 0
    consistency: Math.round(clamp(100 - residualSd * 250, 0, 100)),
    stints,
    trend: weightedTrend,
    firstHalfMedian: firstHalf.length >= 3 ? median(firstHalf) : null,
    secondHalfMedian: secondHalf.length >= 3 ? median(secondHalf) : null,
  };
}

// ─── Whole-race analysis ─────────────────────────────────────────────────────

/**
 * Normalise either a recorded raceHistory driverResult ({ name, team, ... })
 * or a live classification entry ({ driver: {name}, team: {name}, ... }).
 */
function normaliseEntry(entry, idx) {
  const name = entry.name ?? entry.driver?.name;
  const team = typeof entry.team === 'string' ? entry.team : entry.team?.name;
  return {
    name,
    team,
    finishPos: entry.finishPos ?? idx + 1,
    gridPos: entry.gridPos ?? null,
    retired: Boolean(entry.retired),
    lapTimes: Array.isArray(entry.lapTimes) ? entry.lapTimes : [],
    time: entry.time,
  };
}

/**
 * Analyse a full race.
 * @param results  array of driver results in finishing order (either shape)
 * @param replayData  { events, scLaps, vscLaps } — optional
 * @param opts.grid  optional grid array of { driver: { name } } to fill gridPos
 */
export function analyseRace(results, replayData = null, opts = {}) {
  const entries = (results || []).map(normaliseEntry).filter((e) => e.name);
  const neutralLaps = neutralisedLapSet(replayData);
  const raceLaps = Math.max(0, ...entries.map((e) => e.lapTimes.length));
  const minLaps = Math.max(MIN_RANKABLE_LAPS, Math.floor(raceLaps * 0.25));

  if (opts.grid && Array.isArray(opts.grid)) {
    entries.forEach((e) => {
      if (e.gridPos == null) {
        const gi = opts.grid.findIndex((g) => (g.driver?.name ?? g.name) === e.name);
        if (gi >= 0) e.gridPos = gi + 1;
      }
    });
  }

  const drivers = entries.map((e) => {
    const pitLaps = detectPitLaps(e.lapTimes, {
      knownPitLaps: pitLapsFromEvents(e.name, replayData),
      neutralLaps,
    });
    const analysis = analyseDriverLaps(e.lapTimes, { pitLaps, neutralLaps });
    const rankable = Boolean(analysis && analysis.cleanLapCount >= minLaps);
    return { ...e, analysis, rankable, paceRank: null, gapToFastest: null, gapPct: null };
  });

  const ranked = drivers.filter((d) => d.rankable).sort((a, b) => a.analysis.median - b.analysis.median);
  const fastest = ranked[0]?.analysis.median ?? null;
  ranked.forEach((d, i) => {
    d.paceRank = i + 1;
    d.gapToFastest = d.analysis.median - fastest;
    d.gapPct = (d.gapToFastest / fastest) * 100;
  });

  // Fastest single lap of the race (excluding lap 1)
  let fastestLap = null;
  drivers.forEach((d) => {
    d.lapTimes.forEach((t, i) => {
      if (i === 0 || neutralLaps.has(i + 1) || !(t > 0)) return;
      if (!fastestLap || t < fastestLap.time) fastestLap = { name: d.name, team: d.team, lap: i + 1, time: t };
    });
  });

  // Constructor pace = the quicker of its two drivers (best car pace shown on track)
  const teamMap = new Map();
  ranked.forEach((d) => {
    if (!teamMap.has(d.team)) teamMap.set(d.team, []);
    teamMap.get(d.team).push(d);
  });
  const teams = [...teamMap.entries()]
    .map(([team, ds]) => ({
      team,
      median: Math.min(...ds.map((d) => d.analysis.median)),
      avgMedian: mean(ds.map((d) => d.analysis.median)),
      trend: (() => {
        const t = ds.map((d) => d.analysis.trend).filter((v) => v !== null);
        return t.length ? mean(t) : null;
      })(),
      consistency: Math.round(mean(ds.map((d) => d.analysis.consistency))),
      drivers: ds.map((d) => d.name),
      // gap between the two cars, in seconds per lap
      intraGap: ds.length >= 2 ? Math.abs(ds[0].analysis.median - ds[1].analysis.median) : null,
    }))
    .sort((a, b) => a.median - b.median)
    .map((t, i, arr) => ({
      ...t,
      paceRank: i + 1,
      gapToFastest: t.median - arr[0].median,
      gapPct: ((t.median - arr[0].median) / arr[0].median) * 100,
    }));

  return { drivers, ranked, teams, fastest, fastestLap, raceLaps, neutralLaps };
}

/**
 * Race trace: each driver's gap (s) to a reference car running the winner's
 * average lap. A line going up means losing time; down means gaining.
 */
export function buildRaceTrace(results) {
  const entries = (results || []).map(normaliseEntry).filter((e) => e.lapTimes.length > 0);
  const winner = entries.find((e) => !e.retired) || entries[0];
  if (!winner) return { refLap: 0, traces: [] };
  const refLap = sum(winner.lapTimes) / winner.lapTimes.length;
  const traces = entries.map((e) => {
    let cum = 0;
    return {
      name: e.name,
      team: e.team,
      retired: e.retired,
      gaps: e.lapTimes.map((t, i) => {
        cum += t;
        return cum - refLap * (i + 1);
      }),
    };
  });
  return { refLap, traces };
}

/**
 * Position at the end of every lap, derived from cumulative times.
 * Returns Map<driverName, number[]>.
 */
export function buildLapPositions(results) {
  const entries = (results || []).map(normaliseEntry);
  const maxLaps = Math.max(0, ...entries.map((e) => e.lapTimes.length));
  const cum = entries.map((e) => {
    let c = 0;
    return e.lapTimes.map((t) => (c += t));
  });
  const out = new Map(entries.map((e) => [e.name, []]));
  for (let lap = 0; lap < maxLaps; lap++) {
    const order = entries
      .map((e, i) => ({ name: e.name, done: cum[i].length > lap, t: cum[i][lap] }))
      .filter((x) => x.done)
      .sort((a, b) => a.t - b.t);
    order.forEach((x, pos) => out.get(x.name).push(pos + 1));
  }
  return out;
}

// ─── Season aggregation ──────────────────────────────────────────────────────

const raceCache = new WeakMap();

/** Analyse a recorded raceHistory entry, cached per record object. */
export function analyseRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (raceCache.has(record)) return raceCache.get(record);
  const hasLaps = (record.driverResults || []).some((d) => Array.isArray(d.lapTimes) && d.lapTimes.length >= 3);
  const result = hasLaps ? analyseRace(record.driverResults, record.replayData) : null;
  raceCache.set(record, result);
  return result;
}

function seasonRaces(raceHistory, season) {
  return (raceHistory || [])
    .filter((r) => season == null || r.season === season)
    .sort((a, b) => a.round - b.round);
}

/**
 * Season pace profile for one driver.
 */
export function getDriverSeasonPace(driverName, raceHistory, season) {
  const races = [];
  seasonRaces(raceHistory, season).forEach((record) => {
    const a = analyseRecord(record);
    if (!a) return;
    const d = a.drivers.find((x) => x.name === driverName);
    if (!d || !d.analysis) return;
    const mate = a.drivers.find((x) => x.team === d.team && x.name !== d.name && x.rankable);
    const teamRow = a.teams.find((t) => t.team === d.team);
    races.push({
      round: record.round,
      name: record.name,
      circuit: record.circuit,
      finishPos: d.retired ? null : d.finishPos,
      gridPos: d.gridPos,
      retired: d.retired,
      rankable: d.rankable,
      paceRank: d.paceRank,
      fieldSize: a.ranked.length,
      gapToFastest: d.gapToFastest,
      gapPct: d.gapPct,
      median: d.analysis.median,
      best: d.analysis.best,
      consistency: d.analysis.consistency,
      trend: d.analysis.trend,
      stints: d.analysis.stints.length,
      cleanLaps: d.analysis.cleanLapCount,
      teamPaceRank: teamRow?.paceRank ?? null,
      teammate: mate && d.rankable ? { name: mate.name, delta: d.analysis.median - mate.analysis.median } : null,
      fastestLapOfRace: a.fastestLap?.name === driverName,
    });
  });

  const rankedRaces = races.filter((r) => r.rankable);
  const withMate = rankedRaces.filter((r) => r.teammate);
  const trends = rankedRaces.map((r) => r.trend).filter((v) => v !== null);
  const finishedRanked = rankedRaces.filter((r) => r.finishPos != null);

  const summary = rankedRaces.length === 0 ? null : {
    races: rankedRaces.length,
    avgPaceRank: mean(rankedRaces.map((r) => r.paceRank)),
    bestPaceRank: Math.min(...rankedRaces.map((r) => r.paceRank)),
    avgGapPct: mean(rankedRaces.map((r) => r.gapPct)),
    avgGapS: mean(rankedRaces.map((r) => r.gapToFastest)),
    fastestPaceCount: rankedRaces.filter((r) => r.paceRank === 1).length,
    avgConsistency: Math.round(mean(rankedRaces.map((r) => r.consistency))),
    avgTrend: trends.length ? mean(trends) : null,
    teammateRaces: withMate.length,
    teammateAhead: withMate.filter((r) => r.teammate.delta < 0).length,
    teammateMedianDelta: withMate.length ? median(withMate.map((r) => r.teammate.delta)) : null,
    // Positive = finishing better than raw pace suggests (racecraft, strategy, luck)
    conversion: finishedRanked.length
      ? mean(finishedRanked.map((r) => r.paceRank - r.finishPos))
      : null,
    // Recent form: last three ranked races vs season average
    recentGapPct: rankedRaces.length >= 3 ? mean(rankedRaces.slice(-3).map((r) => r.gapPct)) : null,
  };

  return { races, summary };
}

/**
 * Season pace table for every constructor that appears in the history.
 * Sorted quickest first by average gap to the fastest car.
 */
export function getTeamsSeasonPace(raceHistory, season) {
  const byTeam = new Map();
  let analysedRaces = 0;
  seasonRaces(raceHistory, season).forEach((record) => {
    const a = analyseRecord(record);
    if (!a || a.teams.length === 0) return;
    analysedRaces++;
    a.teams.forEach((t) => {
      if (!byTeam.has(t.team)) byTeam.set(t.team, []);
      byTeam.get(t.team).push({ round: record.round, name: record.name, ...t });
    });
  });

  const teams = [...byTeam.entries()].map(([team, races]) => {
    const trends = races.map((r) => r.trend).filter((v) => v !== null);
    const gaps = races.map((r) => r.gapPct);
    const intra = races.map((r) => r.intraGap).filter((v) => v !== null);
    return {
      team,
      races,
      raceCount: races.length,
      avgPaceRank: mean(races.map((r) => r.paceRank)),
      avgGapPct: mean(gaps),
      bestGapPct: Math.min(...gaps),
      worstGapPct: Math.max(...gaps),
      fastestCount: races.filter((r) => r.paceRank === 1).length,
      avgTrend: trends.length ? mean(trends) : null,
      avgConsistency: Math.round(mean(races.map((r) => r.consistency))),
      avgIntraGap: intra.length ? mean(intra) : null,
      recentGapPct: races.length >= 3 ? mean(races.slice(-3).map((r) => r.gapPct)) : null,
    };
  }).sort((a, b) => a.avgGapPct - b.avgGapPct);

  return { teams, analysedRaces };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatLapTime(t) {
  if (!Number.isFinite(t)) return '–';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}

export function formatDelta(t, digits = 3) {
  if (!Number.isFinite(t)) return '–';
  if (Math.abs(t) < 0.5 * 10 ** -digits) return (0).toFixed(digits);
  return `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(digits)}`;
}
