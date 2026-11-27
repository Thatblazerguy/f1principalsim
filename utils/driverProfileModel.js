// Read-only helpers for the My drivers screen.
//
// Everything is derived from existing game state:
//   - state.raceHistory[].driverResults → wins, podiums, poles (grid P1), averages, form
//   - state.standings.drivers / .teams  → championship positions and points (includes sprints)
//   - fia/circuitLibrary.js            → circuit facts for the background map
//   - state.raceWeekend                → weather, only when it belongs to the current round
// Nothing here mutates state.

import { CIRCUIT_LIBRARY } from "../fia/circuitLibrary.js";
import { getDriverOrder, getConstructorOrder } from "./championshipModel.js";

// Nationality is not stored on drivers. These are the real nationalities of the
// drivers in data/drivers.js; generated academy prospects have none and show nothing.
const NATIONALITY = {
  "Max Verstappen": ["NL", "Netherlands"], "Isack Hadjar": ["FR", "France"], "Yuki Tsunoda": ["JP", "Japan"],
  "Lando Norris": ["GB", "United Kingdom"], "Oscar Piastri": ["AU", "Australia"], "Leo Fornaroli": ["IT", "Italy"],
  "Lewis Hamilton": ["GB", "United Kingdom"], "Charles Leclerc": ["MC", "Monaco"], "Antonio Giovinazzi": ["IT", "Italy"],
  "George Russell": ["GB", "United Kingdom"], "Andrea Kimi Antonelli": ["IT", "Italy"], "Mick Schumacher": ["DE", "Germany"],
  "Carlos Sainz": ["ES", "Spain"], "Alex Albon": ["TH", "Thailand"], "Colton Herta": ["US", "United States"],
  "Fernando Alonso": ["ES", "Spain"], "Lance Stroll": ["CA", "Canada"], "Jak Crawford": ["US", "United States"],
  "Sergio Perez": ["MX", "Mexico"], "Valtteri Bottas": ["FI", "Finland"], "Zane Maloney": ["BB", "Barbados"],
  "Nico Hulkenberg": ["DE", "Germany"], "Gabriel Bortoleto": ["BR", "Brazil"], "Theo Pourchaire": ["FR", "France"],
  "Pierre Gasly": ["FR", "France"], "Franco Colapinto": ["AR", "Argentina"], "Rafael Camara": ["BR", "Brazil"],
  "Esteban Ocon": ["FR", "France"], "Oliver Bearman": ["GB", "United Kingdom"], "Jack Doohan": ["AU", "Australia"],
  "Liam Lawson": ["NZ", "New Zealand"], "Arvid Lindblad": ["GB", "United Kingdom"], "Nikola Tsolov": ["BG", "Bulgaria"],
  "Alex Dunne": ["IE", "Ireland"], "Dino Beganovic": ["SE", "Sweden"], "Gabriele Mini": ["IT", "Italy"],
  "Ritomo Miyata": ["JP", "Japan"], "Sebastian Montoya": ["CO", "Colombia"], "Daniel Ricciardo": ["AU", "Australia"],
  "Zhou Guanyu": ["CN", "China"], "Kevin Magnussen": ["DK", "Denmark"], "Nyck de Vries": ["NL", "Netherlands"],
  "Logan Sargeant": ["US", "United States"], "Felipe Drugovich": ["BR", "Brazil"],
};

/** { code, country, flag } or null when the game doesn't know. */
export function getDriverNationality(driver) {
  if (!driver) return null;
  const hit = NATIONALITY[driver.name];
  const code = (driver.countryCode || hit?.[0] || "").toUpperCase();
  const country = driver.nationality || hit?.[1] || null;
  if (!code && !country) return null;
  const flag = /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "";
  return { code, country, flag };
}

/** The six core attributes plus adaptability. Overtaking and defending are both modelled as racecraft. */
export const PROFILE_ATTRIBUTES = [
  { key: "pace", label: "Race pace" },
  { key: "quali", label: "Qualifying" },
  { key: "racecraft", label: "Racecraft", hint: "Overtaking and defending" },
  { key: "consistency", label: "Consistency" },
  { key: "tyre", label: "Tyre management" },
  { key: "wet", label: "Wet weather" },
  { key: "adaptability", label: "Adaptability" },
];

const seasonRecords = (state) => {
  const year = state.season?.year || 1;
  const byRound = new Map();
  for (const r of state.raceHistory || []) {
    if ((r.season ?? 1) !== year) continue;
    byRound.set(r.round, r);
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round);
};

/**
 * Season numbers for one driver from recorded races.
 * Returns null before the driver has started a race this season.
 */
export function getDriverSeasonSummary(state, name) {
  const races = seasonRecords(state);
  let starts = 0, wins = 0, podiums = 0, poles = 0, dnfs = 0, finishes = 0, finSum = 0, gridSum = 0, gridN = 0, ptsSum = 0;
  const form = [];
  for (const race of races) {
    const dr = race.driverResults?.find((d) => d.name === name);
    if (!dr) continue;
    starts++;
    ptsSum += dr.points || 0;
    if (dr.gridPos) { gridN++; gridSum += dr.gridPos; if (dr.gridPos === 1) poles++; }
    if (dr.retired) dnfs++;
    else {
      finishes++; finSum += dr.finishPos;
      if (dr.finishPos === 1) wins++;
      if (dr.finishPos <= 3) podiums++;
    }
    form.push({ round: race.round, name: race.name, pos: dr.retired ? null : dr.finishPos, grid: dr.gridPos || null, points: dr.points || 0 });
  }
  if (!starts) return null;
  const standingsPts = state.standings?.drivers?.[name];
  return {
    starts, wins, podiums, poles, dnfs,
    points: typeof standingsPts === "number" ? standingsPts : ptsSum,
    avgFinish: finishes ? finSum / finishes : null,
    avgGrid: gridN ? gridSum / gridN : null,
    form: form.slice(-5),
  };
}

// Championship order with count-back tie-breaks (utils/championshipModel.js).
const rankIn = (rows, name) => {
  if (!rows.length || rows.every((r) => !r.points)) return null;
  const i = rows.findIndex((r) => r.name === name);
  return i === -1 ? null : { pos: rows[i].pos, of: rows.length, points: rows[i].points };
};

/** Drivers' championship position, or null before anyone has scored. */
export const getDriverChampionshipPosition = (state, name) => rankIn(getDriverOrder(state), name);
/** Constructors' championship position, or null before anyone has scored. */
export const getTeamChampionshipPosition = (state, name) => rankIn(getConstructorOrder(state), name);

/** The round being prepared (or the last one once the season is over). */
export function getCurrentRound(state) {
  const cal = state.season?.calendar || [];
  const total = cal.length || state.season?.totalRounds || 24;
  const roundNo = Math.min(state.season?.round || 1, total);
  const round = cal.find((r) => r.round === roundNo) || cal[roundNo - 1] || null;
  return { round, roundNo, total, completed: seasonRecords(state).length };
}

/** Circuit facts from the circuit library, matched by circuit or grand prix name. */
export function getCircuitFacts(round) {
  if (!round) return null;
  const lib = CIRCUIT_LIBRARY.find((c) => c.name === round.circuit || c.circuitId === round.circuit)
    || CIRCUIT_LIBRARY.find((c) => c.grandPrix === round.name);
  return {
    grandPrix: round.name,
    circuit: round.circuit,
    country: round.country,
    laps: round.laps ?? lib?.laps ?? null,
    lengthKm: lib?.lengthKm ?? null,
    corners: lib?.corners ?? null,
    longestStraightM: lib?.longestStraightM ?? null,
    downforce: lib?.downforceDemand ?? null,
    tyreSeverity: lib?.tyreSeverity ?? null,
    overtaking: lib?.overtakingDifficulty ?? null,
    description: lib?.description ?? null,
    sprint: !!round.sprint,
  };
}

/** Weather for the current round, only once the race weekend has generated it. */
export function getRoundWeather(state, roundNo) {
  const w = state.raceWeekend;
  if (!w || w.round !== roundNo || !w.weather) return null;
  return w.weather;
}
