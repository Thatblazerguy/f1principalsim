/**
 * dashboardModel.js
 * ─────────────────
 * Pure read-only helpers for the dashboard's interactive charts and the rival
 * head-to-head drawer. Everything is derived from existing game state:
 *   - state.raceHistory[].standingsAfter.teams  → cumulative constructors' points per round
 *   - state.finance.raceReports                 → per-race income / spend / balance
 *   - getCarSpecs / getTeamSeasonStats / getTeamForm (existing engines)
 * Nothing here mutates state.
 */
import { buildChampionship, getConstructorOrder } from "./championshipModel.js";
import { getCarSpecs } from "./simTeam.js";
import { getTeamSeasonStats, getTeamForm } from "../game/raceHistory.js";

const round1 = (v) => Number((v || 0).toFixed(1));

/** Completed races of the current season, one per round, oldest first. */
export function getSeasonRaces(state) {
  const season = state.season?.year || 1;
  const byRound = new Map();
  for (const race of state.raceHistory || []) {
    if ((race.season ?? 1) !== season) continue;
    byRound.set(race.round, race); // last record for a round wins
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round);
}

/**
 * Cumulative constructors' points per completed round.
 * Uses the standings snapshot saved with each race (includes sprint points);
 * falls back to summing teamResults when an old record has no snapshot.
 *
 * Returns { rounds: [{ round, name, totals: {team: pts}, leader, leaderPoints }], series: [{ name, isPlayer, points: number[] }] }
 * where series.points[i] is the total after rounds[i]. Series = player + top `rivals` other teams by current points.
 */
export function getChampionshipSeries(state, rivals = 4) {
  const races = getSeasonRaces(state);
  const champ = buildChampionship(state);
  const allNames = [state.team, ...(state.aiTeams || [])].filter(Boolean).map((t) => t.name);
  const running = Object.fromEntries(allNames.map((n) => [n, 0]));

  const rounds = races.map((race) => {
    for (const tr of race.teamResults || []) running[tr.team] = (running[tr.team] || 0) + (tr.points || 0);
    const snap = race.standingsAfter?.teams;
    const totals = {};
    for (const n of allNames) totals[n] = snap && snap[n] != null ? snap[n] : running[n] || 0;
    // Leader after this round, with count-back on equal points.
    const snap2 = champ.progression.teams[champ.progression.rounds.findIndex((p) => p.round === race.round)] || {};
    let leader = Object.keys(snap2).find((n) => snap2[n].pos === 1) || allNames[0];
    if (!(leader in totals)) leader = allNames[0];
    return { round: race.round, name: race.name, totals, leader, leaderPoints: totals[leader] || 0 };
  });

  const order = new Map(getConstructorOrder(state).map((t) => [t.name, t.pos]));
  const others = allNames
    .filter((n) => n !== state.team?.name)
    .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .slice(0, rivals);
  const names = [state.team?.name, ...others].filter(Boolean);
  const series = names.map((name) => ({
    name,
    isPlayer: name === state.team?.name,
    points: rounds.map((r) => r.totals[name] || 0),
  }));
  return { rounds, series };
}

/**
 * Per-race money from the finance engine's race reports (processRaceFinance).
 * income = raceIncome + prizeMoney + merchandiseSales (the engine's `income`),
 * spend  = income − netProfit (operating costs + salaries + sponsor penalties),
 * balance = team budget right after that race's finance was processed.
 * `startBalance` is the budget before the first race's report.
 */
export function getBudgetSeries(state) {
  const season = state.season?.year || 1;
  const reports = (state.finance?.raceReports || [])
    .filter((r) => (r.season ?? 1) === season)
    .sort((a, b) => a.round - b.round);
  const points = reports.map((r) => {
    const income = round1((r.raceIncome || 0) + (r.prizeMoney || 0) + (r.merchandiseSales || 0));
    const net = round1(r.netProfit || 0);
    return { round: r.round, name: r.raceName, income, spend: round1(income - net), net, balance: round1(r.runningSeasonBalance) };
  });
  const startBalance = points.length ? round1(points[0].balance - points[0].net) : null;
  return { points, startBalance };
}

const driverRating = (d) => Math.round(((d.pace || 0) + (d.quali || 0) + (d.racecraft || 0) + (d.consistency || 0)) / 4);

/** Head-to-head numbers for one team (player or rival). Only tracked fields. */
export function getTeamProfile(state, team, raceDrivers) {
  const season = state.season?.year || 1;
  const history = (state.raceHistory || []).filter((r) => (r.season ?? 1) === season);
  const all = [state.team, ...(state.aiTeams || [])].filter(Boolean);
  const table = getConstructorOrder(state);
  const stats = getTeamSeasonStats(team.name, history, season);
  const specs = getCarSpecs(team);
  const drivers = (raceDrivers || team.drivers || []).slice(0, 2).filter(Boolean);
  return {
    name: team.name,
    position: table.findIndex((t) => t.name === team.name) + 1,
    points: state.standings?.teams?.[team.name] || 0,
    wins: stats.wins,
    podiums: stats.podiums,
    races: stats.racesEntered,
    car: {
      overall: Math.round(specs.ovr ?? team.carPerformance ?? 0),
      aero: Math.round(specs.aero ?? 0),
      chassis: Math.round(specs.chassis ?? 0),
      reliability: Math.round(specs.reliability ?? 0),
    },
    powerUnit: team.powerUnit || null,
    drivers: drivers.map((d) => ({
      name: d.name,
      rating: driverRating(d),
      points: state.standings?.drivers?.[d.name] || 0,
      pace: d.pace, quali: d.quali, racecraft: d.racecraft, consistency: d.consistency,
    })),
    form: getTeamForm(team.name, history, 5), // [{ round, name, bestPos, points }]
  };
}
