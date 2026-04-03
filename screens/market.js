import { drivers } from "../data/drivers.js";
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

function hasDriverSigned(team, name) {
  return team.drivers.some(driver => driver.name === name) || team.reserveDriver?.name === name;
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
            <strong>$${state.team.budget}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Lineup</span>
            <strong>${state.team.drivers.length} main / ${state.team.reserveDriver ? 1 : 0} reserve</strong>
          </div>
        </div>
      </div>

      <div class="market-grid">
        ${drivers
          .filter(d => d.category !== "F1")
          .map(
            d => `
              <article class="market-driver-card">
                <div class="market-driver-card-top">
                  <div>
                    <p class="menu-card-kicker">${d.category}</p>
                    <h3>${d.name}</h3>
                    <p class="detail-card-meta">Age ${d.age} • Salary $${d.salary}M</p>
                  </div>
                  <span class="detail-badge">Market ${d.market}</span>
                </div>

                <div class="market-driver-stats">
                  <span>Pace ${d.pace}</span>
                  <span>Quali ${d.quali}</span>
                  <span>Racecraft ${d.racecraft}</span>
                  <span>Consistency ${d.consistency}</span>
                </div>

                <button
                  data-sign="${d.name}"
                  class="market-sign-button"
                  ${hasDriverSigned(state.team, d.name) || state.team.reserveDriver ? "disabled" : ""}
                >
                  ${
                    hasDriverSigned(state.team, d.name)
                      ? "Already Signed"
                      : state.team.reserveDriver
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
    button.onclick = () => {
      const d = drivers.find(x => x.name === button.dataset.sign);
      if (!d || hasDriverSigned(state.team, d.name)) {
        renderMarket(root);
        return;
      }

      if (state.team.reserveDriver) {
        renderMarket(root);
        return;
      }

      state.team.signDriver(d, "reserve");
      renderMarket(root);
    };
  });
}
