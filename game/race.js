function getTeamPerformanceBonus(team) {
  return team.engineProfile?.effects?.performance || 0;
}

function getRaceBoost(team) {
  const effects = team.engineProfile?.effects || {};
  return (effects.raceBoost || 0) + (effects.paceBoost || 0) * 0.5;
}

export function simulateRace(teams, track, laps) {
  return teams.flatMap(t =>
    t.drivers.map(d => {
      let time = 0;
      for(let i=0;i<laps;i++){
        time += track.baseTime - (d.pace + getRaceBoost(t))*0.03 - (t.carPerformance + getTeamPerformanceBonus(t))*0.03 + Math.random();
      }
      return { driver:d, team:t, time };
    })
  ).sort((a,b)=>a.time-b.time);
}
