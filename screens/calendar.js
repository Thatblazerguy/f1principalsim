import { calendar } from "../data/calendar.js";
import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureSeasonTimeline, getRoundRaceDay, formatSeasonDate } from "../utils/seasonTimeline.js";

export function renderCalendar(root) {
  ensureSeasonTimeline(state);
  const totalRounds = Math.min(state.season.totalRounds || calendar.length, calendar.length);
  const currentDay = state.season.currentDay;
  root.innerHTML = `
    ${buildHubNav("calendar")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Season Map</p>
          <h2>Calendar</h2>
          <p class="dashboard-subtitle">
            Follow every round and see exactly where your season currently stands.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Current Day</span>
            <strong>Day ${currentDay}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Rounds Total</span>
            <strong>${totalRounds}</strong>
          </div>
        </div>
      </div>

      <div class="calendar-grid">
        ${calendar
          .slice(0, totalRounds)
          .map(
            r => `
              <article class="market-driver-card calendar-card">
                <p class="menu-card-kicker">Round ${r.round}</p>
                <h3>${r.name}</h3>
                <p class="detail-card-meta">${formatSeasonDate(state.season.year || 1, getRoundRaceDay(r.round))} • ${r.laps} laps</p>
                <span class="detail-badge">
                  ${
                    currentDay > getRoundRaceDay(r.round)
                      ? "Completed"
                      : currentDay === getRoundRaceDay(r.round)
                        ? "Race Day"
                        : `Upcoming • ${getRoundRaceDay(r.round) - currentDay}d`
                  }
                </span>
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
}
