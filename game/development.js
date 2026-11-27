import { LOAN_DESTINATIONS } from "./academy.js";
import { academySeasonEnd } from "./academyEngine.js";
import { getCircuitProfile } from "../utils/devProjects.js";
import { getDevelopmentConvergenceMult } from "../utils/raceBalance.js";
import { constructorEntries } from "../utils/championshipModel.js";

/**
 * Helper to clamp values
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Process development for a single academy driver (both active academy and loaned).
 * Called at the end of every season.
 */
export function developAcademyDriver(driver, academy) {
  // Base chance of development relies heavily on driver's inherent development rate and age
  const ageFactor = Math.max(0.2, 1 - Math.max(0, driver.age - 21) * 0.15); // sharp drop off after 21
  const devRoll = Math.random() * 100;
  const willDevelop = devRoll < driver.developmentRate * ageFactor;

  if (!willDevelop) return false; // Stalled this year

  const isLoaned = driver.loanStatus !== null;
  const potentialHeadroom = Math.max(0, driver.potentialCeiling - driver.currentRating());
  
  if (potentialHeadroom <= 0) return false; // Maxed out

  // Development magnitude depends on facilities (if at academy) or loan series (if loaned)
  let devPoints = Math.max(1, Math.floor(Math.random() * 4) + 1); // 1-4 points to distribute

  if (!isLoaned) {
    const facilityAvg = (academy.facilities.simulator + academy.facilities.fitness + academy.facilities.coaching + academy.facilities.sportsPsychology) / 4;
    // Facilities multiplier (1.0 to 2.0 based on level 1-5)
    const facilityMult = 1 + ((facilityAvg - 1) * 0.25);
    devPoints = Math.round(devPoints * facilityMult);
  } else {
    // Loan series provides a fixed multiplier
    const dest = LOAN_DESTINATIONS.find(d => d.id === driver.loanStatus.destination);
    const loanMult = dest ? 1 + (dest.prestige / 10) : 1.2;
    devPoints = Math.round(devPoints * loanMult);
  }

  // Work ethic and professionalism (hidden traits) act as an extra multiplier
  const traitMult = ((driver.hiddenTraits?.workEthic || 50) + (driver.hiddenTraits?.professionalism || 50)) / 100;
  devPoints = Math.round(devPoints * traitMult);

  if (devPoints <= 0) return false;

  // Apply points to attributes
  // Favor attributes where there is room to grow, and specific ones based on loan dest or facilities
  const attributes = ['pace', 'quali', 'racecraft', 'consistency', 'tyre', 'wet'];
  let improved = false;

  for (let i = 0; i < devPoints; i++) {
    // Pick a random attribute, weighted towards lowest current stat
    let chosenAttr = attributes[Math.floor(Math.random() * attributes.length)];
    
    // Apply specific loan bonuses if applicable
    if (isLoaned) {
      const dest = LOAN_DESTINATIONS.find(d => d.id === driver.loanStatus.destination);
      if (dest && dest.devBonus) {
        const bonusKeys = Object.keys(dest.devBonus);
        if (Math.random() > 0.5 && bonusKeys.length > 0) {
           chosenAttr = bonusKeys[Math.floor(Math.random() * bonusKeys.length)];
        }
      }
    }

    // Apply specific facility bonuses if at academy
    if (!isLoaned) {
      if (academy.facilities.simulator > 3 && Math.random() > 0.7) chosenAttr = 'quali';
      if (academy.facilities.fitness > 3 && Math.random() > 0.7) chosenAttr = 'consistency';
      if (academy.facilities.coaching > 3 && Math.random() > 0.7) chosenAttr = 'racecraft';
    }

    // Ensure we don't exceed potential ceiling by too much on individual stats
    // A driver can have specific stats slightly higher than their overall ceiling
    if (driver[chosenAttr] < driver.potentialCeiling + 3) {
      driver[chosenAttr]++;
      improved = true;
    }
  }

  // Handle Morale change (success breeds happiness)
  driver.morale = clamp((driver.morale || 75) + 5, 0, 100);
  
  return improved;
}

/**
 * Process end-of-season logic for all academy drivers.
 * Handles development, aging, contract expiration, and loan returns.
 */
export function processSeasonDevelopment(state, { finalOrder = null, upcomingCalendar = null } = {}) {
  const currentYear = state.season?.year || 1;
  if (state.academy && state.academy.lastProcessedYear !== currentYear) {
    processAcademySeason(state, currentYear);
    state.academy.lastProcessedYear = currentYear;
  }

  // AI teams develop even when the player has no academy (this used to be
  // skipped by the early return above).
  processAiTeamDevelopment(state, finalOrder, upcomingCalendar);
}

/**
 * Academy prospects and loaned drivers: development, aging and contracts.
 * Contract ownership: this function is the ONLY place academy/loan contracts
 * tick down (once per season, guarded by academy.lastProcessedYear). Race and
 * reserve drivers on team rosters tick down in transferMarket.processMarketSeasonEnd.
 */
function processAcademySeason(state, currentYear) {
  if (!state.notifications) state.notifications = [];
  // Academies on the day-by-day model (game/academyEngine.js) do their season close there
  if (state.academy.devModel === 2) { academySeasonEnd(state, currentYear); return; }

  // Process active academy prospects
  if (state.academy.prospects) {
    // Work backward since we might remove drivers (contract expires)
    for (let i = state.academy.prospects.length - 1; i >= 0; i--) {
      const driver = state.academy.prospects[i];
      
      // Age up
      driver.age++;

      // Develop
      const improved = developAcademyDriver(driver, state.academy);
      if (!driver.careerTimeline) driver.careerTimeline = [];
      if (improved) {
        driver.careerTimeline.unshift({ seasonYear: currentYear, event: 'Developed', detail: 'Attributes improved over the season.' });
      } else {
        driver.morale = clamp((driver.morale || 75) - 5, 0, 100);
        driver.careerTimeline.unshift({ seasonYear: currentYear, event: 'Stalled', detail: 'Failed to develop this season.' });
      }

      // Contracts
      if (driver.contractYearsRemaining > 0) {
        driver.contractYearsRemaining--;
      }

      // If contract is 0, they leave the academy unless renewed (auto-release for now, player must promote)
      if (driver.contractYearsRemaining === 0) {
         state.academy.prospects.splice(i, 1);
         // (In a fuller game, they would enter the free agent pool. Here they just disappear to keep the pool clean)
         state.notifications.unshift({ day: state.season.currentDay, message: `${driver.name} has left the academy (Contract Expired).` });
      }
    }
  }

  // Process loaned out drivers
  if (state.academy.loanedOut) {
    for (let i = state.academy.loanedOut.length - 1; i >= 0; i--) {
      const driver = state.academy.loanedOut[i];
      
      // Age up
      driver.age++;

      // Develop
      developAcademyDriver(driver, state.academy);

      // Contracts
      if (driver.contractYearsRemaining > 0) {
        driver.contractYearsRemaining--;
      }

      // Check loan expiry (loans are 1 year)
      if (driver.loanStatus && driver.loanStatus.seasonYear === currentYear) {
         driver.loanStatus = null;
         driver.driverRole = 'academy';
         driver.roleLabel = 'Academy Prospect';
         if (!driver.careerTimeline) driver.careerTimeline = [];
         driver.careerTimeline.unshift({ seasonYear: currentYear, event: 'Loan Ended', detail: 'Returned to academy.' });
         
         // Move back to academy
         state.academy.loanedOut.splice(i, 1);
         if (driver.contractYearsRemaining > 0) {
           state.academy.prospects.push(driver);
           state.notifications.unshift({ day: state.season.currentDay, message: `${driver.name} has returned from their loan.` });
         } else {
           state.notifications.unshift({ day: state.season.currentDay, message: `${driver.name}'s contract expired while on loan.` });
         }
      }
    }
  }
}

/**
 * Process end-of-season logic for AI Teams.
 * Handles dynamic upgrading of AI facilities and staff based on their season performance.
 */
/** Facility upgrade chance by final constructors' position (1-based; 0 = unknown). */
export function getAiUpgradeChance(standingPosition) {
  if (standingPosition > 0 && standingPosition <= 3) return 0.8;
  if (standingPosition > 3 && standingPosition <= 7) return 0.5;
  return 0.3;
}

/**
 * Raise a spec with diminishing returns. A spec cannot be pushed above
 * min(99, carPerformance + 5) by offseason work, so specs stay in step with OVR.
 */
function bumpSpec(team, spec, amount) {
  const cur = team.specs[spec];
  const ovr = Number(team.carPerformance) || Number(team.specs.ovr) || 85;
  const ceiling = Math.max(Math.min(cur, 99), Math.min(99, ovr + 5));
  const gain = amount * getDevelopmentConvergenceMult(cur);
  team.specs[spec] = Math.round(clamp(cur + gain, 40, ceiling) * 10) / 10;
}

/**
 * Process end-of-season logic for AI Teams.
 * Handles dynamic upgrading of AI facilities and staff based on their season performance.
 * @param {object} state
 * @param {string[]|null} finalOrder constructor names in final official order
 *   (count-back included) for the season just finished. Pass it: by the time
 *   this runs the live standings may already be reset. Without it, the order
 *   is taken from the championship model.
 * @param {Array|null} upcomingCalendar next season's calendar (track weighting)
 */
export function processAiTeamDevelopment(state, finalOrder = null, upcomingCalendar = null) {
  if (!state.aiTeams || !state.aiTeams.length) return;

  const order = finalOrder?.length ? finalOrder : constructorEntries(state).map(([name]) => name);

  state.aiTeams.forEach((aiTeam) => {
    // Determine budget/income abstractly based on championship finish
    const standingPosition = order.indexOf(aiTeam.name) + 1;
    const upgradeChance = getAiUpgradeChance(standingPosition);

    // Facility upgrades
    if (Math.random() < upgradeChance) {
      if (!aiTeam.finance) aiTeam.finance = { facilities: {} };
      if (!aiTeam.finance.facilities) aiTeam.finance.facilities = {};
      
      const facilityIds = ['windTunnel', 'cfdDepartment', 'simulator', 'composites', 'powerUnitLab', 'reliabilityCentre', 'vehicleDynamics', 'pitCrewTraining'];
      const targetFacility = facilityIds[Math.floor(Math.random() * facilityIds.length)];
      
      const currentLevel = aiTeam.finance.facilities[targetFacility]?.level || 1;
      if (currentLevel < 5) {
        aiTeam.finance.facilities[targetFacility] = { level: currentLevel + 1 };
        
        // Apply abstract performance boost
        if (aiTeam.specs) {
          const specMap = { windTunnel: 'aero', cfdDepartment: 'aero', simulator: 'chassis', composites: 'chassis', powerUnitLab: 'engine', reliabilityCentre: 'reliability', vehicleDynamics: 'chassis', pitCrewTraining: 'operations' };
          const spec = specMap[targetFacility];
          if (spec && aiTeam.specs[spec]) bumpSpec(aiTeam, spec, 2);
        }
      }
    }

    // Staff progression abstractly represented by small random boosts to overall specs if they didn't upgrade facilities
    if (Math.random() > upgradeChance && aiTeam.specs) {
      const specsList = Object.keys(aiTeam.specs);
      
      // Target upcoming tracks
      const upcomingTracks = upcomingCalendar || state.season?.calendar?.slice(state.season?.round || 0) || [];
      // calendar entries are full objects {name, circuit, ...}; extract the circuit name
      const trackProfiles = upcomingTracks.map(t => getCircuitProfile(typeof t === 'string' ? t : t?.circuit));
      const weights = { aero: 1, chassis: 1, engine: 1, reliability: 1 };
      trackProfiles.forEach(p => {
        if (p.type === 'Power') { weights.engine += 2; weights.aero += 1; }
        else if (p.type === 'Highspeed') { weights.aero += 2; weights.engine += 1; }
        else if (p.type === 'Street') { weights.chassis += 2; }
        else if (p.type === 'Technical') { weights.chassis += 1; weights.aero += 1; }
      });
      
      // Weighted random selection
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let targetSpec = 'aero';
      for (const [spec, weight] of Object.entries(weights)) {
        if (rand < weight) { targetSpec = spec; break; }
        rand -= weight;
      }
      
      if (aiTeam.specs[targetSpec]) {
        bumpSpec(aiTeam, targetSpec, 1);
      } else {
        const randomSpec = specsList.filter((k) => k !== 'ovr')[Math.floor(Math.random() * Math.max(1, specsList.length - 1))];
        if (randomSpec && typeof aiTeam.specs[randomSpec] === 'number') bumpSpec(aiTeam, randomSpec, 1);
      }
    }
  });
}
