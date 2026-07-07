import { SPONSOR_SLOTS } from "../data/sponsors.js";

const roundMoney = (value) => Number((value || 0).toFixed(1));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getFinanceRoster = (team) => team ? [...(team.drivers || []), ...(team.reserveDriver ? [team.reserveDriver] : [])] : [];

export const FACILITY_CATALOG = [
  { id: "windTunnel", name: "Wind Tunnel", maxLevel: 5, baseCost: 18, buildDays: 24, benefit: "Improves aerodynamic upgrade gain", linkedSpec: "aero" },
  { id: "cfdDepartment", name: "CFD Department", maxLevel: 5, baseCost: 14, buildDays: 18, benefit: "Shortens aero and chassis development", linkedSpec: "aero" },
  { id: "simulator", name: "Simulator", maxLevel: 5, baseCost: 12, buildDays: 16, benefit: "Improves setup confidence and driver form", linkedSpec: "chassis" },
  { id: "composites", name: "Composite Manufacturing", maxLevel: 5, baseCost: 16, buildDays: 22, benefit: "Improves chassis upgrade quality", linkedSpec: "chassis" },
  { id: "powerUnitLab", name: "Power Unit Lab", maxLevel: 5, baseCost: 20, buildDays: 28, benefit: "Improves power unit development", linkedSpec: "engine" },
  { id: "reliabilityCentre", name: "Reliability Centre", maxLevel: 5, baseCost: 15, buildDays: 20, benefit: "Reduces mechanical failure exposure", linkedSpec: "reliability" },
  { id: "vehicleDynamics", name: "Vehicle Dynamics", maxLevel: 5, baseCost: 13, buildDays: 18, benefit: "Improves tyre use and chassis balance", linkedSpec: "chassis" },
  { id: "pitCrewTraining", name: "Pit Crew Training", maxLevel: 5, baseCost: 9, buildDays: 14, benefit: "Reduces average pit stop time", linkedSpec: "operations" },
];

export const STAFF_CATALOG = [
  { id: "technicalDirector", role: "Technical Director", specialty: "R&D direction", baseSalary: 7.5, rating: 82 },
  { id: "chiefDesigner", role: "Chief Designer", specialty: "Car concept", baseSalary: 6.8, rating: 80 },
  { id: "headAero", role: "Head of Aerodynamics", specialty: "Aero efficiency", baseSalary: 5.9, rating: 79 },
  { id: "raceStrategist", role: "Race Strategist", specialty: "Weekend execution", baseSalary: 4.7, rating: 78 },
  { id: "chiefMechanic", role: "Chief Mechanic", specialty: "Reliability", baseSalary: 4.3, rating: 76 },
  { id: "vehicleDynamicsHead", role: "Head of Vehicle Dynamics", specialty: "Tyres and balance", baseSalary: 4.8, rating: 77 },
  { id: "sportingDirector", role: "Sporting Director", specialty: "Contracts", baseSalary: 4.5, rating: 75 },
  { id: "performanceEngineer", role: "Performance Engineer", specialty: "Driver performance", baseSalary: 3.6, rating: 74 },
];

export const DEFAULT_BUDGET_ALLOCATION = {
  rnd: 28,
  facilities: 18,
  driverSalaries: 22,
  marketing: 10,
  reserveFund: 10,
  scouting: 5,
  driverAcademy: 5,
  operations: 2,
};

export const BUDGET_ALLOCATION_LABELS = {
  rnd: "R&D",
  facilities: "Facilities",
  driverSalaries: "Driver Salaries",
  marketing: "Marketing",
  reserveFund: "Reserve Fund",
  scouting: "Scouting",
  driverAcademy: "Driver Academy",
  operations: "Operations",
};

const SPONSOR_OBJECTIVE_TEMPLATES = [
  { id: "top10", label: "Finish inside Top 10", difficulty: "Medium", reward: 1.8, penalty: 0.7 },
  { id: "points", label: "Score points", difficulty: "Medium", reward: 2.1, penalty: 0.9 },
  { id: "beat_rival", label: "Beat constructor rival", difficulty: "Hard", reward: 2.6, penalty: 1.1 },
  { id: "q3", label: "Reach Q3", difficulty: "Medium", reward: 1.6, penalty: 0.6 },
  { id: "fastest_lap", label: "Score fastest lap", difficulty: "Hard", reward: 3.0, penalty: 1.2 },
  { id: "clean_finish", label: "Complete race without DNF", difficulty: "Easy", reward: 1.2, penalty: 0.8 },
  { id: "podium", label: "Finish on podium", difficulty: "Elite", reward: 4.5, penalty: 1.8 },
];

const RACE_BONUS_TEMPLATES = [
  { id: "fastest_lap", label: "Fastest Lap", cash: 1.6, sponsorHappiness: 5, boardConfidence: 2, reputation: 3 },
  { id: "double_points", label: "Double Points Finish", cash: 2.5, sponsorHappiness: 7, boardConfidence: 4, reputation: 4 },
  { id: "gain_positions", label: "Gain 5 Positions", cash: 1.4, sponsorHappiness: 3, boardConfidence: 3, reputation: 2 },
  { id: "no_dnf", label: "Finish Without DNF", cash: 1.2, sponsorHappiness: 4, boardConfidence: 3, reputation: 1 },
  { id: "beat_rival", label: "Finish Ahead of Constructor Rival", cash: 1.8, sponsorHappiness: 5, boardConfidence: 4, reputation: 3 },
  { id: "one_stop", label: "Complete One Stop Strategy", cash: 1.1, sponsorHappiness: 2, boardConfidence: 2, reputation: 1 },
];

function createFacilities() {
  return Object.fromEntries(FACILITY_CATALOG.map((facility) => [
    facility.id,
    { level: 1, maxLevel: facility.maxLevel, upgrading: false, readyDay: null },
  ]));
}

function createSeniorStaff(teamLevel = 1) {
  return STAFF_CATALOG.map((staff, index) => ({
    ...staff,
    rating: clamp(staff.rating + teamLevel + (index % 3), 60, 99),
    salary: roundMoney(staff.baseSalary + teamLevel * 0.25),
    contractYears: 2 + (index % 3),
    potential: clamp(staff.rating + 8 + (index % 4), 70, 99),
    experience: 4 + index,
  }));
}

function normalizeAllocation(allocation) {
  const next = { ...DEFAULT_BUDGET_ALLOCATION, ...(allocation || {}) };
  const total = Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0) || 100;
  return Object.fromEntries(Object.entries(next).map(([key, value]) => [key, Math.round((Number(value || 0) / total) * 100)]));
}

export function getFacilityUpgradeCost(facilityId, finance) {
  const catalog = FACILITY_CATALOG.find((entry) => entry.id === facilityId);
  const facility = finance?.facilities?.[facilityId];
  if (!catalog || !facility) return 0;
  return roundMoney(catalog.baseCost * Math.pow(1.42, Math.max(0, facility.level - 1)));
}

export function ensureFinanceState(appState) {
  if (!appState.finance || typeof appState.finance !== "object") appState.finance = {};
  const finance = appState.finance;
  finance.cashFlow = Array.isArray(finance.cashFlow) ? finance.cashFlow : [];
  finance.raceReports = Array.isArray(finance.raceReports) ? finance.raceReports : [];
  finance.boardReviews = Array.isArray(finance.boardReviews) ? finance.boardReviews : [];
  finance.emergencyActions = Array.isArray(finance.emergencyActions) ? finance.emergencyActions : [];
  finance.facilityProjects = Array.isArray(finance.facilityProjects) ? finance.facilityProjects : [];
  finance.facilities = finance.facilities || createFacilities();
  finance.staff = Array.isArray(finance.staff) ? finance.staff : createSeniorStaff(appState.team?.level || 1);
  finance.budgetAllocation = normalizeAllocation(finance.budgetAllocation);
  finance.boardConfidence = clamp(finance.boardConfidence ?? 68, 0, 100);
  finance.boardSatisfaction = clamp(finance.boardSatisfaction ?? 70, 0, 100);
  finance.reputation = clamp(finance.reputation ?? 62, 0, 100);
  finance.sponsorHappiness = clamp(finance.sponsorHappiness ?? 66, 0, 100);
  finance.academyFunding = finance.academyFunding ?? appState.academy?.budget ?? 0;
  finance.minorityOwnershipSold = finance.minorityOwnershipSold || 0;
  finance.loanBalance = finance.loanBalance || 0;

  for (const facility of FACILITY_CATALOG) {
    if (!finance.facilities[facility.id]) {
      finance.facilities[facility.id] = { level: 1, maxLevel: facility.maxLevel, upgrading: false, readyDay: null };
    }
  }

  return finance;
}

export function getDriverCommercialValue(driver) {
  const rating = typeof driver?.overallRating === "function"
    ? driver.overallRating()
    : Math.round(((driver?.pace || 75) + (driver?.quali || 75) + (driver?.racecraft || 75) + (driver?.market || 70)) / 4);
  const popularity = clamp(driver?.popularity ?? Math.round((driver?.market || 70) + rating * 0.12), 35, 99);
  const sponsorAppeal = clamp(driver?.sponsorAppeal ?? Math.round((driver?.market || 70) * 0.7 + (driver?.media || 70) * 0.3), 30, 99);
  const mediaRating = clamp(driver?.mediaRating ?? driver?.media ?? Math.round((driver?.market || 70) * 0.85), 30, 99);
  const fanFollowing = clamp(driver?.fanFollowing ?? popularity, 30, 99);
  const merchandiseRevenue = roundMoney((popularity * 0.035) + (sponsorAppeal * 0.018) + Math.max(0, rating - 75) * 0.05);

  return { popularity, sponsorAppeal, mediaRating, fanFollowing, merchandiseRevenue };
}

export function getTeamCommercialSummary(appState) {
  const finance = ensureFinanceState(appState);
  const roster = getFinanceRoster(appState.team);
  const driverMerch = roster.reduce((sum, driver) => sum + getDriverCommercialValue(driver).merchandiseRevenue, 0);
  const monthlySponsorIncome = Object.values(appState.team?.sponsorSlots || {}).reduce((sum, sponsor) => sum + (sponsor?.monthlyIncome || sponsor?.fee || 0), 0);
  const staffSalaries = finance.staff.reduce((sum, staff) => sum + (staff.salary || 0), 0);
  const driverSalaries = roster.reduce((sum, driver) => sum + (driver.salary || 0), 0);
  const facilityMaintenance = Object.values(finance.facilities).reduce((sum, facility) => sum + (facility.level || 1) * 0.45, 0);
  const operatingCosts = roundMoney(4.8 + facilityMaintenance + (finance.loanBalance || 0) * 0.02);

  return {
    monthlySponsorIncome: roundMoney(monthlySponsorIncome),
    driverMerch: roundMoney(driverMerch),
    staffSalaries: roundMoney(staffSalaries / 24),
    driverSalaries: roundMoney(driverSalaries / 24),
    facilityMaintenance: roundMoney(facilityMaintenance),
    operatingCosts,
    projectedEndBalance: roundMoney((appState.team?.budget || 0) + ((monthlySponsorIncome + driverMerch) - operatingCosts) * 6),
  };
}

export function hydrateSponsorContract(sponsor, appState, slotKey) {
  if (!sponsor) return null;
  const finance = ensureFinanceState(appState);
  const round = appState.season?.round || 1;
  const prestigeBase = sponsor.brandPrestige || Math.round(58 + (sponsor.bonus || 8) * 1.2);
  const templateIndex = Math.abs((sponsor.id || slotKey || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % SPONSOR_OBJECTIVE_TEMPLATES.length;
  const objectiveA = SPONSOR_OBJECTIVE_TEMPLATES[templateIndex];
  const objectiveB = SPONSOR_OBJECTIVE_TEMPLATES[(templateIndex + 3) % SPONSOR_OBJECTIVE_TEMPLATES.length];

  return {
    ...sponsor,
    slotKey,
    signingBonus: sponsor.signingBonus ?? sponsor.bonus ?? 0,
    monthlyIncome: sponsor.monthlyIncome ?? sponsor.fee ?? 0,
    performanceBonus: sponsor.performanceBonus ?? roundMoney((sponsor.fee || 1) * 0.8),
    contractLength: sponsor.contractLength ?? 12,
    signedRound: sponsor.signedRound ?? round,
    expiresRound: sponsor.expiresRound ?? round + (sponsor.contractLength ?? 12),
    brandPrestige: clamp(prestigeBase, 30, 99),
    relationshipLevel: clamp(sponsor.relationshipLevel ?? finance.sponsorHappiness, 0, 100),
    objectives: sponsor.objectives?.length ? sponsor.objectives : [objectiveA, objectiveB].map((objective, index) => ({
      ...objective,
      deadline: round + 2 + index,
      reward: roundMoney(objective.reward + (sponsor.fee || 0) * 0.25),
      penalty: roundMoney(objective.penalty),
      complete: false,
    })),
  };
}

export function generateRaceBonusChallenges(appState, round) {
  const seed = (round?.round || appState.season?.round || 1) + (appState.raceHistory?.length || 0);
  return RACE_BONUS_TEMPLATES.map((template, index) => RACE_BONUS_TEMPLATES[(seed + index) % RACE_BONUS_TEMPLATES.length]).slice(0, 3);
}

function evaluateChallenge(challenge, reportContext) {
  const { playerResults, fastestLap, totalPoints, gridGain } = reportContext;
  if (!playerResults.length) return false;
  if (challenge.id === "fastest_lap") return playerResults.some((result) => result.name === fastestLap);
  if (challenge.id === "double_points") return playerResults.filter((result) => result.points > 0).length >= 2;
  if (challenge.id === "gain_positions") return gridGain >= 5;
  if (challenge.id === "no_dnf") return playerResults.every((result) => !result.retired);
  if (challenge.id === "beat_rival") return totalPoints >= 6 || playerResults.some((result) => result.finishPos <= 8);
  if (challenge.id === "one_stop") return playerResults.every((result) => !result.retired) && playerResults.some((result) => result.finishPos <= 10);
  return false;
}

function evaluateSponsorObjective(objective, reportContext) {
  const { playerResults, fastestLap, totalPoints, gridGain } = reportContext;
  if (!playerResults.length) return false;
  if (objective.id === "top10") return playerResults.some((result) => result.finishPos <= 10 && !result.retired);
  if (objective.id === "points") return totalPoints > 0;
  if (objective.id === "beat_rival") return totalPoints >= 4 || gridGain >= 3;
  if (objective.id === "q3") return playerResults.some((result) => (result.gridPos || 99) <= 10);
  if (objective.id === "fastest_lap") return playerResults.some((result) => result.name === fastestLap);
  if (objective.id === "clean_finish") return playerResults.every((result) => !result.retired);
  if (objective.id === "podium") return playerResults.some((result) => result.finishPos <= 3 && !result.retired);
  return false;
}

export function processRaceFinance(appState, raceRecord, round) {
  const finance = ensureFinanceState(appState);
  const summary = getTeamCommercialSummary(appState);
  const playerResults = raceRecord.driverResults.filter((result) => result.team === appState.team?.name);
  const totalPoints = playerResults.reduce((sum, result) => sum + (result.points || 0), 0);
  const gridGain = playerResults.reduce((sum, result) => sum + Math.max(0, (result.gridPos || result.finishPos) - result.finishPos), 0);
  const reportContext = { playerResults, fastestLap: raceRecord.fastestLap, totalPoints, gridGain };

  const baseSponsorIncome = summary.monthlySponsorIncome;
  const prizeMoney = roundMoney(totalPoints * 0.35 + (playerResults.some((result) => result.finishPos <= 3) ? 2 : 0));
  const merchandiseSales = summary.driverMerch;
  const bonuses = generateRaceBonusChallenges(appState, round).map((challenge) => ({
    ...challenge,
    complete: evaluateChallenge(challenge, reportContext),
  }));
  const raceBonusCash = roundMoney(bonuses.filter((bonus) => bonus.complete).reduce((sum, bonus) => sum + bonus.cash, 0));

  let sponsorObjectiveCash = 0;
  let sponsorPenalty = 0;
  for (const slot of SPONSOR_SLOTS) {
    const sponsor = appState.team?.sponsorSlots?.[slot.key];
    if (!sponsor?.objectives?.length) continue;
    sponsor.objectives = sponsor.objectives.map((objective) => {
      if (objective.complete) return objective;
      const due = (appState.season?.round || 1) >= objective.deadline;
      const achieved = evaluateSponsorObjective(objective, reportContext);
      if (achieved) {
        sponsorObjectiveCash += objective.reward || 0;
        sponsor.relationshipLevel = clamp((sponsor.relationshipLevel || 60) + 5, 0, 100);
        return { ...objective, complete: true, lastResult: "Achieved" };
      }
      if (due) {
        sponsorPenalty += objective.penalty || 0;
        sponsor.relationshipLevel = clamp((sponsor.relationshipLevel || 60) - 6, 0, 100);
        return { ...objective, complete: false, lastResult: "Missed" };
      }
      return objective;
    });
  }

  const income = roundMoney(baseSponsorIncome + prizeMoney + merchandiseSales + raceBonusCash + sponsorObjectiveCash);
  const expenses = roundMoney(summary.operatingCosts + summary.driverSalaries + summary.staffSalaries + sponsorPenalty);
  const netProfit = roundMoney(income - expenses);
  appState.team.budget = roundMoney((appState.team.budget || 0) + netProfit);

  finance.boardConfidence = clamp(finance.boardConfidence + (totalPoints > 0 ? 2 : -2) + (netProfit >= 0 ? 1 : -1), 0, 100);
  finance.boardSatisfaction = clamp(finance.boardSatisfaction + (totalPoints > 0 ? 2 : -3), 0, 100);
  finance.sponsorHappiness = clamp(finance.sponsorHappiness + bonuses.filter((bonus) => bonus.complete).length * 2 - sponsorPenalty, 0, 100);
  finance.reputation = clamp(finance.reputation + (playerResults.some((result) => result.finishPos <= 3) ? 3 : totalPoints > 0 ? 1 : 0), 0, 100);

  const report = {
    id: `S${raceRecord.season}-R${raceRecord.round}`,
    raceName: raceRecord.name,
    round: raceRecord.round,
    season: raceRecord.season,
    raceIncome: roundMoney(baseSponsorIncome + raceBonusCash + sponsorObjectiveCash),
    sponsorIncome: baseSponsorIncome,
    prizeMoney,
    merchandiseSales,
    operatingCosts: summary.operatingCosts,
    staffSalaries: summary.staffSalaries,
    driverSalaries: summary.driverSalaries,
    facilityCosts: summary.facilityMaintenance,
    sponsorPenalty: roundMoney(sponsorPenalty),
    netProfit,
    runningSeasonBalance: appState.team.budget,
    bonuses,
  };

  finance.raceReports.push(report);
  finance.cashFlow.push({ label: `R${raceRecord.round}`, income, expenses, net: netProfit, balance: appState.team.budget });
  finance.cashFlow = finance.cashFlow.slice(-12);

  maybeCreateBoardReview(appState);
  return report;
}

export function maybeCreateBoardReview(appState) {
  const finance = ensureFinanceState(appState);
  const round = appState.season?.round || 1;
  if (round % 2 !== 0) return null;
  if (finance.boardReviews.some((review) => review.round === round && review.season === (appState.season?.year || 1))) return null;
  const summary = getTeamCommercialSummary(appState);
  const latestFlow = finance.cashFlow.slice(-2);
  const revenue = roundMoney(latestFlow.reduce((sum, item) => sum + item.income, 0));
  const expenses = roundMoney(latestFlow.reduce((sum, item) => sum + item.expenses, 0));
  const profit = roundMoney(revenue - expenses);
  const boardAction = profit < 0
    ? "Request Cost Reductions"
    : finance.boardSatisfaction > 78
      ? "Increase Budget"
      : finance.facilityProjects.length
        ? "Approve Major Investments"
        : "Demand Better Results";

  const review = {
    round,
    season: appState.season?.year || 1,
    revenue,
    expenses,
    cashFlow: profit,
    profit,
    budgetForecast: summary.projectedEndBalance,
    sponsorGrowth: finance.sponsorHappiness,
    championshipProgress: appState.standings?.teams?.[appState.team?.name] || 0,
    boardSatisfaction: finance.boardSatisfaction,
    boardAction,
  };
  finance.boardReviews.push(review);
  return review;
}

export function requestFacilityInvestment(appState, facilityId) {
  const finance = ensureFinanceState(appState);
  const catalog = FACILITY_CATALOG.find((entry) => entry.id === facilityId);
  const facility = finance.facilities[facilityId];
  if (!catalog || !facility) return { ok: false, reason: "Facility not found." };
  if (facility.level >= catalog.maxLevel) return { ok: false, reason: "Facility is already maxed." };
  if (facility.upgrading) return { ok: false, reason: "Facility upgrade already in progress." };

  const cost = getFacilityUpgradeCost(facilityId, finance);
  if ((appState.team?.budget || 0) < cost) return { ok: false, reason: `Need $${cost}M for this facility investment.` };

  appState.team.budget = roundMoney(appState.team.budget - cost);
  facility.upgrading = true;
  facility.readyDay = (appState.season?.currentDay || 1) + catalog.buildDays;
  finance.facilityProjects.push({ facilityId, name: catalog.name, cost, readyDay: facility.readyDay, startedRound: appState.season?.round || 1 });
  return { ok: true, cost, facility: catalog, readyDay: facility.readyDay };
}

export function processFacilityProjects(appState) {
  const finance = ensureFinanceState(appState);
  const currentDay = appState.season?.currentDay || 1;
  const completed = [];
  finance.facilityProjects = finance.facilityProjects.filter((project) => {
    if (project.readyDay > currentDay) return true;
    const facility = finance.facilities[project.facilityId];
    const catalog = FACILITY_CATALOG.find((entry) => entry.id === project.facilityId);
    if (facility && catalog) {
      facility.level = Math.min(catalog.maxLevel, (facility.level || 1) + 1);
      facility.upgrading = false;
      facility.readyDay = null;
      if (catalog.linkedSpec && appState.team?.specs?.[catalog.linkedSpec] != null) {
        appState.team.specs[catalog.linkedSpec] = clamp(appState.team.specs[catalog.linkedSpec] + 1.2, 40, 99);
      }
      finance.boardSatisfaction = clamp(finance.boardSatisfaction + 1, 0, 100);
      completed.push({ ...project, level: facility.level });
    }
    return false;
  });
  return completed;
}

export function setBudgetAllocation(appState, key, value) {
  const finance = ensureFinanceState(appState);
  if (!(key in DEFAULT_BUDGET_ALLOCATION)) return finance.budgetAllocation;
  finance.budgetAllocation[key] = clamp(Math.round(value), 0, 60);
  finance.budgetAllocation = normalizeAllocation(finance.budgetAllocation);
  finance.boardSatisfaction = clamp(finance.boardSatisfaction + (key === "reserveFund" && value > 12 ? 1 : 0), 0, 100);
  return finance.budgetAllocation;
}

export function applyEmergencyFinanceAction(appState, actionId) {
  const finance = ensureFinanceState(appState);
  const existing = finance.emergencyActions.filter((action) => action.id === actionId).length;
  if (actionId === "loan") {
    appState.team.budget = roundMoney((appState.team.budget || 0) + 35);
    finance.loanBalance = roundMoney((finance.loanBalance || 0) + 42);
    finance.boardSatisfaction = clamp(finance.boardSatisfaction - 5, 0, 100);
  } else if (actionId === "minority_sale") {
    appState.team.budget = roundMoney((appState.team.budget || 0) + 55);
    finance.minorityOwnershipSold = clamp((finance.minorityOwnershipSold || 0) + 8, 0, 49);
    finance.boardConfidence = clamp(finance.boardConfidence - 8, 0, 100);
  } else if (actionId === "emergency_sponsor") {
    appState.team.budget = roundMoney((appState.team.budget || 0) + 18);
    finance.sponsorHappiness = clamp(finance.sponsorHappiness - 7, 0, 100);
  } else if (actionId === "staff_cuts") {
    appState.team.budget = roundMoney((appState.team.budget || 0) + 12);
    finance.staff = finance.staff.map((staff, index) => index > 4 ? { ...staff, rating: clamp(staff.rating - 2, 50, 99), salary: roundMoney(staff.salary * 0.88) } : staff);
    finance.reputation = clamp(finance.reputation - 5, 0, 100);
  }
  finance.emergencyActions.push({ id: actionId, round: appState.season?.round || 1, season: appState.season?.year || 1, count: existing + 1 });
}

export function getFinanceAdvisorNotes(appState) {
  const finance = ensureFinanceState(appState);
  const summary = getTeamCommercialSummary(appState);
  const notes = [];
  if ((appState.team?.budget || 0) < 20) notes.push("Cash reserve is thin. Consider delaying non-critical facility upgrades.");
  if (summary.driverMerch > 6) notes.push("Merchandising revenue is becoming a meaningful driver of cash flow.");
  if (finance.budgetAllocation.driverAcademy < 6) notes.push("Driver Academy funding is low, which will weaken long-term talent options.");
  if (finance.sponsorHappiness < 55) notes.push("Sponsor income is below expectations. Prioritise achievable partner objectives.");
  if (summary.facilityMaintenance > 9) notes.push("Facility maintenance costs are becoming excessive.");
  if (finance.boardSatisfaction > 80) notes.push("The board is open to major investments if cash reserves stay protected.");
  if (!notes.length) notes.push("Financial posture is stable. The next advantage likely comes from targeted facilities investment.");
  return notes.slice(0, 5);
}
