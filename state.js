import { createAiTeams } from "./data/teams.js";

export const state = {
  team: null,
  aiTeams: createAiTeams(),
  season: { round: 1, year: 1, totalRounds: 22 },
  standings: { drivers: {}, teams: {} },
  bestFinishes: {},
  signedSponsors: {}
};

export function resetAiTeams() {
  state.aiTeams = createAiTeams();
}
