import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";

function isDriverEmployed(name) {
  // Check player team
  if (state.team.drivers.some(d => d.name === name)) return true;
  if (state.team.reserveDriver?.name === name) return true;

  // Check AI teams
  if (state.aiTeams) {
    for (const aiTeam of state.aiTeams) {
      if (aiTeam.drivers.some(d => d.name === name)) return true;
      if (aiTeam.reserveDriver?.name === name) return true;
    }
  }
  return false;
}

export function renderMarket(root = document.getElementById("app")) {
  if (!root) return;
  ensureTeamState(state.team);
  if (!state.team) {
    root.innerHTML = `
      ${buildHubNav("market")}
      <section class="market-panel">
        <div class="glass market-header">
          <div>
            <p class="dashboard-eyebrow">Recruitment</p>
            <h2>Driver Market</h2>
            <p class="dashboard-subtitle">Create a team first before opening the market.</p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    ${buildHubNav("market")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Recruitment</p>
          <h2>Driver Market</h2>
          <p class="dashboard-subtitle">
            Scout free agents and rising prospects for your reserve seat while keeping your main race lineup unchanged.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Budget</span>
            <strong>$${(state.team.budget || 0).toFixed(1)}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Lineup</span>
            <strong>${state.team.drivers.length} main / ${state.team.reserveDriver ? 1 : 0} reserve</strong>
          </div>
        </div>
      </div>

      <div class="market-grid">
        ${drivers
          .filter(d => !isDriverEmployed(d.name))
          .map(
            d => `
              <article class="market-driver-card">
                <div class="market-driver-card-top">
                  <div>
                    <p class="menu-card-kicker">${d.category}</p>
                    <div class="driver-nameplate">
                      <img class="driver-face" src="${getDriverHeadshotUrl(d)}" alt="${d.name}" loading="lazy" />
                      <h3>${d.name}</h3>
                    </div>
                    <p class="detail-card-meta">Age ${d.age} • Salary $${d.salary}M</p>
                  </div>
                  <span class="detail-badge">Market ${d.market}</span>
                </div>

                <div class="market-driver-stats">
                  <span>Pace ${(d.pace || 0).toFixed(1)}</span>
                  <span>Quali ${(d.quali || 0).toFixed(1)}</span>
                  <span>Racecraft ${(d.racecraft || 0).toFixed(1)}</span>
                  <span>Consistency ${(d.consistency || 0).toFixed(1)}</span>
                </div>

                <button
                  data-sign="${d.name}"
                  class="market-sign-button"
                  ${state.team.reserveDriver ? "disabled" : ""}
                >
                  ${
                    state.team.reserveDriver
                        ? "Reserve Seat Full"
                        : "Sign As Reserve"
                  }
                </button>
              </article>
            `
          )
          .join("")}
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

  root.querySelectorAll("[data-sign]").forEach(button => {
    button.onclick = async () => {
      const d = drivers.find(x => x.name === button.dataset.sign);
      if (!d || isDriverEmployed(d.name)) {
        renderMarket(root);
        return;
      }

      if (state.team.reserveDriver) {
        renderMarket(root);
        return;
      }

      state.team.signDriver(d, "reserve");
      await syncGame();
      renderMarket(root);
    };
  });
}
