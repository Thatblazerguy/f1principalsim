import { Team } from "../game/team.js";
import { drivers } from "./drivers.js";

/*
AI Teams only
Player team is created during setup and NOT here
*/

function getDriver(name) {
  return drivers.find(d => d.name === name);
}

function createTeam(name, carPerformance, specs, raceDrivers, reserveDriver = null) {
  const t = new Team(name, 0, carPerformance);
  t.powerUnit = specs.powerUnit;
  t.specs = {
    aero: specs.aero,
    chassis: specs.chassis,
    reliability: specs.reliability,
    ovr: specs.ovr,
  };
  raceDrivers.forEach(driverName => t.signDriver(getDriver(driverName)));
  if (reserveDriver) t.signDriver(getDriver(reserveDriver), "reserve");
  return t;
}

function getAssignedNames(teams) {
  const assigned = new Set();
  teams.forEach(team => {
    team.drivers.forEach(driver => assigned.add(driver.name));
    if (team.reserveDriver) assigned.add(team.reserveDriver.name);
  });
  return assigned;
}

function buildReserveCandidatePool(teams, blockedNames = []) {
  const assignedNames = getAssignedNames(teams);
  const blocked = new Set(blockedNames);

  return drivers
    .filter(driver => !assignedNames.has(driver.name) && !blocked.has(driver.name))
    .filter(driver => driver.category === "FREE" || driver.category === "F2")
    .sort((a, b) => b.market - a.market || a.signingFee - b.signingFee);
}

export function assignReplacementReserve(teams, teamName, blockedNames = []) {
  const team = teams.find(entry => entry.name === teamName);
  if (!team || team.reserveDriver) return null;

  const pool = buildReserveCandidatePool(teams, blockedNames);
  const replacement = pool[0];
  if (!replacement) return null;

  team.signDriver(replacement, "reserve");
  return replacement;
}

export function createAiTeams() {
  return [
    createTeam(
      "Mercedes",
      95,
      { powerUnit: "Mercedes", aero: 96, chassis: 95, reliability: 94, ovr: 95 },
      ["George Russell", "Andrea Kimi Antonelli"],
      "Mick Schumacher"
    ),
    createTeam(
      "Ferrari",
      93,
      { powerUnit: "Ferrari", aero: 93, chassis: 94, reliability: 91, ovr: 93 },
      ["Lewis Hamilton", "Charles Leclerc"],
      "Antonio Giovinazzi"
    ),
    createTeam(
      "McLaren",
      92,
      { powerUnit: "Mercedes", aero: 91, chassis: 92, reliability: 93, ovr: 92 },
      ["Lando Norris", "Oscar Piastri"],
      "Leo Fornaroli"
    ),
    createTeam(
      "Red Bull Racing",
      89,
      { powerUnit: "RBPT-Ford", aero: 90, chassis: 88, reliability: 89, ovr: 89 },
      ["Max Verstappen", "Isack Hadjar"],
      "Yuki Tsunoda"
    ),
    createTeam(
      "Haas",
      86,
      { powerUnit: "Ferrari", aero: 84, chassis: 86, reliability: 87, ovr: 86 },
      ["Esteban Ocon", "Oliver Bearman"],
      "Jack Doohan"
    ),
    createTeam(
      "Alpine",
      85,
      { powerUnit: "Mercedes", aero: 85, chassis: 83, reliability: 88, ovr: 85 },
      ["Pierre Gasly", "Franco Colapinto"],
      "Rafael Camara"
    ),
    createTeam(
      "Racing Bulls",
      83,
      { powerUnit: "RBPT-Ford", aero: 83, chassis: 85, reliability: 82, ovr: 83 },
      ["Liam Lawson", "Arvid Lindblad"],
      "Nikola Tsolov"
    ),
    createTeam(
      "Williams",
      82,
      { powerUnit: "Mercedes", aero: 81, chassis: 82, reliability: 84, ovr: 82 },
      ["Carlos Sainz", "Alex Albon"],
      "Colton Herta"
    ),
    createTeam(
      "Audi",
      81,
      { powerUnit: "Audi", aero: 79, chassis: 81, reliability: 82, ovr: 81 },
      ["Nico Hulkenberg", "Gabriel Bortoleto"],
      "Theo Pourchaire"
    ),
    createTeam(
      "Cadillac",
      80,
      { powerUnit: "Ferrari*", aero: 78, chassis: 79, reliability: 85, ovr: 80 },
      ["Sergio Perez", "Valtteri Bottas"],
      "Zane Maloney"
    ),
    createTeam(
      "Aston Martin",
      79,
      { powerUnit: "Honda", aero: 88, chassis: 84, reliability: 65, ovr: 79 },
      ["Fernando Alonso", "Lance Stroll"],
      "Jak Crawford"
    ),
  ];
}

export const aiTeams = createAiTeams();
