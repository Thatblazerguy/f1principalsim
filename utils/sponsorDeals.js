import { SPONSOR_SLOTS, sponsors } from "../data/sponsors.js";
import { hydrateSponsorContract } from "./financeSystem.js";

/**
 * Rotates the current season's sponsor offers.
 * Generates 3 random offers for EACH placement slot from the database.
 */
export function rotateSponsorOffers(appState) {
  const allSlots = ["Title", "Kit", "Sidepod", "Rear Wing", "Halo"];
  let seasonalOffers = [];

  allSlots.forEach(slotType => {
    const slotPool = sponsors.filter(s => s.slot === slotType);
    const shuffled = [...slotPool].sort(() => 0.5 - Math.random());
    seasonalOffers = seasonalOffers.concat(shuffled.slice(0, 3));
  });

  appState.sponsorOffers = seasonalOffers;
}

/**
 * Normalize per-slot sponsor map and migrate legacy single `team.sponsor` to title slot.
 */
export function ensureSponsorSlots(team) {
  if (!team) return;
  if (!team.sponsorSlots || typeof team.sponsorSlots !== "object") {
    team.sponsorSlots = {};
  }
  const legacy = team.sponsor;
  for (const { key } of SPONSOR_SLOTS) {
    if (!(key in team.sponsorSlots)) team.sponsorSlots[key] = null;
  }
  if (legacy && !team.sponsorSlots.title) {
    team.sponsorSlots.title = legacy;
  }
  for (const { key } of SPONSOR_SLOTS) {
    if (team.sponsorSlots[key]) {
      team.sponsorSlots[key] = hydrateSponsorContract(team.sponsorSlots[key], { team }, key);
    }
  }
  team.sponsor = team.sponsorSlots.title ?? null;
}

export function getTotalSponsorRaceBonus(team) {
  ensureSponsorSlots(team);
  let sum = 0;
  for (const slot of SPONSOR_SLOTS) {
    const s = team.sponsorSlots[slot.key];
    if (s && typeof (s.monthlyIncome ?? s.fee) === "number") sum += (s.monthlyIncome ?? s.fee);
  }
  return sum;
}

export function countActiveSponsorDeals(team) {
  ensureSponsorSlots(team);
  return SPONSOR_SLOTS.filter((slot) => team.sponsorSlots[slot.key]).length;
}

/**
 * @returns {{ signingBonusPaid: number, cleared: boolean }}
 */
export function assignSponsorToSlot(team, slotKey, sponsorId, sponsorsList, appState) {
  ensureSponsorSlots(team);
  const validKeys = new Set(SPONSOR_SLOTS.map((s) => s.key));
  if (!validKeys.has(slotKey)) return { signingBonusPaid: 0, cleared: false };

  if (!sponsorId) {
    team.sponsorSlots[slotKey] = null;
    team.sponsor = team.sponsorSlots.title ?? null;
    return { signingBonusPaid: 0, cleared: true };
  }

  const sponsor = sponsorsList.find((s) => s.id === sponsorId);
  if (!sponsor) {
    team.sponsorSlots[slotKey] = null;
    team.sponsor = team.sponsorSlots.title ?? null;
    return { signingBonusPaid: 0, cleared: true };
  }

  team.sponsorSlots[slotKey] = hydrateSponsorContract(sponsor, appState, slotKey);
  team.sponsor = team.sponsorSlots.title ?? null;

  let signingBonusPaid = 0;
  if (!appState.signedSponsors[sponsor.id]) {
    signingBonusPaid = sponsor.signingBonus ?? sponsor.bonus;
    team.budget += signingBonusPaid;
    appState.signedSponsors[sponsor.id] = true;
  }

  return { signingBonusPaid, cleared: false };
}
