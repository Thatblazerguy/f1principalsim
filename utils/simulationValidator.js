/**
 * simulationValidator.js
 * ──────────────────────
 * Headless 100-season simulation validator.
 * Run from browser console: import('/utils/simulationValidator.js').then(m => m.runValidation())
 *
 * Output:
 *  - Average championship points per position after 10 races
 *  - Average championship points per position after full season (24 races)
 *  - DNF rate per team
 *  - Wet race frequency
 *  - Average grid-to-finish position delta per driver
 *  - Podium distribution across teams
 *  - Surprise wins (non-top-3 team winning a race)
 *
 * This tool NEVER modifies game state — it clones all data before running.
 */

import { simulateRaceEvent } from "../game/raceSimulator.js";
import { simulateQualifying } from "../game/qualifying.js";
import { updateStandings } from "../game/standings.js";
import { applyRoundCarDevelopment } from "./carDevelopment.js";
import { createAiTeams } from "../data/teams.js";
import { calendar } from "../data/calendar.js";

// ─── Deep clone helpers ────────────────────────────────────────────────────────

function cloneDriver(d) {
  return {
    name: d.name,
    pace: d.pace,
    quali: d.quali,
    racecraft: d.racecraft,
    consistency: d.consistency,
    tyre: d.tyre,
    wet: d.wet,
    age: d.age,
    errorChance: () => (100 - d.consistency) / 100,
    overallRating: () => Math.round((d.pace + d.quali + d.racecraft + d.consistency + d.tyre + d.wet) / 6),
    currentRating: () => Math.round((d.pace + d.quali + d.racecraft + d.consistency) / 4),
  };
}

function cloneTeam(t) {
  return {
    name: t.name,
    carPerformance: t.carPerformance,
    specs: t.specs ? { ...t.specs } : undefined,
    engineProfile: t.engineProfile,
    drivers: t.drivers.map(cloneDriver),
  };
}

// ─── Single season simulation ─────────────────────────────────────────────────

function simulateSeason(teams, racesToRun = 24) {
  const raceHistory = [];
  const standings = { drivers: {}, teams: {} };

  // Pre-register all drivers/teams
  teams.forEach(t => {
    standings.teams[t.name] = 0;
    t.drivers.forEach(d => { standings.drivers[d.name] = 0; });
  });

  const dnfCounts = {};
  const podiumCounts = {};
  const winCounts = {};
  const teamWins = {};
  const teamPodiums = {};
  let wetRaces = 0;
  let totalGridDelta = 0;
  let totalGridDeltaCount = 0;

  const trackCount = Math.min(racesToRun, calendar.length);

  for (let roundIdx = 0; roundIdx < trackCount; roundIdx++) {
    const track = calendar[roundIdx];

    // Qualifying
    const { grid, isWet } = simulateQualifying(teams, track, raceHistory);
    if (isWet) wetRaces++;

    // Race
    const results = simulateRaceEvent(teams, track, track.laps, grid, {}, raceHistory);

    // Record standings
    updateStandings(results, standings);

    // Record per-driver stats
    results.forEach((r, idx) => {
      const pos = idx + 1;
      const name = r.driver.name;
      const teamName = r.team.name;

      if (r.retired) {
        dnfCounts[name] = (dnfCounts[name] || 0) + 1;
      } else {
        // Grid-to-finish delta
        const qualiIdx = grid.findIndex(e => e.driver.name === name);
        if (qualiIdx >= 0) {
          totalGridDelta += Math.abs(qualiIdx - idx);
          totalGridDeltaCount++;
        }

        if (pos === 1) {
          winCounts[name]  = (winCounts[name]  || 0) + 1;
          teamWins[teamName] = (teamWins[teamName] || 0) + 1;
        }
        if (pos <= 3) {
          podiumCounts[name]   = (podiumCounts[name]   || 0) + 1;
          teamPodiums[teamName] = (teamPodiums[teamName] || 0) + 1;
        }
      }
    });

    // Record minimal history for form tracking
    const driverResults = results.map((r, idx) => ({
      name: r.driver.name,
      team: r.team.name,
      finishPos: idx + 1,
      points: r.retired ? 0 : ([25,18,15,12,10,8,6,4,2,1][idx] || 0),
      retired: Boolean(r.retired),
    }));
    raceHistory.push({ round: roundIdx + 1, driverResults });

    // Apply car development each round
    teams.forEach(applyRoundCarDevelopment);
  }

  return {
    standings,
    dnfCounts,
    podiumCounts,
    winCounts,
    teamWins,
    teamPodiums,
    wetRaces,
    trackCount,
    avgGridDelta: totalGridDeltaCount > 0
      ? (totalGridDelta / totalGridDeltaCount).toFixed(2)
      : "N/A",
  };
}

// ─── Main validator ────────────────────────────────────────────────────────────

/**
 * Run N seasons and aggregate statistics.
 * @param {number} [seasons=100]    Number of seasons to simulate
 * @param {number} [races=10]       Races per season to measure at
 * @param {boolean} [verbose=false] Print per-season breakdown
 */
export async function runValidation(seasons = 100, races = 10, verbose = false) {
  console.log(`\n🏁 F1 Simulation Validator — ${seasons} seasons × ${races} races\n`);
  console.log("Loading teams...");

  const baseTeams = createAiTeams();
  const allTeamNames = baseTeams.map(t => t.name);

  // Aggregation
  const seasonStandings   = []; // [ { P1pts, P2pts, ..., P10pts } ]
  const allDNFCounts      = {}; // teamName → total DNFs
  const allTeamWins       = {}; // teamName → total wins
  const allTeamPodiums    = {}; // teamName → total podiums
  let   totalWetRaces     = 0;
  let   totalRaces        = 0;
  const gridDeltaList     = [];

  allTeamNames.forEach(t => {
    allDNFCounts[t]  = 0;
    allTeamWins[t]   = 0;
    allTeamPodiums[t] = 0;
  });

  const start = performance.now();

  for (let s = 0; s < seasons; s++) {
    // Clone fresh teams each season
    const teams = createAiTeams().map(cloneTeam);

    const result = simulateSeason(teams, races);
    totalWetRaces += result.wetRaces;
    totalRaces    += result.trackCount;

    if (result.avgGridDelta !== "N/A") {
      gridDeltaList.push(parseFloat(result.avgGridDelta));
    }

    // Sort standings for this season
    const driverRanking = Object.entries(result.standings.drivers)
      .sort((a, b) => b[1] - a[1])
      .map(([, pts]) => pts);

    seasonStandings.push(driverRanking);

    // Accumulate team stats
    allTeamNames.forEach(tn => {
      // Sum DNFs for all drivers on this team
      const freshTeams = createAiTeams();
      const teamDriverNames = freshTeams.find(t => t.name === tn)?.drivers.map(d => d.name) || [];
      teamDriverNames.forEach(dn => {
        allDNFCounts[tn] += (result.dnfCounts[dn] || 0);
      });
      allTeamWins[tn]    += (result.teamWins[tn]    || 0);
      allTeamPodiums[tn] += (result.teamPodiums[tn] || 0);
    });

    if (verbose && s < 5) {
      const top3 = Object.entries(result.standings.drivers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([n, p]) => `${n}: ${p}pts`)
        .join(" | ");
      console.log(`  Season ${s + 1}: ${top3}`);
    }
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);

  // ── Compute averages ──────────────────────────────────────────────────────

  const positions = 10;
  const avgByPosition = Array.from({ length: positions }, (_, i) => {
    const vals = seasonStandings
      .filter(s => s.length > i)
      .map(s => s[i]);
    if (!vals.length) return { pos: i + 1, avg: 0, min: 0, max: 0 };
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { pos: i + 1, avg, min, max };
  });

  const wetPct = totalRaces > 0 ? ((totalWetRaces / totalRaces) * 100).toFixed(1) : "0";
  const avgGridDelta = gridDeltaList.length
    ? (gridDeltaList.reduce((a, b) => a + b, 0) / gridDeltaList.length).toFixed(2)
    : "N/A";

  // ── Print report ──────────────────────────────────────────────────────────

  console.log(`\n✅ Completed ${seasons} seasons in ${elapsed}s\n`);

  console.log(`═══════════════════════════════════════════════════`);
  console.log(` CHAMPIONSHIP POINTS DISTRIBUTION (after ${races} races)`);
  console.log(`═══════════════════════════════════════════════════`);
  const targets = [
    [250,330],[220,300],[180,280],[140,220],[100,180],
    [60,140],[40,120],[20,90],[5,60],[0,40]
  ];
  avgByPosition.forEach(({ pos, avg, min, max }, i) => {
    const [tMin, tMax] = targets[i] || [0, 999];
    const inRange = avg >= tMin && avg <= tMax;
    const flag = inRange ? "✅" : "⚠️ ";
    console.log(`  P${pos.toString().padEnd(2)} avg: ${avg.toString().padEnd(4)} (range: ${min}–${max}) target: ${tMin}–${tMax} ${flag}`);
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` RACE CONDITIONS`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Wet race frequency:     ${wetPct}%  (target: ~16–22%)`);
  console.log(`  Avg grid-to-finish Δ:   ${avgGridDelta} places (target: ≥2.5)`);

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` TEAM DNF RATES (per race)`);
  console.log(`═══════════════════════════════════════════════════`);
  const racesPerTeam = seasons * races;
  allTeamNames.forEach(tn => {
    const dnfRate = ((allDNFCounts[tn] / (racesPerTeam * 2)) * 100).toFixed(1);
    console.log(`  ${tn.padEnd(20)} ${dnfRate}% DNF/race`);
  });

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(` WINS & PODIUMS (total over ${seasons} seasons × ${races} races)`);
  console.log(`═══════════════════════════════════════════════════`);
  const sortedByWins = allTeamNames
    .map(tn => ({ tn, wins: allTeamWins[tn], pods: allTeamPodiums[tn] }))
    .sort((a, b) => b.wins - a.wins);
  sortedByWins.forEach(({ tn, wins, pods }) => {
    const winRate = ((wins / (seasons * races)) * 100).toFixed(1);
    const podRate = ((pods / (seasons * races * 3)) * 100).toFixed(1);
    console.log(`  ${tn.padEnd(20)} wins: ${wins.toString().padEnd(6)} (${winRate}%) | podiums: ${pods} (${podRate}%)`);
  });

  // Surprise wins = wins by non-top-4 teams
  const top4Teams = sortedByWins.slice(0, 4).map(x => x.tn);
  const surpriseWins = sortedByWins
    .filter(x => !top4Teams.includes(x.tn))
    .reduce((sum, x) => sum + x.wins, 0);
  console.log(`\n  Surprise wins (non-top-4 teams): ${surpriseWins} (${((surpriseWins / (seasons * races)) * 100).toFixed(1)}%)`);

  console.log(`\n═══════════════════════════════════════════════════`);

  return {
    avgByPosition,
    wetPct,
    avgGridDelta,
    allDNFCounts,
    allTeamWins,
    allTeamPodiums,
    surpriseWins,
  };
}
