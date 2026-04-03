import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers } from "../utils/teamState.js";

const driverNumbers = {
  "Max Verstappen": 1,
  "Sergio Perez": 11,
  "Charles Leclerc": 16,
  "Carlos Sainz": 55,
  "Lewis Hamilton": 44,
  "George Russell": 63,
  "Lando Norris": 4,
  "Oscar Piastri": 81,
  "Fernando Alonso": 14,
  "Lance Stroll": 18,
  "Esteban Ocon": 31,
  "Pierre Gasly": 10,
  "Alex Albon": 23,
  "Logan Sargeant": 2,
  "Yuki Tsunoda": 22,
  "Daniel Ricciardo": 3,
  "Valtteri Bottas": 77,
  "Zhou Guanyu": 24,
  "Kevin Magnussen": 20,
  "Nico Hulkenberg": 27,
  "Mick Schumacher": 47,
  "Antonio Giovinazzi": 99,
  "Nyck de Vries": 21,
  "Andrea Kimi Antonelli": 12,
  "Oliver Bearman": 87,
  "Theo Pourchaire": 5,
  "Jack Doohan": 7,
  "Liam Lawson": 40,
  "Felipe Drugovich": 43,
};

function buildDriverRow(driver, role, active = false) {
  const number = driverNumbers[driver.name] ?? "--";
  return `
    <div class="team-lineup-row">
      <div class="team-lineup-main">
        <span class="driver-summary-number">#${number}</span>
        <div>
          <strong>${driver.name}</strong>
          <span class="driver-summary-meta">${role}${active ? " • Active" : ""}</span>
        </div>
      </div>
      <span class="detail-badge">Market ${driver.market}</span>
    </div>
  `;
}

function buildTeamCard(team, isPlayerTeam = false) {
  ensureTeamState(team);
  const raceDrivers = isPlayerTeam ? getActiveDrivers(team) : team.drivers;
  const reserveDriver = team.reserveDriver;
  const contracted = isPlayerTeam ? getTeamRoster(team) : team.drivers;

  return `
    <article class="glass detail-card team-card">
      <div class="detail-card-top">
        <div>
          <p class="menu-card-kicker">${isPlayerTeam ? "Your Team" : "Competitor Team"}</p>
          <h3>${team.name}</h3>
          <p class="detail-card-meta">Car Performance ${team.carPerformance} • Budget $${team.budget}M</p>
        </div>
        <div class="detail-card-badges">
          <span class="detail-badge">Race ${raceDrivers.length}</span>
          <span class="detail-badge">Reserve ${reserveDriver ? 1 : 0}</span>
        </div>
      </div>

      <div class="team-section-block">
        <p class="menu-card-kicker">Race Drivers</p>
        <div class="team-lineup-list">
          ${raceDrivers.map(driver => buildDriverRow(driver, "Race Driver", isPlayerTeam)).join("") || `<p class="driver-summary-empty">No race drivers assigned.</p>`}
        </div>
      </div>

      <div class="team-section-block">
        <p class="menu-card-kicker">Reserve Driver</p>
        <div class="team-lineup-list">
          ${reserveDriver ? buildDriverRow(reserveDriver, "Reserve Driver") : `<p class="driver-summary-empty">No reserve driver signed.</p>`}
        </div>
      </div>

      <div class="team-section-block">
        <p class="menu-card-kicker">Contracted Drivers</p>
        <p class="detail-card-meta">${contracted.map(driver => driver.name).join(" • ")}</p>
      </div>
    </article>
  `;
}

export function renderTeams(root) {
  ensureTeamState(state.team);
  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);

  root.innerHTML = `
    ${buildHubNav("teams")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Competition View</p>
          <h2>Teams</h2>
          <p class="dashboard-subtitle">
            Review every team in the championship, including their current race lineup and reserve driver.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Teams</span>
            <strong>${allTeams.length}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Season Year</span>
            <strong>${state.season.year || 1}</strong>
          </div>
        </div>
      </div>

      <div class="market-grid teams-grid">
        ${allTeams.map((team, index) => buildTeamCard(team, index === 0)).join("")}
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
