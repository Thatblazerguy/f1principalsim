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
import { buildHubNav, wireHubNav } from "./hubNav";
import { ensureTeamState, getActiveDrivers } from "../utils/teamState.js";
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
  const activeDrivers = getActiveDrivers(state.team);
  return activeDrivers
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

function buildDriverProfileCard(driver, slotLabel) {
  if (!driver) {
    return `
      <article class="glass dashboard-eight-card" style="--card-from:#6d5dfc;--card-to:#00d0ff;">
        <p class="menu-card-kicker">${slotLabel}</p>
        <h3>Driver Profile</h3>
        <p class="dashboard-subtitle">No active driver assigned.</p>
      </article>
    `;
  }

  const points = state.standings.drivers[driver.name] ?? 0;
  const bestFinish = state.bestFinishes[driver.name] ? `P${state.bestFinishes[driver.name]}` : "--";
  const driverNumber = getDriverNumber(driver);

  return `
    <article class="glass dashboard-eight-card" style="--card-from:#6d5dfc;--card-to:#00d0ff;">
      <p class="menu-card-kicker">${slotLabel}</p>
      <div class="driver-nameplate">
        <img class="driver-face driver-face--sm" src="${getDriverHeadshotUrl(driver)}" alt="${driver.name}" loading="lazy" />
        <div class="driver-name-copy">
          <h3>#${driverNumber} ${driver.name}</h3>
          <p class="detail-card-meta">${driver.category} • Age ${driver.age}</p>
        </div>
      </div>
      <div class="detail-card-stats">
        <div class="driver-detail-stat"><span>Pace</span><strong>${(driver.pace || 0).toFixed(1)}</strong></div>
        <div class="driver-detail-stat"><span>Quali</span><strong>${(driver.quali || 0).toFixed(1)}</strong></div>
        <div class="driver-detail-stat"><span>Racecraft</span><strong>${(driver.racecraft || 0).toFixed(1)}</strong></div>
        <div class="driver-detail-stat"><span>Consistency</span><strong>${(driver.consistency || 0).toFixed(1)}</strong></div>
      </div>
      <div class="dashboard-mini-row">
        <span class="detail-badge">Pts ${points}</span>
        <span class="detail-badge">Best ${bestFinish}</span>
      </div>
    </article>
  `;
}

function getTeamStandingPosition() {
  const teams = [state.team, ...(state.aiTeams || [])].filter(Boolean);
  const sorted = teams
    .map(team => ({
      name: team.name,
      points: state.standings.teams?.[team.name] ?? 0,
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const position = sorted.findIndex(entry => entry.name === state.team.name);
  return {
    position: position >= 0 ? position + 1 : teams.length,
    total: teams.length,
    points: state.standings.teams?.[state.team.name] ?? 0,
  };
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
  const activeDrivers = getActiveDrivers(state.team).slice(0, 2);
  const teamStanding = getTeamStandingPosition();

  root.innerHTML = `
    ${buildHubNav("dashboard")}
    <div class="dashboard-shell">
      <div class="dashboard-eight-grid">
        <article class="glass dashboard-eight-card" style="--card-from:#ffbc00;--card-to:#ff0058;">
          <p class="menu-card-kicker">Weekend • ${currentYear}</p>
          <h3>${isSeasonOver ? "Season Complete" : `Next: ${nextRound ? nextRound.name : "Grand Prix"}`}</h3>
          <p class="dashboard-subtitle">
            ${
              isSeasonOver
                ? "Review your performance and prepare for the next year."
                : `Prepare for Round ${state.season.round}. Race date: ${formatSeasonDate(state.season.year || 1, raceDay)} (${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"}).`
            }
          </p>
          <button id="wk">${isSeasonOver ? "Open Offseason" : "Race Weekend"}</button>
        </article>

        <article class="glass dashboard-eight-card" style="--card-from:#03a9f4;--card-to:#ff0058;">
          <p class="menu-card-kicker">Progress</p>
          <h3>Team Level</h3>
          <p class="stat">Lv ${state.team.level}</p>
          <p class="dashboard-subtitle">Budget available: $${state.team.budget}M</p>
        </article>

        <article class="glass dashboard-eight-card" style="--card-from:#ff4d4d;--card-to:#ff9966;">
          <p class="menu-card-kicker">Engineering</p>
          <h3>R&amp;D</h3>
          <p class="dashboard-subtitle">Invest in upgrades, raise component levels, and prepare the car for the long season.</p>
          <button id="office">Upgrade Car</button>
        </article>

        <article class="glass dashboard-eight-card" style="--card-from:#4dff03;--card-to:#00d0ff;">
          <p class="menu-card-kicker">Operations</p>
          <h3>Operations</h3>
          <p class="dashboard-subtitle">Manage drivers, review the calendar, and keep an eye on the championship picture.</p>
          <div class="menu-card-actions">
            <button id="market">Drivers</button>
            <button id="teams">Teams</button>
            <button id="calendar">Calendar</button>
            <button id="standings">Standings</button>
          </div>
        </article>

        <article id="myDriversCard" class="glass dashboard-eight-card dashboard-drivers-summary-card" style="--card-from:#00ffa3;--card-to:#dc1fff;">
          <p class="menu-card-kicker">Lineup</p>
          <h3>My Drivers</h3>
          <p class="dashboard-subtitle">Active drivers and their current championship output.</p>
          <div class="driver-summary-list">
            ${buildMyDriversMarkup() || '<p class="driver-summary-empty">No active drivers selected.</p>'}
          </div>
        </article>

        ${buildDriverProfileCard(activeDrivers[0], "Driver Profile 1")}
        ${buildDriverProfileCard(activeDrivers[1], "Driver Profile 2")}

        <article class="glass dashboard-eight-card" style="--card-from:#6d5dfc;--card-to:#00d0ff;">
          <p class="menu-card-kicker">Constructors Table</p>
          <h3>Team Standing</h3>
          <div class="detail-card-stats">
            <div class="driver-detail-stat"><span>Current Position</span><strong>P${teamStanding.position}/${teamStanding.total}</strong></div>
            <div class="driver-detail-stat"><span>Team Points</span><strong>${teamStanding.points}</strong></div>
            <div class="driver-detail-stat"><span>Season Round</span><strong>R${state.season.round}</strong></div>
            <div class="driver-detail-stat"><span>Current Day</span><strong>D${currentDay}</strong></div>
          </div>
          <button id="openStandingsCard">Open Standings</button>
        </article>
      </div>

      <section class="dashboard-day-controls glass" style="--card-from:#ffbc00;--card-to:#ff0058;">
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

      <div id="dashboardRaceTimeline" style="--card-from:#4dff03;--card-to:#00d0ff;"></div>

      ${
        latestNotifications.length
          ? `
            <section class="glass dashboard-notifications" style="--card-from:#4dff03;--card-to:#00d0ff;">
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

      <div class="glass tile large dashboard-content-panel" id="content" style="--card-from:#03a9f4;--card-to:#ff0058;">
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
  const openStandingsCardBtn = root.querySelector("#openStandingsCard");
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
  if (openStandingsCardBtn) {
    openStandingsCardBtn.onclick = () => renderLeaderboard(root);
  }
  myDriversCard.onclick = () => renderMyDrivers(root);
  if (featureWeekend) {
    featureWeekend.onclick = () => renderWeekend(root);
  }
  if (featureUpgrade) {
    featureUpgrade.onclick = () => renderOffice(root);
  }
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
