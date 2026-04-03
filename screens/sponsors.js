import { sponsors } from "../data/sponsors.js";
import { state } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.js";
import { renderMyDrivers } from "./myDrivers.js";
import { renderMarket } from "./market.js";
import { renderCalendar } from "./calendar.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderTeams } from "./teams.js";
import { buildHubNav, wireHubNav } from "./hubNav.js";
import { ensureTeamState } from "../utils/teamState.js";

export function renderSponsors(root, flashMessage = "") {
  ensureTeamState(state.team);
  if (!state.team) {
    root.innerHTML = `
      ${buildHubNav("sponsors")}
      <section class="market-panel">
        <div class="glass market-header">
          <div>
            <p class="dashboard-eyebrow">Commercial</p>
            <h2>Sponsors</h2>
            <p class="dashboard-subtitle">Create a team first before selecting a sponsor.</p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    ${buildHubNav("sponsors")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Commercial</p>
          <h2>Sponsors</h2>
          <p class="dashboard-subtitle">
            Choose a primary sponsor for a signing bonus now and guaranteed income after every race.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Current Budget</span>
            <strong>$${state.team.budget}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Active Sponsor</span>
            <strong>${state.team.sponsor ? state.team.sponsor.name : "None"}</strong>
          </div>
        </div>
      </div>

      ${flashMessage ? `<p class="setup-error upgrade-flash">${flashMessage}</p>` : ""}

      <div class="market-grid">
        ${sponsors
          .map(
            sponsor => `
              <article class="market-driver-card">
                <div class="market-driver-card-top">
                  <div>
                    <p class="menu-card-kicker">${sponsor.category}</p>
                    <h3>${sponsor.name}</h3>
                    <p class="detail-card-meta">${sponsor.description}</p>
                  </div>
                  <span class="detail-badge">${state.team.sponsor?.id === sponsor.id ? "Active" : "Offer"}</span>
                </div>

                <div class="detail-card-stats">
                  <div class="driver-detail-stat">
                    <span>Signing Bonus</span>
                    <strong>$${sponsor.signingBonus}M</strong>
                  </div>
                  <div class="driver-detail-stat">
                    <span>Per Race</span>
                    <strong>$${sponsor.raceBonus}M</strong>
                  </div>
                </div>

                <button data-sponsor="${sponsor.id}" class="market-sign-button">
                  ${state.team.sponsor?.id === sponsor.id ? "Selected Sponsor" : "Sign Sponsor"}
                </button>
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

  const marketGrid = root.querySelector(".market-grid");
  if (!marketGrid) return;

  marketGrid.onclick = event => {
    const button = event.target.closest("[data-sponsor]");
    if (!button) return;

    const sponsor = sponsors.find(entry => entry.id === button.dataset.sponsor);
    if (!sponsor) return;

    const alreadySigned = state.signedSponsors[sponsor.id];
    state.team.sponsor = sponsor;

    if (!alreadySigned) {
      state.team.budget += sponsor.signingBonus;
      state.signedSponsors[sponsor.id] = true;
      renderSponsors(root, `${sponsor.name} signed. You received a $${sponsor.signingBonus}M signing bonus.`);
      return;
    }

    renderSponsors(root, `${sponsor.name} is now your active sponsor. Future races pay $${sponsor.raceBonus}M.`);
  };
}
