import fs from 'fs';
import { simulateRaceEvent } from './game/raceSimulator.js';
import { aiTeams } from './data/teams.js';
import { calendar } from './data/calendar.js';

const NUM_RACES = 100;
const track = calendar.find(c => c.circuit.includes('Suzuka'));

let wins = {};
let podiums = {};
let totalGap1to2 = 0;
let totalGap1to20 = 0;
let validRaces = 0;

console.log(`Simulating ${NUM_RACES} races at ${track.name}...`);

for (let i = 0; i < NUM_RACES; i++) {
  // Deep clone teams to reset any mutations (though simulator shouldn't mutate)
  const raceTeams = JSON.parse(JSON.stringify(aiTeams));
  
  const results = simulateRaceEvent(raceTeams, track, track.laps, [], {});
  
  // Exclude DNFs from gap calculation
  const finishers = results.filter(r => !r.retired);
  
  if (finishers.length >= 20) { // At least 20 cars finish for valid 1-to-20 gap
    const p1Time = finishers[0].time;
    const p2Time = finishers[1].time;
    const p20Time = finishers[19].time;
    
    totalGap1to2 += (p2Time - p1Time);
    totalGap1to20 += (p20Time - p1Time);
    validRaces++;
  }
  
  const p1 = results[0].driver.name;
  wins[p1] = (wins[p1] || 0) + 1;
  
  for (let p = 0; p < 3; p++) {
    const driver = results[p].driver.name;
    podiums[driver] = (podiums[driver] || 0) + 1;
  }
}

console.log("\n--- SIMULATION RESULTS ---");
console.log(`Average Gap (1st to 2nd): ${(totalGap1to2 / validRaces).toFixed(3)}s`);
console.log(`Average Gap (1st to 20th): ${(totalGap1to20 / validRaces).toFixed(3)}s`);

console.log("\n--- WINS ---");
Object.entries(wins)
  .sort((a,b) => b[1] - a[1])
  .forEach(([driver, count]) => console.log(`${driver}: ${count} wins (${(count/NUM_RACES*100).toFixed(1)}%)`));
  
console.log("\n--- PODIUMS ---");
Object.entries(podiums)
  .sort((a,b) => b[1] - a[1])
  .forEach(([driver, count]) => console.log(`${driver}: ${count} podiums (${(count/NUM_RACES*100).toFixed(1)}%)`));
