import { calendar } from "../data/calendar.js";
import { strategies } from "../data/strategies.js";
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
import { getTotalSponsorRaceBonus } from "../utils/sponsorDeals.js";
import { applyRoundCarDevelopmentAll } from "../utils/carDevelopment.js";
import { syncGame } from "../lib/supabaseApi.js";

function ensureWeekendProgress(round) {
  if (!state.weekendProgress || state.weekendProgress.round !== round) {
    state.weekendProgress = {
      round,
      qualifyingComplete: false,
      grid: null,
      raceComplete: false,
      selectedStrategies: {}
    };
  } else {
    if (state.weekendProgress.raceComplete === undefined) {
      state.weekendProgress.raceComplete = false;
    }
    if (!state.weekendProgress.selectedStrategies) {
      state.weekendProgress.selectedStrategies = {};
    }
  }
  return state.weekendProgress;
}

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

function show(res, metric, qualiGrid = null) {
  const results = document.getElementById("results");
  const title =
    metric === "bestLap"
      ? "Practice Results"
      : metric === "lap"
        ? "Qualifying Results"
        : "Race Results";

  const isRace = metric === "time";
  let summaryHtml = "";

  if (isRace && qualiGrid?.length) {
    let driversGained = 0;
    let driversLost = 0;
    let unchanged = 0;
    let placesGainedSum = 0;
    let placesLostSum = 0;

    res.forEach((r, i) => {
      const qIdx = qualiGrid.findIndex((e) => e.driver.name === r.driver.name);
      if (qIdx < 0) return;
      const qualiPos = qIdx + 1;
      const finishPos = i + 1;
      const delta = qualiPos - finishPos;
      if (delta > 0) {
        driversGained += 1;
        placesGainedSum += delta;
      } else if (delta < 0) {
        driversLost += 1;
        placesLostSum += -delta;
      } else {
        unchanged += 1;
      }
    });

    summaryHtml = `
      <p class="race-delta-summary">
        vs qualifying grid:
        <span class="race-delta-summary-gain">${driversGained} driver${driversGained === 1 ? "" : "s"} gained (${placesGainedSum} place${placesGainedSum === 1 ? "" : "s"})</span>
        ·
        <span class="race-delta-summary-loss">${driversLost} lost (${placesLostSum} place${placesLostSum === 1 ? "" : "s"})</span>
        ·
        <span class="race-delta-summary-same">${unchanged} unchanged</span>
      </p>
    `;
  }

  const rows = res
    .map((r, i) => {
      const metricValue =
        metric && Number.isFinite(r[metric]) ? `${r[metric].toFixed(3)}s` : "";
      const status = r.retired ? "DNF" : metricValue;
      const isPlayerDriver =
        state.team && r.team && r.team.name === state.team.name;
      const highlight = isPlayerDriver ? " result-row-player" : "";

      let deltaHtml = "";
      if (isRace && qualiGrid?.length) {
        const qIdx = qualiGrid.findIndex((e) => e.driver.name === r.driver.name);
        if (qIdx >= 0) {
          const qualiPos = qIdx + 1;
          const finishPos = i + 1;
          const delta = qualiPos - finishPos;
          const qualiLabel = `<span class="result-row-quali-ref">Q${qualiPos}</span>`;
          if (delta > 0) {
            deltaHtml = `<span class="result-row-delta result-row-delta--gain" title="Gained ${delta} position${delta === 1 ? "" : "s"} vs qualifying">+${delta}</span>`;
          } else if (delta < 0) {
            deltaHtml = `<span class="result-row-delta result-row-delta--loss" title="Lost ${-delta} position${-delta === 1 ? "" : "s"} vs qualifying">${delta}</span>`;
          } else {
            deltaHtml = `<span class="result-row-delta result-row-delta--same">±0</span>`;
          }
          deltaHtml = `${qualiLabel}${deltaHtml}`;
        }
      }

      return `
        <div class="result-row${highlight}">
          <div class="result-row-main">
            <strong>P${i + 1}</strong>
            <span class="result-row-driver-name">${r.driver.name}${isPlayerDriver ? `<span class="result-row-you-pill">Your driver</span>` : ""}</span>
            <span class="result-row-team">${r.team.name}</span>
          </div>
          <div class="result-row-meta">
            ${deltaHtml ? `<div class="result-row-delta-wrap">${deltaHtml}</div>` : ""}
            <span class="result-row-time">${status}</span>
          </div>
        </div>
      `;
    })
    .join("");

  results.innerHTML = `
    <section class="glass weekend-results-panel">
      <div class="weekend-results-head">
        <p class="menu-card-kicker">Live Session Data</p>
        <h3>${title}</h3>
        ${summaryHtml}
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
  const sponsorRaceBonus = getTotalSponsorRaceBonus(state.team);
  const weekendProgress = round ? ensureWeekendProgress(round.round) : null;
  const raceNeedsQuali = Boolean(
    round && weekendProgress && !weekendProgress.qualifyingComplete
  );
  const raceAlreadyRun = Boolean(round && weekendProgress?.raceComplete);
  const raceLocked = Boolean(
    round && weekendProgress && (!weekendProgress.qualifyingComplete || weekendProgress.raceComplete)
  );

  const roundStrats = round && strategies[round.round] ? strategies[round.round] : [];
  
  let strategyHtml = "";
  let strategiesValid = false;
  
  if (round) {
    const d1 = activeDrivers[0];
    const d2 = activeDrivers[1];
    
    // Always initialize correctly
    if (!weekendProgress.selectedStrategies) {
      weekendProgress.selectedStrategies = {};
    }

    const d1Strat = weekendProgress.selectedStrategies[d1?.name] || "";
    const d2Strat = d2 ? (weekendProgress.selectedStrategies[d2.name] || "") : "N/A";
    
    // If the data is empty, we force valid to prevent bricking the game, but render UI so it's obvious there's a data load error
    if (roundStrats.length === 0) {
      strategiesValid = true; 
    } else {
      strategiesValid = Boolean(d1Strat && (d2 ? d2Strat : true));
    }

    const stratDisabledAttr = (!weekendProgress.qualifyingComplete || weekendProgress.raceComplete) ? "disabled" : "";

    const buildStratSelect = (d, currentVal) => `
      <div class="strategy-driver-wrap">
        <label>${d.name} Strategy</label>
        <select class="strategy-select" data-driver-strat="${d.name}" ${stratDisabledAttr}>
          <option value="">-- Assign Strategy --</option>
          ${roundStrats.map(s => 
            `<option value="${s.id}" ${currentVal === s.id ? "selected" : ""}>${s.label}</option>`
          ).join("")}
        </select>
      </div>
    `;

    strategyHtml = `
      <div class="glass strategy-panel">
        <p class="menu-card-kicker">Pit Wall</p>
        <h3>Race Strategy</h3>
        <p class="dashboard-subtitle">Select a tire compound strategy for each driver. Higher risk strategies offer no win bonus but carry heavy penalty chances. ${roundStrats.length === 0 ? "<b>Warning: No strategy data loaded for round " + round.round + ". You may race default.</b>" : ""}</p>
        <div class="strategy-grid">
          ${d1 ? buildStratSelect(d1, d1Strat) : ""}
          ${d2 ? buildStratSelect(d2, d2Strat) : ""}
        </div>
      </div>
    `;
  } else {
     strategiesValid = true; // Fallback for end of season
  }

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
          <button id="race" class="weekend-action weekend-action-primary" ${round && !raceLocked && strategiesValid ? "" : "disabled"}>Race</button>
        </div>
        ${strategyHtml}
        ${raceNeedsQuali ? `<p class="weekend-gate-hint weekend-gate-hint--quali">Complete qualifying to unlock the race simulation for this round.</p>` : ""}
        ${raceAlreadyRun ? `<p class="weekend-gate-hint weekend-gate-hint--done">This Grand Prix has been run — the race cannot be simulated again until you advance.</p>` : ""}

        <div class="weekend-continue-wrap">
          <button type="button" id="continueNextRound" class="weekend-action weekend-continue-btn" ${raceAlreadyRun ? "" : "disabled"}>
            Continue to next round
          </button>
          <p class="weekend-continue-hint">${raceAlreadyRun ? "Proceed to the next Grand Prix on the calendar." : "Enabled after you complete the race for this weekend."}</p>
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
  const continueNextRound = root.querySelector("#continueNextRound");
  const continueHint = root.querySelector(".weekend-continue-hint");

  root.querySelectorAll("[data-driver-strat]").forEach(select => {
    select.onchange = async () => {
      const driverName = select.dataset.driverStrat;
      weekendProgress.selectedStrategies[driverName] = select.value;
      await syncGame();
      renderWeekend(root);
    };
  });

  const advanceRound = async () => {
    if (!weekendProgress.raceComplete) return;
    state.season.round++;
    applyRoundCarDevelopmentAll(state);
    await syncGame();
    renderWeekend(root, "All teams have developed their cars slightly for the next round.");
  };

  if (continueNextRound) {
    continueNextRound.onclick = advanceRound;
  }

  fp.onclick = () => showLoading(async () => {
    try {
      gainTeamCarXP(state.team, 5);
      show(simulatePractice(teams, round), "bestLap");
      setWeekendStatus(`Practice complete. Car XP increased to ${state.team.carXP}/100.`);
      syncGame(); // background save
    } catch (error) {
      setWeekendStatus(`Practice failed to simulate. ${error.message}`);
    }
  });

  quali.onclick = () => showLoading(async () => {
    try {
      gainTeamCarXP(state.team, 8);
      const { grid } = simulateQualifying(teams, round);
      show(grid, "lap");
      weekendProgress.qualifyingComplete = true;
      weekendProgress.grid = grid.slice();
      const raceBtn = root.querySelector("#race");
      root.querySelector(".weekend-gate-hint--quali")?.remove();
      if (raceBtn) {
        raceBtn.disabled = Boolean(weekendProgress.raceComplete);
      }
      setWeekendStatus(
        weekendProgress.raceComplete
          ? `Qualifying session updated. This Grand Prix race is already complete — advance to the next round for a new race. Car XP is ${state.team.carXP}/100.`
          : `Qualifying complete. Car XP increased to ${state.team.carXP}/100. Race is now unlocked — grid order will influence the start of the simulation.`
      );
      syncGame(); // background save
    } catch (error) {
      setWeekendStatus(`Qualifying failed to simulate. ${error.message}`);
    }
  });

  race.onclick = () => {
    if (weekendProgress.raceComplete) {
      setWeekendStatus(
        "This Grand Prix race has already been completed. Continue to the next round to start a new weekend."
      );
      return;
    }
    if (!weekendProgress.qualifyingComplete) {
      setWeekendStatus("Run qualifying first — the race stays locked until the grid is set.");
      return;
    }
    
    // Explicit guard
    if (roundStrats.length > 0 && !strategiesValid) {
      setWeekendStatus("Assign a race strategy for your active drivers on the pit wall before starting the race.");
      return;
    }

    showLoading(async () => {
      try {
        const res = simulateRaceEvent(teams, round, round.laps, weekendProgress.grid, weekendProgress.selectedStrategies);
        gainTeamXP(state.team, 25);
        gainTeamCarXP(state.team, 20);
        state.standings = updateStandings(res, state.standings);
        updateBestFinishes(res);

        let earnings = 0;
        const raceSponsorPayout = getTotalSponsorRaceBonus(state.team);
        if (raceSponsorPayout > 0) {
          earnings += raceSponsorPayout;
          state.team.budget += earnings;
        }

        weekendProgress.raceComplete = true;
        show(res, "time", weekendProgress.grid);
        const raceBtnAfter = root.querySelector("#race");
        if (raceBtnAfter) raceBtnAfter.disabled = true;

        setWeekendStatus(
          `${round.name} complete. ${earnings ? `Sponsor payout: $${earnings}M.` : "No sponsor payout earned."} Car XP is now ${state.team.carXP}/100.`
        );

        const doneHint = document.createElement("p");
        doneHint.className = "weekend-gate-hint weekend-gate-hint--done";
        doneHint.textContent =
          "This Grand Prix has been run — you cannot re-run the race until you advance to the next round.";
        const pageCard = root.querySelector(".weekend-page-card");
        if (pageCard && !pageCard.querySelector(".weekend-gate-hint--done")) {
          pageCard.appendChild(doneHint);
        }

        const continueBtn = root.querySelector("#continueNextRound");
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.onclick = advanceRound;
        }
        if (continueHint) {
          continueHint.textContent = "Proceed to the next Grand Prix on the calendar.";
        }
        
        syncGame(); // background save
      } catch (error) {
        setWeekendStatus(`Race failed to simulate. ${error.message}`);
      }
    });
  };
}
