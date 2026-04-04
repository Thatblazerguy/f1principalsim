import { createAiTeams } from "./data/teams.js";
import { Team } from "./game/team.js";
import { Driver } from "./game/driver.js";

export const state = {
  team: null,
  aiTeams: createAiTeams(),
  season: { round: 1, year: 1, totalRounds: 24 },
  standings: { drivers: {}, teams: {} },
  bestFinishes: {},
  signedSponsors: {},
  /** Current season's sponsor offers (max 3) */
  sponsorOffers: [],
  /** Per-round weekend flow: qualifying must run before race. */
  weekendProgress: null
};

export function resetAiTeams() {
  state.aiTeams = createAiTeams();
}

/**
 * Returns a serialized string of the entire active state.
 */
export function getSerializedState() {
  return JSON.stringify(state);
}

// Helper to reliably restore Class methods stripped by JSON serialization
function hydrateClass(obj, clazz) {
  if (obj) Object.setPrototypeOf(obj, clazz.prototype);
  return obj;
}

/**
 * Parses and reconstructs the game state from raw JSON payload.
 * Restores the Team and nested Driver class methods deeply.
 */
export function hydrateState(payload) {
  try {
    const rawData = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    // Check if team exists to hydrate the native Team and Driver methods
    if (rawData.team) {
      hydrateClass(rawData.team, Team);
      if (rawData.team.drivers) rawData.team.drivers.forEach(d => hydrateClass(d, Driver));
      if (rawData.team.reserveDriver) hydrateClass(rawData.team.reserveDriver, Driver);
      state.team = rawData.team;
    } else {
      state.team = null;
    }

    state.aiTeams = rawData.aiTeams || createAiTeams();
    // Deep hydrate AI structure
    if (rawData.aiTeams) {
      for (const aiTeam of state.aiTeams) {
        hydrateClass(aiTeam, Team);
        if (aiTeam.drivers) aiTeam.drivers.forEach(d => hydrateClass(d, Driver));
        if (aiTeam.reserveDriver) hydrateClass(aiTeam.reserveDriver, Driver);
      }
    }

    state.season = rawData.season || { round: 1, year: 1, totalRounds: 24 };
    state.standings = rawData.standings || { drivers: {}, teams: {} };
    state.bestFinishes = rawData.bestFinishes || {};
    state.signedSponsors = rawData.signedSponsors || {};
    state.sponsorOffers = rawData.sponsorOffers || [];
    state.weekendProgress = rawData.weekendProgress || null;

    return true;
  } catch (e) {
    console.error("Failed to hydrate loaded game state:", e);
    return false;
  }
}
