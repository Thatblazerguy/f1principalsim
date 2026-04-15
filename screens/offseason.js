import { state } from "../state.js";
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderSponsors } from "./sponsors.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getRoundRaceDay } from "../utils/seasonTimeline.js";

function removeDriverFromTeam(team, driverName) {
  ensureTeamState(team);
  team.drivers = team.drivers.filter(driver => driver.name !== driverName);
  if (team.reserveDriver?.name === driverName) {
    team.reserveDriver = null;
  }
}

function addDriverToTeam(team, driver) {
  ensureTeamState(team);
  if (team.drivers.length < 2) {
    team.drivers.push(driver);
    return "main";
  }
  if (!team.reserveDriver) {
    team.reserveDriver = driver;
    return "reserve";
  }
  return null;
}

function getAllAssignedDriverNames() {
  const names = new Set();
  if (state.team) {
    getTeamRoster(state.team).forEach(driver => names.add(driver.name));
  }
  state.aiTeams.forEach(team => {
    ensureTeamState(team);
    team.drivers.forEach(driver => names.add(driver.name));
  });
  return names;
}

function findAiTeamByDriver(driverName) {
  return state.aiTeams.find(team => team.drivers.some(driver => driver.name === driverName));
}

function getFreeTalentPool(excludedNames = new Set()) {
  const assigned = getAllAssignedDriverNames();
  return drivers
    .filter(driver => (driver.category === "FREE" || driver.category === "F2") && !assigned.has(driver.name) && !excludedNames.has(driver.name));
}

function getWeightedRandomReplacement(excludedNames = new Set()) {
  const pool = getFreeTalentPool(excludedNames);
  if (!pool.length) return null;

  const weightedPool = pool.flatMap(driver => Array.from({ length: Math.max(1, Math.round(driver.market / 8)) }, () => driver));
  return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

function fillAiSeat(team) {
  if (team.drivers.length >= 2) return;
  const replacement = getWeightedRandomReplacement();
  if (replacement) {
    addDriverToTeam(team, replacement);
  }
}

function getPoachCost(driver, oldTeam) {
  const baseCost = Math.round(driver.salary * 1.8 + driver.market * 0.18);
  const teamPremium = oldTeam ? Math.max(4, Math.round(oldTeam.carPerformance / 18)) : 0;
  return baseCost + teamPremium;
}

function getPoachChance(driver, oldTeam) {
  const carDelta = oldTeam ? (state.team.carPerformance - oldTeam.carPerformance) / 40 : 0;
  const levelBoost = (state.team.level || 1) * 0.03;
  const marketResistance = driver.market / 180;
  const ageFactor = driver.age >= 32 ? 0.12 : driver.age <= 23 ? -0.05 : 0;
  const chance = 0.42 + carDelta + levelBoost + ageFactor - marketResistance;
  return Math.max(0.18, Math.min(0.82, chance));
}

function buildRosterCard(driver) {
  return `
    <article class="glass market-driver-card">
      <div class="market-driver-card-top">
        <div>
          <p class="menu-card-kicker">${state.team.activeDrivers.includes(driver.name) ? "Active Driver" : "Squad Driver"}</p>
          <div class="driver-nameplate">
            <img class="driver-face" src="${getDriverHeadshotUrl(driver)}" alt="${driver.name}" loading="lazy" />
            <h3>${driver.name}</h3>
          </div>
          <p class="detail-card-meta">Age ${driver.age} • ${driver.category} • Salary $${driver.salary}M</p>
        </div>
        <span class="detail-badge">Market ${driver.market}</span>
      </div>

      <div class="market-driver-stats">
        <span>Pace ${driver.pace}</span>
        <span>Quali ${driver.quali}</span>
        <span>Racecraft ${driver.racecraft}</span>
        <span>Consistency ${driver.consistency}</span>
      </div>

      <button type="button" data-offseason-release="${driver.name}" class="market-sign-button">Release Driver</button>
    </article>
  `;
}

function buildCandidateCard(driver) {
  const currentTeam = findAiTeamByDriver(driver.name);
  const rosterFull = getTeamRoster(state.team).length >= 3;
  const alreadySigned = getTeamRoster(state.team).some(entry => entry.name === driver.name);
  const poachCost = currentTeam ? getPoachCost(driver, currentTeam) : driver.salary;
  return `
    <article class="glass market-driver-card">
      <div class="market-driver-card-top">
        <div>
          <p class="menu-card-kicker">${currentTeam ? "Poach Opportunity" : driver.category}</p>
          <div class="driver-nameplate">
            <img class="driver-face" src="${getDriverHeadshotUrl(driver)}" alt="${driver.name}" loading="lazy" />
            <h3>${driver.name}</h3>
          </div>
          <p class="detail-card-meta">
            ${currentTeam ? `Currently at ${currentTeam.name}` : "Available immediately"} • Salary $${driver.salary}M
          </p>
        </div>
        <span class="detail-badge">Market ${driver.market}</span>
      </div>

      <div class="market-driver-stats">
        <span>Pace ${driver.pace}</span>
        <span>Quali ${driver.quali}</span>
        <span>Racecraft ${driver.racecraft}</span>
        <span>Consistency ${driver.consistency}</span>
        <span>${currentTeam ? `Buyout $${poachCost}M` : `Signing $${poachCost}M`}</span>
        <span>${currentTeam ? `Interest ${Math.round(getPoachChance(driver, currentTeam) * 100)}%` : "Available Now"}</span>
      </div>

      <button
        type="button"
        data-offseason-sign="${driver.name}"
        class="market-sign-button"
        ${rosterFull || alreadySigned || state.team.budget < poachCost ? "disabled" : ""}
      >
        ${alreadySigned ? "Already In Team" : rosterFull ? "Roster Full" : state.team.budget < poachCost ? "Insufficient Budget" : currentTeam ? "Sign From Team" : "Sign Driver"}
      </button>
    </article>
  `;
}

function getOffseasonCandidates() {
  const playerDrivers = new Set(getTeamRoster(state.team).map(driver => driver.name));
  const aiDrivers = state.aiTeams.flatMap(team => team.drivers);
  
  // Show ALL drivers in the game that are not in the player's team
  const allAvailableDrivers = drivers.filter(driver => !playerDrivers.has(driver.name));

  return [...aiDrivers, ...allAvailableDrivers]
    .filter((driver, index, array) => array.findIndex(entry => entry.name === driver.name) === index)
    .sort((a, b) => b.market - a.market || b.pace - a.pace);
}

async function startNextSeason(root, keepSponsors = true) {
  ensureTeamState(state.team);
  const roster = getTeamRoster(state.team);
  if (roster.length < 2) {
    renderOffseason(root, "You need at least two contracted drivers before starting the next season.");
    return;
  }

  const active = getActiveDrivers(state.team);
  if (active.length < 2) {
    setTeamActiveDrivers(state.team, roster.slice(0, 2).map(driver => driver.name));
  }

  // Handle sponsor decision
  if (!keepSponsors) {
    state.team.sponsorSlots = {}; // Clear all active sponsors
    state.team.sponsor = null;
  }
  
  // Rotate offers for the new season
  rotateSponsorOffers(state);

  // --- New: Driver Progression and AI Team Growth ---
  const driverStandings = Object.entries(state.standings.drivers || {})
    .sort(([, a], [, b]) => b - a);
  
  const totalDrivers = driverStandings.length;

  // Process all drivers in the game (Player team + AI teams)
  const allTeams = [state.team, ...(state.aiTeams || [])];
  
  allTeams.forEach(t => {
    // 1. Team Growth (AI teams grow car performance slightly more)
    if (t !== state.team) {
      // AI growth: 3-6 points of car performance per season
      const aiGrowth = 3 + Math.random() * 3;
      t.carPerformance = parseFloat((t.carPerformance + aiGrowth).toFixed(1));
      // Also slightly upgrade specific car parts for visual consistency
      const parts = ["aero", "engine", "chassis", "reliability"];
      parts.forEach(p => {
        if (t.car && t.car[p]) t.car[p] += Math.floor(Math.random() * 2);
      });
    }

    // 2. Driver Aging and Progression
    const teamDrivers = [...t.drivers, ...(t.reserveDriver ? [t.reserveDriver] : [])];
    teamDrivers.forEach(d => {
      // Age every driver by 1
      if (typeof d.age === "number") d.age += 1;

      // Progression based on standings
      const rankIndex = driverStandings.findIndex(([name]) => name === d.name);
      let ratingChange = 0;

      if (rankIndex !== -1) {
        const percentile = (totalDrivers - rankIndex) / totalDrivers;
        if (percentile > 0.8) ratingChange = 1 + Math.random(); // Top 20%: +1 to +2
        else if (percentile > 0.5) ratingChange = 0.5 + Math.random() * 0.5; // Top 50%: +0.5 to +1
        else if (percentile < 0.2) ratingChange = -1 - Math.random(); // Bottom 20%: -1 to -2
        else ratingChange = Math.random() * 0.5 - 0.25; // Middle: slight drift
      } else {
        // Drivers who didn't score or race (reserves): slight decline/stagnation
        ratingChange = -0.5 + Math.random() * 0.5;
      }

      // Apply changes to main stats (don't exceed 99 or drop below 40)
      const stats = ["pace", "quali", "racecraft", "tyre", "wet", "consistency"];
      stats.forEach(s => {
        if (typeof d[s] === "number") {
          d[s] = parseFloat(Math.min(99, Math.max(40, d[s] + ratingChange)).toFixed(1));
        }
      });
      
      // Update market value based on performance
      if (typeof d.market === "number") {
        d.market = parseFloat(Math.min(99, Math.max(10, d.market + ratingChange * 2)).toFixed(1));
      }
    });
  });

  // Infinite season loop: increment year and reset round
  state.season = {
    round: 1,
    year: (state.season.year || 1) + 1,
    totalRounds: state.season.totalRounds || 24,
    currentDay: getRoundRaceDay(1),
  };
  state.notifications = [];
  state.team.pendingUpgrades = [];
  
  // Reset weekend progress for the new season
  state.weekendProgress = null;
  
  // Clear seasonal data while keeping career stats (if any were separate)
  state.standings = { drivers: {}, teams: {} };
  state.bestFinishes = {};

  // --- New: AI Driver Transfers and Market Optimization ---
  const allDriversInPool = [...drivers];
  const getOvr = (d) => Math.round((d.pace + d.quali + d.racecraft + d.consistency) / 4);

  // 1. AI Teams seek high-rated free agents (85+)
  if (state.aiTeams) {
    state.aiTeams.forEach(aiTeam => {
      ensureTeamState(aiTeam);
      const available85Plus = allDriversInPool.filter(d => 
        getOvr(d) >= 85 && !isDriverEmployed(d.name)
      ).sort((a, b) => getOvr(b) - getOvr(a));

      if (available85Plus.length > 0) {
        // Find the lowest rated driver on this AI team
        const teamDrivers = [...aiTeam.drivers];
        teamDrivers.sort((a, b) => getOvr(a) - getOvr(b));
        const weakest = teamDrivers[0];

        if (weakest && getOvr(available85Plus[0]) > getOvr(weakest) + 2) {
          // AI team upgrades: release weakest, sign the top free agent
          aiTeam.drivers = aiTeam.drivers.filter(d => d.name !== weakest.name);
          aiTeam.drivers.push(available85Plus[0]);
        }
      }
    });
  }

  // 2. Occasional Driver Transfers between AI teams
  if (state.aiTeams && state.aiTeams.length > 1) {
    state.aiTeams.forEach((aiTeam, idx) => {
      if (Math.random() < 0.15) { // 15% chance for a team to attempt a transfer
        const otherTeamIdx = (idx + Math.floor(Math.random() * (state.aiTeams.length - 1)) + 1) % state.aiTeams.length;
        const otherTeam = state.aiTeams[otherTeamIdx];
        
        if (otherTeam && otherTeam.drivers && aiTeam.drivers) {
          const myDriver = aiTeam.drivers[Math.floor(Math.random() * aiTeam.drivers.length)];
          const theirDriver = otherTeam.drivers[Math.floor(Math.random() * otherTeam.drivers.length)];

          if (myDriver && theirDriver && Math.abs(getOvr(myDriver) - getOvr(theirDriver)) < 5) {
            // Swap drivers between teams
            aiTeam.drivers = aiTeam.drivers.map(d => d.name === myDriver.name ? theirDriver : d);
            otherTeam.drivers = otherTeam.drivers.map(d => d.name === theirDriver.name ? myDriver : d);
          }
        }
      }
    });
  }
  
  await syncGame();
  renderDashboard(root);
}

export function renderOffseason(root, flashMessage = "") {
  ensureTeamState(state.team);
  const roster = getTeamRoster(state.team);
  const active = getActiveDrivers(state.team);
  const candidates = getOffseasonCandidates();

  root.innerHTML = `
    ${buildHubNav("drivers")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Season Transition</p>
          <h2>Offseason Decisions</h2>
          <p class="dashboard-subtitle">
            Decide whether to keep your current squad or reshape the team before starting season ${(state.season.year || 1) + 1}.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Current Squad</span>
            <strong>${roster.length}/3</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Active Pair</span>
            <strong>${active.map(driver => driver.name).join(" / ") || "--"}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Budget</span>
            <strong>$${(state.team.budget || 0).toFixed(1)}M</strong>
          </div>
        </div>
      </div>

      ${flashMessage ? `<div class="glass upgrade-flash">${flashMessage}</div>` : ""}

      <div class="glass dashboard-feature-panel">
        <div>
          <p class="dashboard-eyebrow">Next Step</p>
          <h3>Sponsor Commitment</h3>
          <p class="dashboard-subtitle">Would you like to continue with your current sponsors for the next season, or clear your roster to sign new ones?</p>
        </div>
        <div class="dashboard-feature-actions">
          <button id="keepSponsors">Keep Current Sponsors</button>
          <button id="newSponsors">Clear & New Sponsors</button>
        </div>
      </div>

      <div class="glass dashboard-feature-panel">
        <div>
          <p class="dashboard-eyebrow">Next Step</p>
          <h3>Continue Or Reshape</h3>
          <p class="dashboard-subtitle">You can keep the current lineup, release drivers, sign replacements, and then start the next season when ready.</p>
        </div>
        <div class="dashboard-feature-actions">
          <button id="keepLineup">Continue Current Lineup</button>
          <button id="startSeason">Start Next Season</button>
        </div>
      </div>

      <div class="standings-columns">
        <section class="glass standings-panel">
          <p class="menu-card-kicker">Your Team</p>
          <h3>Current Squad</h3>
          <div class="market-grid">
            ${roster.map(buildRosterCard).join("") || `<p class="dashboard-subtitle">No drivers contracted right now.</p>`}
          </div>
        </section>

        <section class="glass standings-panel">
          <p class="menu-card-kicker">Driver Market</p>
          <h3>Replacement Targets</h3>
          <div class="market-grid">
            ${candidates.map(buildCandidateCard).join("")}
          </div>
        </section>
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

  let sponsorDecision = true; // Default to keeping sponsors

  const updateDecisionUI = () => {
    const keepBtn = root.querySelector("#keepSponsors");
    const newBtn = root.querySelector("#newSponsors");
    if (sponsorDecision) {
      if (keepBtn) keepBtn.style.background = "linear-gradient(90deg, #e10600, #b00500)";
      if (newBtn) newBtn.style.background = "rgba(255,255,255,0.05)";
    } else {
      if (newBtn) newBtn.style.background = "linear-gradient(90deg, #e10600, #b00500)";
      if (keepBtn) keepBtn.style.background = "rgba(255,255,255,0.05)";
    }
  };

  const keepSponsorsBtn = root.querySelector("#keepSponsors");
  if (keepSponsorsBtn) {
    keepSponsorsBtn.onclick = () => {
      sponsorDecision = true;
      updateDecisionUI();
    };
  }

  const newSponsorsBtn = root.querySelector("#newSponsors");
  if (newSponsorsBtn) {
    newSponsorsBtn.onclick = () => {
      sponsorDecision = false;
      updateDecisionUI();
    };
  }

  updateDecisionUI();

  const keepLineupBtn = root.querySelector("#keepLineup");
  if (keepLineupBtn) keepLineupBtn.onclick = () => startNextSeason(root, sponsorDecision);
  
  const startSeasonBtn = root.querySelector("#startSeason");
  if (startSeasonBtn) startSeasonBtn.onclick = () => startNextSeason(root, sponsorDecision);

  root.querySelectorAll("[data-offseason-release]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      ensureTeamState(state.team);
      const driverName = button.dataset.offseasonRelease;
      removeDriverFromTeam(state.team, driverName);
      setTeamActiveDrivers(state.team, getTeamRoster(state.team).slice(0, 2).map(driver => driver.name));
      await syncGame();
      renderOffseason(root, `${driverName} has been released from the squad.`);
    }, { once: true });
  });

  root.querySelectorAll("[data-offseason-sign]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      ensureTeamState(state.team);

      const driver = drivers.find(entry => entry.name === button.dataset.offseasonSign);
      if (!driver || getTeamRoster(state.team).length >= 3) {
        renderOffseason(root, "Your roster is already full.");
        return;
      }

      const oldTeam = findAiTeamByDriver(driver.name);
      const moveCost = oldTeam ? getPoachCost(driver, oldTeam) : driver.salary;
      if (state.team.budget < moveCost) {
        renderOffseason(root, `You need $${moveCost}M to sign ${driver.name}.`);
        return;
      }

      if (oldTeam) {
        const poachChance = getPoachChance(driver, oldTeam);
        if (Math.random() > poachChance) {
          renderOffseason(root, `${driver.name} rejected the approach and chose to stay at ${oldTeam.name}.`);
          return;
        }

        removeDriverFromTeam(oldTeam, driver.name);
        fillAiSeat(oldTeam);
      }

      state.team.budget = parseFloat((state.team.budget - moveCost).toFixed(1));
      addDriverToTeam(state.team, driver);
      setTeamActiveDrivers(state.team, getTeamRoster(state.team).slice(0, 2).map(entry => entry.name));
      await syncGame();
      renderOffseason(
        root,
        oldTeam
          ? `${driver.name} has joined from ${oldTeam.name} for $${moveCost}M. Their former team signed a replacement from the talent pool.`
          : `${driver.name} has joined your team for $${moveCost}M.`
      );
    }, { once: true });
  });
}
