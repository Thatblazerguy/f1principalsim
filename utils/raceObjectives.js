import { state } from "../state.js";
import { getCircuitProfile } from "./devProjects.js";

// ============================================
// UTILITIES
// ============================================
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const pct = (val) => Math.round(clamp(val, 1, 99));

// ============================================
// 1. EXPECTATION SCORE CALCULATION
// ============================================
export function calculateExpectationScore(team, track, currentRound = 1) {
  const { standings, raceHistory, aiTeams } = state;
  const allTeams = [team, ...aiTeams];
  const teamCarOverall = team.carPerformance ||
    (team.car.aero + team.car.engine + team.car.chassis + team.car.reliability) / 4;
  let score = 0;
  const factors = [];
  const carMin = Math.min(...allTeams.map(t => t.carPerformance || 60));
  const carMax = Math.max(...allTeams.map(t => t.carPerformance || 95));
  const carScore = carMax > carMin ? ((teamCarOverall - carMin) / (carMax - carMin)) * 85 + 15 : 50;
  factors.push({ weight: 40, value: carScore });
  let constructorPos = allTeams.length;
  if (standings.teams && Object.keys(standings.teams).length > 0) {
    const sorted = Object.entries(standings.teams).sort(([, a], [, b]) => b - a);
    const idx = sorted.findIndex(([name]) => name === team.name);
    constructorPos = idx >= 0 ? idx + 1 : allTeams.length;
  }
  const constructorScore = 100 - ((constructorPos - 1) / Math.max(1, allTeams.length - 1)) * 85;
  factors.push({ weight: 20, value: constructorScore });
  let driverScore = 50;
  if (standings.drivers && Object.keys(standings.drivers).length > 0) {
    const allDrivers = Object.entries(standings.drivers).sort(([, a], [, b]) => b - a);
    const teamDrivers = team.drivers.map(d => {
      const idx = allDrivers.findIndex(([name]) => name === d.name);
      return idx >= 0 ? idx + 1 : allDrivers.length;
    });
    driverScore = 100 - ((average(teamDrivers) - 1) / Math.max(1, allDrivers.length - 1)) * 85;
  }
  factors.push({ weight: 15, value: driverScore });
  let recentFormScore = 50;
  if (raceHistory && raceHistory.length > 0) {
    const teamResults = raceHistory.slice(-5).map(race => {
      const positions = team.drivers.map(d => {
        const result = race.results?.find(r => r.driver === d.name || r.driver?.name === d.name);
        return result ? (result.position || result.pos || 20) : 20;
      });
      return Math.min(...positions);
    });
    recentFormScore = clamp(100 - ((average(teamResults) - 1) / 19) * 70 + 15, 10, 100);
  }
  factors.push({ weight: 12, value: recentFormScore });
  const avgDriverRating = average(team.drivers.map(d => (d.pace + d.racecraft + d.consistency) / 3));
  factors.push({ weight: 10, value: clamp(avgDriverRating, 50, 95) });
  let momentumScore = 50;
  if (raceHistory && raceHistory.length >= 2) {
    const recent = raceHistory.slice(-3);
    const improving = recent.every((race, i) => {
      if (i === 0) return true;
      const prevRace = recent[i - 1];
      const cur = Math.min(...team.drivers.map(d => race.results?.find(r => r.driver === d.name || r.driver?.name === d.name)?.position || 20));
      const prev = Math.min(...team.drivers.map(d => prevRace.results?.find(r => r.driver === d.name || r.driver?.name === d.name)?.position || 20));
      return cur <= prev;
    });
    momentumScore = improving ? 70 : 40;
  }
  factors.push({ weight: 8, value: momentumScore });
  let circuitScore = 50;
  if (track) {
    const profile = getCircuitProfile(track.circuit || track);
    const carSpecs = team.specs || {};
    if (profile.type === 'Power') circuitScore = 50 + ((carSpecs.engine || 75) - 75) * 1.2;
    else if (profile.type === 'Street') circuitScore = 50 + ((carSpecs.chassis || 75) - 75) * 1.2;
    else if (profile.type === 'Highspeed') circuitScore = 50 + ((carSpecs.aero || 75) - 75) * 1.2;
    else circuitScore = 50 + ((carSpecs.chassis || 75) + (carSpecs.aero || 75) - 150) * 0.6;
  }
  factors.push({ weight: 7, value: clamp(circuitScore, 10, 100) });
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  score = factors.reduce((s, f) => s + (f.value * f.weight / 100), 0) * (100 / totalWeight);
  const bestCar = Math.max(...allTeams.map(t => t.carPerformance || 60));
  if (teamCarOverall >= bestCar - 2) score += 15;
  else if (teamCarOverall >= bestCar - 5) score += 8;
  return clamp(Math.round(score), 5, 100);
}

// ============================================
// 2. TEAM TIER
// ============================================
export function getTeamTier(expectationScore) {
  if (expectationScore >= 80) return { id: "championship-favourite", label: "Championship Favourite" };
  if (expectationScore >= 65) return { id: "front-running", label: "Front Running Team" };
  if (expectationScore >= 50) return { id: "upper-midfield", label: "Upper Midfield" };
  if (expectationScore >= 35) return { id: "midfield", label: "Midfield" };
  if (expectationScore >= 20) return { id: "lower-midfield", label: "Lower Midfield" };
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
  const sorted = Object.entries(standings.teams).sort(([, a], [, b]) => b - a);
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

// ============================================
// 4. WEATHER IMPACT
// ============================================
export function getWeatherImpact(isWet) {
  return { isWet, varianceMultiplier: isWet ? 1.8 : 1.0, opportunityScore: isWet ? 1.5 : 1.0, riskLevel: isWet ? "Elevated" : "Normal" };
}

// ============================================
// 5. CIRCUIT HISTORY STATS (Learning)
// ============================================
export function getCircuitHistoryStats(circuitName, teamName) {
  const raceHistory = state.raceHistory || [];
  const relevant = raceHistory.filter(r => r.circuit === circuitName || r.name?.includes((circuitName || '').split(' ')[0]));
  if (!relevant.length) return { sampleSize: 0 };
  const finishes = [];
  let dnfCount = 0;
  relevant.forEach(race => {
    (race.results || []).filter(r => r.team === teamName || r.team?.name === teamName).forEach(r => {
      if (r.retired || r.position > 20) dnfCount++;
      else finishes.push(r.position || r.pos || 20);
    });
  });
  const scRaces = relevant.filter(r => r.replayData?.scLaps?.length > 0);
  return {
    sampleSize: relevant.length,
    avgFinish: finishes.length > 0 ? Math.round(average(finishes)) : null,
    bestFinish: finishes.length > 0 ? Math.min(...finishes) : null,
    dnfRate: Math.round((dnfCount / relevant.length) * 100),
    safetyCarFrequency: Math.round((scRaces.length / relevant.length) * 100),
  };
}

// ============================================
// 6. FINISH DISTRIBUTION
// ============================================
export function generateFinishDistribution(expectationScore, circuitProfile, weatherImpact, reliability, circuitHistory) {
  const baseExpectedFinish = expectationScore >= 85 ? 1.5 : expectationScore >= 75 ? 3 : expectationScore >= 65 ? 5 :
    expectationScore >= 55 ? 7 : expectationScore >= 45 ? 9 : expectationScore >= 35 ? 12 : expectationScore >= 25 ? 15 : 18;
  const reliabilityFactor = reliability < 75 ? (75 - reliability) * 0.05 : 0;
  const weatherVariance = weatherImpact.isWet ? (expectationScore < 50 ? -2 : 0.5) : 0;
  let historyAdjust = 0;
  if (circuitHistory?.sampleSize >= 2 && circuitHistory.avgFinish) {
    historyAdjust = (circuitHistory.avgFinish - baseExpectedFinish) * 0.2;
  }
  const expectedFinish = clamp(Math.round(baseExpectedFinish + reliabilityFactor + weatherVariance + historyAdjust), 1, 20);
  const winProb = pct(expectationScore >= 80 ? 55 - (expectedFinish - 1) * 8 : expectationScore >= 65 ? 30 - (expectedFinish - 1) * 5 : expectationScore >= 50 ? 15 - (expectedFinish - 1) * 2 : Math.max(1, 8 - expectedFinish));
  const podiumProb = pct(winProb * 1.6 + (expectationScore >= 65 ? 25 : 10));
  const top5Prob = pct(podiumProb * 1.3 + 15);
  const top10Prob = pct(Math.min(99, top5Prob + (expectedFinish <= 10 ? 20 : 10)));
  return {
    win: Math.min(winProb, 75),
    podium: clamp(podiumProb, winProb + 3, 85),
    top5: clamp(top5Prob, podiumProb + 5, 95),
    top10: clamp(top10Prob, top5Prob + 3, 99),
    expectedFinish,
    worstCase: clamp(expectedFinish + 3 + Math.round(reliabilityFactor * 2), expectedFinish + 1, 20),
  };
}

// ============================================
// 7. AI RATIONALE GENERATOR
// ============================================
function generateAIRationale(objectiveType, ctx) {
  const { circuitProfile, circuitHistory, weather, championship, track } = ctx;
  const trackName = track?.circuit || 'this circuit';
  const rival = championship?.nearestRival;
  const circType = circuitProfile?.type || 'Mixed';
  const bank = {
    'win': weather.isWet
      ? [`Wet conditions open the door — mixed strategies can neutralise car gaps. The pace window is real.`]
      : [`The car is performing at its peak this weekend. Simulations show a genuine victory window if tyre strategy is optimised.`],
    'one-two': [`Both drivers are showing strong pace across all compounds. A coordinated 1-2 is operationally feasible.`],
    'podium': [weather.isWet ? `Wet weather levels the field. Engineering rates a podium probability high based on recent wet pace.` : `Race pace data puts the car consistently in the top-3 window. A podium is the realistic optimum.`],
    'beat-rival': [rival ? `${rival} are our nearest championship threat. Finishing ahead scores critical constructor points.` : `Direct constructor battle. Outscoring the nearest rival is the priority strategic objective.`],
    'championship-extend': [`We lead the championship. Scoring maximum points while rivals underperform is the optimal path.`],
    'championship-close': [rival ? `We trail ${rival} by ${Math.abs(championship.gapToNearest || 0)} points. A strong result here shifts the momentum.` : `The points gap is closable. A strong points haul keeps the championship fight alive.`],
    'score-points': [`The car has the pace to fight for points. A clean race, avoiding incidents, maximises every opportunity.`,
      `Midfield competition is tight at ${trackName}. Reliability and tyre management will separate the points finishers.`],
    'reach-q3': [circType === 'Street' ? `Street circuits reward clean qualifying. Reaching Q3 locks in a crucial grid slot for the race.` : `The performance margin over Q2 rivals is small. A clean Q3 lap secures an important race starting position.`],
    'reach-q2': [`Q2 is a realistic and meaningful target. Grid position significantly impacts race day strategy options.`],
    'gain-positions': [`Race simulations show overtaking potential from the grid. Tyre strategy can be used to jump rivals in the pit window.`],
    'wet-opportunity': [`Safety Car probability is elevated. Staying on track and managing tyre transitions will be critical.`],
    'top-speed': [`${trackName} rewards raw straight-line speed. ERS deployment optimisation and slipstream exploitation are key.`],
    'protect-position': [circType === 'Street' ? `Overtaking at ${trackName} is extremely limited. Qualifying position is almost everything — protecting it is the race.` : `Track position is critical here. Clean pit stops and consistent pace can secure the target finish.`],
    'reliability': [`High tyre degradation and heat stress are forecast. Bringing the car home cleanly is a victory in itself.`],
  };
  const pool = bank[objectiveType] || [`Data-driven analysis across historical results and track characteristics supports this objective.`];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================
// 8. DYNAMIC OBJECTIVE GENERATOR
// ============================================
function generateTrackAwareObjectives(tier, championship, weather, finishDist, circuitProfile, circuitHistory, track, team) {
  const objectives = [];
  const circType = circuitProfile?.type || 'Mixed';
  const isStreet = circType === 'Street';
  const isPower = circType === 'Power';
  const highDnfRisk = (circuitHistory?.dnfRate > 30) || (team?.car?.reliability < 75);
  const rival = championship?.nearestRival;
  const ctx = { tier, circuitProfile, circuitHistory, weather, championship, track, team };
  const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const champImpact = pos => pos >= 1 && pos <= 10 ? `+${F1_POINTS[pos-1]} pts` : 'No points';
  const riskLevel = prob => prob >= 65 ? 'Low' : prob >= 45 ? 'Medium' : prob >= 25 ? 'High' : 'Very High';
  const sponsorM = pos => pos <= 1 ? 4.5 : pos <= 3 ? 3.2 : pos <= 5 ? 2.1 : pos <= 10 ? 1.4 : 0.8;
  const makeRange = (best, worst) => best === worst ? `P${best}` : `P${best}–P${worst}`;

  if (tier.id === 'championship-favourite') {
    objectives.push({ id: 'win-race', label: 'Win the Race', type: 'primary', emoji: '🏆',
      rationale: generateAIRationale('win', ctx), expectedFinishRange: makeRange(1,2),
      successProbability: pct(finishDist.win), riskLevel: weather.isWet ? 'High' : 'Medium',
      sponsorRewardM: sponsorM(1), boardImpact: 'Critical', championshipImpact: '+25 pts', targetPosition: 1 });
    objectives.push({ id: 'secure-one-two', label: 'One-Two Finish', type: 'primary', emoji: '🥇',
      rationale: generateAIRationale('one-two', ctx), expectedFinishRange: '1 & 2',
      successProbability: pct(finishDist.win * 0.65), riskLevel: 'High',
      sponsorRewardM: 6.0, boardImpact: 'Critical', championshipImpact: '+43 pts combined', targetPosition: 2 });
    if (championship.leadingConstructors) {
      objectives.push({ id: 'extend-lead', label: 'Extend Championship Lead', type: 'championship', emoji: '📈',
        rationale: generateAIRationale('championship-extend', ctx), expectedFinishRange: makeRange(1,3),
        successProbability: pct(finishDist.podium), riskLevel: 'Medium',
        sponsorRewardM: sponsorM(2), boardImpact: 'Critical', championshipImpact: 'Extend lead', targetPosition: 3 });
    }
  } else if (tier.id === 'front-running') {
    objectives.push({ id: 'fight-for-victory', label: 'Fight for Victory', type: 'primary', emoji: '⚔️',
      rationale: generateAIRationale('win', ctx), expectedFinishRange: makeRange(1,3),
      successProbability: pct(finishDist.win), riskLevel: weather.isWet ? 'Very High' : 'High',
      sponsorRewardM: sponsorM(1), boardImpact: 'High', championshipImpact: '+25 pts potential', targetPosition: 1 });
    objectives.push({ id: 'secure-podium', label: 'Secure Podium', type: 'primary', emoji: '🥈',
      rationale: generateAIRationale('podium', ctx), expectedFinishRange: makeRange(2,4),
      successProbability: pct(finishDist.podium), riskLevel: 'Medium',
      sponsorRewardM: sponsorM(3), boardImpact: 'High', championshipImpact: champImpact(3), targetPosition: 3 });
    objectives.push({ id: 'maximise-constructor', label: 'Maximise Constructor Points', type: 'points', emoji: '📊',
      rationale: `Bringing both cars into the points scores maximum constructor value and applies pressure on rivals.`,
      expectedFinishRange: 'Both Top 10', successProbability: pct(finishDist.top10 * 0.8), riskLevel: 'Low',
      sponsorRewardM: 2.0, boardImpact: 'High', championshipImpact: 'Double points swing', targetPosition: 8 });
  } else if (tier.id === 'upper-midfield') {
    objectives.push({ id: 'top-6', label: 'Finish Inside Top 6', type: 'primary', emoji: '🎯',
      rationale: generateAIRationale('score-points', ctx), expectedFinishRange: makeRange(5,7),
      successProbability: pct(finishDist.top5 + 10), riskLevel: 'Medium',
      sponsorRewardM: sponsorM(6), boardImpact: 'High', championshipImpact: champImpact(6), targetPosition: 6 });
    if (weather.isWet || (circuitHistory?.safetyCarFrequency || 0) > 50) {
      objectives.push({ id: 'opportunistic-podium', label: 'Opportunistic Podium', type: 'opportunistic', emoji: '🌟',
        rationale: weather.isWet ? `Wet conditions greatly improve our odds of a podium overperformance.` : `High Safety Car frequency means strategic positioning can yield a surprise podium.`,
        expectedFinishRange: makeRange(2,5), successProbability: pct(finishDist.podium), riskLevel: 'High',
        sponsorRewardM: sponsorM(3), boardImpact: 'High', championshipImpact: champImpact(3), targetPosition: 3 });
    }
  } else if (tier.id === 'midfield') {
    objectives.push({ id: 'score-points', label: 'Score Points', type: 'primary', emoji: '✅',
      rationale: generateAIRationale('score-points', ctx),
      expectedFinishRange: makeRange(finishDist.expectedFinish, Math.min(10, finishDist.expectedFinish + 2)),
      successProbability: pct(finishDist.top10), riskLevel: riskLevel(finishDist.top10),
      sponsorRewardM: sponsorM(10), boardImpact: 'High', championshipImpact: champImpact(10), targetPosition: 10 });
    objectives.push({ id: 'reach-q3', label: 'Reach Q3', type: 'qualifying', emoji: '⏱️',
      rationale: generateAIRationale('reach-q3', ctx), expectedFinishRange: 'Top 10 grid',
      successProbability: pct(finishDist.top10 * 0.85), riskLevel: 'Low',
      sponsorRewardM: 0.8, boardImpact: 'Medium', championshipImpact: 'Improved grid', targetPosition: 10 });
  } else if (tier.id === 'lower-midfield') {
    objectives.push({ id: 'fight-for-points', label: 'Fight for Points', type: 'primary', emoji: '🎯',
      rationale: generateAIRationale('score-points', ctx), expectedFinishRange: makeRange(9, 12),
      successProbability: pct(finishDist.top10 - 5), riskLevel: riskLevel(finishDist.top10),
      sponsorRewardM: sponsorM(10), boardImpact: 'High', championshipImpact: champImpact(10), targetPosition: 10 });
    objectives.push({ id: 'reach-q2', label: 'Reach Q2', type: 'qualifying', emoji: '⏱️',
      rationale: generateAIRationale('reach-q2', ctx), expectedFinishRange: 'Top 15 grid',
      successProbability: pct(finishDist.top10 + 20), riskLevel: 'Low',
      sponsorRewardM: 0.6, boardImpact: 'Low', championshipImpact: 'Grid improvement', targetPosition: 15 });
    objectives.push({ id: 'gain-positions', label: 'Gain Positions From Grid', type: 'progress', emoji: '📈',
      rationale: generateAIRationale('gain-positions', ctx), expectedFinishRange: '+3–5 positions',
      successProbability: pct(55), riskLevel: 'Low', sponsorRewardM: 0.8, boardImpact: 'Low', championshipImpact: 'No direct impact', targetPosition: null });
  } else {
    objectives.push({ id: 'reach-q2-backmarker', label: 'Reach Q2', type: 'qualifying', emoji: '⏱️',
      rationale: generateAIRationale('reach-q2', ctx), expectedFinishRange: 'Top 15 grid',
      successProbability: pct(30 + (weather.isWet ? 15 : 0)), riskLevel: 'High',
      sponsorRewardM: 1.0, boardImpact: 'Medium', championshipImpact: 'Positional improvement', targetPosition: 15 });
    objectives.push({ id: 'capitalise-safety-car', label: 'Capitalise on Safety Car', type: 'opportunistic', emoji: '🚗',
      rationale: `Safety Cars are the backmarker's greatest ally. Staying out under SC while rivals pit earns positions pace alone cannot provide.`,
      expectedFinishRange: 'Any', successProbability: pct(40), riskLevel: 'Medium',
      sponsorRewardM: 0.5, boardImpact: 'Low', championshipImpact: 'No direct impact', targetPosition: null });
    objectives.push({ id: 'gain-positions-backmarker', label: 'Gain Positions From Grid', type: 'progress', emoji: '📈',
      rationale: generateAIRationale('gain-positions', ctx), expectedFinishRange: '+2–4 positions',
      successProbability: pct(55), riskLevel: 'Low', sponsorRewardM: 0.6, boardImpact: 'Low', championshipImpact: 'No direct impact', targetPosition: null });
    if (weather.isWet) {
      objectives.push({ id: 'top-10-backmarker', label: 'Finish in Top 10', type: 'opportunistic', emoji: '🌟',
        rationale: `Wet weather collapses the competitive order. A tactical SC gamble or tyre advantage could produce a historic result.`,
        expectedFinishRange: 'P8–P12', successProbability: pct(finishDist.top10), riskLevel: 'Very High',
        sponsorRewardM: sponsorM(10), boardImpact: 'High', championshipImpact: champImpact(10), targetPosition: 10 });
    }
  }

  // Cross-tier: beat rival
  if (rival && !objectives.find(o => o.id === 'beat-rival')) {
    objectives.push({ id: 'beat-rival', label: `Beat ${rival}`, type: 'rival', emoji: '⚔️',
      rationale: generateAIRationale('beat-rival', ctx), expectedFinishRange: 'Ahead',
      successProbability: pct(50 + (finishDist.top5 - 50) * 0.5), riskLevel: 'Medium',
      sponsorRewardM: 1.6, boardImpact: 'High', championshipImpact: 'Constructor swing',
      targetPosition: null, targetTeam: rival });
  }

  // Street circuit: protect position
  if (isStreet && !objectives.find(o => o.id === 'protect-position')) {
    objectives.push({ id: 'protect-position', label: 'Protect Track Position', type: 'track', emoji: '🛡️',
      rationale: generateAIRationale('protect-position', ctx), expectedFinishRange: 'Hold grid',
      successProbability: pct(65), riskLevel: 'Low', sponsorRewardM: 1.0, boardImpact: 'Medium',
      championshipImpact: 'Defensive points', targetPosition: null });
  }

  // Power circuit: top speed
  if (isPower && !objectives.find(o => o.id === 'top-speed-assault')) {
    objectives.push({ id: 'top-speed-assault', label: 'Exploit Top Speed', type: 'track', emoji: '🔥',
      rationale: generateAIRationale('top-speed', ctx),
      expectedFinishRange: makeRange(Math.max(1, finishDist.expectedFinish - 1), finishDist.expectedFinish + 2),
      successProbability: pct(55), riskLevel: 'Medium', sponsorRewardM: 1.1, boardImpact: 'Medium',
      championshipImpact: champImpact(finishDist.expectedFinish), targetPosition: finishDist.expectedFinish });
  }

  // High SC frequency: SC gamble
  if ((circuitHistory?.safetyCarFrequency > 60 || isStreet) && !objectives.find(o => o.id === 'sc-strategy')) {
    objectives.push({ id: 'sc-strategy', label: 'Safety Car Gamble', type: 'opportunistic', emoji: '🚗',
      rationale: `SC frequency at this venue is historically high. Staying out while rivals pit can vault us several positions instantly.`,
      expectedFinishRange: 'Opportunistic', successProbability: pct(35 + (weather.isWet ? 15 : 0)),
      riskLevel: 'High', sponsorRewardM: 2.0, boardImpact: 'Medium', championshipImpact: 'Opportunity dependent', targetPosition: null });
  }

  // Reliability concern
  if (highDnfRisk && !objectives.find(o => o.id === 'finish-race')) {
    objectives.push({ id: 'finish-race', label: 'Classified Finish', type: 'reliability', emoji: '🔧',
      rationale: generateAIRationale('reliability', ctx), expectedFinishRange: 'Any finish',
      successProbability: pct(100 - (circuitHistory?.dnfRate || 25)), riskLevel: 'Low',
      sponsorRewardM: 0.5, boardImpact: 'Low', championshipImpact: 'Prevents zero-point round', targetPosition: 20 });
  }

  // Wet opportunity
  if (weather.isWet && !objectives.find(o => o.id === 'wet-opportunity')) {
    objectives.push({ id: 'wet-opportunity', label: 'Wet Race Opportunity', type: 'weather', emoji: '🌧️',
      rationale: `Safety Car probability is elevated in wet conditions. Staying on track and managing tyre transitions will be critical.`,
      expectedFinishRange: 'Any', successProbability: pct(40 + (100 - finishDist.expectedFinish * 4)),
      riskLevel: 'High', sponsorRewardM: 2.2, boardImpact: 'Medium', championshipImpact: 'Weather-dependent', targetPosition: null });
  }

  // Championship closing push
  if (championship.trailingConstructors && championship.gapToNearest > 0 && championship.remainingRounds <= 6) {
    objectives.push({ id: 'championship-push', label: 'Championship Rescue Push', type: 'championship', emoji: '🏁',
      rationale: generateAIRationale('championship-close', ctx),
      expectedFinishRange: makeRange(Math.max(1, finishDist.expectedFinish - 2), finishDist.expectedFinish),
      successProbability: pct(finishDist.top5), riskLevel: 'High', sponsorRewardM: 2.5, boardImpact: 'Critical',
      championshipImpact: `Close gap by up to ${championship.gapToNearest} pts`,
      targetPosition: Math.max(1, finishDist.expectedFinish - 2) });
  }

  const typeOrder = { primary: 0, championship: 1, rival: 2, track: 3, opportunistic: 4, qualifying: 5, points: 6, weather: 7, reliability: 8, progress: 9 };
  objectives.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));
  return objectives;
}

// ============================================
// 9. MAIN OBJECTIVE GENERATOR
// ============================================
export function generateRaceObjectives(team, track, isWet = false) {
  const expectationScore = calculateExpectationScore(team, track);
  const tier = getTeamTier(expectationScore);
  const championship = getChampionshipContext(team);
  const weatherImpact = getWeatherImpact(isWet);
  const circuitProfile = getCircuitProfile(track?.circuit || track);
  const circuitHistory = getCircuitHistoryStats(track?.circuit || track, team.name);
  const reliability = team.car?.reliability || team.specs?.reliability || 80;
  const finishDist = generateFinishDistribution(expectationScore, circuitProfile, weatherImpact, reliability, circuitHistory);
  const objectives = generateTrackAwareObjectives(tier, championship, weatherImpact, finishDist, circuitProfile, circuitHistory, track, team);
  return {
    expectationScore, tier, championshipContext: championship, weatherImpact,
    circuitProfile, circuitHistory, finishDistribution: finishDist,
    objectives, recommendedObjective: objectives.find(o => o.type === 'primary') || objectives[0],
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
  if (targetTeam) {
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
  const sorted = Object.entries(standings.teams || {}).sort(([, a], [, b]) => b - a);
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
export function generateUnifiedRaceWeekend(team, currentRound = state.season.round) {
  const activeCalendar = state.season.calendar || [];
  const round = activeCalendar[currentRound - 1];
  if (!round) return null;
  const wetProbability = 0.3 + (Math.sin(currentRound * 0.7) * 0.2);
  const isWet = Math.random() < wetProbability;
  const circuitType = (() => {
    const name = (round.circuit || '').toLowerCase();
    if (name.includes('monaco') || name.includes('singapore') || name.includes('baku') || name.includes('madrid') || name.includes('jeddah')) return 'Street Circuit';
    if (name.includes('monza') || name.includes('spa') || name.includes('las vegas')) return 'High Speed';
    if (name.includes('suzuka') || name.includes('silverstone')) return 'High Downforce';
    return 'Permanent Circuit';
  })();
  const objData = generateRaceObjectives(team, round, isWet);
  const { expectationScore, tier, championshipContext, weatherImpact, circuitProfile, circuitHistory, finishDistribution, objectives, recommendedObjective } = objData;
  const standingsImpact = calculateStandingsImpact(team);
  const trackTemp = Math.floor(20 + Math.random() * 25);
  const daysUntilRace = Math.max(0, 14 - state.season.currentDay + (currentRound - 1) * 14);
  const raceStatus = !state.weekendProgress ? 'Not Started' : state.weekendProgress.raceComplete ? 'Complete' : state.weekendProgress.qualifyingComplete ? 'Qualifying Complete' : 'Practice/Qualifying Pending';
  return {
    raceId: `${state.season.year}-${currentRound}`, round: currentRound, grandPrix: round.name,
    circuit: round.circuit, laps: round.laps, circuitType,
    weather: { isWet, rainProbability: Math.round(wetProbability * 100), trackTemperature: trackTemp, airTemperature: Math.floor(trackTemp - 4 + Math.random() * 6) },
    objectives, recommendedObjective, championshipContext, standingsImpact,
    countdown: daysUntilRace > 0 ? `${daysUntilRace} Days Until Race` : 'Race Weekend Open!',
    raceStatus, expectationScore, tier, circuitProfile, circuitHistory, finishDistribution,
  };
}

// ============================================
// 13. LEGACY COMPATIBILITY
// ============================================
export const RACE_OBJECTIVES = [
  { id: 'win',          label: '🏆 Push For Win',       risk: 'High',    targetPosition: 1 },
  { id: 'podium',       label: '🥈 Fight For Podium',    risk: 'Medium',  targetPosition: 3 },
  { id: 'points',       label: '🎯 Finish In Points',    risk: 'Low',     targetPosition: 10 },
  { id: 'conservative', label: '💰 Conservative Points', risk: 'Minimal', targetPosition: 12 },
  { id: 'gamble',       label: '🌧 Strategy Gamble',     risk: 'Extreme', targetPosition: 5 },
];
