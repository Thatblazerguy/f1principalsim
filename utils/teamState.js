import { Team } from "../game/team.js";
import { ensureSponsorSlots } from "./sponsorDeals.js";

function getRosterFromNormalizedTeam(team) {
  return [...team.drivers, ...(team.reserveDriver ? [team.reserveDriver] : [])];
}

export function getTeamRoster(team) {
  ensureTeamState(team);
  return getRosterFromNormalizedTeam(team);
}

function normalizeActiveDrivers(team) {
  // Only race-seat drivers (team.drivers) can be active racers.
  // The reserveDriver must NEVER appear in activeDrivers.
  const raceDriverNames = (Array.isArray(team.drivers) ? team.drivers : []).map(d => d.name);

  if (!Array.isArray(team.activeDrivers)) {
    team.activeDrivers = [];
  }

  // Strip any stale names (e.g. old driver, or accidentally the reserve)
  team.activeDrivers = team.activeDrivers.filter(
    (name, index, array) => raceDriverNames.includes(name) && array.indexOf(name) === index
  );

  // Auto-fill missing slots from race seats only
  for (const name of raceDriverNames) {
    if (team.activeDrivers.length >= Math.min(2, raceDriverNames.length)) break;
    if (!team.activeDrivers.includes(name)) {
      team.activeDrivers.push(name);
    }
  }

  team.activeDrivers = team.activeDrivers.slice(0, Math.min(2, raceDriverNames.length));
}

// Ensure the academy object on the state has all required nested objects and arrays
export function ensureAcademyState(state) {
  if (!state.academy) {
    state.academy = {
      level: 1,
      reputation: 1,
      budget: 0,
      facilities: { simulator: 1, fitness: 1, coaching: 1, sportsPsychology: 1 },
      prospects: [],
      scouts: [],
      loanedOut: []
    };
  }
  if (!state.academy.facilities) state.academy.facilities = { simulator: 1, fitness: 1, coaching: 1, sportsPsychology: 1 };
  if (!Array.isArray(state.academy.prospects)) state.academy.prospects = [];
  if (!Array.isArray(state.academy.scouts)) state.academy.scouts = [];
  if (!Array.isArray(state.academy.loanedOut)) state.academy.loanedOut = [];
  return state.academy;
}

export function ensureTeamState(team) {
  if (!team) return team;

  Object.setPrototypeOf(team, Team.prototype);

  if (!Array.isArray(team.drivers)) team.drivers = [];
  if (!("reserveDriver" in team)) team.reserveDriver = null;
  if (!("activeDrivers" in team)) team.activeDrivers = [];
  if (!("sponsor" in team)) team.sponsor = null;
  if (!("sponsorSlots" in team)) team.sponsorSlots = {};
  if (!("carLevel" in team)) team.carLevel = 1;
  if (!("carXP" in team)) team.carXP = 0;
  if (!("car" in team)) team.car = { aero: 1, engine: 1, chassis: 1, reliability: 1 };
  if (!Array.isArray(team.pendingUpgrades)) team.pendingUpgrades = [];

  if (team.drivers.length > 2) {
    if (!team.reserveDriver) {
      team.reserveDriver = team.drivers[2];
    }
    team.drivers = team.drivers.slice(0, 2);
  }

  team.signDriver = Team.prototype.signDriver;
  team.hasDriver = Team.prototype.hasDriver;
  team.releaseDriver = Team.prototype.releaseDriver;
  team.demoteToReserve = Team.prototype.demoteToReserve;
  team.promoteReserve = Team.prototype.promoteReserve;
  team.gainXP = Team.prototype.gainXP;
  team.gainCarXP = Team.prototype.gainCarXP;
  team.upgrade = Team.prototype.upgrade;

  normalizeActiveDrivers(team);
  ensureSponsorSlots(team);
  
  // We don't have the global state here, but we'll export ensureAcademyState 
  // so callers who have the global state can ensure it when needed.

  return team;
}

export function getActiveDrivers(team) {
  ensureTeamState(team);
  // Only return drivers from the race-seat array — never the reserve.
  return (Array.isArray(team.drivers) ? team.drivers : []).filter(
    driver => team.activeDrivers.includes(driver.name)
  );
}

export function setTeamActiveDrivers(team, driverNames) {
  ensureTeamState(team);
  // Only allow race-seat drivers to be set as active.
  const raceDriverNames = (Array.isArray(team.drivers) ? team.drivers : []).map(d => d.name);
  team.activeDrivers = [...new Set(driverNames)].filter(name => raceDriverNames.includes(name)).slice(0, 2);
  normalizeActiveDrivers(team);
  return getActiveDrivers(team);
}

export function gainTeamXP(team, amount) {
  ensureTeamState(team);
  team.xp += amount;
  if (team.xp >= 100) {
    team.level++;
    team.xp = 0;
  }
}

export function gainTeamCarXP(team, amount) {
  ensureTeamState(team);
  team.carXP += amount;
  while (team.carXP >= 100) {
    team.carXP -= 100;
    team.carLevel++;
    team.carPerformance = parseFloat((team.carPerformance + 2).toFixed(1));
  }
}
