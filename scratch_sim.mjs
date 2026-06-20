import fs from 'fs';
import { simulateRaceEvent } from './game/raceSimulator.js';
import { aiTeams } from './data/teams.js';
import { calendar } from './data/calendar.js';

const track = calendar.find(c => c.circuit.includes('Suzuka'));

let res = simulateRaceEvent(aiTeams, track, 53, [], {});

console.log("RACE FINISHERS:");
let winnerTime = res[0].time;
res.forEach((f, i) => {
  let gap = i === 0 ? "Winner" : `+${(f.time - winnerTime).toFixed(3)}s`;
  if (f.retired) gap = "DNF";
  console.log(`${i+1}. ${f.driver.name} | ${gap} | Time: ${f.time.toFixed(1)}s`);
});
