const fs = require('fs');
let code = fs.readFileSync('/Users/rahulr/Desktop/f1manager/state.js', 'utf8');

// Add import
if (!code.includes('import { calendar }')) {
  code = code.replace(
    'import { ensureEngineeringState } from "./utils/engineeringSystem.js";',
    'import { ensureEngineeringState } from "./utils/engineeringSystem.js";\nimport { calendar } from "./data/calendar.js";'
  );
}

// Update default season object
code = code.replace(
  'season: { round: 1, year: 1, totalRounds: 24, currentDay: 1 },',
  'season: { round: 1, year: 1, totalRounds: 24, currentDay: 1, rules: { sprints: true, weather: true, scFrequency: \'normal\', failures: \'normal\', aiAggressiveness: \'normal\' }, calendar: [...calendar] },'
);

// Update hydration
code = code.replace(
  'state.season = rawData.season || { round: 1, year: 1, totalRounds: 24, currentDay: 1 };',
  'state.season = rawData.season || { round: 1, year: 1, totalRounds: 24, currentDay: 1, rules: { sprints: true, weather: true, scFrequency: \'normal\', failures: \'normal\', aiAggressiveness: \'normal\' }, calendar: [...calendar] };\n    if (!state.season.rules) state.season.rules = { sprints: true, weather: true, scFrequency: \'normal\', failures: \'normal\', aiAggressiveness: \'normal\' };\n    if (!state.season.calendar) state.season.calendar = [...calendar].slice(0, state.season.totalRounds || 24);'
);

fs.writeFileSync('/Users/rahulr/Desktop/f1manager/state.js', code);
