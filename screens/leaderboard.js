import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";

function buildStandingsTable(title, subtitle, rows, type) {
  return `
    <section class="glass standings-panel">
      <p class="menu-card-kicker">${subtitle}</p>
      <h3>${title}</h3>
      <div class="standings-table">
        <div class="standings-table-head">
          <span>Pos</span>
          <span>${type === "drivers" ? "Driver" : "Team"}</span>
          <span>${type === "drivers" ? "Team" : "Status"}</span>
          <span>Points</span>
        </div>
        ${rows
          .map(
            (row, idx) => `
              <div class="standings-table-row${row.isYours ? " standings-table-row--yours" : ""}">
                <span class="standings-table-pos">P${idx + 1}</span>
                <span class="standings-table-name">
                  ${type === "drivers" ? `<span class="driver-nameplate"><img class="driver-face driver-face--sm" src="${getDriverHeadshotUrl(row.name)}" alt="${row.name}" loading="lazy" /><span>${row.name}</span></span>` : row.name}
                  ${row.isYours ? ` <span class="standings-you-pill">You</span>` : ""}
                </span>
                <span class="standings-table-meta">${row.meta}</span>
                <span class="standings-table-points">${row.points}</span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderLeaderboard(root) {
  ensureTeamState(state.team);

  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);
  const knownDriverTeams = new Map();

  allTeams.forEach(team => {
    const roster = team === state.team ? getTeamRoster(team) : team.drivers;
    roster.forEach(driver => {
      if (!knownDriverTeams.has(driver.name)) {
        knownDriverTeams.set(driver.name, team.name);
      }
    });
  });

  Object.keys(state.standings.drivers).forEach(driverName => {
    if (!knownDriverTeams.has(driverName)) {
      knownDriverTeams.set(driverName, "Guest / Former Driver");
    }
  });

  const playerTeamName = state.team.name;

  const driverRows = [...knownDriverTeams.entries()]
    .map(([name, teamName]) => ({
      name,
      meta: teamName,
      points: state.standings.drivers[name] ?? 0,
      isYours: teamName === playerTeamName,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const teamRows = allTeams
    .map(team => ({
      name: team.name,
      meta: team === state.team ? "Player Team" : "AI Team",
      points: state.standings.teams[team.name] ?? 0,
      isYours: team === state.team,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  root.innerHTML = `
    ${buildHubNav("standings")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Championships</p>
          <h2>Standings</h2>
          <p class="dashboard-subtitle">
            Track both titles in the same card style as the rest of the team hub.
          </p>
        </div>
      </div>

      <div class="standings-columns">
        ${buildStandingsTable("Drivers Championship", "Drivers", driverRows, "drivers")}
        ${buildStandingsTable("Constructors Championship", "Teams", teamRows, "teams")}
      </div>
    </section>
  `;

  wireHubNav(root, {
    navDashboard: () => renderDashboard(root),
    navWeekend: () => renderWeekend(root),
    navUpgrade: () => renderOffice(root),
    navDrivers: () => renderMyDrivers(root),
    navTeams: () => renderTeams(root),
    navSponsors: () => renderSponsors(root),
    navMarket: () => renderMarket(root),
    navCalendar: () => renderCalendar(root),
    navStandings: () => renderLeaderboard(root),
  });
}
