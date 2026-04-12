import { Driver } from "../game/driver.js";

const OPEN_F1_DRIVERS_ENDPOINT = "https://api.openf1.org/v1/drivers?session_key=latest";

const STATIC_DRIVER_NUMBERS = {
  "Max Verstappen": 1,
  "Sergio Perez": 11,
  "Charles Leclerc": 16,
  "Carlos Sainz": 55,
  "Lewis Hamilton": 44,
  "George Russell": 63,
  "Lando Norris": 4,
  "Oscar Piastri": 81,
  "Fernando Alonso": 14,
  "Lance Stroll": 18,
  "Esteban Ocon": 31,
  "Pierre Gasly": 10,
  "Alex Albon": 23,
  "Logan Sargeant": 2,
  "Yuki Tsunoda": 22,
  "Daniel Ricciardo": 3,
  "Valtteri Bottas": 77,
  "Zhou Guanyu": 24,
  "Kevin Magnussen": 20,
  "Nico Hulkenberg": 27,
  "Mick Schumacher": 47,
  "Antonio Giovinazzi": 99,
  "Nyck de Vries": 21,
  "Andrea Kimi Antonelli": 12,
  "Oliver Bearman": 87,
  "Theo Pourchaire": 5,
  "Jack Doohan": 7,
  "Liam Lawson": 40,
  "Felipe Drugovich": 43,
};

const driverProfileByName = new Map();

function normalizeDriverName(name = "") {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildInitialsAvatar(name = "Driver") {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "DR";

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#e10600"/>
      <stop offset="100%" stop-color="#5e0d0d"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="20" fill="url(#grad)"/>
  <text x="50%" y="54%" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="44" font-weight="700">${initials}</text>
</svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function applyOpenF1Profile(driver, profile) {
  if (!driver || !profile) return driver;
  if (profile.headshot_url) driver.headshotUrl = profile.headshot_url;
  if (profile.team_name) driver.teamName = profile.team_name;
  if (Number.isFinite(profile.driver_number)) {
    driver.permanentNumber = profile.driver_number;
  }
  driverProfileByName.set(normalizeDriverName(driver.name), profile);
  return driver;
}

function createDriverFromOpenF1(profile) {
  const estimatedMarket = 72;
  const estimatedPace = 82;
  const estimatedQuali = 82;
  const estimatedRacecraft = 82;
  const estimatedConsistency = 80;
  const estimatedSalary = 12;
  const estimatedAge = Number(profile?.age) || 26;
  const name = profile?.full_name || profile?.broadcast_name || "Unknown Driver";

  const driver = createDriver({
    name,
    roleLabel: profile?.team_name ? `${profile.team_name} Race` : "F1 Driver",
    pace: estimatedPace,
    quali: estimatedQuali,
    racecraft: estimatedRacecraft,
    consistency: estimatedConsistency,
    market: estimatedMarket,
    salary: estimatedSalary,
    age: estimatedAge,
    category: "F1",
    startupEligible: true,
  });

  return applyOpenF1Profile(driver, profile);
}

function estimateTyre(pace, racecraft, consistency) {
  return Math.round((pace + racecraft + consistency) / 3);
}

function estimateWet(quali, racecraft, consistency) {
  return Math.round((quali + racecraft + consistency) / 3);
}

function createDriver({
  name,
  roleLabel,
  pace,
  quali,
  racecraft,
  consistency,
  market,
  salary,
  age,
  category = "FREE",
  tyre,
  wet,
  signingFee = salary,
  startupEligible = false,
}) {
  const driver = new Driver(
    name,
    pace,
    quali,
    racecraft,
    tyre ?? estimateTyre(pace, racecraft, consistency),
    wet ?? estimateWet(quali, racecraft, consistency),
    consistency,
    market,
    salary,
    age,
    category
  );

  driver.roleLabel = roleLabel ?? category;
  driver.signingFee = signingFee;
  driver.startupEligible = startupEligible;
  return driver;
}

export const drivers = [
  // Current F1 grid and team reserves
  createDriver({ name: "Max Verstappen", roleLabel: "Red Bull Race", pace: 98, quali: 97, racecraft: 98, consistency: 96, market: 99, salary: 55, age: 28, category: "F1" }),
  createDriver({ name: "Isack Hadjar", roleLabel: "Red Bull Race", pace: 85, quali: 86, racecraft: 82, consistency: 80, market: 72, salary: 9, age: 21, category: "F1" }),
  createDriver({ name: "Yuki Tsunoda", roleLabel: "Red Bull Reserve", pace: 86, quali: 87, racecraft: 84, consistency: 81, market: 78, salary: 16, age: 25, category: "F1", signingFee: 22, startupEligible: true }),

  createDriver({ name: "Lando Norris", roleLabel: "McLaren Race", pace: 96, quali: 95, racecraft: 94, consistency: 95, market: 97, salary: 42, age: 26, category: "F1" }),
  createDriver({ name: "Oscar Piastri", roleLabel: "McLaren Race", pace: 93, quali: 92, racecraft: 92, consistency: 91, market: 94, salary: 34, age: 25, category: "F1" }),
  createDriver({ name: "Leo Fornaroli", roleLabel: "McLaren Reserve", pace: 79, quali: 80, racecraft: 78, consistency: 77, market: 65, salary: 5, age: 21, category: "F1" }),

  createDriver({ name: "Lewis Hamilton", roleLabel: "Ferrari Race", pace: 94, quali: 92, racecraft: 97, consistency: 95, market: 98, salary: 50, age: 41, category: "F1" }),
  createDriver({ name: "Charles Leclerc", roleLabel: "Ferrari Race", pace: 95, quali: 98, racecraft: 91, consistency: 89, market: 96, salary: 46, age: 29, category: "F1" }),
  createDriver({ name: "Antonio Giovinazzi", roleLabel: "Ferrari Reserve", pace: 81, quali: 82, racecraft: 79, consistency: 80, market: 68, salary: 8, age: 32, category: "F1" }),

  createDriver({ name: "George Russell", roleLabel: "Mercedes Race", pace: 92, quali: 94, racecraft: 89, consistency: 88, market: 91, salary: 36, age: 28, category: "F1" }),
  createDriver({ name: "Andrea Kimi Antonelli", roleLabel: "Mercedes Race", pace: 91, quali: 89, racecraft: 86, consistency: 84, market: 89, salary: 18, age: 19, category: "F1" }),
  createDriver({ name: "Mick Schumacher", roleLabel: "Mercedes Reserve", pace: 81, quali: 80, racecraft: 82, consistency: 78, market: 75, salary: 8, age: 27, category: "F1", signingFee: 14, startupEligible: true }),

  createDriver({ name: "Carlos Sainz", roleLabel: "Williams Race", pace: 90, quali: 89, racecraft: 92, consistency: 93, market: 90, salary: 32, age: 31, category: "F1" }),
  createDriver({ name: "Alex Albon", roleLabel: "Williams Race", pace: 88, quali: 90, racecraft: 87, consistency: 88, market: 85, salary: 22, age: 29, category: "F1" }),
  createDriver({ name: "Colton Herta", roleLabel: "F2 (Hitech)", pace: 90, quali: 92, racecraft: 83, consistency: 75, market: 88, salary: 12, age: 25, category: "F2", signingFee: 20, startupEligible: true }),

  createDriver({ name: "Fernando Alonso", roleLabel: "Aston Martin Race", pace: 91, quali: 88, racecraft: 97, consistency: 92, market: 93, salary: 34, age: 44, category: "F1" }),
  createDriver({ name: "Lance Stroll", roleLabel: "Aston Martin Race", pace: 81, quali: 80, racecraft: 83, consistency: 79, market: 70, salary: 16, age: 27, category: "F1" }),
  createDriver({ name: "Jak Crawford", roleLabel: "Aston Reserve", pace: 80, quali: 81, racecraft: 82, consistency: 79, market: 70, salary: 7, age: 21, category: "F2", signingFee: 10, startupEligible: true }),

  createDriver({ name: "Sergio Perez", roleLabel: "Cadillac Race", pace: 87, quali: 84, racecraft: 92, consistency: 88, market: 82, salary: 24, age: 36, category: "F1" }),
  createDriver({ name: "Valtteri Bottas", roleLabel: "Cadillac Race", pace: 88, quali: 91, racecraft: 86, consistency: 89, market: 83, salary: 20, age: 36, category: "F1" }),
  createDriver({ name: "Zane Maloney", roleLabel: "Cadillac Reserve", pace: 81, quali: 79, racecraft: 84, consistency: 83, market: 69, salary: 7, age: 22, category: "F2", signingFee: 10, startupEligible: true }),

  createDriver({ name: "Nico Hulkenberg", roleLabel: "Audi Race", pace: 87, quali: 90, racecraft: 85, consistency: 88, market: 80, salary: 18, age: 38, category: "F1" }),
  createDriver({ name: "Gabriel Bortoleto", roleLabel: "Audi Race", pace: 83, quali: 82, racecraft: 81, consistency: 80, market: 74, salary: 11, age: 21, category: "F1" }),
  createDriver({ name: "Theo Pourchaire", roleLabel: "Audi Reserve", pace: 82, quali: 83, racecraft: 80, consistency: 79, market: 71, salary: 8, age: 22, category: "F1", signingFee: 12, startupEligible: true }),

  createDriver({ name: "Pierre Gasly", roleLabel: "Alpine Race", pace: 88, quali: 87, racecraft: 87, consistency: 86, market: 84, salary: 21, age: 29, category: "F1" }),
  createDriver({ name: "Franco Colapinto", roleLabel: "Alpine Race", pace: 84, quali: 83, racecraft: 85, consistency: 81, market: 76, salary: 10, age: 22, category: "F1" }),
  createDriver({ name: "Rafael Camara", roleLabel: "F2 (Invicta)", pace: 85, quali: 84, racecraft: 86, consistency: 88, market: 80, salary: 9, age: 20, category: "F2", signingFee: 13, startupEligible: true }),

  createDriver({ name: "Esteban Ocon", roleLabel: "Haas Race", pace: 86, quali: 85, racecraft: 87, consistency: 86, market: 81, salary: 18, age: 29, category: "F1" }),
  createDriver({ name: "Oliver Bearman", roleLabel: "Haas Race", pace: 86, quali: 84, racecraft: 86, consistency: 83, market: 79, salary: 12, age: 21, category: "F1" }),
  createDriver({ name: "Jack Doohan", roleLabel: "Haas Reserve", pace: 83, quali: 85, racecraft: 80, consistency: 81, market: 72, salary: 7, age: 22, category: "F1", signingFee: 11, startupEligible: true }),

  createDriver({ name: "Liam Lawson", roleLabel: "Racing Bulls Race", pace: 87, quali: 85, racecraft: 88, consistency: 86, market: 80, salary: 14, age: 23, category: "F1" }),
  createDriver({ name: "Arvid Lindblad", roleLabel: "Racing Bulls Race", pace: 82, quali: 81, racecraft: 79, consistency: 76, market: 68, salary: 8, age: 18, category: "F1" }),
  createDriver({ name: "Nikola Tsolov", roleLabel: "F2 (Campos)", pace: 88, quali: 87, racecraft: 82, consistency: 80, market: 74, salary: 7, age: 19, category: "F2", signingFee: 12, startupEligible: true }),

  // Available reserve and prospect pool
  createDriver({ name: "Alex Dunne", roleLabel: "F2 (Rodin)", pace: 86, quali: 85, racecraft: 89, consistency: 78, market: 71, salary: 7, age: 20, category: "F2", signingFee: 11, startupEligible: true }),
  createDriver({ name: "Dino Beganovic", roleLabel: "F2 (DAMS)", pace: 84, quali: 88, racecraft: 81, consistency: 82, market: 75, salary: 8, age: 21, category: "F2", signingFee: 12, startupEligible: true }),
  createDriver({ name: "Gabriele Mini", roleLabel: "F2 (MP)", pace: 83, quali: 87, racecraft: 81, consistency: 79, market: 73, salary: 7, age: 20, category: "F2", signingFee: 11, startupEligible: true }),
  createDriver({ name: "Ritomo Miyata", roleLabel: "F2 (Hitech)", pace: 82, quali: 81, racecraft: 83, consistency: 86, market: 68, salary: 6, age: 25, category: "F2", signingFee: 9, startupEligible: true }),
  createDriver({ name: "Sebastian Montoya", roleLabel: "F2 (Prema)", pace: 85, quali: 82, racecraft: 86, consistency: 74, market: 77, salary: 8, age: 20, category: "F2", signingFee: 12, startupEligible: true }),

  // Remaining free agents
  createDriver({ name: "Daniel Ricciardo", roleLabel: "Free Agent", pace: 84, quali: 84, racecraft: 88, consistency: 84, market: 76, salary: 12, age: 36, category: "FREE", signingFee: 14 }),
  createDriver({ name: "Zhou Guanyu", roleLabel: "Free Agent", pace: 83, quali: 82, racecraft: 82, consistency: 82, market: 72, salary: 10, age: 26, category: "FREE", signingFee: 12 }),
  createDriver({ name: "Kevin Magnussen", roleLabel: "Free Agent", pace: 82, quali: 81, racecraft: 85, consistency: 81, market: 70, salary: 10, age: 33, category: "FREE", signingFee: 12 }),
  createDriver({ name: "Nyck de Vries", roleLabel: "Free Agent", pace: 80, quali: 81, racecraft: 79, consistency: 79, market: 67, salary: 7, age: 30, category: "FREE", signingFee: 9 }),
  createDriver({ name: "Logan Sargeant", roleLabel: "Free Agent", pace: 78, quali: 78, racecraft: 77, consistency: 76, market: 62, salary: 6, age: 25, category: "FREE", signingFee: 8 }),
  createDriver({ name: "Felipe Drugovich", roleLabel: "Free Agent", pace: 80, quali: 79, racecraft: 80, consistency: 79, market: 66, salary: 7, age: 25, category: "FREE", signingFee: 9 }),
];

export function getDriverHeadshotUrl(nameOrDriver) {
  const name = typeof nameOrDriver === "string" ? nameOrDriver : nameOrDriver?.name;
  if (!name) return buildInitialsAvatar("Driver");

  const normalized = normalizeDriverName(name);
  const localDriver = typeof nameOrDriver === "object" ? nameOrDriver : drivers.find(entry => normalizeDriverName(entry.name) === normalized);
  const profile = driverProfileByName.get(normalized);

  return localDriver?.headshotUrl || profile?.headshot_url || buildInitialsAvatar(name);
}

export function getDriverNumber(nameOrDriver) {
  const name = typeof nameOrDriver === "string" ? nameOrDriver : nameOrDriver?.name;
  if (!name) return "--";

  const normalized = normalizeDriverName(name);
  const localDriver = typeof nameOrDriver === "object" ? nameOrDriver : drivers.find(entry => normalizeDriverName(entry.name) === normalized);
  const profile = driverProfileByName.get(normalized);

  const number = localDriver?.permanentNumber ?? profile?.driver_number ?? STATIC_DRIVER_NUMBERS[name];
  return Number.isFinite(number) ? String(number) : "--";
}

export async function syncDriversFromOpenF1() {
  if (typeof fetch !== "function") return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(OPEN_F1_DRIVERS_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const apiDrivers = await response.json();
    if (!Array.isArray(apiDrivers) || !apiDrivers.length) return false;

    const existingByName = new Map(drivers.map(driver => [normalizeDriverName(driver.name), driver]));
    const openF1BackedDrivers = [];
    const seen = new Set();

    apiDrivers.forEach(profile => {
      const rawName = profile?.full_name || profile?.broadcast_name;
      const normalized = normalizeDriverName(rawName);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);

      const existing = existingByName.get(normalized);
      const merged = existing ? applyOpenF1Profile(existing, profile) : createDriverFromOpenF1(profile);
      merged.startupEligible = true;
      if (merged.category === "FREE") merged.category = "F1";
      openF1BackedDrivers.push(merged);
    });

    const extras = drivers.filter(driver => !seen.has(normalizeDriverName(driver.name)));
    drivers.splice(0, drivers.length, ...openF1BackedDrivers, ...extras);
    return true;
  } catch (error) {
    console.warn("OpenF1 driver sync failed, using local data.", error);
    return false;
  }
}
