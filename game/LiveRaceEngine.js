import { applySessionWear, ensureEngineeringState } from "../utils/engineeringSystem.js";
import {
  makeRng, newRaceSeed, getRaceRules, decideRaceWeather, rollNeutralisations, inRange,
  rollStartIncidents, selectAIStrategy, rollRetirement, breaksCompoundRule, isClassified,
} from "./raceEvents.js";
import { strategies } from "../data/strategies.js";
import { state } from "../state.js";
import {
  buildPaceProfile,
  expectedLapTime,
  tyreLife,
  tyreWearPct,
  chooseNextCompound,
  parseStrategyCompounds,
  overtakeChance,
  dirtyAirPenalty,
  getOvertakingDifficulty,
  gaussian,
  clamp,
  DRIVE_MODES,
  ERS_DELTA,
  DRY_COMPOUNDS,
  PIT_LOSS_BASE,
  SC_PIT_FACTOR,
  VSC_PIT_FACTOR,
} from "./paceModel.js";

export function compareCars(a, b, totalLaps) {
  // 1. Retired cars always go to the back
  if (a.retired !== b.retired) {
    return a.retired ? 1 : -1;
  }
  
  // 2. If both are retired, sort by distance completed (descending)
  if (a.retired) {
    return b.distance - a.distance;
  }
  
  // 3. If both completed the race, sort by totalTime (ascending)
  const aFinished = a.distance >= totalLaps;
  const bFinished = b.distance >= totalLaps;
  if (aFinished && bFinished) {
    return a.totalTime - b.totalTime;
  }
  
  // 4. If one finished and the other didn't, the finished one is ahead
  if (aFinished !== bFinished) {
    return aFinished ? -1 : 1;
  }
  
  // 5. If neither finished (still racing), sort by distance (descending)
  return b.distance - a.distance;
}

const FUEL_USAGE = {
  "Rich": 1.2,
  "Standard": 1.0,
  "Lean": 0.8
};

const ERS_USAGE = {
  "Overtake": 2.5,
  "Deploy": 1.5,
  "Balanced": 0,     // Net zero over a lap
  "Harvest": -1.5
};

export class LiveRaceEngine {
  /**
   * @param options.seed  race seed: the same seed (and the same player inputs) replays the same race
   */
  constructor(teams, track, laps, qualifyingGrid, playerSelectedStrategies, weekendContext, options = {}) {
    this.track = track;
    this.totalLaps = laps;
    this.seed = options.seed ?? weekendContext?.raceSeed ?? newRaceSeed();
    this.rng = makeRng(this.seed);
    this.rules = getRaceRules(state);
    // The weekend's weather (set at qualifying) wins; otherwise roll for it.
    this.isWet = decideRaceWeather(track, weekendContext, this.rules, this.rng);
    // Safety car / VSC windows by leader lap (shared rules with the quick sim)
    const { scRange, vscRange } = rollNeutralisations(laps, this.rules, this.rng);
    this.scRange = scRange;
    this.vscRange = vscRange;
    this.neutralisation = null; // null | "SC" | "VSC"
    this.weatherStr = this.isWet ? "Wet" : "Dry";
    this.events = [];    // { seq, time, lap, msg, kind?, driver?, other?, pos? }, newest first
    this.eventSeq = 0;
    this.fastestLap = null; // { driver, time, lap }
    this.comms = []; // { time, sender: "Engineer" | "Driver Name", msg, isPlayerTeam }
    this.ticks = 0;
    this.raceCompleted = false;
    this.elapsedTime = 0;
    this.snapshots = []; // Store lap-by-lap state for replay
    this.pitLog = [];    // PIT_STOP events for the post-race report
    this.overtakingDifficulty = getOvertakingDifficulty(track);
    this.weekendContext = weekendContext;

    this.cars = this.initCars(teams, qualifyingGrid, playerSelectedStrategies, weekendContext);
    this.calculateFailures();
    this.startIncidents = rollStartIncidents(this.cars.map((c) => ({ name: c.id, gridPos: c.gridPos })), this.rng);
    
    this.addEvent("Lights out", { kind: "start" });
    this.addComm("Engineer", "Lights out and away we go! Keep it clean into turn 1.", true);
  }

  /** Pre-roll retirements: component wear for our cars, team reliability for the rest (see raceEvents.js). */
  calculateFailures() {
    ensureEngineeringState(state);
    this.cars.forEach((car) => {
      const failure = rollRetirement({
        team: car.team, driver: car.driver, isPlayer: car.isPlayer, laps: this.totalLaps,
        rules: this.rules, appState: state, rng: this.rng,
      });
      if (failure) car.failureData = { lap: failure.lap, distance: failure.distance, type: failure.type };
    });
  }

  initCars(teams, qualifyingGrid, playerSelectedStrategies, weekendContext) {
    let cars = [];
    
    teams.forEach(team => {
      team.drivers.forEach(driver => {
        const gridPos = this.getGridPosition(qualifyingGrid, driver);
        // Ours if the team is flagged as the player's, or a strategy was picked for this driver
        const isPlayer = Boolean(team.isPlayerTeam) || (!!playerSelectedStrategies && (playerSelectedStrategies[driver.name] !== undefined));
        let profile = buildPaceProfile({ team, driver, track: this.track, isWet: this.isWet, weekendContext, appState: state });
        if (!isPlayer && this.rules.aiAggression) {
          // Season setting: aggressive AI races harder but makes more mistakes
          profile = { ...profile, racecraft: profile.racecraft + this.rules.aiRacecraftDelta, mistakeChance: profile.mistakeChance * this.rules.aiMistakeMult };
        }

        // Starting compound and stint plan from the chosen (or AI-picked) strategy
        const roundStrats = this.track.round ? (strategies[this.track.round] || []) : [];
        const pick = playerSelectedStrategies?.[driver.name];
        const strat = pick
          ? (roundStrats.find(st => st.id === pick)?.label ?? String(pick))
          : (selectAIStrategy(roundStrats, team, this.rng, this.rules)?.label ?? "M -> H");
        let plan = parseStrategyCompounds(strat).filter(c => DRY_COMPOUNDS.includes(c));
        if (plan.length === 0) plan = ["Medium", "Hard"];
        if (this.isWet) plan = ["Intermediate"];
        const startCompound = plan[0];
        const expected = expectedLapTime(profile, { compound: startCompound, tyreAge: 0, lap: 1, totalLaps: this.totalLaps });
        const speedKms = (this.track.baseTime / expected) * 220;

        cars.push({
          id: driver.name,
          driver,
          team,
          gridPos,
          distance: - (gridPos * 0.005),
          lap: 0,
          lapFraction: 0,
          baseSpeed: speedKms, 
          currentSpeed: speedKms,
          lapTimes: [],
          lastLapTime: 0,
          
          // Strategy & Control
          driverMode: "Balanced",
          fuelMode: "Standard",
          ersMode: "Balanced",
          tireCompound: startCompound,
          tyreAge: 0,          // effective laps of wear on this set
          plan,
          planIdx: 0,
          stints: [{ compound: startCompound, startLap: 1, endLap: null }],
          usedCompounds: [startCompound],
          profile,
          lapNoise: 0,
          holdUntil: 0,
          overtakes: 0,
          
          // Telemetry
          tireWear: 0, 
          fuel: 110, // kg
          ers: 100, // %
          engineTemp: 90, // C
          reliability: team.specs?.reliability || 85, // %
          
          // Timing
          lastLapTime: 0,
          bestLapTime: 999,
          sectorTimes: [0,0,0],
          currentLapStartTime: 0,
          
          // Status
          pitStopStatus: "None",
          pitTimer: 0,
          stops: 0,
          isPlayer,
          autoEngineer: false,
          totalLaps: this.totalLaps,
          totalTime: 0,
          retired: false,
          
          // Internal flags for comms triggers
          _commsFlags: { tireWarning50: false, tireWarning75: false, ersWarning: false }
        });
      });
    });

    // If playerSelectedStrategies is empty, fall back to checking team name against state or assume no player.
    // In weekend.tsx we passed it. We'll trust the caller.

    cars.sort((a, b) => compareCars(a, b, this.totalLaps));
    return cars;
  }

  getGridPosition(qualifyingGrid, driver) {
    if (!qualifyingGrid?.length) return 0;
    const idx = qualifyingGrid.findIndex((e) => e.driver.name === driver.name);
    return idx < 0 ? qualifyingGrid.length : idx;
  }

  /** Race feed entry. `meta` tags it for the race control screen (kind, driver, other, pos). */
  addEvent(msg, meta = {}) {
    const lap = this.cars?.length ? Math.max(1, Math.min(this.totalLaps, this.cars[0].lap || 1)) : 1;
    this.events.unshift({ seq: ++this.eventSeq, time: this.elapsedTime, lap, msg, ...meta });
    if (this.events.length > 400) this.events.pop();
  }

  addComm(sender, msg, isPlayerTeam) {
    this.comms.unshift({ time: this.elapsedTime, sender, msg, isPlayerTeam });
    if (this.comms.length > 50) this.comms.pop();
  }

  playerCommand(driverName, command, value) {
    const car = this.cars.find(c => c.id === driverName);
    if (!car || !car.isPlayer) return;
    
    if (command === "MODE") {
      if (car.driverMode === value) return;
      car.driverMode = value;
      if (!car.autoEngineer) this.addComm(car.driver.name, `Copy, ${value.toLowerCase()} mode.`, true);
    } else if (command === "FUEL") {
      car.fuelMode = value;
    } else if (command === "ERS") {
      car.ersMode = value;
    } else if (command === "PIT") {
      if (car.pitStopStatus !== "None" && car.pitStopStatus !== "OutLap") return;
      car.pitStopStatus = "InLap";
      car.nextTire = value;
      this.addComm("Engineer", `Box box. Box this lap for ${value}s.`, true);
      this.addComm(driverName, `Copy, boxing this lap.`, true);
    } else if (command === "CANCEL_PIT") {
      car.pitStopStatus = "None";
      this.addComm("Engineer", `Stay out, stay out!`, true);
    }
  }

  generateComms(dt) {
    // Driver-side radio. Engineer calls come from game/RaceEngineer.js.
    this.cars.forEach(car => {
       if (car.retired || !car.isPlayer) return;
       if (car.tireWear > 60 && !car._commsFlags.tireWarning50) {
         car._commsFlags.tireWarning50 = true;
         this.addComm(car.driver.name, "Starting to lose grip on the rears.", true);
       }
       if (car.tireWear > 92 && !car._commsFlags.tireWarning75) {
         car._commsFlags.tireWarning75 = true;
         this.addComm(car.driver.name, "These tyres are finished, I'm sliding everywhere.", true);
       }
       if (car.engineTemp > 116 && !car._commsFlags.tempWarning) {
         car._commsFlags.tempWarning = true;
         this.addComm(car.driver.name, "Engine feels hot, I'm losing power.", true);
       } else if (car.engineTemp < 105) {
         car._commsFlags.tempWarning = false;
       }
    });
  }

  /** Nearest car ahead on track that is still running (cars must be sorted). */
  carAhead(i) {
    for (let j = i - 1; j >= 0; j--) {
      const c = this.cars[j];
      if (!c.retired && c.distance < this.totalLaps) return c;
    }
    return null;
  }

  completePitStop(car) {
    const from = car.tireCompound;
    const lapsLeft = this.totalLaps - car.distance;
    const next = car.nextTire || chooseNextCompound(car.profile, lapsLeft, car.usedCompounds, { lap: car.lap, totalLaps: this.totalLaps });
    car.pitStopStatus = "OutLap";
    car.tireCompound = next;
    car.tyreAge = 0;
    car.tireWear = 0;
    car.stops++;
    car.planIdx++;
    car.usedCompounds.push(next);
    car.stints[car.stints.length - 1].endLap = car.pitLap ?? car.lapTimes.length;
    car.stints.push({ compound: next, startLap: (car.pitLap ?? car.lapTimes.length) + 1, endLap: null });
    car.nextTire = null;
    car._commsFlags = { tireWarning50: false, tireWarning75: false, ersWarning: false };

    const exitPos = this.cars.filter(c => !c.retired && c.distance > car.distance).length + 1;
    this.pitLog.push({
      type: "PIT_STOP",
      driver: car.driver.name,
      team: car.team.name,
      lap: car.pitLap ?? car.lap,
      time: (2.0 + this.rng() * 0.9).toFixed(2),
      oldPos: car.pitEntryPos,
      newPos: exitPos,
      strategy: `${from} → ${next}`,
    });
    this.addEvent(`${car.driver.name} pits: ${from} → ${next}, rejoins P${exitPos}`, { kind: "pit", driver: car.id, pos: exitPos, from, to: next });
  }

  aiLogic(car, dt, idx) {
     // Player cars are run by the player (or by the race engineer on auto)
     if (car.retired || car.isPlayer) return;

     // ── Tyres: pit near the end of the tyre's useful life ──
     if (!car.aiPitThreshold) car.aiPitThreshold = clamp(0.82 + this.rng() * 0.18 + this.rules.aiPitShift, 0.7, 1.05);
     const lapsLeft = this.totalLaps - car.distance;
     const life = tyreLife(car.profile, car.tireCompound);
     const dryUsed = new Set(car.usedCompounds.filter(c => DRY_COMPOUNDS.includes(c)));
     const needsRule = !this.isWet && dryUsed.size < 2;
     const canReachEnd = car.tyreAge + lapsLeft <= life * 1.1;
     const wornOut = car.tyreAge >= life * car.aiPitThreshold;
     const ruleDeadline = needsRule && lapsLeft < 12 && car.tyreAge > 6;
     // A neutralisation makes a stop cheap: take it if one is due anyway
     const neutralStop = this.neutralisation && lapsLeft > 5 && car.tyreAge >= 6 && (needsRule || car.tyreAge > life * 0.5);
     if (car.pitStopStatus === "None" && lapsLeft > 2 && ((wornOut && !(canReachEnd && !needsRule)) || ruleDeadline || neutralStop)) {
       const planned = car.plan[car.planIdx + 1];
       const usable = planned && (!needsRule || !dryUsed.has(planned)) && tyreLife(car.profile, planned) * 1.15 >= lapsLeft;
       car.nextTire = usable ? planned : chooseNextCompound(car.profile, lapsLeft, car.usedCompounds, { lap: car.lap, totalLaps: this.totalLaps });
       car.pitStopStatus = "InLap";
     }

     // ── Racing modes ──
     const ahead = this.carAhead(idx);
     const behind = this.cars[idx + 1];
     const lt = car.targetLapTime || this.track.baseTime;
     const gapAhead = ahead ? (ahead.distance - car.distance) * lt : 99;
     const gapBehind = behind && !behind.retired ? (car.distance - behind.distance) * lt : 99;

     if (car.engineTemp > 115) {
        car.ersMode = "Balanced";
        car.driverMode = "Conserve";
     } else if (gapAhead < 1.0 && car.ers > 30) {
        car.driverMode = "Push";
        car.ersMode = "Overtake";
     } else if (gapBehind < 0.8) {
        car.driverMode = "Defend";
        car.ersMode = car.ers > 25 ? "Deploy" : "Balanced";
     } else if (car.ers < 20) {
        car.ersMode = "Harvest";
        car.driverMode = "Balanced";
     } else {
        car.driverMode = "Balanced";
        car.ersMode = "Balanced";
     }
  }

  saveSnapshot() {
     this.snapshots.push({
       lap: this.cars[0].lap,
       time: this.elapsedTime,
       cars: this.cars.map(c => ({
         id: c.id,
         pos: this.cars.indexOf(c) + 1,
         lap: c.lap,
         distance: c.distance,
         tireCompound: c.tireCompound,
         pitStopStatus: c.pitStopStatus,
         retired: c.retired
       }))
     });
  }

  tick(dt) {
    if (this.raceCompleted) return;

    this.elapsedTime += dt;
    this.ticks++;

    let anyCarRacing = false;
    let leaderCompletedNewLap = false;

    // Track old lap for snapshot triggers
    const leaderOldLap = this.cars.length > 0 ? this.cars[0].lap : 0;

    this.cars.sort((a, b) => compareCars(a, b, this.totalLaps));
    this.updateNeutralisation();

    for (let i = 0; i < this.cars.length; i++) {
      let car = this.cars[i];
      if (car.retired) continue;
      if (car.distance >= this.totalLaps) continue; 
      
      anyCarRacing = true;

      // AI Decision Making
      this.aiLogic(car, dt, i);

      if (car.pitStopStatus === "Pitting") {
        car.currentSpeed = 0;
        car.pitTimer -= dt;
        car.totalTime += dt;
        if (car.pitTimer <= 0) this.completePitStop(car);
        continue;
      }

      // ── Lap time from the shared pace model ────────────────────────────
      const mode = DRIVE_MODES[car.driverMode] || DRIVE_MODES.Balanced;
      const ersDelta = car.ers > 2 || (ERS_DELTA[car.ersMode] || 0) > 0 ? (ERS_DELTA[car.ersMode] || 0) : 0;
      const fuelModeDelta = car.fuelMode === "Lean" ? 0.15 : car.fuelMode === "Rich" ? -0.1 : 0;
      let lapTime = expectedLapTime(car.profile, {
        compound: car.tireCompound,
        tyreAge: car.tyreAge,
        lap: Math.max(1, car.lap),
        totalLaps: this.totalLaps,
        fuelFrac: car.fuel / 110,
        modeDelta: mode.delta + ersDelta + fuelModeDelta,
      });
      car.basePace = lapTime;          // underlying pace: what decides an overtake
      lapTime += car.lapNoise;
      if (car.lap <= 1) lapTime += 1.5 + (this.startIncidents.get(car.id) || 0); // standing start (+ any lap-1 incident)
      if (car.fuel <= 0) lapTime += 8;  // out of fuel: crawling home
      if (car.engineTemp > 120) lapTime += 2.5;
      else if (car.engineTemp > 115) lapTime += 0.6;

      // Dirty air / traffic: find the nearest running car ahead
      const ahead = this.carAhead(i);
      if (this.neutralisation === "SC") {
        // Behind the safety car: slow pace, cars close up to ~0.6s and hold station
        const scPace = this.track.baseTime * 1.35;
        const gapToAhead = ahead ? (ahead.distance - car.distance) * scPace : 99;
        lapTime = gapToAhead > 1.0 ? scPace * 0.9 : scPace;
      } else if (this.neutralisation === "VSC") {
        lapTime = Math.max(lapTime, car.basePace * 1.3);
      } else if (ahead && ahead.pitStopStatus !== "Pitting") {
        const gapSec = (ahead.distance - car.distance) * lapTime;
        lapTime += dirtyAirPenalty(gapSec, this.overtakingDifficulty);
      }

      let lapsPerSecond = 1 / lapTime;
      car.currentSpeed = lapsPerSecond;
      car.targetLapTime = lapTime;

      let oldDistance = car.distance;
      let newDistance = car.distance + (lapsPerSecond * dt);

      // ── Overtaking: one roll per attempt, then hold position for a while ──
      // Cars on in/out laps are slow and out of the fight: they're passed without a battle
      const aheadInPitCycle = ahead && ahead.pitStopStatus !== "None";
      if (this.neutralisation && ahead && !aheadInPitCycle && newDistance > ahead.distance - 0.002) {
        // No overtaking under the safety car or VSC
        newDistance = Math.min(newDistance, ahead.distance - 0.002);
      } else if (ahead && !aheadInPitCycle && car.pitStopStatus !== "InLap" &&
          ahead.distance < this.totalLaps && newDistance > ahead.distance - 0.002) {
        const edge = (ahead.basePace ?? car.basePace) - car.basePace;
        if (this.elapsedTime < car.holdUntil || (edge <= 0 && car.lap > 1)) {
          // Not quicker underneath (just a good lap) or still regrouping: stay behind
          newDistance = Math.min(newDistance, ahead.distance - 0.002);
        } else {
          const p = overtakeChance({
            paceAdvantage: edge,
            attackerRacecraft: car.profile.racecraft,
            defenderRacecraft: ahead.profile.racecraft + (ahead.driverMode === "Defend" ? 6 : 0),
            difficulty: car.lap <= 1 ? this.overtakingDifficulty * 0.6 : this.overtakingDifficulty,
            drs: car.lap > 2,
            tyreAgeDelta: ahead.tyreAge - car.tyreAge,
          });
          if (this.rng() < p) {
            car.overtakes++;
            newDistance = Math.max(newDistance, ahead.distance + 0.0005); // move clear ahead
            ahead.holdUntil = this.elapsedTime + lapTime; // no instant switch-back
            const posNow = this.cars.indexOf(ahead) + 1;
            this.addEvent(`LAP ${car.lap}: ${car.driver.name} overtakes ${ahead.driver.name} for P${posNow}`, { kind: "overtake", driver: car.id, other: ahead.id, pos: posNow });
            if (car.isPlayer) this.addComm("Engineer", `Great move! That's P${posNow}.`, true);
            if (ahead.isPlayer) this.addComm("Engineer", `Lost the position to ${car.driver.name}. Regroup.`, true);
          } else {
            car.holdUntil = this.elapsedTime + lapTime; // next go at the next DRS zone
            newDistance = Math.min(newDistance, ahead.distance - 0.002);
          }
        }
      }

      // Lap Cross
      if (Math.floor(newDistance) > Math.floor(oldDistance) && oldDistance > 0) {
        // Interpolate the exact moment we crossed the line inside this tick
        const crossFrac = (Math.floor(newDistance) - oldDistance) / Math.max(1e-9, newDistance - oldDistance);
        const crossTime = this.elapsedTime - dt + crossFrac * dt;
        let lapTimeDone = crossTime - car.currentLapStartTime;
        car.lapTimes.push(lapTimeDone);
        car.lastLapTime = lapTimeDone;
        if (lapTimeDone < car.bestLapTime) car.bestLapTime = lapTimeDone;
        car.currentLapStartTime = crossTime;
        // Fastest lap of the race (standing-start lap excluded)
        if (car.lapTimes.length > 1 && (!this.fastestLap || lapTimeDone < this.fastestLap.time)) {
          this.fastestLap = { driver: car.id, time: lapTimeDone, lap: car.lapTimes.length };
          this.addEvent(`Fastest lap: ${car.driver.name}, ${lapTimeDone.toFixed(3)}s`, { kind: "fastest", driver: car.id, lapTime: lapTimeDone });
        }

        // New lap: fresh noise sample and a chance of a mistake
        car.lapNoise = clamp(gaussian(this.rng) * car.profile.noiseSigma, -2.5 * car.profile.noiseSigma, 2.5 * car.profile.noiseSigma);
        const mistakeMult = car.driverMode === "Attack" ? 2 : car.driverMode === "Push" ? 1.4 : 1;
        if (!this.neutralisation && this.rng() < car.profile.mistakeChance * mistakeMult) {
          car.lapNoise += 0.6 + this.rng() * 1.6;
          if (car.isPlayer) this.addComm(car.driver.name, "Sorry, locked up into the hairpin.", true);
        }

        if (car.pitStopStatus === "InLap") {
          car.pitStopStatus = "Pitting";
          // Stops are cheaper while the field is neutralised
          const pitFactor = this.neutralisation === "SC" ? SC_PIT_FACTOR : this.neutralisation === "VSC" ? VSC_PIT_FACTOR : 1;
          car.pitTimer = PIT_LOSS_BASE * pitFactor + this.rng() * 1.5;
          if (this.neutralisation) car.neutralStop = true;
          car.pitEntryPos = this.cars.indexOf(car) + 1;
          car.pitLap = car.lapTimes.length;
          newDistance = Math.floor(newDistance) + 0.001;
        } else if (car.pitStopStatus === "OutLap") {
          car.pitStopStatus = "None";
        }
      }

      car.distance = newDistance;
      car.lapFraction = Math.max(0, car.distance % 1);
      car.lap = Math.min(this.totalLaps, Math.floor(car.distance) + 1);

      // Exact finish line interpolation to prevent 0.0s gaps on fast-forward
      if (car.distance >= this.totalLaps && oldDistance < this.totalLaps) {
         let fractionOver = (this.totalLaps - oldDistance) / (newDistance - oldDistance);
         car.totalTime += dt * fractionOver;
         if (breaksCompoundRule(car.usedCompounds, this.isWet)) {
           car.disqualified = true;
           car.dnfReason = "Disqualified: did not use two dry compounds";
           this.addEvent(`${car.driver.name} is disqualified: only one dry compound used`, { kind: "penalty", driver: car.id });
           if (car.isPlayer) this.addComm("Engineer", "We never made the mandatory compound change. That's a disqualification.", true);
         }
      } else if (car.distance < this.totalLaps) {
         car.totalTime += dt;
      }

      // ── Tyres, fuel, ERS, temperature ──────────────────────────────────
      const dLaps = Math.max(0, newDistance - oldDistance);
      car.tyreAge += dLaps * mode.wear;
      car.tireWear = tyreWearPct(car.profile, car.tireCompound, car.tyreAge);

      car.fuel = Math.max(0, car.fuel - (FUEL_USAGE[car.fuelMode] || 1.0) * (105 / this.totalLaps) * dLaps);
      // ERS_USAGE is battery spent per lap: deploy modes drain it, Harvest (negative) recharges it.
      car.ers -= (ERS_USAGE[car.ersMode] || 0) * dLaps * 10;
      car.ers = Math.max(0, Math.min(100, car.ers));

      if (car.driverMode === "Push" || car.driverMode === "Attack") car.engineTemp += dt * 0.5;
      else if (car.driverMode === "Conserve") car.engineTemp -= dt * 1.0;
      else car.engineTemp += (90 - car.engineTemp) * (1 - Math.exp(-0.6 * dt)); // drift to 90, independent of tick size
      car.engineTemp = Math.max(70, Math.min(130, car.engineTemp));

      // DNF Checks
      if (car.failureData && car.distance >= car.failureData.distance) {
        car.retired = true;
        car.dnfReason = `${car.failureData.type} failure`;
        car.stints[car.stints.length - 1].endLap = car.lapTimes.length;
        this.addEvent(`${car.driver.name} is OUT of the race with a ${car.failureData.type.toLowerCase()} failure.`, { kind: "retire", driver: car.id, reason: car.dnfReason });
        if (car.isPlayer) {
           if (car.failureData.type === "Engine") this.addComm(car.driver.name, "I've lost the engine.", true);
           else if (car.failureData.type === "Gearbox") this.addComm(car.driver.name, "I've lost sync, gearbox is broken.", true);
           else this.addComm(car.driver.name, `We have a ${car.failureData.type.toLowerCase()} issue, I have to stop.`, true);
        }
      }
    }

    this.generateComms(dt);

    this.cars.sort((a, b) => compareCars(a, b, this.totalLaps));

    // Leader lap check for snapshots
    const leaderNewLap = this.cars.length > 0 ? this.cars[0].lap : 0;
    if (leaderNewLap > leaderOldLap && leaderNewLap > 1) {
       this.saveSnapshot();
    }

    if (!anyCarRacing) {
      this.raceCompleted = true;
      this.saveSnapshot(); // Final snapshot
      this.addEvent("Chequered flag", { kind: "finish", driver: this.cars[0]?.id });
      this.finalClassification = this.generateFinalClassification();

      // Apply component wear for player cars based on how they drove
      this.cars.filter(c => c.isPlayer).forEach(c => {
        const aggression = (c.driverMode === "Attack" || c.driverMode === "Push") ? 1.2 : 
                           (c.driverMode === "Conserve") ? 0.75 : 0.9;
        const trackIntensity = this.track.speed || 1.0;
        applySessionWear(state, c.driver.name, trackIntensity, aggression, true);
      });
    }
  }

  generateFinalClassification() {
    // 1. Sort cars using compareCars to ensure they are in perfect final order
    const sortedCars = [...this.cars].sort((a, b) => {
      if (Boolean(a.disqualified) !== Boolean(b.disqualified)) return a.disqualified ? 1 : -1;
      return compareCars(a, b, this.totalLaps);
    });

    const classification = {
      raceId: `${this.track.round || 0}_${this.track.name || this.track.circuit || ""}`,
      circuit: this.track.circuit || this.track.name || "",
      round: this.track.round || 0,
      completedAt: Date.now(),
      results: sortedCars.map((c, idx) => ({
        position: idx + 1,
        driver: c.driver,
        team: c.team,
        time: c.retired ? 99999 : c.disqualified ? 199999 : c.totalTime,
        retired: c.retired || Boolean(c.disqualified),
        disqualified: Boolean(c.disqualified),
        // Retired past 90% distance: still classified (and can score)
        classified: !c.disqualified && (!c.retired || isClassified(c.lapTimes.length, this.totalLaps)),
        stops: c.stops,
        tireCompound: c.tireCompound,
        gridPos: c.gridPos,
        dnfReason: c.dnfReason || null,
        lapTimes: [...c.lapTimes],
        stints: c.stints.map(st => ({ ...st, endLap: st.endLap ?? c.lapTimes.length })),
        overtakes: c.overtakes,
      }))
    };

    // Safely freeze classification container, results array, and each result entry
    // without freezing driver or team instances (which must remain mutable in the global state).
    Object.freeze(classification);
    Object.freeze(classification.results);
    classification.results.forEach(entry => Object.freeze(entry));

    return classification;
  }

  getResults() {
    if (this.finalClassification) {
      return this.finalClassification.results;
    }
    const sortedCars = [...this.cars].sort((a, b) => compareCars(a, b, this.totalLaps));
    return sortedCars.map((c, idx) => ({
      driver: c.driver,
      team: c.team,
      time: c.retired ? 99999 : c.totalTime,
      retired: c.retired,
      stops: c.stops,
      tireCompound: c.tireCompound,
      lapTimes: c.lapTimes,
      stints: c.stints,
    }));
  }

  /** Deploy / withdraw the safety car or VSC from the leader's lap. */
  updateNeutralisation() {
    const leader = this.cars.find((c) => !c.retired);
    if (!leader) return;
    const lap = leader.lap;
    const next = inRange(this.scRange, lap) ? "SC" : inRange(this.vscRange, lap) ? "VSC" : null;
    if (next === this.neutralisation) return;
    if (next === "SC") {
      this.addEvent(`LAP ${lap}: SAFETY CAR deployed`, { kind: "safety-car" });
      this.addComm("Engineer", "Safety car, safety car. Stay above the delta. This is a cheap pit window.", true);
    } else if (next === "VSC") {
      this.addEvent(`LAP ${lap}: VIRTUAL SAFETY CAR`, { kind: "vsc" });
      this.addComm("Engineer", "VSC, VSC. Hold the delta. Stops are cheaper right now.", true);
    } else {
      this.addEvent(`LAP ${lap}: ${this.neutralisation === "SC" ? "Safety car in this lap" : "VSC ending"}, green flag`, { kind: "green" });
      this.addComm("Engineer", "Green flag, green flag. Back to racing.", true);
    }
    this.neutralisation = next;
  }

  getReplayData() {
    return {
      totalLaps: this.totalLaps,
      weather: this.isWet ? 'wet' : 'dry',
      snapshots: this.snapshots,
      events: [...this.pitLog],
      feed: this.events,
      scLaps: this.scRange || [],
      vscLaps: this.vscRange || [],
      seed: this.seed,
    };
  }
}
