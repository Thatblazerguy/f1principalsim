import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";

function getEnginePaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.paceBoost || 0) + (effects.raceBoost || 0) * 0.4;
}

function practiceNoise(driver) {
  const c = driver.consistency ?? 80;
  const spread = 0.07 + ((100 - c) / 100) * 0.09;
  return (Math.random() - 0.5) * 2 * spread;
}

export function simulatePractice(teams, track, weekendContext) {
  return teams
    .flatMap((t) =>
      t.drivers.map((d) => ({
        driver: d,
        team: t,
        bestLap:
          (track.baseTime -
          (d.pace + getEnginePaceBoost(t)) * 0.032 -
          getTeamLapCredit(t, "practice") -
          getTeamPerformanceBonus(t) * 0.02) * (weekendContext?.drivers?.[d.name]?.finalModifier ?? 1.0) +
          practiceNoise(d) * 0.5,
      }))
    )
    .sort((a, b) => a.bestLap - b.bestLap);
}
