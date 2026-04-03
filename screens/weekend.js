import { calendar } from "../data/calendar.js";
import { simulatePractice } from "../game/practice.js";
import { simulateQualifying } from "../game/qualifying.js";
import { simulateRaceEvent } from "../game/raceSimulator.js";
import { updateStandings } from "../game/standings.js";
import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderSponsors } from "./sponsors.js";
import { renderOffseason } from "./offseason.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState, gainTeamXP, gainTeamCarXP, getActiveDrivers } from "../utils/teamState.js";

function showLoading(cb) {
  const l = document.createElement("div");
  l.className = "loading-screen";
  l.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(l);
  setTimeout(() => { l.remove(); cb(); }, 1500);
}

function updateBestFinishes(results) {
  results.forEach((entry, idx) => {
    if (entry.team.name !== state.team.name) return;
    const finishPos = idx + 1;
    const currentBest = state.bestFinishes[entry.driver.name];
    if (!currentBest || finishPos < currentBest) {
      state.bestFinishes[entry.driver.name] = finishPos;
    }
  });
}

function show(res, metric) {
  const results = document.getElementById("results");
  const title =
    metric === "bestLap"
      ? "Practice Results"
      : metric === "lap"
        ? "Qualifying Results"
        : "Race Results";

  const rows = res
    .map((r, i) => {
      const metricValue =
        metric && Number.isFinite(r[metric]) ? `${r[metric].toFixed(3)}s` : "";
      const status = r.retired ? "DNF" : metricValue;
      const highlight = r.team === state.team ? " result-row-player" : "";
      return `
        <div class="result-row${highlight}">
          <div class="result-row-main">
            <strong>P${i + 1}</strong>
            <span>${r.driver.name}</span>
            <span class="result-row-team">${r.team.name}</span>
          </div>
          <span class="result-row-time">${status}</span>
        </div>
      `;
    })
    .join("");

  results.innerHTML = `
    <section class="glass weekend-results-panel">
      <div class="weekend-results-head">
        <p class="menu-card-kicker">Live Session Data</p>
        <h3>${title}</h3>
      </div>
      <div class="result-list">${rows}</div>
    </section>
  `;

  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setWeekendStatus(message, actionLabel = "") {
  const status = document.getElementById("weekendStatus");
  if (!status) return;

  status.innerHTML = `
    <div class="glass weekend-status-card">
      <p class="menu-card-kicker">Session Update</p>
      <p class="dashboard-subtitle">${message}</p>
      ${actionLabel ? `<button id="continueWeekend">${actionLabel}</button>` : ""}
    </div>
  `;
}

export function renderWeekend(root, flashMessage = "") {
  ensureTeamState(state.team);
  const totalRounds = Math.min(state.season.totalRounds || calendar.length, calendar.length);
  const round = state.season.round <= totalRounds ? calendar[state.season.round - 1] : null;
  const activeDrivers = getActiveDrivers(state.team);
  const teams = [
    { ...state.team, drivers: activeDrivers },
    ...state.aiTeams
  ];
  const sponsorRaceBonus = state.team?.sponsor?.raceBonus ?? 0;

  root.innerHTML = `
    ${buildHubNav("weekend")}
    <section class="upgrade-page">
      <div class="glass my-drivers-header">
        <div>
          <p class="dashboard-eyebrow">Race Weekend</p>
          <h2>${round ? round.name : "Season Complete"}</h2>
          <p class="dashboard-subtitle">
            Run the full weekend flow and build both team progression and sponsor income after every race.
          </p>
          <p class="detail-card-meta">Active lineup: ${activeDrivers.map(driver => driver.name).join(" and ")}</p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Current Round</span>
            <strong>${round ? round.round : totalRounds}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Sponsor Bonus</span>
            <strong>$${sponsorRaceBonus}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Car Level</span>
            <strong>Lv ${state.team.carLevel}</strong>
          </div>
        </div>
      </div>

      <div class="glass weekend-page-card">
        <div class="weekend-head">
          <p class="weekend-kicker">Grand Prix Weekend</p>
          <h3>${round ? round.name : "No More Rounds"}</h3>
          <p class="weekend-meta">${round ? `Round ${round.round} • ${round.laps} laps` : "You completed the season."}</p>
        </div>

        <div class="weekend-actions">
          <button id="fp" class="weekend-action" ${round ? "" : "disabled"}>Practice</button>
          <button id="quali" class="weekend-action" ${round ? "" : "disabled"}>Qualifying</button>
          <button id="race" class="weekend-action weekend-action-primary" ${round ? "" : "disabled"}>Race</button>
        </div>
      </div>

      <div id="weekendStatus">
        ${flashMessage ? `<div class="glass weekend-status-card"><p class="dashboard-subtitle">${flashMessage}</p></div>` : ""}
      </div>
      <div id="results" class="result-list"></div>
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

  if (!round) {
    const status = document.getElementById("weekendStatus");
    if (status) {
      status.innerHTML = `
        <div class="glass weekend-status-card">
          <p class="menu-card-kicker">Season Complete</p>
          <p class="dashboard-subtitle">The championship is over. Head into the offseason to confirm your lineup or make changes before next year.</p>
          <button id="openOffseason">Open Offseason</button>
        </div>
      `;
      document.getElementById("openOffseason").onclick = () => renderOffseason(root);
    }
    return;
  }

  const fp = root.querySelector("#fp");
  const quali = root.querySelector("#quali");
  const race = root.querySelector("#race");

  fp.onclick = () => showLoading(() => {
    try {
      gainTeamCarXP(state.team, 5);
      show(simulatePractice(teams, round), "bestLap");
      setWeekendStatus(`Practice complete. Car XP increased to ${state.team.carXP}/100.`);
    } catch (error) {
      setWeekendStatus(`Practice failed to simulate. ${error.message}`);
    }
  });

  quali.onclick = () => showLoading(() => {
    try {
      gainTeamCarXP(state.team, 8);
      show(simulateQualifying(teams, round).grid, "lap");
      setWeekendStatus(`Qualifying complete. Car XP increased to ${state.team.carXP}/100.`);
    } catch (error) {
      setWeekendStatus(`Qualifying failed to simulate. ${error.message}`);
    }
  });

  race.onclick = () => showLoading(() => {
    try {
      const res = simulateRaceEvent(teams, round, round.laps);
      gainTeamXP(state.team, 25);
      gainTeamCarXP(state.team, 20);
      state.standings = updateStandings(res, state.standings);
      updateBestFinishes(res);

      let earnings = 0;
      if (state.team.sponsor) {
        earnings += state.team.sponsor.raceBonus;
        state.team.budget += earnings;
      }

      show(res, "time");
      setWeekendStatus(
        `${round.name} complete. ${earnings ? `Sponsor payout: $${earnings}M.` : "No sponsor payout earned."} Car XP is now ${state.team.carXP}/100.`,
        "Continue To Next Round"
      );

      const continueButton = document.getElementById("continueWeekend");
      if (continueButton) {
        continueButton.onclick = () => {
          state.season.round++;
          renderWeekend(root);
        };
      }
    } catch (error) {
      setWeekendStatus(`Race failed to simulate. ${error.message}`);
    }
  });
}
