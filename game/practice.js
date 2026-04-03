function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

function getEnginePaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.paceBoost || 0) + (effects.raceBoost || 0) * 0.4;
}

export function simulatePractice(teams, track) {
  return teams.flatMap(t =>
    t.drivers.map(d => ({
      driver: d,
      team: t,
      bestLap: track.baseTime - (d.pace + getEnginePaceBoost(t)) * 0.03 - (t.carPerformance + getTeamPerformanceBonus(t)) * 0.02 + Math.random()*2
    }))
  ).sort((a,b)=>a.bestLap-b.bestLap);
}
