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
      this.carPerformance = parseFloat((this.carPerformance + 2).toFixed(1));
    }
  }

  upgrade(p) {
    const cost = 50 * this.car[p];
    if (this.budget >= cost) {
      this.budget = parseFloat((this.budget - cost).toFixed(1));
      this.car[p]++;
      this.carPerformance = parseFloat((this.carPerformance + 1.5).toFixed(1));
    }
  }
  
  // ── Academy specific promotion methods ──
  
  promoteAcademyToReserve(academyDriver, globalState) {
    if (this.reserveDriver) return false;
    
    // Remove from academy
    const idx = globalState.academy.prospects.findIndex(d => d.name === academyDriver.name);
    if (idx !== -1) globalState.academy.prospects.splice(idx, 1);
    
    academyDriver.contractType = 'reserve';
    academyDriver.driverRole = 'reserve';
    academyDriver.roleLabel = 'Reserve Driver';
    academyDriver.salary = Math.max(3, academyDriver.salary * 1.5); // Bump salary
    academyDriver.careerTimeline.unshift({ seasonYear: globalState.season.year || 1, event: 'Promoted', detail: 'Promoted from Academy to Reserve Driver' });
    
    this.reserveDriver = academyDriver;
    return true;
  }
  
  promoteReserveToSeat(driverNameToReplace, globalState) {
    if (!this.reserveDriver) return false;
    
    const driverToReplace = this.drivers.find(d => d.name === driverNameToReplace);
    if (!driverToReplace) return false;
    
    // Move replaced driver to free agency (release)
    this.drivers = this.drivers.filter(d => d.name !== driverNameToReplace);
    
    // Promote reserve
    const reserve = this.reserveDriver;
    reserve.contractType = 'race';
    reserve.driverRole = this.drivers.length === 0 ? 'lead' : 'second';
    reserve.roleLabel = 'Race Driver';
    reserve.salary = Math.max(6, reserve.salary * 2);
    reserve.careerTimeline.unshift({ seasonYear: globalState.season.year || 1, event: 'Race Seat', detail: 'Promoted to active Race Seat' });
    
    this.drivers.push(reserve);
    this.reserveDriver = null;
    return true;
  }
  
  loanOutAcademyDriver(academyDriver, destination, globalState) {
    const idx = globalState.academy.prospects.findIndex(d => d.name === academyDriver.name);
    if (idx !== -1) {
      globalState.academy.prospects.splice(idx, 1);
      academyDriver.loanStatus = { destination: destination.id, series: destination.label, seasonYear: globalState.season.year || 1 };
      academyDriver.roleLabel = `On Loan (${destination.label})`;
      academyDriver.careerTimeline.unshift({ seasonYear: globalState.season.year || 1, event: 'Loaned Out', detail: `Sent on loan to ${destination.label}` });
      globalState.academy.loanedOut.push(academyDriver);
      return true;
    }
    return false;
  }
  
  releaseAcademyDriver(academyDriver, globalState) {
    const idx = globalState.academy.prospects.findIndex(d => d.name === academyDriver.name);
    if (idx !== -1) {
      globalState.academy.prospects.splice(idx, 1);
      return true;
    }
    return false;
  }
}
