import { Driver } from "../game/driver.js";

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
