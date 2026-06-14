import { Driver } from "./driver.js";

// ─── Driving Styles ─────────────────────────────────────────────────────────
export const DRIVING_STYLES = [
  "Aggressive Overtaker",
  "Tyre Whisperer",
  "Wet Weather Specialist",
  "Qualifying Expert",
  "Race Strategist",
];

// ─── Personalities ──────────────────────────────────────────────────────────
export const PERSONALITIES = [
  "Determined",
  "Calm Under Pressure",
  "Hot-Headed",
  "Team Player",
  "Lone Wolf",
  "Media Darling",
  "Perfectionist",
  "Late Bloomer",
  "Prodigy",
  "Grinder",
];

// ─── Regions & Name Pools ───────────────────────────────────────────────────
export const REGIONS = {
  europe: {
    label: "Europe",
    emoji: "🇪🇺",
    nationalities: ["British", "French", "German", "Italian", "Spanish", "Dutch", "Finnish", "Danish", "Swedish", "Austrian", "Belgian", "Polish", "Czech", "Swiss"],
    firstNames: [
      "Luca", "Matteo", "Hugo", "Felix", "Oscar", "Emil", "Theo", "Leon",
      "Noah", "Axel", "Niklas", "Sven", "Marco", "Romain", "Pierre",
      "Kai", "Maxim", "Stefan", "Florian", "Julien", "Henrik", "Lars",
      "Viktor", "Rasmus", "Tobias", "Jan", "Mika", "Kalle", "Bastian",
      "Enzo", "Dario", "Fabian", "Lukas", "Antonio", "Giovanni",
    ],
    lastNames: [
      "Müller", "Rossi", "Dupont", "Janssen", "Lindberg", "Kowalski",
      "Schmidt", "Bianchi", "Moreau", "De Vries", "Eriksson", "Novak",
      "Ferreira", "Laurent", "Petrov", "Zimmermann", "Rinaldi", "Blanc",
      "Sørensen", "Eklund", "Weber", "Fischer", "Bauer", "Wagner",
      "Colombo", "Fontana", "Martini", "Leclair", "Berger", "Wolff",
    ],
  },
  southAmerica: {
    label: "South America",
    emoji: "🇧🇷",
    nationalities: ["Brazilian", "Argentine", "Colombian", "Chilean", "Uruguayan", "Venezuelan"],
    firstNames: [
      "Mateo", "Santiago", "Lucas", "Rafael", "Diego", "Thiago",
      "Enzo", "Tomás", "Bruno", "Gabriel", "Nicolás", "Agustín",
      "Valentín", "Facundo", "Emiliano", "Ignacio", "Dante", "Leandro",
      "Renato", "Gustavo", "Caio", "Pedro", "Miguel", "Heitor",
    ],
    lastNames: [
      "Silva", "Santos", "Oliveira", "Souza", "Fernández", "González",
      "Rodríguez", "López", "Martínez", "Pérez", "García", "Herrera",
      "Almeida", "Costa", "Barros", "Ribeiro", "Carvalho", "Moura",
      "Vargas", "Castillo", "Mendoza", "Rojas", "Ortega", "Vega",
    ],
  },
  northAmerica: {
    label: "North America",
    emoji: "🇺🇸",
    nationalities: ["American", "Canadian", "Mexican"],
    firstNames: [
      "Jake", "Colton", "Logan", "Ryan", "Ethan", "Mason",
      "Tyler", "Hunter", "Caleb", "Dylan", "Brody", "Austin",
      "Connor", "Brandon", "Travis", "Chase", "Wyatt", "Kyle",
      "Cameron", "Jordan", "Nolan", "Levi", "Carter", "Cooper",
    ],
    lastNames: [
      "Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson",
      "Moore", "Taylor", "Anderson", "Thomas", "Harris", "Clark",
      "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
      "Wright", "Scott", "Green", "Baker", "Hill", "Campbell",
    ],
  },
  asia: {
    label: "Asia",
    emoji: "🇯🇵",
    nationalities: ["Japanese", "Chinese", "South Korean", "Indian", "Thai", "Singaporean"],
    firstNames: [
      "Yuki", "Ren", "Haruto", "Kaito", "Riku", "Takumi",
      "Hiroto", "Sota", "Wei", "Jun", "Hao", "Seung",
      "Min", "Jin", "Tae", "Arjun", "Vikram", "Ravi",
      "Akira", "Kenji", "Daiki", "Shota", "Ryota", "Kenta",
    ],
    lastNames: [
      "Tanaka", "Suzuki", "Takahashi", "Watanabe", "Yamamoto",
      "Nakamura", "Kobayashi", "Wang", "Li", "Zhang",
      "Kim", "Park", "Lee", "Chen", "Liu",
      "Sato", "Ito", "Matsumoto", "Inoue", "Kimura",
      "Singh", "Patel", "Sharma", "Kumar", "Agarwal",
    ],
  },
  oceania: {
    label: "Oceania",
    emoji: "🇦🇺",
    nationalities: ["Australian", "New Zealander"],
    firstNames: [
      "Jack", "Liam", "Oliver", "Noah", "James", "Ethan",
      "Lucas", "Mason", "Cooper", "Flynn", "Archie", "Riley",
      "Finn", "Blake", "Jayden", "Harrison", "Callum", "Angus",
    ],
    lastNames: [
      "Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor",
      "Martin", "Thompson", "White", "Anderson", "Walker", "Harris",
      "Kelly", "Murray", "Mitchell", "Robinson", "Clarke", "Stewart",
    ],
  },
  africa: {
    label: "Africa",
    emoji: "🇿🇦",
    nationalities: ["South African", "Nigerian", "Kenyan", "Moroccan", "Egyptian", "Algerian"],
    firstNames: [
      "Tariq", "Amir", "Zain", "Idris", "Omar", "Youssef",
      "Kofi", "Kwame", "Chidi", "Emeka", "Bayo", "Danjuma",
      "Sipho", "Thabo", "Mandla", "Nkosi", "Jabari", "Aziz",
    ],
    lastNames: [
      "Nkosi", "Okonkwo", "Ibrahim", "El-Amin", "Diallo", "Mbeki",
      "Abubakar", "Toure", "Mensah", "Adeyemi", "Kamara", "Dlamini",
      "Mthembu", "Ndlovu", "Botha", "Joubert", "Benali", "Chikane",
    ],
  },
};

// ─── Scouting Tiers ─────────────────────────────────────────────────────────
export const SCOUTING_TIERS = {
  basic:    { label: "Basic",    cost: 2,  qualityMin: 45, qualityMax: 72, potentialMin: 60, potentialMax: 82, duration: 21 },
  advanced: { label: "Advanced", cost: 5,  qualityMin: 50, qualityMax: 78, potentialMin: 68, potentialMax: 90, duration: 18 },
  elite:    { label: "Elite",    cost: 10, qualityMin: 55, qualityMax: 85, potentialMin: 75, potentialMax: 99, duration: 14 },
};

// ─── Loan Destinations ──────────────────────────────────────────────────────
export const LOAN_DESTINATIONS = [
  { id: "f2", label: "Formula 2", devBonus: { pace: 1.2, racecraft: 1.0 }, prestige: 5 },
  { id: "f3", label: "Formula 3", devBonus: { pace: 0.8, consistency: 0.9 }, prestige: 3 },
  { id: "fregional", label: "Formula Regional", devBonus: { consistency: 0.7, adaptability: 0.6 }, prestige: 2 },
  { id: "superformula", label: "Super Formula", devBonus: { adaptability: 1.0, consistency: 1.0 }, prestige: 4 },
  { id: "indynxt", label: "Indy NXT", devBonus: { racecraft: 1.2, mentality: 0.8 }, prestige: 3 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function gaussianRandom(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Prospect Generation ────────────────────────────────────────────────────

/**
 * Generate a single academy prospect.
 * @param {string} regionKey — key from REGIONS
 * @param {number} academyLevel — 1-10, influences quality
 * @param {string} tier — 'basic' | 'advanced' | 'elite'
 * @returns {Driver}
 */
export function generateAcademyProspect(regionKey, academyLevel = 1, tier = "basic") {
  const region = REGIONS[regionKey];
  if (!region) throw new Error(`Unknown region: ${regionKey}`);

  const tierData = SCOUTING_TIERS[tier] || SCOUTING_TIERS.basic;
  const levelBonus = (academyLevel - 1) * 1.5; // Level 10 adds +13.5 to quality range

  // Basic info
  const firstName = pick(region.firstNames);
  const lastName = pick(region.lastNames);
  const name = `${firstName} ${lastName}`;
  const nationality = pick(region.nationalities);
  const age = randInt(16, 19);
  const personality = pick(PERSONALITIES);
  const preferredStyle = pick(DRIVING_STYLES);

  // Potential ceiling (the theoretical max this driver can reach)
  const rawPotential = gaussianRandom(
    (tierData.potentialMin + tierData.potentialMax) / 2 + levelBonus * 0.5,
    (tierData.potentialMax - tierData.potentialMin) / 4
  );
  const potentialCeiling = clamp(Math.round(rawPotential), tierData.potentialMin, 99);

  // Current ratings — well below potential, spread with some variance
  const baseQuality = gaussianRandom(
    (tierData.qualityMin + tierData.qualityMax) / 2 + levelBonus * 0.3,
    (tierData.qualityMax - tierData.qualityMin) / 4
  );
  const base = clamp(Math.round(baseQuality), tierData.qualityMin, Math.min(potentialCeiling - 5, 80));

  const variance = () => clamp(base + randInt(-5, 5), 30, potentialCeiling - 3);

  const pace = variance();
  const quali = variance();
  const racecraft = variance();
  const consistency = clamp(variance() - 3, 30, 90); // Juniors are less consistent
  const tyre = clamp(variance() - 2, 30, 85);
  const wet = clamp(variance() - 4, 30, 85);

  // Extended attributes
  const adaptability = clamp(base + randInt(-8, 8), 30, 90);
  const feedback = clamp(base + randInt(-6, 6), 30, 90);
  const mentality = clamp(base + randInt(-10, 10), 30, 90);
  const mediaHandling = clamp(30 + randInt(0, 40), 30, 80);
  const fitness = clamp(50 + randInt(0, 30), 40, 90);
  const developmentRate = clamp(55 + randInt(0, 35) + academyLevel * 2, 40, 99);

  // Hidden traits
  const workEthic = clamp(40 + randInt(0, 50), 30, 99);
  const professionalism = clamp(35 + randInt(0, 50), 25, 95);
  const pressureResistance = clamp(30 + randInt(0, 55), 20, 95);

  // Market value — low for academy juniors
  const market = clamp(Math.round(potentialCeiling * 0.3 + base * 0.15), 15, 55);
  const salary = clamp(Math.round(market * 0.15 + 0.5), 1, 5);

  const driver = new Driver(name, pace, quali, racecraft, tyre, wet, consistency, market, salary, age, "ACADEMY");

  // Override defaults with generated values
  driver.adaptability = adaptability;
  driver.feedback = feedback;
  driver.mentality = mentality;
  driver.mediaHandling = mediaHandling;
  driver.fitness = fitness;
  driver.developmentRate = developmentRate;
  driver.potentialCeiling = potentialCeiling;
  driver.hiddenTraits = { workEthic, professionalism, pressureResistance };
  driver.contractType = "junior";
  driver.contractYearsRemaining = 3;
  driver.driverRole = "academy";
  driver.loanStatus = null;
  driver.careerTimeline = [];
  driver.morale = clamp(60 + randInt(0, 30), 50, 95);
  driver.preferredStyle = preferredStyle;
  driver.personality = personality;
  driver.nationality = nationality;
  driver.regionKey = regionKey;
  driver.scoutRevealLevel = 0; // 0 = minimal, 1-5 = progressively more revealed
  driver.roleLabel = "Academy Prospect";

  return driver;
}

/**
 * Generate a scouting report with information based on reveal level.
 * @param {Driver} prospect
 * @param {number} revealLevel — 0-5
 * @returns {Object}
 */
export function generateScoutingReport(prospect, revealLevel = 0) {
  const report = {
    name: prospect.name,
    age: prospect.age,
    nationality: prospect.nationality || "Unknown",
    revealed: revealLevel,
  };

  if (revealLevel >= 1) {
    report.personality = prospect.personality;
    report.preferredStyle = prospect.preferredStyle;
  }
  if (revealLevel >= 2) {
    report.paceRange = getAttributeRange(prospect.pace);
    report.qualiRange = getAttributeRange(prospect.quali);
    report.currentSeries = prospect.age <= 17 ? "Karting" : "F4";
  }
  if (revealLevel >= 3) {
    report.pace = prospect.pace;
    report.quali = prospect.quali;
    report.racecraft = prospect.racecraft;
    report.consistency = prospect.consistency;
  }
  if (revealLevel >= 4) {
    report.potentialRange = getAttributeRange(prospect.potentialCeiling, 6);
    report.adaptability = prospect.adaptability;
    report.mentality = prospect.mentality;
    report.fitness = prospect.fitness;
  }
  if (revealLevel >= 5) {
    report.potentialCeiling = prospect.potentialCeiling;
    report.developmentRate = prospect.developmentRate;
    report.feedback = prospect.feedback;
    report.mediaHandling = prospect.mediaHandling;
  }

  return report;
}

function getAttributeRange(value, spread = 8) {
  const low = Math.max(1, value - spread);
  const high = Math.min(99, value + spread);
  return `${low}-${high}`;
}

/**
 * Returns the max number of academy drivers based on academy level.
 */
export function getMaxAcademySize(academyLevel) {
  if (academyLevel <= 2) return 4;
  if (academyLevel <= 4) return 5;
  if (academyLevel <= 6) return 6;
  if (academyLevel <= 8) return 7;
  return 8;
}

/**
 * Get the XP required to reach the next academy level.
 */
export function getAcademyXPRequired(level) {
  return 80 + level * 30; // Level 1→2 = 110 XP, Level 9→10 = 350 XP
}

/**
 * Get the cost to upgrade a facility to the next level.
 * @param {number} currentLevel — 1-5
 */
export function getFacilityUpgradeCost(currentLevel) {
  return [0, 3, 8, 15, 25, 999][currentLevel] || 999; // Cost to reach level 2,3,4,5,6(impossible)
}

/**
 * Calculate academy reputation stars (1-5) based on level, facilities, and prospect quality.
 */
export function calculateAcademyReputation(academy) {
  if (!academy) return 1;
  const facilityAvg = (academy.facilities.simulator + academy.facilities.fitness +
    academy.facilities.coaching + academy.facilities.sportsPsychology) / 4;
  const levelFactor = academy.level / 10;
  const facilityFactor = facilityAvg / 5;
  const raw = levelFactor * 0.6 + facilityFactor * 0.4;
  return Math.max(1, Math.min(5, Math.round(raw * 5)));
}
