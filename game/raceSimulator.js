import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";
import { strategies } from "../data/strategies.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lapVariance(driver, track, isWet) {
  const wetPenalty = isWet ? (100 - driver.wet) * 0.007 : 0;
  const consistencyNoise = (100 - driver.consistency) * 0.0022;
  return Math.random() * (0.38 + consistencyNoise) + wetPenalty;
}

function getRaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.raceBoost || 0) + (effects.paceBoost || 0) * 0.5;
}

function getRetirementModifier(team) {
  const engineModifier = team.engineProfile?.effects?.retirementModifier || 0;
  const reliabilityScore = team.specs?.reliability ?? 80;
  const reliabilityModifier = (85 - reliabilityScore) * 0.00008;
  return engineModifier + reliabilityModifier;
}

function pitStopLoss(driver, lap, totalLaps) {
  const tyreWear = clamp((lap / totalLaps) * (100 - driver.tyre), 0, 28);
  return 20 + tyreWear * 0.12 + Math.random() * 0.85;
}

function gridPosition(qualifyingGrid, driver) {
  if (!qualifyingGrid || !qualifyingGrid.length) return 0;
  const idx = qualifyingGrid.findIndex((e) => e.driver.name === driver.name);
  return idx < 0 ? qualifyingGrid.length : idx;
}

/**
 * @param {Array} qualifyingGrid  Sorted quali result (P1 first). Required for realistic race starts when set.
 */
export function simulateRaceEvent(teams, track, laps, qualifyingGrid = null, playerSelectedStrategies = {}) {
  const roundStrategies = track.round ? (strategies[track.round] || []) : [];
  const isWet = Math.random() < 0.18;
  const safetyCarLap = Math.random() < 0.26 ? Math.floor(laps * (0.35 + Math.random() * 0.3)) : null;

  const finishers = teams.flatMap((team) =>
    team.drivers.map((driver) => {
      let chosenStrat = null;
      if (playerSelectedStrategies[driver.name]) {
         chosenStrat = roundStrategies.find(s => s.id === playerSelectedStrategies[driver.name]);
      } else if (roundStrategies.length > 0) {
         const roll = Math.random();
         const r1 = roundStrategies.find(s => s.rank === 1);
         const r2 = roundStrategies.find(s => s.rank === 2);
         const r3 = roundStrategies.find(s => s.rank === 3);
         const r4 = roundStrategies.find(s => s.rank === 4);
         
         if (roll < 0.60 && r1) chosenStrat = r1;
         else if (roll < 0.85 && r2) chosenStrat = r2;
         else if (roll < 0.95 && r3) chosenStrat = r3;
         else if (r4) chosenStrat = r4;
         else chosenStrat = roundStrategies[0];
      }
      
      const winMod = chosenStrat ? chosenStrat.winModifier : 0;
      const riskMod = chosenStrat ? chosenStrat.riskModifier : 0;

      const pos = gridPosition(qualifyingGrid, driver);
      const startPenalty = qualifyingGrid?.length ? pos * 0.12 : 0;

      const baseLap =
        track.baseTime -
        (driver.pace + getRaceBoost(team)) * 0.024 -
        driver.racecraft * 0.015 -
        getTeamLapCredit(team, "race") -
        getTeamPerformanceBonus(team) * 0.025;

      let adjustedBaseLap = baseLap * (1 - (winMod * 0.04));
      let totalTime = startPenalty;
      let retired = false;
      const plannedPitLap = Math.floor(laps * (0.45 + Math.random() * 0.2));

      // Risk implementation: high risk increases lap variance (errors) and adds a chance for major incidents
      const riskTriggered = Math.random() < riskMod;
      const riskPenaltyApplied = riskTriggered ? (Math.random() < 0.35 ? "DNF" : "+40s") : false;
      const riskVarianceMultiplier = 1 + (riskMod * 2.5); // 10% risk = 25% more variance

      if (riskPenaltyApplied === "DNF") {
         retired = true;
         totalTime = 99999;
      }

      for (let lap = 1; lap <= laps; lap++) {
        if (retired) break;
        
        // Base retirement chance + driver error chance + team reliability
        const baseRetirementChance = Math.max(0.0005, driver.errorChance() * 0.012 + getRetirementModifier(team));
        if (Math.random() < baseRetirementChance) {
          retired = true;
          break;
        }

        // Apply increased variance for high-risk strategies
        const lapVar = lapVariance(driver, track, isWet) * riskVarianceMultiplier;
        totalTime += adjustedBaseLap + lapVar;

        if (lap === plannedPitLap) {
          totalTime += pitStopLoss(driver, lap, laps);
        }

        if (safetyCarLap && lap === safetyCarLap) {
          totalTime += 3 + Math.random() * 1.2;
        }
      }

      if (!retired && riskPenaltyApplied === "+40s") {
         totalTime += 40 + Math.random() * 15;
      }

      return {
        driver,
        team,
        time: totalTime,
        retired,
      };
    })
  );

  return finishers.sort((a, b) => {
    if (a.retired !== b.retired) {
      return a.retired ? 1 : -1;
    }
    return a.time - b.time;
  });
}
