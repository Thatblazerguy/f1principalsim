/**
 * raceForecast.js
 * ───────────────
 * Monte Carlo forecast of a Grand Prix, used to set race objectives.
 *
 * Every car is modelled with the same pace profile the race engines use
 * (game/paceModel.js), so the forecast reflects:
 *   - team performance: car rating (including the player's engineering
 *     upgrades), driver skill, current form, weekend setup quality
 *   - track conditions: how each car suits this circuit, tyre wear, how hard
 *     it is to overtake here, and the weather — rain is drawn with the track's
 *     rain probability until qualifying settles it
 *   - the grid: the real qualifying result once it exists, otherwise a
 *     simulated qualifying per run
 *   - reliability: per-lap retirement risk from getDNFPerLap
 *
 * Races are played out lap by lap with the strategy rollout simulator
 * (traffic, overtaking, pit stops), from a seeded RNG so a forecast is stable.
 */

import { buildPaceProfile, gaussian, getOvertakingDifficulty } from "../game/paceModel.js";
import { createGridSnapshot, advanceSnapshot } from "../game/strategy/strategyRollout.js";
import { mulberry32, hashString } from "../game/setup/carSetup.js";
import { getDNFPerLap, getTrackWetProbability } from "./raceBalance.js";

const QUALI_NOISE = 0.22;     // s, lap-to-lap qualifying scatter
const QUALI_WET_NOISE = 0.55;

/**
 * @param {object} p
 * @param {Array}  p.teams       all teams (player first is fine); each with drivers
 * @param {object} p.playerTeam  the player's team (matched by name)
 * @param {object} p.track       calendar round
 * @param {number|null} p.wetProbability  0–1 chance of rain; ignored when isWet is known
 * @param {boolean|null} p.isWet known weather (after qualifying), or null
 * @param {Array|null} p.grid    qualifying grid [{ driver, team }], or null
 * @param {object|null} p.weekendContext  setup quality / form per driver
 * @param {object|null} p.appState
 * @param {number} p.sims
 * @param {string|number} p.seed
 */
export function forecastRace({
  teams, playerTeam, track, wetProbability = null, isWet = null, grid = null,
  weekendContext = null, appState = null, sims = 300, seed = "forecast",
}) {
  const rng = mulberry32(typeof seed === "number" ? seed : hashString(String(seed)));
  const totalLaps = track.laps || 57;
  const difficulty = getOvertakingDifficulty(track);
  const pWet = isWet != null ? (isWet ? 1 : 0)
    : wetProbability != null ? wetProbability
    : getTrackWetProbability(`${track.name || ""} ${track.circuit || ""}`);

  // Entries with dry and wet pace profiles, built once.
  const entries = teams.flatMap((team) => (team.drivers || []).map((driver) => ({
    id: driver.name,
    team: team.name,
    isPlayer: team.name === playerTeam.name,
    dry: buildPaceProfile({ team, driver, track, isWet: false, weekendContext, appState }),
    wet: buildPaceProfile({ team, driver, track, isWet: true, weekendContext, appState }),
    dnfPerLap: getDNFPerLap(team, driver),
  })));
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const gridOrder = grid?.length
    ? grid.map((g) => g.driver?.name).filter((name) => byId[name])
    : null;
  const gridPos = gridOrder ? Object.fromEntries(gridOrder.map((id, i) => [id, i + 1])) : null;

  const finishes = Object.fromEntries(entries.map((e) => [e.id, []]));
  let wetRuns = 0;

  for (let s = 0; s < sims; s++) {
    const wet = rng() < pWet;
    if (wet) wetRuns++;
    const prof = (e) => (wet ? e.wet : e.dry);

    // Grid: the real one, or a simulated qualifying
    const order = gridOrder
      ? gridOrder.map((id) => byId[id])
      : entries
        .map((e) => ({ e, t: prof(e).staticDelta + gaussian(rng) * (wet ? QUALI_WET_NOISE : QUALI_NOISE) }))
        .sort((a, b) => a.t - b.t)
        .map((x) => x.e);
    // Cars missing from a stored grid (e.g. a reserve called up) start at the back
    const missing = entries.filter((e) => !order.includes(e));
    const fullOrder = [...order, ...missing];

    const start = createGridSnapshot({
      grid: fullOrder.map((e) => ({ id: e.id, profile: prof(e) })),
      totalLaps, difficulty, isWet: wet, trackName: track.name, rng,
    });
    const end = advanceSnapshot(start, totalLaps, rng);

    // Retirements: lap of failure drawn from the per-lap risk
    const retiredAt = {};
    for (const e of entries) {
      const u = Math.max(1e-12, rng());
      const lap = Math.ceil(Math.log(u) / Math.log(1 - e.dnfPerLap));
      if (lap <= totalLaps) retiredAt[e.id] = lap;
    }
    const running = end.cars.filter((c) => !retiredAt[c.id]).map((c) => c.id);
    const retired = Object.keys(retiredAt).sort((a, b) => retiredAt[b] - retiredAt[a]);
    [...running, ...retired].forEach((id, i) => {
      finishes[id].push(retiredAt[id] ? { pos: i + 1, dnf: true } : { pos: i + 1, dnf: false });
    });
  }

  return summarise({ entries, finishes, playerTeam, gridPos, sims, wetRuns, pWet, difficulty, track, teams });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))];

function summarise({ entries, finishes, playerTeam, gridPos, sims, wetRuns, pWet, difficulty, track, teams }) {
  const ours = entries.filter((e) => e.isPlayer);
  const teamNames = [...new Set(entries.map((e) => e.team))];

  // Team-level results per simulated race
  const bestOf = (team, s) => Math.min(...entries.filter((e) => e.team === team).map((e) => finishes[e.id][s].pos));
  const runs = [];
  for (let s = 0; s < sims; s++) {
    const r = ours.map((e) => finishes[e.id][s]);
    runs.push({
      best: Math.min(...r.map((x) => x.pos)),
      worst: Math.max(...r.map((x) => x.pos)),
      anyDnf: r.some((x) => x.dnf),
      allDnf: r.every((x) => x.dnf),
      points: r.filter((x) => !x.dnf && x.pos <= 10).length,
      gains: gridPos ? ours.map((e) => (gridPos[e.id] ? gridPos[e.id] - finishes[e.id][s].pos : 0)) : null,
      held: gridPos ? ours.map((e) => !finishes[e.id][s].dnf && gridPos[e.id] && finishes[e.id][s].pos <= gridPos[e.id]) : null,
    });
  }
  const p = (fn) => runs.filter(fn).length / sims;
  const bestSorted = runs.map((r) => r.best).sort((a, b) => a - b);

  // Head-to-head against every other team: P(our best car beats theirs)
  const beatTeam = {};
  for (const team of teamNames) {
    if (team === playerTeam.name) continue;
    let wins = 0;
    for (let s = 0; s < sims; s++) if (runs[s].best < bestOf(team, s)) wins++;
    beatTeam[team] = wins / sims;
  }

  // Pace picture on this circuit (dry): team ranking by best driver's pace
  const teamPace = teamNames.map((team) => ({
    team,
    delta: Math.min(...entries.filter((e) => e.team === team).map((e) => e.dry.staticDelta)),
  })).sort((a, b) => a.delta - b.delta);
  const paceRank = teamPace.findIndex((t) => t.team === playerTeam.name) + 1;
  const ourBest = ours.reduce((a, e) => (e.dry.staticDelta < a.dry.staticDelta ? e : a), ours[0]);

  const posProbs = (n) => p((r) => r.best <= n);
  return {
    sims,
    rainChance: pWet,
    wetShare: wetRuns / sims,
    overtakingDifficulty: difficulty,
    tyreWear: track.tyreWear ?? 1.2,
    paceRank,
    teamsCount: teamNames.length,
    gapToFastest: ourBest ? ourBest.dry.staticDelta - teamPace[0].delta : 0,
    circuitFit: ourBest ? ourBest.dry.circuitDelta : 0,
    expectedBest: mean(runs.map((r) => r.best)),
    bestRange: [quantile(bestSorted, 0.2), quantile(bestSorted, 0.8)],
    probs: {
      win: posProbs(1),
      podium: posProbs(3),
      top5: posProbs(5),
      top6: posProbs(6),
      points: p((r) => r.best <= 10 && r.points > 0),
      bothPoints: p((r) => r.points >= 2),
      oneTwo: p((r) => r.best === 1 && r.worst === 2),
      classified: p((r) => !r.allDnf),
      cleanWeekend: p((r) => !r.anyDnf),
      gain3: gridPos ? p((r) => Math.max(...r.gains) >= 3) : null,
      holdGrid: gridPos ? p((r) => r.held.some(Boolean)) : null,
    },
    positionProb: (n) => posProbs(n),
    beatTeam,
    drivers: Object.fromEntries(ours.map((e) => {
      const f = finishes[e.id];
      return [e.id, { expected: mean(f.map((x) => x.pos)), dnfRate: f.filter((x) => x.dnf).length / sims, grid: gridPos?.[e.id] ?? null }];
    })),
  };
}
