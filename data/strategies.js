export const strategies = {
  1: [
    { id: "str_1_1", label: "M -> H (Efficient 1-Stop)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_1_2", label: "S -> M -> M (Aggressive)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_1_3", label: "I -> W (Rain Cover)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_1_4", label: "S -> S (Too many stops)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  2: [
    { id: "str_2_1", label: "S -> M -> H (Balanced 2-S)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_2_2", label: "M -> H (Tire Save)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_2_3", label: "I -> M (Crossover)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_2_4", label: "H -> S (Wrong tire timing)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  3: [
    { id: "str_3_1", label: "S -> M -> H (High Grip)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_3_2", label: "M -> H (Consistency)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_3_3", label: "W -> I (Wet prep)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_3_4", label: "M -> S (Late deg failure)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  4: [
    { id: "str_4_1", label: "S -> H -> H (Abrasive 2-S)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_4_2", label: "M -> H (Brave 1-Stop)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_4_4", label: "H -> M (Thermal trap)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  5: [
    { id: "str_5_1", label: "M -> H (Track Position)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_5_2", label: "S -> H (Early Stop)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_5_3", label: "I -> S (Street Wet)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_5_4", label: "S -> M (Out of sync)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  6: [
    { id: "str_6_1", label: "M -> H (Heat Management)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_6_2", label: "S -> M -> M (Pace)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_6_3", label: "I -> M (Humidity)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_6_4", label: "M -> S (Late heat spike)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  7: [
    { id: "str_7_1", label: "M -> H (Brake Save)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_7_2", label: "S -> M -> H (Pressure)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_7_3", label: "W -> I -> S (Chaos)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_7_4", label: "H -> S (Cold tire lock-up)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  8: [
    { id: "str_8_1", label: "S -> H (The Only Way)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_8_2", label: "S -> M (Risky Thin)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_8_3", label: "I -> W (Ocean Spray)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_8_4", label: "M -> S (Stuck in traffic)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  9: [
    { id: "str_9_1", label: "S -> M -> H (Aero Bias)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_9_2", label: "M -> H (The Long Game)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_9_3", label: "I -> M (Drying)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_9_4", label: "H -> M -> S (Over-pitting)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  10: [
    { id: "str_10_1", label: "S -> H (Sprint Style)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_10_2", label: "S -> M -> M (Undercut)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_10_3", label: "S -> I (Flash storm)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_10_4", label: "H -> S (Lost window)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  11: [
    { id: "str_11_1", label: "M -> H (High Energy)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_11_2", label: "S -> M -> H (Varying)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_11_3", label: "W -> I (Classic Rain)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_11_4", label: "M -> S (Blistering risk)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  12: [
    { id: "str_12_1", label: "M -> H (Kemmel Speed)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_12_2", label: "S -> M -> M (Sector 2)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_12_3", label: "I -> I (Spa Mist)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_12_4", label: "H -> M (Cold start loss)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  13: [
    { id: "str_13_1", label: "S -> M -> M (Track Position)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_13_2", label: "M -> H (The Fence)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_13_3", label: "I -> S (Dry line)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_13_4", label: "S -> M -> S (Traffic trap)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  14: [
    { id: "str_14_1", label: "M -> H (Banking Durability)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_14_2", label: "S -> M -> M (Attack)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_14_3", label: "W -> I (Sea Storm)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_14_4", label: "H -> S (Low temp spin)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  15: [
    { id: "str_15_1", label: "S -> H (Minimal Pit Loss)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_15_2", label: "M -> H (Safety Play)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_15_3", label: "I -> S (High Speed Wet)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_15_4", label: "M -> S (Lost Slipstream)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  16: [
    { id: "str_16_1", label: "M -> H (Surface Baseline)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_16_2", label: "S -> M -> M (Exploring)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_16_3", label: "S -> I (Street Rain)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_16_4", label: "H -> M (Graining disaster)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  17: [
    { id: "str_17_1", label: "S -> H (Long Straight)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_17_2", label: "M -> H (Safety Car Prep)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_17_3", label: "I -> M (Baku Rink)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_17_4", label: "S -> S (Red Flag Trap)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  18: [
    { id: "str_18_1", label: "M -> H (Wall Safety)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_18_2", label: "S -> M -> H (Pace)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_18_3", label: "W -> I (Heat/Rain)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_18_4", label: "M -> S (Physical fatigue)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  19: [
    { id: "str_19_1", label: "S -> M -> H (Bump Logic)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_19_2", label: "M -> H (Steady)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_19_3", label: "I -> M (S3 Puddles)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_19_4", label: "H -> M -> S (Extra pit cost)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  20: [
    { id: "str_20_1", label: "S -> M (Thin Air Save)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_20_2", label: "M -> H (Cooling focus)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_20_4", label: "M -> S (Brake Failure)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  21: [
    { id: "str_21_1", label: "S -> M -> M (Interlagos Pace)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_21_2", label: "M -> H (Conservative)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_21_3", label: "W -> I -> S (The King)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_21_4", label: "M -> S (Early wear loss)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  22: [
    { id: "str_22_1", label: "S -> M (Night Warm-up)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_22_2", label: "S -> H (Safe Guard)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_22_3", label: "I -> M (Cold Puddles)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_22_4", label: "H -> S (Zero Grip Start)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  23: [
    { id: "str_23_1", label: "S-M-M-H (Survival)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_23_2", label: "M -> H -> H (Safety)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_23_4", label: "M -> M -> S (Terminal Deg)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ],
  24: [
    { id: "str_24_1", label: "M -> H (Sunset Transition)", rank: 1, winModifier: 0.10, riskModifier: 0.01 },
    { id: "str_24_2", label: "S -> M -> H (Attack)", rank: 2, winModifier: 0.05, riskModifier: 0.02 },
    { id: "str_24_3", label: "I -> S (Dusk Rain)", rank: 3, winModifier: 0.00, riskModifier: 0.00 },
    { id: "str_24_4", label: "H -> S (Window Mismatch)", rank: 4, winModifier: 0.00, riskModifier: 0.10 }
  ]
};
