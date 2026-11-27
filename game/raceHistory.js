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

import { buildChampionship } from "../utils/championshipModel.js";

// ─── F1 Points Table ─────────────────────────────────────────────────────────
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

/**
 * Record a completed race into state.raceHistory.
 * Called from weekend.tsx after simulateRaceEvent + updateStandings.
 */
export function recordRaceHistory(round, raceName, circuit, results, standings, state, replayData = null, grid = null) {
  if (!Array.isArray(state.raceHistory)) state.raceHistory = [];

  // Build driver results (position is implicit from array index)
  const driverResults = results.map((entry, idx) => {
    let gridPos = null;
    if (grid && Array.isArray(grid)) {
      const gIndex = grid.findIndex(g => g.driver?.name === entry.driver.name);
      if (gIndex !== -1) gridPos = gIndex + 1;
    }
    
    return {
      name:      entry.driver.name,
      team:      entry.team.name,
      finishPos: idx + 1,
      gridPos:   gridPos,
      // A retired car that completed 90% of the distance is still classified and scores
      points:    entry.retired && !entry.classified ? 0 : (F1_POINTS[idx] || 0),
      retired:   Boolean(entry.retired),
      classified: entry.retired ? Boolean(entry.classified) : true,
      disqualified: Boolean(entry.disqualified),
      lapTimes:  entry.lapTimes || [],
    };
  });

  // Aggregate team results
  const teamPointsMap = {};
  
  // Create a map of current car performance for all teams
  const allTeams = [state.team, ...(state.aiTeams || [])].filter(Boolean);
  const perfMap = {};
  allTeams.forEach(t => perfMap[t.name] = t.carPerformance || 80);

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
    carPerformance: perfMap[team] || 80, // Save projected performance at time of race
  }));

  // Find true fastest lap from lapTimes
  let fastestLapDriver = null;
  let fastestLapTime = Infinity;
  
  driverResults.forEach(r => {
    if (r.lapTimes && r.lapTimes.length > 0) {
      const bestDriverLap = Math.min(...r.lapTimes);
      if (bestDriverLap < fastestLapTime) {
        fastestLapTime = bestDriverLap;
        fastestLapDriver = r.name;
      }
    }
  });

  const fastestLap = fastestLapDriver || (driverResults.find(r => !r.retired)?.name || null);

  const record = {
    round,
    season:   state.season?.year || 1,
    name:     raceName,
    circuit,
    day:      state.season?.currentDay || 0,
    weather:  replayData?.weather || 'dry', // Capture weather if available
    seed:     replayData?.seed ?? null,      // replays the race (with the same inputs)
    driverResults,
    teamResults,
    standingsAfter: {
      drivers: { ...(standings.drivers || {}) },
      teams:   { ...(standings.teams   || {}) },
    },
    fastestLap,
    replayData,
  };

  // A round is recorded once per season: re-processing replaces the old record
  // instead of adding a second one (which would double-count it in the standings).
  state.raceHistory = state.raceHistory.filter(r =>
    !((r.season ?? 1) === record.season && r.round === record.round && r.type !== 'sprint'));
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
    // Every car counts: a P1 and a P3 in the same race are one win and two podiums.
    for (const d of race.driverResults || []) {
      if (d.team !== teamName || d.retired) continue;
      if (d.finishPos === 1) wins++;
      if (d.finishPos <= 3) podiums++;
    }
  });

  // Championship position after each round, with count-back tie-breaks.
  const champ = season != null ? buildChampionship({ raceHistory: races, season: { year: season } }, { season }) : null;
  const standingsProgression = races.map(race => {
    let pos = null;
    const i = champ ? champ.progression.rounds.findIndex(r => r.round === race.round) : -1;
    if (i >= 0) pos = champ.progression.teams[i][teamName]?.pos ?? null;
    else {
      const teams = Object.entries(race.standingsAfter?.teams || {}).sort((a, b) => b[1] - a[1]);
      const idx = teams.findIndex(([t]) => t === teamName);
      pos = idx === -1 ? null : idx + 1;
    }
    return { round: race.round, name: race.name, pos, points: race.teamResults?.find(t => t.team === teamName)?.points || 0 };
  });

  return { wins, podiums, points, racesEntered: races.length, standingsProgression };
}


/**
 * Record a sprint as its own history entry (type: 'sprint'). The championship
 * model adds sprint points on top of the Grand Prix for that round.
 */
export function recordSprintHistory(round, raceName, circuit, results, state, grid = null, seed = null) {
  if (!Array.isArray(state.raceHistory)) state.raceHistory = [];
  const season = state.season?.year || 1;
  const driverResults = results.map((entry, idx) => {
    const g = grid ? grid.findIndex((x) => x.driver?.name === entry.driver.name) : -1;
    return {
      name: entry.driver.name,
      team: entry.team.name,
      finishPos: idx + 1,
      gridPos: g >= 0 ? g + 1 : null,
      points: entry.retired && !entry.classified ? 0 : (SPRINT_POINTS[idx] || 0),
      retired: Boolean(entry.retired),
      classified: entry.retired ? Boolean(entry.classified) : true,
      lapTimes: entry.lapTimes || [],
    };
  });
  const record = { type: 'sprint', round, season, name: `${raceName} Sprint`, circuit, day: state.season?.currentDay || 0, driverResults, seed };
  state.raceHistory = state.raceHistory.filter((r) => !(r.type === 'sprint' && (r.season ?? 1) === season && r.round === round));
  // Keep the sprint before that round's Grand Prix in the history
  const gpIdx = state.raceHistory.findIndex((r) => r.type !== 'sprint' && (r.season ?? 1) === season && r.round === round);
  if (gpIdx >= 0) state.raceHistory.splice(gpIdx, 0, record);
  else state.raceHistory.push(record);
  return record;
}
