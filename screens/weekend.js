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
import { AnimatedTabs } from "../components/ui/animated-tabs.tsx";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import {
  ensureSeasonTimeline,
  getRoundRaceDay,
  getDaysUntilRound,
  formatSeasonDate,
  simulateNextDay,
  canSimulateNextDay,
} from "../utils/seasonTimeline.js";
import React from "react";
import { createRoot } from "react-dom/client";

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
  const loader = document.createElement("div");
  loader.className = "loading-screen";
  loader.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(loader);
  setTimeout(() => { loader.remove(); cb(); }, 1500);
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
            <span class="result-row-driver-name">
              <span class="driver-nameplate">
                <img class="driver-face driver-face--sm" src="${getDriverHeadshotUrl(r.driver)}" alt="${r.driver.name}" loading="lazy" />
                <span>${r.driver.name}</span>
              </span>
              ${isPlayerDriver ? `<span class="result-row-you-pill">Your driver</span>` : ""}
            </span>
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
  ensureSeasonTimeline(state);
  const totalRounds = Math.min(state.season.totalRounds || calendar.length, calendar.length);
  const round = state.season.round <= totalRounds ? calendar[state.season.round - 1] : null;
  const currentDay = state.season.currentDay;
  const raceDay = round ? getRoundRaceDay(round.round) : null;
  const raceDateLabel = round ? formatSeasonDate(state.season.year || 1, raceDay) : "";
  const daysUntilRace = round ? getDaysUntilRound(round.round, currentDay) : 0;
  const raceWindowOpen = Boolean(round) && daysUntilRace === 0;
  const canAdvanceDay = canSimulateNextDay(state);
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

  // The race is locked if race day is not active, race already run, or qualifying is incomplete.
  const raceLocked = !raceWindowOpen || raceAlreadyRun || !weekendProgress.qualifyingComplete;

  const roundStrats = round && strategies[round.round] ? strategies[round.round] : [];
  const activeLineupMarkup = activeDrivers
    .map(
      driver => `
        <span class="driver-nameplate">
          <img class="driver-face driver-face--sm" src="${getDriverHeadshotUrl(driver)}" alt="${driver.name}" loading="lazy" />
          <span>${driver.name}</span>
        </span>
      `
    )
    .join('<span class="detail-card-meta">and</span>');
  
  let strategiesValid = false;
  
  if (round) {
    const d1 = activeDrivers[0];
    const d2 = activeDrivers[1];
    
    if (!weekendProgress.selectedStrategies) {
      weekendProgress.selectedStrategies = {};
    }

    const d1Strat = weekendProgress.selectedStrategies[d1?.name] || "";
    const d2Strat = d2 ? (weekendProgress.selectedStrategies[d2.name] || "") : "N/A";
    
    if (roundStrats.length === 0) {
      strategiesValid = true; 
    } else {
      strategiesValid = Boolean(d1Strat && (d2 ? d2Strat : true));
    }
  } else {
     strategiesValid = true;
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
          <p class="detail-card-meta">Active lineup:</p>
          <div class="driver-lineup-inline">${activeLineupMarkup || '<span class="detail-card-meta">No active drivers selected.</span>'}</div>
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
          <p class="weekend-meta">
            ${
              round
                ? `Round ${round.round} • ${round.laps} laps • ${raceDateLabel} • ${daysUntilRace === 0 ? "Race day is live" : `${daysUntilRace} day${daysUntilRace === 1 ? "" : "s"} to go`}`
                : "You completed the season."
            }
          </p>
        </div>

        <div class="weekend-actions">
          <button id="fp" class="weekend-action" ${round && raceWindowOpen ? "" : "disabled"}>Practice</button>
          <button id="quali" class="weekend-action" ${round && raceWindowOpen ? "" : "disabled"}>Qualifying</button>
          <button id="race" class="weekend-action weekend-action-primary" ${round && !raceLocked && strategiesValid ? "" : "disabled"}>Race</button>
        </div>
        
        <div id="strategy-tabs-root"></div>

        ${round && !raceWindowOpen ? `<p class="weekend-gate-hint weekend-gate-hint--quali">Race weekend is not open yet. Simulate days until ${raceDateLabel}.</p>` : ""}
        ${raceNeedsQuali ? `<p class="weekend-gate-hint weekend-gate-hint--quali">Complete qualifying to unlock the race simulation for this round.</p>` : ""}
        ${raceAlreadyRun ? `<p class="weekend-gate-hint weekend-gate-hint--done">This Grand Prix has been run — the race cannot be simulated again until you advance.</p>` : ""}

        <div class="weekend-continue-wrap">
          <button type="button" id="simulateNextDay" class="weekend-action weekend-continue-btn" ${round && canAdvanceDay ? "" : "disabled"}>
            Simulate 1 day
          </button>
          <p class="weekend-continue-hint">
            ${
              !round
                ? "Season complete."
                : canAdvanceDay
                  ? "Advance one calendar day to process R&D and approach the next race."
                  : "Day simulation is locked while a race weekend is active and incomplete."
            }
          </p>
        </div>
      </div>

      <div id="weekendStatus">
        ${flashMessage ? `<div class="glass weekend-status-card"><p class="dashboard-subtitle">${flashMessage}</p></div>` : ""}
      </div>
      <div id="results" class="result-list"></div>
    </section>
  `;

  // Mount React tabs
  if (round && activeDrivers.length > 0) {
    const strategyTabsRoot = root.querySelector("#strategy-tabs-root");
    if (strategyTabsRoot) {
      const reactRoot = createRoot(strategyTabsRoot);
      
      const tabImages = [
        "https://images.unsplash.com/photo-1541344485523-289b4f62ca7a?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1506543730435-e2c1d4553a84?q=80&w=600",
        "https://images.unsplash.com/photo-1522428938647-2baa7c899f2f?q=80&w=600",
        "https://images.unsplash.com/photo-1493552152660-f915ab47ae9d?q=80&w=600"
      ];

      const driverTabs = activeDrivers.map((driver, dIdx) => {
        const currentStratId = weekendProgress.selectedStrategies[driver.name] || "";
        
        return {
          id: `driver-${driver.name}`,
          label: driver.name,
          content: React.createElement("div", { className: "flex flex-col gap-4" },
            React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
              roundStrats.map((strat, sIdx) => {
                const isSelected = currentStratId === strat.id;
                // Strategies should only be locked if the race is already complete
                const isDisabled = weekendProgress.raceComplete;
                
                return React.createElement("div", {
                  key: strat.id,
                  onClick: () => {
                    if (isDisabled) return;
                    weekendProgress.selectedStrategies[driver.name] = strat.id;
                    syncGame();
                    renderWeekend(root);
                  },
                  className: `strategy-card ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}`
                },
                  React.createElement("div", { className: "strategy-card-header" },
                    React.createElement("span", { className: "strategy-card-title" }, strat.label),
                    isSelected && React.createElement("div", { className: "strategy-card-badge" },
                      React.createElement("span", { className: "strategy-card-dot" }),
                      React.createElement("span", null, "Selected")
                    )
                  ),
                  React.createElement("div", { className: "strategy-grid-inner" },
                    React.createElement("div", { className: "strategy-stat" },
                      React.createElement("span", { className: "strategy-stat-label" }, "Rank"),
                      React.createElement("span", { className: "strategy-stat-value" }, strat.rank)
                    ),
                    React.createElement("div", { className: "flex flex-col" },
                      React.createElement("span", { className: "strategy-stat-label" }, "Win Bonus"),
                      React.createElement("span", { className: "strategy-stat-value win" }, `+${(strat.winModifier * 100).toFixed(0)}%`)
                    ),
                    React.createElement("div", { className: "flex flex-col" },
                      React.createElement("span", { className: "strategy-stat-label" }, "Risk Level"),
                      React.createElement("span", { className: "strategy-stat-value risk" }, `${(strat.riskModifier * 100).toFixed(0)}%`)
                    )
                  )
                );
              })
            )
          )
        };
      });

      reactRoot.render(
        React.createElement("div", { className: "mt-6 mb-4" },
          React.createElement("p", { className: "text-xs uppercase tracking-widest text-red-500 font-bold mb-2" }, "Pit Wall Strategy"),
          React.createElement(AnimatedTabs, { 
            tabs: driverTabs,
            className: "max-w-full"
          })
        )
      );
    }
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
    return;
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

  const fp = root.querySelector("#fp");
  const quali = root.querySelector("#quali");
  const race = root.querySelector("#race");
  const simulateDayButton = root.querySelector("#simulateNextDay");
  const continueHint = root.querySelector(".weekend-continue-hint");

  // Removed old event listener for [data-driver-strat] as we use React now

  const advanceDay = async () => {
    const tick = simulateNextDay(state);
    if (!tick.advanced) return;
    await syncGame();
    const completedText = tick.completedUpgrades.length
      ? ` Upgrade complete: ${tick.completedUpgrades.map(entry => entry.part.toUpperCase()).join(", ")}.`
      : "";
    renderWeekend(root, `Advanced to Day ${state.season.currentDay}.${completedText}`);
  };

  if (simulateDayButton) {
    simulateDayButton.onclick = advanceDay;
  }

  fp.onclick = () => showLoading(async () => {
    if (!raceWindowOpen) {
      setWeekendStatus(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
      return;
    }
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
    if (!raceWindowOpen) {
      setWeekendStatus(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
      return;
    }
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
    if (!raceWindowOpen) {
      setWeekendStatus(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
      return;
    }
    if (weekendProgress.raceComplete) {
      setWeekendStatus(
        "This Grand Prix race has already been completed. Simulate days to progress the calendar toward the next race weekend."
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
        applyRoundCarDevelopmentAll(state);
        state.season.round += 1;
        show(res, "time", weekendProgress.grid);
        const raceBtnAfter = root.querySelector("#race");
        if (raceBtnAfter) raceBtnAfter.disabled = true;

        setWeekendStatus(
          `${round.name} complete. ${earnings ? `Sponsor payout: $${earnings}M.` : "No sponsor payout earned."} Car XP is now ${state.team.carXP}/100. Day simulation is now unlocked for the gap to the next race.`
        );

        const doneHint = document.createElement("p");
        doneHint.className = "weekend-gate-hint weekend-gate-hint--done";
        doneHint.textContent =
          "This Grand Prix has been run — you cannot re-run the race until you advance to the next round.";
        const pageCard = root.querySelector(".weekend-page-card");
        if (pageCard && !pageCard.querySelector(".weekend-gate-hint--done")) {
          pageCard.appendChild(doneHint);
        }

        const continueBtn = root.querySelector("#simulateNextDay");
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.onclick = advanceDay;
        }
        if (continueHint) {
          continueHint.textContent = "Advance one day at a time to reach the next Grand Prix.";
        }
        
        syncGame(); // background save
      } catch (error) {
        setWeekendStatus(`Race failed to simulate. ${error.message}`);
      }
    });
  };
}
