import { simulateQualifying } from '../game/qualifying.js';
import { simulateRaceEvent } from '../game/raceSimulator.js';
import { generateWeekendContext } from './weekendForm.js';
import { createAiTeams } from '../data/teams.js';
import { calendar } from '../data/calendar.js';

async function runValidation() {
  const TOTAL_SEASONS = 50;

  console.log(`Starting headless simulation of ${TOTAL_SEASONS} seasons for Performance Model Validation...`);
  
  let stats = {
    racesRun: 0,
    topTierPodiums: 0,
    midTierPodiums: 0,
    backmarkerPodiums: 0,
    topTierQualiTop6: 0,
    midTierQualiTop6: 0,
    backmarkerQualiTop6: 0,
    dnfs: 0,
    totalStarters: 0,
    outliersGenerated: 0
  };

  const allTeams = createAiTeams();
  
  // Tag teams by tier for analysis
  allTeams.forEach(t => {
    const ovr = t.specs?.ovr ?? t.carPerformance ?? 85;
    if (ovr >= 92) t._tier = 'Top';
    else if (ovr >= 85) t._tier = 'Mid';
    else t._tier = 'Backmarker';
  });

  for (let s = 1; s <= TOTAL_SEASONS; s++) {
    for (const track of calendar) {
      // Generate Weekend Context
      const weekendContext = generateWeekendContext(allTeams, track, []);
      
      // Track outliers
      stats.outliersGenerated += weekendContext.trackEvents.length;

      // Quali
      const { grid } = simulateQualifying(allTeams, track, weekendContext);
      
      grid.slice(0, 6).forEach(entry => {
        if (entry.team._tier === 'Top') stats.topTierQualiTop6++;
        if (entry.team._tier === 'Mid') stats.midTierQualiTop6++;
        if (entry.team._tier === 'Backmarker') stats.backmarkerQualiTop6++;
      });

      // Race
      const results = simulateRaceEvent(allTeams, track, track.laps, grid, {}, weekendContext);
      
      stats.racesRun++;
      stats.totalStarters += results.length;

      results.forEach(r => {
        if (r.retired) stats.dnfs++;
      });

      results.slice(0, 3).forEach(entry => {
        if (!entry.retired) {
          if (entry.team._tier === 'Top') stats.topTierPodiums++;
          if (entry.team._tier === 'Mid') stats.midTierPodiums++;
          if (entry.team._tier === 'Backmarker') stats.backmarkerPodiums++;
        }
      });
    }
  }

  console.log(`\n=== VALIDATION RESULTS (${TOTAL_SEASONS} SEASONS, ${stats.racesRun} RACES) ===\n`);
  
  const dnfRate = (stats.dnfs / stats.totalStarters) * 100;
  console.log(`Overall DNF Rate: ${dnfRate.toFixed(1)}%`);
  console.log(`Total Outliers Generated: ${stats.outliersGenerated} (avg ${(stats.outliersGenerated / stats.racesRun).toFixed(1)} per race)`);

  console.log(`\nQualifying Top 6 Distribution:`);
  const totalQualiTop6 = stats.racesRun * 6;
  console.log(`  Top Tier Teams:        ${(stats.topTierQualiTop6 / totalQualiTop6 * 100).toFixed(1)}%`);
  console.log(`  Midfield Teams:        ${(stats.midTierQualiTop6 / totalQualiTop6 * 100).toFixed(1)}%`);
  console.log(`  Backmarker Teams:      ${(stats.backmarkerQualiTop6 / totalQualiTop6 * 100).toFixed(1)}%`);

  console.log(`\nPodium Distribution:`);
  const totalPodiums = stats.racesRun * 3;
  console.log(`  Top Tier Teams:        ${(stats.topTierPodiums / totalPodiums * 100).toFixed(1)}%`);
  console.log(`  Midfield Teams:        ${(stats.midTierPodiums / totalPodiums * 100).toFixed(1)}%`);
  console.log(`  Backmarker Teams:      ${(stats.backmarkerPodiums / totalPodiums * 100).toFixed(1)}%`);

  console.log("\nIf Top Tier teams dominate 85%+ of podiums and outliers provide occasional midfield disruption, the model is working as intended.");
}

runValidation();
