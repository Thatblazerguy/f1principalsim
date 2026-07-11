const fs = require('fs');
let code = fs.readFileSync('/Users/rahulr/Desktop/f1manager/data/calendar.js', 'utf8');

const countries = {
  "Albert Park Circuit": "Australia",
  "Shanghai International Circuit": "China",
  "Suzuka Circuit": "Japan",
  "Bahrain International Circuit": "Bahrain",
  "Jeddah Corniche Circuit": "Saudi Arabia",
  "Miami International Autodrome": "USA",
  "Circuit Gilles Villeneuve": "Canada",
  "Circuit de Monaco": "Monaco",
  "Circuit de Barcelona-Catalunya": "Spain",
  "Red Bull Ring": "Austria",
  "Silverstone Circuit": "UK",
  "Circuit de Spa-Francorchamps": "Belgium",
  "Hungaroring": "Hungary",
  "Circuit Zandvoort": "Netherlands",
  "Autodromo Nazionale Monza": "Italy",
  "Madrid Street Circuit": "Spain",
  "Baku City Circuit": "Azerbaijan",
  "Marina Bay Street Circuit": "Singapore",
  "Circuit of the Americas": "USA",
  "Autódromo Hermanos Rodríguez": "Mexico",
  "Autódromo José Carlos Pace": "Brazil",
  "Las Vegas Strip Circuit": "USA",
  "Lusail International Circuit": "Qatar",
  "Yas Marina Circuit": "UAE"
};

const difficulties = {
  "Albert Park Circuit": "Medium",
  "Shanghai International Circuit": "Medium",
  "Suzuka Circuit": "High",
  "Bahrain International Circuit": "Medium",
  "Jeddah Corniche Circuit": "Very High",
  "Miami International Autodrome": "Medium",
  "Circuit Gilles Villeneuve": "Medium",
  "Circuit de Monaco": "Very High",
  "Circuit de Barcelona-Catalunya": "Low",
  "Red Bull Ring": "Low",
  "Silverstone Circuit": "Medium",
  "Circuit de Spa-Francorchamps": "High",
  "Hungaroring": "High",
  "Circuit Zandvoort": "High",
  "Autodromo Nazionale Monza": "Low",
  "Madrid Street Circuit": "High",
  "Baku City Circuit": "High",
  "Marina Bay Street Circuit": "Very High",
  "Circuit of the Americas": "Medium",
  "Autódromo Hermanos Rodríguez": "Medium",
  "Autódromo José Carlos Pace": "Medium",
  "Las Vegas Strip Circuit": "Medium",
  "Lusail International Circuit": "Medium",
  "Yas Marina Circuit": "Medium"
};

const lines = code.split('\n');
const newLines = lines.map(line => {
  if (line.includes('circuit:')) {
    const match = line.match(/circuit:\s*"([^"]+)"/);
    if (match) {
      const circuit = match[1];
      const country = countries[circuit];
      const difficulty = difficulties[circuit];
      return line.replace('sprint:', `country: "${country}", difficulty: "${difficulty}", sprint:`);
    }
  }
  return line;
});

fs.writeFileSync('/Users/rahulr/Desktop/f1manager/data/calendar.js', newLines.join('\n'));
