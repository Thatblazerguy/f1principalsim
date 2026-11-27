/**
 * strategyModel.js
 * ────────────────
 * Pure helpers behind the weekend Strategy builder. Nothing here has its own
 * race maths: every lap time, tyre life and wear figure comes from the shared
 * pace model (game/paceModel.js) that the quick sim, the live race and the race
 * engineer all use.
 *
 * A plan is `{ compounds: ['Medium', 'Hard'], pitLaps: [24] }`: one compound
 * per stint, and the lap at the end of which the car boxes (same convention as
 * `pitLaps` in game/raceSimulator.js).
 *
 * The race reads the player's plan from `weekendProgress.selectedStrategies`,
 * keyed by driver name. Both engines already accept a free-text label there
 * ("S -> M -> H") and parse the compounds out of it, so a custom plan is stored
 * as a label too, with its pit laps in brackets: "M -> H (Custom: pit L24)".
 * The text in brackets is ignored by `parseStrategyCompounds`; the quick sim
 * reads the pit laps back with `parseCustomPitLaps`.
 */

import {
  buildPaceProfile,
  expectedLapTime,
  tyreLife,
  tyreWearPct,
  parseStrategyCompounds,
  getOvertakingDifficulty,
  DRY_COMPOUNDS,
  PIT_LOSS_BASE,
} from "../game/paceModel.js";
import { strategies } from "../data/strategies.js";
import { getTrackStrategyProfile } from "../data/strategyProfiles.js";

export const MAX_STOPS = 3;
/** The quick sim drops planned stops closer than 3 laps after a stop, so stints are at least 4 laps. */
export const MIN_STINT = 4;
export const PIT_LOSS = PIT_LOSS_BASE;
/** Mean of the quick sim's random pit-lane extra (0–1.2s). */
const PIT_LOSS_EXTRA = 0.6;
/** Staggered grid slots in the quick sim. */
const GRID_SLOT_SECONDS = 0.25;

const KEY = { Soft: "S", Medium: "M", Hard: "H", Intermediate: "I", Wet: "W" };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Rules ───────────────────────────────────────────────────────────────────

/**
 * The race only uses a slick plan: in a wet race both engines put every car
 * on intermediates and ignore the plan. In the dry the two-compound rule is
 * enforced by the sim (buildCompoundPlan adds a second compound) and by the
 * live race (AI and engineer force a stop), so a dry plan needs one stop.
 */
export const PLAN_RULES = {
  compounds: DRY_COMPOUNDS,
  minStops: 1,
  maxStops: MAX_STOPS,
  minStint: MIN_STINT,
};

export function nextCompound(compound) {
  const i = DRY_COMPOUNDS.indexOf(compound);
  return DRY_COMPOUNDS[(i + 1) % DRY_COMPOUNDS.length];
}

/** Lowest / highest lap pit stop `index` can move to without squeezing a stint below MIN_STINT. */
export function pitBounds(plan, index, totalLaps) {
  const prev = index > 0 ? plan.pitLaps[index - 1] : 0;
  const next = index < plan.pitLaps.length - 1 ? plan.pitLaps[index + 1] : totalLaps;
  return { min: prev + MIN_STINT, max: next - MIN_STINT };
}

export function movePit(plan, index, lap, totalLaps) {
  const { min, max } = pitBounds(plan, index, totalLaps);
  const pitLaps = plan.pitLaps.slice();
  pitLaps[index] = clamp(Math.round(lap), min, max);
  return { ...plan, pitLaps };
}

/** Split the longest stint in two. Returns the same plan if there is no room. */
export function addStop(plan, totalLaps) {
  if (plan.pitLaps.length >= MAX_STOPS) return plan;
  const bounds = [0, ...plan.pitLaps, totalLaps];
  let best = -1;
  let bestLen = 0;
  for (let i = 0; i < bounds.length - 1; i++) {
    const len = bounds[i + 1] - bounds[i];
    if (len > bestLen) { bestLen = len; best = i; }
  }
  if (best < 0 || bestLen < MIN_STINT * 2) return plan;
  const at = bounds[best] + Math.round(bestLen / 2);
  const pitLaps = [...plan.pitLaps, at].sort((a, b) => a - b);
  const compounds = plan.compounds.slice();
  const split = compounds[best];
  compounds.splice(best + 1, 0, split === "Medium" ? "Hard" : "Medium");
  return { compounds, pitLaps };
}

/** Remove pit stop `index`; the two stints merge and keep the first one's compound. */
export function removeStop(plan, index) {
  if (plan.pitLaps.length === 0) return plan;
  const i = clamp(index ?? plan.pitLaps.length - 1, 0, plan.pitLaps.length - 1);
  const pitLaps = plan.pitLaps.filter((_, k) => k !== i);
  const compounds = plan.compounds.filter((_, k) => k !== i + 1);
  return { compounds, pitLaps };
}

export function setCompound(plan, stintIndex, compound) {
  const compounds = plan.compounds.slice();
  compounds[stintIndex] = compound;
  return { ...plan, compounds };
}

export function samePlan(a, b) {
  if (!a || !b) return false;
  return a.compounds.join() === b.compounds.join() && a.pitLaps.join() === b.pitLaps.join();
}

// ─── Labels (what the race reads) ────────────────────────────────────────────

export function encodePlanLabel(plan) {
  const head = plan.compounds.map((c) => KEY[c] || "M").join(" -> ");
  return plan.pitLaps.length ? `${head} (Custom: pit ${plan.pitLaps.map((l) => `L${l}`).join(", ")})` : `${head} (Custom)`;
}

/** Pit laps stored in a custom label, or null for preset / free-text labels. */
export function parseCustomPitLaps(label) {
  const m = /\(Custom:\s*pit\s+([^)]*)\)/i.exec(String(label || ""));
  if (!m) return null;
  const laps = [...m[1].matchAll(/L(\d+)/gi)].map((x) => Number(x[1]));
  return laps.length ? laps : null;
}

/**
 * Pit laps the quick sim can run as given: ascending, inside the race, and far
 * enough apart that its own planner won't drop any. Otherwise null.
 */
export function sanitizeCustomPitLaps(pitLaps, totalLaps, stints) {
  if (!Array.isArray(pitLaps) || pitLaps.length !== stints - 1) return null;
  let prev = 0;
  for (const l of pitLaps) {
    if (!Number.isInteger(l) || l - prev < MIN_STINT || l > totalLaps - 2) return null;
    prev = l;
  }
  return pitLaps.slice();
}

// ─── What the engine would do ────────────────────────────────────────────────

/** Same compound plan the quick sim builds from a strategy label (raceSimulator.buildCompoundPlan, dry). */
export function engineCompoundPlan(label) {
  let plan = parseStrategyCompounds(label).map((c) => (DRY_COMPOUNDS.includes(c) ? c : null));
  plan = plan.map((c, i) => c || (i === 0 ? "Medium" : "Hard"));
  if (plan.length === 0) plan = ["Medium", "Hard"];
  if (new Set(plan).size < 2) plan.push(plan[0] === "Hard" ? "Medium" : "Hard");
  return plan.slice(0, MAX_STOPS + 1);
}

/** Same stint split the quick sim uses (raceSimulator.planPitLaps), without its random jitter. */
export function enginePitLaps(profile, compounds, totalLaps) {
  if (compounds.length < 2) return [];
  const lives = compounds.map((c) => tyreLife(profile, c));
  const total = lives.reduce((a, b) => a + b, 0);
  const pits = [];
  let acc = 0;
  for (let i = 0; i < compounds.length - 1; i++) {
    acc += lives[i];
    const lap = Math.round((acc / total) * totalLaps);
    const prev = i > 0 ? pits[i - 1] : 0;
    pits.push(clamp(lap, prev + MIN_STINT, totalLaps - MIN_STINT * (compounds.length - 1 - i)));
  }
  return pits;
}

/** The strategy the game ranks first for this round (data/strategies.js, falling back to the track profile). */
export function recommendedLabel(track) {
  const ranked = track?.round ? strategies[track.round] || [] : [];
  const r1 = ranked.find((s) => s.rank === 1) || ranked[0];
  if (r1) return r1.label;
  const profile = getTrackStrategyProfile(track?.circuit || track?.name || "");
  return profile?.recommendedStrategies?.[0]?.type || "M -> H";
}

export function recommendedPlan(profile, track, totalLaps) {
  const label = recommendedLabel(track);
  const compounds = engineCompoundPlan(label);
  return { compounds, pitLaps: enginePitLaps(profile, compounds, totalLaps), source: label };
}

/** Plan from a stored label: a custom label keeps its pit laps, a preset gets the sim's split. */
export function planFromLabel(label, profile, totalLaps) {
  if (!label) return null;
  const compounds = engineCompoundPlan(label);
  const custom = sanitizeCustomPitLaps(parseCustomPitLaps(label), totalLaps, compounds.length);
  return { compounds, pitLaps: custom || enginePitLaps(profile, compounds, totalLaps) };
}

// ─── Projection ──────────────────────────────────────────────────────────────

export function driverProfile({ team, driver, track, weekendContext, appState }) {
  return buildPaceProfile({ team, driver, track, isWet: false, weekendContext, appState });
}

/**
 * Lap-by-lap projection of a plan with the pace model: lap time (no noise,
 * no traffic), tyre wear after each lap, pit loss on in-laps.
 */
export function projectPlan(profile, plan, totalLaps) {
  const laps = [];
  const stints = [];
  const bounds = [0, ...plan.pitLaps, totalLaps];
  let total = 0;
  for (let s = 0; s < plan.compounds.length; s++) {
    const compound = plan.compounds[s];
    const start = bounds[s] + 1;
    const end = bounds[s + 1];
    const life = tyreLife(profile, compound);
    let stintTotal = 0;
    for (let lap = start; lap <= end; lap++) {
      const age = lap - start;
      let t = expectedLapTime(profile, { compound, tyreAge: age, lap, totalLaps });
      const pit = lap === end && s < plan.compounds.length - 1;
      if (pit) t += PIT_LOSS + PIT_LOSS_EXTRA;
      stintTotal += t;
      laps.push({ lap, compound, stint: s, age: age + 1, wear: tyreWearPct(profile, compound, age + 1), lapTime: t, pit });
    }
    total += stintTotal;
    stints.push({ compound, start, end, laps: end - start + 1, life, time: stintTotal });
  }
  return { total, laps, stints };
}

/**
 * Problems with a plan, as the race would see them.
 * `blocking` issues stop the plan from being locked; the rest are warnings.
 */
export function planIssues(profile, plan, totalLaps) {
  const issues = [];
  const stops = plan.pitLaps.length;
  if (stops < PLAN_RULES.minStops) issues.push({ blocking: true, text: "A dry race needs at least one stop." });
  if (stops > MAX_STOPS) issues.push({ blocking: true, text: `No more than ${MAX_STOPS} stops.` });
  if (new Set(plan.compounds).size < 2) {
    issues.push({ blocking: true, text: "Use two different compounds. The race rules need both in a dry race." });
  }
  const bounds = [0, ...plan.pitLaps, totalLaps];
  plan.compounds.forEach((c, i) => {
    const len = bounds[i + 1] - bounds[i];
    const life = tyreLife(profile, c);
    const last = i === plan.compounds.length - 1;
    // raceSimulator forces a stop on the first lap that starts with tyreAge > life × 1.25
    const forcedLap = bounds[i] + Math.floor(life * 1.25) + 2;
    if (len - 1 > life * 1.25 && totalLaps - forcedLap > 3) {
      issues.push({ blocking: false, text: `Stint ${i + 1} runs too far past the ${c.toLowerCase()} cliff. The car will be called in early, around lap ${forcedLap}.` });
    } else if (last && stops > 0 && life * 1.15 < len) {
      // raceSimulator only fits the planned last compound if it can reach the flag
      issues.push({ blocking: false, text: `The ${c.toLowerCase()} can't reach the flag from lap ${bounds[i]}. The sim will fit a harder tyre at that stop.` });
    } else if (len > life) {
      issues.push({ blocking: false, text: `Stint ${i + 1} goes ${Math.round(len - life)} laps past the ${c.toLowerCase()} cliff.` });
    }
  });
  return issues;
}

// ─── Field and finishing range ───────────────────────────────────────────────

/**
 * Projected race time for every car in the field on the strategies the game
 * ranks first and second for this round (the AI picks mostly from those),
 * plus the grid offset the quick sim applies.
 */
export function buildFieldBaseline({ teams, track, totalLaps, weekendContext, appState, grid }) {
  const ranked = (track?.round ? strategies[track.round] || [] : []).filter((s) => s.rank <= 2);
  const labels = ranked.length ? ranked.map((s) => s.label) : [recommendedLabel(track)];
  const rows = [];
  teams.forEach((team) => {
    (team.drivers || []).forEach((driver) => {
      const profile = driverProfile({ team, driver, track, weekendContext, appState });
      rows.push({ name: driver.name, team: team.name, profile });
    });
  });
  // Grid slot: qualifying if run, otherwise single-lap pace order (as the sim does)
  const order = grid?.length
    ? (name) => { const i = grid.findIndex((e) => e?.driver?.name === name); return i < 0 ? grid.length : i; }
    : (() => {
        const sorted = [...rows].sort((a, b) => a.profile.staticDelta - b.profile.staticDelta).map((r) => r.name);
        return (name) => sorted.indexOf(name);
      })();
  return rows.map((r) => {
    const gridPos = order(r.name);
    const times = labels.map((label) => {
      const compounds = engineCompoundPlan(label);
      return projectPlan(r.profile, { compounds, pitLaps: enginePitLaps(r.profile, compounds, totalLaps) }, totalLaps).total;
    });
    const offset = gridPos * GRID_SLOT_SECONDS;
    return {
      ...r,
      gridPos,
      offset,
      min: Math.min(...times) + offset,
      max: Math.max(...times) + offset,
      mid: times.reduce((a, b) => a + b, 0) / times.length + offset,
    };
  });
}

/**
 * Finishing range for one driver: where the plan's projected time slots into
 * the field, give or take one standard deviation of the pace model's own
 * lap-to-lap noise and mistake rate. Rivals are placed on their slower or
 * faster ranked strategy for the best and worst case.
 */
export function finishingRange(field, driverName, planTotal, profile, totalLaps) {
  const me = field.find((r) => r.name === driverName);
  const offset = me ? me.offset : 0;
  const t = planTotal + offset;
  const others = field.filter((r) => r.name !== driverName);
  const noise = profile.noiseSigma * Math.sqrt(totalLaps);
  const mistakes = profile.mistakeChance * totalLaps * 1.55; // mean cost of the sim's 0.6–2.5s errors
  const sigma = Math.sqrt(noise * noise + mistakes * mistakes);
  const rank = (time, key) => 1 + others.filter((o) => o[key] < time).length;
  const best = rank(t - sigma, "max");
  const likely = rank(t, "mid");
  const worst = rank(t + sigma, "min");
  return { best: Math.min(best, likely), likely, worst: Math.max(worst, likely), sigma, fieldSize: field.length };
}

export function overtakingDifficulty(track) {
  return getOvertakingDifficulty(track);
}
