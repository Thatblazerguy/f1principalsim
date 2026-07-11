import { state } from "../state.js";


// ============================================
// DYNAMIC RACE OBJECTIVES SYSTEM
// ============================================
// Generates realistic, context-aware race objectives using all available team data

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const average = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// ============================================
// 1. EXPECTATION SCORE CALCULATION
// ============================================
// Computes a 0-100 score representing team's competitive strength
export function calculateExpectationScore(team, track, currentRound = 1) {
  const { standings, raceHistory, aiTeams } = state;

  // Collect all teams for comparison
  const allTeams = [team, ...aiTeams];
  const teamCarOverall = team.carPerformance || 
    (team.car.aero + team.car.engine + team.car.chassis + team.car.reliability) / 4;
  
  let score = 0;
  const factors = [];

  // --- Factor 1: Car Overall Performance (40%) --- MOST IMPORTANT!
  const carMin = Math.min(...allTeams.map(t => t.carPerformance || 60));
  const carMax = Math.max(...allTeams.map(t => t.carPerformance || 95));
  const carScore = ((teamCarOverall - carMin) / (carMax - carMin)) * 85 + 15;
  factors.push({ name: "Car Performance", weight: 40, value: carScore });

  // --- Factor 2: Constructor Championship Position (20%) ---
  let constructorPos = allTeams.length;
  if (standings.teams && Object.keys(standings.teams).length > 0) {
    const sortedConstructors = Object.entries(standings.teams)
      .sort(([, a], [, b]) => b.points - a.points);
    const posIndex = sortedConstructors.findIndex(([name]) => name === team.name);
    constructorPos = posIndex >= 0 ? posIndex + 1 : allTeams.length;
  }
  const constructorScore = 100 - ((constructorPos - 1) / (allTeams.length - 1)) * 85;
  factors.push({ name: "Constructor Position", weight: 20, value: constructorScore });

  // --- Factor 3: Driver Championship Positions (15%) ---
  let driverScore = 50;
  if (standings.drivers && Object.keys(standings.drivers).length > 0) {
    const allDrivers = Object.entries(standings.drivers).sort(([, a], [, b]) => b.points - a.points);
    const teamDrivers = team.drivers.map(d => {
      const idx = allDrivers.findIndex(([name]) => name === d.name);
      return idx >= 0 ? idx + 1 : allDrivers.length;
    });
    const avgDriverPos = average(teamDrivers);
    driverScore = 100 - ((avgDriverPos - 1) / (allDrivers.length - 1)) * 85;
  }
  factors.push({ name: "Driver Positions", weight: 15, value: driverScore });

  // --- Factor 4: Recent Form (12%) ---
  let recentFormScore = 50;
  if (raceHistory && raceHistory.length > 0) {
    const last5 = raceHistory.slice(-5);
    const teamResults = last5.map(race => {
      const bestFinish = Math.min(
        ...team.drivers.map(d => {
          const result = race.results?.find(r => r.driver === d.name);
          return result ? result.position : 20;
        })
      );
      return bestFinish;
    });
    const avgFinish = average(teamResults);
    recentFormScore = 100 - ((avgFinish - 1) / 19) * 70 + 15;
  }
  factors.push({ name: "Recent Form", weight: 12, value: recentFormScore });

  // --- Factor 5: Driver Overall Ratings (10%) ---
  const avgDriverRating = average(team.drivers.map(d => (d.pace + d.racecraft + d.consistency) / 3));
  const driverRatingScore = clamp(avgDriverRating, 50, 95);
  factors.push({ name: "Driver Quality", weight: 10, value: driverRatingScore });

  // --- Factor 6: Team Momentum (8%) ---
  let momentumScore = 50;
  if (raceHistory && raceHistory.length >= 2) {
    const recent = raceHistory.slice(-3);
    const improving = recent.every((race, i) => {
      if (i === 0) return true;
      const prevRace = recent[i - 1];
      const currentBest = Math.min(...team.drivers.map(d => 
        race.results?.find(r => r.driver === d.name)?.position || 20
      ));
      const prevBest = Math.min(...team.drivers.map(d => 
        prevRace.results?.find(r => r.driver === d.name)?.position || 20
      ));
      return currentBest <= prevBest;
    });
    momentumScore = improving ? 70 : 40;
  }
  factors.push({ name: "Momentum", weight: 8, value: momentumScore });

  // --- Factor 7: Circuit Characteristics (7%) ---
  let circuitScore = 50;
  if (track) {
    const speed = track.speed || 1.0;
    const downforce = track.downforce || 1.0;
    circuitScore = 50 + ((speed + downforce) / 2 - 1) * 25;
  }
  factors.push({ name: "Circuit Fit", weight: 7, value: circuitScore });

  // Calculate weighted total
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  score = factors.reduce((sum, f) => sum + (f.value * f.weight / 100), 0) * (100 / totalWeight);

  // EXTRA BOOST FOR HAVING THE BEST CAR ON THE GRID!
  const carValues = allTeams.map(t => t.carPerformance || 60);
  const bestCar = Math.max(...carValues);
  if (teamCarOverall >= bestCar - 2) { // Within 2 points of best car = huge boost!
    score += 15;
  } else if (teamCarOverall >= bestCar - 5) {
    score += 8;
  }

  return clamp(Math.round(score), 5, 100);
}

// ============================================
// 2. TEAM TIER CLASSIFICATION
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
// 3. CHAMPIONSHIP CONTEXT ANALYSIS
// ============================================
export function getChampionshipContext(team) {
  const { standings, aiTeams, season } = state;
  const context = {
    leadingConstructors: false,
    trailingConstructors: false,
    gapToNearest: 0,
    nearestRival: null,
    championshipBattle: false,
    remainingRounds: season.totalRounds - season.round + 1
  };

  if (!standings.teams || Object.keys(standings.teams).length === 0) {
    return context;
  }

  const sortedConstructors = Object.entries(standings.teams)
    .sort(([, a], [, b]) => b.points - a.points);
  
  const teamIndex = sortedConstructors.findIndex(([name]) => name === team.name);
  
  // Calculate nearest rival: check both ahead AND behind, pick closest!
  let nearestRival = null;
  let minGap = Infinity;
  
  for (let i = 0; i < sortedConstructors.length; i++) {
    if (i === teamIndex) continue;
    const gap = Math.abs(sortedConstructors[i][1].points - sortedConstructors[teamIndex][1].points);
    if (gap < minGap) {
      minGap = gap;
      nearestRival = sortedConstructors[i][0];
    }
  }
  context.nearestRival = nearestRival;

  if (teamIndex === 0) {
    context.leadingConstructors = true;
    context.gapToNearest = sortedConstructors[0][1].points - (sortedConstructors[1]?.[1]?.points || 0);
  } else if (teamIndex > 0) {
    context.trailingConstructors = true;
    context.gapToNearest = sortedConstructors[teamIndex - 1][1].points - sortedConstructors[teamIndex][1].points;
  }

  context.championshipBattle = context.gapToNearest <= 50 && context.remainingRounds >= 3;

  return context;
}

// ============================================
// 4. WEATHER IMPACT ANALYSIS
// ============================================
export function getWeatherImpact(isWet) {
  return {
    isWet,
    varianceMultiplier: isWet ? 1.8 : 1.0,
    opportunityScore: isWet ? 1.5 : 1.0,
    riskLevel: isWet ? "Elevated" : "Normal"
  };
}

// ============================================
// 5. OBJECTIVE TEMPLATE GENERATOR
// ============================================
function generateBaseObjectives(tier, championshipContext, weatherImpact) {
  const objectives = [];

  // Primary objectives based on tier
  switch (tier.id) {
    case "championship-favourite":
      objectives.push(
        {
          id: "win-race",
          label: "🏆 Win the Race",
          type: "primary",
          expectedFinish: 1,
          difficulty: "Extreme",
          riskLevel: weatherImpact.isWet ? "Very High" : "High",
          successProbability: weatherImpact.isWet ? 0.35 : 0.55,
          sponsorBonus: 25,
          boardImportance: 100
        },
        {
          id: "one-two",
          label: "🥇 One-Two Finish",
          type: "primary",
          expectedFinish: "1 & 2",
          difficulty: "Extreme",
          riskLevel: "High",
          successProbability: weatherImpact.isWet ? 0.20 : 0.35,
          sponsorBonus: 35,
          boardImportance: 95
        },
        {
          id: "pole-position",
          label: "⚡ Pole Position",
          type: "qualifying",
          expectedFinish: 1,
          difficulty: "Very High",
          riskLevel: "Medium",
          successProbability: weatherImpact.isWet ? 0.40 : 0.60,
          sponsorBonus: 15,
          boardImportance: 85
        },
        {
          id: "fastest-lap",
          label: "🔥 Fastest Lap",
          type: "bonus",
          expectedFinish: "Fastest",
          difficulty: "High",
          riskLevel: "Low",
          successProbability: 0.45,
          sponsorBonus: 10,
          boardImportance: 70
        }
      );
      if (championshipContext.leadingConstructors) {
        objectives.push({
          id: "extend-lead",
          label: "📈 Extend Championship Lead",
          type: "championship",
          expectedFinish: "+" + Math.max(5, championshipContext.gapToNearest),
          difficulty: "High",
          riskLevel: "Medium",
          successProbability: 0.60,
          sponsorBonus: 20,
          boardImportance: 98
        });
      }
      break;

    case "front-running":
      objectives.push(
        {
          id: "fight-victory",
          label: "⚔️ Fight for Victory",
          type: "primary",
          expectedFinish: "Top 3",
          difficulty: "Very High",
          riskLevel: weatherImpact.isWet ? "Very High" : "High",
          successProbability: weatherImpact.isWet ? 0.45 : 0.55,
          sponsorBonus: 20,
          boardImportance: 95
        },
        {
          id: "secure-podium",
          label: "🥈 Secure Podium",
          type: "primary",
          expectedFinish: 3,
          difficulty: "High",
          riskLevel: "Medium",
          successProbability: 0.70,
          sponsorBonus: 18,
          boardImportance: 90
        },
        {
          id: "beat-rival",
          label: "🔴 Beat " + (championshipContext.nearestRival || "Rival"),
          type: "rival",
          expectedFinish: "Ahead",
          difficulty: "High",
          riskLevel: "Medium",
          successProbability: 0.55,
          sponsorBonus: 15,
          boardImportance: 88
        },
        {
          id: "max-constructor",
          label: "📊 Maximise Constructor Points",
          type: "points",
          expectedFinish: "Both in Points",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.75,
          sponsorBonus: 12,
          boardImportance: 85
        }
      );
      break;

    case "upper-midfield":
      objectives.push(
        {
          id: "top-6",
          label: "🎯 Finish Inside Top 6",
          type: "primary",
          expectedFinish: 6,
          difficulty: "High",
          riskLevel: "Medium",
          successProbability: weatherImpact.isWet ? 0.60 : 0.50,
          sponsorBonus: 15,
          boardImportance: 90
        },
        {
          id: "challenge-podium",
          label: "🌟 Challenge Podium if Possible",
          type: "opportunistic",
          expectedFinish: 3,
          difficulty: "Very High",
          riskLevel: weatherImpact.isWet ? "High" : "Medium",
          successProbability: weatherImpact.isWet ? 0.30 : 0.20,
          sponsorBonus: 25,
          boardImportance: 75
        },
        {
          id: "beat-constructor-rival",
          label: "🔵 Beat Direct Constructor Rival",
          type: "rival",
          expectedFinish: "Ahead",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.60,
          sponsorBonus: 12,
          boardImportance: 85
        }
      );
      break;

    case "midfield":
      objectives.push(
        {
          id: "score-points",
          label: "✅ Score Points",
          type: "primary",
          expectedFinish: 10,
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: weatherImpact.isWet ? 0.55 : 0.45,
          sponsorBonus: 12,
          boardImportance: 88
        },
        {
          id: "reach-q3",
          label: "⏱️ Reach Q3",
          type: "qualifying",
          expectedFinish: "Top 10",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: weatherImpact.isWet ? 0.50 : 0.40,
          sponsorBonus: 8,
          boardImportance: 75
        },
        {
          id: "beat-closest-rival",
          label: "🟢 Beat Closest Constructor Rival",
          type: "rival",
          expectedFinish: "Ahead",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.55,
          sponsorBonus: 10,
          boardImportance: 82
        }
      );
      break;

    case "lower-midfield":
      objectives.push(
        {
          id: "reach-q2",
          label: "⏱️ Reach Q2",
          type: "qualifying",
          expectedFinish: "Top 15",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: weatherImpact.isWet ? 0.60 : 0.50,
          sponsorBonus: 6,
          boardImportance: 70
        },
        {
          id: "fight-for-points",
          label: "🎯 Fight for Points",
          type: "primary",
          expectedFinish: 10,
          difficulty: "High",
          riskLevel: "Medium",
          successProbability: weatherImpact.isWet ? 0.35 : 0.25,
          sponsorBonus: 15,
          boardImportance: 85
        },
        {
          id: "gain-positions",
          label: "📈 Gain Positions from Grid",
          type: "progress",
          expectedFinish: "+3 positions",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.55,
          sponsorBonus: 8,
          boardImportance: 70
        }
      );
      break;

    case "backmarker":
    default:
      objectives.push(
        {
          id: "reach-q2-backmarker",
          label: "⏱️ Reach Q2",
          type: "qualifying",
          expectedFinish: "Top 15",
          difficulty: "High",
          riskLevel: "Low",
          successProbability: weatherImpact.isWet ? 0.45 : 0.30,
          sponsorBonus: 10,
          boardImportance: 75
        },
        {
          id: "top-10-backmarker",
          label: "🌟 Finish in Top 10",
          type: "opportunistic",
          expectedFinish: 10,
          difficulty: "Very High",
          riskLevel: weatherImpact.isWet ? "High" : "Medium",
          successProbability: weatherImpact.isWet ? 0.25 : 0.15,
          sponsorBonus: 20,
          boardImportance: 80
        },
        {
          id: "capitalise-safety-car",
          label: "🚗 Capitalise on Safety Cars",
          type: "opportunistic",
          expectedFinish: "Any",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.40,
          sponsorBonus: 5,
          boardImportance: 65
        },
        {
          id: "gain-positions-backmarker",
          label: "📈 Gain Positions",
          type: "progress",
          expectedFinish: "+2 positions",
          difficulty: "Medium",
          riskLevel: "Low",
          successProbability: 0.60,
          sponsorBonus: 6,
          boardImportance: 68
        }
      );
  }

  // Weather-adapted objectives
  if (weatherImpact.isWet) {
    objectives.push({
      id: "wet-race-opportunity",
      label: "🌧️ Take Wet Race Opportunity",
      type: "weather",
      expectedFinish: "Any",
      difficulty: "High",
      riskLevel: "High",
      successProbability: 0.40,
      sponsorBonus: 18,
      boardImportance: 75
    });
  }

  return objectives;
}

// ============================================
// 6. MAIN OBJECTIVE GENERATOR
// ============================================
export function generateRaceObjectives(team, track, isWet = false) {
  const expectationScore = calculateExpectationScore(team, track);
  const tier = getTeamTier(expectationScore);
  const championshipContext = getChampionshipContext(team);
  const weatherImpact = getWeatherImpact(isWet);

  const objectives = generateBaseObjectives(tier, championshipContext, weatherImpact);

  return {
    expectationScore,
    tier,
    championshipContext,
    weatherImpact,
    objectives,
    // Select recommended primary objective (first one)
    recommendedObjective: objectives.find(o => o.type === "primary") || objectives[0]
  };
}

// ============================================
// 7. STANDINGS IMPACT ANALYSIS
// ============================================
function calculateStandingsImpact(team) {
  const { standings } = state;
  
  // Get current constructor position
  let constructorPos = 0;
  let teamPoints = 0;
  const sortedConstructors = Object.entries(standings.teams)
    .sort(([, a], [, b]) => b - a);
  const teamIndex = sortedConstructors.findIndex(([name]) => name === team.name);
  
  if (teamIndex >= 0) {
    constructorPos = teamIndex + 1;
    teamPoints = sortedConstructors[teamIndex][1];
  }

  // Find nearest rival
  let nearestRival = null;
  let gapToRival = 0;
  if (constructorPos > 1) {
    nearestRival = sortedConstructors[constructorPos - 2][0];
    gapToRival = sortedConstructors[constructorPos - 2][1] - teamPoints;
  } else if (constructorPos < sortedConstructors.length) {
    nearestRival = sortedConstructors[constructorPos][0];
    gapToRival = teamPoints - sortedConstructors[constructorPos][1];
  }

  return {
    currentConstructorPosition: constructorPos || sortedConstructors.length,
    teamPoints,
    nearestRival,
    gapToRival,
    championshipBattle: constructorPos <= 3 && Math.abs(gapToRival) <= 50
  };
}

// ============================================
// 8. UNIFIED RACE WEEKEND GENERATOR
// ============================================
export function generateUnifiedRaceWeekend(team, currentRound = state.season.round) {
  const activeCalendar = state.season.calendar || [];
  const round = activeCalendar[currentRound - 1];
  if (!round) return null;

  // Weather calculation (from circuit data)
  const wetProbability = 0.3 + (Math.sin(currentRound * 0.7) * 0.2);
  const isWet = Math.random() < wetProbability;

  // Circuit characteristics
  const circuitType = (() => {
    const name = round.circuit.toLowerCase();
    if (name.includes('monaco') || name.includes('singapore') || name.includes('baku')) return 'Street Circuit';
    if (name.includes('monza') || name.includes('spa') || name.includes('las vegas')) return 'High Speed';
    if (name.includes('suzuka') || name.includes('silverstone') || name.includes('spa')) return 'High Downforce';
    return 'Permanent Circuit';
  })();

  // Get dynamic objectives and context
  const expectationScore = calculateExpectationScore(team, round);
  const tier = getTeamTier(expectationScore);
  const championshipContext = getChampionshipContext(team);
  const weatherContext = getWeatherImpact(isWet);
  const objectives = generateBaseObjectives(tier, championshipContext, weatherContext);
  const standingsImpact = calculateStandingsImpact(team);

  // Days until race calculation
  const daysUntilRace = Math.max(0, 14 - state.season.currentDay + (currentRound - 1) * 14);

  // Countdown display
  const countdown = daysUntilRace > 0 ? `${daysUntilRace} Days Until Race` : 'Race Weekend Open!';

  // Track temperature
  const trackTemp = Math.floor(20 + Math.random() * 25);

  // Race status
  const raceStatus = (() => {
    if (!state.weekendProgress) return 'Not Started';
    if (state.weekendProgress.raceComplete) return 'Complete';
    if (state.weekendProgress.qualifyingComplete) return 'Qualifying Complete';
    return 'Practice/Qualifying Pending';
  })();

  return {
    raceId: `${state.season.year}-${currentRound}`,
    round: currentRound,
    grandPrix: round.name,
    circuit: round.circuit,
    laps: round.laps,
    circuitType,
    weather: {
      isWet,
      rainProbability: Math.round(wetProbability * 100),
      trackTemperature: trackTemp,
      airTemperature: Math.floor(trackTemp - 4 + Math.random() * 6)
    },
    objectives,
    recommendedObjective: objectives.find(o => o.type === 'primary') || objectives[0],
    championshipContext,
    standingsImpact,
    countdown,
    raceStatus,
    expectationScore,
    tier
  };
}

// ============================================
// 9. SIMPLE LEGACY COMPATIBILITY (for existing code)
// ============================================
export const RACE_OBJECTIVES = [
  { id: 'win',          label: '🏆 Push For Win',         risk: 'High'    },
  { id: 'podium',       label: '🥈 Fight For Podium',      risk: 'Medium'  },
  { id: 'points',       label: '🎯 Finish In Points',       risk: 'Low'     },
  { id: 'conservative', label: '💰 Conservative Points',   risk: 'Minimal' },
  { id: 'gamble',       label: '🌧 Strategy Gamble',        risk: 'Extreme' },
];
