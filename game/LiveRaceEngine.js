import { getTrackWetProbability } from "../utils/raceBalance.js";
import { rollForFailures, applySessionWear, ensureEngineeringState } from "../utils/engineeringSystem.js";
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
  constructor(teams, track, laps, qualifyingGrid, playerSelectedStrategies, weekendContext) {
    this.track = track;
    this.totalLaps = laps;
    this.isWet = Math.random() < getTrackWetProbability(track.name || track.circuit || "");
    this.weatherStr = this.isWet ? "Wet" : "Dry";
    this.events = [];
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
    
    this.addEvent("Lights out");
    this.addComm("Engineer", "Lights out and away we go! Keep it clean into turn 1.", true);
  }

  calculateFailures() {
    const isChaotic = Math.random() < 0.05;
    const isExtreme = Math.random() < 0.01;
    
    const CATEGORIES = [
      { type: "Engine", weight: 0.35 },
      { type: "Gearbox", weight: 0.25 },
      { type: "Hydraulics", weight: 0.20 },
      { type: "Suspension", weight: 0.10 },
      { type: "Electrical", weight: 0.10 }
    ];

    const GLOBAL_MULTIPLIER = 8.5380; // Auto-tuned for 2.5 avg DNFs per race

    this.cars.forEach(car => {
      // ── Player cars: use engineering component wear for failure probability ──
      if (car.isPlayer) {
        ensureEngineeringState(state);
        const failures = rollForFailures(state, car.driver.name, isChaotic ? 2.0 : isExtreme ? 4.0 : 1.0);
        if (failures.length > 0) {
          const failLap = Math.max(1, Math.floor(Math.random() * this.totalLaps));
          car.failureData = {
            lap: failLap,
            distance: failLap - 1 + Math.random(),
            type: failures[0].type
          };
        }
        return;
      }

      // ── AI cars: use legacy reliability-based model ──
      let relFactor = 0.0;
      if (car.reliability > 85) relFactor = 0.005;
      else if (car.reliability >= 70) relFactor = 0.012;
      else relFactor = 0.025;
      
      let chaosMult = 1.0;
      if (isExtreme) chaosMult = 3.5;
      else if (isChaotic) chaosMult = 2.0;

      for (const cat of CATEGORIES) {
        let prob = relFactor * cat.weight * GLOBAL_MULTIPLIER * chaosMult;
        prob = Math.min(0.9, prob);

        if (Math.random() < prob) {
          const failLap = Math.max(1, Math.floor(Math.random() * this.totalLaps));
          const failFraction = Math.random();
          
          car.failureData = {
             lap: failLap,
             distance: failLap - 1 + failFraction,
             type: cat.type
          };
          break; // One critical failure per car max
        }
      }
    });
  }

  initCars(teams, qualifyingGrid, playerSelectedStrategies, weekendContext) {
    let cars = [];
    
    teams.forEach(team => {
      team.drivers.forEach(driver => {
        const gridPos = this.getGridPosition(qualifyingGrid, driver);
        const isPlayer = !!playerSelectedStrategies && (playerSelectedStrategies[driver.name] !== undefined);
        const profile = buildPaceProfile({ team, driver, track: this.track, isWet: this.isWet, weekendContext, appState: state });

        // Starting compound and stint plan from the chosen (or AI-picked) strategy
        const roundStrats = this.track.round ? (strategies[this.track.round] || []) : [];
        const pick = playerSelectedStrategies?.[driver.name];
        const strat = pick
          ? (roundStrats.find(st => st.id === pick)?.label ?? String(pick))
          : (roundStrats[Math.floor(Math.random() * Math.min(2, roundStrats.length))]?.label ?? "M -> H");
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

  addEvent(msg) {
    this.events.unshift({ time: this.elapsedTime, msg });
    if (this.events.length > 100) this.events.pop();
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
      time: (2.0 + Math.random() * 0.9).toFixed(2),
      oldPos: car.pitEntryPos,
      newPos: exitPos,
      strategy: `${from} → ${next}`,
    });
    this.addEvent(`${car.driver.name} pits: ${from} → ${next}, rejoins P${exitPos}`);
  }

  aiLogic(car, dt, idx) {
     // Player cars are run by the player (or by the race engineer on auto)
     if (car.retired || car.isPlayer) return;

     // ── Tyres: pit near the end of the tyre's useful life ──
     if (!car.aiPitThreshold) car.aiPitThreshold = 0.82 + Math.random() * 0.18;
     const lapsLeft = this.totalLaps - car.distance;
     const life = tyreLife(car.profile, car.tireCompound);
     const dryUsed = new Set(car.usedCompounds.filter(c => DRY_COMPOUNDS.includes(c)));
     const needsRule = !this.isWet && dryUsed.size < 2;
     const canReachEnd = car.tyreAge + lapsLeft <= life * 1.1;
     const wornOut = car.tyreAge >= life * car.aiPitThreshold;
     const ruleDeadline = needsRule && lapsLeft < 12 && car.tyreAge > 6;
     if (car.pitStopStatus === "None" && lapsLeft > 2 && ((wornOut && !(canReachEnd && !needsRule)) || ruleDeadline)) {
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
      if (car.lap <= 1) lapTime += 1.5; // standing start
      if (car.fuel <= 0) lapTime += 8;  // out of fuel: crawling home
      if (car.engineTemp > 120) lapTime += 2.5;
      else if (car.engineTemp > 115) lapTime += 0.6;

      // Dirty air / traffic: find the nearest running car ahead
      const ahead = this.carAhead(i);
      if (ahead && ahead.pitStopStatus !== "Pitting") {
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
      if (ahead && !aheadInPitCycle && car.pitStopStatus !== "InLap" &&
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
          if (Math.random() < p) {
            car.overtakes++;
            newDistance = Math.max(newDistance, ahead.distance + 0.0005); // move clear ahead
            ahead.holdUntil = this.elapsedTime + lapTime; // no instant switch-back
            const posNow = this.cars.indexOf(ahead) + 1;
            this.addEvent(`LAP ${car.lap}: ${car.driver.name} overtakes ${ahead.driver.name} for P${posNow}`);
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

        // New lap: fresh noise sample and a chance of a mistake
        car.lapNoise = clamp(gaussian() * car.profile.noiseSigma, -2.5 * car.profile.noiseSigma, 2.5 * car.profile.noiseSigma);
        const mistakeMult = car.driverMode === "Attack" ? 2 : car.driverMode === "Push" ? 1.4 : 1;
        if (Math.random() < car.profile.mistakeChance * mistakeMult) {
          car.lapNoise += 0.6 + Math.random() * 1.6;
          if (car.isPlayer) this.addComm(car.driver.name, "Sorry, locked up into the hairpin.", true);
        }

        if (car.pitStopStatus === "InLap") {
          car.pitStopStatus = "Pitting";
          car.pitTimer = PIT_LOSS_BASE + Math.random() * 1.5;
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
      } else if (car.distance < this.totalLaps) {
         car.totalTime += dt;
      }

      // ── Tyres, fuel, ERS, temperature ──────────────────────────────────
      const dLaps = Math.max(0, newDistance - oldDistance);
      car.tyreAge += dLaps * mode.wear;
      car.tireWear = tyreWearPct(car.profile, car.tireCompound, car.tyreAge);

      car.fuel = Math.max(0, car.fuel - (FUEL_USAGE[car.fuelMode] || 1.0) * (105 / this.totalLaps) * dLaps);
      car.ers += (ERS_USAGE[car.ersMode] || 0) * dLaps * 10;
      car.ers = Math.max(0, Math.min(100, car.ers));

      if (car.driverMode === "Push" || car.driverMode === "Attack") car.engineTemp += dt * 0.5;
      else if (car.driverMode === "Conserve") car.engineTemp -= dt * 1.0;
      else car.engineTemp += (90 - car.engineTemp) * 0.01; // drift to 90
      car.engineTemp = Math.max(70, Math.min(130, car.engineTemp));

      // DNF Checks
      if (car.failureData && car.distance >= car.failureData.distance) {
        car.retired = true;
        car.dnfReason = `${car.failureData.type} failure`;
        car.stints[car.stints.length - 1].endLap = car.lapTimes.length;
        this.addEvent(`${car.driver.name} is OUT of the race with a ${car.failureData.type.toLowerCase()} failure.`);
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
      this.addEvent("Chequered flag");
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
    const sortedCars = [...this.cars].sort((a, b) => compareCars(a, b, this.totalLaps));

    const classification = {
      raceId: `${this.track.round || 0}_${this.track.name || this.track.circuit || ""}`,
      circuit: this.track.circuit || this.track.name || "",
      round: this.track.round || 0,
      completedAt: Date.now(),
      results: sortedCars.map((c, idx) => ({
        position: idx + 1,
        driver: c.driver,
        team: c.team,
        time: c.retired ? 99999 : c.totalTime,
        retired: c.retired,
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

  getReplayData() {
    return {
      totalLaps: this.totalLaps,
      weather: this.isWet ? 'wet' : 'dry',
      snapshots: this.snapshots,
      events: [...this.pitLog],
      feed: this.events,
      scLaps: [],
      vscLaps: [],
    };
  }
}
