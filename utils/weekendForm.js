/**
 * weekendForm.js
 * 
 * Central logic for the unified Weekend Performance Model.
 * This determines the specific form modifiers and explainable outliers 
 * for every driver during a race weekend, ensuring consistency across
 * Practice, Qualifying, and Race sessions.
 */

import { getDriverFormMultiplier } from "./raceBalance.js";
import { getDriverPuPerformance } from "./engineeringSystem.js";

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
 * @param {Object} appState - Global state to read component health
 * @returns {Object} Context mapping driver names to their modifiers and narratives
 */
export function generateWeekendContext(teams, track, raceHistory = [], appState = null) {
  const context = {
    drivers: {},
    trackEvents: []
  };

  teams.forEach(team => {
    // 1. Car Performance (45%)
    // Base scale is typically 70-100. Normalize to 0-1.
    const teamOvr = team.specs?.ovr ?? team.carPerformance ?? 85;
    const carPerfScore = Math.max(0, Math.min(1, (teamOvr - 70) / 30));

    // 2. Engineering Quality (5%)
    const reliability = team.specs?.reliability ?? 85;
    const engQualityScore = Math.max(0, Math.min(1, (reliability - 60) / 40));

    team.drivers.forEach(driver => {
      // 3. Driver Pace (20%)
      const driverPace = driver.pace ?? 85;
      const driverPaceScore = Math.max(0, Math.min(1, (driverPace - 70) / 30));

      // 4. Current Form (5%)
      // Form mult is usually 0.92 to 1.08. We invert and normalize so good form = higher score.
      const rawFormMult = getDriverFormMultiplier(driver.name, raceHistory);
      const formScore = Math.max(0, Math.min(1, (1.08 - rawFormMult) / 0.16));

      // 5. Track Suitability (5%) - Randomly slightly varied for now
      const trackSuitabilityScore = 0.3 + Math.random() * 0.7;

      // 6. Setup Quality (5%)
      const setupQualityScore = 0.2 + Math.random() * 0.8;

      // 7. Driver Confidence (5%)
      const driverConfidenceScore = 0.2 + Math.random() * 0.8;

      // 8. Component Health (5%)
      let puHealthScore = 1.0;
      if (appState) {
        // getDriverPuPerformance returns 0 to 1, where 1 is perfect
        puHealthScore = getDriverPuPerformance(appState, driver.name);
      }

      // 9. Weekend Random Variance (5%) - strictly bounded to +- 0.35% of total score
      const randomVarianceScore = 0.5 + (Math.random() - 0.5) * 0.7; // 0.15 to 0.85

      // Calculate the combined static Weekend Performance Score
      // This is a normalized value between roughly 0 and 1
      const weekendPerformanceScore = (
        carPerfScore * 0.45 +
        driverPaceScore * 0.20 +
        formScore * 0.05 +
        trackSuitabilityScore * 0.05 +
        setupQualityScore * 0.05 +
        driverConfidenceScore * 0.05 +
        engQualityScore * 0.05 +
        puHealthScore * 0.05 +
        randomVarianceScore * 0.05
      );

      // Roll for Explainable Outliers (Narratives for UI)
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

      // Apply the outlier multiplier directly to the performance score so it has a real impact
      // Since outlierMult > 1 means slower, we divide our positive-means-faster score
      const finalWeekendPerformanceScore = Math.max(0.01, Math.min(1.5, weekendPerformanceScore / outlierMult));

      // For backward compatibility with any other code expecting a finalModifier 
      // (1.0 is neutral, lower is faster).
      // A high weekendPerformanceScore means FASTER.
      // So we map the score (0 to 1) into a modifier (e.g., 1.05 to 0.90)
      const finalModifier = 1.05 - (finalWeekendPerformanceScore * 0.15);

      context.drivers[driver.name] = {
        weekendPerformanceScore: finalWeekendPerformanceScore,
        formMult: rawFormMult,
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
