/**
 * Race balance report: runs many quick-sim races and prints how much of the
 * result comes from the car vs the driver.
 *   node scripts/race-balance-report.mjs [races=200]
 */
import { state, resetAiTeams } from '../state.js';
import { calendar } from '../data/calendar.js';
import { simulateRaceEvent } from '../game/raceSimulator.js';
import { analyseRace } from '../utils/racePace.js';

const N = Number(process.argv[2] || 200);
resetAiTeams();
const teams = state.aiTeams;
state.season = { ...(state.season || {}), year: 1, rules: { weather: true } };

const ovr = (t) => t.carPerformance ?? t.specs?.ovr;
const stats = new Map(); // driver -> {sum, n, wins, podiums, team, ovr, pace}
let spreadPct = 0, spreadN = 0, wet = 0, sc = 0, overtakes = 0, stops = 0, carsCount = 0;
const winnerCarRank = [];
let midPods = 0, midPodsWet = 0, dnfs = 0;

const rankedTeams = [...teams].sort((a, b) => ovr(b) - ovr(a)).map((t) => t.name);

for (let i = 0; i < N; i++) {
  const track = calendar[i % calendar.length];
  const { finishers, replayData } = simulateRaceEvent(teams, track, track.laps, null, {}, null, 'points');
  const isWetRace = replayData.weather === 'wet';
  if (isWetRace) wet++;
  if (replayData.scLaps.length) sc++;
  const a = analyseRace(finishers, replayData);
  if (a.ranked.length > 2) {
    spreadPct += a.ranked[a.ranked.length - 1].gapPct; spreadN++;
  }
  finishers.forEach((f, idx) => {
    const k = f.driver.name;
    if (!stats.has(k)) stats.set(k, { sum: 0, n: 0, wins: 0, podiums: 0, dnf: 0, team: f.team.name, ovr: ovr(f.team), pace: f.driver.pace });
    const s = stats.get(k);
    if (f.retired) { s.dnf++; dnfs++; return; }
    s.sum += idx + 1; s.n++;
    if (idx === 0) s.wins++;
    if (idx < 3) s.podiums++;
    if (idx < 3 && rankedTeams.indexOf(f.team.name) >= 4) { midPods++; if (isWetRace) midPodsWet++; }
    overtakes += f.overtakes || 0; stops += f.stops; carsCount++;
  });
  winnerCarRank.push(rankedTeams.indexOf(finishers[0].team.name) + 1);
}

const rows = [...stats.entries()].map(([name, s]) => ({ name, ...s, avg: s.sum / Math.max(1, s.n) })).sort((a, b) => a.avg - b.avg);
console.log(`\n${N} races · wet ${wet} · safety car ${sc} · avg field spread ${(spreadPct / spreadN).toFixed(2)}% · ${(overtakes / N).toFixed(1)} passes/race · ${(stops / carsCount).toFixed(2)} stops/car\n`);
console.log('Driver'.padEnd(24), 'Team'.padEnd(18), 'Car', 'Pace', ' AvgPos', 'Wins', 'Pods', 'DNF');
rows.forEach((r) => console.log(r.name.padEnd(24), r.team.padEnd(18), String(r.ovr).padStart(3), String(r.pace).padStart(4), r.avg.toFixed(2).padStart(7), String(r.wins).padStart(4), String(r.podiums).padStart(4), String(r.dnf).padStart(4)));

// Correlation of average finish with car OVR and driver pace (standardised regression)
const xs1 = rows.map((r) => r.ovr), xs2 = rows.map((r) => r.pace), ys = rows.map((r) => r.avg);
const z = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1; return a.map((v) => (v - m) / sd); };
const [a1, a2, b] = [z(xs1), z(xs2), z(ys)];
const dot = (p, q) => p.reduce((s, v, i) => s + v * q[i], 0) / p.length;
const r11 = dot(a1, a1), r22 = dot(a2, a2), r12 = dot(a1, a2), r1y = dot(a1, b), r2y = dot(a2, b);
const det = r11 * r22 - r12 * r12;
const beta1 = (r1y * r22 - r2y * r12) / det, beta2 = (r2y * r11 - r1y * r12) / det;
const tot = Math.abs(beta1) + Math.abs(beta2);
console.log(`\nShare of result explained — car: ${(Math.abs(beta1) / tot * 100).toFixed(0)}%  driver: ${(Math.abs(beta2) / tot * 100).toFixed(0)}%`);
const byRank = {}; winnerCarRank.forEach((r) => { byRank[r] = (byRank[r] || 0) + 1; });
console.log(`Midfield podiums (car rank 5+): ${midPods} (${midPodsWet} in the wet) · DNF rate ${(dnfs / (N * rows.length) * 100).toFixed(1)}% per car`);
console.log('Wins by car rank:', Object.entries(byRank).map(([k, v]) => `#${k}: ${v}`).join('  '));
