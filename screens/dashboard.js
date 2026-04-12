import { renderOffseason } from "./offseason.js";
import { renderWeekend } from "./weekend.js";
import { calendar } from "../data/calendar.js";
import { renderCalendar } from "./calendar.js";
import { renderMarket } from "./market.js";
import { renderOffice } from "./office.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderTeams } from "./teams.js";
import { state } from "../state.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState } from "../utils/teamState.js";
import { countActiveSponsorDeals, getTotalSponsorRaceBonus } from "../utils/sponsorDeals.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { syncGame } from "../lib/supabaseApi.js";
import {
  ensureSeasonTimeline,
  getRoundRaceDay,
  formatSeasonDate,
  getNextUpgradeAvailability,
  simulateNextDay,
  canSimulateNextDay,
} from "../utils/seasonTimeline.js";
import React from "react";
import { createRoot } from "react-dom/client";
import { RaceCalendarScroll } from "../components/ui/race-calendar-scroll.tsx";

function buildMyDriversMarkup() {
  return state.team.drivers
    .map(driver => {
      const number = getDriverNumber(driver);
      const points = state.standings.drivers[driver.name] ?? 0;
      const bestFinish = state.bestFinishes[driver.name]
        ? `P${state.bestFinishes[driver.name]}`
        : "--";

      return `
        <div class="driver-summary-row driver-summary-row--yours">
          <div class="driver-summary-identity">
            <span class="driver-summary-number">#${number}</span>
            <div class="driver-nameplate">
              <img class="driver-face driver-face--sm" src="${getDriverHeadshotUrl(driver)}" alt="${driver.name}" loading="lazy" />
              <div class="driver-name-copy">
              <strong>${driver.name}</strong>
              <span class="driver-summary-meta">${driver.category} driver</span>
              </div>
            </div>
          </div>
          <div class="driver-summary-stats">
            <div class="driver-summary-chip">
              <strong>${points}</strong>
              <span>Pts</span>
            </div>
            <div class="driver-summary-chip">
              <strong>${bestFinish}</strong>
              <span>Best</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function refreshMyDriversCard() {
  const myDriversList = document.getElementById("myDriversList");
  if (!myDriversList) return;
  myDriversList.innerHTML = buildMyDriversMarkup() || '<p class="driver-summary-empty">No drivers signed yet.</p>';
}

export function renderDashboard(root) {
  ensureTeamState(state.team);
  ensureSeasonTimeline(state);
  const totalRounds = Math.min(state.season.totalRounds || 24, 24);
  const isSeasonOver = state.season.round > totalRounds || (state.weekendProgress?.raceComplete && state.season.round === totalRounds);
  const currentYear = 2025 + (state.season.year || 1);
  const nextRound = isSeasonOver ? null : calendar.find(r => r.round === state.season.round);
  const currentDay = state.season.currentDay;
  const raceDay = nextRound ? getRoundRaceDay(nextRound.round) : null;
  const daysUntilRace = nextRound ? Math.max(0, raceDay - currentDay) : 0;
  const nextUpgrade = getNextUpgradeAvailability(state.team, currentDay);
  const canAdvanceDay = canSimulateNextDay(state);
  const timelineRaces = calendar.slice(0, totalRounds).map(round => {
    const roundDay = getRoundRaceDay(round.round);
    const status = currentDay > roundDay ? "completed" : currentDay === roundDay ? "today" : "upcoming";
    return {
      round: round.round,
      name: round.name,
      laps: round.laps,
      dateLabel: formatSeasonDate(state.season.year || 1, roundDay),
      status,
    };
  });
  const latestNotifications = (state.notifications || []).slice(0, 4);

  root.innerHTML = `
    ${buildHubNav("dashboard")}
    <div class="dashboard-shell">
      <div class="dashboard-header glass">
        <div class="flex justify-between items-start w-full">
          <div>
            <p class="dashboard-eyebrow">Team Command Center • ${currentYear} Season</p>
            <h2>${state.team.name}</h2>
            <p class="dashboard-subtitle">
              Direct your race weekends, engineering progress, and team operations from one place.
            </p>
          </div>
          ${isSeasonOver ? `
            <div class="season-complete-pill bg-red-600/20 border border-red-600 px-4 py-2 rounded-xl animate-pulse">
              <span class="text-xs font-black uppercase tracking-tighter text-red-500">Season Complete</span>
            </div>
          ` : ""}
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Level</span>
            <strong>Lv ${state.team.level}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Car Level</span>
            <strong>Lv ${state.team.carLevel}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Team Budget</span>
            <strong>$${(state.team.budget || 0).toFixed(1)}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Sponsors</span>
            <strong>${countActiveSponsorDeals(state.team)} deals · $${getTotalSponsorRaceBonus(state.team)}M/race</strong>
          </div>
        </div>
      </div>

      <div class="dashboard-grid dashboard-card-grid">
        <div class="menu-card-group">
          <span
            class="menu-card-gradient"
            style="background: linear-gradient(315deg, #531010, #ff3b30);"
          ></span>
          <span
            class="menu-card-gradient menu-card-gradient-blur"
            style="background: linear-gradient(315deg, #531010, #ff3b30);"
          ></span>
          <span class="menu-card-glow">
            <span class="menu-card-orb menu-card-orb-top"></span>
            <span class="menu-card-orb menu-card-orb-bottom"></span>
          </span>
          <div class="menu-card-content glass tile">
            <p class="menu-card-kicker">Weekend • ${currentYear}</p>
            <h3>${isSeasonOver ? "Season Complete" : `Next: ${nextRound ? nextRound.name : "Grand Prix"}`}</h3>
            <p>
              ${
                isSeasonOver
                  ? "Review your performance and prepare for the next year."
                  : `Prepare for Round ${state.season.round} of the ${currentYear} World Championship. Race date: ${formatSeasonDate(state.season.year || 1, raceDay)} (${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"}).`
              }
            </p>
            <button id="wk">${isSeasonOver ? "Open Offseason" : "Race Weekend"}</button>
          </div>
        </div>

        <div class="menu-card-group">
          <span
            class="menu-card-gradient"
            style="background: linear-gradient(315deg, #160606, #e10600);"
          ></span>
          <span
            class="menu-card-gradient menu-card-gradient-blur"
            style="background: linear-gradient(315deg, #160606, #e10600);"
          ></span>
          <span class="menu-card-glow">
            <span class="menu-card-orb menu-card-orb-top"></span>
            <span class="menu-card-orb menu-card-orb-bottom"></span>
          </span>
          <div class="menu-card-content glass tile">
            <p class="menu-card-kicker">Progress</p>
            <h3>Team Level</h3>
            <p class="stat">Lv ${state.team.level}</p>
            <p>Budget available: $${state.team.budget}M</p>
          </div>
        </div>

        <div class="menu-card-group">
          <span
            class="menu-card-gradient"
            style="background: linear-gradient(315deg, #1b0b0b, #ff5f52);"
          ></span>
          <span
            class="menu-card-gradient menu-card-gradient-blur"
            style="background: linear-gradient(315deg, #1b0b0b, #ff5f52);"
          ></span>
          <span class="menu-card-glow">
            <span class="menu-card-orb menu-card-orb-top"></span>
            <span class="menu-card-orb menu-card-orb-bottom"></span>
          </span>
          <div class="menu-card-content glass tile">
            <p class="menu-card-kicker">Engineering</p>
            <h3>R&amp;D</h3>
            <p>Invest in upgrades, raise component levels, and prepare the car for the long season.</p>
            <button id="office">Upgrade Car</button>
          </div>
        </div>

        <div class="menu-card-group">
          <span
            class="menu-card-gradient"
            style="background: linear-gradient(315deg, #280909, #ff2a1d);"
          ></span>
          <span
            class="menu-card-gradient menu-card-gradient-blur"
            style="background: linear-gradient(315deg, #280909, #ff2a1d);"
          ></span>
          <span class="menu-card-glow">
            <span class="menu-card-orb menu-card-orb-top"></span>
            <span class="menu-card-orb menu-card-orb-bottom"></span>
          </span>
          <div class="menu-card-content glass tile">
            <p class="menu-card-kicker">Operations</p>
            <h3>Operations</h3>
            <p>Manage drivers, review the calendar, and keep an eye on the championship picture.</p>
            <div class="menu-card-actions">
              <button id="market">Drivers</button>
              <button id="teams">Teams</button>
              <button id="calendar">Calendar</button>
              <button id="standings">Standings</button>
            </div>
          </div>
        </div>

        <div id="myDriversCard" class="menu-card-group driver-card-group">
          <span
            class="menu-card-gradient"
            style="background: linear-gradient(315deg, #0c0404, #e10600);"
          ></span>
          <span
            class="menu-card-gradient menu-card-gradient-blur"
            style="background: linear-gradient(315deg, #0c0404, #e10600);"
          ></span>
          <span class="menu-card-glow">
            <span class="menu-card-orb menu-card-orb-top"></span>
            <span class="menu-card-orb menu-card-orb-bottom"></span>
          </span>
          <div class="menu-card-content glass tile">
            <p class="menu-card-kicker">Lineup</p>
            <h3>My Drivers</h3>
            <p>Your current pairing with race numbers, season points, and best finish.</p>
            <div id="myDriversList" class="driver-summary-list">
              ${buildMyDriversMarkup() || '<p class="driver-summary-empty">No drivers signed yet.</p>'}
            </div>
          </div>
        </div>
      </div>

      <section class="dashboard-day-controls glass">
        <div>
          <p class="dashboard-eyebrow">Calendar Simulation</p>
          <h3>Day ${currentDay} • ${formatSeasonDate(state.season.year || 1, currentDay)}</h3>
          <p class="dashboard-subtitle">
            ${
              nextUpgrade
                ? `Next upgrade available: ${nextUpgrade.part.toUpperCase()} in ${nextUpgrade.daysRemaining} day${nextUpgrade.daysRemaining === 1 ? "" : "s"} (${formatSeasonDate(state.season.year || 1, nextUpgrade.readyDay)}).`
                : "No upgrades currently in development."
            }
          </p>
        </div>
        <div class="dashboard-feature-actions">
          <button id="simulateDayBtn" ${canAdvanceDay ? "" : "disabled"}>Simulate 1 Day</button>
          <button id="featureWeekend">Open Race Weekend</button>
          <button id="featureUpgrade">Open R&amp;D</button>
        </div>
      </section>

      <div id="dashboardRaceTimeline"></div>

      ${
        latestNotifications.length
          ? `
            <section class="glass dashboard-notifications">
              <p class="menu-card-kicker">Team Inbox</p>
              <div class="dashboard-notification-list">
                ${latestNotifications
                  .map(
                    note => `
                      <div class="dashboard-notification-row">
                        <span class="detail-badge">Day ${note.day}</span>
                        <span>${note.message}</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
          : ""
      }

      <div class="glass tile large dashboard-content-panel" id="content">
        <div class="dashboard-feature-panel">
          <div>
            <p class="dashboard-eyebrow">Quick Access</p>
            <h3>Team Overview</h3>
            <p class="dashboard-subtitle">
              Use the navigation above or jump in through the main cards to manage upgrades, scouting, standings, and your race lineup.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  const wk = root.querySelector("#wk");
  const office = root.querySelector("#office");
  const market = root.querySelector("#market");
  const teamsBtn = root.querySelector("#teams");
  const calendarBtn = root.querySelector("#calendar");
  const standingsBtn = root.querySelector("#standings");
  const myDriversCard = root.querySelector("#myDriversCard");
  const featureWeekend = root.querySelector("#featureWeekend");
  const featureUpgrade = root.querySelector("#featureUpgrade");
  const simulateDayBtn = root.querySelector("#simulateDayBtn");
  const raceTimelineRoot = root.querySelector("#dashboardRaceTimeline");

  if (raceTimelineRoot) {
    const reactRoot = createRoot(raceTimelineRoot);
    reactRoot.render(
      React.createElement(RaceCalendarScroll, {
        races: timelineRaces,
        currentDayLabel: `Day ${currentDay} • ${formatSeasonDate(state.season.year || 1, currentDay)}`,
        nextUpgradeLabel: nextUpgrade
          ? `${nextUpgrade.part.toUpperCase()} in ${nextUpgrade.daysRemaining}d`
          : "No active projects",
      })
    );
  }

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

  wk.onclick = () => isSeasonOver ? renderOffseason(root) : renderWeekend(root);
  office.onclick = () => renderOffice(root);
  market.onclick = () => renderMarket(root);
  teamsBtn.onclick = () => renderTeams(root);
  calendarBtn.onclick = () => renderCalendar(root);
  standingsBtn.onclick = () => renderLeaderboard(root);
  myDriversCard.onclick = () => renderMyDrivers(root);
  featureWeekend.onclick = () => renderWeekend(root);
  featureUpgrade.onclick = () => renderOffice(root);
  if (simulateDayBtn) {
    simulateDayBtn.onclick = async () => {
      const result = simulateNextDay(state);
      if (!result.advanced) {
        renderDashboard(root);
        return;
      }
      await syncGame();
      renderDashboard(root);
    };
  }
}
