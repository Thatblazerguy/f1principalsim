/**
 * devProjects.js
 * Development Project System — Core logic for car upgrade projects.
 * Tracks upgrade programs from concept to track introduction.
 */

// ─── Development Catalog ────────────────────────────────────────────────────

export const DEVELOPMENT_CATALOG = {
  aero: {
    label: "Aerodynamics",
    color: "#3b82f6",
    icon: "Wind",
    items: {
      frontWing: {
        label: "Front Wing",
        description: "Revised front wing endplates and mainplane geometry for improved downforce.",
        statBonuses: { cornering: 0.9, downforce: 1.2, dragRatio: -0.01 },
        baseCost: 12, baseRaces: 3, baseConfidence: 78, risk: "Low",
        windTunnelUsage: 25, cfdUsage: 30,
      },
      rearWing: {
        label: "Rear Wing",
        description: "New rear wing concept targeting DRS delta improvement and high-speed stability.",
        statBonuses: { downforce: 1.0, topSpeed: 0.8, dragRatio: -0.015 },
        baseCost: 10, baseRaces: 3, baseConfidence: 76, risk: "Low",
        windTunnelUsage: 20, cfdUsage: 25,
      },
      floor: {
        label: "Floor",
        description: "Ground effect floor redesign to maximise venturi channel efficiency.",
        statBonuses: { downforce: 2.1, cornering: 1.5, balance: 0.8 },
        baseCost: 22, baseRaces: 5, baseConfidence: 61, risk: "High",
        windTunnelUsage: 40, cfdUsage: 45,
      },
      diffuser: {
        label: "Diffuser",
        description: "Evolved diffuser package for improved rear downforce and flow attachment.",
        statBonuses: { downforce: 1.4, balance: 1.1, cornering: 0.7 },
        baseCost: 14, baseRaces: 4, baseConfidence: 70, risk: "Medium",
        windTunnelUsage: 30, cfdUsage: 35,
      },
      sidepods: {
        label: "Sidepods",
        description: "Sidepod undercut revision to improve airflow management to rear of car.",
        statBonuses: { downforce: 0.8, fuelEfficiency: 0.6, reliability: 0.5 },
        baseCost: 18, baseRaces: 5, baseConfidence: 65, risk: "Medium",
        windTunnelUsage: 35, cfdUsage: 40,
      },
      cooling: {
        label: "Cooling Package",
        description: "Improved cooling ducts to reduce overheating risk in high-ambient conditions.",
        statBonuses: { reliability: 1.5, fuelEfficiency: 0.4 },
        baseCost: 8, baseRaces: 2, baseConfidence: 85, risk: "Low",
        windTunnelUsage: 10, cfdUsage: 15,
      },
    },
  },
  chassis: {
    label: "Chassis",
    color: "#8b5cf6",
    icon: "Settings",
    items: {
      weightReduction: {
        label: "Weight Reduction",
        description: "Composite material substitution program to reduce minimum weight.",
        statBonuses: { mechanicalGrip: 0.8, acceleration: 0.7, cornering: 0.5 },
        baseCost: 16, baseRaces: 4, baseConfidence: 72, risk: "Medium",
        windTunnelUsage: 5, cfdUsage: 20,
      },
      suspension: {
        label: "Suspension",
        description: "New suspension geometry to optimise weight transfer and mechanical grip.",
        statBonuses: { mechanicalGrip: 1.8, balance: 1.2, tyreWear: 1.0 },
        baseCost: 20, baseRaces: 5, baseConfidence: 68, risk: "Medium",
        windTunnelUsage: 10, cfdUsage: 25,
      },
      mechanicalGrip: {
        label: "Mechanical Grip Package",
        description: "Combined update targeting setup flexibility and tyre contact patch.",
        statBonuses: { mechanicalGrip: 1.4, tyreWear: 1.5, balance: 0.9 },
        baseCost: 14, baseRaces: 3, baseConfidence: 74, risk: "Low",
        windTunnelUsage: 5, cfdUsage: 15,
      },
      balance: {
        label: "Balance & Stability",
        description: "Revised weight distribution and anti-roll bar adjustment range.",
        statBonuses: { balance: 1.8, tyreWear: 0.8, cornering: 0.6 },
        baseCost: 10, baseRaces: 2, baseConfidence: 82, risk: "Low",
        windTunnelUsage: 5, cfdUsage: 10,
      },
    },
  },
  powerUnit: {
    label: "Power Unit",
    color: "#f59e0b",
    icon: "Zap",
    items: {
      ice: {
        label: "ICE Development",
        description: "Internal combustion engine specification upgrade for improved peak power output.",
        statBonuses: { topSpeed: 1.8, acceleration: 1.2, fuelEfficiency: -0.3 },
        baseCost: 28, baseRaces: 6, baseConfidence: 58, risk: "High",
        windTunnelUsage: 0, cfdUsage: 5,
      },
      ers: {
        label: "ERS Optimisation",
        description: "Energy recovery system software and hardware improvements.",
        statBonuses: { acceleration: 1.5, topSpeed: 0.8, fuelEfficiency: 1.0 },
        baseCost: 18, baseRaces: 4, baseConfidence: 70, risk: "Medium",
        windTunnelUsage: 0, cfdUsage: 10,
      },
      turbo: {
        label: "Turbocharger",
        description: "Revised turbocharger geometry for improved spool response and peak output.",
        statBonuses: { topSpeed: 1.2, acceleration: 0.8, reliability: 0.5 },
        baseCost: 20, baseRaces: 5, baseConfidence: 63, risk: "High",
        windTunnelUsage: 0, cfdUsage: 5,
      },
      energyRecovery: {
        label: "Energy Recovery",
        description: "MGU-K and MGU-H integration improvement for better deployment strategies.",
        statBonuses: { acceleration: 1.0, fuelEfficiency: 1.2, reliability: 0.3 },
        baseCost: 15, baseRaces: 3, baseConfidence: 75, risk: "Medium",
        windTunnelUsage: 0, cfdUsage: 8,
      },
    },
  },
  reliability: {
    label: "Reliability",
    color: "#10b981",
    icon: "Shield",
    items: {
      engineReliability: {
        label: "Engine Reliability",
        description: "Stress testing and material improvements to reduce catastrophic failure risk.",
        statBonuses: { reliability: 2.5, fuelEfficiency: 0.3 },
        baseCost: 12, baseRaces: 3, baseConfidence: 84, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 5,
      },
      gearboxReliability: {
        label: "Gearbox Reliability",
        description: "Revised gear-change mechanism with improved heat management.",
        statBonuses: { reliability: 1.8, acceleration: 0.3 },
        baseCost: 10, baseRaces: 2, baseConfidence: 88, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 5,
      },
      coolingReliability: {
        label: "Cooling Reliability",
        description: "Enhanced heat exchanger layout for high-ambient temperature circuits.",
        statBonuses: { reliability: 1.5 },
        baseCost: 8, baseRaces: 2, baseConfidence: 90, risk: "Low",
        windTunnelUsage: 5, cfdUsage: 10,
      },
      electronics: {
        label: "Electronics Package",
        description: "Control unit hardening and sensor redundancy for critical systems.",
        statBonuses: { reliability: 1.2, fuelEfficiency: 0.4 },
        baseCost: 9, baseRaces: 2, baseConfidence: 87, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 5,
      },
      hydraulics: {
        label: "Hydraulics",
        description: "Hydraulic system seals and pump reliability programme.",
        statBonuses: { reliability: 1.0 },
        baseCost: 6, baseRaces: 2, baseConfidence: 91, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 2,
      },
    },
  },
  pitCrew: {
    label: "Pit Crew",
    color: "#ef4444",
    icon: "Timer",
    items: {
      jackSpeed: {
        label: "Jack Speed Training",
        description: "Intensive jack operator drills to reduce average jack cycle time.",
        statBonuses: { pitStopTime: -0.12 },
        baseCost: 4, baseRaces: 2, baseConfidence: 88, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 0,
      },
      wheelGun: {
        label: "Wheel Gun Technology",
        description: "Upgraded pneumatic wheel gun to reduce average nut-on time.",
        statBonuses: { pitStopTime: -0.10 },
        baseCost: 5, baseRaces: 2, baseConfidence: 90, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 0,
      },
      crewCoordination: {
        label: "Crew Coordination",
        description: "Pit wall simulation systems to reduce crew error rates.",
        statBonuses: { pitStopTime: -0.08, pitErrorRate: -0.5 },
        baseCost: 3, baseRaces: 1, baseConfidence: 92, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 0,
      },
      releaseAccuracy: {
        label: "Release Accuracy",
        description: "Lollipop and traffic light system upgrade for safer, faster releases.",
        statBonuses: { pitErrorRate: -0.8 },
        baseCost: 4, baseRaces: 2, baseConfidence: 90, risk: "Low",
        windTunnelUsage: 0, cfdUsage: 0,
      },
    },
  },
};

// ─── Track Circuit Profiles ──────────────────────────────────────────────────
const CIRCUIT_PROFILES = {
  "Albert Park Circuit":           { strengths: ["aero.frontWing", "chassis.mechanicalGrip"], weaknesses: ["powerUnit.ice"], type: "Mixed" },
  "Shanghai International Circuit":{ strengths: ["aero.floor", "powerUnit.ers"], weaknesses: ["chassis.balance"], type: "Mixed" },
  "Suzuka Circuit":                { strengths: ["aero.floor", "aero.diffuser"], weaknesses: ["powerUnit.ice"], type: "Highspeed" },
  "Bahrain International Circuit": { strengths: ["powerUnit.ice", "powerUnit.ers"], weaknesses: ["reliability.coolingReliability"], type: "Power" },
  "Jeddah Corniche Circuit":       { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Street" },
  "Miami International Autodrome": { strengths: ["aero.floor", "chassis.suspension"], weaknesses: ["powerUnit.ice"], type: "Mixed" },
  "Circuit Gilles Villeneuve":     { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Power" },
  "Circuit de Monaco":             { strengths: ["chassis.mechanicalGrip", "chassis.balance"], weaknesses: ["powerUnit.ice", "aero.rearWing"], type: "Street" },
  "Circuit de Barcelona-Catalunya":{ strengths: ["aero.floor", "chassis.suspension"], weaknesses: [], type: "Technical" },
  "Red Bull Ring":                 { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Power" },
  "Silverstone Circuit":           { strengths: ["aero.floor", "aero.frontWing"], weaknesses: ["reliability.coolingReliability"], type: "Highspeed" },
  "Circuit de Spa-Francorchamps":  { strengths: ["powerUnit.ice", "aero.floor"], weaknesses: ["chassis.mechanicalGrip"], type: "Highspeed" },
  "Hungaroring":                   { strengths: ["chassis.mechanicalGrip", "chassis.balance"], weaknesses: ["powerUnit.ice"], type: "Technical" },
  "Circuit Zandvoort":             { strengths: ["aero.floor", "chassis.suspension"], weaknesses: ["powerUnit.ice"], type: "Technical" },
  "Autodromo Nazionale Monza":     { strengths: ["powerUnit.ice", "powerUnit.turbo"], weaknesses: ["aero.floor", "chassis.mechanicalGrip"], type: "Power" },
  "Madrid Street Circuit":         { strengths: ["chassis.mechanicalGrip", "chassis.balance"], weaknesses: ["powerUnit.ice"], type: "Street" },
  "Baku City Circuit":             { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Street" },
  "Marina Bay Street Circuit":     { strengths: ["chassis.mechanicalGrip", "reliability.coolingReliability"], weaknesses: ["powerUnit.ice"], type: "Street" },
  "Circuit of the Americas":       { strengths: ["aero.floor", "chassis.suspension"], weaknesses: [], type: "Mixed" },
  "Autódromo Hermanos Rodríguez":  { strengths: ["powerUnit.ers", "powerUnit.energyRecovery"], weaknesses: [], type: "Power" },
  "Autódromo José Carlos Pace":    { strengths: ["powerUnit.ice", "chassis.mechanicalGrip"], weaknesses: [], type: "Mixed" },
  "Las Vegas Strip Circuit":       { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Power" },
  "Lusail International Circuit":  { strengths: ["aero.floor", "reliability.coolingReliability"], weaknesses: [], type: "Highspeed" },
  "Yas Marina Circuit":            { strengths: ["powerUnit.ice", "aero.rearWing"], weaknesses: ["chassis.mechanicalGrip"], type: "Power" },
};

export function getCircuitProfile(circuitName) {
  return CIRCUIT_PROFILES[circuitName] || { strengths: [], weaknesses: [], type: "Mixed" };
}

// ─── Lap Gain & Cost Helpers ──────────────────────────────────────────────────

const STAT_LAP_WEIGHTS = {
  cornering: 0.018, downforce: 0.015, dragRatio: -0.12,
  mechanicalGrip: 0.012, topSpeed: 0.008, acceleration: 0.010,
  balance: 0.008, tyreWear: 0.005, fuelEfficiency: 0.003,
  reliability: 0.002, pitStopTime: -1.0, pitErrorRate: -0.02,
};

export function estimateLapGain(statBonuses) {
  if (!statBonuses) return 0;
  let gain = 0;
  for (const [stat, val] of Object.entries(statBonuses)) {
    gain += (val || 0) * (STAT_LAP_WEIGHTS[stat] || 0.01);
  }
  return parseFloat(Math.max(0, gain).toFixed(2));
}

/**
 * Returns a 0-1 multiplier based on season length compared to the canonical 24-race season.
 * Used to scale costs and development times proportionally.
 */
export function getSeasonScaleFactor(appState) {
  const totalRounds = appState?.season?.totalRounds || 24;
  return Math.max(0.15, Math.min(1.0, totalRounds / 24));
}

export function getManufacturingCost(baseCost, appState = null) {
  const scaleFactor = appState ? getSeasonScaleFactor(appState) : 1.0;
  return parseFloat((baseCost * 0.35 * scaleFactor).toFixed(1));
}

export function getOutcomeSuccessRating(outcome) {
  if (outcome === "overperform") return 95;
  if (outcome === "success") return 80;
  if (outcome === "underperform") return 45;
  return 0;
}

// ─── Regulation Cycles ────────────────────────────────────────────────────────

export const REGULATION_TYPES = [
  { id: "groundEffect", label: "Ground Effect Changes", description: "FIA revises floor and diffuser regulations. Major aero concept reset required.", affectedCategories: ["aero"] },
  { id: "ersChanges", label: "ERS Regulation Update", description: "Energy recovery limits and deployment rules change. Power unit development reset.", affectedCategories: ["powerUnit"] },
  { id: "powerUnitRules", label: "New Power Unit Rules", description: "Complete power unit specification overhaul. ICE and hybrid systems must be redesigned.", affectedCategories: ["powerUnit", "reliability"] },
  { id: "wingRegulations", label: "Lower Wing Regulations", description: "Maximum wing area reduced. Front and rear wing concepts need revision.", affectedCategories: ["aero"] },
];

// ─── Project Logic ────────────────────────────────────────────────────────────

function getProjectSuccessFactor(appState) {
  const finance = appState.finance || {};
  const facilities = finance.facilities || {};
  const staff = finance.staff || [];

  const windLevel = facilities.windTunnel?.level || 1;
  const cfdLevel = facilities.cfdDepartment?.level || 1;
  const simLevel = facilities.simulator?.level || 1;

  const techDir = staff.find(s => s.id === "technicalDirector")?.rating || 75;
  const chiefDes = staff.find(s => s.id === "chiefDesigner")?.rating || 75;
  const headAero = staff.find(s => s.id === "headAero")?.rating || 75;

  const facilityFactor = ((windLevel + cfdLevel + simLevel) / 15); // 0.2 to 1.0
  const staffFactor = ((techDir + chiefDes + headAero) / 3 - 60) / 40; // 0.0 to 1.0

  const devAlloc = appState.engineering?.devAllocation?.currentCar ?? 70;
  const allocFactor = devAlloc / 100;

  return Math.max(0.3, Math.min(1.2, facilityFactor * 0.35 + staffFactor * 0.45 + allocFactor * 0.20));
}

export function startProject(appState, categoryId, itemId) {
  const cat = DEVELOPMENT_CATALOG[categoryId];
  if (!cat) return { ok: false, reason: "Unknown category" };
  const item = cat.items[itemId];
  if (!item) return { ok: false, reason: "Unknown item" };

  const eng = appState.engineering;
  if (!eng) return { ok: false, reason: "Engineering state missing" };

  // Prevent duplicate active projects for the same item
  const alreadyRunning = (eng.projects || []).some(
    p => p.categoryId === categoryId && p.itemId === itemId && p.status === "active"
  );
  if (alreadyRunning) return { ok: false, reason: "Project already in progress" };

  // ── Season-length scaling ──────────────────────────────────────────────────
  // Costs and development time scale with season length so upgrades remain
  // meaningful whether the player is running a 6-race sprint or a 24-race season.
  const scaleFactor = getSeasonScaleFactor(appState);

  const devCost = parseFloat((item.baseCost * scaleFactor).toFixed(1));
  const mfgCost = getManufacturingCost(item.baseCost, appState);
  const totalCost = parseFloat((devCost + mfgCost).toFixed(1));
  if ((appState.team?.budget || 0) < totalCost) {
    return { ok: false, reason: `Insufficient budget. Requires $${totalCost}M (Dev $${devCost}M + Mfg $${mfgCost}M).` };
  }

  appState.team.budget = parseFloat((appState.team.budget - totalCost).toFixed(1));

  const successFactor = getProjectSuccessFactor(appState);
  const adjustedConfidence = Math.round(Math.min(97, item.baseConfidence * (0.7 + successFactor * 0.5)));

  const currentRound = appState.season?.round || 1;
  const staff = appState.finance?.staff || [];
  const techDir = staff.find(s => s.id === "technicalDirector");
  const perfEngineer = staff.find(s => s.id === "performanceEngineer");

  // Scale base races with season length — shorter season = faster delivery
  const scaledBaseRaces = Math.max(1, Math.round(item.baseRaces * scaleFactor));

  // Allocation affects completion time — higher current-car focus = faster delivery
  const alloc = eng.devAllocation || { currentCar: 70 };
  const allocSpeedBonus = Math.max(0.85, Math.min(1.15, 0.85 + (alloc.currentCar / 100) * 0.30));
  const adjustedRaces = Math.max(1, Math.round(scaledBaseRaces / allocSpeedBonus));
  const expectedLapGain = estimateLapGain(item.statBonuses);

  const project = {
    id: `${categoryId}_${itemId}_${Date.now()}`,
    categoryId,
    itemId,
    label: `${item.label} ${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`,
    status: "active",
    startRound: currentRound,
    completionRound: currentRound + adjustedRaces,
    confidence: adjustedConfidence,
    risk: item.risk,
    devCost,
    mfgCost,
    cost: totalCost,
    statBonuses: item.statBonuses,
    engineer: perfEngineer?.role || techDir?.role || "Technical Director",
    windTunnelUsage: item.windTunnelUsage,
    cfdUsage: item.cfdUsage,
    expectedLapGain,
    expectedGain: `+${expectedLapGain}s/lap`,
    deliveryRace: currentRound + adjustedRaces,
  };

  if (!eng.projects) eng.projects = [];
  eng.projects.push(project);

  return { ok: true, project };
}

export function processProjectCompletions(appState) {
  const eng = appState.engineering;
  if (!eng?.projects) return [];

  const currentRound = appState.season?.round || 1;
  const successFactor = getProjectSuccessFactor(appState);
  const completed = [];

  eng.projects.forEach(project => {
    if (project.status !== "active") return;
    if (currentRound < project.completionRound) return;

    // Roll for outcome
    const roll = Math.random() * 100;
    const threshold = project.confidence * successFactor;

    let outcome, gainMultiplier, note;
    if (roll > threshold * 1.3) {
      outcome = "fail";
      gainMultiplier = 0;
      note = `${project.label} failed during manufacturing. No performance gain. Development cost was not recovered.`;
    } else if (roll > threshold) {
      outcome = "underperform";
      gainMultiplier = 0.4;
      note = `${project.label} underperformed expectations. Partial gains applied.`;
    } else if (roll < threshold * 0.2) {
      outcome = "overperform";
      gainMultiplier = 1.6;
      note = `${project.label} significantly overperformed! Engineers exceeded expectations.`;
    } else {
      outcome = "success";
      gainMultiplier = 1.0;
      note = `${project.label} introduced successfully. Expected gains confirmed.`;
    }

    project.status = outcome;
    project.outcome = outcome;
    project.completedRound = currentRound;
    project.gainMultiplier = gainMultiplier;
    project.engineerNote = note;

    // Apply stat bonuses to carSpecs
    if (gainMultiplier > 0 && eng.carSpecs) {
      Object.entries(project.statBonuses).forEach(([stat, value]) => {
        if (stat in eng.carSpecs) {
          eng.carSpecs[stat] = parseFloat(
            Math.min(99, Math.max(40, (eng.carSpecs[stat] || 70) + value * gainMultiplier)).toFixed(1)
          );
        }
      });
    }

    // Also update team.carPerformance and team.specs for backward compatibility
    if (appState.team && gainMultiplier > 0) {
      // Derive aero, chassis, reliability from project type
      let aeroGain = 0, chassisGain = 0, reliabilityGain = 0;
      
      Object.entries(project.statBonuses).forEach(([stat, value]) => {
        const adjustedValue = value * gainMultiplier;
        if (["cornering", "downforce", "dragRatio"].includes(stat)) {
          aeroGain += adjustedValue / 2; // Split these across aero
        } else if (["mechanicalGrip", "balance", "tyreWear"].includes(stat)) {
          chassisGain += adjustedValue / 2;
        } else if (stat === "reliability") {
          reliabilityGain += adjustedValue;
        } else if (["topSpeed", "acceleration", "fuelEfficiency"].includes(stat)) {
          // These can contribute to all, especially aero/chassis
          aeroGain += adjustedValue / 4;
          chassisGain += adjustedValue / 4;
          reliabilityGain += adjustedValue / 4;
        }
      });

      // Update team specs if they exist
      if (!appState.team.specs) appState.team.specs = {};
      appState.team.specs.aero = Math.min(99, Math.max(40, (appState.team.specs.aero || appState.team.carPerformance || 80) + aeroGain));
      appState.team.specs.chassis = Math.min(99, Math.max(40, (appState.team.specs.chassis || appState.team.carPerformance || 80) + chassisGain));
      appState.team.specs.reliability = Math.min(99, Math.max(40, (appState.team.specs.reliability || appState.team.carPerformance || 80) + reliabilityGain));

      // Update team.carPerformance (overall rating)
      const avgSpecGain = (aeroGain + chassisGain + reliabilityGain) / 3;
      appState.team.carPerformance = Math.min(99, Math.max(40, (appState.team.carPerformance || 80) + avgSpecGain));
    }

    // Add to upgrade history
    if (!eng.upgradeHistory) eng.upgradeHistory = [];
    eng.upgradeHistory.unshift({
      round: currentRound,
      label: project.label,
      outcome,
      expectedGain: project.expectedGain,
      gainMultiplier,
      cost: project.cost,
      engineer: project.engineer,
      note,
    });

    completed.push(project);
  });

  return completed;
}

export function ensureDevProjectsState(appState) {
  const eng = appState.engineering;
  if (!eng) return;

  if (!eng.projects) eng.projects = [];
  if (!eng.upgradeHistory) eng.upgradeHistory = [];
  if (!eng.raceReports) eng.raceReports = [];
  if (!eng.devAllocation) eng.devAllocation = { currentCar: 70, nextCar: 30 };

  if (!eng.carSpecs) {
    const cp = appState.team?.carPerformance || 80;
    eng.carSpecs = {
      cornering:       Math.round(cp * 0.95 + Math.random() * 5),
      downforce:       Math.round(cp * 0.93 + Math.random() * 5),
      dragRatio:       parseFloat((0.50 - (cp - 75) * 0.005).toFixed(3)),
      mechanicalGrip:  Math.round(cp * 0.90 + Math.random() * 5),
      tyreWear:        Math.round(cp * 0.92 + Math.random() * 5),
      balance:         Math.round(cp * 0.94 + Math.random() * 5),
      topSpeed:        Math.round(cp * 0.96 + Math.random() * 5),
      acceleration:    Math.round(cp * 0.91 + Math.random() * 5),
      fuelEfficiency:  Math.round(cp * 0.89 + Math.random() * 5),
      reliability:     Math.round(cp * 0.93 + Math.random() * 5),
      pitStopTime:     parseFloat((2.8 - (cp - 70) * 0.02).toFixed(2)),
      pitErrorRate:    parseFloat((4.0 - (cp - 70) * 0.05).toFixed(2)),
    };
  }
}

export function generateRaceEngineeringReport(appState, raceResult, completedProjects) {
  const eng = appState.engineering;
  if (!eng) return null;

  const round = appState.season?.round || 1;
  const notes = [];

  completedProjects.forEach(p => notes.push(p.engineerNote));

  if (raceResult) {
    const pos = raceResult.position;
    if (pos <= 3) notes.push(`Strong race result (P${pos}). Car performed within expected parameters.`);
    else if (pos <= 10) notes.push(`Points finish (P${pos}). No major mechanical anomalies.`);
    else notes.push(`Difficult race (P${pos}). Strategy and pace review initiated.`);
  }

  const report = {
    round,
    timestamp: new Date().toISOString(),
    notes,
    completedProjects: completedProjects.map(p => p.label),
    carSpecsSnapshot: { ...(eng.carSpecs || {}) },
  };

  if (!eng.raceReports) eng.raceReports = [];
  eng.raceReports.unshift(report);
  if (eng.raceReports.length > 12) eng.raceReports.pop(); // keep last 12

  return report;
}
