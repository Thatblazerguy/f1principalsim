import { ensureFinanceState } from "./financeSystem.js";

// FIA Power Unit Regulations
export const COMPONENT_CATALOG = {
  ICE: { id: "ICE", name: "Internal Combustion Engine", allocation: 3, wearRate: 1.2, performanceImpact: 0.4 },
  TC:  { id: "TC", name: "Turbocharger", allocation: 3, wearRate: 1.0, performanceImpact: 0.2 },
  MGUH:{ id: "MGUH", name: "MGU-H", allocation: 3, wearRate: 0.9, performanceImpact: 0.15 },
  MGUK:{ id: "MGUK", name: "MGU-K", allocation: 3, wearRate: 1.1, performanceImpact: 0.15 },
  ES:  { id: "ES", name: "Energy Store", allocation: 2, wearRate: 0.7, performanceImpact: 0.05 },
  CE:  { id: "CE", name: "Control Electronics", allocation: 2, wearRate: 0.5, performanceImpact: 0.05 },
  GB:  { id: "GB", name: "Gearbox", allocation: 4, wearRate: 1.3, performanceImpact: 0.3 }, // Gearbox impact reduces acceleration/sync
  EX:  { id: "EX", name: "Exhaust", allocation: 8, wearRate: 0.4, performanceImpact: 0.0 }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createDriverComponentPool() {
  const pool = {};
  for (const [key, catalog] of Object.entries(COMPONENT_CATALOG)) {
    pool[key] = [{
      id: `${key}-1`,
      wear: 0,
      performance: 100,
      reliability: 95 + Math.floor(Math.random() * 5),
      failures: 0,
      active: true,
      history: []
    }];
  }
  return pool;
}

export function ensureEngineeringState(appState) {
  if (!appState.engineering || typeof appState.engineering !== "object") {
    appState.engineering = {
      driverPools: {},
      pendingPenalties: {},
      reports: []
    };
  }
  
  const eng = appState.engineering;
  if (!eng.driverPools) eng.driverPools = {};
  if (!eng.pendingPenalties) eng.pendingPenalties = {};
  if (!eng.reports) eng.reports = [];

  // Initialize for all active drivers in the player's team
  const roster = appState.team ? [...(appState.team.drivers || []), ...(appState.team.reserveDriver ? [appState.team.reserveDriver] : [])] : [];
  for (const driver of roster) {
    if (!eng.driverPools[driver.name]) {
      eng.driverPools[driver.name] = createDriverComponentPool();
      eng.pendingPenalties[driver.name] = 0;
    }
  }

  return eng;
}

/**
 * Returns the currently active component of a given type for a driver.
 */
export function getActiveComponent(appState, driverName, componentType) {
  const pool = ensureEngineeringState(appState).driverPools[driverName];
  if (!pool || !pool[componentType]) return null;
  return pool[componentType].find(c => c.active) || pool[componentType][0];
}

/**
 * Calculate the overall PU performance modifier for a driver (0.0 to 1.0)
 */
export function getDriverPuPerformance(appState, driverName) {
  const pool = ensureEngineeringState(appState).driverPools[driverName];
  if (!pool) return 1.0;
  
  let totalImpact = 0;
  let maxImpact = 0;
  for (const [key, catalog] of Object.entries(COMPONENT_CATALOG)) {
    const active = getActiveComponent(appState, driverName, key);
    if (active) {
       totalImpact += (active.performance / 100) * catalog.performanceImpact;
       maxImpact += catalog.performanceImpact;
    }
  }
  return maxImpact > 0 ? (totalImpact / maxImpact) : 1.0;
}

/**
 * Swaps the active component to the specified index.
 */
export function swapComponent(appState, driverName, componentType, newIndex) {
  const pool = ensureEngineeringState(appState).driverPools[driverName];
  if (!pool || !pool[componentType]) return false;
  
  const list = pool[componentType];
  if (newIndex < 0 || newIndex >= list.length) return false;

  list.forEach((c, idx) => c.active = (idx === newIndex));
  return true;
}

/**
 * Installs a brand new component from the factory, applying grid penalties if the allocation is exceeded.
 */
export function fitNewComponent(appState, driverName, componentType) {
  const eng = ensureEngineeringState(appState);
  const pool = eng.driverPools[driverName];
  if (!pool || !pool[componentType]) return false;

  const catalog = COMPONENT_CATALOG[componentType];
  const list = pool[componentType];
  
  // Deactivate current
  list.forEach(c => c.active = false);

  // Determine penalties
  const isPenalty = list.length >= catalog.allocation;
  let penaltyDrop = 0;
  if (isPenalty) {
    penaltyDrop = (list.length === catalog.allocation) ? 10 : 5;
    eng.pendingPenalties[driverName] = (eng.pendingPenalties[driverName] || 0) + penaltyDrop;
  }

  // Create new
  const newComp = {
    id: `${componentType}-${list.length + 1}`,
    wear: 0,
    performance: 100,
    reliability: 95 + Math.floor(Math.random() * 5),
    failures: 0,
    active: true,
    history: []
  };
  list.push(newComp);

  return { ok: true, penalty: penaltyDrop, newId: newComp.id };
}

/**
 * Calculate wear added after a session.
 */
export function applySessionWear(appState, driverName, trackIntensity, driverAggression, isRace = true) {
  const eng = ensureEngineeringState(appState);
  const pool = eng.driverPools[driverName];
  if (!pool) return;

  const finance = ensureFinanceState(appState);
  
  // Facility reductions (e.g. PU Lab, Reliability Centre)
  const puLevel = finance.facilities.powerUnitLab?.level || 1;
  const relLevel = finance.facilities.reliabilityCentre?.level || 1;
  const facilityWearReduction = 1 - ((puLevel + relLevel - 2) * 0.05); // Up to 40% reduction

  const wearReport = {};

  for (const [key, catalog] of Object.entries(COMPONENT_CATALOG)) {
    const active = getActiveComponent(appState, driverName, key);
    if (!active) continue;

    // Track intensity scales from 0.8 (low stress) to 1.3 (high stress)
    // Driver aggression scales from 0.8 (smooth) to 1.25 (aggressive)
    const sessionLengthMultiplier = isRace ? 1.0 : 0.3; // Practice/Quali causes less wear
    const randomFactor = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1

    let addedWear = catalog.wearRate * trackIntensity * driverAggression * facilityWearReduction * sessionLengthMultiplier * randomFactor * 10;
    
    // Some components wear faster at higher existing wear levels
    if (active.wear > 60) addedWear *= 1.15;
    
    active.wear = clamp(active.wear + addedWear, 0, 100);
    
    // Performance drop off curve
    // Flat until 30%, then drops exponentially
    if (active.wear > 30) {
       const wearOver = active.wear - 30;
       active.performance = clamp(100 - Math.pow(wearOver, 1.4) * 0.15, 40, 100);
    }

    wearReport[key] = {
      id: active.id,
      addedWear: addedWear.toFixed(1),
      newWear: active.wear.toFixed(1),
      performance: active.performance.toFixed(1)
    };
  }

  return wearReport;
}

/**
 * Calculate instantaneous failure risk for the active components.
 * Returns an array of components that failed.
 */
export function rollForFailures(appState, driverName, sessionStress) {
  const pool = ensureEngineeringState(appState).driverPools[driverName];
  if (!pool) return [];

  const failures = [];
  for (const [key, catalog] of Object.entries(COMPONENT_CATALOG)) {
    const active = getActiveComponent(appState, driverName, key);
    if (!active) continue;

    // Base manufacturing defect risk (very low if reliability is 99)
    let failureRisk = (100 - active.reliability) * 0.05;

    // Wear risk kicks in heavily after 70%
    if (active.wear > 70) {
      failureRisk += Math.pow(active.wear - 70, 1.8) * 0.1;
    }

    // Multiply by session stress (heat, engine mode)
    failureRisk *= sessionStress;

    // Roll d1000
    const roll = Math.random() * 1000;
    // failureRisk is a % out of 100, so we multiply by 10 to compare with d1000
    if (roll < failureRisk * 10) {
      active.failures++;
      failures.push({ type: key, id: active.id, wear: active.wear });
    }
  }
  return failures;
}

export function getEngineeringAdvisorNotes(appState, driverName) {
  const pool = ensureEngineeringState(appState).driverPools[driverName];
  if (!pool) return [];
  
  const notes = [];
  let highWearCount = 0;

  for (const [key, catalog] of Object.entries(COMPONENT_CATALOG)) {
    const active = getActiveComponent(appState, driverName, key);
    if (!active) continue;

    if (active.wear > 85) {
      notes.push(`CRITICAL: ${key} ${active.id} is at severe risk of failure (${Math.round(active.wear)}% wear). Replace immediately.`);
    } else if (active.wear > 70) {
      notes.push(`Warning: ${key} ${active.id} is degraded (${Math.round(active.wear)}% wear). Consider fitting a new unit soon.`);
      highWearCount++;
    }

    // Check allocations
    const list = pool[key];
    if (list.length >= catalog.allocation && active.wear > 75) {
      notes.push(`Grid Penalty Alert: We are at the allocation limit for ${key}. A new unit will result in a grid drop.`);
    }
  }

  if (notes.length === 0) {
    notes.push(`All active components for ${driverName} are operating within safe parameters.`);
  }

  return notes;
}

/**
 * Applies pending penalties to a qualifying grid, sorting them and resetting the penalty counters.
 */
export function applyGridPenalties(appState, grid) {
  const eng = ensureEngineeringState(appState);
  if (!eng.pendingPenalties) return grid;

  // grid is an array of { driver, team, lap, isWet }
  // We need to calculate each driver's starting pos (index), add their penalty, and resort.
  let penalizedGrid = grid.map((entry, idx) => {
    const penalty = eng.pendingPenalties[entry.driver.name] || 0;
    return { ...entry, qualiPos: idx + 1, penalty, effectivePos: idx + 1 + penalty };
  });

  // Sort by effective position, preserving original qualiPos on ties
  penalizedGrid.sort((a, b) => {
    if (a.effectivePos !== b.effectivePos) return a.effectivePos - b.effectivePos;
    return a.qualiPos - b.qualiPos;
  });

  // Clear penalties
  for (const driverName in eng.pendingPenalties) {
    eng.pendingPenalties[driverName] = 0;
  }

  return penalizedGrid;
}
