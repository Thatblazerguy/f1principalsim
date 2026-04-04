import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";

function renderUpgradeCard(part) {
  const currentLevel = state.team.car[part];
  const cost = 50 * currentLevel;
  const canAfford = state.team.budget >= cost;

  return `
    <article class="glass upgrade-card">
      <div class="upgrade-card-top">
        <div>
          <p class="menu-card-kicker">Component</p>
          <h3>${part.toUpperCase()}</h3>
          <p class="detail-card-meta">Current Level ${currentLevel} • Next cost $${cost}M</p>
        </div>
        <span class="detail-badge">${canAfford ? "Ready" : "Insufficient Budget"}</span>
      </div>

      <div class="detail-card-stats">
        <div class="driver-detail-stat">
          <span>Current</span>
          <strong>Lv ${currentLevel}</strong>
        </div>
        <div class="driver-detail-stat">
          <span>Upgrade Cost</span>
          <strong>$${cost}M</strong>
        </div>
        <div class="driver-detail-stat">
          <span>Budget After</span>
          <strong>$${Math.max(0, state.team.budget - cost)}M</strong>
        </div>
        <div class="driver-detail-stat">
          <span>Car Performance</span>
          <strong>${state.team.carPerformance.toFixed(1)}</strong>
        </div>
      </div>

      <button class="upgrade-button" data-upgrade="${part}" ${canAfford ? "" : "disabled"}>
        Upgrade ${part.toUpperCase()}
      </button>
    </article>
  `;
}

function showUpgradeLoading(done) {
  const l = document.createElement("div");
  l.className = "loading-screen";
  l.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(l);
  setTimeout(() => {
    l.remove();
    done();
  }, 900);
}

export function renderOffice(root, flashMessage = "") {
  ensureTeamState(state.team);
  root.innerHTML = `
    ${buildHubNav("upgrade")}
    <section class="upgrade-page">
      <div class="glass my-drivers-header">
        <div>
          <p class="dashboard-eyebrow">R&D Center</p>
          <h2>Upgrade Car</h2>
          <p class="dashboard-subtitle">
            Invest your budget into core car systems and steadily raise overall performance.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Budget</span>
            <strong>$${state.team.budget}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Car Perf.</span>
            <strong>${state.team.carPerformance.toFixed(1)}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Team Level</span>
            <strong>Lv ${state.team.level}</strong>
          </div>
        </div>
      </div>

      ${flashMessage ? `<p class="setup-error upgrade-flash">${flashMessage}</p>` : ""}

      <div class="my-drivers-grid">
        ${Object.keys(state.team.car).map(renderUpgradeCard).join("")}
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

  root.querySelectorAll("[data-upgrade]").forEach(button => {
    button.onclick = () => {
      const part = button.dataset.upgrade;
      const currentCost = 50 * state.team.car[part];
      if (state.team.budget < currentCost) {
        renderOffice(root, "Not enough budget for that upgrade.");
        return;
      }
      showUpgradeLoading(async () => {
        state.team.upgrade(part);
        await syncGame();
        renderOffice(root, `${part.toUpperCase()} upgraded to Lv ${state.team.car[part]}.`);
      });
    };
  });
}
