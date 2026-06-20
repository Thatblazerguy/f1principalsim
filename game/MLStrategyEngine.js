import { getTrackStrategyProfile } from '../data/strategyProfiles.js';
import modelData from '../strategy_ml/model.json'; // Vite supports importing JSON

export class MLStrategyEngine {
  constructor(liveRaceEngine, selectedObjective = 'points') {
    this.engine = liveRaceEngine;
    this.selectedObjective = selectedObjective;
    this.trackProfile = getTrackStrategyProfile(this.engine.track.name || "");
    this.analysis = {};
    this.model = modelData;
    this.chatFeed = [];
    this._lastMsgTime = 0;
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

    this._generateChatFeed();
  }

  _generateChatFeed() {
    if (!this.engine.cars || this.engine.cars.length === 0) return;
    
    // Add messages slowly over time
    if (this.engine.elapsedTime - this._lastMsgTime > 15) {
      this._lastMsgTime = this.engine.elapsedTime;
      
      const pCars = this.engine.cars.filter(c => c.isPlayer && !c.retired);
      if (pCars.length > 0) {
        const car = pCars[Math.floor(Math.random() * pCars.length)];
        const analysis = this.analysis.drivers[car.id];
        if (analysis && analysis.engineerMsgs.length > 0) {
          const msg = analysis.engineerMsgs[Math.floor(Math.random() * analysis.engineerMsgs.length)];
          this.pushChat("Engineer", msg, car.id);
        }

        // Driver feedback
        if (car.tireWear > 60 && Math.random() < 0.3) {
          this.pushChat("Driver", "Grip is starting to go.", car.id);
        } else if (car.engineTemp > 115 && Math.random() < 0.3) {
          this.pushChat("Driver", "Engine feels a bit hot.", car.id);
        }
      }
    }
  }

  pushChat(sender, message, carId) {
    this.chatFeed.push({ time: this.engine.elapsedTime, sender, message, carId });
    if (this.chatFeed.length > 20) this.chatFeed.shift();
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
    
    // Objective processing
    let targetPos = 10;
    if (this.selectedObjective === 'win') targetPos = 1;
    else if (this.selectedObjective === 'podium') targetPos = 3;
    else if (this.selectedObjective === 'points') targetPos = 10;
    else if (this.selectedObjective === 'conservative') targetPos = 12;
    else if (this.selectedObjective === 'gamble') targetPos = 5;

    let objectiveStatus = "ON TARGET";
    if (projectedPos > targetPos + 2) objectiveStatus = "FAILED";
    else if (projectedPos > targetPos) objectiveStatus = "AT RISK";

    let confidenceOffset = (targetPos - projectedPos) * 5;
    let baseConfidence = 80 + confidenceOffset;
    if (this.selectedObjective === 'gamble') baseConfidence -= 20;
    baseConfidence = Math.max(10, Math.min(99, baseConfidence));

    const plans = {
      planA: { action: "One Stop", proj: projectedPos, conf: baseConfidence },
      planB: { action: "Undercut", proj: Math.max(1, projectedPos - 1), conf: baseConfidence - 15 },
      planC: { action: "Safety Car Gamble", proj: Math.max(1, projectedPos - 3), conf: 25 }
    };

    let activePlan = plans.planA;
    let recommendedAction = "STAY OUT";
    let actionGain = "N/A";
    
    if (mlResult.bestStrategy !== "STAY_OUT" && mlResult.confidence > 60) {
      recommendedAction = mlResult.bestStrategy.replace(/_/g, ' ');
      actionGain = "+1 Position";
      activePlan = plans.planB;
    }

    return {
      objective: {
        id: this.selectedObjective,
        status: objectiveStatus,
        projectedFinish: `P${activePlan.proj}`,
        confidence: activePlan.conf
      },
      recommendedAction: {
        type: recommendedAction,
        gain: actionGain,
        confidence: mlResult.confidence
      },
      plans: plans,
      pitWindow: {
        status: mlResult.bestStrategy.includes("PIT") ? "OPEN" : "CLOSED",
        undercutAvailable: gapAhead < 2.0
      },
      engineerMsgs: mlResult.activeInsights
    };
  }

  simulateStrategy(carId, option) {
     if (!this.analysis.drivers || !this.analysis.drivers[carId]) return null;
     const currentProjStr = this.analysis.drivers[carId].objective.projectedFinish || 'P10';
     const currentProj = parseInt(currentProjStr.replace('P', ''));
     
     if (option === "PIT_THIS_LAP") {
        return { proj: `P${Math.max(1, currentProj - 1)}`, conf: 78 };
     } else if (option === "PIT_IN_3_LAPS") {
        return { proj: `P${currentProj}`, conf: 65 };
     } else {
        return { proj: `P${currentProj + 1}`, conf: 45 };
     }
  }
}
