/*
 * Academy engine: the junior driver ecosystem around state.academy.
 *
 * Builds on the existing academy data (game/academy.js prospect generator,
 * facilities, prospects, loanedOut, scouts) and adds:
 *   - a junior ladder (Karting → F4 → Formula Regional → F3 → F2, plus Super
 *     Formula and Indy NXT as loan series) with simulated championships that
 *     run on F1 race weekends, standings and Super Licence points
 *   - daily development: age curve, potential headroom, development rate,
 *     morale, facilities, training programmes and race experience
 *   - a scouting department (staff with attributes) whose knowledge of each
 *     driver sets how precise the shown estimates are
 *   - a prospect market that changes: discoveries, AI junior programmes
 *     signing and promoting drivers, departures and new karting talent
 *   - loans with terms and tracked results, promotion paths, objectives,
 *     an activity feed and a spending ledger
 *
 * Everything lives in state.academy, so it is saved and reloaded with the game.
 * Daily work runs from utils/seasonTimeline.js; season-end work from
 * game/development.js (once per season, guarded by academy.lastProcessedYear).
 */

import { generateAcademyProspect, REGIONS, getMaxAcademySize, getAcademyXPRequired, getFacilityUpgradeCost } from "./academy.js";
import { Driver } from "./driver.js";
import { overall, hash, prospects as poolProspects } from "./transferMarket.js";

/* ─── Constants ─────────────────────────────────────────────────────────── */

export const SERIES = {
  karting:      { id: "karting", label: "Karting", short: "Kart", tier: 0, field: 50, seatCost: 0.3, sl: [] },
  f4:           { id: "f4", label: "F4", short: "F4", tier: 1, field: 56, seatCost: 0.6, sl: [12, 10, 7, 5, 3, 2, 1] },
  fregional:    { id: "fregional", label: "Formula Regional", short: "FR", tier: 2, field: 61, seatCost: 1.0, sl: [25, 20, 15, 10, 8, 6, 4, 3, 2, 1] },
  f3:           { id: "f3", label: "F3", short: "F3", tier: 3, field: 66, seatCost: 1.6, sl: [30, 25, 20, 15, 12, 9, 7, 5, 3, 1] },
  f2:           { id: "f2", label: "F2", short: "F2", tier: 4, field: 73, seatCost: 2.4, sl: [40, 40, 40, 30, 20, 10, 8, 6, 4, 3] },
  superformula: { id: "superformula", label: "Super Formula", short: "SF", tier: 4, field: 71, seatCost: 2.0, sl: [25, 20, 15, 10, 8, 6, 4, 3, 2, 1], side: true },
  indynxt:      { id: "indynxt", label: "Indy NXT", short: "NXT", tier: 3, field: 67, seatCost: 1.4, sl: [15, 12, 10, 7, 5, 3, 2, 1], side: true },
};
export const LADDER = ["karting", "f4", "fregional", "f3", "f2"];
export const PIPELINE = [...LADDER, "reserve", "f1"];
export const PIPELINE_LABELS = { karting: "Karting", f4: "F4", fregional: "Formula Regional", f3: "F3", f2: "F2", reserve: "Reserve", f1: "F1 race seat" };
const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const FIELD_SIZE = 20;
const SL_REQUIRED = 40;
const JUNIOR_TEAMS = {
  karting: ["Kart Republic", "Tony Kart", "Birel ART", "CRG", "Sodikart"],
  f4: ["Prema", "Van Amersfoort", "US Racing", "R-ace GP", "Jenzer", "Hitech"],
  fregional: ["Prema", "ART", "R-ace GP", "Van Amersfoort", "MP Motorsport", "KIC"],
  f3: ["Prema", "ART", "Hitech", "Trident", "MP Motorsport", "Campos", "Rodin", "Van Amersfoort", "AIX", "DAMS"],
  f2: ["Prema", "ART", "Hitech", "Invicta", "Campos", "DAMS", "MP Motorsport", "Rodin", "Trident", "AIX", "Van Amersfoort"],
  superformula: ["Team Impul", "Team Mugen", "Dandelion", "Kondo", "TOM'S"],
  indynxt: ["Andretti", "HMD", "Cape", "Abel", "Chip Ganassi"],
};

export const FACILITIES = {
  simulator:        { label: "Simulator", effect: "Qualifying and pace programmes; one-lap preparation" },
  fitness:          { label: "Human performance", effect: "Physical conditioning; softens the morale cost of intense workloads" },
  coaching:         { label: "Driver coaching", effect: "Coaching staff quality: every programme" },
  sportsPsychology: { label: "Sports psychology", effect: "Mental and consistency programmes; steadier morale" },
  dataCentre:       { label: "Data analysis centre", effect: "Qualifying, consistency and tyre programmes; sharper scouting estimates" },
  karting:          { label: "Karting programme", effect: "Faster growth for drivers aged 17 and under; karting discoveries" },
  racePrep:         { label: "Race preparation", effect: "Junior race-weekend performance; racecraft programme" },
  technical:        { label: "Technical training", effect: "Tyre management programme and adaptability" },
};
const FACILITY_MAX = 5;
/** Benefit of a facility level, diminishing: 0 at level 1, 0.3, 0.51, 0.66, 0.76 at level 5. */
export const facilityBenefit = (level) => 1 - Math.pow(0.7, Math.max(0, (level || 1) - 1));
/** Highest facility level the academy level allows. */
export const facilityCap = (academyLevel) => Math.min(FACILITY_MAX, 1 + Math.ceil((academyLevel || 1) / 2));

export const PROGRAMMES = {
  qualifying: { label: "Qualifying development", days: 42, cost: 0.4, targets: { quali: 0.7, pace: 0.3 }, slows: ["tyre", "consistency"], facilities: ["simulator", "dataCentre"],
    summary: "One-lap pace and qualifying", tradeoff: "Little race-distance work: tyre management and consistency grow slower while it runs" },
  racecraft: { label: "Racecraft development", days: 56, cost: 0.5, targets: { racecraft: 0.7, adaptability: 0.3 }, slows: ["quali"], facilities: ["coaching", "racePrep"],
    summary: "Overtaking, defending and wheel-to-wheel racing", tradeoff: "Track time goes to race runs: qualifying grows slower", moraleDay: -0.02 },
  consistency: { label: "Consistency programme", days: 56, cost: 0.4, targets: { consistency: 0.8, mentality: 0.2 }, slows: ["pace"], facilities: ["dataCentre", "sportsPsychology"],
    summary: "Fewer mistakes, steadier laps", tradeoff: "Raw pace grows slower while it runs" },
  tyre: { label: "Tyre management", days: 42, cost: 0.35, targets: { tyre: 0.75, consistency: 0.25 }, slows: ["quali"], facilities: ["technical", "dataCentre"],
    summary: "Tyre preservation and race-distance pace", tradeoff: "Little one-lap work: qualifying grows slower" },
  physical: { label: "Physical conditioning", days: 35, cost: 0.3, targets: { fitness: 0.8, consistency: 0.2 }, slows: [], facilities: ["fitness"],
    summary: "Fitness and stamina", tradeoff: "Hard sessions: extra morale cost on an intense workload" },
  mental: { label: "Mental performance", days: 35, cost: 0.3, targets: { mentality: 0.8, consistency: 0.2 }, slows: ["pace", "racecraft"], facilities: ["sportsPsychology"],
    summary: "Composure under pressure; lifts morale", tradeoff: "Fewer track hours: pace and racecraft grow slower", moraleDay: 0.08 },
};
export const WORKLOADS = {
  light:   { label: "Light", mult: 0.75, costMult: 0.8, moraleDay: 0.03 },
  normal:  { label: "Normal", mult: 1.0, costMult: 1.0, moraleDay: 0 },
  intense: { label: "Intense", mult: 1.3, costMult: 1.3, moraleDay: -0.12 },
};

export const SCOUT_REGIONS = {
  europe: { label: "Europe", region: "europe", dayCost: 0.008 },
  americas: { label: "Americas", regions: ["northAmerica", "southAmerica"], dayCost: 0.012 },
  asiaPacific: { label: "Asia-Pacific", regions: ["asia", "oceania"], dayCost: 0.012 },
  africaMiddleEast: { label: "Africa and the Middle East", region: "africa", dayCost: 0.012 },
};
export const ASSIGNMENTS = {
  discover: { label: "Discover talent", summary: "Find new drivers in a region" },
  monitor: { label: "Monitor a driver", summary: "Slowly builds knowledge, up to a solid read", dayCost: 0.004 },
  evaluate: { label: "Full evaluation", summary: "Intensive study ending in a detailed report", cost: 0.25 },
};

export const OBJECTIVES = [
  { id: "sign3", label: "Sign three high-potential prospects", detail: "Prospects with potential 80 or higher", target: 3, reward: { rep: 5, xp: 40 } },
  { id: "ovr80", label: "Develop a prospect to an overall rating of 80", detail: "Signed below 80, developed to 80 in the academy", target: 1, reward: { xp: 60, devBonus: 60 } },
  { id: "f2", label: "Graduate an academy driver into F2", detail: "Move a driver up to F2", target: 1, reward: { rep: 6, xp: 50 } },
  { id: "title", label: "Win a junior championship", detail: "Any series, as an academy or loan driver", target: 1, reward: { rep: 8, xp: 80 } },
  { id: "facilities3", label: "Bring every facility to level 3", detail: "All eight academy facilities", target: 8, reward: { rep: 4, xp: 40 } },
  { id: "reserve", label: "Promote an academy graduate to reserve driver", detail: "Through the academy pathway", target: 1, reward: { xp: 60, teamRep: 3 } },
  { id: "f1", label: "Produce an F1 race driver", detail: "An academy graduate in a race seat", target: 1, reward: { rep: 12, xp: 120, teamRep: 5 } },
];

/* ─── Small helpers ─────────────────────────────────────────────────────── */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round((v || 0) * 10) / 10;
const r2 = (v) => Math.round((v || 0) * 100) / 100;
const seeded = (key) => (hash(key) % 10000) / 10000;
const yearOf = (state) => state.season?.year || 1;
const dayOf = (state) => state.season?.currentDay || 1;
const seasonDays = (state) => (state.season?.totalRounds || 24) * 14;
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const CORE = ["pace", "quali", "racecraft", "consistency", "tyre", "wet"];
const EXTRA = ["adaptability", "mentality", "fitness"];
export const ATTRIBUTE_LABELS = {
  pace: "Pace", quali: "Qualifying", racecraft: "Racecraft", consistency: "Consistency", tyre: "Tyre management",
  wet: "Wet weather", adaptability: "Adaptability", mentality: "Mentality", fitness: "Fitness",
};
export const PROFILE_ATTRS = ["pace", "quali", "racecraft", "consistency", "tyre", "wet", "adaptability", "mentality", "fitness"];
export const ovr = (d) => overall(d);
export const potential = (d) => Math.max(ovr(d), Math.round(d?.potentialCeiling ?? ovr(d) + 3));

/** Make a saved plain object a Driver again (methods are needed once it joins a team). */
export function asDriver(d) {
  if (d && !(d instanceof Driver)) Object.setPrototypeOf(d, Driver.prototype);
  return d;
}

/* ─── State ─────────────────────────────────────────────────────────────── */

export function ensureAcademy(state) {
  if (!state.academy) state.academy = { level: 1, reputation: 1, budget: 0, facilities: {}, prospects: [], scouts: [], loanedOut: [] };
  const ac = state.academy;
  ac.facilities = ac.facilities || {};
  Object.keys(FACILITIES).forEach((k) => { if (!ac.facilities[k]) ac.facilities[k] = 1; });
  ["prospects", "scouts", "loanedOut", "market", "scoutStaff", "news", "ledger", "loanReviews", "seatPlans", "shortlist", "reports"].forEach((k) => { if (!Array.isArray(ac[k])) ac[k] = []; });
  ac.knowledge = ac.knowledge || {};
  ac.juniors = ac.juniors || {};
  ac.aiJuniors = ac.aiJuniors || {};
  ac.objectives = ac.objectives || {};
  ac.stats = ac.stats || { signedHighPot: 0, graduates: 0, titles: 0, reserves: 0, raceSeats: 0, f2Graduates: 0, programmesDone: 0 };
  ac.xp = ac.xp ?? 0;
  ac.repScore = ac.repScore ?? clamp((ac.reputation || 1) * 18, 10, 100);
  ac.budget = Number(ac.budget) || 0;
  if (ac.devModel !== 2) migrate(state, ac);
  return ac;
}

function migrate(state, ac) {
  ac.devModel = 2;
  const day = dayOf(state);
  [...ac.prospects, ...ac.loanedOut].forEach((d) => {
    prepDriver(d, state);
    ac.knowledge[d.name] = { k: 100, acc: 90 };
  });
  ac.loanedOut.forEach((d) => {
    if (d.loanStatus) Object.assign(d.loanStatus, { team: d.loanStatus.team || pick(JUNIOR_TEAMS[d.loanStatus.destination] || JUNIOR_TEAMS.f3), endYear: d.loanStatus.endYear ?? d.loanStatus.seasonYear, startYear: d.loanStatus.startYear ?? d.loanStatus.seasonYear, contribution: d.loanStatus.contribution ?? 0, recallClause: d.loanStatus.recallClause ?? true, objectives: d.loanStatus.objectives || [], startOvr: d.loanStatus.startOvr ?? ovr(d) });
    d.series = d.loanStatus?.destination || d.series;
  });
  // Completed scouting assignments from the old system become known prospects
  ac.scouts.forEach((s) => {
    if (s.complete && !s.signed && !s.dismissed && s.prospect && !ac.market.some((m) => m.name === s.prospect.name)) {
      prepDriver(s.prospect, state);
      ac.market.push(s.prospect);
      ac.knowledge[s.prospect.name] = { k: 85, acc: 70 };
      s.dismissed = true;
    }
  });
  if (!ac.scoutStaff.length) ac.scoutStaff = [makeScout("seed-a", 62), makeScout("seed-b", 48)];
  if (ac.market.length < 14) for (let i = ac.market.length; i < 16; i++) addMarketProspect(state, null, { k: 0 });
  // AI junior programmes start with a junior or two each
  (state.aiTeams || []).forEach((t) => {
    if (!ac.aiJuniors[t.name]) ac.aiJuniors[t.name] = [];
    const n = 1 + (hash(t.name) % 2);
    while (ac.aiJuniors[t.name].length < n) {
      const d = newProspect(state, pick(Object.keys(REGIONS)), 2, "advanced");
      d.aiTeam = t.name;
      ac.aiJuniors[t.name].push(d);
    }
  });
  pushNews(state, "system", "The academy department opened its development, scouting and loans operations.", null, day);
}

const DEMONYM = {
  British: "GB", French: "FR", German: "DE", Italian: "IT", Spanish: "ES", Dutch: "NL", Finnish: "FI", Danish: "DK", Swedish: "SE", Austrian: "AT",
  Belgian: "BE", Polish: "PL", Czech: "CZ", Swiss: "CH", Brazilian: "BR", Argentine: "AR", Colombian: "CO", Chilean: "CL", Uruguayan: "UY",
  Venezuelan: "VE", American: "US", Canadian: "CA", Mexican: "MX", Japanese: "JP", Chinese: "CN", "South Korean": "KR", Indian: "IN", Thai: "TH",
  Singaporean: "SG", Australian: "AU", "New Zealander": "NZ", "South African": "ZA", Nigerian: "NG", Kenyan: "KE", Moroccan: "MA", Egyptian: "EG", Algerian: "DZ",
};

/** Fill the fields the engine relies on. */
function prepDriver(d, state) {
  if (!d) return d;
  if (!d.countryCode && d.nationality && DEMONYM[d.nationality]) d.countryCode = DEMONYM[d.nationality];
  d.devXP = d.devXP || {};
  d.ratingHistory = d.ratingHistory || [{ day: dayOf(state), year: yearOf(state), ovr: ovr(d) }];
  d.series = d.series || seriesForRating(ovr(d), d.age);
  d.juniorTeam = d.juniorTeam || pick(JUNIOR_TEAMS[d.series] || JUNIOR_TEAMS.f4);
  d.raceExp = d.raceExp || 0;
  d.slHistory = d.slHistory || [];
  d.juniorHistory = d.juniorHistory || [];
  d.programmeCount = d.programmeCount || {};
  d.careerTimeline = d.careerTimeline || [];
  if (d.morale == null) d.morale = 70;
  if (d.fitness == null) d.fitness = 70;
  if (d.mentality == null) d.mentality = 65;
  if (d.adaptability == null) d.adaptability = 65;
  return d;
}

export function seriesForRating(o, age) {
  if ((age ?? 18) <= 15 || o < 52) return "karting";
  if (o < 58) return "f4";
  if (o < 63) return "fregional";
  if (o < 69) return "f3";
  return "f2";
}

function allNames(state) {
  const ac = state.academy || {};
  const s = new Set();
  [...(ac.prospects || []), ...(ac.loanedOut || []), ...(ac.market || [])].forEach((d) => s.add(d.name));
  Object.values(ac.aiJuniors || {}).flat().forEach((d) => s.add(d.name));
  [state.team, ...(state.aiTeams || [])].filter(Boolean).forEach((t) => { (t.drivers || []).forEach((d) => s.add(d.name)); if (t.reserveDriver) s.add(t.reserveDriver.name); });
  return s;
}

function newProspect(state, regionKey, level, tier, ageRange) {
  const taken = allNames(state);
  let d = null;
  for (let i = 0; i < 12; i++) {
    d = generateAcademyProspect(regionKey, level, tier);
    if (!taken.has(d.name)) break;
  }
  if (ageRange) d.age = ageRange[0] + Math.floor(Math.random() * (ageRange[1] - ageRange[0] + 1));
  d.roleLabel = "Junior driver";
  d.driverRole = null;
  d.contractType = "none";
  d.joinedDay = dayOf(state);
  return prepDriver(d, state);
}

function addMarketProspect(state, regionKey, { k = 0, level = state.academy?.level || 1, tier = null, ageRange = null } = {}) {
  const ac = state.academy;
  const region = regionKey || pick(Object.keys(REGIONS));
  const t = tier || (Math.random() < 0.15 ? "elite" : Math.random() < 0.45 ? "advanced" : "basic");
  const d = newProspect(state, region, level, t, ageRange);
  ac.market.push(d);
  if (k) ac.knowledge[d.name] = { k, acc: 50 };
  return d;
}

/* ─── News and ledger ───────────────────────────────────────────────────── */

export function pushNews(state, type, text, driver = null, day = dayOf(state)) {
  const ac = state.academy;
  ac.news.unshift({ id: `${day}-${ac.news.length}-${hash(text) % 997}`, day, year: yearOf(state), type, text, driver });
  if (ac.news.length > 120) ac.news.length = 120;
}

const LEDGER_CATS = ["allocation", "recruitment", "scouts", "training", "facilities", "salaries", "seats", "loans", "transfers"];
export const LEDGER_LABELS = { allocation: "Funding from the team", recruitment: "Recruitment", scouts: "Scouting and scout salaries", training: "Training programmes", facilities: "Facility upgrades", salaries: "Driver salaries", seats: "Junior race seats", loans: "Loan contributions", transfers: "Transfer fees received" };

function record(state, cat, amount, note) {
  const ac = state.academy;
  ac.ledger.unshift({ day: dayOf(state), year: yearOf(state), cat, amount: r2(amount), note });
  if (ac.ledger.length > 400) ac.ledger.length = 400;
}

/** Spend from the academy budget; refuses when it would go below zero. */
function spend(state, amount, cat, note) {
  const ac = state.academy;
  amount = r2(amount);
  if (amount <= 0) return { ok: true };
  if (ac.budget + 1e-9 < amount) return { ok: false, text: `Needs $${amount.toFixed(2)}M; the academy has $${ac.budget.toFixed(2)}M.` };
  ac.budget = r2(ac.budget - amount);
  record(state, cat, -amount, note);
  return { ok: true };
}

/** Move money from the team budget into the academy. */
export function allocateFunds(state, amount) {
  ensureAcademy(state);
  amount = r1(amount);
  if (!(amount > 0)) return { ok: false, text: "Choose an amount." };
  if ((state.team?.budget || 0) < amount) return { ok: false, text: `The team budget has $${r1(state.team?.budget)}M.` };
  state.team.budget = r1(state.team.budget - amount);
  state.academy.budget = r2(state.academy.budget + amount);
  record(state, "allocation", amount, "Transfer from the team budget");
  return { ok: true, text: `$${amount}M moved into the academy budget.` };
}

export function financeSummary(state, year = yearOf(state)) {
  const ac = ensureAcademy(state);
  const by = Object.fromEntries(LEDGER_CATS.map((c) => [c, 0]));
  ac.ledger.filter((e) => e.year === year).forEach((e) => { by[e.cat] = r2((by[e.cat] || 0) + e.amount); });
  const spent = r2(Object.entries(by).filter(([c]) => c !== "allocation" && c !== "transfers").reduce((s, [, v]) => s + Math.min(0, v), 0));
  const commitments = seasonCommitments(state);
  return { by, spent: -spent, funded: by.allocation, commitments };
}

/** Running costs per season at the current squad, staff and loans. */
export function seasonCommitments(state) {
  const ac = state.academy;
  const salaries = ac.prospects.reduce((s, d) => s + juniorSalary(d), 0) + ac.loanedOut.reduce((s, d) => s + juniorSalary(d), 0);
  const seats = ac.prospects.reduce((s, d) => s + (SERIES[d.series]?.seatCost || 0), 0);
  const scouts = ac.scoutStaff.reduce((s, x) => s + x.salary, 0);
  const loans = ac.loanedOut.reduce((s, d) => s + (d.loanStatus?.contribution || 0), 0);
  return { salaries: r2(salaries), seats: r2(seats), scouts: r2(scouts), loans: r2(loans), total: r2(salaries + seats + scouts - loans) };
}

/* ─── Money values for juniors ──────────────────────────────────────────── */

const SERIES_VALUE = { karting: 0.6, f4: 0.8, fregional: 0.9, f3: 1.0, indynxt: 1.0, f2: 1.3, superformula: 1.15 };
/** Junior market value in $M. */
export function juniorValue(d) {
  const o = ovr(d); const p = potential(d);
  const ageF = d.age <= 18 ? 1.1 : d.age <= 21 ? 1.0 : d.age <= 23 ? 0.85 : 0.6;
  const results = (d.juniorStats?.wins || 0) * 0.05 + (d.juniorHistory || []).filter((h) => h.pos === 1).length * 0.4;
  return r2(Math.max(0.15, (0.2 + Math.max(0, p - 60) * 0.07 + Math.max(0, o - 55) * 0.04 + results) * ageF * (SERIES_VALUE[d.series] || 1)));
}
export const juniorSalary = (d) => r2(d.academySalary ?? Math.max(0.1, juniorValue(d) * 0.25));
export const signingFee = (d) => r2(Math.max(0.2, juniorValue(d) * 0.4));

/* ─── Knowledge and estimates ───────────────────────────────────────────── */

export const knowledgeOf = (state, name) => state.academy?.knowledge?.[name] || { k: 0, acc: 50 };
const isOurs = (state, name) => (state.academy?.prospects || []).some((d) => d.name === name) || (state.academy?.loanedOut || []).some((d) => d.name === name);

/** An estimate of a hidden value: exact for our own drivers, a range otherwise. */
export function estimate(state, d, key, value) {
  const kn = isOurs(state, d.name) ? { k: 100, acc: 100 } : knowledgeOf(state, d.name);
  const dataC = facilityBenefit(state.academy?.facilities?.dataCentre);
  const spread = key === "potential" ? 1.7 : 1;
  const width = Math.round(Math.max(0, ((100 - kn.k) / 100) * 16 * (1.35 - kn.acc / 100 - dataC * 0.25)) * spread);
  if (kn.k < 1) return { known: false, low: null, high: null, mid: null, exact: false, text: "?" };
  if (width <= 0) return { known: true, low: value, high: value, mid: value, exact: true, text: String(value) };
  const bias = (seeded(`${d.name}:${key}:${Math.floor(kn.k / 20)}`) - 0.5) * width * 0.8;
  const mid = Math.round(value + bias);
  const low = clamp(mid - Math.ceil(width / 2), 20, 99); const high = clamp(mid + Math.ceil(width / 2), 20, 99);
  return { known: true, low, high, mid, exact: false, text: `${low}–${high}` };
}

export function interestIn(state, d) {
  const ac = state.academy;
  if (isOurs(state, d.name)) return 100;
  const s = SERIES[d.series] || SERIES.f4;
  const base = 50 + (ac.repScore - 50) * 0.55 + ((ac.level || 1) - 1) * 3 - s.tier * 4 + (seeded(`int:${d.name}`) - 0.5) * 34;
  const picky = potential(d) >= 85 ? -8 : 0;
  const seatless = d.poolDriver ? 15 : 0; // F2 drivers without a team want any route towards F1
  const morale = ((d.morale ?? 70) - 70) * 0.15;
  return clamp(Math.round(base + picky + morale + seatless), 0, 100);
}
export const difficultyOf = (i) => (i >= 70 ? "Easy" : i >= 50 ? "Moderate" : i >= 30 ? "Hard" : "Very hard");

export function scoutStatus(state, d) {
  if (d.aiTeam) return { id: "contracted", label: `Contracted · ${d.aiTeam} juniors` };
  const kn = knowledgeOf(state, d.name);
  const i = interestIn(state, d);
  if (kn.k >= 30 && i < 30) return { id: "notInterested", label: "Not interested" };
  if (kn.k <= 0) return { id: "unscouted", label: "Unscouted" };
  if (kn.k < 30) return { id: "initial", label: "Initial observation" };
  if (kn.k < 70) return { id: "evaluating", label: "Under evaluation" };
  const pot = estimate(state, d, "potential", potential(d));
  return pot.mid >= 82 ? { id: "recommended", label: "Highly recommended" } : { id: "available", label: "Available to sign" };
}

/* ─── Trajectory ────────────────────────────────────────────────────────── */

export function trajectory(d) {
  const h = d.ratingHistory || [];
  if (h.length < 2) return { id: "normal", label: "Progressing normally", perSeason: 0 };
  const last = h[h.length - 1]; const ref = h.find((x) => last.day - x.day + (last.year - x.year) * 400 <= 120) || h[0];
  const days = Math.max(1, (last.year - ref.year) * 336 + (last.day - ref.day));
  const perSeason = ((last.ovr - ref.ovr) / days) * 336;
  if (perSeason >= 4) return { id: "rapid", label: "Improving rapidly", perSeason: r1(perSeason) };
  if (perSeason >= 1.2) return { id: "normal", label: "Progressing normally", perSeason: r1(perSeason) };
  if (perSeason > -0.8) return { id: "stagnant", label: "Stagnating", perSeason: r1(perSeason) };
  return { id: "declining", label: "Declining", perSeason: r1(perSeason) };
}

/* ─── Development ───────────────────────────────────────────────────────── */

function ageFactor(age) {
  if (age <= 17) return 1.15; if (age <= 19) return 1.05; if (age <= 21) return 0.9; if (age <= 23) return 0.62; if (age <= 25) return 0.38; return 0.18;
}

/** Programme effectiveness (1.0 = baseline) for a driver at today's facilities and morale. */
export function programmeEffectiveness(state, d, progId, workload = "normal") {
  const ac = state.academy; const p = PROGRAMMES[progId];
  const fac = p.facilities.reduce((s, f) => s + facilityBenefit(ac.facilities[f]), 0) / p.facilities.length;
  const coach = facilityBenefit(ac.facilities.coaching);
  const head = potential(d) - ovr(d);
  const headF = clamp(head / (head + 6), 0.15, 1) / 0.6;
  const moraleF = 0.7 + ((d.morale ?? 70) / 100) * 0.45;
  const repeat = Math.pow(0.8, d.programmeCount?.[progId] || 0);
  const bonus = (ac.devBonusUntil || 0) > absDay(state) ? 1.1 : 1;
  const e = (0.75 + fac * 0.45 + coach * 0.25) * ageFactor(d.age) * headF * moraleF * WORKLOADS[workload].mult * repeat * bonus;
  return r2(clamp(e, 0.1, 2.2));
}
const absDay = (state) => yearOf(state) * 1000 + dayOf(state);

function canRaise(d, attr) {
  if (CORE.includes(attr)) return d[attr] < Math.min(99, potential(d) + 3) && ovr(d) < potential(d);
  return (d[attr] ?? 60) < 95;
}
/** Add development progress to an attribute; whole points apply when reached. Returns points gained. */
function grow(d, attr, amount, state, ours) {
  if (amount <= 0) return 0;
  d.devXP[attr] = (d.devXP[attr] || 0) + amount;
  let gained = 0;
  while (d.devXP[attr] >= 1) {
    d.devXP[attr] -= 1;
    if (!canRaise(d, attr)) { d.devXP[attr] = 0; break; }
    const before = d[attr] ?? 60;
    d[attr] = before + 1; gained++;
    if (ours && Math.floor(d[attr] / 5) > Math.floor(before / 5) && d[attr] >= 60) {
      pushNews(state, "development", `${d.name} improved their ${ATTRIBUTE_LABELS[attr].toLowerCase()} to ${d[attr]}.`, d.name);
    }
  }
  return gained;
}

/** One day of development for a driver. `ctx` describes where they are. */
function developDay(state, d, ctx) {
  const ac = state.academy;
  const head = potential(d) - ovr(d);
  const headF = clamp(head / (head + 6), 0, 1);
  if (headF <= 0 && !d.programme) return;
  const devRate = clamp((d.developmentRate ?? 70) / 75, 0.5, 1.35);
  const moraleF = 0.7 + ((d.morale ?? 70) / 100) * 0.45;
  const traits = clamp(((d.hiddenTraits?.workEthic ?? 60) + (d.hiddenTraits?.professionalism ?? 60)) / 130, 0.6, 1.3);
  let envF;
  if (ctx === "academy") {
    const avg = Object.keys(FACILITIES).reduce((s, k) => s + facilityBenefit(ac.facilities[k]), 0) / Object.keys(FACILITIES).length;
    envF = 0.9 + avg * 0.45 + (d.age <= 17 ? facilityBenefit(ac.facilities.karting) * 0.25 : 0);
    if ((ac.devBonusUntil || 0) > absDay(state)) envF *= 1.1;
  } else if (ctx === "loan") envF = 0.9 + (SERIES[d.series]?.tier || 2) * 0.06;
  else if (ctx === "ai") envF = 0.95;
  else envF = 0.7; // unattached juniors in the market
  const daily = 0.085 * ageFactor(d.age) * headF * devRate * moraleF * traits * envF;

  const prog = ctx === "academy" ? d.programme : null;
  if (prog) {
    const p = PROGRAMMES[prog.id];
    const eff = programmeEffectiveness(state, d, prog.id, prog.workload);
    const focus = 0.11 * eff;
    Object.entries(p.targets).forEach(([attr, w]) => grow(d, attr, focus * w, state, true));
    const general = daily * 0.45;
    CORE.forEach((attr) => { if (!p.slows.includes(attr) && !(attr in p.targets)) grow(d, attr, general / CORE.length * weightLow(d, attr), state, true); });
    let mDay = WORKLOADS[prog.workload].moraleDay + (p.moraleDay || 0);
    if (prog.workload === "intense") mDay *= 1 - facilityBenefit(ac.facilities.fitness) * 0.6;
    d.morale = clamp((d.morale ?? 70) + mDay, 0, 100);
    prog.progress = r2((prog.progress || 0) + 1);
    if (prog.progress >= prog.days) finishProgramme(state, d);
  } else {
    CORE.forEach((attr) => grow(d, attr, (daily / CORE.length) * weightLow(d, attr), state, ctx === "academy" || ctx === "loan"));
    grow(d, pick(EXTRA), daily * 0.25, state, false);
  }

  // Morale drift: towards 70, faster with sports psychology
  const psy = ctx === "academy" ? facilityBenefit(ac.facilities.sportsPsychology) : 0;
  const before = d.morale ?? 70;
  d.morale = clamp(before + (70 - before) * (0.004 + psy * 0.006), 0, 100);
  if ((ctx === "academy" || ctx === "loan") && before >= 40 && d.morale < 40) pushNews(state, "morale", `${d.name}'s morale has dropped below 40.`, d.name);
  // Low morale slowly costs consistency
  if ((d.morale ?? 70) < 30 && Math.random() < 0.012 && d.consistency > 40) d.consistency--;
}
/** Weight towards the attributes furthest below the driver's average. */
function weightLow(d, attr) {
  const avg = CORE.reduce((s, k) => s + (d[k] || 60), 0) / CORE.length;
  return clamp(1 + (avg - (d[attr] || 60)) / 12, 0.4, 1.8);
}

function snapshotRating(state, d) {
  const h = d.ratingHistory || (d.ratingHistory = []);
  const o = ovr(d); const last = h[h.length - 1];
  if (!last || last.ovr !== o || dayOf(state) - last.day >= 28 || last.year !== yearOf(state)) {
    h.push({ day: dayOf(state), year: yearOf(state), ovr: o });
    if (h.length > 40) h.shift();
  }
}

export function startProgramme(state, name, progId, workload = "normal") {
  const ac = ensureAcademy(state);
  const d = ac.prospects.find((x) => x.name === name);
  const p = PROGRAMMES[progId];
  if (!d || !p || !WORKLOADS[workload]) return { ok: false, text: "Pick an academy driver and a programme." };
  if (d.programme) return { ok: false, text: `${d.name} is already on ${PROGRAMMES[d.programme.id].label.toLowerCase()}.` };
  const cost = r2(p.cost * WORKLOADS[workload].costMult);
  const paid = spend(state, cost, "training", `${p.label} · ${d.name}`);
  if (!paid.ok) return paid;
  d.programme = { id: progId, workload, days: p.days, progress: 0, startDay: dayOf(state), startYear: yearOf(state), cost, startValues: Object.fromEntries(Object.keys(p.targets).map((a) => [a, d[a]])) };
  pushNews(state, "programme", `${d.name} started ${p.label.toLowerCase()} (${WORKLOADS[workload].label.toLowerCase()} workload).`, d.name);
  return { ok: true, text: `${d.name} starts ${p.label.toLowerCase()} for $${cost}M.` };
}
export function cancelProgramme(state, name) {
  const d = state.academy.prospects.find((x) => x.name === name);
  if (!d?.programme) return { ok: false, text: "No programme running." };
  const label = PROGRAMMES[d.programme.id].label;
  d.programme = null;
  return { ok: true, text: `${label} stopped for ${d.name}. The fee is not refunded.` };
}
function finishProgramme(state, d) {
  const prog = d.programme; const p = PROGRAMMES[prog.id];
  const gains = Object.keys(p.targets).map((a) => `${ATTRIBUTE_LABELS[a].toLowerCase()} ${(d[a] - (prog.startValues?.[a] ?? d[a])) >= 0 ? "+" : ""}${d[a] - (prog.startValues?.[a] ?? d[a])}`).join(", ");
  d.programmeCount[prog.id] = (d.programmeCount[prog.id] || 0) + 1;
  d.programmeHistory = [...(d.programmeHistory || []), { id: prog.id, workload: prog.workload, year: yearOf(state), day: dayOf(state), gains }].slice(-12);
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Programme complete", detail: `${p.label}: ${gains}` });
  state.academy.stats.programmesDone++;
  d.programme = null;
  pushNews(state, "programme", `${d.name} completed ${p.label.toLowerCase()}: ${gains}.`, d.name);
  gainXP(state, 6);
}

/* ─── Facilities ────────────────────────────────────────────────────────── */

export function facilityInfo(state, key) {
  const ac = ensureAcademy(state);
  const level = ac.facilities[key] || 1;
  const cap = facilityCap(ac.level);
  const cost = level >= FACILITY_MAX ? null : getFacilityUpgradeCost(level);
  return {
    key, ...FACILITIES[key], level, cap, max: FACILITY_MAX, cost,
    effectiveness: Math.round(facilityBenefit(level) * 100),
    next: level >= FACILITY_MAX ? null : Math.round(facilityBenefit(level + 1) * 100),
    gain: level >= FACILITY_MAX ? 0 : Math.round((facilityBenefit(level + 1) - facilityBenefit(level)) * 100),
    locked: level >= cap && level < FACILITY_MAX,
  };
}
export function upgradeFacility(state, key) {
  const info = facilityInfo(state, key);
  if (info.level >= FACILITY_MAX) return { ok: false, text: "Already at the top level." };
  if (info.locked) return { ok: false, text: `Academy level ${state.academy.level} allows facilities up to level ${info.cap}.` };
  const paid = spend(state, info.cost, "facilities", `${info.label} to level ${info.level + 1}`);
  if (!paid.ok) return paid;
  state.academy.facilities[key] = info.level + 1;
  pushNews(state, "facility", `${info.label} upgraded to level ${info.level + 1}.`);
  gainXP(state, 8);
  return { ok: true, text: `${info.label} is now level ${info.level + 1}.` };
}

/* ─── Level, rating and reputation ──────────────────────────────────────── */

function gainXP(state, n) {
  const ac = state.academy;
  ac.xp += n;
  while (ac.xp >= getAcademyXPRequired(ac.level) && ac.level < 10) {
    ac.xp -= getAcademyXPRequired(ac.level);
    ac.level++;
    pushNews(state, "level", `The academy reached level ${ac.level}: squad capacity ${getMaxAcademySize(ac.level)}, facilities up to level ${facilityCap(ac.level)}.`);
  }
}
function addRep(state, n, why) {
  const ac = state.academy;
  const before = Math.round(ac.repScore);
  ac.repScore = clamp(ac.repScore + n, 0, 100);
  ac.reputation = clamp(Math.round(ac.repScore / 20), 1, 5);
  if (why && Math.round(ac.repScore) !== before) pushNews(state, "reputation", `Academy reputation ${n > 0 ? "up" : "down"} to ${Math.round(ac.repScore)}: ${why}.`);
}

/** Academy rating 0–100 from facilities, squad potential, results and reputation. */
export function academyRating(state) {
  const ac = ensureAcademy(state);
  const fac = Object.keys(FACILITIES).reduce((s, k) => s + (ac.facilities[k] || 1), 0) / Object.keys(FACILITIES).length;
  const squad = [...ac.prospects, ...ac.loanedOut];
  const pot = squad.length ? squad.reduce((s, d) => s + potential(d), 0) / squad.length : 60;
  const v = (fac / 5) * 30 + clamp((pot - 60) / 35, 0, 1) * 35 + (ac.repScore / 100) * 25 + Math.min(10, ac.stats.graduates * 3 + ac.stats.titles * 2);
  return Math.round(clamp(v, 0, 100));
}

export function academyOverview(state) {
  const ac = ensureAcademy(state);
  const squad = [...ac.prospects, ...ac.loanedOut];
  return {
    level: ac.level, xp: ac.xp, xpNext: getAcademyXPRequired(ac.level), rating: academyRating(state), reputation: Math.round(ac.repScore),
    stars: ac.reputation, budget: ac.budget, signed: ac.prospects.length, loaned: ac.loanedOut.length, capacity: getMaxAcademySize(ac.level),
    avgPotential: squad.length ? Math.round(squad.reduce((s, d) => s + potential(d), 0) / squad.length) : null,
    activeScouts: ac.scoutStaff.filter((s) => s.assignment).length, scouts: ac.scoutStaff.length,
    programmes: ac.prospects.filter((d) => d.programme).length, graduates: ac.stats.graduates,
  };
}

/* ─── Junior championships ──────────────────────────────────────────────── */

function trackedIn(state, seriesId) {
  const ac = state.academy;
  const out = [];
  ac.prospects.forEach((d) => d.series === seriesId && out.push({ d, kind: "academy" }));
  ac.loanedOut.forEach((d) => d.series === seriesId && out.push({ d, kind: "loan" }));
  Object.values(ac.aiJuniors).flat().forEach((d) => d.series === seriesId && out.push({ d, kind: "ai" }));
  ac.market.forEach((d) => d.series === seriesId && out.push({ d, kind: "market" }));
  return out;
}

function ensureSeriesSeason(state, seriesId, tracked) {
  const ac = state.academy; const y = yearOf(state); const s = SERIES[seriesId];
  let js = ac.juniors[seriesId];
  if (!js || js.year !== y) {
    js = ac.juniors[seriesId] = { year: y, races: 0, rivals: [] };
  }
  const need = Math.max(0, FIELD_SIZE - tracked.length);
  while (js.rivals.length < need) {
    const reg = REGIONS[pick(Object.keys(REGIONS))];
    js.rivals.push({ name: `${pick(reg.firstNames)} ${pick(reg.lastNames)}`, skill: r1(s.field + gauss() * 4.5), points: 0, wins: 0, podiums: 0 });
  }
  return js;
}

function runJuniorRound(state, roundNo) {
  const ac = state.academy;
  Object.keys(SERIES).forEach((sid) => {
    const s = SERIES[sid];
    const tracked = trackedIn(state, sid);
    const js = ensureSeriesSeason(state, sid, tracked);
    const prep = facilityBenefit(ac.facilities.racePrep);
    const entries = tracked.map(({ d, kind }) => {
      const sd = 2.6 + (100 - (d.consistency || 60)) * 0.07;
      const boost = kind === "academy" ? prep * 1.5 : kind === "loan" ? 0.6 : 0;
      const dnf = Math.random() < 0.05 + (100 - (d.consistency || 60)) * 0.0008;
      return { kind, d, perf: dnf ? -999 : ovr(d) + ((d.mentality ?? 60) - 60) * 0.04 + boost + gauss() * sd, dnf };
    });
    js.rivals.slice(0, Math.max(0, FIELD_SIZE - tracked.length)).forEach((r) => {
      const dnf = Math.random() < 0.06;
      entries.push({ kind: "rival", r, perf: dnf ? -999 : r.skill + gauss() * 3.6, dnf });
    });
    entries.sort((a, b) => b.perf - a.perf);
    js.races++;
    entries.forEach((e, i) => {
      const pos = i + 1; const pts = e.dnf ? 0 : RACE_POINTS[i] || 0;
      if (e.kind === "rival") { e.r.points += pts; if (pos === 1 && !e.dnf) e.r.wins++; if (pos <= 3 && !e.dnf) e.r.podiums++; return; }
      const d = e.d;
      if (!d.juniorStats || d.juniorStats.year !== js.year || d.juniorStats.series !== sid) d.juniorStats = { year: js.year, series: sid, starts: 0, wins: 0, podiums: 0, points: 0, dnfs: 0, results: [] };
      const st = d.juniorStats;
      st.starts++; st.points += pts; if (e.dnf) st.dnfs++;
      if (!e.dnf && pos === 1) st.wins++; if (!e.dnf && pos <= 3) st.podiums++;
      st.results = [...st.results, e.dnf ? "DNF" : pos].slice(-30);
      // Race experience: racecraft and consistency, more in higher series
      d.raceExp = (d.raceExp || 0) + 1;
      const xpGain = 0.18 * (1 + s.tier * 0.15) * ageFactor(d.age);
      if (e.kind !== "market") { d.devXP = d.devXP || {}; grow(d, "racecraft", xpGain * 0.6, state, false); grow(d, "consistency", xpGain * 0.4, state, false); }
      // Results move morale
      d.morale = clamp((d.morale ?? 70) + (e.dnf ? -2 : pos === 1 ? 4 : pos <= 3 ? 2 : pos <= 10 ? 0.5 : -1), 0, 100);
      if ((e.kind === "academy" || e.kind === "loan") && !e.dnf && pos <= 3) {
        pushNews(state, "race", `${d.name} ${pos === 1 ? "won" : `finished P${pos} in`} ${s.label} round ${js.races}${e.kind === "loan" ? ` (on loan with ${d.loanStatus?.team})` : ""}.`, d.name);
      }
    });
  });
}

/** Championship table for a series this season: tracked drivers and the rest of the field. */
export function standingsFor(state, seriesId) {
  const ac = ensureAcademy(state);
  const js = ac.juniors[seriesId];
  const rows = trackedIn(state, seriesId).map(({ d, kind }) => ({
    name: d.name, kind, team: kind === "loan" ? d.loanStatus?.team : kind === "ai" ? `${d.aiTeam} junior` : d.juniorTeam,
    points: d.juniorStats?.series === seriesId && d.juniorStats?.year === yearOf(state) ? d.juniorStats.points : 0,
    wins: d.juniorStats?.series === seriesId && d.juniorStats?.year === yearOf(state) ? d.juniorStats.wins : 0,
  }));
  (js?.year === yearOf(state) ? js.rivals.slice(0, Math.max(0, FIELD_SIZE - rows.length)) : []).forEach((r) => rows.push({ name: r.name, kind: "field", team: null, points: r.points, wins: r.wins }));
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
  return { races: js?.year === yearOf(state) ? js.races : 0, rows: rows.map((r, i) => ({ ...r, pos: i + 1 })) };
}
export function championshipPosition(state, d) {
  const t = standingsFor(state, d.series);
  return t.rows.find((r) => r.name === d.name)?.pos ?? null;
}
const raceEvery = (state) => ((state.season?.totalRounds || 24) >= 18 ? 2 : 1);
export const juniorRoundsPerSeason = (state) => Math.floor((state.season?.totalRounds || 24) / raceEvery(state));

/* ─── Super Licence ─────────────────────────────────────────────────────── */

export function superLicence(d, state) {
  const y = yearOf(state);
  const last3 = (d.slHistory || []).filter((h) => h.year > y - 3);
  const pts = last3.reduce((s, h) => s + h.pts, 0);
  return { points: pts, required: SL_REQUIRED, eligible: pts >= SL_REQUIRED && (d.age ?? 0) >= 18, ageOk: (d.age ?? 0) >= 18 };
}

/* ─── Scouting department ───────────────────────────────────────────────── */

function makeScout(seed, base) {
  const reg = REGIONS[["europe", "southAmerica", "northAmerica", "asia", "oceania"][hash(seed) % 5]];
  const att = (k) => clamp(Math.round(base + (seeded(`${seed}:${k}`) - 0.5) * 30), 25, 95);
  const s = { id: `sc-${seed}`, name: `${reg.firstNames[hash(seed + "f") % reg.firstNames.length]} ${reg.lastNames[hash(seed + "l") % reg.lastNames.length]}`,
    ability: att("ab"), technical: att("te"), potentialEye: att("po"), experience: att("ex"), reliability: att("re"), assignment: null, finds: 0 };
  s.salary = r2(0.15 + ((s.ability + s.technical + s.potentialEye + s.experience + s.reliability) / 5) * 0.006);
  return s;
}
/** Scouts available to hire, refreshed each season. */
export function scoutCandidates(state) {
  const ac = ensureAcademy(state);
  const y = yearOf(state);
  return [0, 1, 2, 3].map((i) => makeScout(`cand-${y}-${i}-${ac.level}`, 45 + i * 9 + ac.level * 1.5)).filter((c) => !ac.scoutStaff.some((s) => s.id === c.id || s.name === c.name));
}
export const MAX_SCOUTS = (level) => 2 + Math.floor((level || 1) / 3);
export function hireScout(state, id) {
  const ac = ensureAcademy(state);
  const c = scoutCandidates(state).find((x) => x.id === id);
  if (!c) return { ok: false, text: "That scout is no longer available." };
  if (ac.scoutStaff.length >= MAX_SCOUTS(ac.level)) return { ok: false, text: `Academy level ${ac.level} supports ${MAX_SCOUTS(ac.level)} scouts.` };
  const fee = r2(c.salary * 0.5);
  const paid = spend(state, fee, "scouts", `Hired ${c.name} (half-season signing fee)`);
  if (!paid.ok) return paid;
  ac.scoutStaff.push(c);
  pushNews(state, "scout", `${c.name} joined the scouting department.`);
  return { ok: true, text: `${c.name} hired on $${c.salary}M a season.` };
}
export function releaseScout(state, id) {
  const ac = state.academy; const s = ac.scoutStaff.find((x) => x.id === id);
  if (!s) return { ok: false, text: "No such scout." };
  ac.scoutStaff = ac.scoutStaff.filter((x) => x.id !== id);
  return { ok: true, text: `${s.name} has left the academy.` };
}

export function assignScoutTask(state, scoutId, task) {
  const ac = ensureAcademy(state);
  const s = ac.scoutStaff.find((x) => x.id === scoutId);
  if (!s) return { ok: false, text: "Pick a scout." };
  if (s.assignment) return { ok: false, text: `${s.name} is busy. Recall them first.` };
  const day = dayOf(state);
  if (task.type === "discover") {
    const area = SCOUT_REGIONS[task.area];
    if (!area) return { ok: false, text: "Pick a region." };
    const days = Math.round(30 - s.ability * 0.14);
    s.assignment = { type: "discover", area: task.area, startDay: day, startYear: yearOf(state), days, progress: 0 };
    return { ok: true, text: `${s.name} heads to ${area.label} for about ${days} days.` };
  }
  const target = [...ac.market, ...poolMarket(state)].find((d) => d.name === task.target);
  if (!target) return { ok: false, text: "Pick a driver to watch." };
  if (task.type === "monitor") {
    s.assignment = { type: "monitor", target: task.target, startDay: day, startYear: yearOf(state), progress: 0 };
    return { ok: true, text: `${s.name} is now monitoring ${task.target}.` };
  }
  if (task.type === "evaluate") {
    const paid = spend(state, ASSIGNMENTS.evaluate.cost, "scouts", `Evaluation of ${task.target}`);
    if (!paid.ok) return paid;
    const days = Math.round(24 - s.ability * 0.1);
    s.assignment = { type: "evaluate", target: task.target, startDay: day, startYear: yearOf(state), days, progress: 0 };
    return { ok: true, text: `${s.name} starts a ${days}-day evaluation of ${task.target}.` };
  }
  return { ok: false, text: "Unknown assignment." };
}
export function recallScoutTask(state, scoutId) {
  const s = state.academy.scoutStaff.find((x) => x.id === scoutId);
  if (!s?.assignment) return { ok: false, text: "Nothing to recall." };
  s.assignment = null;
  return { ok: true, text: `${s.name} is back at base.` };
}

function learn(state, name, gain, scout, cap = 100) {
  const ac = state.academy;
  const kn = ac.knowledge[name] || (ac.knowledge[name] = { k: 0, acc: 50 });
  const before = kn.k;
  kn.k = clamp(r1(kn.k + gain), 0, Math.max(cap, kn.k));
  kn.acc = Math.max(kn.acc || 0, Math.round((scout.technical + scout.potentialEye) / 2));
  return before;
}

function scoutDay(state) {
  const ac = state.academy;
  ac.scoutStaff.forEach((s) => {
    const a = s.assignment; if (!a) return;
    const speed = 0.5 + s.ability / 100;
    const noise = 1 + (Math.random() - 0.5) * (1 - s.reliability / 100);
    if (a.type === "discover") {
      const area = SCOUT_REGIONS[a.area];
      const paid = spend(state, area.dayCost, "scouts", `Travel: ${area.label}`);
      if (!paid.ok) { s.assignment = null; pushNews(state, "scout", `${s.name} returned early: the academy could not cover travel costs.`); return; }
      a.progress++;
      if (a.progress >= a.days) {
        const regions = area.regions || [area.region];
        const n = 1 + (s.experience >= 70 ? 1 : 0) + (Math.random() < s.ability / 250 ? 1 : 0);
        const tier = s.experience >= 80 ? "elite" : s.experience >= 55 ? "advanced" : "basic";
        const found = [];
        for (let i = 0; i < n; i++) {
          const youth = Math.random() < 0.3 + facilityBenefit(ac.facilities.karting) * 0.4;
          const d = addMarketProspect(state, pick(regions), { tier, ageRange: youth ? [15, 17] : [17, 20] });
          ac.knowledge[d.name] = { k: Math.round(22 + s.ability * 0.12), acc: Math.round((s.technical + s.potentialEye) / 2) };
          d.discoveredBy = s.name;
          found.push(d);
        }
        s.finds += found.length;
        s.assignment = null;
        found.forEach((d) => pushNews(state, "discovery", `${s.name} discovered ${d.name} (${d.age}, ${d.nationality}) racing in ${SERIES[d.series].label}.`, d.name));
      }
    } else if (a.type === "monitor") {
      if (!spend(state, ASSIGNMENTS.monitor.dayCost, "scouts", `Monitoring ${a.target}`).ok) { s.assignment = null; return; }
      if (!knownDriver(state, a.target)) { s.assignment = null; return; }
      a.progress++;
      learn(state, a.target, 0.35 * speed * noise, s, 70);
    } else if (a.type === "evaluate") {
      if (!knownDriver(state, a.target)) { s.assignment = null; return; }
      a.progress++;
      learn(state, a.target, (100 / a.days) * 0.9 * noise, s, 100);
      if (a.progress >= a.days) {
        const d = knownDriver(state, a.target);
        ac.knowledge[a.target].k = 100;
        ac.reports = [{ name: a.target, scout: s.name, day: dayOf(state), year: yearOf(state), acc: ac.knowledge[a.target].acc }, ...ac.reports.filter((r) => r.name !== a.target)].slice(0, 40);
        s.assignment = null;
        pushNews(state, "report", `${s.name} filed a full scouting report on ${a.target}.`, a.target);
        if (d) gainXP(state, 3);
      }
    }
  });
}

/* ─── Market (prospects you can sign) ───────────────────────────────────── */

/** Real F2 drivers without a team, from the driver market pool. */
export function poolMarket(state) {
  return poolProspects(state).map((d) => {
    d.series = "f2"; d.poolDriver = true;
    d.juniorTeam = d.juniorTeam || (String(d.roleLabel || "").match(/\(([^)]+)\)/)?.[1] ?? "F2");
    if (!state.academy.knowledge[d.name]) state.academy.knowledge[d.name] = { k: 45, acc: 60 };
    return d;
  });
}
export function knownDriver(state, name) {
  const ac = state.academy;
  return ac.market.find((d) => d.name === name) || ac.prospects.find((d) => d.name === name) || ac.loanedOut.find((d) => d.name === name)
    || Object.values(ac.aiJuniors).flat().find((d) => d.name === name) || poolMarket(state).find((d) => d.name === name) || null;
}
export function marketList(state) {
  const ac = ensureAcademy(state);
  const ai = Object.values(ac.aiJuniors).flat();
  return [...ac.market, ...poolMarket(state), ...ai];
}

export function signProspect(state, name) {
  const ac = ensureAcademy(state);
  if (ac.prospects.length >= getMaxAcademySize(ac.level)) return { ok: false, text: `The academy is full (${getMaxAcademySize(ac.level)} places).` };
  const d = knownDriver(state, name);
  if (!d || isOurs(state, name)) return { ok: false, text: "That driver can't be signed." };
  if (d.aiTeam) return { ok: false, text: `${d.name} is under contract with ${d.aiTeam}.` };
  const i = interestIn(state, d);
  if (i < 30) return { ok: false, text: `${d.name} isn't interested in joining an academy of this standing yet.` };
  const fee = signingFee(d);
  const paid = spend(state, fee, "recruitment", `Signed ${d.name}`);
  if (!paid.ok) return paid;
  if (d.poolDriver) {
    delete state.transferMarket?.pool?.[name];
    delete d.poolDriver;
  } else ac.market = ac.market.filter((x) => x.name !== name);
  asDriver(prepDriver(d, state));
  d.driverRole = "academy"; d.roleLabel = "Academy Prospect"; d.contractType = "academy"; d.contractYearsRemaining = 3;
  d.academySalary = juniorSalary(d);
  d.academySince = { year: yearOf(state), day: dayOf(state) };
  d.signedOvr = ovr(d);
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Joined academy", detail: `Signed for $${fee}M on a three-season deal, $${d.academySalary}M a season.` });
  ac.prospects.push(d);
  ac.shortlist = ac.shortlist.filter((n) => n !== name);
  ac.knowledge[name] = { k: 100, acc: 100 };
  if (potential(d) >= 80) ac.stats.signedHighPot++;
  pushNews(state, "signing", `${d.name} (${d.age}) signed for the academy from ${SERIES[d.series]?.label || "junior racing"}.`, d.name);
  gainXP(state, 10);
  return { ok: true, text: `${d.name} joins the academy for $${fee}M.` };
}

export function toggleShortlist(state, name) {
  const ac = ensureAcademy(state);
  ac.shortlist = ac.shortlist.includes(name) ? ac.shortlist.filter((n) => n !== name) : [...ac.shortlist, name];
  return ac.shortlist.includes(name);
}

export function releaseProspect(state, name) {
  const ac = ensureAcademy(state);
  const d = ac.prospects.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not an academy driver." };
  ac.prospects = ac.prospects.filter((x) => x.name !== name);
  d.programme = null; d.driverRole = null; d.roleLabel = "Junior driver"; d.contractType = "none";
  ac.market.push(d);
  pushNews(state, "departure", `${d.name} was released by the academy.`, d.name);
  addRep(state, -1);
  return { ok: true, text: `${d.name} released. They return to the junior market.` };
}

/** Renew an academy contract (+2 seasons) for a signing bonus. */
export function renewContract(state, name) {
  const ac = ensureAcademy(state);
  const d = [...ac.prospects, ...ac.loanedOut].find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not an academy driver." };
  if ((d.contractYearsRemaining ?? 0) > 1) return { ok: false, text: "Renewals open in the final season of the deal." };
  if ((d.morale ?? 70) < 35) return { ok: false, text: `${d.name}'s morale is too low to agree a new deal.` };
  const bonus = r2(signingFee(d) * 0.6);
  const paid = spend(state, bonus, "recruitment", `Renewal: ${d.name}`);
  if (!paid.ok) return paid;
  d.contractYearsRemaining = (d.contractYearsRemaining || 0) + 2;
  d.academySalary = r2(Math.max(d.academySalary || 0, juniorSalary({ ...d, academySalary: undefined })));
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Contract renewed", detail: `Two more seasons, $${d.academySalary}M a season.` });
  pushNews(state, "contract", `${d.name} renewed their academy contract for two more seasons.`, d.name);
  return { ok: true, text: `${d.name} renewed for $${bonus}M.` };
}

/* ─── Series moves (career progression) ─────────────────────────────────── */

export function nextSeries(d) {
  const i = LADDER.indexOf(d.series);
  return i >= 0 && i < LADDER.length - 1 ? LADDER[i + 1] : null;
}
/** Whether a driver looks ready for the next step, with the reasons. */
export function promotionAdvice(state, d) {
  const o = ovr(d); const st = d.juniorStats?.year === yearOf(state) ? d.juniorStats : null;
  const last = (d.juniorHistory || [])[0];
  const pos = st ? championshipPosition(state, d) : last?.pos;
  const sl = superLicence(d, state);
  if (d.series === "f2" || d.series === "superformula") {
    const ready = o >= 76 && (pos ?? 99) <= 6 && sl.eligible;
    return { target: "reserve", ready, reasons: [`Overall ${o} (76+ advised for a reserve seat)`, `Championship ${pos ? `P${pos}` : "not started"}`, `Super Licence ${sl.points}/${SL_REQUIRED} points${sl.ageOk ? "" : ", under 18"}`] };
  }
  const nx = nextSeries(d) || "f2";
  const need = SERIES[nx].field - 2;
  const ready = o >= need && ((pos ?? 99) <= 5 || o >= need + 4) && (d.raceExp || 0) >= 4;
  return { target: nx, ready, reasons: [`Overall ${o} (${need}+ for ${SERIES[nx].label})`, `Championship ${pos ? `P${pos}` : "no results yet"}`, `${d.raceExp || 0} junior races (4+ advised)`] };
}
export function moveSeries(state, name, seriesId) {
  const ac = ensureAcademy(state);
  const d = ac.prospects.find((x) => x.name === name);
  if (!d || !SERIES[seriesId] || SERIES[seriesId].side) return { ok: false, text: "Pick an academy driver and a ladder series." };
  if (d.series === seriesId) return { ok: false, text: `Already in ${SERIES[seriesId].label}.` };
  const from = d.series;
  d.series = seriesId;
  d.juniorTeam = pick(JUNIOR_TEAMS[seriesId]);
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Series move", detail: `${SERIES[from]?.label} to ${SERIES[seriesId].label} with ${d.juniorTeam}` });
  const step = SERIES[seriesId].tier - (SERIES[from]?.tier ?? 0);
  if (step > 0 && ovr(d) < SERIES[seriesId].field - 4) d.morale = clamp((d.morale ?? 70) - 6, 0, 100);
  pushNews(state, "series", `${d.name} moves ${step >= 0 ? "up" : "down"} to ${SERIES[seriesId].label} with ${d.juniorTeam}.`, d.name);
  if (seriesId === "f2" && !d.reachedF2) { d.reachedF2 = true; ac.stats.f2Graduates++; gainXP(state, 15); }
  return { ok: true, text: `${d.name} will race in ${SERIES[seriesId].label} with ${d.juniorTeam}. Seat cost $${SERIES[seriesId].seatCost}M a season.` };
}

/* ─── Loans ─────────────────────────────────────────────────────────────── */

/** Loan offers available for a driver now (deterministic per driver and season). */
export function loanOffers(state, name) {
  const d = state.academy.prospects.find((x) => x.name === name);
  if (!d) return [];
  const o = ovr(d);
  return Object.values(SERIES).filter((s) => s.id !== "karting" && o >= s.field - 9 && o <= s.field + 12).map((s, i) => {
    const key = `${name}:${s.id}:${yearOf(state)}`;
    const teams = JUNIOR_TEAMS[s.id];
    const team = teams[hash(key) % teams.length];
    const fit = o - s.field;
    const contribution = r2(clamp((fit + 2) * 0.12 + (seeded(key + "c") - 0.5) * 0.4, -s.seatCost, s.seatCost * 0.6));
    const seats = fit >= 2 ? "Full season" : fit >= -4 ? "Most rounds" : "Selected rounds";
    const recallClause = seeded(key + "r") > 0.35;
    const targetPos = clamp(Math.round(12 - fit * 0.8), 1, 18);
    return {
      id: `${s.id}-${i}`, series: s.id, seriesLabel: s.label, team, seats, recallClause, contribution,
      duration: fit < -3 ? 2 : 1,
      objectives: [{ type: "position", target: targetPos, label: `Finish the championship P${targetPos} or better` }, { type: "points", target: Math.max(10, Math.round((20 - targetPos) * 6)), label: `Score ${Math.max(10, Math.round((20 - targetPos) * 6))} points` }],
    };
  });
}
export function sendOnLoan(state, name, offerId) {
  const ac = ensureAcademy(state);
  const d = ac.prospects.find((x) => x.name === name);
  const offer = loanOffers(state, name).find((o) => o.id === offerId);
  if (!d || !offer) return { ok: false, text: "That loan offer is no longer available." };
  if (offer.contribution < 0) {
    const paid = spend(state, -offer.contribution, "loans", `Loan fee: ${d.name} to ${offer.team}`);
    if (!paid.ok) return paid;
  }
  ac.prospects = ac.prospects.filter((x) => x.name !== name);
  d.programme = null;
  d.series = offer.series;
  const y = yearOf(state);
  d.loanStatus = { destination: offer.series, series: offer.seriesLabel, team: offer.team, seasonYear: y + offer.duration - 1, startYear: y, endYear: y + offer.duration - 1,
    startDay: dayOf(state), contribution: offer.contribution, recallClause: offer.recallClause, seats: offer.seats, objectives: offer.objectives, startOvr: ovr(d) };
  d.roleLabel = `On loan (${offer.team}, ${offer.seriesLabel})`;
  d.careerTimeline.unshift({ seasonYear: y, event: "Loaned out", detail: `${offer.team} in ${offer.seriesLabel} until the end of season ${y + offer.duration - 1}` });
  ac.loanedOut.push(d);
  pushNews(state, "loan", `${d.name} joined ${offer.team} in ${offer.seriesLabel} on loan.`, d.name);
  return { ok: true, text: `${d.name} is on loan to ${offer.team}.` };
}
export function recallLoan(state, name) {
  const ac = ensureAcademy(state);
  const d = ac.loanedOut.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not on loan." };
  if (!d.loanStatus?.recallClause) return { ok: false, text: `The ${d.loanStatus?.team} deal has no recall clause.` };
  if (ac.prospects.length >= getMaxAcademySize(ac.level)) return { ok: false, text: "No academy place to bring them back to." };
  return endLoan(state, d, "Recalled early by the academy.", -8);
}
export function extendLoan(state, name) {
  const d = state.academy.loanedOut.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not on loan." };
  d.loanStatus.endYear += 1; d.loanStatus.seasonYear = d.loanStatus.endYear;
  pushNews(state, "loan", `${d.name}'s loan at ${d.loanStatus.team} extended to the end of season ${d.loanStatus.endYear}.`, d.name);
  return { ok: true, text: `Loan extended to season ${d.loanStatus.endYear}.` };
}
/** Sell a loaned driver to their loan team. */
export function sellLoanee(state, name) {
  const ac = ensureAcademy(state);
  const d = ac.loanedOut.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not on loan." };
  const fee = r2(juniorValue(d) * 0.9);
  ac.loanedOut = ac.loanedOut.filter((x) => x.name !== name);
  ac.budget = r2(ac.budget + fee);
  record(state, "transfers", fee, `${d.name} sold to ${d.loanStatus?.team}`);
  pushNews(state, "transfer", `${d.name} joined ${d.loanStatus?.team} permanently for $${fee}M.`, d.name);
  ac.loanReviews = ac.loanReviews.filter((r) => r.name !== name);
  return { ok: true, text: `${d.name} sold for $${fee}M.` };
}
function endLoan(state, d, why, morale = 0) {
  const ac = state.academy;
  ac.loanedOut = ac.loanedOut.filter((x) => x.name !== d.name);
  const ls = d.loanStatus;
  d.loanHistory = [...(d.loanHistory || []), { ...ls, endedYear: yearOf(state), endOvr: ovr(d), stats: d.juniorStats?.series === ls?.destination ? { ...d.juniorStats } : null }];
  d.loanStatus = null; d.driverRole = "academy"; d.roleLabel = "Academy Prospect";
  d.series = LADDER.includes(d.series) ? d.series : seriesForRating(ovr(d), d.age);
  d.morale = clamp((d.morale ?? 70) + morale, 0, 100);
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Loan ended", detail: why });
  ac.prospects.push(d);
  pushNews(state, "loan", `${d.name} is back at the academy from ${ls?.team}. ${why}`, d.name);
  return { ok: true, text: `${d.name} is back at the academy.` };
}
export function loanProgress(state, d) {
  const ls = d.loanStatus || {};
  const st = d.juniorStats?.series === ls.destination && d.juniorStats?.year === yearOf(state) ? d.juniorStats : null;
  const pos = st ? championshipPosition(state, d) : null;
  const objectives = (ls.objectives || []).map((o) => ({ ...o, met: o.type === "position" ? pos != null && pos <= o.target : (st?.points || 0) >= o.target, now: o.type === "position" ? (pos ? `P${pos}` : "–") : `${st?.points || 0} pts` }));
  return { stats: st, position: pos, objectives, devGain: ovr(d) - (ls.startOvr ?? ovr(d)) };
}

/* ─── Promotion to the team ─────────────────────────────────────────────── */

function graduate(state, d) {
  d.academyGraduate = true;
  d.academyGraduateYear = yearOf(state);
  state.academy.stats.graduates++;
  state.academy.prospects = state.academy.prospects.filter((x) => x.name !== d.name);
  state.academy.loanedOut = state.academy.loanedOut.filter((x) => x.name !== d.name);
  d.programme = null;
  asDriver(d);
}
export function promoteToReserve(state, name) {
  const ac = ensureAcademy(state);
  const d = ac.prospects.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Only drivers at the academy (not on loan) can be promoted." };
  if (state.team.reserveDriver) return { ok: false, text: `${state.team.reserveDriver.name} already holds the reserve seat.` };
  graduate(state, d);
  // Reuse the team's own promotion so salary and role follow the existing contract rules
  ac.prospects.push(d);
  state.team.promoteAcademyToReserve(d, state);
  ac.stats.reserves++;
  pushNews(state, "promotion", `${d.name} promoted to ${state.team.name} reserve driver.`, d.name);
  addRep(state, 4, `${d.name} graduated to the reserve seat`);
  gainXP(state, 30);
  return { ok: true, text: `${d.name} is the new reserve driver.` };
}
/** Academy route to a race seat: via the reserve seat, replacing a current race driver. */
export function promoteToRaceSeat(state, name, replaceName) {
  const ac = ensureAcademy(state);
  const fromReserve = state.team.reserveDriver?.name === name && state.team.reserveDriver.academyGraduate;
  const d = fromReserve ? state.team.reserveDriver : ac.prospects.find((x) => x.name === name);
  if (!d) return { ok: false, text: "Not an academy driver or graduate reserve." };
  const sl = superLicence(d, state);
  if (!sl.eligible) return { ok: false, text: `${d.name} needs a Super Licence: ${sl.points}/${SL_REQUIRED} points over three seasons${sl.ageOk ? "" : " and to be 18"}.` };
  if (!fromReserve) {
    if (state.team.reserveDriver) return { ok: false, text: "Free the reserve seat first, or promote the current reserve." };
    graduate(state, d); ac.prospects.push(d); state.team.promoteAcademyToReserve(d, state);
  }
  if (!state.team.promoteReserveToSeat(replaceName, state)) return { ok: false, text: "Pick a race driver to replace." };
  ac.stats.raceSeats++;
  pushNews(state, "promotion", `${d.name} promoted to an F1 race seat with ${state.team.name}, replacing ${replaceName}.`, d.name);
  addRep(state, 10, `${d.name} reached F1`);
  gainXP(state, 80);
  return { ok: true, text: `${d.name} takes ${replaceName}'s race seat.` };
}
/** Agree a race seat for next season: executed at the season change. */
export function planRaceSeat(state, name, replaceName) {
  const ac = ensureAcademy(state);
  const d = [...ac.prospects, ...ac.loanedOut].find((x) => x.name === name) || (state.team.reserveDriver?.name === name ? state.team.reserveDriver : null);
  if (!d) return { ok: false, text: "Not an academy driver." };
  if (!(state.team.drivers || []).some((x) => x.name === replaceName)) return { ok: false, text: "Pick a race driver to replace." };
  ac.seatPlans = [...ac.seatPlans.filter((p) => p.name !== name), { name, replace: replaceName, year: yearOf(state) + 1 }];
  d.careerTimeline.unshift({ seasonYear: yearOf(state), event: "Future race seat", detail: `Agreed to replace ${replaceName} from season ${yearOf(state) + 1}` });
  pushNews(state, "promotion", `${d.name} will step up to a race seat next season, replacing ${replaceName}, if they hold a Super Licence by then.`, d.name);
  return { ok: true, text: `Agreed: ${d.name} replaces ${replaceName} next season (Super Licence required).` };
}
export const cancelSeatPlan = (state, name) => { state.academy.seatPlans = state.academy.seatPlans.filter((p) => p.name !== name); return { ok: true, text: "Seat plan cancelled." }; };

/* ─── Objectives ────────────────────────────────────────────────────────── */

export function objectiveProgress(state) {
  const ac = ensureAcademy(state);
  const ours = [...ac.prospects, ...ac.loanedOut];
  const now = {
    sign3: ac.stats.signedHighPot,
    ovr80: ours.some((d) => ovr(d) >= 80 && (d.signedOvr ?? 0) < 80) ? 1 : 0,
    f2: ac.stats.f2Graduates,
    title: ac.stats.titles,
    facilities3: Object.keys(FACILITIES).filter((k) => (ac.facilities[k] || 1) >= 3).length,
    reserve: ac.stats.reserves,
    f1: ac.stats.raceSeats,
  };
  return OBJECTIVES.map((o) => ({ ...o, value: Math.min(o.target, now[o.id] || 0), done: !!ac.objectives[o.id] }));
}
function checkObjectives(state) {
  const ac = state.academy;
  objectiveProgress(state).forEach((o) => {
    if (o.done || o.value < o.target) return;
    ac.objectives[o.id] = { year: yearOf(state), day: dayOf(state) };
    const r = o.reward;
    if (r.xp) gainXP(state, r.xp);
    if (r.rep) addRep(state, r.rep);
    if (r.devBonus) ac.devBonusUntil = absDay(state) + r.devBonus;
    if (r.teamRep && state.finance) state.finance.reputation = clamp((state.finance.reputation ?? 62) + r.teamRep, 0, 100);
    pushNews(state, "objective", `Objective complete: ${o.label}.`);
  });
}
export const rewardText = (r) => [r.rep && `+${r.rep} academy reputation`, r.teamRep && `+${r.teamRep} team reputation`, r.xp && `+${r.xp} academy XP`, r.devBonus && `+10% development for ${r.devBonus} days`].filter(Boolean).join(" · ");

/* ─── AI junior programmes ──────────────────────────────────────────────── */

function aiMarketDay(state) {
  const ac = state.academy;
  (state.aiTeams || []).forEach((t, ti) => {
    const list = ac.aiJuniors[t.name] || (ac.aiJuniors[t.name] = []);
    const quota = 2 + ((t.specs?.ovr || t.carPerformance || 80) >= 88 ? 2 : 1);
    if (list.length >= quota || Math.random() > 0.25) return;
    // Pick the best-looking free prospect by their own (noisy) judgement
    const options = ac.market.filter((d) => !ac.shortlist.includes(d.name) || Math.random() < 0.4);
    if (!options.length) return;
    const best = options.map((d) => ({ d, score: potential(d) + gauss() * 4 - Math.max(0, d.age - 19) * 2 })).sort((a, b) => b.score - a.score)[0].d;
    ac.market = ac.market.filter((x) => x.name !== best.name);
    best.aiTeam = t.name; best.roleLabel = `${t.name} junior`;
    list.push(best);
    const watched = (ac.knowledge[best.name]?.k || 0) > 0 || ac.shortlist.includes(best.name);
    if (watched) pushNews(state, "ai", `${t.name} signed ${best.name} to their junior programme.`, best.name);
  });
}

function aiSeasonEnd(state) {
  const ac = state.academy;
  (state.aiTeams || []).forEach((t) => {
    const list = ac.aiJuniors[t.name] || [];
    for (const d of [...list]) {
      const nx = nextSeries(d);
      if (nx && ovr(d) >= SERIES[nx].field - 1) { d.series = nx; d.juniorTeam = pick(JUNIOR_TEAMS[nx]); }
      if ((d.series === "f2") && ovr(d) >= 76 && d.age >= 19 && !t.reserveDriver) {
        asDriver(d);
        ac.aiJuniors[t.name] = ac.aiJuniors[t.name].filter((x) => x.name !== d.name);
        delete d.aiTeam;
        d.driverRole = "reserve"; d.contractType = "reserve"; d.roleLabel = `${t.name} Reserve`; d.contractYearsRemaining = 2; d.salary = Math.max(2, d.salary || 2);
        t.reserveDriver = d;
        pushNews(state, "ai", `${t.name} promoted their junior ${d.name} to reserve driver.`, d.name);
      } else if (d.age >= 24 && trajectory(d).id !== "rapid") {
        ac.aiJuniors[t.name] = ac.aiJuniors[t.name].filter((x) => x.name !== d.name);
        delete d.aiTeam; d.roleLabel = "Junior driver";
        ac.market.push(d);
        if ((ac.knowledge[d.name]?.k || 0) > 0) pushNews(state, "ai", `${t.name} released ${d.name} from their junior programme.`, d.name);
      }
    }
  });
}

/* ─── Daily and season-end processing ───────────────────────────────────── */

/** Run one season day. Called from simulateNextDay after the day advances. */
export function processAcademyDay(state) {
  const ac = ensureAcademy(state);
  const key = absDay(state);
  if (ac.lastDayKey === key) return;
  ac.lastDayKey = key;
  const day = dayOf(state);

  ac.prospects.forEach((d) => { prepDriver(d, state); developDay(state, d, "academy"); snapshotRating(state, d); });
  ac.loanedOut.forEach((d) => { prepDriver(d, state); developDay(state, d, "loan"); snapshotRating(state, d); });
  Object.values(ac.aiJuniors).flat().forEach((d) => { prepDriver(d, state); developDay(state, d, "ai"); snapshotRating(state, d); });
  ac.market.forEach((d) => { prepDriver(d, state); developDay(state, d, "market"); if (day % 14 === 0) snapshotRating(state, d); });
  scoutDay(state);

  // Junior race weekends follow the F1 calendar
  const total = state.season?.totalRounds || 24;
  for (let r = 1; r <= total; r++) {
    if (1 + (r - 1) * 14 === day && r % raceEvery(state) === 0) runJuniorRound(state, r);
  }

  // Every four weeks: payroll, the market moves, AI programmes recruit
  if (day % 28 === 0) {
    payroll(state);
    aiMarketDay(state);
    if (ac.market.length < 22 && Math.random() < 0.6) {
      const d = addMarketProspect(state, null, { k: 0 });
      if (SERIES[d.series].tier >= 3) ac.knowledge[d.name] = { k: 8, acc: 40 }; // results in F3 and up are public
    }
    // Unhappy prospects ask to leave
    ac.prospects.filter((d) => (d.morale ?? 70) < 20).forEach((d) => {
      d.lowMoraleMonths = (d.lowMoraleMonths || 0) + 1;
      if (d.lowMoraleMonths >= 3) { releaseProspect(state, d.name); pushNews(state, "departure", `${d.name} asked to leave after months of low morale.`, d.name); }
    });
  }
  checkObjectives(state);
}

function payroll(state) {
  const ac = state.academy;
  const frac = 28 / seasonDays(state);
  const items = [
    ["salaries", ac.prospects.reduce((s, d) => s + juniorSalary(d), 0) + ac.loanedOut.reduce((s, d) => s + juniorSalary(d), 0), "Driver salaries"],
    ["seats", ac.prospects.reduce((s, d) => s + (SERIES[d.series]?.seatCost || 0), 0), "Junior race seats"],
    ["scouts", ac.scoutStaff.reduce((s, x) => s + x.salary, 0), "Scout salaries"],
  ];
  let short = 0;
  items.forEach(([cat, perSeason, note]) => {
    const amt = r2(perSeason * frac);
    if (!amt) return;
    const paid = Math.min(amt, Math.max(0, ac.budget));
    if (paid > 0) { ac.budget = r2(ac.budget - paid); record(state, cat, -paid, note); }
    short += amt - paid;
  });
  const loanNet = r2(ac.loanedOut.reduce((s, d) => s + (d.loanStatus?.contribution || 0), 0) * frac);
  if (loanNet > 0) { ac.budget = r2(ac.budget + loanNet); record(state, "loans", loanNet, "Loan teams' contributions"); }
  if (short > 0.005) {
    ac.prospects.forEach((d) => { d.morale = clamp((d.morale ?? 70) - 6, 0, 100); });
    addRep(state, -2);
    pushNews(state, "finance", `The academy was $${r2(short)}M short on its running costs. Drivers' morale fell. Move funds from the team budget.`);
  }
}

/** Season end: championships, ages, contracts, loans, seat plans, AI programmes. */
export function academySeasonEnd(state, currentYear) {
  const ac = ensureAcademy(state);

  // Close junior championships
  Object.keys(SERIES).forEach((sid) => {
    const table = standingsFor(state, sid);
    if (!table.races) return;
    trackedIn(state, sid).forEach(({ d, kind }) => {
      const row = table.rows.find((r) => r.name === d.name);
      if (!row || !d.juniorStats || d.juniorStats.series !== sid) return;
      const sl = SERIES[sid].sl[row.pos - 1] || 0;
      const entry = { year: currentYear, series: sid, pos: row.pos, points: d.juniorStats.points, wins: d.juniorStats.wins, podiums: d.juniorStats.podiums, starts: d.juniorStats.starts, team: kind === "loan" ? d.loanStatus?.team : d.juniorTeam };
      d.juniorHistory = [entry, ...(d.juniorHistory || [])].slice(0, 12);
      if (sl) d.slHistory = [...(d.slHistory || []), { year: currentYear, series: sid, pts: sl }].slice(-6);
      if (kind === "academy" || kind === "loan") {
        d.careerTimeline.unshift({ seasonYear: currentYear, event: `${SERIES[sid].label} P${row.pos}`, detail: `${entry.points} points, ${entry.wins} wins, ${entry.podiums} podiums${sl ? `, ${sl} Super Licence points` : ""}` });
        if (row.pos === 1) { ac.stats.titles++; addRep(state, 5, `${d.name} won the ${SERIES[sid].label} title`); gainXP(state, 40); pushNews(state, "title", `${d.name} is the ${SERIES[sid].label} champion.`, d.name); }
        else pushNews(state, "race", `${d.name} finished the ${SERIES[sid].label} season P${row.pos} with ${entry.points} points.`, d.name);
      }
    });
  });

  // Age everyone in the junior world
  [...ac.prospects, ...ac.loanedOut, ...ac.market, ...Object.values(ac.aiJuniors).flat()].forEach((d) => { d.age = (d.age || 17) + 1; });

  // Loans ending this season come back for review
  for (const d of [...ac.loanedOut]) {
    if ((d.loanStatus?.endYear ?? d.loanStatus?.seasonYear) <= currentYear) {
      const lp = loanProgress(state, d);
      ac.loanReviews = [...ac.loanReviews.filter((r) => r.name !== d.name), { name: d.name, team: d.loanStatus.team, series: d.loanStatus.series, year: currentYear, devGain: lp.devGain, objectives: lp.objectives.map((o) => ({ label: o.label, met: o.met })) }];
      const met = lp.objectives.filter((o) => o.met).length;
      endLoan(state, d, `Loan complete: ${met} of ${lp.objectives.length} objectives met, overall ${lp.devGain >= 0 ? "+" : ""}${lp.devGain}.`, met ? 3 : -2);
    }
  }

  // Contracts
  for (const d of [...ac.prospects]) {
    if (d.contractYearsRemaining > 0) d.contractYearsRemaining--;
    if (d.contractYearsRemaining <= 0) {
      ac.prospects = ac.prospects.filter((x) => x.name !== d.name);
      d.driverRole = null; d.roleLabel = "Junior driver"; d.programme = null;
      ac.market.push(d);
      pushNews(state, "departure", `${d.name} left the academy: their contract expired.`, d.name);
    } else if (d.contractYearsRemaining === 1) pushNews(state, "contract", `${d.name} enters the final season of their academy contract.`, d.name);
  }
  ac.loanedOut.forEach((d) => { if (d.contractYearsRemaining > 0) d.contractYearsRemaining--; });

  // Agreed race seats
  for (const p of ac.seatPlans.filter((x) => x.year <= currentYear + 1)) {
    const res = promoteToRaceSeat(state, p.name, p.replace);
    if (!res.ok) pushNews(state, "promotion", `${p.name}'s planned race seat fell through: ${res.text}`, p.name);
  }
  ac.seatPlans = ac.seatPlans.filter((x) => x.year > currentYear + 1);

  aiSeasonEnd(state);

  // Market turnover: older unsigned drivers leave junior racing, new karting talent appears
  ac.market = ac.market.filter((d) => d.age <= 24 || potential(d) - ovr(d) > 4);
  for (let i = 0; i < 4; i++) addMarketProspect(state, null, { k: 0, ageRange: [15, 16], tier: Math.random() < 0.3 ? "advanced" : "basic" });
  // Series moves for unsigned drivers who outgrew their championship
  ac.market.forEach((d) => { const nx = nextSeries(d); if (nx && ovr(d) >= SERIES[nx].field - 1) { d.series = nx; d.juniorTeam = pick(JUNIOR_TEAMS[nx]); } });

  ac.juniors = {};
  ac.reputation = clamp(Math.round(ac.repScore / 20), 1, 5);
  checkObjectives(state);
}
