import { sponsors, SPONSOR_SLOTS } from "../data/sponsors.js";
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
import {
  assignSponsorToSlot,
  countActiveSponsorDeals,
  ensureSponsorSlots,
  getTotalSponsorRaceBonus,
} from "../utils/sponsorDeals.js";
import { syncGame } from "../lib/supabaseApi.js";

import { rotateSponsorOffers } from "../utils/sponsorDeals.js";

function buildSlotSelect(slotKey, currentId) {
  const currentOffers = state.sponsorOffers || [];
  const options = [
    `<option value="">— Vacant —</option>`,
    ...currentOffers.map(
      (s) =>
        `<option value="${s.id}" ${currentId === s.id ? "selected" : ""}>${s.name} (${s.slot}) · +$${s.fee}M/race</option>`
    ),
  ];
  return `
    <label class="sponsor-slot-select-wrap">
      <span class="sr-only">Assign sponsor</span>
      <select class="sponsor-slot-select" data-slot-select="${slotKey}" aria-label="Sponsor for ${slotKey}">
        ${options.join("")}
      </select>
    </label>
  `;
}

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
            <p class="dashboard-subtitle">Create a team first before selecting sponsors.</p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  if (state.sponsorOffers.length === 0) {
    rotateSponsorOffers(state);
  }

  ensureSponsorSlots(state.team);
  const dealCount = countActiveSponsorDeals(state.team);
  const totalRace = getTotalSponsorRaceBonus(state.team);

  const slotsMarkup = SPONSOR_SLOTS.map(
    (slot) => `
      <div class="sponsor-slot-row glass">
        <div class="sponsor-slot-info">
          <p class="menu-card-kicker">${slot.label}</p>
          <p class="sponsor-slot-blurb">${slot.blurb}</p>
        </div>
        ${buildSlotSelect(slot.key, state.team.sponsorSlots[slot.key]?.id ?? "")}
      </div>
    `
  ).join("");

  root.innerHTML = `
    ${buildHubNav("sponsors")}
    <section class="market-panel">
      <div class="glass market-header">
        <div>
          <p class="dashboard-eyebrow">Commercial</p>
          <h2>Sponsors</h2>
          <p class="dashboard-subtitle">
            Fill each slot with a partner — title, kit, sidepods, and more. Signing bonuses pay once per brand; every filled slot adds to your per-race income.
          </p>
        </div>
        <div class="dashboard-overview">
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Budget</span>
            <strong>$${state.team.budget}M</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Active deals</span>
            <strong>${dealCount}/${SPONSOR_SLOTS.length}</strong>
          </div>
          <div class="dashboard-overview-item">
            <span class="dashboard-overview-label">Race payout (total)</span>
            <strong>$${totalRace}M</strong>
          </div>
        </div>
      </div>

      ${flashMessage ? `<p class="setup-error upgrade-flash">${flashMessage}</p>` : ""}

      <div class="sponsor-slots-panel">
        <h3 class="sponsor-slots-heading">Partner placements</h3>
        <p class="dashboard-subtitle sponsor-slots-sub">Each dropdown is independent — the same brand can appear in more than one slot if you wish. Signing bonuses apply the first time you onboard a brand anywhere on the car.</p>
        <div class="sponsor-slots-list">
          ${slotsMarkup}
        </div>
      </div>

      <h3 class="sponsor-catalog-heading">Seasonal Offers</h3>
      <p class="dashboard-subtitle">The board has presented these 3 commercial offers for this season. You can assign them to any compatible slot above.</p>
      <div class="market-grid">
        ${state.sponsorOffers
          .map(
            (sponsor) => `
              <article class="market-driver-card sponsor-catalog-card">
                <div class="market-driver-card-top">
                  <div>
                    <p class="menu-card-kicker">${sponsor.slot} Slot · ${sponsor.industry}</p>
                    <h3>${sponsor.name}</h3>
                    <p class="detail-card-meta">${sponsor.perk}</p>
                  </div>
                  <span class="detail-badge">${state.signedSponsors[sponsor.id] ? "Signed before" : "New brand"}</span>
                </div>
                <div class="detail-card-stats">
                  <div class="driver-detail-stat">
                    <span>Signing bonus (first time)</span>
                    <strong>$${sponsor.bonus}M</strong>
                  </div>
                  <div class="driver-detail-stat">
                    <span>Per race (per slot)</span>
                    <strong>$${sponsor.fee}M</strong>
                  </div>
                </div>
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

  root.querySelectorAll("[data-slot-select]").forEach((select) => {
    select.addEventListener("change", async () => {
      const slotKey = select.dataset.slotSelect;
      const sponsorId = select.value || null;
      const { signingBonusPaid, cleared } = assignSponsorToSlot(
        state.team,
        slotKey,
        sponsorId,
        state.sponsorOffers,
        state
      );

      let msg;
      if (cleared) {
        msg = `${SPONSOR_SLOTS.find((s) => s.key === slotKey)?.label || slotKey} cleared.`;
      } else if (signingBonusPaid > 0) {
        const sp = state.sponsorOffers.find((s) => s.id === sponsorId);
        msg = `${sp.name} added to ${SPONSOR_SLOTS.find((s) => s.key === slotKey)?.label || slotKey}. Signing bonus: $${signingBonusPaid}M.`;
      } else {
        const sp = state.sponsorOffers.find((s) => s.id === sponsorId);
        msg = `${sp.name} assigned to ${SPONSOR_SLOTS.find((s) => s.key === slotKey)?.label || slotKey}. (Signing bonus already paid for this brand.)`;
      }

      await syncGame();
      renderSponsors(root, msg);
    });
  });
}
