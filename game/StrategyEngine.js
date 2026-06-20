import { getTrackStrategyProfile } from '../data/strategyProfiles.js';

export class StrategyEngine {
  constructor(liveRaceEngine) {
    this.engine = liveRaceEngine;
    this.trackProfile = getTrackStrategyProfile(this.engine.track.name || "");
    this.analysis = {};
  }

  // Called periodically to update the intelligence layer
  update() {
    if (!this.engine.cars || this.engine.cars.length === 0) return;

    this.analysis = {};
    
    // Process weather
    this.analysis.weather = this._analyzeWeather();
    
    // Process safety car probability
    this.analysis.safetyCar = this._analyzeSafetyCar();

    // Process all cars, focusing on players
    this.analysis.drivers = {};
    this.engine.cars.forEach(car => {
      if (car.isPlayer) {
        this.analysis.drivers[car.id] = this._analyzePlayerDriver(car);
      }
    });
  }

  _analyzeWeather() {
    const isWet = this.engine.isWet;
    // Mock future prediction
    const rainExpected = !isWet && Math.random() > 0.8;
    const dryExpected = isWet && Math.random() > 0.8;
    
    return {
      current: isWet ? "Wet" : "Dry",
      trackTemp: isWet ? 22 : 41 + Math.floor(Math.random() * 5),
      airTemp: isWet ? 18 : 28 + Math.floor(Math.random() * 3),
      rainProb: isWet ? 85 : (rainExpected ? 60 : 15),
      forecast: rainExpected ? "Rain expected in ~12 mins" : dryExpected ? "Track drying soon" : "Stable conditions",
      recommendation: rainExpected ? "Delay Pit Stop - Rain Expected" : dryExpected ? "Prepare for slicks" : "Normal Strategy"
    };
  }

  _analyzeSafetyCar() {
    const baseProb = this.trackProfile.safetyCarProb;
    // Increase probability if it's wet
    const modifier = this.engine.isWet ? 1.5 : 1.0;
    return {
      probability: Math.round(baseProb * modifier),
      vscProbability: Math.round(this.trackProfile.vscProb * modifier),
      risk: baseProb * modifier > 30 ? "High Risk" : "Normal"
    };
  }

  _analyzePlayerDriver(car) {
    const profile = this.trackProfile;
    
    // 1. Pit Window Analysis
    const pitLoss = profile.pitLoss;
    // Where would we emerge if we pit right now?
    const projectedEmergeDistance = car.distance - (pitLoss / 90); // 90s lap approx
    
    // Find who we would emerge behind
    let trafficRating = "Clear Air";
    let undercutOpp = false;
    
    const carAhead = this.engine.cars.find(c => c.distance > car.distance && c.distance < car.distance + 0.05);
    if (carAhead && !carAhead.pitStopStatus.includes("Pit")) {
      const gapToAhead = (carAhead.distance - car.distance) * 90;
      if (gapToAhead < 2.0) {
        undercutOpp = true;
      }
    }

    // 2. Tyre Analysis
    const expectedLife = profile.avgStints[car.tireCompound] || 25;
    const lapsOnTire = car.lap; // Assuming no stops yet for simplicity in mock
    const remainingLaps = Math.max(0, expectedLife - lapsOnTire);
    
    let paceDrop = "+0.1s/lap";
    if (car.tireWear > 70) paceDrop = "+0.6s/lap";
    else if (car.tireWear > 50) paceDrop = "+0.3s/lap";

    // 3. Projected Finish
    // Naive projection: maintain current pos, or gain if undercut is strong
    let projectedPos = this.engine.cars.indexOf(car) + 1;
    let alternativePos = projectedPos;
    
    if (undercutOpp && profile.undercutStrength === "High") {
      alternativePos = Math.max(1, projectedPos - 1);
    }

    // 4. Race Engineer Recommendations
    const messages = [];
    if (car.tireWear > 75) {
      messages.push("Tyres are degrading heavily. Box this lap.");
    } else if (undercutOpp && profile.undercutStrength !== "Low") {
      messages.push(`Undercut opportunity against ${carAhead.driver.name.substring(0,3)}. Consider boxing.`);
    } else if (remainingLaps > 5) {
      messages.push("We can extend this stint. Stay out.");
    }

    // 5. Recommended Strategy
    const recStrategy = profile.recommendedStrategies[0];

    return {
      recommendedStrategy: {
        type: recStrategy.type,
        window: `Lap ${recStrategy.window[0]}-${recStrategy.window[1]}`,
        confidence: recStrategy.confidence
      },
      currentRank: `P${projectedPos} Projected`,
      alternativeRank: `P${alternativePos} Projected`,
      pitWindow: {
        status: (car.lap >= recStrategy.window[0] && car.lap <= recStrategy.window[1]) ? "OPEN" : "CLOSED",
        loss: `${pitLoss}s`,
        undercutAvailable: undercutOpp,
        gain: undercutOpp ? "+1.5s" : "N/A"
      },
      tyres: {
        compound: car.tireCompound,
        wear: Math.floor(car.tireWear),
        remaining: remainingLaps,
        paceDrop: paceDrop
      },
      engineerMsgs: messages.length > 0 ? messages : ["Keep pushing. Pace is good."]
    };
  }

  // Simulate Strategy Options
  simulateStrategy(carId, option) {
    const car = this.engine.cars.find(c => c.id === carId);
    if (!car) return null;

    let currentPos = this.engine.cars.indexOf(car) + 1;
    let timeLoss = this.trackProfile.pitLoss;
    let timeGain = 0;
    let projectedFinish = currentPos;

    if (option === "PIT_THIS_LAP") {
      timeGain = 2.5; // fresh tyre advantage
      projectedFinish = Math.max(1, currentPos - 1);
    } else if (option === "PIT_IN_2") {
      timeLoss += 1.0; // lose time on old tyres
      timeGain = 1.8;
      projectedFinish = currentPos;
    } else if (option === "PIT_IN_5") {
      timeLoss += 3.0; // heavy loss
      timeGain = 0.5;
      projectedFinish = Math.min(this.engine.cars.length, currentPos + 1);
    }

    return {
      option,
      projectedFinish: `P${projectedFinish}`,
      timeLoss: `-${timeLoss.toFixed(1)}s`,
      timeGain: `+${timeGain.toFixed(1)}s`
    };
  }
}
