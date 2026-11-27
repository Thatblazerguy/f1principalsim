/**
 * RaceEngineer.js
 * ───────────────
 * The AI race engineer on the pit wall during a live race.
 *
 * It reads the live engine every tick and, for each of the player's cars, works
 * out with the shared pace model (game/paceModel.js):
 *   - real time gaps to the cars around us, and whether they're closing
 *   - tyre state: wear, laps to the cliff, time lost per lap vs a new set
 *   - the best pit plan for the rest of the race (box now / in N laps / stay out),
 *     which compound, and where we'd rejoin
 *   - undercut and overcut chances, threats from cars behind
 *   - pace mode, ERS and fuel calls
 *   - a projected finishing position against the race objective
 *
 * It talks on the radio (engine.comms) when something changes, offers calls the
 * player can apply with one click, and can run a car on its own ("auto").
 *
 * Pit timing has two brains:
 *   - the planner (evaluatePit): stint-time arithmetic, no traffic or rivals
 *   - the strategy model (game/strategy/strategyModel.js): a neural network
 *     trained on Monte Carlo race rollouts that predicts our finishing position
 *     for each pit option, so it sees track position, traffic and rivals' stops
 * With strategyBrain "model" (the default) the model makes the auto pit calls
 * whenever it applies (dry race, not mid-stop); otherwise the planner does.
 */

import { state } from "../state.js";
import {
  expectedLapTime,
  stintTime,
  tyreLife,
  chooseNextCompound,
  DRY_COMPOUNDS,
  PIT_LOSS_BASE,
} from "./paceModel.js";
import { adviseLiveCar } from "./strategy/strategyModel.js";

const LEGACY_TARGETS = { win: 1, podium: 3, points: 10, conservative: 12, gamble: 5 };
const FUEL_USAGE = { Rich: 1.2, Standard: 1.0, Lean: 0.8 };
const lastName = (n) => String(n || "").split(" ").pop();
const fmtGap = (g) => (g >= 99 ? "–" : `${g.toFixed(1)}s`);
// Radio phrasing: lower-case the first word unless the call starts with a driver's name
const radio = (call) => (["cover", "threat"].includes(call.id) ? call.title : call.title.charAt(0).toLowerCase() + call.title.slice(1));

export class RaceEngineer {
  constructor(engine, { objective = "points", targetPosition = null, autoByDefault = true, strategyBrain = "model" } = {}) {
    this.engine = engine;
    this.strategyBrain = strategyBrain;
    this.objective = objective;
    this.targetPosition = targetPosition
      ?? state?.weekendProgress?.selectedObjectiveData?.targetPosition
      ?? LEGACY_TARGETS[objective]
      ?? 10;
    this.briefings = {};   // carId -> latest briefing
    this.memory = {};      // carId -> { gapHistory, lastCalls, cooldowns, ... }
    this.lastUpdate = -1;
    this.seenPits = new Set();
    this.seenRetired = new Set();
    // The engineer runs our cars until the player takes a decision themselves
    engine.cars.filter((c) => c.isPlayer).forEach((c) => { c.autoEngineer = autoByDefault; });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Call after every engine tick. Cheap when nothing needs recomputing. */
  update() {
    const e = this.engine;
    if (!e?.cars?.length || e.raceCompleted) return;
    if (e.elapsedTime - this.lastUpdate < 0.5) return;
    this.lastUpdate = e.elapsedTime;

    this.watchField();
    e.cars.filter((c) => c.isPlayer).forEach((car) => {
      if (car.retired) {
        this.briefings[car.id] = { ...(this.briefings[car.id] || {}), retired: true, calls: [] };
        return;
      }
      const b = this.analyse(car);
      this.briefings[car.id] = b;
      this.talk(car, b);
      if (car.autoEngineer) this.autopilot(car, b);
    });
  }

  getBriefing(carId) {
    return this.briefings[carId] || null;
  }

  /** Apply one of the engineer's calls to a car. */
  apply(carId, call) {
    const car = this.engine.cars.find((c) => c.id === carId);
    if (!car || !call?.command) return;
    const { type, value } = call.command;
    if (type === "PIT") this.engine.playerCommand(carId, "PIT", value);
    else if (type === "MODE") this.engine.playerCommand(carId, "MODE", value);
    else if (type === "ERS") this.engine.playerCommand(carId, "ERS", value);
    else if (type === "FUEL") this.engine.playerCommand(carId, "FUEL", value);
    else if (type === "CANCEL_PIT") this.engine.playerCommand(carId, "CANCEL_PIT");
    this.lastUpdate = -1; // re-read the car on the next update
    if (!car.retired) this.briefings[carId] = this.analyse(car);
  }

  setAuto(carId, on) {
    const car = this.engine.cars.find((c) => c.id === carId);
    if (!car) return;
    car.autoEngineer = !!on;
    if (this.briefings[carId]) this.briefings[carId] = { ...this.briefings[carId], auto: !!on };
    this.engine.addComm("Engineer", on
      ? `${lastName(car.driver.name)}, we'll manage strategy and modes from the pit wall.`
      : `Copy, ${lastName(car.driver.name)}, you have control of the settings.`, true);
  }

  // ─── Analysis ──────────────────────────────────────────────────────────────

  mem(carId) {
    if (!this.memory[carId]) this.memory[carId] = { gapHistory: [], lastLap: -1, cooldowns: {}, lastPitCall: null, pitEval: null, pitEvalKey: null };
    return this.memory[carId];
  }

  /** Time gap (s) from `a` back to `b`, positive when `a` is ahead. */
  gap(a, b, lapTime) {
    return (a.distance - b.distance) * (lapTime || this.engine.track.baseTime);
  }

  neighbours(car) {
    const cars = this.engine.cars;
    const i = cars.indexOf(car);
    let ahead = null;
    for (let j = i - 1; j >= 0; j--) if (!cars[j].retired) { ahead = cars[j]; break; }
    let behind = null;
    for (let j = i + 1; j < cars.length; j++) if (!cars[j].retired) { behind = cars[j]; break; }
    return { ahead, behind, position: i + 1 };
  }

  analyse(car) {
    const e = this.engine;
    const m = this.mem(car.id);
    const lapTime = car.basePace || car.targetLapTime || e.track.baseTime;
    const { ahead, behind, position } = this.neighbours(car);
    const gapAhead = ahead ? this.gap(ahead, car, lapTime) : 99;
    const gapBehind = behind ? this.gap(car, behind, lapTime) : 99;

    // Gap history, sampled once per lap, gives the trend (s/lap; + = gap growing)
    const lapNow = car.lapTimes.length;
    if (lapNow !== m.lastLap) {
      m.lastLap = lapNow;
      m.gapHistory.push({ lap: lapNow, aheadId: ahead?.id, gapAhead, behindId: behind?.id, gapBehind });
      if (m.gapHistory.length > 6) m.gapHistory.shift();
    }
    const trendFor = (key, idKey, id) => {
      const h = m.gapHistory.filter((x) => x[idKey] === id && x[key] < 90);
      if (h.length < 3) return null;
      return (h[h.length - 1][key] - h[0][key]) / (h[h.length - 1].lap - h[0].lap || 1);
    };
    const aheadTrend = ahead ? trendFor("gapAhead", "aheadId", ahead.id) : null;
    const behindTrend = behind ? trendFor("gapBehind", "behindId", behind.id) : null;

    // Tyres
    const life = tyreLife(car.profile, car.tireCompound);
    const lapsLeft = Math.max(0, e.totalLaps - car.distance);
    const lapsToCliff = Math.max(0, life - car.tyreAge);
    const lapArgs = { lap: Math.max(1, car.lap), totalLaps: e.totalLaps };
    const lossVsNew = expectedLapTime(car.profile, { compound: car.tireCompound, tyreAge: car.tyreAge, ...lapArgs })
      - expectedLapTime(car.profile, { compound: car.tireCompound, tyreAge: 2, ...lapArgs });

    // Fuel
    const burnPerLap = (105 / e.totalLaps) * (FUEL_USAGE[car.fuelMode] || 1);
    const fuelMargin = car.fuel - burnPerLap * lapsLeft; // kg at the flag

    // Pit plan (recomputed a few times a lap — it's the expensive bit)
    const key = `${Math.floor(car.distance * 2)}:${car.tireCompound}:${car.stops}`;
    if (m.pitEvalKey !== key) {
      m.pitEvalKey = key;
      m.pitEval = this.evaluatePit(car, Math.ceil(lapsLeft));
    }
    const pitPlan = m.pitEval;
    const rejoin = this.rejoinEstimate(car, position);

    // Strategy model: re-scored once per lap (or after a stop / tyre change)
    const mlKey = `${Math.floor(car.distance)}:${car.tireCompound}:${car.stops}`;
    if (m.mlKey !== mlKey) {
      m.mlKey = mlKey;
      try { m.ml = adviseLiveCar(e, car.id); } catch (_) { m.ml = null; }
    }
    const strategyModel = car.pitStopStatus === "None" || car.pitStopStatus === "OutLap" ? m.ml : null;

    const projected = this.projectFinish(car);
    const target = this.targetPosition;
    const status = projected <= target ? "On target" : projected <= target + 2 ? "At risk" : "Off target";

    const calls = this.buildCalls(car, {
      ahead, behind, gapAhead, gapBehind, aheadTrend, behindTrend,
      life, lapsLeft, lapsToCliff, lossVsNew, fuelMargin, pitPlan, rejoin, position, strategyModel,
    });

    return {
      carId: car.id,
      driver: car.driver.name,
      position,
      projected,
      target,
      status,
      lap: car.lap,
      ahead: ahead ? { name: ahead.driver.name, gap: gapAhead, trend: aheadTrend, compound: ahead.tireCompound, tyreAge: ahead.tyreAge } : null,
      behind: behind ? { name: behind.driver.name, gap: gapBehind, trend: behindTrend, compound: behind.tireCompound, tyreAge: behind.tyreAge } : null,
      tyre: {
        compound: car.tireCompound,
        age: car.tyreAge,
        wearPct: car.tireWear,
        lapsToCliff,
        lossVsNew,
        usedCompounds: [...car.usedCompounds],
      },
      fuel: { kg: car.fuel, marginKg: fuelMargin },
      ers: car.ers,
      engineTemp: car.engineTemp,
      pitPlan,
      strategyModel,
      rejoin,
      calls,
      auto: !!car.autoEngineer,
      pitStatus: car.pitStopStatus,
    };
  }

  /**
   * Compare: stay out to the flag, or pit after k laps (k = 0 is this lap) onto
   * the best compound. Returns the best option plus how much it's worth.
   */
  evaluatePit(car, lapsLeft) {
    const e = this.engine;
    const profile = car.profile;
    const startLap = Math.max(1, car.lap);
    const opts = { totalLaps: e.totalLaps };
    const usedDry = new Set(car.usedCompounds.filter((c) => DRY_COMPOUNDS.includes(c)));
    const needsRule = !e.isWet && usedDry.size < 2;

    const restCost = (laps, atLap, used) => {
      const next = chooseNextCompound(profile, laps, used, { lap: atLap, totalLaps: e.totalLaps });
      const life = tyreLife(profile, next) * 1.1;
      if (life >= laps) return { cost: stintTime(profile, next, 0, laps, { ...opts, startLap: atLap }), next, stops: 1 };
      const half = Math.ceil(laps / 2);
      return {
        cost: stintTime(profile, next, 0, half, { ...opts, startLap: atLap })
          + PIT_LOSS_BASE
          + stintTime(profile, next, 0, laps - half, { ...opts, startLap: atLap + half }),
        next,
        stops: 2,
      };
    };

    const options = [];
    if (!needsRule && lapsLeft > 0) {
      options.push({ k: null, cost: stintTime(profile, car.tireCompound, car.tyreAge, lapsLeft, { ...opts, startLap }), next: null, stops: 0 });
    }
    if (lapsLeft > 2) {
      const maxK = Math.min(lapsLeft - 2, 25);
      for (let k = 0; k <= maxK; k++) {
        const before = k > 0 ? stintTime(profile, car.tireCompound, car.tyreAge, k, { ...opts, startLap }) : 0;
        const rest = restCost(lapsLeft - k, startLap + k, car.usedCompounds);
        options.push({ k, cost: before + PIT_LOSS_BASE + rest.cost, next: rest.next, stops: rest.stops });
      }
    }
    if (options.length === 0) return { action: "stay", gain: 0 };
    options.sort((a, b) => a.cost - b.cost);
    const best = options[0];
    const pitNow = options.find((o) => o.k === 0);
    const stay = options.find((o) => o.k === null);
    if (best.k === null) {
      return { action: "stay", gain: pitNow ? pitNow.cost - best.cost : 0 };
    }
    const alt = stay ?? options.find((o) => o.k !== best.k);
    return {
      action: best.k <= 0 ? "box" : "window",
      inLaps: best.k,
      onLap: startLap + best.k,
      compound: best.next,
      totalStops: best.stops,
      gain: alt ? alt.cost - best.cost : 0,
      vs: stay ? "staying out" : "other timing",
      mustStop: needsRule,
      boxNowCost: pitNow ? pitNow.cost - best.cost : null,
    };
  }

  /** Where we'd come out if we boxed this lap. */
  rejoinEstimate(car, position) {
    const e = this.engine;
    const lapTime = car.basePace || e.track.baseTime;
    const behindUs = e.cars
      .filter((c) => !c.retired && c !== car && c.distance < car.distance)
      .map((c) => ({ c, gap: this.gap(car, c, lapTime) }))
      .sort((a, b) => a.gap - b.gap);
    const lost = behindUs.filter((x) => x.gap < PIT_LOSS_BASE);
    const rejoinPos = position + lost.length;
    const justAhead = lost[lost.length - 1];
    const justBehind = behindUs[lost.length];
    return {
      position: rejoinPos,
      behindCar: justAhead ? justAhead.c.driver.name : null,
      gapToCarAhead: justAhead ? PIT_LOSS_BASE - justAhead.gap : null,
      aheadOfCar: justBehind ? justBehind.c.driver.name : null,
      gapToCarBehind: justBehind ? justBehind.gap - PIT_LOSS_BASE : null,
    };
  }

  /** Projected finishing position: current gaps + remaining stops + pace. */
  projectFinish(car) {
    const e = this.engine;
    const leader = e.cars.find((c) => !c.retired);
    if (!leader) return 1;
    const ref = leader.basePace || e.track.baseTime;
    const scores = e.cars.filter((c) => !c.retired).map((c) => {
      const lapsLeft = Math.max(0, e.totalLaps - c.distance);
      const behindLeader = (leader.distance - c.distance) * ref;
      const usedDry = new Set(c.usedCompounds.filter((x) => DRY_COMPOUNDS.includes(x)));
      const life = tyreLife(c.profile, c.tireCompound);
      // A stop is still to come if the two-compound rule isn't met, or the tyres
      // clearly can't last (late in the race, teams nurse worn tyres home instead)
      const ruleStop = !e.isWet && usedDry.size < 2 && lapsLeft > 1;
      const wearStop = lapsLeft > 6 && c.tyreAge + lapsLeft > life * 1.4;
      const stopsLeft = ruleStop || wearStop ? 1 : 0;
      const pitting = c.pitStopStatus === "Pitting" ? c.pitTimer : 0;
      // Underlying car+driver pace only: compound and tyre-age gaps even out over a stint
      const pace = c.profile.staticDelta - leader.profile.staticDelta;
      return { id: c.id, t: behindLeader + stopsLeft * PIT_LOSS_BASE + pitting + pace * lapsLeft };
    }).sort((a, b) => a.t - b.t);
    return scores.findIndex((s) => s.id === car.id) + 1;
  }

  // ─── Calls ─────────────────────────────────────────────────────────────────

  buildCalls(car, ctx) {
    const calls = [];
    const { ahead, behind, gapAhead, gapBehind, behindTrend, lapsLeft, lapsToCliff, fuelMargin, pitPlan, rejoin, strategyModel } = ctx;
    const inPitCycle = car.pitStopStatus !== "None" && car.pitStopStatus !== "OutLap";

    // Strategy
    if (car.pitStopStatus === "InLap") {
      calls.push({ id: "boxing", priority: 1, kind: "strategy", title: `Boxing this lap for ${car.nextTire || "new tyres"}`, detail: `Rejoin around P${rejoin.position}${rejoin.behindCar ? `, behind ${lastName(rejoin.behindCar)}` : ""}.`, command: { type: "CANCEL_PIT" }, actionLabel: "Stay out" });
    } else if (!inPitCycle && pitPlan) {
      const undercut = this.undercutCall(car, ahead, gapAhead, pitPlan);
      const cover = this.coverCall(car, behind, gapBehind, pitPlan);
      if (undercut) calls.push(undercut);
      if (cover) calls.push(cover);
      if (pitPlan.action === "box") {
        calls.push({
          id: "box", priority: 1, kind: "strategy",
          title: `Box this lap for ${pitPlan.compound}`,
          detail: `${pitPlan.gain > 0.3 ? `Worth ${pitPlan.gain.toFixed(1)}s over ${pitPlan.vs}. ` : ""}Rejoin P${rejoin.position}${rejoin.behindCar ? ` behind ${lastName(rejoin.behindCar)}` : " in clear air"}.`,
          command: { type: "PIT", value: pitPlan.compound }, actionLabel: "Box now",
        });
      } else if (pitPlan.action === "window") {
        calls.push({
          id: "window", priority: pitPlan.inLaps <= 3 ? 2 : 4, kind: "strategy",
          title: `Box in ${pitPlan.inLaps} ${pitPlan.inLaps === 1 ? "lap" : "laps"} (lap ${pitPlan.onLap}) for ${pitPlan.compound}`,
          detail: `${pitPlan.mustStop ? "We still owe a stop on a second compound. " : ""}${pitPlan.totalStops > 1 ? "Two more stops planned. " : ""}${pitPlan.boxNowCost != null && pitPlan.boxNowCost > 0.2 ? `Boxing now would cost ${pitPlan.boxNowCost.toFixed(1)}s.` : "Window is open if we need to react."}`,
          // Only offer a one-click stop when the window is close
          command: pitPlan.inLaps <= 3 ? { type: "PIT", value: pitPlan.compound } : null, actionLabel: "Box now",
        });
      } else if (lapsLeft > 1) {
        calls.push({
          id: "stay", priority: 5, kind: "strategy",
          title: "Stay out to the flag",
          detail: lapsToCliff < lapsLeft ? `Tyres go past their best with ${Math.ceil(lapsLeft - lapsToCliff)} laps left, manage them.` : `Tyres will make it with ${Math.floor(lapsToCliff - lapsLeft)} laps in hand.`,
        });
      }
    }

    // Safety car / VSC: a stop costs roughly half, take it if one is due anyway
    const scCall = !inPitCycle ? this.neutralStopCall(car, ctx) : null;
    if (scCall) calls.push(scCall);

    // Strategy model: speak up when it disagrees with the planner by a real margin
    if (!scCall && !inPitCycle && strategyModel) {
      const modelCall = this.modelCall(car, strategyModel, pitPlan, lapsLeft);
      if (modelCall) calls.push(modelCall);
    }

    // Driving mode
    const mode = this.recommendMode(car, ctx);
    if (mode && mode.value !== car.driverMode) calls.push({ ...mode, command: { type: "MODE", value: mode.value }, actionLabel: mode.value });

    // ERS
    const attacking = ahead && gapAhead < 1.0 && (car.basePace || 0) < (ahead.basePace || 0);
    if (car.ers < 15 && car.ersMode !== "Harvest" && !attacking) {
      calls.push({ id: "ers-harvest", priority: 3, kind: "ers", title: "Harvest ERS", detail: `Battery at ${Math.round(car.ers)}%. Recharge before the next fight.`, command: { type: "ERS", value: "Harvest" }, actionLabel: "Harvest" });
    } else if (attacking && car.ers > 35 && car.ersMode !== "Overtake") {
      calls.push({ id: "ers-overtake", priority: 2, kind: "ers", title: `Overtake mode on ${lastName(ahead.driver.name)}`, detail: `${gapAhead.toFixed(1)}s, in DRS range. Battery ${Math.round(car.ers)}%.`, command: { type: "ERS", value: "Overtake" }, actionLabel: "Overtake" });
    } else if (behind && gapBehind < 0.8 && car.ers > 30 && car.ersMode === "Harvest") {
      calls.push({ id: "ers-defend", priority: 2, kind: "ers", title: "Deploy to defend", detail: `${lastName(behind.driver.name)} is ${gapBehind.toFixed(1)}s behind.`, command: { type: "ERS", value: "Deploy" }, actionLabel: "Deploy" });
    } else if (car.ers > 80 && car.ersMode === "Harvest") {
      calls.push({ id: "ers-balanced", priority: 5, kind: "ers", title: "Battery full: back to balanced ERS", detail: `Battery at ${Math.round(car.ers)}%.`, command: { type: "ERS", value: "Balanced" }, actionLabel: "Balanced" });
    }

    // Fuel
    if (fuelMargin < 0.5 && car.fuelMode !== "Lean") {
      calls.push({ id: "fuel-lean", priority: 2, kind: "fuel", title: "Lean fuel mix", detail: `We're ${Math.abs(fuelMargin).toFixed(1)}kg ${fuelMargin < 0 ? "short" : "from short"} for the finish.`, command: { type: "FUEL", value: "Lean" }, actionLabel: "Lean" });
    } else if (fuelMargin > 3 && car.fuelMode === "Lean") {
      calls.push({ id: "fuel-std", priority: 4, kind: "fuel", title: "Fuel is fine: standard mix", detail: `${fuelMargin.toFixed(1)}kg margin to the flag.`, command: { type: "FUEL", value: "Standard" }, actionLabel: "Standard" });
    } else if (fuelMargin > 5 && attacking && car.fuelMode === "Standard") {
      calls.push({ id: "fuel-rich", priority: 4, kind: "fuel", title: "Rich mix for the attack", detail: `${fuelMargin.toFixed(1)}kg spare: we can afford it.`, command: { type: "FUEL", value: "Rich" }, actionLabel: "Rich" });
    }

    // Threat info (no command)
    if (behind && gapBehind < 3 && behindTrend != null && behindTrend < -0.2) {
      calls.push({ id: "threat", priority: 3, kind: "info", title: `${lastName(behind.driver.name)} is closing`, detail: `${gapBehind.toFixed(1)}s behind, gaining ${Math.abs(behindTrend).toFixed(2)}s a lap.` });
    }

    return calls.sort((a, b) => a.priority - b.priority);
  }

  undercutCall(car, ahead, gapAhead, pitPlan) {
    if (!ahead || gapAhead > 2.5 || ahead.pitStopStatus !== "None") return null;
    if (pitPlan.action === "stay" || (pitPlan.action === "window" && pitPlan.inLaps > 6)) return null;
    if (ahead.tyreAge < car.tyreAge - 3) return null; // they're on fresher tyres
    const e = this.engine;
    const lapArgs = { lap: Math.max(1, car.lap), totalLaps: e.totalLaps };
    const newSet = pitPlan.compound || "Hard";
    const theirs = expectedLapTime(ahead.profile, { compound: ahead.tireCompound, tyreAge: ahead.tyreAge + 1, ...lapArgs });
    const ours = expectedLapTime(car.profile, { compound: newSet, tyreAge: 1.5, ...lapArgs });
    const gain = (theirs - ours) * 2 - 0.6; // two laps on fresh tyres, minus the cold out-lap
    if (gain <= gapAhead + 0.3) return null;
    return {
      id: "undercut", priority: 1, kind: "strategy",
      title: `Undercut ${lastName(ahead.driver.name)}: box now`,
      detail: `Fresh ${newSet}s should gain ~${gain.toFixed(1)}s over two laps. Gap is ${gapAhead.toFixed(1)}s.`,
      command: { type: "PIT", value: newSet }, actionLabel: "Box now",
    };
  }

  coverCall(car, behind, gapBehind, pitPlan) {
    if (!behind || gapBehind > 4 || pitPlan.action === "stay") return null;
    // Their stop count including one in progress; cover only if they've now stopped more than us
    const theirStops = behind.stops + (behind.pitStopStatus === "Pitting" ? 1 : 0);
    const justPitted = behind.pitStopStatus === "Pitting" || behind.pitStopStatus === "OutLap";
    if (!justPitted || theirStops <= car.stops) return null;
    const newSet = pitPlan.compound || "Hard";
    return {
      id: "cover", priority: 1, kind: "strategy",
      title: `${lastName(behind.driver.name)} has boxed: cover the undercut`,
      detail: `They were ${gapBehind.toFixed(1)}s behind. Box this lap for ${newSet} to stay ahead.`,
      command: { type: "PIT", value: newSet }, actionLabel: "Cover",
    };
  }

  recommendMode(car, { ahead, behind, gapAhead, gapBehind, lapsLeft, lapsToCliff, pitPlan }) {
    if (car.engineTemp > 112) return { id: "mode-cool", priority: 1, kind: "mode", value: "Conserve", title: "Lift and coast: engine is hot", detail: `${Math.round(car.engineTemp)}°C. Above 115°C we lose power.` };
    const stayingOut = pitPlan?.action === "stay";
    if (stayingOut && lapsToCliff < lapsLeft - 2) return { id: "mode-tyres", priority: 2, kind: "mode", value: "Conserve", title: "Manage the tyres", detail: `We need ${Math.ceil(lapsLeft)} more laps; these have about ${Math.floor(lapsToCliff)} before the cliff.` };
    const fasterBehind = behind && (behind.basePace || 99) < (car.basePace || 0);
    if (behind && gapBehind < 1.0 && fasterBehind) return { id: "mode-defend", priority: 2, kind: "mode", value: "Defend", title: `Defend from ${lastName(behind.driver.name)}`, detail: `${gapBehind.toFixed(1)}s behind and quicker. Cover the inside.` };
    const fasterThanAhead = ahead && (car.basePace || 99) < (ahead.basePace || 0);
    if (ahead && gapAhead < 1.2 && fasterThanAhead && lapsToCliff > 4) return { id: "mode-attack", priority: 2, kind: "mode", value: "Attack", title: `Attack ${lastName(ahead.driver.name)}`, detail: `${gapAhead.toFixed(1)}s ahead and ${((ahead.basePace || 0) - (car.basePace || 0)).toFixed(2)}s a lap slower.` };
    if (ahead && gapAhead < 3 && fasterThanAhead && lapsToCliff > 8) return { id: "mode-push", priority: 3, kind: "mode", value: "Push", title: `Push to close on ${lastName(ahead.driver.name)}`, detail: `${gapAhead.toFixed(1)}s to find.` };
    if (car.driverMode !== "Balanced" && (!ahead || gapAhead > 3) && (!behind || gapBehind > 2)) return { id: "mode-balanced", priority: 4, kind: "mode", value: "Balanced", title: "Clear air: back to balanced", detail: "Save the tyres for when we need them." };
    return null;
  }

  // ─── Radio ─────────────────────────────────────────────────────────────────

  say(car, key, msg, cooldownLaps = 3) {
    const m = this.mem(car.id);
    const lap = car.distance;
    if (m.cooldowns[key] != null && lap - m.cooldowns[key] < cooldownLaps) return;
    m.cooldowns[key] = lap;
    this.engine.addComm("Engineer", `${lastName(car.driver.name)}, ${msg}`, true);
  }

  talk(car, b) {
    const top = b.calls[0];
    const m = this.mem(car.id);

    // Strategy calls, said once when they first appear
    const pitCall = b.calls.find((c) => ["box", "undercut", "cover"].includes(c.id));
    if (pitCall && m.lastPitCall !== pitCall.id + pitCall.title) {
      m.lastPitCall = pitCall.id + pitCall.title;
      this.say(car, "pit-" + pitCall.id, `${radio(pitCall)}. ${pitCall.detail}`, 1);
    } else if (!pitCall) {
      m.lastPitCall = null;
    }
    const window = b.calls.find((c) => c.id === "window");
    if (window && b.pitPlan?.inLaps === 3) this.say(car, "window", `pit window opens in 3 laps. Plan is ${b.pitPlan.compound}.`, 5);

    // Tyres
    if (b.tyre.lapsToCliff < 3 && b.tyre.lapsToCliff > 0 && b.pitStatus === "None") {
      this.say(car, "cliff", `tyres are about ${Math.ceil(b.tyre.lapsToCliff)} laps from the cliff, losing ${b.tyre.lossVsNew.toFixed(1)}s a lap to a new set.`, 6);
    }

    // Battles
    if (b.behind && b.behind.gap < 3 && b.behind.trend != null && b.behind.trend < -0.25) {
      this.say(car, "threat", `${lastName(b.behind.name)} is ${fmtGap(b.behind.gap)} behind and taking ${Math.abs(b.behind.trend).toFixed(1)} a lap.`, 5);
    }
    if (b.ahead && b.ahead.gap < 1.0 && b.ahead.gap > 0.05) {
      this.say(car, "drs", `you're in DRS on ${lastName(b.ahead.name)}, ${b.ahead.gap.toFixed(1)}s.`, 4);
    }

    // Objective check-in every 10 laps
    const lapBucket = Math.floor(car.lapTimes.length / 10);
    if (lapBucket > 0 && m.lastCheckIn !== lapBucket) {
      m.lastCheckIn = lapBucket;
      this.engine.addComm("Engineer", `Lap ${car.lapTimes.length} check: ${lastName(car.driver.name)} P${b.position}, projected P${b.projected}, target P${b.target}. ${b.status}.${b.ahead ? ` Gap ahead ${fmtGap(b.ahead.gap)}.` : ""}`, true);
    }

    // Mode/fuel/ERS: only nag on high-priority ones the player hasn't taken
    if (top && top.priority <= 2 && ["mode", "ers", "fuel"].includes(top.kind) && !car.autoEngineer) {
      this.say(car, "call-" + top.id, `${radio(top)}. ${top.detail}`, 4);
    }
  }

  /** Field-wide events worth a radio call: rival stops and retirements. */
  watchField() {
    const e = this.engine;
    const players = e.cars.filter((c) => c.isPlayer && !c.retired);
    if (!players.length) return;
    e.pitLog.forEach((p, i) => {
      const k = `${p.driver}:${p.lap}:${i}`;
      if (this.seenPits.has(k)) return;
      this.seenPits.add(k);
      if (players.some((c) => c.id === p.driver)) return;
      // Only mention cars near one of ours
      const near = players.find((c) => Math.abs((p.oldPos ?? 99) - (e.cars.indexOf(c) + 1)) <= 3);
      if (near) e.addComm("Engineer", `${lastName(p.driver)} has pitted from P${p.oldPos}, now on ${p.strategy.split("→").pop().trim()}s.`, true);
    });
    e.cars.forEach((c) => {
      if (!c.retired || this.seenRetired.has(c.id)) return;
      this.seenRetired.add(c.id);
      if (c.isPlayer) return;
      const gainer = players.find((p) => e.cars.indexOf(p) > e.cars.indexOf(c) - 3);
      if (gainer) e.addComm("Engineer", `${lastName(c.driver.name)} is out of the race. That's a position for us, ${lastName(gainer.driver.name)}.`, true);
    });
  }

  // ─── Autopilot ─────────────────────────────────────────────────────────────

  /** Compound we'd fit if we stopped now (same rule as the planner). */
  nextCompoundFor(car, lapsLeft) {
    return chooseNextCompound(car.profile, lapsLeft, car.usedCompounds, { lap: Math.max(1, car.lap), totalLaps: this.engine.totalLaps });
  }

  neutralStopCall(car, { lapsLeft, life }) {
    const e = this.engine;
    if (!e.neutralisation || lapsLeft <= 5 || car.tyreAge < 6) return null;
    const mustStop = !e.isWet && new Set(car.usedCompounds.filter((c) => DRY_COMPOUNDS.includes(c))).size < 2;
    if (!mustStop && car.tyreAge < life * 0.4) return null;
    const compound = this.nextCompoundFor(car, Math.ceil(lapsLeft));
    return {
      id: "sc-box", priority: 1, kind: "strategy",
      title: `${e.neutralisation === "SC" ? "Safety car" : "VSC"}: box now for ${compound}`,
      detail: `A stop costs about ${e.neutralisation === "SC" ? "half" : "two thirds"} of the usual time while the field is neutralised.`,
      command: { type: "PIT", value: compound }, actionLabel: "Box now",
    };
  }

  modelCall(car, sm, pitPlan, lapsLeft) {
    const MARGIN = 0.3; // places
    const best = sm.best;
    const planned = sm.plannerPick;
    const fmtPos = (p) => `P${p.toFixed(1)}`;
    if (best.id === "box_0" && pitPlan?.action !== "box" && sm.gainVsPlanner >= MARGIN) {
      const compound = this.nextCompoundFor(car, Math.ceil(lapsLeft));
      return {
        id: "model-box", priority: 1, kind: "strategy",
        title: `Strategy model: box now for ${compound}`,
        detail: `Projects ${fmtPos(best.expectedPos)} vs ${planned ? fmtPos(planned.expectedPos) : "worse"} on the planner's timing. Track position beats the tyre maths here.`,
        command: { type: "PIT", value: compound }, actionLabel: "Box now",
      };
    }
    if (pitPlan?.action === "box" && best.id !== "box_0" && sm.gainVsPlanner >= MARGIN) {
      return {
        id: "model-hold", priority: 2, kind: "strategy",
        title: `Strategy model: ${best.label.charAt(0).toLowerCase()}${best.label.slice(1)}`,
        detail: `Projects ${fmtPos(best.expectedPos)} vs ${planned ? fmtPos(planned.expectedPos) : "worse"} if we box now: we'd rejoin in traffic.`,
        command: null,
      };
    }
    return null;
  }

  autopilot(car, b) {
    if (car.pitStopStatus !== "None") return;
    const scBox = b.calls.find((c) => c.id === "sc-box");
    if (scBox) { this.apply(car.id, scBox); return; }
    const modelRunsPits = this.strategyBrain === "model" && b.strategyModel && !this.engine.neutralisation;
    if (modelRunsPits && b.strategyModel.best.id === "box_0") {
      const lapsLeft = Math.max(0, this.engine.totalLaps - car.distance);
      this.apply(car.id, { command: { type: "PIT", value: this.nextCompoundFor(car, Math.ceil(lapsLeft)) } });
      return;
    }
    for (const call of b.calls) {
      if (!call.command || call.command.type === "CANCEL_PIT") continue;
      if (call.command.type === "PIT" && (modelRunsPits || !["box", "undercut", "cover"].includes(call.id))) continue;
      const already =
        (call.command.type === "MODE" && car.driverMode === call.command.value) ||
        (call.command.type === "ERS" && car.ersMode === call.command.value) ||
        (call.command.type === "FUEL" && car.fuelMode === call.command.value);
      if (already) continue;
      this.apply(car.id, call);
    }
  }
}
