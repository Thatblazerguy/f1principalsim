/**
 * transferMarket.js
 * ─────────────────
 * Driver Market 2.0: transfer interest, approaches, transfer fees, personal
 * terms, pre-contract agreements, scouting, AI recruitment and the news feed.
 *
 * Sources of truth stay where they were:
 *   - drivers live on teams (state.team / state.aiTeams), in the academy, or in
 *     the shared pool (data/drivers.js). This module never copies a driver into
 *     its own store; it keys everything by driver name.
 *   - money moves through team.budget, the same field the finance system uses.
 *   - player salaries keep being charged by financeSystem (salary ÷ 24 a race).
 *
 * Everything this module owns is in state.transferMarket, which the existing
 * save system persists (state.js restores unknown top-level keys).
 *
 * Randomness is seeded from names and days, so the same situation always
 * produces the same labels and answers.
 */

import { drivers as POOL } from "../data/drivers.js";
import { Driver } from "./driver.js";
import { ensureFinanceState } from "../utils/financeSystem.js";
import { constructorEntries } from "../utils/championshipModel.js";
import { ensureTeamState, setTeamActiveDrivers } from "../utils/teamState.js";

// ─── Tuning ──────────────────────────────────────────────────────────────────
export const INTEREST_WEIGHTS = {
  contract: 0.25,
  teamCompetitiveness: 0.15,
  satisfaction: 0.15,
  ambition: 0.15,
  attractiveness: 0.20,
  salary: 0.10,
};
export const INTEREST_BANDS = [
  { min: 90, label: "Highly interested", tone: "pos" },
  { min: 75, label: "Interested", tone: "pos" },
  { min: 60, label: "Open to discussions", tone: "pos" },
  { min: 40, label: "Monitoring opportunities", tone: "mid" },
  { min: 20, label: "Very unlikely", tone: "neg" },
  { min: 0, label: "Unavailable", tone: "neg" },
];
export const SCOUT_LEVELS = [
  { level: 0, label: "Not scouted", points: 0 },
  { level: 1, label: "Initial observation", points: 8 },
  { level: 2, label: "Partial assessment", points: 22 },
  { level: 3, label: "Detailed assessment", points: 45 },
  { level: 4, label: "Comprehensive report", points: 75 },
];
const SCOUT_ASSIGNMENT_COST = 0.3; // $M per assignment
const NEWS_LIMIT = 60;
const ATTRS = ["pace", "quali", "racecraft", "consistency", "tyre", "wet"];

// ─── Small helpers ───────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round((v || 0) * 10) / 10;
const half = (v) => Math.round((v || 0) * 2) / 2;
export function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const seeded = (key) => (hash(key) % 10000) / 10000;

export function overall(d) {
  if (!d) return 0;
  return Math.round(ATTRS.reduce((s, k) => s + (Number(d[k]) || Number(d.pace) || 70), 0) / ATTRS.length);
}
export const potentialOf = (d) => Math.max(overall(d), Math.round(d?.potentialCeiling ?? overall(d) + 3));

/** Market value in $M from rating, age, potential and the market (popularity) stat. */
export function marketValue(d) {
  const o = overall(d);
  const p = potentialOf(d);
  const age = d?.age ?? 28;
  const ageF = age <= 22 ? 1.15 : age <= 29 ? 1.05 : age <= 33 ? 0.9 : age <= 36 ? 0.65 : 0.4;
  const growth = Math.max(0, p - o) * (age <= 24 ? 0.9 : 0.3);
  const base = Math.pow(Math.max(0, o - 68 + growth * 0.5), 1.6) * 0.33;
  return r1(Math.max(0.5, base * ageF * ((d?.market ?? 75) / 80)));
}
/** What the driver thinks they're worth per season. Anchored on their current salary. */
export function expectedSalary(d) {
  const o = overall(d);
  const formula = Math.pow(Math.max(0, o - 70), 1.5) * 0.28 * ((d?.market ?? 75) / 80);
  return half(Math.max(0.5, ((d?.salary ?? formula) + formula) / 2));
}
export const bonusExpectation = (d) => half(Math.max(0.5, d?.signingFee ?? expectedSalary(d) * 0.6));
export const preferredYears = (d) => ((d?.age ?? 28) <= 24 ? 3 : (d?.age ?? 28) <= 31 ? 2 : 1);

function progress(state) {
  const total = state.season?.totalRounds || state.season?.calendar?.length || 24;
  return clamp(((state.season?.round || 1) - 1) / total, 0, 1);
}
const day = (state) => state.season?.currentDay || 1;
const year = (state) => state.season?.year || 1;

// ─── State ───────────────────────────────────────────────────────────────────
export function ensureMarket(state) {
  if (!state.transferMarket || typeof state.transferMarket !== "object") {
    state.transferMarket = {
      v: 1, initialised: false, shortlist: [], scouting: {}, talks: {}, relations: {},
      preContracts: [], news: [], retired: [], pool: {}, snapshots: {}, lastDay: 0, lastAiDay: 0, seasonEnd: 0,
    };
  }
  const m = state.transferMarket;
  for (const k of ["shortlist", "preContracts", "news", "retired"]) if (!Array.isArray(m[k])) m[k] = [];
  for (const k of ["scouting", "talks", "relations", "pool", "snapshots"]) if (!m[k] || typeof m[k] !== "object") m[k] = {};
  if (!m.initialised) {
    for (const t of state.aiTeams || []) {
      ensureTeamState(t);
      if (!(t.budget > 0)) t.budget = Math.round(40 + ((t.carPerformance || 85) - 80) * 3);
      for (const d of roster(t)) {
        const h = hash(d.name) % 3;
        let years = 1 + h;
        if ((d.age ?? 28) >= 35) years = Math.min(years, 2);
        if (overall(d) >= 90) years = Math.max(years, 2);
        d.contractYearsRemaining = years;
      }
    }
    m.initialised = true;
  }
  applyPoolOverrides(state);
  return m;
}

const roster = (t) => [...(t?.drivers || []), ...(t?.reserveDriver ? [t.reserveDriver] : [])];
export const allTeams = (state) => [state.team, ...(state.aiTeams || [])].filter(Boolean);

export function findDriver(state, name) {
  for (const t of allTeams(state)) {
    const race = (t.drivers || []).find((d) => d.name === name);
    if (race) return { driver: race, team: t, role: "race", isPlayer: t === state.team };
    if (t.reserveDriver?.name === name) return { driver: t.reserveDriver, team: t, role: "reserve", isPlayer: t === state.team };
  }
  const ac = (state.academy?.prospects || []).find((d) => d.name === name);
  if (ac) return { driver: ac, team: state.team, role: "academy", isPlayer: true };
  const p = POOL.find((d) => d.name === name);
  if (p && !isRetired(state, name)) return { driver: p, team: null, role: "free", isPlayer: false };
  return null;
}
export const isRetired = (state, name) => (state.transferMarket?.retired || []).includes(name);

function assignedNames(state) {
  const s = new Set();
  allTeams(state).forEach((t) => roster(t).forEach((d) => s.add(d.name)));
  (state.academy?.prospects || []).forEach((d) => s.add(d.name));
  (state.academy?.loanedOut || []).forEach((d) => s.add(d.name));
  return s;
}

export function freeAgents(state) {
  const taken = assignedNames(state);
  return POOL.filter((d) => !taken.has(d.name) && !isRetired(state, d.name) && d.category !== "F2");
}
export function prospects(state) {
  const taken = assignedNames(state);
  return POOL.filter((d) => !taken.has(d.name) && !isRetired(state, d.name) && d.category === "F2");
}
export function contractedDrivers(state) {
  return (state.aiTeams || []).flatMap((t) => [
    ...(t.drivers || []).map((d) => ({ driver: d, team: t, role: "race" })),
    ...(t.reserveDriver ? [{ driver: t.reserveDriver, team: t, role: "reserve" }] : []),
  ]);
}

// Pool drivers (free agents, F2) aren't saved on a team, so their changes are
// stored here and re-applied to the shared pool on every load.
const POOL_FIELDS = ["pace", "quali", "racecraft", "consistency", "tyre", "wet", "adaptability", "age", "category", "salary", "market",
  "potentialCeiling", "contractYearsRemaining", "morale", "roleLabel", "developmentRate", "signingFee", "contractType", "driverRole"];
function snapshot(d) { const o = {}; POOL_FIELDS.forEach((k) => { if (d[k] !== undefined) o[k] = d[k]; }); o.name = d.name; return o; }
export function recordPool(state, d) {
  const m = state.transferMarket;
  m.pool[d.name] = snapshot(d);
  const existing = POOL.find((p) => p.name === d.name);
  if (existing && existing !== d) Object.assign(existing, m.pool[d.name]);
  if (!existing) POOL.push(d);
}
function applyPoolOverrides(state) {
  const m = state.transferMarket;
  for (const [name, snap] of Object.entries(m.pool)) {
    const existing = POOL.find((p) => p.name === name);
    if (existing) Object.assign(existing, snap);
    else {
      const d = new Driver(name, snap.pace, snap.quali, snap.racecraft, snap.tyre, snap.wet, snap.consistency, snap.market, snap.salary, snap.age, snap.category);
      Object.assign(d, snap);
      POOL.push(d);
    }
  }
}

export function pushNews(state, item) {
  const m = ensureMarket(state);
  m.news.unshift({ id: `${year(state)}-${day(state)}-${m.news.length}-${hash(item.text) % 997}`, day: day(state), year: year(state), ...item });
  if (m.news.length > NEWS_LIMIT) m.news.length = NEWS_LIMIT;
}

// ─── Team competitiveness and attractiveness ────────────────────────────────
export function teamRanking(state) {
  const teams = allTeams(state);
  const pts = state.standings?.teams || {};
  const anyPoints = Object.values(pts).some((v) => v > 0);
  const byCar = (a, b) => (b.carPerformance || 0) - (a.carPerformance || 0);
  if (!anyPoints) return [...teams].sort(byCar);
  // Official constructors' order (with count-back on ties), then anyone unranked by car
  let order = [];
  try { order = constructorEntries(state).map(([name]) => name); } catch (_) { order = []; }
  const rank = (t) => { const i = order.indexOf(t.name); return i < 0 ? Infinity : i; };
  return [...teams].sort((a, b) => (rank(a) - rank(b)) || ((pts[b.name] || 0) - (pts[a.name] || 0)) || byCar(a, b));
}
const rankOf = (state, team) => Math.max(1, teamRanking(state).findIndex((t) => t.name === team?.name) + 1);

/** Points-per-race trend for a team: last three races against the season average before them. */
function teamTrend(state, team) {
  const yr = year(state);
  const races = (state.raceHistory || []).filter((r) => (r.season ?? yr) === yr);
  if (races.length < 4) return 0;
  const per = races.map((r) => (r.driverResults || []).filter((d) => d.team === team.name).reduce((s, d) => s + (d.points || 0), 0));
  const recent = per.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const before = per.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, per.length - 3);
  return recent - before;
}

function facilitiesScore(state, team) {
  if (team === state.team) {
    const f = ensureFinanceState(state).facilities || {};
    const levels = Object.values(f).map((x) => x.level || 1);
    return levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length / 5 : 0.2;
  }
  const levels = Object.values(team.finance?.facilities || {}).map((x) => x?.level || 1);
  return levels.length ? levels.reduce((a, b) => a + b, 0) / Math.max(levels.length, 8) / 5 : 0.2;
}

/** Seats a team can offer: race seats free now, reserve free now. */
export function openSeats(team) {
  return { race: Math.max(0, 2 - (team?.drivers?.length || 0)), reserve: team?.reserveDriver ? 0 : 1 };
}
/** Race seats free next season: drivers whose deal runs past this season hold theirs; agreed pre-contracts take one. */
export function futureSeats(state, team) {
  const keeps = (team.drivers || []).filter((d) => (d.contractYearsRemaining ?? 2) >= 2).length;
  const keepsReserve = team.reserveDriver && (team.reserveDriver.contractYearsRemaining ?? 2) >= 2 ? 1 : 0;
  const pcs = (state.transferMarket?.preContracts || []).filter((p) => p.toTeam === team.name);
  return {
    race: Math.max(0, 2 - keeps - pcs.filter((p) => p.role === "race").length),
    reserve: Math.max(0, 1 - keepsReserve - pcs.filter((p) => p.role === "reserve").length),
  };
}

/** 0–100 recruitment pull of a team, with the parts that make it up. */
export function teamAttractiveness(state, team) {
  const n = allTeams(state).length;
  const rank = rankOf(state, team);
  const budget = team === state.team ? state.team.budget : team.budget;
  const rep = team === state.team ? ensureFinanceState(state).reputation : clamp(40 + (team.carPerformance - 80) * 3);
  const seats = openSeats(team);
  const fut = futureSeats(state, team);
  const parts = [
    { label: "Championship position", value: (1 - (rank - 1) / Math.max(1, n - 1)) * 35 },
    { label: "Financial strength", value: clamp((budget || 0) / 120, 0, 1) * 15 },
    { label: "Facilities", value: facilitiesScore(state, team) * 15 },
    { label: "Reputation", value: (rep / 100) * 15 },
    { label: "Seats on offer", value: seats.race || fut.race ? 20 : seats.reserve ? 10 : 0 },
  ];
  return { score: Math.round(parts.reduce((s, p) => s + p.value, 0)), parts };
}

// ─── Driver satisfaction ────────────────────────────────────────────────────
/** 0–100. Built from saved morale plus results, teammate, pay and role. */
export function satisfaction(state, d, team, role) {
  if (!team) return { score: clamp(d.morale ?? 70), parts: [{ label: "Morale", value: d.morale ?? 70 }] };
  const pts = state.standings?.drivers || {};
  const mate = (team.drivers || []).find((x) => x.name !== d.name);
  let mateF = 50;
  if (mate) {
    const mine = pts[d.name] || 0; const theirs = pts[mate.name] || 0;
    mateF = mine + theirs > 0 ? clamp(50 + ((mine - theirs) / (mine + theirs)) * 50) : clamp(50 + (overall(d) - overall(mate)) * 4);
  }
  const pay = clamp(50 + ((d.salary || 0) / Math.max(0.5, expectedSalary(d)) - 1) * 100);
  const roleF = role === "reserve" ? 25 : 80;
  const teamF = (1 - (rankOf(state, team) - 1) / Math.max(1, allTeams(state).length - 1)) * 100;
  const parts = [
    { label: "Morale", value: d.morale ?? 75, w: 0.35 },
    { label: "Against teammate", value: mateF, w: 0.15 },
    { label: "Salary", value: pay, w: 0.15 },
    { label: "Role", value: roleF, w: 0.2 },
    { label: "Team results", value: teamF, w: 0.15 },
  ];
  return { score: Math.round(parts.reduce((s, p) => s + p.value * p.w, 0)), parts };
}

// ─── Transfer interest ──────────────────────────────────────────────────────
export const bandFor = (score) => INTEREST_BANDS.find((b) => score >= b.min);

/**
 * How willing `name` is to join `toTeam` (default: the player).
 * Every input is 0–100 and the reasons come back with it for scouting reports.
 */
export function assessInterest(state, name, toTeam = state.team) {
  ensureMarket(state);
  const loc = findDriver(state, name);
  if (!loc) return null;
  const { driver: d, team, role } = loc;
  const m = state.transferMarket;
  const prog = progress(state);
  const years = team ? d.contractYearsRemaining ?? 2 : 0;
  const reasons = [];
  const n = allTeams(state).length;

  // A. Contract situation
  let contract;
  if (!team) contract = 100;
  else if (years >= 3) contract = 8;
  else if (years === 2) contract = 28;
  else contract = prog < 0.5 ? 55 : 82;
  reasons.push(!team ? "Free agent: no contract to buy out" : years >= 3 ? `${years} seasons left on the deal` : years === 2 ? "Two seasons left on the deal" : prog < 0.5 ? "In the final season of the deal" : "Final months of the deal");

  // B. Current team competitiveness (worse team → more willing)
  let teamComp = 50;
  if (team && team !== toTeam) {
    const rank = rankOf(state, team);
    teamComp = ((rank - 1) / Math.max(1, n - 1)) * 70;
    const trend = teamTrend(state, team);
    if (trend < -2) { teamComp += 15; reasons.push(`${team.name} are scoring less than earlier in the season`); }
    else if (trend > 2) teamComp -= 10;
    const pts = state.standings?.drivers || {};
    const mate = (team.drivers || []).find((x) => x.name !== d.name);
    if (mate && (pts[mate.name] || 0) > (pts[d.name] || 0) + 10) { teamComp += 10; reasons.push("Being outscored by the teammate"); }
    teamComp = clamp(teamComp);
    if (rank <= 2) reasons.push(`${team.name} are ${rank === 1 ? "leading" : "second in"} the championship`);
  }

  // C. Satisfaction (dissatisfied → more willing)
  const sat = satisfaction(state, d, team, role);
  const unhappiness = 100 - sat.score;
  if (sat.score < 45) reasons.push("Unhappy at the current team");
  if (role === "reserve") reasons.push("Wants a race seat, currently a reserve");

  // D. Career ambition alignment with the destination
  const o = overall(d); const age = d.age ?? 28;
  const destRank = rankOf(state, toTeam); const curRank = team ? rankOf(state, team) : n;
  const seats = openSeats(toTeam); const fut = futureSeats(state, toTeam);
  const raceSeat = seats.race > 0 || fut.race > 0;
  let ambition; let stage;
  if (age <= 23) { stage = "Young prospect"; ambition = (raceSeat ? 70 : 30) + (toTeam === state.team ? (state.academy?.level || 1) * 4 : 8); }
  else if (o >= 88 && age <= 33) { stage = "Prime, title ambitions"; ambition = clamp(50 + (curRank - destRank) * 12); }
  else if (age >= 34) { stage = "Veteran"; ambition = clamp(clamp(((toTeam.budget || 0) / 120) * 100) * 0.6 + (raceSeat ? 40 : 20)); }
  else { stage = "Established driver"; ambition = clamp(50 + (curRank - destRank) * 8 + (raceSeat ? 15 : 0)); }
  ambition = clamp(ambition);

  // E. Destination attractiveness
  const attr = teamAttractiveness(state, toTeam);

  // F. Salary opportunity
  const exp = expectedSalary(d);
  const afford = (toTeam.budget || 0) >= exp * 1.5 ? 65 : (toTeam.budget || 0) >= exp ? 40 : 10;
  const underpaid = clamp(((exp - (d.salary || 0)) / Math.max(0.5, exp)) * 100, 0, 35);
  const salaryOpp = clamp(afford + underpaid);

  const comp = { contract, teamCompetitiveness: teamComp, satisfaction: unhappiness, ambition, attractiveness: attr.score, salary: salaryOpp };
  let score = Object.entries(INTEREST_WEIGHTS).reduce((s, [k, w]) => s + comp[k] * w, 0);
  const talk = m.talks[name];
  if (talk?.courted && day(state) - talk.courted < 30 && toTeam === state.team) { score += 5; reasons.push("You've told them you're interested"); }
  const pc = m.preContracts.find((p) => p.driver === name);
  if (pc && pc.toTeam !== toTeam.name) { score = 0; reasons.unshift(`Agreed to join ${pc.toTeam} next season`); }
  score = Math.round(clamp(score));
  return {
    name, score, band: bandFor(score), components: comp, weights: INTEREST_WEIGHTS, reasons, stage,
    satisfaction: sat, attractiveness: attr, team, role, years, requiresRaceSeat: (age <= 30 && o >= 82) || role === "race",
  };
}

// ─── Selling team stance ────────────────────────────────────────────────────
export function relationWith(state, teamName) {
  const m = ensureMarket(state);
  return m.relations[teamName] ?? 60;
}

/** Will the current team talk, and for how much? Free agents have no team to deal with. */
export function sellingStance(state, name, opts = {}) {
  const loc = findDriver(state, name);
  if (!loc?.team || loc.isPlayer) return { stance: "free", fee: 0, reasons: [] };
  const { driver: d, team, role } = loc;
  const m = ensureMarket(state);
  const years = d.contractYearsRemaining ?? 2;
  const best = Math.max(...(team.drivers || []).map(overall));
  const importance = role === "reserve" ? 0.6 : overall(d) >= best ? 1.3 : 1.0;
  const reserveOvr = team.reserveDriver && team.reserveDriver.name !== d.name ? overall(team.reserveDriver) : 0;
  const freeBest = Math.max(0, ...freeAgents(state).map(overall));
  const replacement = Math.max(reserveOvr, freeBest) >= overall(d) - 3;
  const needsMoney = (team.budget || 0) < 25;
  const rel = opts.relation ?? relationWith(state, team.name);
  const interest = assessInterest(state, name, opts.toTeam || state.team);
  const reasons = [];
  let w = 50 - importance * 20 - years * 8 + (rel - 60) * 0.5;
  if (replacement) { w += 15; reasons.push("They have a ready replacement"); } else reasons.push("No like-for-like replacement available");
  if (needsMoney) { w += 15; reasons.push(`${team.name} need money`); }
  if (interest.score >= 75) { w += 10; reasons.push("The driver is pushing for a move"); }
  reasons.unshift(importance > 1 ? "Their lead driver" : role === "reserve" ? "Reserve driver, less important to them" : "A race driver for them");
  if (rel < 45) reasons.push("Relationship with you is strained");
  const value = marketValue(d);
  let fee = half(value * (0.3 + 0.25 * years) * importance * (needsMoney ? 0.85 : 1));
  const stance = !opts.toTeam && m.talks[name]?.suspendedUntil > day(state) ? "suspended" : w < 22 ? "refuse" : w < 52 ? "fee" : "open";
  if (stance === "open") fee = half(fee * 0.85);
  return { stance, fee: Math.max(1, fee), value, years, importance, reasons, willingness: Math.round(clamp(w)) };
}

export function availabilityLabel(state, name, a = assessInterest(state, name), st = sellingStance(state, name)) {
  const m = ensureMarket(state);
  const pc = m.preContracts.find((p) => p.driver === name);
  if (pc) return { label: pc.toTeam === state.team?.name ? "Joining you next season" : `Joining ${pc.toTeam}`, tone: pc.toTeam === state.team?.name ? "pos" : "neutral" };
  if (st.stance === "free") return { label: "Free agent", tone: "pos" };
  if (a.years <= 1 && progress(state) >= 0.5) return { label: "Contract expiring", tone: "pos" };
  if (st.stance === "suspended") return { label: "Talks suspended", tone: "neg" };
  if (a.score >= 60 && st.stance !== "refuse") return { label: "Transfer available", tone: "pos" };
  if (a.score >= 75) return { label: "Interested in your team", tone: "pos" };
  if (a.score < 20 || st.stance === "refuse" && a.score < 40) return { label: "Unavailable", tone: "neg" };
  if (a.score < 40) return { label: "Unlikely to move", tone: "neg" };
  if (a.score < 60) return { label: "Monitoring opportunities", tone: "mid" };
  return { label: "Open to offers", tone: "pos" };
}

// ─── Talks ──────────────────────────────────────────────────────────────────
function talk(state, name) {
  const m = ensureMarket(state);
  if (!m.talks[name]) m.talks[name] = { stage: "none", history: [], rejections: 0, feeRejections: 0 };
  return m.talks[name];
}
function log(state, name, entry) {
  const t = talk(state, name);
  t.history.unshift({ day: day(state), year: year(state), ...entry });
  if (t.history.length > 12) t.history.length = 12;
  t.lastDay = day(state);
}

/** What the driver demands from the player's team, given their interest. */
export function personalDemands(state, name) {
  const loc = findDriver(state, name);
  const a = assessInterest(state, name);
  const d = loc.driver;
  const f = a.score >= 75 ? 0.95 : a.score >= 60 ? 1.05 : 1.2;
  return {
    salary: half(expectedSalary(d) * f),
    bonus: half(bonusExpectation(d) * f),
    years: preferredYears(d),
    role: a.requiresRaceSeat ? "race" : "either",
  };
}

/** Informal enquiry: the driver's camp answers, nothing is committed. */
export function enquire(state, name) {
  const a = assessInterest(state, name);
  const st = sellingStance(state, name);
  const dem = personalDemands(state, name);
  const seats = openSeats(state.team); const fut = futureSeats(state, state.team);
  let code; let text;
  if (a.score < 40) { code = "not_interested"; text = "Not interested in a move to your team."; }
  else if (a.years === 1 && progress(state) < 0.5 && a.score < 60) { code = "wait"; text = "Wants to wait until the end of the season before deciding."; }
  else if (dem.role === "race" && !seats.race && !fut.race) { code = "needs_seat"; text = "Interested, but only for a race seat, and you have none free now or next season."; }
  else if (dem.salary > (loc(state, name).driver.salary || 0) * 1.15) { code = "salary"; text = `Interested, but expects about $${dem.salary}M a season.`; }
  else { code = "willing"; text = "Willing to hear your proposal."; }
  let teamText = null;
  if (st.stance === "refuse") teamText = `${a.team.name} refuse to negotiate.`;
  else if (st.stance === "fee") teamText = `${a.team.name} would want a transfer fee, around $${st.fee}M.`;
  else if (st.stance === "open") teamText = `${a.team.name} are open to negotiations.`;
  else if (st.stance === "suspended") teamText = `${a.team.name} have suspended talks with you.`;
  const t = talk(state, name);
  if (t.stage === "none") t.stage = "enquired";
  log(state, name, { kind: "enquiry", text: [text, teamText].filter(Boolean).join(" ") });
  return { code, text, teamText, interest: a, stance: st, demands: dem };
}
const loc = (state, name) => findDriver(state, name);

/** Tell the driver you want them: +5 interest for 30 days, and their team notices (−4 relationship). */
export function expressInterest(state, name) {
  const t = talk(state, name);
  t.courted = day(state);
  const l = findDriver(state, name);
  if (l?.team && !l.isPlayer) {
    const m = ensureMarket(state);
    m.relations[l.team.name] = clamp(relationWith(state, l.team.name) - 4);
  }
  log(state, name, { kind: "interest", text: "You told the driver's camp you're interested." });
  return { text: l?.team && !l.isPlayer ? `${name}'s camp knows you're interested. ${l.team.name} noticed: relationship −4.` : `${name}'s camp knows you're interested.` };
}

/**
 * Personal terms. Accepted when salary and bonus meet the demand and the role
 * fits; within 15% gets a counter at their demand; otherwise rejected.
 */
export function offerPersonalTerms(state, name, terms) {
  const a = assessInterest(state, name);
  const dem = personalDemands(state, name);
  const t = talk(state, name);
  let outcome; let text; let counter = null;
  if (a.score < 40) { outcome = "rejected"; text = "Not interested in joining your team."; }
  else if (dem.role === "race" && terms.role === "reserve") { outcome = "rejected"; text = "Will only consider a race seat."; }
  else if (terms.salary >= dem.salary && terms.bonus >= dem.bonus * 0.8) { outcome = "accepted"; text = "Personal terms agreed."; }
  else if (terms.salary >= dem.salary * 0.85) { outcome = "counter"; counter = { ...terms, salary: dem.salary, bonus: Math.max(terms.bonus, half(dem.bonus * 0.8)) }; text = `Counter: $${counter.salary}M a season, $${counter.bonus}M signing bonus.`; }
  else { outcome = "rejected"; text = `Too far below their $${dem.salary}M expectation.`; t.rejections += 1; }
  if (outcome === "accepted") { t.personal = { ...terms, agreed: true, day: day(state) }; t.stage = t.stage === "fee_agreed" ? "ready" : "terms_agreed"; }
  log(state, name, { kind: "terms", text: `Offered $${terms.salary}M × ${terms.years} (${terms.role}). ${text}` });
  return { outcome, text, counter, demands: dem };
}

/**
 * Transfer fee bid to the current team. At or above the ask: accepted. Within
 * 15%: counter at the ask. Under 60% of the ask is unreasonable (−8
 * relationship); other rejections −3. Three rejections or a relationship
 * under 30 suspends talks for 14 days.
 */
export function bidTransferFee(state, name, fee) {
  const st = sellingStance(state, name);
  const l = findDriver(state, name);
  const t = talk(state, name);
  const m = ensureMarket(state);
  if (st.stance === "free") return { outcome: "none", text: "Free agents have no transfer fee." };
  if (st.stance === "suspended") return { outcome: "suspended", text: `${l.team.name} won't talk until day ${t.suspendedUntil}.` };
  if (st.stance === "refuse") return { outcome: "rejected", text: `${l.team.name} refuse to negotiate.` };
  let outcome; let text; let counter = null;
  if (fee >= st.fee) { outcome = "accepted"; text = `${l.team.name} accept $${fee}M.`; }
  else if (fee >= st.fee * 0.85) { outcome = "counter"; counter = st.fee; text = `${l.team.name} counter at $${st.fee}M.`; }
  else {
    outcome = "rejected";
    const harsh = fee < st.fee * 0.6;
    m.relations[l.team.name] = clamp(relationWith(state, l.team.name) - (harsh ? 8 : 3));
    t.feeRejections += 1;
    text = harsh ? `${l.team.name} found that offer insulting. Relationship −8.` : `${l.team.name} rejected $${fee}M. Relationship −3.`;
    if (t.feeRejections >= 3 || relationWith(state, l.team.name) < 30) {
      t.suspendedUntil = day(state) + 14;
      outcome = "suspended"; text += ` Talks suspended for 14 days.`;
    }
  }
  if (outcome === "accepted") { t.fee = { amount: fee, agreed: true, day: day(state) }; t.stage = t.personal?.agreed ? "ready" : "fee_agreed"; }
  log(state, name, { kind: "fee", text: `Bid $${fee}M. ${text}` });
  return { outcome, text, counter, ask: st.fee };
}

/** What still blocks completing the deal. */
export function dealBlockers(state, name) {
  const l = findDriver(state, name);
  const t = state.transferMarket?.talks?.[name];
  const out = [];
  if (!l) return ["Driver not found"];
  if (state.transferMarket.preContracts.some((p) => p.driver === name)) out.push("Already has a pre-contract agreement");
  if (!t?.personal?.agreed) out.push("Agree personal terms first");
  if (l.team && !l.isPlayer && !t?.fee?.agreed) out.push("Agree a transfer fee with their team");
  const seats = openSeats(state.team);
  if (t?.personal?.role === "race" && !seats.race) out.push("No race seat free in your team");
  if (t?.personal?.role === "reserve" && !seats.reserve) out.push("Your reserve seat is taken");
  const cost = (t?.fee?.amount || 0) + (t?.personal?.bonus || 0);
  if ((state.team.budget || 0) < cost) out.push(`Needs $${r1(cost)}M; budget is $${r1(state.team.budget)}M`);
  return out;
}

/** Completes a deal: fee to the selling team, bonus paid, driver moves, seller refills. */
export function completeSigning(state, name) {
  const blockers = dealBlockers(state, name);
  if (blockers.length) return { ok: false, text: blockers[0] };
  const l = findDriver(state, name);
  const t = state.transferMarket.talks[name];
  const d = l.driver; const from = l.team && !l.isPlayer ? l.team : null;
  const fee = t.fee?.amount || 0; const bonus = t.personal.bonus || 0;
  state.team.budget = r1(state.team.budget - fee - bonus);
  if (from) {
    from.budget = r1((from.budget || 0) + fee);
    from.releaseDriver ? from.releaseDriver(d.name) : null;
    aiFillSeats(state, from);
  }
  d.salary = t.personal.salary; d.contractYearsRemaining = t.personal.years;
  d.contractType = t.personal.role === "race" ? "race" : "reserve";
  d.driverRole = t.personal.role === "race" ? (state.team.drivers.length ? "second" : "lead") : "reserve";
  d.roleLabel = t.personal.role === "race" ? "Race Driver" : "Reserve Driver";
  if (d.category === "F2" || d.category === "FREE") d.category = "F1";
  state.team.signDriver(d, t.personal.role === "race" ? "main" : "reserve");
  setTeamActiveDrivers(state.team, state.team.drivers.map((x) => x.name));
  state.signedSponsors = state.signedSponsors || {};
  delete state.transferMarket.pool[d.name];
  t.stage = "signed";
  state.transferMarket.shortlist = state.transferMarket.shortlist.filter((n) => n !== name);
  log(state, name, { kind: "signed", text: `Signed for $${t.personal.salary}M × ${t.personal.years}${fee ? `, $${fee}M fee` : ""}.` });
  pushNews(state, { type: "signing", driver: d.name, team: state.team.name, text: from ? `${d.name} joins ${state.team.name} from ${from.name} for $${fee}M.` : `${d.name} signs for ${state.team.name}.` });
  return { ok: true, text: from ? `${d.name} signed from ${from.name}: $${fee}M fee, $${bonus}M bonus, $${t.personal.salary}M a season for ${t.personal.years} seasons.` : `${d.name} signed: $${bonus}M bonus, $${t.personal.salary}M a season for ${t.personal.years} seasons.` };
}

// ─── Pre-contracts ──────────────────────────────────────────────────────────
export function preContractEligibility(state, name) {
  const l = findDriver(state, name);
  const m = ensureMarket(state);
  if (!l?.team || l.isPlayer) return { ok: false, reason: "Only for drivers under contract elsewhere" };
  if ((l.driver.contractYearsRemaining ?? 2) > 1) return { ok: false, reason: `Contract runs ${l.driver.contractYearsRemaining} more seasons` };
  if (progress(state) < 0.5) return { ok: false, reason: "Opens in the second half of their final season" };
  if (m.preContracts.some((p) => p.driver === name)) return { ok: false, reason: "Already agreed a future move" };
  return { ok: true };
}

/** Agree a move for next season. No fee: the driver arrives when their contract ends. */
export function agreePreContract(state, name, terms) {
  const el = preContractEligibility(state, name);
  if (!el.ok) return { outcome: "blocked", text: el.reason };
  const fut = futureSeats(state, state.team);
  if (terms.role === "race" && !fut.race) return { outcome: "blocked", text: "No race seat free next season. A seat is free when one of your race drivers is out of contract after this season." };
  if (terms.role === "reserve" && !fut.reserve) return { outcome: "blocked", text: "No reserve seat free next season." };
  const res = offerPersonalTerms(state, name, terms);
  if (res.outcome !== "accepted") return res;
  const l = findDriver(state, name);
  state.transferMarket.preContracts.push({ driver: name, fromTeam: l.team.name, toTeam: state.team.name, role: terms.role, salary: terms.salary, years: terms.years, bonus: terms.bonus, effectiveYear: year(state) + 1, agreedDay: day(state), agreedYear: year(state) });
  talk(state, name).stage = "pre_contract";
  pushNews(state, { type: "pre_contract", driver: name, team: state.team.name, text: `${name} agrees to join ${state.team.name} next season, leaving ${l.team.name} when that contract ends.` });
  return { outcome: "accepted", text: `Pre-contract agreed. ${name} joins next season; the $${terms.bonus}M bonus is committed and paid on arrival.` };
}
export const committedBonuses = (state) => r1((state.transferMarket?.preContracts || []).filter((p) => p.toTeam === state.team?.name).reduce((s, p) => s + (p.bonus || 0), 0));

// ─── Scouting ───────────────────────────────────────────────────────────────
export function scoutingCapability(state) {
  const f = ensureFinanceState(state);
  const alloc = f.budgetAllocation?.scouting ?? 5;
  const cap = clamp(30 + alloc * 3 + (state.academy?.level || 1) * 5, 30, 95);
  return { capability: Math.round(cap), slots: 1 + Math.floor(cap / 30), pointsPerDay: r1(cap / 45), allocation: alloc };
}
export function scoutLevel(state, name) {
  const l = findDriver(state, name);
  if (l?.isPlayer) return 4;
  const pts = state.transferMarket?.scouting?.[name]?.points || 0;
  return [...SCOUT_LEVELS].reverse().find((x) => pts >= x.points).level;
}
export const activeScouts = (state) => Object.entries(state.transferMarket?.scouting || {}).filter(([, s]) => s.active);

export function assignScout(state, name) {
  const m = ensureMarket(state);
  const cap = scoutingCapability(state);
  if (activeScouts(state).length >= cap.slots) return { ok: false, text: `All ${cap.slots} scouts are busy. Recall one first.` };
  if ((state.team.budget || 0) < SCOUT_ASSIGNMENT_COST) return { ok: false, text: "Not enough budget to send a scout." };
  if (scoutLevel(state, name) >= 4) return { ok: false, text: "Already fully scouted." };
  state.team.budget = r1(state.team.budget - SCOUT_ASSIGNMENT_COST);
  const cur = m.scouting[name] || { points: 0 };
  m.scouting[name] = { ...cur, active: true, startDay: day(state), startYear: year(state) };
  return { ok: true, text: `Scout assigned to ${name} ($${SCOUT_ASSIGNMENT_COST}M). Reports improve each day you simulate.` };
}
export function recallScout(state, name) {
  const m = ensureMarket(state);
  if (m.scouting[name]) m.scouting[name].active = false;
}

/**
 * What the player knows about a driver at their scouting level. Own drivers
 * are fully known. Range width shrinks with each level; hidden traits only
 * show on a comprehensive report.
 */
export function scoutView(state, name) {
  const l = findDriver(state, name);
  if (!l) return null;
  const d = l.driver; const lv = scoutLevel(state, name);
  const spread = [8, 5, 2, 0, 0][lv];
  // A range that contains the true value but isn't centred on it (seeded, so it doesn't jump around)
  const band = (v, s, k) => {
    if (!s) return Math.round(v);
    const off = Math.round((seeded(`${name}:${k}`) - 0.5) * s);
    return [clamp(Math.round(v) - s + off, 30, 99), clamp(Math.round(v) + s + off, 30, 99)];
  };
  const attrs = Object.fromEntries([...ATTRS, "adaptability"].map((k) => [k, lv >= 3 ? Math.round(d[k] ?? 0) : lv >= 2 ? band(d[k] ?? 0, spread, k) : null]));
  const o = overall(d);
  const potSpread = [14, 9, 5, 2, 0][lv];
  return {
    level: lv, label: SCOUT_LEVELS[lv].label,
    overall: band(o, spread || 0, "ovr"),
    potential: band(potentialOf(d), potSpread, "pot"),
    attrs,
    salaryExpectation: lv >= 2 ? expectedSalary(d) : null,
    satisfaction: lv >= 3 ? satisfaction(state, d, l.team && !l.isPlayer ? l.team : null, l.role) : null,
    interest: lv >= 3 ? assessInterest(state, name) : null,
    hidden: lv >= 4 ? d.hiddenTraits || null : null,
    personality: lv >= 4 ? { personality: d.personality || null, style: d.preferredStyle || null, feedback: d.feedback ?? null, mentality: d.mentality ?? null } : null,
    progress: state.transferMarket?.scouting?.[name]?.points || 0,
    nextAt: SCOUT_LEVELS[Math.min(4, lv + 1)].points,
  };
}

// ─── Free agents and prospects ──────────────────────────────────────────────
/** Free agents and prospects: personal terms then signing in one step. */
export function signFreeDriver(state, name, terms) {
  const l = findDriver(state, name);
  if (!l || l.team) return { outcome: "blocked", text: "Not a free agent." };
  const seats = openSeats(state.team);
  if (terms.role === "race" && !seats.race) return { outcome: "blocked", text: "No race seat free." };
  if (terms.role === "reserve" && !seats.reserve) return { outcome: "blocked", text: "Reserve seat taken." };
  if ((state.team.budget || 0) < terms.bonus) return { outcome: "blocked", text: `Needs $${terms.bonus}M for the signing bonus.` };
  const res = offerPersonalTerms(state, name, terms);
  if (res.outcome !== "accepted") return res;
  const done = completeSigning(state, name);
  return done.ok ? { outcome: "signed", text: done.text } : { outcome: "blocked", text: done.text };
}

/** Sign an F2 prospect into the academy as a development driver. */
export function signDevelopmentDriver(state, name, maxAcademySize) {
  const l = findDriver(state, name);
  if (!l || l.team || l.driver.category !== "F2") return { ok: false, text: "Only unsigned F2 prospects." };
  const ac = state.academy;
  if (!ac) return { ok: false, text: "No academy." };
  if ((ac.prospects?.length || 0) >= maxAcademySize) return { ok: false, text: `Academy full (${maxAcademySize}).` };
  const fee = half(bonusExpectation(l.driver) * 0.5);
  if ((state.team.budget || 0) < fee) return { ok: false, text: `Needs $${fee}M.` };
  state.team.budget = r1(state.team.budget - fee);
  const d = l.driver;
  d.driverRole = "academy"; d.roleLabel = "Academy Prospect"; d.contractType = "academy"; d.contractYearsRemaining = 3;
  d.careerTimeline = d.careerTimeline || [];
  d.careerTimeline.unshift({ seasonYear: year(state), event: "Joined academy", detail: `Signed as a development driver for $${fee}M.` });
  ac.prospects = ac.prospects || [];
  ac.prospects.push(d);
  delete state.transferMarket.pool[name];
  pushNews(state, { type: "signing", driver: name, team: state.team.name, text: `${name} joins the ${state.team.name} academy.` });
  return { ok: true, text: `${name} joins your academy for $${fee}M on a three-season development deal.` };
}

// ─── AI recruitment ─────────────────────────────────────────────────────────
function aiCanAfford(team, d) {
  return (team.budget || 0) >= bonusExpectation(d) + (d.salary || 0) * 0.5;
}
/** Fill empty AI seats: promote a strong reserve, else sign the best affordable free driver. Same money rules as the player. */
export function aiFillSeats(state, team) {
  ensureMarket(state);
  ensureTeamState(team);
  const pick = (forRace) => {
    const pool = [...freeAgents(state), ...prospects(state)].filter((d) => !state.transferMarket.preContracts.some((p) => p.driver === d.name));
    const scored = pool.map((d) => ({ d, s: overall(d) * 0.75 + potentialOf(d) * (forRace ? 0.15 : 0.3) - (d.salary || 0) * 0.15 }))
      .sort((a, b) => b.s - a.s);
    return (scored.find((x) => aiCanAfford(team, x.d)) || scored[scored.length - 1])?.d;
  };
  while ((team.drivers || []).length < 2) {
    const best = pick(true);
    if (team.reserveDriver && (!best || overall(team.reserveDriver) >= overall(best) - 1)) {
      const r = team.reserveDriver; team.reserveDriver = null; r.driverRole = "second"; r.contractType = "race"; team.drivers.push(r);
      pushNews(state, { type: "promotion", driver: r.name, team: team.name, text: `${team.name} promote reserve ${r.name} to a race seat.` });
      continue;
    }
    if (!best) break;
    aiSign(state, team, best, "race");
  }
  if (!team.reserveDriver) { const r = pick(false); if (r) aiSign(state, team, r, "reserve"); }
}
function aiSign(state, team, d, role) {
  const bonus = bonusExpectation(d);
  team.budget = r1(Math.max(0, (team.budget || 0) - (aiCanAfford(team, d) ? bonus : 0)));
  d.contractYearsRemaining = preferredYears(d);
  d.contractType = role === "race" ? "race" : "reserve";
  d.driverRole = role === "race" ? "second" : "reserve";
  if (d.category === "FREE") d.category = "F1";
  team.signDriver(d, role === "race" ? "main" : "reserve");
  delete state.transferMarket.pool[d.name];
  pushNews(state, { type: "ai_signing", driver: d.name, team: team.name, text: `${team.name} sign ${d.name}${role === "reserve" ? " as reserve" : ""}.` });
}

function releaseToPool(state, team, d, why) {
  team.releaseDriver(d.name);
  d.category = (d.age ?? 25) <= 23 && overall(d) < 84 ? "F2" : "FREE";
  d.contractYearsRemaining = 0; d.driverRole = null; d.roleLabel = "Free Agent";
  recordPool(state, d);
  pushNews(state, { type: "release", driver: d.name, team: team.name, text: why });
}

/** Late-season AI pre-contracts: a team with a future seat agrees terms with an interested driver in the final year of a contract. */
function aiPreContracts(state) {
  const m = state.transferMarket;
  if (progress(state) < 0.5) return;
  const candidates = contractedDrivers(state).filter(({ driver: d }) => (d.contractYearsRemaining ?? 2) <= 1 && !m.preContracts.some((p) => p.driver === d.name));
  for (const team of state.aiTeams || []) {
    const fut = futureSeats(state, team);
    if (!fut.race) continue;
    const options = candidates.filter((c) => c.team !== team)
      .map((c) => ({ ...c, a: assessInterest(state, c.driver.name, team) }))
      .filter((c) => c.a.score >= 70 && aiCanAfford(team, c.driver))
      .sort((x, y) => overall(y.driver) - overall(x.driver));
    const target = options[0];
    if (!target) continue;
    const worst = Math.min(...(team.drivers || []).map(overall));
    if (overall(target.driver) < worst) continue;
    const salary = expectedSalary(target.driver);
    m.preContracts.push({ driver: target.driver.name, fromTeam: target.team.name, toTeam: team.name, role: "race", salary, years: preferredYears(target.driver), bonus: bonusExpectation(target.driver), effectiveYear: year(state) + 1, agreedDay: day(state), agreedYear: year(state) });
    pushNews(state, { type: "pre_contract", driver: target.driver.name, team: team.name, text: `${target.driver.name} agrees to join ${team.name} next season when the ${target.team.name} contract ends.` });
    return; // one per tick
  }
}

// ─── Daily tick ─────────────────────────────────────────────────────────────
/** Called once per simulated day (utils/seasonTimeline.simulateNextDay). */
export function processMarketDay(state) {
  const m = ensureMarket(state);
  if (!state.team) return;
  const today = day(state);
  if (m.lastDay === today && m.lastYear === year(state)) return;
  m.lastDay = today; m.lastYear = year(state);

  // Scouting progress
  const cap = scoutingCapability(state);
  for (const [name, s] of activeScouts(state)) {
    const before = scoutLevel(state, name);
    s.points = r1((s.points || 0) + cap.pointsPerDay);
    const after = scoutLevel(state, name);
    if (after > before) pushNews(state, { type: "scouting", driver: name, text: `Scouting on ${name}: ${SCOUT_LEVELS[after].label.toLowerCase()} ready.` });
    if (after >= 4) s.active = false;
  }

  // Interest changes and contract reminders for drivers you follow
  const followed = new Set([...m.shortlist, ...Object.keys(m.talks)]);
  for (const name of followed) {
    const a = assessInterest(state, name);
    if (!a) continue;
    const prev = m.snapshots[name];
    if (prev && prev.band !== a.band.label) {
      pushNews(state, { type: "reminder", driver: name, text: `${name}: interest changed from ${prev.band.toLowerCase()} to ${a.band.label.toLowerCase()}.` });
    }
    const expiring = a.team && a.years <= 1 && progress(state) >= 0.5;
    if (expiring && !prev?.expiring) pushNews(state, { type: "reminder", driver: name, text: `${name}'s contract with ${a.team.name} is in its final months. Pre-contract talks are open.` });
    m.snapshots[name] = { band: a.band.label, score: a.score, expiring };
  }

  // AI activity every two weeks
  if (today - (m.lastAiDay || 0) >= 14 || today < (m.lastAiDay || 0)) {
    m.lastAiDay = today;
    aiPreContracts(state);
    for (const t of state.aiTeams || []) if ((t.drivers || []).length < 2 || !t.reserveDriver) aiFillSeats(state, t);
  }
}

// ─── Season end ─────────────────────────────────────────────────────────────
/**
 * Runs once when the season ends (offseason screen). Contracts tick down,
 * agreed moves happen, AI teams renew or release, veterans retire, prospects
 * develop, AI teams recruit and their budgets settle. Every change is news.
 */
export function processMarketSeasonEnd(state) {
  const m = ensureMarket(state);
  const yr = year(state);
  if (m.seasonEnd === yr) return { processed: false };
  const pts = state.standings?.drivers || {};

  // Morale follows results for AI drivers (player morale has its own systems)
  for (const t of state.aiTeams || []) {
    const [a, b] = t.drivers || [];
    if (a && b) { const winner = (pts[a.name] || 0) >= (pts[b.name] || 0) ? a : b; const loser = winner === a ? b : a; winner.morale = clamp((winner.morale ?? 75) + 4); loser.morale = clamp((loser.morale ?? 75) - 5); }
    if (rankOf(state, t) > allTeams(state).length - 3) (t.drivers || []).forEach((d) => { d.morale = clamp((d.morale ?? 75) - 4); });
  }

  // Contracts tick down. Ownership: this is the ONLY place race and reserve
  // contracts (player + AI rosters) decrement, once per season (m.seasonEnd
  // guard above). Academy and loan contracts tick in development.js
  // processSeasonDevelopment. A driver object listed on two rosters still
  // ticks once.
  const ticked = new Set();
  for (const t of allTeams(state)) for (const d of roster(t)) {
    if (!d || ticked.has(d)) continue;
    ticked.add(d);
    d.contractYearsRemaining = Math.max(0, (d.contractYearsRemaining ?? 2) - 1);
  }

  // Agreed moves happen
  const due = m.preContracts.filter((p) => p.effectiveYear === yr + 1);
  for (const p of due) {
    const l = findDriver(state, p.driver);
    const to = allTeams(state).find((t) => t.name === p.toTeam);
    if (!l || !to) continue;
    if (l.team && l.team !== to) l.team.releaseDriver(l.driver.name);
    const d = l.driver;
    const seats = openSeats(to);
    // free the seat held by an out-of-contract driver at the destination
    if (p.role === "race" && !seats.race) {
      const leaving = (to.drivers || []).find((x) => (x.contractYearsRemaining ?? 0) === 0);
      if (leaving) releaseToPool(state, to, leaving, `${leaving.name} leaves ${to.name} at the end of the contract.`);
    }
    const now = openSeats(to);
    if ((p.role === "race" && !now.race) || (p.role === "reserve" && !now.reserve)) {
      pushNews(state, { type: "void", driver: d.name, team: to.name, text: `${d.name}'s agreement with ${to.name} is void: no seat was free. The bonus was not paid.` });
      recordPool(state, d);
      continue;
    }
    if (to === state.team) state.team.budget = r1(state.team.budget - (p.bonus || 0));
    else to.budget = r1(Math.max(0, (to.budget || 0) - (p.bonus || 0)));
    d.salary = p.salary; d.contractYearsRemaining = p.years; d.contractType = p.role === "race" ? "race" : "reserve";
    d.driverRole = p.role === "race" ? "second" : "reserve"; d.roleLabel = p.role === "race" ? "Race Driver" : "Reserve Driver";
    to.signDriver(d, p.role === "race" ? "main" : "reserve");
    delete m.pool[d.name];
    pushNews(state, { type: "signing", driver: d.name, team: to.name, text: `${d.name} completes the move from ${p.fromTeam} to ${to.name}.` });
  }
  m.preContracts = m.preContracts.filter((p) => p.effectiveYear !== yr + 1);

  // Out-of-contract drivers: AI teams renew or release; the player's leave
  for (const t of allTeams(state)) {
    for (const d of roster(t).filter((x) => (x.contractYearsRemaining ?? 0) === 0)) {
      if (t === state.team) {
        releaseToPool(state, t, d, `${d.name}'s contract with ${t.name} expired. Now a free agent.`);
        continue;
      }
      const role = (t.drivers || []).includes(d) ? "race" : "reserve";
      const sat = satisfaction(state, d, t, role).score;
      const alt = Math.max(0, ...freeAgents(state).map(overall));
      const keep = (d.age ?? 28) < 37 && sat >= 40 && overall(d) >= alt - 2 && aiCanAfford(t, d);
      if (keep) {
        d.contractYearsRemaining = (d.age ?? 28) < 26 ? 3 : (d.age ?? 28) < 32 ? 2 : 1;
        d.salary = Math.max(d.salary || 0, half(expectedSalary(d) * 0.95));
        pushNews(state, { type: "renewal", driver: d.name, team: t.name, text: `${t.name} renew ${d.name} for ${d.contractYearsRemaining} season${d.contractYearsRemaining === 1 ? "" : "s"}.` });
      } else {
        releaseToPool(state, t, d, sat < 40 ? `${d.name} leaves ${t.name} after an unhappy spell.` : `${t.name} let ${d.name} go at the end of the contract.`);
      }
    }
  }

  // Retirements: free drivers aged 38+ who are no longer front-runners, everyone at 41
  for (const d of [...freeAgents(state)]) {
    const age = d.age ?? 28;
    if (age >= 41 || (age >= 38 && overall(d) < 88)) {
      m.retired.push(d.name); delete m.pool[d.name];
      pushNews(state, { type: "retirement", driver: d.name, text: `${d.name} announces retirement at ${age}.` });
    }
  }

  // Pool development: prospects grow toward potential, older free agents fade
  for (const d of [...freeAgents(state), ...prospects(state)]) {
    d.age = (d.age ?? 25) + 1;
    const o = overall(d); const p = potentialOf(d);
    const step = d.category === "F2" || d.age <= 24 ? Math.max(0, (p - o) * 0.25 * ((d.developmentRate ?? 65) / 70)) : d.age >= 33 ? -0.8 : 0;
    if (step) ATTRS.forEach((k) => { if (typeof d[k] === "number") d[k] = r1(clamp(d[k] + step + (seeded(`${d.name}:${yr}:${k}`) - 0.5), 40, 99)); });
    if (d.category === "F2" && overall(d) >= 84 && d.age >= 21) d.category = "FREE";
    recordPool(state, d);
  }

  // AI recruitment: fill seats, then the weakest teams try to buy an upgrade
  for (const t of state.aiTeams || []) aiFillSeats(state, t);
  let moves = 0;
  for (const t of [...(state.aiTeams || [])].sort((a, b) => rankOf(state, b) - rankOf(state, a))) {
    if (moves >= 2) break;
    const weakest = [...(t.drivers || [])].sort((a, b) => overall(a) - overall(b))[0];
    if (!weakest) continue;
    const target = contractedDrivers(state).filter((c) => c.team !== t && c.role === "race" && overall(c.driver) >= overall(weakest) + 3)
      .map((c) => ({ ...c, a: assessInterest(state, c.driver.name, t), st: sellingStanceFor(state, c, t) }))
      .filter((c) => c.a.score >= 65 && c.st.stance !== "refuse" && (t.budget || 0) >= c.st.fee + bonusExpectation(c.driver))
      .sort((x, y) => overall(y.driver) - overall(x.driver))[0];
    if (!target) continue;
    t.budget = r1(t.budget - target.st.fee - bonusExpectation(target.driver));
    target.team.budget = r1((target.team.budget || 0) + target.st.fee);
    target.team.releaseDriver(target.driver.name);
    releaseToPool(state, t, weakest, `${t.name} drop ${weakest.name} to make room.`);
    target.driver.contractYearsRemaining = preferredYears(target.driver);
    t.signDriver(target.driver, "main");
    pushNews(state, { type: "ai_transfer", driver: target.driver.name, team: t.name, text: `${t.name} sign ${target.driver.name} from ${target.team.name} for a $${target.st.fee}M fee.` });
    aiFillSeats(state, target.team);
    moves += 1;
  }

  // AI budgets: prize income by position, minus a season of salaries
  const n = allTeams(state).length;
  for (const t of state.aiTeams || []) {
    const income = 70 - (rankOf(state, t) - 1) * (40 / Math.max(1, n - 1));
    const payroll = roster(t).reduce((s, d) => s + (d.salary || 0), 0);
    t.budget = r1(Math.max(5, (t.budget || 0) + income - payroll));
  }

  // Talks reset each season; shortlists and scouting carry over
  for (const [name, t] of Object.entries(m.talks)) { if (t.stage !== "pre_contract") m.talks[name] = { stage: "none", history: t.history || [], rejections: 0, feeRejections: 0 }; }
  m.seasonEnd = yr;
  return { processed: true };
}

/** Selling stance as seen by another AI team: neutral relationship, interest toward that buyer. */
function sellingStanceFor(state, c, buyer) {
  return sellingStance(state, c.driver.name, { relation: 60, toTeam: buyer });
}

// ─── Read models for the UI ─────────────────────────────────────────────────
export function marketOverview(state) {
  const m = ensureMarket(state);
  const team = state.team;
  const payroll = r1(roster(team).reduce((s, d) => s + (d.salary || 0), 0));
  const cap = scoutingCapability(state);
  return {
    budget: team.budget, seats: openSeats(team), futureSeats: futureSeats(state, team), payroll,
    scouts: { busy: activeScouts(state).length, slots: cap.slots, capability: cap.capability },
    negotiations: Object.values(m.talks).filter((t) => ["enquired", "terms_agreed", "fee_agreed", "ready"].includes(t.stage)).length,
    preContracts: m.preContracts.filter((p) => p.toTeam === team.name).length,
    committed: committedBonuses(state),
  };
}
