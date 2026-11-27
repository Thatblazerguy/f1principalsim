export const POINTS=[25,18,15,12,10,8,6,4,2,1];

/** Add a race's points to the standings. `table` is the points scale (Grand Prix by default, or sprint). */
export function updateStandings(res, s, table = POINTS) {
  res.forEach(r => {
    s.drivers[r.driver.name] = s.drivers[r.driver.name] || 0;
    s.teams[r.team.name] = s.teams[r.team.name] || 0;
  });

  // Retired cars score nothing unless classified (90% distance), matching the race record (game/raceHistory.js).
  res.slice(0, table.length).forEach((r,i)=>{
    if (r.retired && !r.classified) return;
    s.drivers[r.driver.name] += table[i];
    s.teams[r.team.name] += table[i];
  });
  return s;
}
