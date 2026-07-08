import { drivers } from "../data/drivers.js";

// Helper to check if driver is available
function isDriverAvailable(driver, state) {
  if (state.team.drivers.some(d => d.name === driver.name)) return false;
  if (state.team.reserveDriver?.name === driver.name) return false;
  if (state.aiTeams) {
    for (const aiTeam of state.aiTeams) {
      if (aiTeam.drivers.some(d => d.name === driver.name)) return false;
      if (aiTeam.reserveDriver?.name === driver.name) return false;
    }
  }
  return true;
}

// Team context analyzer
function analyzeTeamContext(state) {
  const teamStandings = state.standings?.teams || {};
  const teamName = state.team?.name;
  let constructorPosition = 11; // backmarker default
  
  if (teamName) {
    const sortedTeams = Object.entries(teamStandings)
      .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
    constructorPosition = sortedTeams.findIndex(([name]) => name === teamName) + 1;
    if (constructorPosition === 0) constructorPosition = 11;
  }

  let teamType = "rebuilding";
  if (constructorPosition <= 3) teamType = "contender";
  else if (constructorPosition <= 6) teamType = "midfield";
  else if (constructorPosition <= 8) teamType = "upper-midfield";

  const budget = state.team?.budget || 0;
  let financialStatus = "healthy";
  if (budget < 50) financialStatus = "struggling";
  else if (budget < 100) financialStatus = "moderate";

  return {
    constructorPosition,
    teamType,
    financialStatus,
    budget,
    currentDrivers: state.team?.drivers || [],
    reserveDriver: state.team?.reserveDriver,
  };
}

// Scoring profiles
const PROFILES = {
  default: {
    pace: 0.2,
    quali: 0.15,
    racecraft: 0.15,
    consistency: 0.15,
    tyre: 0.1,
    wet: 0.05,
    potential: 0.1,
    age: -0.05,
    salary: -0.05,
  },
  replacement: {
    pace: 0.25,
    quali: 0.15,
    racecraft: 0.2,
    consistency: 0.15,
    tyre: 0.1,
    salary: -0.1,
  },
  youngTalent: {
    potential: 0.4,
    age: -0.3,
    developmentRate: 0.2,
    pace: 0.15,
    quali: 0.05,
    racecraft: 0.05,
  },
  budget: {
    salary: -0.4,
    pace: 0.15,
    quali: 0.1,
    racecraft: 0.1,
    consistency: 0.1,
    tyre: 0.05,
  },
  longTerm: {
    potential: 0.35,
    age: -0.3,
    developmentRate: 0.2,
    feedback: 0.1,
    pace: 0.1,
  },
  qualifier: {
    quali: 0.4,
    pace: 0.3,
    consistency: 0.15,
    wet: 0.1,
  },
  racer: {
    racecraft: 0.35,
    pace: 0.25,
    tyre: 0.2,
    consistency: 0.15,
    wet: 0.05,
  },
  tyreManager: {
    tyre: 0.4,
    consistency: 0.3,
    racecraft: 0.15,
    pace: 0.1,
  },
  value: {
    salary: -0.3,
    pace: 0.2,
    quali: 0.1,
    racecraft: 0.1,
    consistency: 0.1,
    potential: 0.2,
  },
  reserve: {
    pace: 0.15,
    quali: 0.15,
    racecraft: 0.15,
    consistency: 0.15,
    feedback: 0.2,
    adaptability: 0.1,
    salary: -0.1,
  },
};

// Parse user request to determine profile
function parseUserRequest(request, state) {
  const req = request.toLowerCase();
  let profile = "default";
  let replacementDriverName = null;

  // Check for replacement requests
  state.team?.drivers?.forEach((driver) => {
    if (req.includes(driver.name.toLowerCase())) {
      profile = "replacement";
      replacementDriverName = driver.name;
    }
  });

  if (req.includes("young") || req.includes("talent") || req.includes("future")) {
    profile = "youngTalent";
  } else if (req.includes("budget") || req.includes("cheap") || req.includes("under")) {
    profile = "budget";
  } else if (req.includes("long term") || req.includes("5 years")) {
    profile = "longTerm";
  } else if (req.includes("qualify") || req.includes("quali")) {
    profile = "qualifier";
  } else if (req.includes("race pace") || req.includes("racer")) {
    profile = "racer";
  } else if (req.includes("tyre") || req.includes("tire")) {
    profile = "tyreManager";
  } else if (req.includes("value") || req.includes("bargain")) {
    profile = "value";
  } else if (req.includes("reserve")) {
    profile = "reserve";
  }

  return { profile, replacementDriverName };
}

// Calculate driver score
function calculateDriverScore(driver, profileKey, teamContext) {
  const profile = PROFILES[profileKey] || PROFILES.default;
  let score = 0;

  // Normalize all stats to 0-100
  const norm = (val, min = 0, max = 100) => Math.max(min, Math.min(max, val));

  // Pace, quali, racecraft, consistency, tyre, wet
  score += norm(driver.pace) * (profile.pace || 0);
  score += norm(driver.quali) * (profile.quali || 0);
  score += norm(driver.racecraft) * (profile.racecraft || 0);
  score += norm(driver.consistency) * (profile.consistency || 0);
  score += norm(driver.tyre) * (profile.tyre || 0);
  score += norm(driver.wet) * (profile.wet || 0);

  // Potential
  const potential = driver.potentialCeiling || (driver.pace * 1.05 + 3);
  score += norm(potential) * (profile.potential || 0);

  // Age
  const ageScore = 100 - driver.age; // younger = higher
  score += norm(ageScore) * (profile.age || 0);

  // Development rate
  const devRate = driver.developmentRate || (driver.age <= 21 ? 80 : driver.age <= 25 ? 65 : 45);
  score += norm(devRate) * (profile.developmentRate || 0);

  // Feedback
  const feedback = driver.feedback || ((driver.consistency || 70) * 0.95);
  score += norm(feedback) * (profile.feedback || 0);

  // Adaptability
  const adaptability = driver.adaptability || (driver.racecraft || 70);
  score += norm(adaptability) * (profile.adaptability || 0);

  // Salary (normalize inversely, 0-100)
  const maxSalary = 60; // Max salary in game
  const salaryScore = Math.max(0, 100 - (driver.salary / maxSalary) * 100);
  score += salaryScore * (profile.salary || 0);

  // Adjust for team context
  if (teamContext.teamType === "contender") {
    score *= 1.05; // boost top-tier drivers
  }
  if (teamContext.financialStatus === "struggling" && profileKey !== "budget") {
    score *= 0.95; // penalize expensive drivers for poor teams
  }

  return Math.max(0, Math.min(100, score));
}

// Generate scouting report for driver
function generateScoutingReport(driver, teamContext, profileKey, rank = 1) {
  const overall = driver.currentRating();
  const potential = driver.potentialCeiling || (driver.pace * 1.05 + 3);
  const strengths = [];
  const weaknesses = [];

  // Find key strengths
  if (driver.pace > 90) strengths.push("elite raw pace");
  else if (driver.pace > 85) strengths.push("very strong pace");
  
  if (driver.quali > 90) strengths.push("exceptional qualifier");
  else if (driver.quali > 85) strengths.push("strong qualifying performances");
  
  if (driver.racecraft > 90) strengths.push("world-class racecraft");
  else if (driver.racecraft > 85) strengths.push("impressive racecraft");
  
  if (driver.consistency > 90) strengths.push("rock-solid consistency");
  else if (driver.consistency > 85) strengths.push("reliable and consistent");
  
  if (driver.tyre > 85) strengths.push("excellent tyre management");
  
  if (driver.wet > 85) strengths.push("specialist in wet conditions");
  
  if (driver.age <= 22) strengths.push("tremendous development upside");
  else if (driver.age <= 26) strengths.push("still has room to grow");
  
  if ((driver.developmentRate || 60) > 75) strengths.push("quick learner");
  
  if (driver.salary <= 15) strengths.push("very affordable salary");

  // Find weaknesses
  if (driver.pace < 80) weaknesses.push("lacking top-end pace");
  if (driver.quali < 80) weaknesses.push("needs to improve qualifying");
  if (driver.racecraft < 80) weaknesses.push("racecraft needs refinement");
  if (driver.consistency < 80) weaknesses.push("inconsistent performances");
  if (driver.tyre < 75) weaknesses.push("struggles with tyre management");
  if (driver.age > 35) weaknesses.push("age may be a factor long-term");
  if (driver.salary > 30) weaknesses.push("high salary demands");

  // Generate the report text
  let report = "";
  
  if (rank === 1) {
    report = `${driver.name} is our top recommendation. `;
  } else if (rank === 2) {
    report = `${driver.name} is our second-choice target. `;
  } else {
    report = `${driver.name} is a solid option to consider. `;
  }

  if (strengths.length > 0) {
    report += `With strengths in ${strengths.slice(0, 3).join(", ")}${strengths.length > 3 ? ", and more" : ""}, `;
  }

  if (teamContext.teamType === "contender") {
    report += `they should be able to contribute immediately to a championship-caliber team. `;
  } else if (teamContext.teamType === "midfield") {
    report += `they could be a key piece in our push to move up the grid. `;
  } else {
    report += `they fit perfectly with our rebuilding project. `;
  }

  if (weaknesses.length > 0 && rank <= 2) {
    report += `Areas to monitor include ${weaknesses.slice(0, 2).join(" and ")}. `;
  }

  report += `Overall, this is a high-quality driver who should bring value to the team.`;

  return {
    driver,
    compatibility: calculateDriverScore(driver, profileKey, teamContext),
    confidence: 70 + Math.random() * 20,
    financialRisk: driver.salary > 25 ? "High" : driver.salary > 15 ? "Moderate" : "Low",
    longTermValue: driver.age <= 25 ? "Excellent" : driver.age <= 30 ? "Good" : "Fair",
    championshipImpact: overall > 90 ? "Immediate" : overall > 80 ? "Development" : "Project",
    expectedOverallIn3Years: Math.min(99, Math.round(potential * (0.9 + Math.random() * 0.2))),
    strengths,
    weaknesses,
    report,
    salary: driver.salary,
    overall,
    potential,
    marketValue: driver.market,
  };
}

// Main function: Get recommendations
export function getChiefScoutRecommendations(state, userRequest = "Find the best available driver") {
  const teamContext = analyzeTeamContext(state);
  const { profile, replacementDriverName } = parseUserRequest(userRequest, state);

  // Get only available drivers
  const availableDrivers = drivers.filter(d => isDriverAvailable(d, state));

  // Score and sort
  const scoredDrivers = availableDrivers
    .map(driver => ({
      driver,
      score: calculateDriverScore(driver, profile, teamContext),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top 3
  const top3 = scoredDrivers.slice(0, 3);

  // Generate full reports
  const recommendations = top3.map((scored, index) => 
    generateScoutingReport(scored.driver, teamContext, profile, index + 1)
  );

  return {
    recommendations,
    teamContext,
    profile,
    replacementDriverName,
    rawRequest: userRequest,
  };
}
