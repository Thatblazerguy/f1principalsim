import { LOAN_DESTINATIONS } from "./academy.js";

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
export function processSeasonDevelopment(state) {
  if (!state.academy) return;

  const currentYear = state.season.year || 1;

  // Process active academy prospects
  if (state.academy.prospects) {
    // Work backward since we might remove drivers (contract expires)
    for (let i = state.academy.prospects.length - 1; i >= 0; i--) {
      const driver = state.academy.prospects[i];
      
      // Age up
      driver.age++;

      // Develop
      const improved = developAcademyDriver(driver, state.academy);
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
