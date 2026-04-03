export const POINTS=[25,18,15,12,10,8,6,4,2,1];

export function updateStandings(res, s) {
  res.forEach(r => {
    s.drivers[r.driver.name] = s.drivers[r.driver.name] || 0;
    s.teams[r.team.name] = s.teams[r.team.name] || 0;
  });

  res.slice(0,10).forEach((r,i)=>{
    s.drivers[r.driver.name] += POINTS[i];
    s.teams[r.team.name] += POINTS[i];
  });
  return s;
}
