export class Team {
  constructor(name, budget, carPerformance) {
    this.name = name;
    this.budget = budget;
    this.carPerformance = carPerformance;
    this.level = 1;
    this.xp = 0;
    this.carLevel = 1;
    this.carXP = 0;
    this.car = { aero:1, engine:1, chassis:1, reliability:1 };
    this.drivers = [];
    this.reserveDriver = null;
    this.activeDrivers = [];
    this.sponsor = null;
    this.sponsorSlots = {};
  }

  signDriver(d, role = "main") {
    if (role === "reserve") {
      if (!this.reserveDriver) this.reserveDriver = d;
      return;
    }
    if (this.drivers.length < 2) this.drivers.push(d);
  }

  hasDriver(name) {
    return this.drivers.some(driver => driver.name === name) || this.reserveDriver?.name === name;
  }

  releaseDriver(name) {
    this.drivers = this.drivers.filter(driver => driver.name !== name);
    if (this.reserveDriver?.name === name) this.reserveDriver = null;
  }

  demoteToReserve(name) {
    if (this.reserveDriver) return false;
    const driver = this.drivers.find(entry => entry.name === name);
    if (!driver) return false;
    this.drivers = this.drivers.filter(entry => entry.name !== name);
    this.reserveDriver = driver;
    return true;
  }

  promoteReserve() {
    if (!this.reserveDriver || this.drivers.length >= 2) return false;
    this.drivers.push(this.reserveDriver);
    this.reserveDriver = null;
    return true;
  }

  gainXP(x) {
    this.xp += x;
    if (this.xp >= 100) { this.level++; this.xp = 0; }
  }

  gainCarXP(x) {
    this.carXP += x;
    while (this.carXP >= 100) {
      this.carXP -= 100;
      this.carLevel++;
      this.carPerformance += 2;
    }
  }

  upgrade(p) {
    const cost = 50 * this.car[p];
    if (this.budget >= cost) {
      this.budget -= cost;
      this.car[p]++;
      this.carPerformance += 1.5;
    }
  }
}
