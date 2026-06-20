/**
 * utils/classificationValidator.js
 * ────────────────────────────────
 * Diagnostic validation suite to assert the consistency and integrity of race classification data
 * across post-race screens, standings updates, and race history.
 */

export function validateFinalClassification(classification, standingsBefore, standingsAfter, historyRecord) {
  const errors = [];

  // 1. Assert classification is frozen
  if (!Object.isFrozen(classification)) {
    errors.push("Validation Error: finalClassification object is not frozen!");
  }
  if (!Object.isFrozen(classification.results)) {
    errors.push("Validation Error: finalClassification.results is not frozen!");
  }

  // 2. Validate classification results structure and sorting
  classification.results.forEach((entry, idx) => {
    if (!Object.isFrozen(entry)) {
      errors.push(`Validation Error: classification.results[${idx}] is not frozen!`);
    }
    if (entry.position !== idx + 1) {
      errors.push(`Validation Error: Entry at index ${idx} has position ${entry.position}, expected ${idx + 1}`);
    }
    // Check sorting consistency: finished cars should be sorted by time ascending
    if (idx > 0) {
      const prev = classification.results[idx - 1];
      if (!prev.retired && !entry.retired) {
        if (prev.time > entry.time) {
          errors.push(`Validation Error: Sorting mismatch between finished cars: P${prev.position} time ${prev.time} > P${entry.position} time ${entry.time}`);
        }
      }
      // Retired cars should be placed after active cars
      if (prev.retired && !entry.retired) {
        errors.push(`Validation Error: Retired car P${prev.position} is sorted before active car P${entry.position}`);
      }
    }
  });

  // 3. Validate History Record matches classification
  if (!historyRecord) {
    errors.push("Validation Error: History record is missing!");
  } else {
    if (historyRecord.driverResults.length !== classification.results.length) {
      errors.push(`Validation Error: History results count (${historyRecord.driverResults.length}) does not match classification count (${classification.results.length})`);
    } else {
      classification.results.forEach((entry) => {
        const histEntry = historyRecord.driverResults.find(hr => hr.name === entry.driver.name);
        if (!histEntry) {
          errors.push(`Validation Error: Driver ${entry.driver.name} in classification not found in history`);
        } else {
          if (histEntry.finishPos !== entry.position) {
            errors.push(`Validation Error: Driver ${entry.driver.name} finishPos mismatch. Classification: ${entry.position}, History: ${histEntry.finishPos}`);
          }
          if (histEntry.retired !== entry.retired) {
            errors.push(`Validation Error: Driver ${entry.driver.name} retired status mismatch. Classification: ${entry.retired}, History: ${histEntry.retired}`);
          }
        }
      });
    }
  }

  // 4. Validate Standings Update matches classification points
  const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  classification.results.forEach((entry, idx) => {
    const expectedPoints = entry.retired ? 0 : (POINTS[idx] || 0);
    const beforeDPoints = standingsBefore.drivers[entry.driver.name] || 0;
    const afterDPoints = standingsAfter.drivers[entry.driver.name] || 0;
    const actualDPointsGained = afterDPoints - beforeDPoints;

    if (actualDPointsGained !== expectedPoints) {
      errors.push(`Validation Error: Driver ${entry.driver.name} points update mismatch. Expected gain: ${expectedPoints}, Actual gain: ${actualDPointsGained}`);
    }
  });

  if (errors.length > 0) {
    console.error("❌ CLASSIFICATION VALIDATION FAILED:\n" + errors.join("\n"));
  } else {
    console.log("✅ CLASSIFICATION VALIDATION PASSED: All post-race results, standings, and history are perfectly in sync.");
  }

  return errors;
}
