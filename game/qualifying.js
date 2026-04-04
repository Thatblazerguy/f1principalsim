import { getTeamLapCredit, getTeamPerformanceBonus } from "../utils/simTeam.js";

function getQualifyingBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.qualifyingBoost || 0) + (effects.qualiBoost || 0);
}

/** Small symmetric noise so grid order stays driver+car driven (was 0–2s uniform, enough to invert the field). */
function qualiNoise(driver) {
  const c = driver.consistency ?? 80;
  const spread = 0.06 + ((100 - c) / 100) * 0.07;
  return (Math.random() - 0.5) * 2 * spread;
}

export function simulateQualifying(teams, track) {
  const grid = teams
    .flatMap((t) =>
      t.drivers.map((d) => ({
        driver: d,
        team: t,
        lap:
          track.baseTime -
          (d.quali + getQualifyingBoost(t)) * 0.045 -
          getTeamLapCredit(t, "quali") -
          getTeamPerformanceBonus(t) * 0.022 +
          qualiNoise(d),
      }))
    )
    .sort((a, b) => a.lap - b.lap);

  return { grid };
}
