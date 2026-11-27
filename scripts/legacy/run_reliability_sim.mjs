const races = 10000;

// Categories and relative weights
const CATEGORIES = [
  { type: "Engine", weight: 0.35 },
  { type: "Gearbox", weight: 0.25 },
  { type: "Hydraulics", weight: 0.20 },
  { type: "Suspension", weight: 0.10 },
  { type: "Electrical", weight: 0.10 }
];

// Grid setup
const grid = [];
for(let i=0; i<4; i++) grid.push({id: "Elite_" + i, rel: 90});
for(let i=0; i<10; i++) grid.push({id: "Mid_" + i, rel: 80});
for(let i=0; i<6; i++) grid.push({id: "Back_" + i, rel: 60});

let globalMultiplier = 1.0;

function runSimulation(targetAvgDnf) {
  let avgDnf = 0;
  let iterations = 0;
  
  while (true) {
    let totalDnfs = 0;
    let dnfsPerDriver = {};
    let dnfsByCategory = { "Engine": 0, "Gearbox": 0, "Hydraulics": 0, "Suspension": 0, "Electrical": 0 };
    let raceDnfCounts = Array(21).fill(0);

    for (let r = 0; r < races; r++) {
      let raceDnfs = 0;
      const isChaotic = Math.random() < 0.05;
      const isExtreme = Math.random() < 0.01;

      grid.forEach(car => {
        // Base fault curve:
        // 90 rel => 0.005 base
        // 80 rel => 0.012 base
        // 60 rel => 0.025 base
        let relFactor = 0;
        if (car.rel > 85) relFactor = 0.005;
        else if (car.rel >= 70) relFactor = 0.012;
        else relFactor = 0.025;

        // Apply chaos
        let chaosMult = 1.0;
        if (isExtreme) chaosMult = 3.5;
        else if (isChaotic) chaosMult = 2.0;

        let carDnf = false;
        // Roll for each part independently
        for (const cat of CATEGORIES) {
          // Probability for THIS category
          let prob = relFactor * cat.weight * globalMultiplier * chaosMult;
          prob = Math.min(0.9, prob);

          if (Math.random() < prob) {
            carDnf = true;
            dnfsByCategory[cat.type]++;
            break; // Stop checking other parts if one fails
          }
        }

        if (carDnf) {
          raceDnfs++;
          totalDnfs++;
          dnfsPerDriver[car.id] = (dnfsPerDriver[car.id] || 0) + 1;
        }
      });
      raceDnfCounts[raceDnfs]++;
    }

    avgDnf = totalDnfs / races;
    
    // Auto tune
    if (Math.abs(avgDnf - targetAvgDnf) < 0.05 || iterations > 50) {
      console.log(`\n=== RELIABILITY TUNING RESULTS (Target: ${targetAvgDnf}) ===`);
      console.log(`Final Global Multiplier: ${globalMultiplier.toFixed(4)}`);
      console.log(`Simulated ${races} races.`);
      console.log(`Average DNFs per race: ${avgDnf.toFixed(2)}`);
      
      console.log(`\nTypical Races (0-3 DNFs): ${((raceDnfCounts[0]+raceDnfCounts[1]+raceDnfCounts[2]+raceDnfCounts[3])/races*100).toFixed(1)}%`);
      console.log(`Chaotic Races (4-7 DNFs): ${((raceDnfCounts[4]+raceDnfCounts[5]+raceDnfCounts[6]+raceDnfCounts[7])/races*100).toFixed(1)}%`);
      
      console.log("\nAverage DNFs per Season (24 races) per Driver:");
      let eliteAvg = 0, midAvg = 0, backAvg = 0;
      for (const id in dnfsPerDriver) {
        let avgSeason = (dnfsPerDriver[id] / races) * 24;
        if (id.startsWith("Elite")) eliteAvg += avgSeason;
        if (id.startsWith("Mid")) midAvg += avgSeason;
        if (id.startsWith("Back")) backAvg += avgSeason;
      }
      console.log(`Elite Teams: ${(eliteAvg/4).toFixed(1)}`);
      console.log(`Midfield Teams: ${(midAvg/10).toFixed(1)}`);
      console.log(`Backmarker Teams: ${(backAvg/6).toFixed(1)}`);

      console.log("\nFailure Category Distribution:");
      for (const cat in dnfsByCategory) {
        console.log(`${cat}: ${((dnfsByCategory[cat] / totalDnfs) * 100).toFixed(1)}%`);
      }
      break;
    }

    // Adjust multiplier
    globalMultiplier *= (targetAvgDnf / avgDnf);
    iterations++;
  }
}

runSimulation(2.5); // Target 2.5 average DNFs
