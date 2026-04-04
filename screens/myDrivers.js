import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderSponsors } from "./sponsors.js";
import { renderTeams } from "./teams.js";
import { state } from "../state.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";

const driverNumbers = {
  "Max Verstappen": 1,
  "Sergio Perez": 11,
  "Charles Leclerc": 16,
  "Carlos Sainz": 55,
  "Lewis Hamilton": 44,
  "George Russell": 63,
  "Lando Norris": 4,
  "Oscar Piastri": 81,
  "Fernando Alonso": 14,
  "Lance Stroll": 18,
  "Esteban Ocon": 31,
  "Pierre Gasly": 10,
  "Alex Albon": 23,
  "Logan Sargeant": 2,
  "Yuki Tsunoda": 22,
  "Daniel Ricciardo": 3,
  "Valtteri Bottas": 77,
  "Zhou Guanyu": 24,
  "Kevin Magnussen": 20,
  "Nico Hulkenberg": 27,
  "Mick Schumacher": 47,
  "Antonio Giovinazzi": 99,
  "Nyck de Vries": 21,
  "Andrea Kimi Antonelli": 12,
  "Oliver Bearman": 87,
  "Theo Pourchaire": 5,
  "Jack Doohan": 7,
  "Liam Lawson": 40,
  "Felipe Drugovich": 43,
};

function buildStat(label, value) {
  return `
    <div class="driver-detail-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function buildDriverCard(driver, role, isActive) {
  const points = state.standings.drivers[driver.name] ?? 0;
  const bestFinish = state.bestFinishes[driver.name] ? `P${state.bestFinishes[driver.name]}` : "--";
  const raceNumber = driverNumbers[driver.name] ?? "--";

  return `
    <article class="glass detail-card driver-card--yours">
      <div class="detail-card-top">
        <div>
          <p class="menu-card-kicker">${role} Driver</p>
          <h3>#${raceNumber} ${driver.name}</h3>
          <p class="detail-card-meta">${driver.category} driver • Age ${driver.age}</p>
        </div>
        <div class="detail-card-badges">
          <span class="detail-badge detail-badge-role">${isActive ? "Active" : role}</span>
          <span class="detail-badge">Pts ${points}</span>
          <span class="detail-badge">Best ${bestFinish}</span>
        </div>
      </div>

      <div class="detail-card-stats">
        ${buildStat("Pace", (driver.pace || 0).toFixed(1))}
        ${buildStat("Quali", (driver.quali || 0).toFixed(1))}
        ${buildStat("Racecraft", (driver.racecraft || 0).toFixed(1))}
        ${buildStat("Tyre Mgmt", (driver.tyre || 0).toFixed(1))}
        ${buildStat("Wet Weather", (driver.wet || 0).toFixed(1))}
        ${buildStat("Consistency", (driver.consistency || 0).toFixed(1))}
        ${buildStat("Market Value", (driver.market || 0).toFixed(1))}
        ${buildStat("Salary", `$${driver.salary}M`)}
      </div>

      <div class="driver-contract-actions">
        <button type="button" data-release="${driver.name}">Release Driver</button>
        ${
          role === "Main"
            ? `<button type="button" data-demote="${driver.name}" ${state.team.reserveDriver ? "disabled" : ""}>Move To Reserve</button>`
            : `<button type="button" data-promote="${driver.name}" ${state.team.drivers.length >= 2 ? "disabled" : ""}>Promote To Main</button>`
        }
      </div>
    </article>
  `;
}

function buildActiveDriversCard(team) {
  const roster = getTeamRoster(team);
  const active = getActiveDrivers(team);
  const slotOne = active[0]?.name ?? roster[0]?.name ?? "";
  const slotTwo = active[1]?.name ?? roster[1]?.name ?? roster.find(driver => driver.name !== slotOne)?.name ?? "";

  const buildOptions = selectedName =>
    roster
      .map(
        driver => `
          <option value="${driver.name}" ${driver.name === selectedName ? "selected" : ""}>
            ${driver.name}
          </option>
        `
      )
      .join("");

  return `
    <article class="glass detail-card active-drivers-card driver-card--yours">
      <div class="detail-card-top">
        <div>
          <p class="menu-card-kicker">Race Lineup</p>
          <h3>Active Drivers</h3>
          <p class="detail-card-meta">Choose the two drivers who will race every weekend until you change this lineup.</p>
        </div>
        <div class="detail-card-badges">
          <span class="detail-badge">${roster.length} Available</span>
          <span class="detail-badge">2 Racing Seats</span>
        </div>
      </div>

      <div class="active-driver-selectors">
        <label class="active-driver-slot">
          <span>Seat 1</span>
          <select id="activeSlot1">${buildOptions(slotOne)}</select>
        </label>
        <label class="active-driver-slot">
          <span>Seat 2</span>
          <select id="activeSlot2">${buildOptions(slotTwo)}</select>
        </label>
      </div>
    </article>
  `;
}

export function renderMyDrivers(root, notice = "") {
  ensureTeamState(state.team);
  const activeNames = new Set(getActiveDrivers(state.team).map(driver => driver.name));
  root.innerHTML = `
    ${buildHubNav("drivers")}
    <section class="my-drivers-page">
      <div class="glass my-drivers-header">
        <div>
          <p class="dashboard-eyebrow">Driver Lineup</p>
          <h2>My Drivers</h2>
          <p class="dashboard-subtitle">
            Track your current lineup with performance attributes, season points, and best race result.
          </p>
        </div>
        <button id="backToDashboard">Dashboard</button>
      </div>

      ${notice ? `<div class="glass upgrade-flash">${notice}</div>` : ""}

      <div class="my-drivers-grid">
        ${buildActiveDriversCard(state.team)}
        ${state.team.drivers.map(driver => buildDriverCard(driver, "Main", activeNames.has(driver.name))).join("")}
        ${state.team.reserveDriver ? buildDriverCard(state.team.reserveDriver, "Reserve", activeNames.has(state.team.reserveDriver.name)) : `
          <article class="glass detail-card">
            <div class="detail-card-top">
              <div>
                <p class="menu-card-kicker">Reserve Driver</p>
                <h3>Open Reserve Seat</h3>
                <p class="detail-card-meta">You can sign one additional reserve driver from the market.</p>
              </div>
            </div>
          </article>
        `}
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

  const backToDashboard = root.querySelector("#backToDashboard");
  if (backToDashboard) backToDashboard.onclick = () => renderDashboard(root);

  const slotOneSelect = root.querySelector("#activeSlot1");
  const slotTwoSelect = root.querySelector("#activeSlot2");

  const syncActiveLineup = async changedSlot => {
    let slotOne = slotOneSelect?.value ?? "";
    let slotTwo = slotTwoSelect?.value ?? "";

    if (!slotOne || !slotTwo) return;

    if (slotOne === slotTwo) {
      const fallback = getTeamRoster(state.team).find(driver => driver.name !== (changedSlot === 1 ? slotOne : slotTwo));
      if (fallback) {
        if (changedSlot === 1) {
          slotTwo = fallback.name;
        } else {
          slotOne = fallback.name;
        }
      }
    }

    const activeDrivers = setTeamActiveDrivers(state.team, [slotOne, slotTwo]);
    await syncGame();
    renderMyDrivers(root, `Active lineup updated: ${activeDrivers.map(driver => driver.name).join(" and ")}.`);
  };

  if (slotOneSelect) slotOneSelect.onchange = () => syncActiveLineup(1);
  if (slotTwoSelect) slotTwoSelect.onchange = () => syncActiveLineup(2);

  const page = root.querySelector(".my-drivers-page");
  page.onclick = async event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;

    const actionButton = target.closest("[data-release], [data-demote], [data-promote]");
    if (!actionButton) return;
    if (actionButton.hasAttribute("disabled")) return;

    event.preventDefault();
    event.stopPropagation();
    ensureTeamState(state.team);

    if (actionButton.dataset.release) {
      state.team.releaseDriver(actionButton.dataset.release);
      await syncGame();
      renderMyDrivers(root, `${actionButton.dataset.release} has been released from the team.`);
      return;
    }

    if (actionButton.dataset.demote) {
      const moved = state.team.demoteToReserve(actionButton.dataset.demote);
      if (moved) await syncGame();
      renderMyDrivers(
        root,
        moved
          ? `${actionButton.dataset.demote} has been moved to the reserve seat.`
          : "You already have a reserve driver, so this move cannot be made."
      );
      return;
    }

    if (actionButton.dataset.promote) {
      const promoted = state.team.promoteReserve();
      if (promoted) await syncGame();
      renderMyDrivers(
        root,
        promoted
          ? `${actionButton.dataset.promote} has been promoted into the main race lineup.`
          : "Your main lineup is already full, so the reserve driver cannot be promoted."
      );
    }
  };
}
