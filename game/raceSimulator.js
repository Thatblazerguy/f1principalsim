/**
 * raceSimulator.js  v3
 * ────────────────────
 * Lap-by-lap quick simulation of a full Grand Prix.
 *
 * Pace comes from game/paceModel.js (shared with the live race and the race
 * engineer): car ≈ two thirds of raw pace, driver ≈ one third, with tyre
 * management, consistency, racecraft and wet skill deciding the rest.
 *
 * Each lap, the whole field runs together so cars interact:
 *  - real tyre stints from each team's chosen strategy (compound offsets, wear, cliff)
 *  - fuel burn and track evolution
 *  - dirty air when following, and overtakes that need pace, racecraft and DRS
 *  - safety cars / VSCs that bunch the field and make pit stops cheap
 *  - mistakes from inconsistent drivers, start incidents, reliability failures
 */

import { state } from "../state.js";
import { applySessionWear } from "../utils/engineeringSystem.js";
import { strategies } from "../data/strategies.js";
import {
  makeRng, newRaceSeed, getRaceRules, decideRaceWeather, rollNeutralisations, inRange,
  rollStartIncidents, selectAIStrategy, rollRetirement, breaksCompoundRule, isClassified,
} from "./raceEvents.js";
import {
  buildPaceProfile,
  expectedLapTime,
  tyreLife,
  chooseNextCompound,
  parseStrategyCompounds,
  overtakeChance,
  dirtyAirPenalty,
  getOvertakingDifficulty,
  gaussian,
  DRY_COMPOUNDS,
  PIT_LOSS_BASE,
  SC_PIT_FACTOR,
  VSC_PIT_FACTOR,
} from "./paceModel.js";
import { parseCustomPitLaps, sanitizeCustomPitLaps } from "../utils/strategyModel.js";

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Objective modifiers (player only) ────────────────────────────────────────

/**
 * How hard the player's cars are driven. Pushing is quicker per lap but wears
 * the tyres faster (earlier cliff, more stops) and brings more mistakes and
 * component stress, so no objective is a free speed boost: it trades risk
 * against reward. `wear` scales tyre ageing per lap.
 */
const OBJECTIVE_MODS = {
  win:          { pace: -0.10, wear: 1.11, variance: 1.3, mistakes: 1.3, dnf: 1.2 },
  podium:       { pace: -0.05, wear: 1.055, variance: 1.15, mistakes: 1.15, dnf: 1.1 },
  points:       { pace: 0,     wear: 1.0,  variance: 1.0, mistakes: 1.0, dnf: 1.0 },
  conservative: { pace: 0.08,  wear: 0.93, variance: 0.75, mistakes: 0.7, dnf: 0.65 },
  gamble:       { pace: -0.03, wear: 1.03, variance: 1.8, mistakes: 1.25, dnf: 1.1 },
};

// ─── Strategy planning ────────────────────────────────────────────────────────

/** Turn a strategy label into a legal, condition-appropriate compound plan. */
function buildCompoundPlan(label, isWet) {
  if (isWet) return ["Intermediate"];
  let plan = parseStrategyCompounds(label).map((c) => (DRY_COMPOUNDS.includes(c) ? c : null));
  // Teams don't fit wet tyres on a dry track: swap them for sensible slicks
  plan = plan.map((c, i) => c || (i === 0 ? "Medium" : "Hard"));
  if (plan.length === 0) plan = ["Medium", "Hard"];
  if (new Set(plan).size < 2) plan.push(plan[0] === "Hard" ? "Medium" : "Hard");
  return plan;
}

/** Split the race into stints sized by each compound's life. Returns the pit laps. */
function planPitLaps(profile, plan, laps, jitter, rng) {
  if (plan.length < 2) return [];
  const lives = plan.map((c) => tyreLife(profile, c));
  const total = lives.reduce((a, b) => a + b, 0);
  const pits = [];
  let acc = 0;
  for (let i = 0; i < plan.length - 1; i++) {
    acc += lives[i];
    const lap = Math.round((acc / total) * laps + (rng() - 0.5) * 2 * jitter);
    pits.push(clamp(lap, 2 + i * 3, laps - 3));
  }
  return pits.sort((a, b) => a - b).filter((l, i, arr) => i === 0 || l - arr[i - 1] >= 3);
}

function positionsOf(cars) {
  const racing = cars.filter((c) => !c.retired).sort((a, b) => a.cum - b.cum);
  const out = racing.slice();
  cars.filter((c) => c.retired).sort((a, b) => b.lapTimes.length - a.lapTimes.length).forEach((c) => out.push(c));
  const map = new Map();
  out.forEach((c, i) => map.set(c.driver.name, i + 1));
  return map;
}

// ─── Main Simulation ──────────────────────────────────────────────────────────

/**
 * simulateRaceEvent  v3
 *
 * @param {Array}  teams                   All teams (player first, then AI)
 * @param {object} track                   Calendar track object
 * @param {number} laps                    Race distance in laps
 * @param {Array}  [qualifyingGrid=null]   Pre-sorted qualifying grid
 * @param {object} [playerSelectedStrategies={}]  Player driver name → strategy id
 * @param {object} [weekendContext=null]   Pre-calculated performance context
 * @param {string} [selectedObjective]     Player's race objective id
 * @param {object} [options]               { seed, sprint } — the same seed replays the same race;
 *                                         sprint: short race, no mandatory stop
 * @returns {{ finishers: Array, replayData: object }}
 */
export function simulateRaceEvent(
  teams,
  track,
  laps,
  qualifyingGrid = null,
  playerSelectedStrategies = {},
  weekendContext = null,
  selectedObjective = 'points',
  options = {}
) {
  playerSelectedStrategies = playerSelectedStrategies || {};
  const roundStrategies = track.round ? (strategies[track.round] || []) : [];

  // ── Seed, rules and race-wide conditions (shared with the live race) ──────
  const seed = options.seed ?? weekendContext?.raceSeed ?? newRaceSeed();
  const rng = makeRng(seed);
  const rules = getRaceRules(state);
  const isWet = decideRaceWeather(track, weekendContext, rules, rng);
  const difficulty = getOvertakingDifficulty(track);
  const { scRange, vscRange } = rollNeutralisations(laps, rules, rng);

  // ── Build the field ───────────────────────────────────────────────────────
  const cars = teams.flatMap((team) =>
    team.drivers.map((driver) => {
      let chosenStrat = null;
      const playerPick = playerSelectedStrategies[driver.name];
      if (playerPick) {
        chosenStrat = roundStrategies.find((s) => s.id === playerPick) || { label: String(playerPick), winModifier: 0.05, riskModifier: 0.01 };
      } else if (roundStrategies.length > 0) {
        chosenStrat = selectAIStrategy(roundStrategies, team, rng, rules);
      }
      const isPlayer = Boolean(team.isPlayerTeam) || playerPick !== undefined;
      // Strategy labels used to carry a raw "winModifier" pace bonus; pace now
      // comes only from the tyre plan itself. The risk of a gamble stays.
      const riskMod = chosenStrat?.riskModifier ?? 0;
      const obj = isPlayer ? (OBJECTIVE_MODS[selectedObjective] || OBJECTIVE_MODS.points) : OBJECTIVE_MODS.points;

      let profile = buildPaceProfile({ team, driver, track, isWet, weekendContext, appState: state });
      if (!isPlayer && rules.aiAggression) {
        // Season setting: aggressive AI races harder (better attacks and defence) but errs more
        profile = { ...profile, racecraft: profile.racecraft + rules.aiRacecraftDelta, mistakeChance: profile.mistakeChance * rules.aiMistakeMult };
      }
      // Sprints are flat-out on one set: no mandatory stop, pick the tyre that lasts the distance
      const plan = options.sprint
        ? [isWet ? "Intermediate" : (tyreLife(profile, "Soft") >= laps ? "Soft" : "Medium")]
        : buildCompoundPlan(chosenStrat?.label, isWet);
      // A custom plan from the weekend Strategy builder carries its own pit laps
      const customPits = isPlayer && !isWet ? sanitizeCustomPitLaps(parseCustomPitLaps(chosenStrat?.label), laps, plan.length) : null;
      const pitLaps = isWet || options.sprint ? [] : customPits || planPitLaps(profile, plan, laps, isPlayer ? 1 : 3, rng);

      // Risky strategies can bite: a stop-go style time loss or a retirement
      const riskTriggered = rng() < riskMod;
      const riskOutcome = riskTriggered ? (rng() < 0.3 ? "DNF" : "+35s") : null;

      // Reliability (same model as the live race)
      const stress = (riskMod >= 0.05 ? 1.2 : 1.0) * obj.dnf;
      const failure = rollRetirement({ team, driver, isPlayer, laps, rules, stress, appState: state, rng, highRisk: riskMod >= 0.05 });
      let dnfLap = failure?.lap ?? null;
      let dnfReason = failure?.reason ?? null;
      if (riskOutcome === "DNF" && !dnfLap) {
        dnfLap = 1 + Math.floor(rng() * laps);
        dnfReason = "Collision damage";
      }

      return {
        driver,
        team,
        isPlayer,
        profile,
        plan,
        pitLaps,
        planIdx: 0,
        compound: plan[0],
        tyreAge: 0,
        usedCompounds: [plan[0]],
        stints: [{ compound: plan[0], startLap: 1, endLap: null }],
        stratPace: obj.pace,
        wearRate: obj.wear,
        mistakeMult: obj.mistakes,
        varianceMult: (1 + riskMod * 2) * obj.variance,
        riskOutcome,
        dnfLap,
        dnfReason,
        gridPos: 0,
        cum: 0,
        lapTimes: [],
        cumulativeTimes: [],
        stops: 0,
        retired: false,
        mistakes: 0,
        overtakes: 0,
        scStop: false,
        incident: 0,
        narrative: profile.narrative,
      };
    })
  );

  // ── Grid ──────────────────────────────────────────────────────────────────
  if (qualifyingGrid?.length) {
    cars.forEach((c) => {
      const idx = qualifyingGrid.findIndex((e) => e.driver?.name === c.driver.name);
      c.gridPos = idx < 0 ? qualifyingGrid.length : idx;
    });
  } else {
    // No qualifying session: grid by single-lap pace with a little noise
    [...cars]
      .map((c) => ({ c, k: c.profile.staticDelta + gaussian(rng) * 0.25 }))
      .sort((a, b) => a.k - b.k)
      .forEach(({ c }, i) => { c.gridPos = i; });
  }
  cars.forEach((c) => { c.cum = c.gridPos * 0.25; }); // staggered grid slots

  // ── Start ─────────────────────────────────────────────────────────────────
  const startIncidents = rollStartIncidents(cars.map((c) => ({ name: c.driver.name, gridPos: c.gridPos })), rng);
  cars.forEach((c) => {
    const launchSkill = 1 + (85 - c.profile.racecraft) * 0.03;
    c.launch = gaussian(rng) * 0.35 * Math.max(0.4, launchSkill);
    c.incident = startIncidents.get(c.driver.name) || 0;
  });

  const snapshots = [];
  const events = [];

  // ── Lap loop ──────────────────────────────────────────────────────────────
  for (let lap = 1; lap <= laps; lap++) {
    const sc = inRange(scRange, lap);
    const vsc = inRange(vscRange, lap);
    const posBefore = positionsOf(cars);

    // Retirements at the start of the lap
    cars.forEach((c) => {
      if (!c.retired && c.dnfLap === lap) {
        c.retired = true;
        c.stints[c.stints.length - 1].endLap = lap - 1;
      }
    });

    const order = cars.filter((c) => !c.retired).sort((a, b) => a.cum - b.cum);
    const lapsLeft = laps - lap;

    // 1. Each car's intended lap (pace, tyres, fuel, noise, mistakes, pit)
    order.forEach((c) => {
      const life = tyreLife(c.profile, c.compound);
      const planned = c.pitLaps[0] === lap;
      const forced = c.tyreAge > life * 1.25 && lapsLeft > 3;
      // Under a safety car, stops are cheap: take them if one is due soon
      const nextPlanned = c.pitLaps[0];
      const scOpportunity = (sc || vsc) && lapsLeft > 5 && c.tyreAge >= 6 && (
        (nextPlanned && nextPlanned - lap <= 10) ||
        (!nextPlanned && c.tyreAge > life * 0.6 && lapsLeft > 8)
      );
      c.pitting = (planned || forced || scOpportunity) && lapsLeft > 1;

      let t = expectedLapTime(c.profile, { compound: c.compound, tyreAge: c.tyreAge, lap, totalLaps: laps }) + c.stratPace;
      c.expT = t; // underlying pace this lap, before noise — what decides a pass
      t += clamp(gaussian(rng) * c.profile.noiseSigma * c.varianceMult, -3 * c.profile.noiseSigma, 3 * c.profile.noiseSigma);
      if (!sc && !vsc && rng() < c.profile.mistakeChance * c.mistakeMult) {
        t += 0.6 + rng() * 1.9;
        c.mistakes++;
      }
      if (lap === 1) t += c.launch + c.incident + 1.5;
      if (sc) t = Math.max(t, c.profile.baseTime * 1.35);
      if (vsc) t *= 1.3;
      if (c.pitting) {
        c.pitLoss = PIT_LOSS_BASE * (sc ? SC_PIT_FACTOR : vsc ? VSC_PIT_FACTOR : 1) + rng() * 1.2;
        t += c.pitLoss;
      }
      c.t = t;
      c.startCum = c.cum;
      c.newCum = c.cum + t;
    });

    // 2. Traffic: dirty air and overtakes (not under neutralisation)
    if (!sc && !vsc) {
      for (let i = 1; i < order.length; i++) {
        const c = order[i];
        if (c.pitting) continue;
        const ahead = order[i - 1];
        const gapStart = c.startCum - ahead.startCum;
        if (!ahead.pitting) {
          c.t += dirtyAirPenalty(gapStart, difficulty);
          c.newCum = c.startCum + c.t;
        }
        // Try to pass each car we'd otherwise run into, nearest first
        for (let j = i - 1; j >= 0; j--) {
          const a = order[j];
          if (a.pitting) continue;
          if (c.newCum >= a.newCum + 0.2) break;
          const p = overtakeChance({
            paceAdvantage: a.expT - c.expT,
            attackerRacecraft: c.profile.racecraft,
            defenderRacecraft: a.profile.racecraft,
            difficulty: lap === 1 ? difficulty * 0.6 : difficulty,
            drs: lap > 2 && (c.startCum - a.startCum) < 1.0,
            tyreAgeDelta: a.tyreAge - c.tyreAge,
          });
          if (rng() < p) {
            if (c.newCum > a.newCum - 0.1) c.newCum = a.newCum - 0.1 - rng() * 0.2;
            if (lap > 1) c.overtakes++;
          } else {
            c.newCum = a.newCum + 0.25 + rng() * 0.3;
            break;
          }
        }
        c.t = c.newCum - c.startCum;
      }
    }

    // 3. Safety car bunches the field (gaps shrink but order is kept)
    if (sc) {
      const byNew = [...order].sort((a, b) => a.newCum - b.newCum);
      for (let i = 1; i < byNew.length; i++) {
        const gap = byNew[i].newCum - byNew[i - 1].newCum;
        byNew[i].newCum = byNew[i - 1].newCum + Math.max(0.6, gap * 0.35);
      }
      byNew.forEach((c) => { c.t = c.newCum - c.startCum; });
    }

    // 4. Commit the lap
    order.forEach((c) => {
      c.cum = c.newCum;
      c.lapTimes.push(c.t);
      c.cumulativeTimes.push(c.cum);
      c.tyreAge += c.wearRate || 1;
      if (c.pitting) {
        const from = c.compound;
        // This stop replaces the next planned one (even if we came in early)
        if (c.pitLaps.length && c.pitLaps[0] <= lap + 10) c.pitLaps.shift();
        c.pitLaps = c.pitLaps.filter((l) => l > lap + 3);
        const planned = c.plan[c.planIdx + 1];
        const plannedOk = planned && (c.pitLaps.length > 0 || tyreLife(c.profile, planned) * 1.15 >= laps - lap);
        const next = plannedOk
          ? planned
          : chooseNextCompound(c.profile, laps - lap, c.usedCompounds, { lap, totalLaps: laps });
        c.planIdx++;
        c.stints[c.stints.length - 1].endLap = lap;
        c.stints.push({ compound: next, startLap: lap + 1, endLap: null });
        c.compound = next;
        c.usedCompounds.push(next);
        c.tyreAge = 0;
        c.stops++;
        // Stopped early (SC or forced) and the new set can't make the flag: plan another stop
        if (c.pitLaps.length === 0 && tyreLife(c.profile, next) * 1.2 < laps - lap) {
          c.pitLaps = [lap + Math.round(tyreLife(c.profile, next))];
        }
        if (sc || vsc) c.scStop = true;
        c.lastPit = { lap, from, to: next };
      }
    });

    // 5. Snapshot + pit events
    const posAfter = positionsOf(cars);
    const lapSnapshot = { lap, time: lap * track.baseTime, cars: [] };
    cars.forEach((c) => {
      lapSnapshot.cars.push({
        id: c.driver.name,
        team: c.team.name,
        distance: c.retired ? c.lapTimes.length : lap,
        cumulativeTime: c.cum,
        retired: c.retired,
        pos: posAfter.get(c.driver.name),
        compound: c.compound,
      });
      if (c.lastPit && c.lastPit.lap === lap) {
        events.push({
          type: 'PIT_STOP',
          driver: c.driver.name,
          team: c.team.name,
          lap,
          time: (2.0 + rng() * 0.9).toFixed(2),
          oldPos: posBefore.get(c.driver.name),
          newPos: posAfter.get(c.driver.name),
          strategy: `${c.lastPit.from} → ${c.lastPit.to}${sc ? ' (SC)' : vsc ? ' (VSC)' : ''}`,
        });
      }
    });
    lapSnapshot.cars.sort((a, b) => a.pos - b.pos);
    snapshots.push(lapSnapshot);
  }

  // ── Post-race ─────────────────────────────────────────────────────────────
  cars.forEach((c) => {
    const last = c.stints[c.stints.length - 1];
    if (last.endLap == null) last.endLap = c.lapTimes.length;
    if (!c.retired && c.riskOutcome === "+35s") {
      c.cum += 35 + rng() * 10;
      c.penalty = true;
    }
    // Sporting rules: two different dry compounds in a dry race, or disqualification
    if (!options.sprint && !c.retired && breaksCompoundRule(c.usedCompounds, isWet)) {
      c.disqualified = true;
      c.dnfReason = "Disqualified: did not use two dry compounds";
      events.push({ type: 'PENALTY', driver: c.driver.name, team: c.team.name, lap: laps, reason: c.dnfReason });
    }
    c.classified = !c.disqualified && (!c.retired || isClassified(c.lapTimes.length, laps));
    c.time = c.disqualified ? 199999 : c.retired ? 99999 - c.lapTimes.length * 10 - rng() : c.cum;
  });

  const finalFinishers = cars
    .sort((a, b) => {
      const outA = a.retired || a.disqualified;
      const outB = b.retired || b.disqualified;
      if (outA !== outB) return outA ? 1 : -1;
      return a.time - b.time;
    })
    .map((c) => {
      const pits = c.stints.slice(1).map((s) => s.startLap - 1);
      const explanation = c.narrative
        || (c.penalty ? 'Time penalty' : null)
        || (c.incident ? 'Lap 1 incident' : null)
        || (c.scStop ? 'Cheap stop under the safety car' : null)
        || (c.mistakes >= 2 ? `${c.mistakes} driver errors` : null)
        || (c.overtakes >= 4 ? `${c.overtakes} overtakes` : null);
      return {
        driver: c.driver,
        team: c.team,
        isPlayer: c.isPlayer,
        gridPos: c.gridPos,
        time: c.time,
        retired: c.retired || Boolean(c.disqualified),
        disqualified: Boolean(c.disqualified),
        classified: c.classified,
        dnfReason: c.retired || c.disqualified ? c.dnfReason : null,
        lapTimes: c.lapTimes,
        cumulativeTimes: c.cumulativeTimes,
        stops: c.stops,
        stints: c.stints,
        plannedPitLap: pits[0] ?? null,
        secondPitLap: pits[1] ?? null,
        tyreCompound: c.compound,
        overtakes: c.overtakes,
        mistakes: c.mistakes,
        explanation,
      };
    });

  // ── Component wear ────────────────────────────────────────────────────────
  finalFinishers.forEach((f) => {
    const aggression = f.isPlayer && (selectedObjective === 'win' || selectedObjective === 'gamble') ? 1.2 : 0.9;
    applySessionWear(state, f.driver.name, track.speed || 1.0, aggression, true);
  });

  return {
    finishers: finalFinishers,
    replayData: {
      totalLaps: laps,
      weather: isWet ? 'wet' : 'dry',
      seed,
      snapshots,
      events,
      scLaps: scRange || [],
      vscLaps: vscRange || [],
    },
  };
}
