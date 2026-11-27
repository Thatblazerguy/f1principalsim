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
const DRIVER_NAME_ALIASES = new Map([
  ["kimi antonelli", "andrea kimi antonelli"],
  ["andrea kimi antonelli", "andrea kimi antonelli"],
  ["alexander albon", "alex albon"],
  ["alex albon", "alex albon"],
]);

function normalizeDriverName(name = "") {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCanonicalDriverKey(name = "") {
  const normalized = normalizeDriverName(name);
  return DRIVER_NAME_ALIASES.get(normalized) ?? normalized;
}

// Verified official headshots (formula1.com media). Drivers without one fall back to a helmet figure.
const F1_MEDIA_HEADSHOT = (path) => `https://media.formula1.com/content/dam/fom-website/drivers/${path}.png.transform/2col/image.png`;
const STATIC_HEADSHOTS = {
  "Alex Albon": "A/ALEALB01_Alexander_Albon/alealb01",
  "Andrea Kimi Antonelli": "A/ANDANT01_Andrea%20Kimi_Antonelli/andant01",
  "Antonio Giovinazzi": "A/ANTGIO01_Antonio_Giovinazzi/antgio01",
  "Carlos Sainz": "C/CARSAI01_Carlos_Sainz/carsai01",
  "Charles Leclerc": "C/CHALEC01_Charles_Leclerc/chalec01",
  "Daniel Ricciardo": "D/DANRIC01_Daniel_Ricciardo/danric01",
  "Esteban Ocon": "E/ESTOCO01_Esteban_Ocon/estoco01",
  "Felipe Drugovich": "F/FELDRU01_Felipe_Drugovich/feldru01",
  "Fernando Alonso": "F/FERALO01_Fernando_Alonso/feralo01",
  "Franco Colapinto": "F/FRACOL01_Franco_Colapinto/fracol01",
  "Gabriel Bortoleto": "G/GABBOR01_Gabriel_Bortoleto/gabbor01",
  "George Russell": "G/GEORUS01_George_Russell/georus01",
  "Isack Hadjar": "I/ISAHAD01_Isack_Hadjar/isahad01",
  "Jack Doohan": "J/JACDOO01_Jack_Doohan/jacdoo01",
  "Kevin Magnussen": "K/KEVMAG01_Kevin_Magnussen/kevmag01",
  "Lance Stroll": "L/LANSTR01_Lance_Stroll/lanstr01",
  "Lando Norris": "L/LANNOR01_Lando_Norris/lannor01",
  "Lewis Hamilton": "L/LEWHAM01_Lewis_Hamilton/lewham01",
  "Liam Lawson": "L/LIALAW01_Liam_Lawson/lialaw01",
  "Logan Sargeant": "L/LOGSAR01_Logan_Sargeant/logsar01",
  "Max Verstappen": "M/MAXVER01_Max_Verstappen/maxver01",
  "Mick Schumacher": "M/MICSCH02_Mick_Schumacher/micsch02",
  "Nico Hulkenberg": "N/NICHUL01_Nico_Hulkenberg/nichul01",
  "Nyck de Vries": "N/NYCDEV01_Nyck_De%20Vries/nycdev01",
  "Oliver Bearman": "O/OLIBEA01_Oliver_Bearman/olibea01",
  "Oscar Piastri": "O/OSCPIA01_Oscar_Piastri/oscpia01",
  "Pierre Gasly": "P/PIEGAS01_Pierre_Gasly/piegas01",
  "Sergio Perez": "S/SERPER01_Sergio_Perez/serper01",
  "Valtteri Bottas": "V/VALBOT01_Valtteri_Bottas/valbot01",
  "Yuki Tsunoda": "Y/YUKTSU01_Yuki_Tsunoda/yuktsu01",
  "Zhou Guanyu": "G/GUAZHO01_Guanyu_Zhou/guazho01",
};

// Driver silhouette in a race helmet, used wherever a driver has no photo.
export function buildHelmetAvatar(accent = "#e10600") {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2a2f"/><stop offset="1" stop-color="#141416"/></linearGradient>
    <linearGradient id="shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f2f4"/><stop offset="1" stop-color="#9a9aa2"/></linearGradient>
    <linearGradient id="visor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f4a"/><stop offset="1" stop-color="#0b0c0f"/></linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#bg)"/>
  <path d="M10 128 C14 104 36 94 64 94 C92 94 114 104 118 128 Z" fill="#3b3b42"/>
  <path d="M46 96 L82 96 L78 106 L50 106 Z" fill="${accent}" opacity="0.9"/>
  <path d="M28 64 C28 36 46 20 67 20 C90 20 104 37 104 60 L104 76 C104 85 98 90 89 90 L44 90 C35 90 28 84 28 75 Z" fill="url(#shell)"/>
  <path d="M36 40 C44 27 56 21 68 21 C82 21 94 28 100 40 Z" fill="${accent}"/>
  <path d="M52 52 C52 47 56 45 61 45 L103 45 L104 64 L60 64 C55 64 52 61 52 57 Z" fill="url(#visor)"/>
  <path d="M58 49 L96 49" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round"/>
  <path d="M30 78 L104 78" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>
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
  [driver.name, profile.full_name, profile.broadcast_name]
    .filter(Boolean)
    .forEach(name => driverProfileByName.set(resolveCanonicalDriverKey(name), profile));
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
  const rawName = profile?.full_name || profile?.broadcast_name || "Unknown Driver";
  const canonicalKey = resolveCanonicalDriverKey(rawName);
  const canonicalLocal = drivers.find(entry => resolveCanonicalDriverKey(entry.name) === canonicalKey);
  const name = canonicalLocal?.name || rawName;

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
  if (!name) return buildHelmetAvatar();

  const canonical = resolveCanonicalDriverKey(name);
  const localDriver = typeof nameOrDriver === "object"
    ? nameOrDriver
    : drivers.find(entry => resolveCanonicalDriverKey(entry.name) === canonical);
  const profile = driverProfileByName.get(canonical);

  const known = STATIC_HEADSHOTS[name] || Object.entries(STATIC_HEADSHOTS).find(([n]) => resolveCanonicalDriverKey(n) === canonical)?.[1];
  return localDriver?.headshotUrl || profile?.headshot_url || (known ? F1_MEDIA_HEADSHOT(known) : buildHelmetAvatar());
}

export function getDriverNumber(nameOrDriver) {
  const name = typeof nameOrDriver === "string" ? nameOrDriver : nameOrDriver?.name;
  if (!name) return "--";

  const canonical = resolveCanonicalDriverKey(name);
  const localDriver = typeof nameOrDriver === "object"
    ? nameOrDriver
    : drivers.find(entry => resolveCanonicalDriverKey(entry.name) === canonical);
  const profile = driverProfileByName.get(canonical);

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

    const existingByName = new Map(drivers.map(driver => [resolveCanonicalDriverKey(driver.name), driver]));
    const openF1BackedDrivers = [];
    const seen = new Set();

    apiDrivers.forEach(profile => {
      const rawName = profile?.full_name || profile?.broadcast_name;
      const canonical = resolveCanonicalDriverKey(rawName);
      if (!canonical || seen.has(canonical)) return;
      seen.add(canonical);

      const existing = existingByName.get(canonical);
      const merged = existing ? applyOpenF1Profile(existing, profile) : createDriverFromOpenF1(profile);
      merged.startupEligible = true;
      if (merged.category === "FREE") merged.category = "F1";
      openF1BackedDrivers.push(merged);
    });

    const extras = drivers.filter(driver => !seen.has(resolveCanonicalDriverKey(driver.name)));
    drivers.splice(0, drivers.length, ...openF1BackedDrivers, ...extras);
    return true;
  } catch (error) {
    console.log("OpenF1 driver sync skipped (CORS/network), using local data.");
    return false;
  }
}
