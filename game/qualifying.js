function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

function getQualifyingBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.qualifyingBoost || 0) + (effects.qualiBoost || 0);
}

export function simulateQualifying(teams, track) {
  const grid = teams.flatMap(t =>
    t.drivers.map(d => ({
      driver:d,
      team:t,
      lap: track.baseTime - (d.quali + getQualifyingBoost(t))*0.04 - (t.carPerformance + getTeamPerformanceBonus(t))*0.03 + Math.random()*2
    }))
  ).sort((a,b)=>a.lap-b.lap);

  return { grid };
}
