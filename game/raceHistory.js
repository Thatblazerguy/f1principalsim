/**
 * raceHistory.js
 * ──────────────
 * Utilities for recording completed race data and querying form / stats.
 *
 * RaceRecord shape:
 * {
 *   round:         number,
 *   season:        number,
 *   name:          string,   // "Monaco Grand Prix"
 *   circuit:       string,   // "Circuit de Monaco"
 *   day:           number,   // state.season.currentDay at time of race
 *   driverResults: Array<{ name, team, finishPos, points, retired }>,
 *   teamResults:   Array<{ team, points, finishPos }>,
 *   standingsAfter:{ drivers: {}, teams: {} },
 *   fastestLap:    string | null,
 * }
 */

// ─── F1 Points Table ─────────────────────────────────────────────────────────
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * Record a completed race into state.raceHistory.
 * Called from weekend.tsx after simulateRaceEvent + updateStandings.
 */
export function recordRaceHistory(round, raceName, circuit, results, standings, state, replayData = null) {
  if (!Array.isArray(state.raceHistory)) state.raceHistory = [];

  // Build driver results (position is implicit from array index)
  const driverResults = results.map((entry, idx) => ({
    name:      entry.driver.name,
    team:      entry.team.name,
    finishPos: idx + 1,
    points:    entry.retired ? 0 : (F1_POINTS[idx] || 0),
    retired:   Boolean(entry.retired),
  }));

  // Aggregate team results
  const teamPointsMap = {};
  driverResults.forEach(r => {
    if (!teamPointsMap[r.team]) teamPointsMap[r.team] = { points: 0, bestPos: 99 };
    teamPointsMap[r.team].points += r.points;
    if (r.finishPos < teamPointsMap[r.team].bestPos) {
      teamPointsMap[r.team].bestPos = r.finishPos;
    }
  });
  const teamResults = Object.entries(teamPointsMap).map(([team, data]) => ({
    team,
    points: data.points,
    bestPos: data.bestPos,
  }));

  // Fastest lap = first non-retired driver (simplification — race sim doesn't track it separately)
  const fastestLap = driverResults.find(r => !r.retired)?.name || null;

  const record = {
    round,
    season:   state.season?.year || 1,
    name:     raceName,
    circuit,
    day:      state.season?.currentDay || 0,
    driverResults,
    teamResults,
    standingsAfter: {
      drivers: { ...(standings.drivers || {}) },
      teams:   { ...(standings.teams   || {}) },
    },
    fastestLap,
    replayData,
  };

  state.raceHistory.push(record);
}

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Get the last `limit` race results for a specific driver.
 * Returns array of { round, name, circuit, finishPos, points, retired } (oldest → newest).
 */
export function getDriverForm(driverName, raceHistory, limit = 5) {
  if (!raceHistory?.length) return [];
  const relevant = raceHistory
    .map(race => {
      const r = race.driverResults?.find(d => d.name === driverName);
      if (!r) return null;
      return { round: race.round, name: race.name, circuit: race.circuit, season: race.season, finishPos: r.finishPos, points: r.points, retired: r.retired };
    })
    .filter(Boolean);
  return relevant.slice(-limit);
}

/**
 * Get the last `limit` race results for a constructor.
 */
export function getTeamForm(teamName, raceHistory, limit = 5) {
  if (!raceHistory?.length) return [];
  const relevant = raceHistory
    .map(race => {
      const r = race.teamResults?.find(t => t.team === teamName);
      if (!r) return null;
      return { round: race.round, name: race.name, circuit: race.circuit, season: race.season, bestPos: r.bestPos, points: r.points };
    })
    .filter(Boolean);
  return relevant.slice(-limit);
}

/**
 * Compute a momentum score (0–100) from recent form results.
 * Used to replace the fabricated momentum column.
 */
export function getMomentumScore(formResults) {
  if (!formResults?.length) return 50;
  const WEIGHTS = { 1: 10, 2: 8, 3: 6 };
  let score = 0;
  formResults.forEach((r, i) => {
    const recency = (i + 1) / formResults.length; // newer = higher weight
    const base = r.retired ? -3 :
                 (WEIGHTS[r.finishPos] || (r.finishPos <= 10 ? 3 : 1));
    score += base * recency;
  });
  // Normalize to 0-100
  return Math.min(100, Math.max(0, Math.round(50 + score * 5)));
}

/**
 * Get a weekend-confidence value (0.92–1.08) for a driver based on their
 * last `limit` race results. This is consumed by the race simulator and
 * qualifying module to adjust per-driver performance.
 *
 * Value < 1.00 = driver in good form (performs better than base rating)
 * Value > 1.00 = driver in poor form (performs slightly worse)
 *
 * @param {string} driverName
 * @param {Array}  raceHistory
 * @param {number} [limit=5]
 * @returns {number} multiplier in range 0.92 – 1.08
 */
export function getDriverWeekendConfidence(driverName, raceHistory, limit = 5) {
  const form = getDriverForm(driverName, raceHistory, limit);
  if (!form.length) return 1.00;

  let weightedScore = 0;
  let totalWeight = 0;

  form.forEach((r, i) => {
    const weight = (i + 1) / form.length; // newer races weighted higher
    let score;
    if (r.retired) {
      score = -8;
    } else if (r.finishPos === 1) {
      score = 8;
    } else if (r.finishPos <= 3) {
      score = 5;
    } else if (r.finishPos <= 6) {
      score = 2;
    } else if (r.finishPos <= 10) {
      score = 1;
    } else {
      score = -1;
    }
    weightedScore += score * weight;
    totalWeight += weight;
  });

  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  // Good form (positive score) → lower multiplier (driver performs better)
  const rawMultiplier = 1.00 - (normalizedScore / 8) * 0.08;
  return Math.min(1.08, Math.max(0.92, rawMultiplier));
}

/**
 * Aggregate per-driver season stats from raceHistory.
 */
export function getDriverSeasonStats(driverName, raceHistory, season) {
  const races = raceHistory.filter(r => (season == null || r.season === season));
  let wins = 0, podiums = 0, points = 0, top10 = 0, dnf = 0, finishes = [];

  races.forEach(race => {
    const r = race.driverResults?.find(d => d.name === driverName);
    if (!r) return;
    points += r.points;
    if (r.retired) { dnf++; return; }
    finishes.push(r.finishPos);
    if (r.finishPos === 1) wins++;
    if (r.finishPos <= 3) podiums++;
    if (r.finishPos <= 10) top10++;
  });

  const avgFinish = finishes.length ? Math.round(finishes.reduce((a, b) => a + b, 0) / finishes.length) : null;
  const bestFinish = finishes.length ? Math.min(...finishes) : null;

  return { wins, podiums, points, top10, dnf, avgFinish, bestFinish, racesEntered: races.length };
}

/**
 * Aggregate per-team season stats from raceHistory.
 */
export function getTeamSeasonStats(teamName, raceHistory, season) {
  const races = raceHistory.filter(r => (season == null || r.season === season));
  let wins = 0, podiums = 0, points = 0, positions = [];

  races.forEach(race => {
    const r = race.teamResults?.find(t => t.team === teamName);
    if (!r) return;
    points += r.points;
    positions.push(r.bestPos);
    if (r.bestPos === 1) wins++;
    if (r.bestPos <= 3) podiums++;
  });

  const standingsProgression = races.map(race => {
    const teams = Object.entries(race.standingsAfter?.teams || {})
      .sort((a, b) => b[1] - a[1]);
    const pos = teams.findIndex(([t]) => t === teamName);
    return { round: race.round, name: race.name, pos: pos === -1 ? null : pos + 1, points: race.teamResults?.find(t => t.team === teamName)?.points || 0 };
  });

  return { wins, podiums, points, racesEntered: races.length, standingsProgression };
}
