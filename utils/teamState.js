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
  const roster = getRosterFromNormalizedTeam(team);
  const rosterNames = roster.map(driver => driver.name);

  if (!Array.isArray(team.activeDrivers)) {
    team.activeDrivers = [];
  }

  team.activeDrivers = team.activeDrivers.filter(
    (name, index, array) => rosterNames.includes(name) && array.indexOf(name) === index
  );

  for (const name of rosterNames) {
    if (team.activeDrivers.length >= Math.min(2, rosterNames.length)) break;
    if (!team.activeDrivers.includes(name)) {
      team.activeDrivers.push(name);
    }
  }

  team.activeDrivers = team.activeDrivers.slice(0, Math.min(2, rosterNames.length));
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

  return team;
}

export function getActiveDrivers(team) {
  ensureTeamState(team);
  return getRosterFromNormalizedTeam(team).filter(driver => team.activeDrivers.includes(driver.name));
}

export function setTeamActiveDrivers(team, driverNames) {
  ensureTeamState(team);
  const rosterNames = getRosterFromNormalizedTeam(team).map(driver => driver.name);
  team.activeDrivers = [...new Set(driverNames)].filter(name => rosterNames.includes(name)).slice(0, 2);
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
    team.carPerformance += 2;
  }
}
