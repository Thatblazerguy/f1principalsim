import { constructorEntries, driverEntries } from "./championshipModel.js";
import { state } from "../state.js";
import { getCircuitProfile } from "./devProjects.js";
import { forecastRace } from "./raceForecast.js";
import { getTrackWetProbability } from "./raceBalance.js";
import { getActiveDrivers } from "./teamState.js";
import { hashString } from "../game/setup/carSetup.js";

/*
 * Race objectives are set from a Monte Carlo forecast of the Grand Prix
 * (utils/raceForecast.js): every car's pace on this circuit, current form,
 * weather, the grid once qualifying has run, and reliability. The targets
 * offered, their success probabilities and their explanations all come from
 * that forecast.
 */

// ============================================
// UTILITIES
// ============================================
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const pct = (val) => Math.round(clamp(val, 1, 99));

// ============================================
// 1. INPUTS: TEAMS, WEATHER, HISTORY
// ============================================

const FORECAST_SIMS = 300;
const HOT_COUNTRIES = ["bahrain", "saudi", "qatar", "uae", "abu dhabi", "singapore", "mexico", "usa", "miami", "hungary", "spain", "brazil", "azerbaijan"];

/** Teams as they'll race: the player's active drivers, flagged so engineering upgrades count. */
function raceTeams(appState) {
  const player = appState.team;
  const active = (getActiveDrivers(player) || player.drivers || []).slice(0, 2);
  return [{ ...player, drivers: active, isPlayerTeam: true }, ...(appState.aiTeams || [])];
}

/**
 * Weekend weather. Before qualifying it's a forecast (the track's rain
 * probability); once qualifying has run, its weather is the race weather.
 * Temperatures are stable for a given season and round.
 */
export function getWeekendWeather(appState, round) {
  const rulesOff = appState.season?.rules?.weather === false;
  const rainChance = rulesOff ? 0 : getTrackWetProbability(`${round.name || ""} ${round.circuit || ""}`);
  const wp = appState.weekendProgress;
  const known = wp && wp.round === round.round && wp.qualifyingComplete && typeof wp.isWet === "boolean" ? wp.isWet : null;
  const h = hashString(`${appState.season?.year || 1}-${round.round}-${round.circuit}`);
  const hot = HOT_COUNTRIES.some((c) => `${round.country} ${round.name}`.toLowerCase().includes(c));
  const air = (hot ? 27 : 19) + (h % 9);
  const isWet = known ?? false;
  return {
    isWet,
    known: known != null,
    rainProbability: known != null ? (known ? 100 : 0) : Math.round(rainChance * 100),
    airTemperature: isWet ? air - 6 : air,
    trackTemperature: isWet ? air - 2 : air + 8 + ((h >> 4) % 10),
  };
}

// ============================================
// 2. TEAM TIER (from the forecast)
// ============================================
export function getTeamTier(expectedBestFinish) {
  if (expectedBestFinish <= 2.2) return { id: "championship-favourite", label: "Race Favourite" };
  if (expectedBestFinish <= 4.5) return { id: "front-running", label: "Front Running Team" };
  if (expectedBestFinish <= 7.5) return { id: "upper-midfield", label: "Upper Midfield" };
  if (expectedBestFinish <= 11) return { id: "midfield", label: "Midfield" };
  if (expectedBestFinish <= 15) return { id: "lower-midfield", label: "Lower Midfield" };
  return { id: "backmarker", label: "Backmarker" };
}

// ============================================
// 3. CHAMPIONSHIP CONTEXT
// ============================================
export function getChampionshipContext(team) {
  const { standings, season } = state;
  const context = {
    leadingConstructors: false, trailingConstructors: false, constructorPos: null,
    gapToNearest: 0, nearestRival: null, nearestRivalAhead: null,
    championshipBattle: false,
    remainingRounds: (season.totalRounds || 24) - (season.round || 1) + 1
  };
  if (!standings.teams || Object.keys(standings.teams).length === 0) return context;
  const sorted = constructorEntries(state);
  const teamIndex = sorted.findIndex(([name]) => name === team.name);
  if (teamIndex < 0) return context;
  context.constructorPos = teamIndex + 1;
  let minGap = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    if (i === teamIndex) continue;
    const gap = Math.abs(sorted[i][1] - sorted[teamIndex][1]);
    if (gap < minGap) { minGap = gap; context.nearestRival = sorted[i][0]; }
  }
  if (teamIndex === 0) {
    context.leadingConstructors = true;
    context.gapToNearest = (sorted[0][1] || 0) - (sorted[1]?.[1] || 0);
  } else {
    context.trailingConstructors = true;
    context.gapToNearest = (sorted[teamIndex - 1][1] || 0) - (sorted[teamIndex][1] || 0);
    context.nearestRivalAhead = sorted[teamIndex - 1][0];
  }
  context.championshipBattle = minGap <= 50 && context.remainingRounds >= 3;
  return context;
}

export function getWeatherImpact(isWet) {
  return { isWet, varianceMultiplier: isWet ? 1.8 : 1.0, opportunityScore: isWet ? 1.5 : 1.0, riskLevel: isWet ? "Elevated" : "Normal" };
}

// ============================================
// 4. CIRCUIT HISTORY (our past results here)
// ============================================
export function getCircuitHistoryStats(circuitName, teamName) {
  const raceHistory = state.raceHistory || [];
  const relevant = raceHistory.filter((r) => r.circuit === circuitName && r.type !== "sprint");
  if (!relevant.length) return { sampleSize: 0 };
  const finishes = [];
  let entries = 0;
  let dnfCount = 0;
  relevant.forEach((race) => {
    (race.driverResults || []).filter((r) => r.team === teamName).forEach((r) => {
      entries++;
      if (r.retired) dnfCount++;
      else finishes.push(r.finishPos);
    });
  });
  const scRaces = relevant.filter((r) => r.replayData?.scLaps?.length > 0);
  return {
    sampleSize: relevant.length,
    avgFinish: finishes.length > 0 ? Math.round(average(finishes)) : null,
    bestFinish: finishes.length > 0 ? Math.min(...finishes) : null,
    dnfRate: entries ? Math.round((dnfCount / entries) * 100) : 0,
    safetyCarFrequency: Math.round((scRaces.length / relevant.length) * 100),
  };
}

// ============================================
// 5. OBJECTIVES FROM THE FORECAST
// ============================================
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
const riskFor = (p) => (p >= 0.65 ? "Low" : p >= 0.45 ? "Medium" : p >= 0.25 ? "High" : "Very High");
const sponsorFor = (pos) => (pos <= 1 ? 4.5 : pos <= 3 ? 3.2 : pos <= 5 ? 2.1 : pos <= 10 ? 1.4 : 0.8);
const champImpact = (pos) => (pos >= 1 && pos <= 10 ? `+${F1_POINTS[pos - 1]} pts` : "No points");

/** Ladder of finishing targets, most ambitious first. */
const POSITION_TARGETS = [
  { n: 1, id: "win-race", label: "Win the race", emoji: "🏆", phrase: "won" },
  { n: 3, id: "secure-podium", label: "Finish on the podium", emoji: "🥈", phrase: "finished on the podium" },
  { n: 5, id: "top-5", label: "Finish in the top 5", emoji: "🎯", phrase: "finished in the top 5" },
  { n: 8, id: "top-8", label: "Finish in the top 8", emoji: "🎯", phrase: "finished in the top 8" },
  { n: 10, id: "score-points", label: "Score points", emoji: "✅", phrase: "scored points" },
  { n: 13, id: "top-13", label: "Finish in the top 13", emoji: "📈", phrase: "finished in the top 13" },
  { n: 16, id: "top-16", label: "Beat the back of the field", emoji: "📈", phrase: "finished in the top 16" },
];

/** Plain-language facts about the weekend, all computed from the forecast inputs. */
function conditionNotes(f, weather, track, grid) {
  const notes = [];
  notes.push(f.paceRank === 1
    ? `On pace we're the fastest team at ${track.circuit}.`
    : `On pace we're ${ordinal(f.paceRank)} of ${f.teamsCount} teams at ${track.circuit}, ${f.gapToFastest.toFixed(2)}s a lap off the quickest car.`);
  if (Math.abs(f.circuitFit) >= 0.04) {
    notes.push(f.circuitFit < 0
      ? `The layout suits our car (worth ${Math.abs(f.circuitFit).toFixed(2)}s a lap).`
      : `The layout works against our car (costs ${f.circuitFit.toFixed(2)}s a lap).`);
  }
  if (weather.known && weather.isWet) notes.push("It's a wet race: the car matters less and driver skill more, and results spread out.");
  else if (!weather.known && weather.rainProbability >= 15) notes.push(`There's a ${weather.rainProbability}% chance of rain, which would shuffle the order.`);
  if (f.overtakingDifficulty >= 0.7) notes.push(grid ? "Overtaking is very hard here, so the grid decides a lot." : "Overtaking is very hard here, so qualifying will decide a lot.");
  else if (f.overtakingDifficulty <= 0.35) notes.push("Overtaking is relatively easy here, so race pace can make up for a poor grid slot.");
  if (f.tyreWear >= 1.4) notes.push("Tyre wear is high, which opens up strategy.");
  return notes;
}

function makeObjective(base, prob, f, notes, extra = {}) {
  const sims = f.sims;
  return {
    type: "primary",
    riskLevel: riskFor(prob),
    successProbability: pct(prob * 100),
    expectedFinishRange: f.bestRange[0] === f.bestRange[1] ? `P${f.bestRange[0]}` : `P${f.bestRange[0]}–P${f.bestRange[1]}`,
    boardImpact: "High",
    ...base,
    rationale: `${notes.join(" ")} In ${sims} simulated races ${base.resultPhrase} ${Math.round(prob * 100)}% of the time.`,
    ...extra,
  };
}

/**
 * Build the objective list from a race forecast: targets are pitched where
 * the simulated odds say they're meaningful for this team at this track in
 * these conditions, and every success probability is a simulated frequency.
 */
export function buildObjectivesFromForecast(f, { team, track, weather, grid, championship }) {
  const notes = conditionNotes(f, weather, track, grid);
  // Pace first, then the weather when it's in play, else the next most relevant fact.
  const lead = [notes[0], notes.find((n) => /\brain\b|wet race/.test(n)) || notes[1]].filter(Boolean);
  const objectives = [];
  const ladder = POSITION_TARGETS.map((t) => ({ ...t, prob: f.positionProb(t.n) }));

  // Primary: the most ambitious target we hit at least 40% of the time.
  let primaryIdx = ladder.findIndex((t) => t.prob >= 0.4);
  if (primaryIdx < 0) primaryIdx = ladder.length - 1;
  const primary = ladder[primaryIdx];
  const posObjective = (t, type, boardImpact) => makeObjective({
    id: t.id, label: t.label, emoji: t.emoji, type, boardImpact,
    sponsorRewardM: sponsorFor(t.n), championshipImpact: champImpact(t.n), targetPosition: t.n,
    evaluation: { kind: "bestPos", target: t.n },
    resultPhrase: `one of our cars ${t.phrase}`,
  }, t.prob, f, lead);

  objectives.push(posObjective(primary, "primary", "High"));

  // Stretch: one rung up, if it happens at least occasionally.
  const stretch = ladder[primaryIdx - 1];
  if (stretch && stretch.prob >= 0.05) {
    const why = [notes.find((n) => /\brain\b|wet race|Overtaking is relatively easy|Tyre wear/.test(n)) || lead[0]];
    objectives.push(posObjective(stretch, "opportunistic", "Medium"));
    objectives[objectives.length - 1].rationale = `${why.join(" ")} In ${f.sims} simulated races one of our cars ${stretch.phrase} ${Math.round(stretch.prob * 100)}% of the time: possible, but things have to go our way.`;
  }

  // Safe: a lower rung we land most of the time (a banker for the board).
  const safe = ladder.slice(primaryIdx + 1).find((t) => t.prob >= 0.75);
  if (safe) objectives.push(posObjective(safe, "points", "Low"));

  // Both cars in the points, when it's genuinely in play.
  if (f.probs.bothPoints >= 0.2 && f.probs.bothPoints <= 0.92) {
    objectives.push(makeObjective({
      id: "both-in-points", label: "Both cars in the points", emoji: "📊", type: "points",
      sponsorRewardM: 2.0, championshipImpact: "Double points", targetPosition: 10,
      evaluation: { kind: "bothPos", target: 10 },
      expectedFinishRange: "Both top 10",
      resultPhrase: "both cars scored",
    }, f.probs.bothPoints, f, lead));
  }

  // One-two, for a car that can dominate.
  if (f.probs.oneTwo >= 0.12) {
    objectives.push(makeObjective({
      id: "secure-one-two", label: "One-two finish", emoji: "🥇", type: "opportunistic",
      sponsorRewardM: 6.0, boardImpact: "Critical", championshipImpact: "+43 pts", targetPosition: 2,
      evaluation: { kind: "oneTwo" },
      expectedFinishRange: "P1 & P2",
      resultPhrase: "we finished one-two",
    }, f.probs.oneTwo, f, lead));
  }

  // Rival: our nearest championship rival, or the team closest to us on pace here.
  const rivals = Object.entries(f.beatTeam);
  let rival = championship?.nearestRival && f.beatTeam[championship.nearestRival] != null ? championship.nearestRival : null;
  if (!rival && rivals.length) rival = rivals.sort((a, b) => Math.abs(a[1] - 0.5) - Math.abs(b[1] - 0.5))[0][0];
  if (rival) {
    const p = f.beatTeam[rival];
    const why = championship?.nearestRival === rival
      ? `${rival} are our nearest rival in the constructors' championship.`
      : `${rival} are the closest team to us on pace at this circuit.`;
    objectives.push(makeObjective({
      id: "beat-rival", label: `Beat ${rival}`, emoji: "⚔️", type: "rival",
      sponsorRewardM: 1.6, championshipImpact: "Constructor swing", targetPosition: null, targetTeam: rival,
      evaluation: { kind: "beatTeam", team: rival },
      expectedFinishRange: `Ahead of ${rival}`,
      resultPhrase: `our best car finished ahead of ${rival}'s`,
    }, p, f, [why]));
  }

  // Track position: depends on the real grid and how hard passing is here.
  const ourGridSlots = Object.values(f.drivers).map((d) => d.grid).filter(Boolean);
  const bestGrid = ourGridSlots.length ? Math.min(...ourGridSlots) : null;
  if (grid && f.probs.holdGrid != null && f.overtakingDifficulty >= 0.6) {
    objectives.push(makeObjective({
      id: "protect-position", label: "Hold our grid position", emoji: "🛡️", type: "track",
      sponsorRewardM: 1.0, boardImpact: "Medium", championshipImpact: "Defensive points", targetPosition: null,
      evaluation: { kind: "hold" },
      expectedFinishRange: bestGrid ? `Hold P${bestGrid} or better` : "Hold grid",
      resultPhrase: "one of our cars finished at or ahead of its grid slot",
    }, f.probs.holdGrid, f, [notes.find((n) => n.startsWith("Overtaking")) || lead[0]]));
  }
  // Gaining places is only a fair ask when we start far enough back.
  if (grid && f.probs.gain3 != null && f.overtakingDifficulty <= 0.5 && bestGrid >= 6 && f.probs.gain3 >= 0.1) {
    objectives.push(makeObjective({
      id: "gain-positions", label: "Gain 3+ places from the grid", emoji: "📈", type: "progress",
      sponsorRewardM: 0.8, boardImpact: "Low", championshipImpact: "No direct impact", targetPosition: null,
      evaluation: { kind: "gain", positions: 3 },
      expectedFinishRange: `From P${bestGrid}`,
      resultPhrase: "one of our cars gained three or more places",
    }, f.probs.gain3, f, [notes.find((n) => n.startsWith("Overtaking")) || lead[0]]));
  }

  // Reliability: when the simulations lose a car often enough to matter.
  if (1 - f.probs.cleanWeekend >= 0.15) {
    objectives.push(makeObjective({
      id: "finish-race", label: "Both cars to the flag", emoji: "🔧", type: "reliability",
      sponsorRewardM: 0.5, boardImpact: "Low", championshipImpact: "Avoids a zero", targetPosition: null,
      evaluation: { kind: "classified" },
      expectedFinishRange: "Both classified",
      resultPhrase: "both cars finished",
    }, f.probs.cleanWeekend, f, [`Our reliability gives a ${Math.round((1 - f.probs.cleanWeekend) * 100)}% chance of losing a car.`]));
  }

  // Late-season title push
  if (championship?.trailingConstructors && championship.gapToNearest > 0 && championship.remainingRounds <= 6) {
    const t = ladder[Math.max(0, primaryIdx - 1)];
    objectives.push(makeObjective({
      id: "championship-push", label: "Championship rescue push", emoji: "🏁", type: "championship",
      boardImpact: "Critical", sponsorRewardM: 2.5,
      championshipImpact: `Close gap of ${championship.gapToNearest} pts`, targetPosition: t.n,
      evaluation: { kind: "bestPos", target: t.n },
      resultPhrase: `one of our cars ${t.phrase}`,
    }, t.prob, f, [`We trail ${championship.nearestRivalAhead || "the car ahead"} by ${championship.gapToNearest} points with ${championship.remainingRounds} rounds left.`]));
  }

  const typeOrder = { primary: 0, championship: 1, rival: 2, track: 3, opportunistic: 4, qualifying: 5, points: 6, weather: 7, reliability: 8, progress: 9 };
  objectives.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));
  objectives.forEach((o) => { delete o.resultPhrase; });
  return objectives;
}

function finishDistributionFrom(f) {
  const p = (x) => Math.round(x * 100);
  return {
    win: p(f.probs.win),
    podium: p(f.probs.podium),
    top5: p(f.probs.top5),
    top10: p(f.positionProb(10)),
    expectedFinish: Math.round(f.expectedBest),
    worstCase: Math.min(22, f.bestRange[1] + 2),
  };
}

// ============================================
// 6. MAIN OBJECTIVE GENERATOR
// ============================================
/**
 * Forecast the race and build objectives.
 * @param opts.grid   qualifying grid once known
 * @param opts.teams  teams as they'll race (defaults to the player's active line-up + AI)
 */
export function generateRaceObjectives(team, track, isWet = null, opts = {}) {
  const appState = opts.appState || state;
  const weather = opts.weather || getWeekendWeather(appState, track);
  const knownWet = isWet != null ? isWet : weather.known ? weather.isWet : null;
  const teams = opts.teams || raceTeams(appState);
  const forecast = forecastRace({
    teams, playerTeam: team, track,
    wetProbability: weather.rainProbability / 100, isWet: knownWet,
    grid: opts.grid || null,
    weekendContext: opts.weekendContext || null,
    appState,
    sims: opts.sims || FORECAST_SIMS,
    seed: `${appState.season?.year || 1}-${track.round}-${opts.grid ? "grid" : "pre"}`,
  });
  const championship = getChampionshipContext(team);
  const objectives = buildObjectivesFromForecast(forecast, { team, track, weather: { ...weather, isWet: knownWet ?? weather.isWet, known: knownWet != null }, grid: opts.grid || null, championship });
  const tier = getTeamTier(forecast.expectedBest);
  return {
    expectationScore: Math.round(clamp(100 - (forecast.expectedBest - 1) * 5.5, 5, 100)),
    tier,
    championshipContext: championship,
    weatherImpact: getWeatherImpact(knownWet ?? false),
    circuitProfile: getCircuitProfile(track?.circuit || track),
    circuitHistory: getCircuitHistoryStats(track?.circuit || track, team.name),
    finishDistribution: finishDistributionFrom(forecast),
    forecast: {
      sims: forecast.sims, paceRank: forecast.paceRank, teamsCount: forecast.teamsCount,
      gapToFastest: forecast.gapToFastest, circuitFit: forecast.circuitFit,
      rainChance: forecast.rainChance, overtakingDifficulty: forecast.overtakingDifficulty,
      expectedBest: forecast.expectedBest, bestRange: forecast.bestRange, usesGrid: Boolean(opts.grid),
    },
    objectives,
    recommendedObjective: objectives.find((o) => o.type === "primary") || objectives[0],
  };
}

// ============================================
// 10. POST-RACE EVALUATOR
// ============================================
export function evaluateObjective(objectiveDef, results, grid, team, round, replayData) {
  if (!objectiveDef || !results) return { status: 'Unknown', successScore: 0, aiPredictionAccuracy: 0, keyEvents: [] };
  const playerResults = results.map((r, i) => ({ r, pos: i + 1 })).filter(x => x.r.team?.name === team?.name || x.r.team === team?.name);
  const bestPos = playerResults.length > 0 ? playerResults[0].pos : 20;
  const targetPos = objectiveDef.targetPosition;
  const targetTeam = objectiveDef.targetTeam;
  let achieved = false, partiallyAchieved = false;
  const ev = objectiveDef.evaluation;
  const running = playerResults.filter(x => !x.r.retired);
  const gridPosOf = (r) => (grid ? grid.findIndex(g => g.driver?.name === r.driver?.name) + 1 : 0);
  if (ev) {
    // Objectives from the race forecast say exactly how they're judged.
    if (ev.kind === 'bestPos') {
      achieved = running.some(x => x.pos <= ev.target);
      partiallyAchieved = !achieved && running.some(x => x.pos <= ev.target + 2);
    } else if (ev.kind === 'bothPos') {
      const inside = running.filter(x => x.pos <= ev.target).length;
      achieved = playerResults.length > 0 && inside === playerResults.length;
      partiallyAchieved = !achieved && inside > 0;
    } else if (ev.kind === 'oneTwo') {
      achieved = running.map(x => x.pos).sort((a, b) => a - b).slice(0, 2).join() === '1,2';
      partiallyAchieved = !achieved && running.some(x => x.pos === 1);
    } else if (ev.kind === 'beatTeam') {
      const rivalIdx = results.findIndex(r => (r.team?.name === ev.team || r.team === ev.team) && !r.retired);
      const rivalPos = rivalIdx >= 0 ? rivalIdx + 1 : 99;
      achieved = running.some(x => x.pos < rivalPos);
      partiallyAchieved = !achieved && running.some(x => x.pos === rivalPos + 1);
    } else if (ev.kind === 'gain') {
      const gains = running.map(x => (gridPosOf(x.r) ? gridPosOf(x.r) - x.pos : 0));
      achieved = gains.some(g => g >= ev.positions);
      partiallyAchieved = !achieved && gains.some(g => g > 0);
    } else if (ev.kind === 'hold') {
      achieved = running.some(x => gridPosOf(x.r) && x.pos <= gridPosOf(x.r));
      partiallyAchieved = !achieved && running.some(x => gridPosOf(x.r) && x.pos <= gridPosOf(x.r) + 2);
    } else if (ev.kind === 'classified') {
      achieved = playerResults.length > 0 && running.length === playerResults.length;
      partiallyAchieved = !achieved && running.length > 0;
    }
  } else if (targetTeam) {
    const rivalIdx = results.findIndex(r => r.team?.name === targetTeam || r.team === targetTeam);
    const rivalPos = rivalIdx >= 0 ? rivalIdx + 1 : 20;
    achieved = bestPos < rivalPos;
    partiallyAchieved = bestPos === rivalPos + 1;
  } else if (targetPos != null) {
    achieved = bestPos <= targetPos;
    partiallyAchieved = !achieved && bestPos <= targetPos + 2;
  } else {
    achieved = bestPos <= 10;
    partiallyAchieved = bestPos <= 15;
  }
  const status = achieved ? 'Achieved' : partiallyAchieved ? 'Partially Achieved' : 'Not Achieved';
  let successScore;
  if (achieved) successScore = Math.min(100, 75 + Math.max(0, (targetPos || 10) - bestPos) * 5);
  else if (partiallyAchieved) successScore = 50;
  else successScore = Math.max(5, 45 - Math.max(0, bestPos - (targetPos || 10)) * 8);
  let aiPredictionAccuracy = 75;
  if (objectiveDef.finishDistribution?.expectedFinish && bestPos) {
    aiPredictionAccuracy = Math.max(30, Math.round(100 - Math.abs(objectiveDef.finishDistribution.expectedFinish - bestPos) * 8));
  }
  const keyEvents = [];
  if (replayData?.scLaps?.length > 0) keyEvents.push(`Safety Car Laps ${replayData.scLaps[0]}–${replayData.scLaps[1]}`);
  if (replayData?.vscLaps?.length > 0) keyEvents.push(`Virtual SC Laps ${replayData.vscLaps[0]}–${replayData.vscLaps[1]}`);
  playerResults.forEach(({ r }) => {
    if (r.retired) keyEvents.push(`Mechanical Retirement — DNF`);
    if (r.stops > 2) keyEvents.push(`${r.stops}-Stop Strategy Executed`);
    if (r.stops === 1) keyEvents.push('1-Stop Strategy — Tyre Management Key');
    if (r.fastestLap) keyEvents.push('Fastest Lap Bonus Point Scored');
    if (grid) {
      const gridPos = grid.findIndex(g => g.driver?.name === r.driver?.name) + 1;
      if (gridPos > 0) {
        const gained = gridPos - bestPos;
        if (gained >= 5) keyEvents.push(`+${gained} Positions Gained From Grid`);
        else if (gained <= -5) keyEvents.push(`${gained} Positions Lost vs Grid`);
      }
    }
  });
  const driverRating = Math.round(clamp(achieved ? 8 + Math.random() * 1.5 : partiallyAchieved ? 6 + Math.random() * 1.5 : 4 + Math.random() * 2, 1, 10) * 10) / 10;
  const engineeringRating = Math.round(clamp(keyEvents.some(e => e.includes('Stop')) ? 8.5 : achieved ? 7.5 + Math.random() : 6 + Math.random() * 1.5, 1, 10) * 10) / 10;
  return { selectedObjective: objectiveDef, actualPosition: bestPos, status, successScore, aiPredictionAccuracy, keyEvents, driverRating, engineeringRating, playerResults };
}

// ============================================
// 11. STANDINGS IMPACT (internal)
// ============================================
function calculateStandingsImpact(team) {
  const { standings } = state;
  const sorted = constructorEntries(state);
  const teamIndex = sorted.findIndex(([name]) => name === team.name);
  let constructorPos = 0, teamPoints = 0;
  if (teamIndex >= 0) { constructorPos = teamIndex + 1; teamPoints = sorted[teamIndex][1]; }
  let nearestRival = null, gapToRival = 0;
  if (constructorPos > 1) { nearestRival = sorted[constructorPos - 2][0]; gapToRival = sorted[constructorPos - 2][1] - teamPoints; }
  else if (constructorPos < sorted.length) { nearestRival = sorted[constructorPos][0]; gapToRival = teamPoints - sorted[constructorPos][1]; }
  return { currentConstructorPosition: constructorPos || sorted.length, teamPoints, nearestRival, gapToRival, championshipBattle: constructorPos <= 3 && Math.abs(gapToRival) <= 50 };
}

// ============================================
// 12. UNIFIED RACE WEEKEND GENERATOR
// ============================================
function buildRaceWeekend(team, currentRound, appState, opts = {}) {
  const activeCalendar = appState.season.calendar || [];
  const round = activeCalendar[currentRound - 1];
  if (!round) return null;
  const weather = getWeekendWeather(appState, round);
  const circuitType = (() => {
    const name = (round.circuit || '').toLowerCase();
    if (name.includes('monaco') || name.includes('singapore') || name.includes('baku') || name.includes('madrid') || name.includes('jeddah')) return 'Street Circuit';
    if (name.includes('monza') || name.includes('spa') || name.includes('las vegas')) return 'High Speed';
    if (name.includes('suzuka') || name.includes('silverstone')) return 'High Downforce';
    return 'Permanent Circuit';
  })();
  const objData = generateRaceObjectives(team, round, weather.known ? weather.isWet : null, { ...opts, appState, weather });
  const standingsImpact = calculateStandingsImpact(team);
  const daysUntilRace = Math.max(0, 14 - appState.season.currentDay + (currentRound - 1) * 14);
  const wp = appState.weekendProgress;
  const raceStatus = !wp ? 'Not Started' : wp.raceComplete ? 'Complete' : wp.qualifyingComplete ? 'Qualifying Complete' : 'Practice/Qualifying Pending';
  return {
    raceId: `${appState.season.year}-${currentRound}`, round: currentRound, grandPrix: round.name,
    circuit: round.circuit, laps: round.laps, circuitType,
    weather,
    ...objData,
    standingsImpact,
    countdown: daysUntilRace > 0 ? `${daysUntilRace} days until race` : 'Race weekend open',
    raceStatus,
  };
}

/** Pre-qualifying forecast and objectives for the round. */
export function generateUnifiedRaceWeekend(team, currentRound = state.season.round) {
  return buildRaceWeekend(team, currentRound, state);
}

/**
 * Re-forecast once qualifying is done: the real grid and the real weather
 * replace the simulated qualifying and the rain probability.
 * @param opts.grid  qualifying grid [{ driver, team }]
 * @param opts.teams teams as they'll race
 * @param opts.weekendContext per-driver setup/form for this weekend
 */
export function refreshRaceWeekendAfterQualifying(appState, opts = {}) {
  if (!appState.team) return null;
  appState.raceWeekend = buildRaceWeekend(appState.team, appState.season.round, appState, opts);
  return appState.raceWeekend;
}

// ============================================
// 13. LEGACY COMPATIBILITY
// ============================================
export const RACE_OBJECTIVES = [
  { id: 'win',          label: 'Push for win',       risk: 'High',    targetPosition: 1 },
  { id: 'podium',       label: 'Fight for podium',    risk: 'Medium',  targetPosition: 3 },
  { id: 'points',       label: 'Finish in points',    risk: 'Low',     targetPosition: 10 },
  { id: 'conservative', label: 'Conservative points', risk: 'Minimal', targetPosition: 12 },
  { id: 'gamble',       label: 'Strategy gamble',     risk: 'Extreme', targetPosition: 5 },
];
