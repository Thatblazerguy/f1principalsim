import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";
import { getTrackWetProbability } from "../utils/raceBalance.js";

const TIRE_DEGRADATION = {
  "Soft": 0.035,
  "Medium": 0.020,
  "Hard": 0.012,
  "Intermediate": 0.040,
  "Wet": 0.030
};

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

const PACE_MODIFIERS = {
  "Push": 0.020,
  "Attack": 0.040,
  "Balanced": 0,
  "Conserve": -0.020,
  "Defend": -0.015
};

const TIRE_WEAR_MODIFIERS = {
  "Push": 1.5,
  "Attack": 2.2,
  "Balanced": 1.0,
  "Conserve": 0.5,
  "Defend": 1.2
};

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

    this.cars = this.initCars(teams, qualifyingGrid, playerSelectedStrategies, weekendContext);
    this.calculateFailures();
    
    this.addEvent("Race started!");
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
        const baseLap = this.track.baseTime - (driver.pace * 0.03) - (team.carPerformance * 0.03);
        const finalModifier = weekendContext?.drivers?.[driver.name]?.finalModifier ?? 1.0;
        const effectiveBaseLap = baseLap * finalModifier;
        const speedKms = (this.track.baseTime / effectiveBaseLap) * 220;
        
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
          tireCompound: this.isWet ? "Intermediate" : "Medium",
          
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
          isPlayer: !!playerSelectedStrategies && (playerSelectedStrategies[driver.name] !== undefined), 
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
      car.driverMode = value;
      this.addComm("Engineer", `Copy that, switch to ${value} pace.`, true);
    } else if (command === "FUEL") {
      car.fuelMode = value;
    } else if (command === "ERS") {
      car.ersMode = value;
    } else if (command === "PIT") {
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
    // Check drivers for comms triggers
    this.cars.forEach(car => {
       if (car.retired || !car.isPlayer) return;

       if (car.tireWear > 50 && !car._commsFlags.tireWarning50) {
         car._commsFlags.tireWarning50 = true;
         if (Math.random() > 0.5) {
           this.addComm(car.driver.name, "Starting to lose some grip on the rears.", true);
         }
       }
       if (car.tireWear > 75 && !car._commsFlags.tireWarning75) {
         car._commsFlags.tireWarning75 = true;
         this.addComm(car.driver.name, "Tyres are completely gone, we need to box soon.", true);
         this.addComm("Engineer", "Understood, looking at the pit window now.", true);
       }
       
       if (car.ers < 10 && car.ersMode !== "Harvest" && !car._commsFlags.ersWarning) {
         car._commsFlags.ersWarning = true;
         this.addComm("Engineer", "Battery is getting low, recommend harvesting.", true);
       } else if (car.ers > 20) {
         car._commsFlags.ersWarning = false;
       }
    });

    // Random engineer chatter
    if (Math.random() < 0.005 * dt) {
      const pCars = this.cars.filter(c => c.isPlayer && !c.retired);
      if (pCars.length > 0) {
         const car = pCars[Math.floor(Math.random() * pCars.length)];
         const idx = this.cars.findIndex(c => c.id === car.id);
         if (idx > 0) {
           const gap = ((this.cars[idx-1].distance - car.distance) * 90).toFixed(1);
           if (gap < 3.0) {
             this.addComm("Engineer", `Gap to ${this.cars[idx-1].driver.name} ahead is ${gap}s. You have the pace.`, true);
           }
         }
      }
    }
  }

  aiLogic(car, dt) {
     if (car.isPlayer || car.retired) return;

     // Simple personality AI
     const isAggressive = car.team.name === "Red Bull Racing" || car.team.name === "McLaren";
     const isConservative = car.team.name === "Aston Martin" || car.team.name === "Williams";

     // Tire logic
     const wearLimit = isAggressive ? 85 : isConservative ? 75 : 80;
     if (car.tireWear > wearLimit && car.pitStopStatus === "None" && car.distance < this.totalLaps - 1) {
       car.pitStopStatus = "InLap";
       car.nextTire = this.isWet ? "Intermediate" : "Medium"; // Naive selection
     }

     // ERS / Fuel / Temp logic
     // CRITICAL: Prevent AI thermal suicide
     if (car.engineTemp > 115) {
        car.ersMode = "Balanced";
        car.driverMode = "Conserve";
     } else {
        if (car.ers > 80 && Math.random() < 0.1) {
           car.ersMode = "Deploy";
           car.driverMode = "Push";
        } else if (car.ers < 20) {
           car.ersMode = "Harvest";
           car.driverMode = "Balanced";
        } else if (car.ersMode === "Deploy" && car.ers < 50) {
           car.ersMode = "Balanced";
           car.driverMode = "Balanced";
        }
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
      this.aiLogic(car, dt);

      if (car.pitStopStatus === "Pitting") {
        car.currentSpeed = 0;
        car.pitTimer -= dt;
        if (car.pitTimer <= 0) {
          car.pitStopStatus = "OutLap";
          car.tireCompound = car.nextTire || "Medium";
          car.tireWear = 0;
          car.stops++;
          car._commsFlags = { tireWarning50: false, tireWarning75: false, ersWarning: false };
          this.addEvent(`${car.driver.name} completes pit stop.`);
        }
        continue;
      }

      // Physics/Telemetry Update
      let lapsPerSecond = 1 / this.track.baseTime;
      lapsPerSecond *= (car.baseSpeed / 220);
      lapsPerSecond *= (1 + PACE_MODIFIERS[car.driverMode]);
      
      // ERS Boost
      if (car.ersMode === "Overtake" || car.ersMode === "Deploy") {
         lapsPerSecond *= 1.02;
      }

      // Fuel weight penalty (lighter is faster, up to 3% faster)
      let fuelWeightPenalty = (car.fuel / 110) * 0.03;
      lapsPerSecond *= (1 + (0.03 - fuelWeightPenalty));

      let wearPenalty = (car.tireWear / 100) * 0.05; 
      lapsPerSecond *= (1 - wearPenalty);
      
      if (this.isWet && !["Intermediate", "Wet"].includes(car.tireCompound)) {
        lapsPerSecond *= 0.7; 
      } else if (!this.isWet && ["Intermediate", "Wet"].includes(car.tireCompound)) {
        lapsPerSecond *= 0.8; 
      }

      // Thermal Pace Penalties (Instead of RNG Death)
      if (car.engineTemp > 120) lapsPerSecond *= 0.80; // 20% pace loss
      else if (car.engineTemp > 115) lapsPerSecond *= 0.95; // 5% pace loss

      car.currentSpeed = lapsPerSecond;

      let oldDistance = car.distance;
      let newDistance = car.distance + (lapsPerSecond * dt);
      
      // Lap Cross
      if (Math.floor(newDistance) > Math.floor(oldDistance) && oldDistance > 0) {
        let lapTime = this.elapsedTime - car.currentLapStartTime;
        car.lapTimes.push(lapTime);
        car.lastLapTime = lapTime;
        if (lapTime < car.bestLapTime) car.bestLapTime = lapTime;
        car.currentLapStartTime = this.elapsedTime;

        if (car.pitStopStatus === "InLap") {
          car.pitStopStatus = "Pitting";
          car.pitTimer = 22 + Math.random() * 3; 
          newDistance = Math.floor(oldDistance) + 0.01; 
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

      // Telemetry Deg/Usage
      let wearRate = (TIRE_DEGRADATION[car.tireCompound] || 0.02) * TIRE_WEAR_MODIFIERS[car.driverMode];
      if (this.isWet && !["Intermediate", "Wet"].includes(car.tireCompound)) wearRate *= 2;
      else if (!this.isWet && ["Intermediate", "Wet"].includes(car.tireCompound)) wearRate *= 4;
      
      car.tireWear += wearRate * 100 * (lapsPerSecond * dt);
      car.tireWear = Math.min(100, car.tireWear);

      car.fuel -= (FUEL_USAGE[car.fuelMode] || 1.0) * (110 / this.totalLaps) * (lapsPerSecond * dt);
      car.ers += (ERS_USAGE[car.ersMode] || 0) * (lapsPerSecond * dt) * 10;
      car.ers = Math.max(0, Math.min(100, car.ers));
      
      // Temps
      if (car.driverMode === "Push" || car.driverMode === "Attack") car.engineTemp += dt * 0.5;
      else if (car.driverMode === "Conserve") car.engineTemp -= dt * 1.0;
      else car.engineTemp += (90 - car.engineTemp) * 0.01; // drift to 90
      car.engineTemp = Math.max(70, Math.min(130, car.engineTemp));

      // DNF Checks
      if (car.failureData && car.distance >= car.failureData.distance) {
        car.retired = true;
        this.addEvent(`${car.driver.name} is OUT of the race with a ${car.failureData.type.toLowerCase()} failure.`);
        if (car.isPlayer) {
           if (car.failureData.type === "Engine") this.addComm(car.driver.name, "I've lost the engine.", true);
           else if (car.failureData.type === "Gearbox") this.addComm(car.driver.name, "I've lost sync, gearbox is broken.", true);
           else this.addComm(car.driver.name, `We have a ${car.failureData.type.toLowerCase()} issue, I have to stop.`, true);
        }
      }
    }

    this.generateComms(dt);

    let oldOrder = this.cars.map(c => c.id);
    this.cars.sort((a, b) => compareCars(a, b, this.totalLaps));
    let newOrder = this.cars.map(c => c.id);

    // Leader lap check for snapshots
    const leaderNewLap = this.cars.length > 0 ? this.cars[0].lap : 0;
    if (leaderNewLap > leaderOldLap && leaderNewLap > 1) {
       this.saveSnapshot();
    }

    for (let i = 0; i < oldOrder.length; i++) {
      if (oldOrder[i] !== newOrder[i]) {
        let driverGained = newOrder[i];
        let driverLost = oldOrder[i];
        let carGained = this.cars.find(c => c.id === driverGained);
        let carLost = this.cars.find(c => c.id === driverLost);
        
        if (carGained && carLost && i < 10 && carGained.pitStopStatus === "None" && carLost.pitStopStatus === "None") {
           if (Math.random() < 0.2) {
             this.addEvent(`LAP ${carGained.lap}: ${carGained.driver.name} overtakes ${carLost.driver.name} for P${i+1}`);
             if (carGained.isPlayer) this.addComm("Engineer", `Great job, that's P${i+1}.`, true);
             if (carLost.isPlayer) this.addComm("Engineer", `We lost the position to ${carGained.driver.name}.`, true);
           }
        }
      }
    }

    if (!anyCarRacing) {
      this.raceCompleted = true;
      this.saveSnapshot(); // Final snapshot
      this.addEvent("Race Finished!");
      this.finalClassification = this.generateFinalClassification();
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
        tireCompound: c.tireCompound
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
      lapTimes: c.lapTimes
    }));
  }

  getReplayData() {
    return {
      totalLaps: this.totalLaps,
      snapshots: this.snapshots,
      events: this.events
    };
  }
}
