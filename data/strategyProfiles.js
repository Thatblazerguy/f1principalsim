export const STRATEGY_KNOWLEDGE_BASE = {
  // Default values for unknown tracks
  "default": {
    pitLoss: 21.0,
    safetyCarProb: 25,
    vscProb: 15,
    undercutStrength: "Medium", // Low, Medium, High, Extreme
    overcutStrength: "Low",
    avgStints: {
      "Soft": 15,
      "Medium": 25,
      "Hard": 40
    },
    recommendedStrategies: [
      { stops: 1, type: "Medium -> Hard", confidence: 75, window: [18, 24] },
      { stops: 2, type: "Soft -> Medium -> Soft", confidence: 60, window: [12, 16] }
    ]
  },
  "Bahrain International Circuit": {
    pitLoss: 23.5,
    safetyCarProb: 18,
    vscProb: 22,
    undercutStrength: "Extreme", // High degradation track
    overcutStrength: "Low",
    avgStints: {
      "Soft": 12,
      "Medium": 22,
      "Hard": 35
    },
    recommendedStrategies: [
      { stops: 2, type: "Soft -> Hard -> Hard", confidence: 88, window: [11, 15] },
      { stops: 2, type: "Soft -> Hard -> Medium", confidence: 72, window: [13, 17] }
    ]
  },
  "Suzuka Circuit": {
    pitLoss: 22.0,
    safetyCarProb: 18,
    vscProb: 10,
    undercutStrength: "High",
    overcutStrength: "Low",
    avgStints: {
      "Soft": 14,
      "Medium": 24,
      "Hard": 38
    },
    recommendedStrategies: [
      { stops: 1, type: "Medium -> Hard", confidence: 82, window: [16, 22] },
      { stops: 2, type: "Soft -> Medium -> Medium", confidence: 65, window: [12, 16] }
    ]
  },
  "Circuit de Monaco": {
    pitLoss: 24.5,
    safetyCarProb: 85,
    vscProb: 40,
    undercutStrength: "Low",
    overcutStrength: "Extreme", // Track position is king
    avgStints: {
      "Soft": 25,
      "Medium": 40,
      "Hard": 60
    },
    recommendedStrategies: [
      { stops: 1, type: "Medium -> Hard", confidence: 95, window: [28, 38] },
      { stops: 1, type: "Hard -> Medium", confidence: 70, window: [40, 50] }
    ]
  },
  "Autodromo Nazionale Monza": {
    pitLoss: 24.0,
    safetyCarProb: 35,
    vscProb: 25,
    undercutStrength: "Medium",
    overcutStrength: "Low",
    avgStints: {
      "Soft": 18,
      "Medium": 30,
      "Hard": 45
    },
    recommendedStrategies: [
      { stops: 1, type: "Medium -> Hard", confidence: 92, window: [20, 26] },
      { stops: 1, type: "Soft -> Hard", confidence: 68, window: [16, 22] }
    ]
  }
};

export function getTrackStrategyProfile(trackName) {
  // Find a match or return default
  for (const key of Object.keys(STRATEGY_KNOWLEDGE_BASE)) {
    if (trackName.includes(key) || key.includes(trackName)) {
      return STRATEGY_KNOWLEDGE_BASE[key];
    }
  }
  return STRATEGY_KNOWLEDGE_BASE["default"];
}
