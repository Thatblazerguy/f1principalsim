/**
 * weekendForm.js
 * 
 * Central logic for the unified Weekend Performance Model.
 * This determines the specific form modifiers and explainable outliers 
 * for every driver during a race weekend, ensuring consistency across
 * Practice, Qualifying, and Race sessions.
 */

import { getDriverFormMultiplier } from "./raceBalance.js";

// Explainable outliers that randomly occur to explain performance swings
const OUTLIER_EVENTS = [
  { id: "perfect_setup", label: "Perfect Setup", modifier: 0.988, prob: 0.04, desc: "The engineers nailed the setup window perfectly." },
  { id: "failed_setup", label: "Failed Setup", modifier: 1.018, prob: 0.05, desc: "The team missed the setup window, struggling with balance." },
  { id: "driver_confidence", label: "Confidence Surge", modifier: 0.992, prob: 0.04, desc: "Driver is exceptionally confident at this track." },
  { id: "struggling_confidence", label: "Struggling for Pace", modifier: 1.012, prob: 0.06, desc: "Driver hasn't found the rhythm around this circuit." },
  { id: "engine_gremlins", label: "Engine Gremlins", modifier: 1.010, prob: 0.03, desc: "Minor PU mapping issues are costing straight-line speed." },
  { id: "floor_damage", label: "Practice Damage", modifier: 1.008, prob: 0.03, desc: "Carrying a slightly patched floor after a practice off." },
  { id: "tyre_warmup", label: "Tyre Warmup Issues", modifier: 1.006, prob: 0.04, desc: "Having difficulty switching the tyres on quickly." },
  { id: "brake_issues", label: "Brake Glazing", modifier: 1.015, prob: 0.02, desc: "Brake glazing is affecting confidence in the braking zones." }
];

/**
 * Generate a single comprehensive WeekendContext object.
 * @param {Array} teams - Array of all teams and their drivers
 * @param {Object} track - The current track
 * @param {Array} raceHistory - Past races for form calculation
 * @returns {Object} Context mapping driver names to their modifiers and narratives
 */
export function generateWeekendContext(teams, track, raceHistory = []) {
  const context = {
    drivers: {},
    trackEvents: []
  };

  teams.forEach(team => {
    team.drivers.forEach(driver => {
      // 1. Seasonal Driver Form (0.92 - 1.08)
      const formMult = getDriverFormMultiplier(driver.name, raceHistory);

      // 2. Track Specialization (keeping base 1.0 for now)
      const trackSuitability = 1.0; 

      // 3. Roll for Explainable Outliers
      let narrativeEvent = null;
      let outlierMult = 1.0;
      
      const roll = Math.random();
      let cumulativeProb = 0;
      for (const event of OUTLIER_EVENTS) {
        cumulativeProb += event.prob;
        if (roll < cumulativeProb) {
          narrativeEvent = {
            id: event.id,
            label: event.label,
            desc: event.desc
          };
          outlierMult = event.modifier;
          break;
        }
      }

      // Base random variance that still exists (tiny, 0.998 - 1.002) for natural fluctuation
      const naturalVariance = 0.998 + (Math.random() * 0.004);

      const finalModifier = formMult * trackSuitability * outlierMult * naturalVariance;

      context.drivers[driver.name] = {
        formMult,
        trackSuitability,
        outlierMult,
        finalModifier,
        narrativeEvent
      };

      if (narrativeEvent) {
        context.trackEvents.push({
          driver: driver.name,
          team: team.name,
          event: narrativeEvent
        });
      }
    });
  });

  return context;
}
