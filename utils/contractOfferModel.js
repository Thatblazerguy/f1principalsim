// Pure helpers for the contract builder and driver comparison.
//
// Nothing here changes game rules. Acceptance odds are read straight from the
// existing engines:
//   - Reserve-role offers (My drivers → replace a race driver) go through
//     NegotiationSession in game/driverNegotiation.js. Resistance is taken from
//     a real NegotiationSession instance, and the success chances below are the
//     same expressions its handlers roll against.
//   - Market offers go through MarketScreen.handleSign, which signs any unemployed
//     driver at their asking salary as long as the reserve seat is free. There is
//     no dice roll, so the odds are either 100% or 0%.
// Budget maths mirrors utils/financeSystem.js: each race weekend charges
// (driver.salary / 24) from team.budget (getTeamCommercialSummary → applyRaceFinances).

import { NegotiationSession } from "../game/driverNegotiation.js";
import { getDriverCommercialValue } from "./financeSystem.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round((v || 0) * 10) / 10;

/** Salary is charged per race at salary / SALARY_DIVISOR (financeSystem.getTeamCommercialSummary). */
export const SALARY_DIVISOR = 24;
/** The "money talks" option in NegotiationSession promises a 20% raise. */
export const MONEY_RAISE = 0.2;

export const CONTRACT_LIMITS = { minSeasons: 1, maxSeasons: 5, salaryStep: 0.5, maxRaise: 0.6 };

// ─── Driver attributes the sim actually models ─────────────────────────────
// The six core attributes averaged by Driver.overallRating().
export const RADAR_AXES = [
  { key: "pace", label: "Pace", short: "PAC" },
  { key: "quali", label: "Qualifying", short: "QUA" },
  { key: "racecraft", label: "Racecraft", short: "RAC" },
  { key: "tyre", label: "Tyre management", short: "TYR" },
  { key: "wet", label: "Wet weather", short: "WET" },
  { key: "consistency", label: "Consistency", short: "CON" },
];

export function driverOverall(driver) {
  if (!driver) return 0;
  if (typeof driver.overallRating === "function") return driver.overallRating();
  const vals = RADAR_AXES.map((a) => Number(driver[a.key]) || 0);
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

// ─── Season / budget maths ─────────────────────────────────────────────────
export function getRacesPerSeason(appState) {
  return appState?.season?.calendar?.length || appState?.season?.totalRounds || 24;
}

export function getRacesRemaining(appState) {
  const total = getRacesPerSeason(appState);
  const round = appState?.season?.round || 1;
  return clamp(total - (round - 1), 0, total);
}

/**
 * Budget impact of paying `salary` instead of `currentSalary` for `seasons` seasons.
 * This season only counts the race weekends still to run.
 */
export function computeBudgetImpact(appState, { salary, seasons, currentSalary = 0 }) {
  const perRaceDelta = (salary - currentSalary) / SALARY_DIVISOR;
  const racesLeft = getRacesRemaining(appState);
  const racesPerSeason = getRacesPerSeason(appState);
  const thisSeason = perRaceDelta * racesLeft;
  const overContract = thisSeason + perRaceDelta * racesPerSeason * Math.max(0, seasons - 1);
  const budget = appState?.team?.budget || 0;
  return {
    perRace: round1(perRaceDelta),
    thisSeason: round1(thisSeason),
    overContract: round1(overContract),
    racesLeft,
    racesPerSeason,
    budget: round1(budget),
    remainingAfterSeason: round1(budget - thisSeason),
  };
}

// ─── Resistance (NegotiationSession) ───────────────────────────────────────
/**
 * Resistance is read from a real NegotiationSession so it can never drift
 * from the engine. The breakdown mirrors the constructor for plain-words display.
 */
export function getResistance(driver, team) {
  const session = new NegotiationSession(driver, team);
  const rating = typeof driver.overallRating === "function" ? driver.overallRating() : 75;
  const morale = driver.morale;
  const professionalism = driver.hiddenTraits?.professionalism || 60;
  const parts = [];
  parts.push({ label: `Rating ${rating}`, value: Math.max(0, rating - 60), text: rating > 60 ? `Rated ${rating}, so they feel they deserve a race seat` : `Rated ${rating}, low enough not to argue about a seat` });
  if (morale > 85) parts.push({ label: "High morale", value: -10, text: `High morale (${morale}) makes them want to help the team` });
  else if (morale < 50) parts.push({ label: "Low morale", value: 15, text: `Low morale (${morale}) makes them dig in` });
  if (professionalism > 80) parts.push({ label: "Professional", value: -15, text: "Very professional — accepts team decisions more readily" });
  return { resistance: session.resistance, rating, morale, professionalism, parts };
}

// ─── Reserve-role offer (My drivers) ───────────────────────────────────────
/**
 * Which NegotiationSession option would the engine use for these terms, and
 * what is its success chance? Mirrors handleOfferReserve / handleConvince /
 * handleConvinceMoney exactly.
 */
export function computeReserveOfferOdds(driver, team, terms) {
  const { resistance, parts } = getResistance(driver, team);
  const currentSalary = driver.salary || 0;
  const raise = currentSalary > 0 ? terms.salary / currentSalary - 1 : 0;
  const factors = parts.map((p) => ({ text: p.text, effect: p.value > 0 ? "against" : p.value < 0 ? "for" : "neutral" }));

  let path; let odds; let rule;
  if (resistance < 20) {
    path = "accept";
    odds = 100;
    rule = `Resistance ${resistance} is under 20, so they accept the reserve role straight away.`;
  } else if (resistance < 40) {
    path = "convince_soft";
    odds = clamp(60 - resistance, 0, 100);
    rule = `Resistance ${resistance} (20–39): they need convincing. The team-player pitch succeeds ${odds}% of the time (60 − resistance). Money isn't on the table at this level, so a raise doesn't change the odds.`;
  } else if (raise >= MONEY_RAISE - 1e-9) {
    path = "convince_money";
    odds = clamp(Math.round(80 - resistance / 3), 0, 100);
    rule = `Resistance ${resistance} (40+): a raise of 20% or more unlocks the money offer, which succeeds ${odds}% of the time (80 − resistance ÷ 3).`;
  } else {
    path = "convince_hard";
    odds = clamp(Math.round(40 - resistance / 2), 0, 100);
    const moneyOdds = clamp(Math.round(80 - resistance / 3), 0, 100);
    rule = `Resistance ${resistance} (40+): without a 20% raise the only line left is an ultimatum, which succeeds ${odds}% of the time (40 − resistance ÷ 2). A 20% raise would lift this to ${moneyOdds}%.`;
  }

  return {
    odds,
    path,
    resistance,
    raise,
    rule,
    factors,
    failureOutcome: path === "accept" ? null : "If they refuse, they walk out and leave the team.",
    moneyThresholdSalary: round1(currentSalary * (1 + MONEY_RAISE)),
    moneyMatters: resistance >= 40,
  };
}

/**
 * Runs the real NegotiationSession with the option the terms select.
 * Returns the finished session (status + dialogue history).
 */
export function runReserveOffer(driver, team, terms) {
  const { path } = computeReserveOfferOdds(driver, team, terms);
  const session = new NegotiationSession(driver, team);
  session.selectOption("offer_reserve");
  if (session.status === "ONGOING") {
    const available = session.options.map((o) => o.id);
    const choice = available.includes(path) ? path : available.includes("convince_hard") ? "convince_hard" : available[0];
    session.selectOption(choice);
  }
  return session;
}

// ─── Market offer ──────────────────────────────────────────────────────────
export function isDriverEmployed(appState, name) {
  if (appState?.team?.drivers?.some((d) => d.name === name)) return true;
  if (appState?.team?.reserveDriver?.name === name) return true;
  for (const ai of appState?.aiTeams || []) {
    if (ai.drivers?.some((d) => d.name === name)) return true;
    if (ai.reserveDriver?.name === name) return true;
  }
  return false;
}

/** Mirrors MarketScreen.handleSign's gates. The market has no random roll. */
export function computeMarketOfferOdds(appState, driver, terms) {
  const asking = driver.salary || 0;
  const factors = [];
  let odds = 100;
  let rule = "The market signs any free driver at or above their asking salary while your reserve seat is open. There is no negotiation roll.";

  if (isDriverEmployed(appState, driver.name)) {
    odds = 0;
    factors.push({ text: "Already under contract with a team", effect: "against" });
  } else {
    factors.push({ text: "Free agent — not under contract", effect: "for" });
  }
  if (appState?.team?.reserveDriver) {
    odds = 0;
    factors.push({ text: `Reserve seat is taken by ${appState.team.reserveDriver.name}`, effect: "against" });
  } else {
    factors.push({ text: "Your reserve seat is open", effect: "for" });
  }
  if (terms.salary + 1e-9 < asking) {
    odds = 0;
    factors.push({ text: `Below the $${asking}M asking salary`, effect: "against" });
  } else if (terms.salary > asking + 1e-9) {
    factors.push({ text: `Paying $${round1(terms.salary - asking)}M over asking doesn't change acceptance`, effect: "neutral" });
  } else {
    factors.push({ text: `Meets the $${asking}M asking salary`, effect: "for" });
  }
  if (odds === 0) rule = "This offer can't be signed under the current market rules.";
  return { odds, path: "market", rule, factors, failureOutcome: null };
}

// ─── Comparison facts ──────────────────────────────────────────────────────
export function getComparisonFacts(driver) {
  if (!driver) return null;
  const commercial = getDriverCommercialValue(driver);
  return {
    overall: driverOverall(driver),
    salary: driver.salary ?? null,
    age: driver.age ?? null,
    contract: driver.contractYearsRemaining ?? null,
    market: driver.market ?? null,
    potential: driver.potentialCeiling ?? null,
    merch: commercial.merchandiseRevenue,
    popularity: commercial.popularity,
  };
}
