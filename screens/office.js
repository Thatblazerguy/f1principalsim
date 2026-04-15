import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import {
  ensureSeasonTimeline,
  requestTimedUpgrade,
  getPendingUpgradeForPart,
  getNextUpgradeAvailability,
  formatSeasonDate,
  getRoundRaceDay,
} from "../utils/seasonTimeline.js";

function getRoundFromDay(day) {
  return Math.floor((Math.max(1, day) - 1) / 14) + 1;
}

function renderUpgradeCard(part) {
  ensureSeasonTimeline(state);
  const currentLevel = state.team.car[part];
  const currentDay = state.season.currentDay;
  const pending = getPendingUpgradeForPart(state.team, part);
  const cost = 50 * currentLevel;
  const canAfford = state.team.budget >= cost && !pending;
  const etaDays = pending ? Math.max(0, pending.readyDay - currentDay) : 0;
  const etaRound = pending ? getRoundFromDay(pending.readyDay) : null;

  return `
    <article class="glass upgrade-card">
      <div class="upgrade-card-top">
        <div>
          <p class="menu-card-kicker">Component</p>
          <h3>${part.toUpperCase()}</h3>
          <p class="detail-card-meta">
            ${
              pending
                ? `In development • Ready in ${etaDays} day${etaDays === 1 ? "" : "s"} (${formatSeasonDate(state.season.year || 1, pending.readyDay)})`
                : `Current Level ${currentLevel} • Next cost $${cost}M`
            }
          </p>
        </div>
        <span class="detail-badge">
          ${pending ? `ETA Round ${etaRound}` : canAfford ? "Ready" : "Insufficient Budget"}
        </span>
      </div>

      <div class="detail-card-stats">
        <div class="driver-detail-stat">
          <span>Current</span>
          <strong>Lv ${currentLevel}</strong>
        </div>
        <div class="driver-detail-stat">
          <span>${pending ? "Project Cost" : "Upgrade Cost"}</span>
          <strong>$${pending ? pending.cost : cost}M</strong>
        </div>
        <div class="driver-detail-stat">
          <span>Budget After</span>
          <strong>$${Math.max(0, state.team.budget - cost).toFixed(1)}M</strong>
        </div>
        <div class="driver-detail-stat">
          <span>${pending ? "Ready Date" : "Car Performance"}</span>
          <strong>
            ${pending ? `${formatSeasonDate(state.season.year || 1, pending.readyDay)} (R${etaRound})` : (state.team.carPerformance || 0).toFixed(1)}
          </strong>
        </div>
      </div>

      <button class="upgrade-button" data-upgrade="${part}" ${canAfford ? "" : "disabled"}>
        ${pending ? "Project In Progress" : `Start ${part.toUpperCase()} Upgrade`}
      </button>
    </article>
  `;
}

function showUpgradeLoading(done) {
  const loader = document.createElement("div");
  loader.className = "loading-screen";
  loader.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(loader);
  setTimeout(() => {
    loader.remove();
    done();
  }, 900);
}

export function renderOffice(root, flashMessage = "") {
  ensureTeamState(state.team);
  ensureSeasonTimeline(state);
  const currentDay = state.season.currentDay;
  const nextUpgrade = getNextUpgradeAvailability(state.team, currentDay);
  const nextRaceRound = state.season.round;
  const nextRaceDay = getRoundRaceDay(nextRaceRound);
  const daysUntilRace = Math.max(0, nextRaceDay - currentDay);

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
            <strong>$${(state.team.budget || 0).toFixed(1)}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Car Perf.</span>
            <strong>${(state.team.carPerformance || 0).toFixed(1)}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Team Level</span>
            <strong>Lv ${state.team.level}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Today</span>
            <strong>${formatSeasonDate(state.season.year || 1, currentDay)} (Day ${currentDay})</strong>
          </div>
        </div>
      </div>

      <div class="glass weekend-status-card">
        <p class="menu-card-kicker">Development Timeline</p>
        <p class="dashboard-subtitle">
          Next race: Round ${nextRaceRound} in ${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"}.
          ${
            nextUpgrade
              ? ` Next upgrade available in ${nextUpgrade.daysRemaining} day${nextUpgrade.daysRemaining === 1 ? "" : "s"} (${nextUpgrade.part.toUpperCase()}).`
              : " No active upgrade projects."
          }
        </p>
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
      showUpgradeLoading(async () => {
        const request = requestTimedUpgrade(state.team, part, state.season.currentDay, state.season.round);
        if (!request.ok) {
          renderOffice(root, request.reason);
          return;
        }
        await syncGame();
        const etaRound = getRoundFromDay(request.entry.readyDay);
        renderOffice(
          root,
          `${part.toUpperCase()} project started. Completion expected by ${formatSeasonDate(state.season.year || 1, request.entry.readyDay)} (Round ${etaRound}).`
        );
      });
    };
  });
}
