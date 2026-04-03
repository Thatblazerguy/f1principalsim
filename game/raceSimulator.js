function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lapVariance(driver, track, isWet) {
  const wetPenalty = isWet ? (100 - driver.wet) * 0.007 : 0;
  const consistencyNoise = (100 - driver.consistency) * 0.004;
  return Math.random() * (0.7 + consistencyNoise) + wetPenalty;
}

function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

function getRaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.raceBoost || 0) + (effects.paceBoost || 0) * 0.5;
}

function getRetirementModifier(team) {
  const engineModifier = team.engineProfile?.effects?.retirementModifier || 0;
  const reliabilityScore = team.specs?.reliability ?? 80;
  const reliabilityModifier = (85 - reliabilityScore) * 0.00008;
  return engineModifier + reliabilityModifier;
}

function pitStopLoss(driver, lap, totalLaps) {
  const tyreWear = clamp((lap / totalLaps) * (100 - driver.tyre), 0, 28);
  return 20 + tyreWear * 0.12 + Math.random() * 1.8;
}

export function simulateRaceEvent(teams, track, laps) {
  const isWet = Math.random() < 0.18;
  const safetyCarLap = Math.random() < 0.26 ? Math.floor(laps * (0.35 + Math.random() * 0.3)) : null;

  const finishers = teams.flatMap((team) =>
    team.drivers.map((driver) => {
      const baseLap =
        track.baseTime -
        (driver.pace + getRaceBoost(team)) * 0.024 -
        driver.racecraft * 0.015 -
        (team.carPerformance + getTeamPerformanceBonus(team)) * 0.03;

      let totalTime = 0;
      let retired = false;
      const plannedPitLap = Math.floor(laps * (0.45 + Math.random() * 0.2));

      for (let lap = 1; lap <= laps; lap++) {
        if (Math.random() < Math.max(0.0005, driver.errorChance() * 0.012 + getRetirementModifier(team))) {
          retired = true;
          break;
        }

        totalTime += baseLap + lapVariance(driver, track, isWet);

        if (lap === plannedPitLap) {
          totalTime += pitStopLoss(driver, lap, laps);
        }

        if (safetyCarLap && lap === safetyCarLap) {
          totalTime += 3 + Math.random() * 1.2;
        }
      }

      return {
        driver,
        team,
        time: totalTime,
        retired
      };
    })
  );

  return finishers.sort((a, b) => {
    if (a.retired !== b.retired) {
      return a.retired ? 1 : -1;
    }
    return a.time - b.time;
  });
}
