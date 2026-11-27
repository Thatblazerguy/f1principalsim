// Commercial department helpers for the Sponsors screen.
//
// Reads (never changes) the existing rules:
//   - team.sponsorSlots[slot] contracts built by financeSystem.hydrateSponsorContract
//   - "monthly income" is paid every race weekend (processRaceFinance → sponsorIncome)
//   - signing bonus is paid once per brand, ever (assignSponsorToSlot + state.signedSponsors)
//   - performance bonus is paid at season end: income × 5 + bonus × relationship% × 2 (offseason)
//   - sponsor objectives pay a reward when achieved and a penalty when missed (processRaceFinance)
//   - offers rotate randomly each offseason (rotateSponsorOffers)
//
// The one new mechanic is negotiation (the game had none). It is small, shown
// in full in the UI, and only ever writes the same contract fields the
// existing signing path writes.

import { SPONSOR_SLOTS, sponsors as CATALOGUE } from "../data/sponsors.js";
import { hydrateSponsorContract, ensureFinanceState } from "./financeSystem.js";
import { ensureSponsorSlots } from "./sponsorDeals.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round((v || 0) * 10) / 10;

export const SLOT_BY_PLACEMENT = Object.fromEntries(SPONSOR_SLOTS.map((s) => [s.placement, s.key]));
export const PLACEMENT_BY_SLOT = Object.fromEntries(SPONSOR_SLOTS.map((s) => [s.key, s.placement]));

/** Where each contract slot shows on the car. Kit is team apparel, not a car surface. */
export const SLOT_ZONES = {
  title: ["engineCover", "nose", "endplates"],
  sidepod: ["sidepods"],
  rearWing: ["rearWing"],
  halo: ["halo"],
  kit: [],
};
export const ZONE_LABELS = {
  engineCover: "Engine cover", nose: "Nose", endplates: "Rear wing endplates", sidepods: "Sidepods",
  rearWing: "Rear wing", halo: "Halo", frontWing: "Front wing",
};
export const ZONE_SLOT = Object.fromEntries(Object.entries(SLOT_ZONES).flatMap(([slot, zones]) => zones.map((z) => [z, slot])));

export const slotLabel = (key) => ({ title: "Title", kit: "Kit", sidepod: "Sidepod", rearWing: "Rear wing", halo: "Halo" }[key] || key);

/** Season-end payout the offseason pays for a contract (screens/offseason.tsx). */
export const seasonEndPayout = (c) => r1((c?.monthlyIncome || 0) * 5 + (c?.performanceBonus || 0) * ((c?.relationshipLevel ?? 100) / 100) * 2);

/** Value of an offer over its listed contract: bonus + per-race income × rounds + one season-end performance payout. */
export const offerValue = (o) => r1((o.signingBonus ?? o.bonus ?? 0) + (o.monthlyIncome ?? o.fee ?? 0) * (o.contractLength || 0) + (o.performanceBonus || 0) * ((o.relationshipLevel ?? 65) / 100) * 2);

export function getPortfolio(appState) {
  const team = appState.team;
  ensureSponsorSlots(team);
  const round = appState.season?.round || 1;
  return SPONSOR_SLOTS.map((slot) => {
    const c = team.sponsorSlots[slot.key];
    if (!c) return { key: slot.key, label: slotLabel(slot.key), placement: slot.placement, contract: null };
    const left = Math.max(0, (c.expiresRound ?? round) - round);
    return {
      key: slot.key, label: slotLabel(slot.key), placement: slot.placement, contract: c,
      roundsLeft: left,
      status: left <= 0 ? "Past term" : left <= 3 ? "Ending soon" : "Active",
      remainingValue: r1((c.monthlyIncome || 0) * left),
      payout: seasonEndPayout(c),
      objectivesOpen: (c.objectives || []).filter((o) => !o.complete && o.lastResult !== "Missed").length,
    };
  });
}

export function getCommercialOverview(appState) {
  const finance = ensureFinanceState(appState);
  const port = getPortfolio(appState);
  const active = port.filter((p) => p.contract);
  const perRace = r1(active.reduce((s, p) => s + (p.contract.monthlyIncome || 0), 0));
  const contractValue = r1(active.reduce((s, p) => s + p.remainingValue, 0));
  const relAvg = active.length ? Math.round(active.reduce((s, p) => s + (p.contract.relationshipLevel ?? 0), 0) / active.length) : null;
  const prestigeAvg = active.length ? Math.round(active.reduce((s, p) => s + (p.contract.brandPrestige ?? 0), 0) / active.length) : null;
  const year = appState.season?.year || 1;
  const reports = (finance.raceReports || []).filter((r) => (r.season ?? year) === year);
  const last = reports[reports.length - 1]; const prev = reports[reports.length - 2];
  const flows = finance.cashFlow || [];
  return {
    cash: appState.team?.budget ?? 0,
    filled: active.length, slots: port.length,
    perRace, contractValue, relAvg, prestigeAvg,
    reputation: finance.reputation, happiness: finance.sponsorHappiness,
    seasonEndPayout: r1(active.reduce((s, p) => s + p.payout, 0)),
    incomeTrend: last && prev ? r1((last.sponsorIncome || 0) - (prev.sponsorIncome || 0)) : null,
    cashTrend: flows.length ? flows[flows.length - 1].net : null,
    racesRun: reports.length,
  };
}

export function getRevenueAnalytics(appState) {
  const finance = ensureFinanceState(appState);
  const year = appState.season?.year || 1;
  const reports = (finance.raceReports || []).filter((r) => (r.season ?? year) === year);
  const timeline = reports.map((r) => ({
    round: r.round, name: r.raceName,
    sponsor: r.sponsorIncome || 0,
    other: Math.max(0, (r.raceIncome || 0) - (r.sponsorIncome || 0)) + (r.prizeMoney || 0) + (r.merchandiseSales || 0),
  }));
  const seasonSponsor = r1(timeline.reduce((s, t) => s + t.sponsor, 0));
  const seasonAll = r1(timeline.reduce((s, t) => s + t.sponsor + t.other, 0));
  const signed = Object.keys(appState.signedSponsors || {});
  const bonusLog = appState.sponsorBonusLog || {};
  const bonuses = r1(signed.reduce((s, id) => s + (bonusLog[id] ?? CATALOGUE.find((c) => c.id === id)?.signingBonus ?? 0), 0));
  const port = getPortfolio(appState).filter((p) => p.contract);
  const byPlacement = port.map((p) => ({ key: p.key, label: p.label, name: p.contract.name, perRace: p.contract.monthlyIncome || 0, payout: p.payout }))
    .sort((a, b) => b.perRace - a.perRace);
  const expiring = port.filter((p) => p.roundsLeft <= 6).sort((a, b) => a.roundsLeft - b.roundsLeft);
  return { timeline, seasonSponsor, seasonAll, bonuses, signedCount: signed.length, byPlacement, expiring };
}

export function getSponsorObjectives(appState) {
  const round = appState.season?.round || 1;
  const out = [];
  getPortfolio(appState).forEach((p) => (p.contract?.objectives || []).forEach((o) => out.push({
    ...o, sponsor: p.contract.name, slot: p.label,
    state: o.complete ? "Achieved" : o.lastResult === "Missed" ? "Missed" : round > o.deadline ? "Missed" : "Open",
    roundsLeft: Math.max(0, o.deadline - round),
  })));
  return out.sort((a, b) => (a.state === "Open" ? 0 : 1) - (b.state === "Open" ? 0 : 1) || a.deadline - b.deadline);
}

/** Portfolio milestones: progress tracking only, the game pays nothing for these. */
export function getMilestones(appState) {
  const ov = getCommercialOverview(appState);
  const title = appState.team?.sponsorSlots?.title;
  return [
    { id: "fill", label: "Fill every placement", progress: ov.filled / ov.slots, detail: `${ov.filled} of ${ov.slots} placements signed`, done: ov.filled === ov.slots },
    { id: "title", label: "Secure a title partner", progress: title ? 1 : 0, detail: title ? title.name : "Title placement vacant", done: !!title },
    { id: "rel", label: "Relationship at 70% or more", progress: Math.min(1, (ov.happiness || 0) / 70), detail: `Sponsor relationship ${ov.happiness}%`, done: ov.happiness >= 70 },
    { id: "prestige", label: "Average partner prestige 80+", progress: ov.prestigeAvg ? Math.min(1, ov.prestigeAvg / 80) : 0, detail: ov.prestigeAvg ? `Average ${ov.prestigeAvg}` : "No partners yet", done: (ov.prestigeAvg || 0) >= 80 },
  ];
}

// ─── Negotiation (new) ──────────────────────────────────────────────────────
/**
 * Leverage = commercial reputation against the brand's prestige. Asking above
 * the listed terms costs odds; moving the length more than 3 rounds from the
 * listing costs a little more. A miss within 25 points of the odds brings a
 * counter-offer halfway; two rejections suspend talks with that brand until
 * the next round. Renegotiating a live deal can only change income and length
 * (the signing bonus was paid at signing) and a rejection costs 3 relationship.
 */
export function negotiationOdds(appState, offer, terms, mode = "new") {
  const finance = ensureFinanceState(appState);
  const base = { bonus: offer.signingBonus ?? offer.bonus ?? 0, income: offer.monthlyIncome ?? offer.fee ?? 0, length: offer.contractLength || 12 };
  const prestige = offer.brandPrestige ?? 70;
  const leverage = (finance.reputation - prestige) / 100;
  const pBonus = mode === "new" && base.bonus ? terms.bonus / base.bonus - 1 : 0;
  const pIncome = base.income ? terms.income / base.income - 1 : 0;
  const premium = mode === "new" ? pBonus * 0.4 + pIncome * 0.6 : pIncome;
  const lenOff = Math.max(0, Math.abs(terms.length - base.length) - 3);
  const talks = appState.sponsorTalks?.[offer.id];
  const round = appState.season?.round || 1;
  const suspended = !!talks && talks.round === round && talks.rejections >= 2;
  const factors = [
    { text: `Reputation ${finance.reputation} against prestige ${prestige}`, effect: leverage >= 0 ? "for" : "against", value: Math.round(leverage * 60) },
  ];
  if (premium > 0.001) factors.push({ text: `Asking ${Math.round(premium * 100)}% over the listed terms`, effect: "against", value: -Math.round(premium * 300) });
  else factors.push({ text: "At or below the listed terms", effect: "for", value: 0 });
  if (lenOff) factors.push({ text: `Length ${lenOff} rounds outside what they listed`, effect: "against", value: -lenOff * 3 });
  if (suspended) return { odds: 0, suspended: true, base, premium, factors: [...factors, { text: "Talks suspended after two rejections. They reopen next round.", effect: "against", value: 0 }] };
  const odds = premium <= 0.001 && !lenOff ? 97 : clamp(Math.round(80 + leverage * 60 - premium * 300 - lenOff * 3), 3, 97);
  return { odds, suspended: false, base, premium, factors };
}

/** Writes a contract through the same hydrate path as assignSponsorToSlot, with negotiated terms. */
export function signWithTerms(appState, slotKey, offer, terms, { negotiated = true } = {}) {
  const team = appState.team;
  ensureSponsorSlots(team);
  const contract = hydrateSponsorContract({ ...offer, signingBonus: terms.bonus, monthlyIncome: terms.income, contractLength: terms.length, signedRound: undefined, expiresRound: undefined, objectives: undefined, negotiated }, appState, slotKey);
  team.sponsorSlots[slotKey] = contract;
  team.sponsor = team.sponsorSlots.title ?? null;
  appState.signedSponsors = appState.signedSponsors || {};
  let paid = 0;
  if (!appState.signedSponsors[offer.id]) {
    paid = terms.bonus;
    team.budget = r1((team.budget || 0) + paid);
    appState.signedSponsors[offer.id] = true;
    appState.sponsorBonusLog = { ...(appState.sponsorBonusLog || {}), [offer.id]: paid };
  }
  return { paid };
}

export function runNegotiation(appState, slotKey, offer, terms, mode = "new", roll = Math.random()) {
  const { odds, suspended, base } = negotiationOdds(appState, offer, terms, mode);
  const round = appState.season?.round || 1;
  appState.sponsorTalks = appState.sponsorTalks || {};
  if (suspended) return { outcome: "suspended", message: `${offer.name} has suspended talks until next round.` };
  if (roll * 100 < odds) {
    if (mode === "new") {
      const { paid } = signWithTerms(appState, slotKey, offer, terms);
      return { outcome: "accepted", message: `${offer.name} signed: $${terms.income}M a race for ${terms.length} rounds${paid ? `, $${terms.bonus}M signing bonus paid` : ", bonus already paid before"}.` };
    }
    const c = appState.team.sponsorSlots[slotKey];
    c.monthlyIncome = terms.income; c.contractLength = terms.length; c.expiresRound = round + terms.length; c.negotiated = true;
    return { outcome: "accepted", message: `${offer.name} agreed: $${terms.income}M a race, running to round ${c.expiresRound}.` };
  }
  const near = roll * 100 < odds + 25;
  if (near && (terms.income > base.income || terms.bonus > base.bonus)) {
    const mid = (a, b) => Math.round(((a + b) / 2) * 10) / 10;
    const counter = { bonus: mode === "new" ? mid(base.bonus, terms.bonus) : terms.bonus, income: mid(base.income, terms.income), length: base.length };
    return { outcome: "counter", counter, message: `${offer.name} came back with a counter-offer.` };
  }
  const t = appState.sponsorTalks[offer.id];
  const rejections = t && t.round === round ? t.rejections + 1 : 1;
  appState.sponsorTalks[offer.id] = { round, rejections };
  if (mode === "renegotiate") {
    const c = appState.team.sponsorSlots[slotKey];
    if (c) c.relationshipLevel = clamp((c.relationshipLevel ?? 60) - 3, 0, 100);
  }
  return rejections >= 2
    ? { outcome: "suspended", message: `${offer.name} rejected the offer again and suspended talks until next round.` }
    : { outcome: "rejected", message: `${offer.name} rejected the offer. One more rejection suspends talks this round.` };
}
