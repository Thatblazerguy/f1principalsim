import { getTrackStrategyProfile } from '../data/strategyProfiles.js';
import modelData from '../strategy_ml/model.json'; // Vite supports importing JSON

export class MLStrategyEngine {
  constructor(liveRaceEngine) {
    this.engine = liveRaceEngine;
    this.trackProfile = getTrackStrategyProfile(this.engine.track.name || "");
    this.analysis = {};
    this.model = modelData;
  }

  update() {
    if (!this.engine.cars || this.engine.cars.length === 0) return;

    this.analysis = {};
    
    // Process weather & SC risk
    this.analysis.weather = this._analyzeWeather();
    this.analysis.safetyCar = this._analyzeSafetyCar();

    this.analysis.drivers = {};
    this.engine.cars.forEach(car => {
      if (car.isPlayer) {
        this.analysis.drivers[car.id] = this._analyzePlayerDriver(car);
      }
    });
  }

  _analyzeWeather() {
    const isWet = this.engine.isWet;
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
    const baseProb = this.trackProfile.safetyCarProb || 15;
    const modifier = this.engine.isWet ? 1.5 : 1.0;
    return {
      probability: Math.round(baseProb * modifier),
      vscProbability: Math.round((this.trackProfile.vscProb || 20) * modifier),
      risk: baseProb * modifier > 30 ? "High Risk" : "Normal",
      rawRiskFactor: (baseProb * modifier) / 100
    };
  }

  _getCarGaps(car) {
    const sortedCars = [...this.engine.cars].sort((a, b) => b.distance - a.distance);
    const index = sortedCars.indexOf(car);
    
    let gapAhead = 999;
    let gapBehind = 999;
    
    if (index > 0) {
      gapAhead = (sortedCars[index - 1].distance - car.distance) * 90; // approx seconds
    }
    if (index < sortedCars.length - 1) {
      gapBehind = (car.distance - sortedCars[index + 1].distance) * 90;
    }
    
    return { gapAhead, gapBehind };
  }

  _evaluateMLModel(features) {
    // A lightweight JS rule evaluator that mocks the Random Forest path inference
    let scores = {
      "PIT_THIS_LAP": 0,
      "PIT_IN_2": 0,
      "PIT_IN_5": 0,
      "STAY_OUT": 0
    };
    
    let activeInsights = [];

    // Evaluate rules from exported model.json
    this.model.rules.forEach(rule => {
      const featureValue = features[rule.condition.feature];
      let conditionMet = false;
      
      if (rule.condition.operator === ">") {
        conditionMet = featureValue > rule.condition.value;
      } else if (rule.condition.operator === "<") {
        conditionMet = featureValue < rule.condition.value;
      }
      
      if (conditionMet) {
        scores[rule.strategy] += rule.weight;
        
        // Generate dynamic engineer insights based on activated ML rules
        if (rule.condition.feature === "tyre_age") {
           activeInsights.push(rule.condition.operator === ">" ? "Tyres degrading faster than expected. Recommend boxing." : "Tyre life is optimal. We can extend the stint.");
        } else if (rule.condition.feature === "sc_risk" && rule.condition.operator === ">") {
           activeInsights.push("Safety Car risk is elevated. Pitting now is highly advantageous.");
        } else if (rule.condition.feature === "gap_behind" && rule.condition.operator === ">") {
           activeInsights.push("Large gap behind. We have a free pit stop window.");
        } else if (rule.condition.feature === "gap_ahead" && rule.condition.operator === "<") {
           activeInsights.push("Undercut opportunity available on car ahead.");
        }
      }
    });
    
    // Normalize and pick best strategy
    let bestStrategy = "STAY_OUT";
    let maxScore = -1;
    let totalScore = 0;
    
    for (const [strategy, score] of Object.entries(scores)) {
      totalScore += score;
      if (score > maxScore) {
        maxScore = score;
        bestStrategy = strategy;
      }
    }
    
    const confidence = totalScore > 0 ? Math.round((maxScore / totalScore) * 100) : 50;
    if (confidence < 50) bestStrategy = "STAY_OUT"; // default if unsure

    // Deduplicate insights
    activeInsights = [...new Set(activeInsights)];
    if (activeInsights.length === 0) {
      activeInsights.push("Keep pushing. Strategy is optimal.");
    }

    return { bestStrategy, confidence, activeInsights };
  }

  _analyzePlayerDriver(car) {
    const { gapAhead, gapBehind } = this._getCarGaps(car);
    const scRisk = this.analysis.safetyCar.rawRiskFactor;
    
    const features = {
      lap: car.lap,
      compound: car.tireCompound === "SOFT" ? 0 : car.tireCompound === "MEDIUM" ? 1 : 2,
      tyre_age: car.lap, // Simple approximation
      gap_ahead: gapAhead,
      gap_behind: gapBehind,
      sc_risk: scRisk,
      track_temp: this.analysis.weather.trackTemp
    };
    
    const mlResult = this._evaluateMLModel(features);

    let projectedPos = this.engine.cars.indexOf(car) + 1;
    let alternativePos = projectedPos;

    if (mlResult.bestStrategy !== "STAY_OUT" && mlResult.confidence > 70) {
      alternativePos = Math.max(1, projectedPos - 1);
    }

    return {
      recommendedStrategy: {
        type: mlResult.bestStrategy.replace(/_/g, ' '),
        window: mlResult.bestStrategy === "STAY_OUT" ? "N/A" : "Immediate",
        confidence: mlResult.confidence
      },
      currentRank: `P${projectedPos} Projected`,
      alternativeRank: `P${alternativePos} Projected`,
      pitWindow: {
        status: mlResult.bestStrategy.includes("PIT") ? "OPEN" : "CLOSED",
        loss: `${this.trackProfile.pitLoss || 22}s`,
        undercutAvailable: gapAhead < 2.0,
        gain: gapAhead < 2.0 ? "+1.5s" : "N/A",
        overcutAvailable: false
      },
      tyres: {
        compound: car.tireCompound,
        wear: Math.floor(car.tireWear),
        remaining: 30 - car.lap, // simple mock
        paceDrop: car.tireWear > 70 ? "+0.6s/lap" : "+0.1s/lap"
      },
      engineerMsgs: mlResult.activeInsights
    };
  }

  simulateStrategy(carId, option) {
    const car = this.engine.cars.find(c => c.id === carId);
    if (!car) return null;

    let currentPos = this.engine.cars.indexOf(car) + 1;
    let timeLoss = this.trackProfile.pitLoss || 22;
    let timeGain = 0;
    let projectedFinish = currentPos;

    if (option === "PIT_THIS_LAP") {
      timeGain = 2.5;
      projectedFinish = Math.max(1, currentPos - 1);
    } else if (option === "PIT_IN_2") {
      timeLoss += 1.0;
      timeGain = 1.8;
      projectedFinish = currentPos;
    } else if (option === "PIT_IN_5") {
      timeLoss += 3.0;
      timeGain = 0.5;
      projectedFinish = Math.min(this.engine.cars.length, currentPos + 1);
    } else if (option === "STAY_OUT") {
      timeLoss = 0;
      timeGain = 0;
      projectedFinish = currentPos;
    }

    // Apply ML accuracy variance to projection
    const errorMargin = this.model.metrics.mae || 1.42;

    return {
      option,
      projectedFinish: `P${projectedFinish}`,
      errorMargin: `±${errorMargin.toFixed(1)} Pos`,
      timeLoss: `-${timeLoss.toFixed(1)}s`,
      timeGain: `+${timeGain.toFixed(1)}s`
    };
  }
}
