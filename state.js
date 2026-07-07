import { createAiTeams } from "./data/teams.js";
import { Team } from "./game/team.js";
import { Driver } from "./game/driver.js";
import { ensureFinanceState } from "./utils/financeSystem.js";
import { ensureEngineeringState } from "./utils/engineeringSystem.js";

export const state = {
  team: null,
  aiTeams: createAiTeams(),
  season: { round: 1, year: 1, totalRounds: 24, currentDay: 1 },
  standings: { drivers: {}, teams: {} },
  bestFinishes: {},
  driverWins: {},
  driverPodiums: {},
  raceHistory: [],   // Array<RaceRecord> — grows every completed race
  signedSponsors: {},
  notifications: [],
  /** Current season's sponsor offers (max 3) */
  sponsorOffers: [],
  /** Per-round weekend flow: qualifying must run before race. */
  weekendProgress: null,
  /** Team Finance & Operations System */
  finance: {
    cashFlow: [],
    raceReports: [],
    boardReviews: [],
    emergencyActions: [],
    facilityProjects: []
  },
  /** Driver Academy System */
  academy: {
    level: 1,
    reputation: 1,
    budget: 0,
    facilities: { simulator: 1, fitness: 1, coaching: 1, sportsPsychology: 1 },
    prospects: [],
    scouts: [],
    loanedOut: []
  }
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

    state.season = rawData.season || { round: 1, year: 1, totalRounds: 24, currentDay: 1 };
    state.standings = rawData.standings || { drivers: {}, teams: {} };
    state.bestFinishes = rawData.bestFinishes || {};
    state.driverWins = rawData.driverWins || {};
    state.driverPodiums = rawData.driverPodiums || {};
    state.raceHistory = rawData.raceHistory || [];

    // ── Save migration: old saves have no driverWins/driverPodiums ──
    // If the loaded save has no tracking data, seed from bestFinishes as a
    // one-time best-effort estimate (P1 best = at least 1 win, P1-P3 = at least 1 podium).
    const isLegacySave = !rawData.driverWins && !rawData.driverPodiums;
    if (isLegacySave && state.bestFinishes) {
      for (const [driverName, bestPos] of Object.entries(state.bestFinishes)) {
        if (bestPos === 1) {
          state.driverWins[driverName] = state.driverWins[driverName] || 1;
          state.driverPodiums[driverName] = state.driverPodiums[driverName] || 1;
        } else if (bestPos <= 3) {
          state.driverPodiums[driverName] = state.driverPodiums[driverName] || 1;
        }
      }
    }
    state.signedSponsors = rawData.signedSponsors || {};
    state.notifications = rawData.notifications || [];
    state.sponsorOffers = rawData.sponsorOffers || [];
    state.weekendProgress = rawData.weekendProgress || null;
    state.finance = rawData.finance || {
      cashFlow: [],
      raceReports: [],
      boardReviews: [],
      emergencyActions: [],
      facilityProjects: []
    };

    // Hydrate Academy State
    state.academy = rawData.academy || {
      level: 1,
      reputation: 1,
      budget: 0,
      facilities: { simulator: 1, fitness: 1, coaching: 1, sportsPsychology: 1 },
      prospects: [],
      scouts: [],
      loanedOut: []
    };
    
    if (state.academy.prospects) state.academy.prospects.forEach(d => hydrateClass(d, Driver));
    if (state.academy.loanedOut) state.academy.loanedOut.forEach(d => hydrateClass(d, Driver));
    if (state.academy.scouts) {
      state.academy.scouts.forEach(s => {
        if (s.prospect) hydrateClass(s.prospect, Driver);
      });
    }
    ensureFinanceState(state);
    ensureEngineeringState(state);

    return true;
  } catch (e) {
    console.error("Failed to hydrate loaded game state:", e);
    return false;
  }
}
