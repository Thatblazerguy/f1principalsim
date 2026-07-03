import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HUB, glassCard, pill } from '../HubLayout.tsx';
import { Target, Flag, Clock, Zap, Activity, Users, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { RACE_OBJECTIVES } from '../../screens/weekend.tsx';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LapTimeChart = ({ results }) => {
  // If there are no results or no lapTimes, fallback
  if (!results || results.length === 0 || !results[0].lapTimes || results[0].lapTimes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
        <p style={{ color: HUB.textMuted, fontSize: '13px' }}>Lap-by-lap telemetry unavailable for this session.</p>
      </div>
    );
  }

  // Find max laps
  const maxLaps = Math.max(...results.map(r => r.lapTimes ? r.lapTimes.length : 0));
  const labels = Array.from({ length: maxLaps }, (_, i) => `L${i + 1}`);

  // Distinct color palette for 24 drivers
  const palette = [
    '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6',
    '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ffffff', '#000000', '#10b981', '#3b82f6'
  ];

  const datasets = results.map((res, idx) => {
    // Some drivers might have retired early
    const data = Array.from({ length: maxLaps }, (_, i) => {
      if (res.lapTimes && i < res.lapTimes.length) {
         return res.lapTimes[i];
      }
      return null;
    });

    const isPlayer = res.team.isPlayer || res.team.name === (results.find(x => x.team.name)?.team.name);

    return {
      label: res.driver.name,
      data,
      borderColor: isPlayer ? HUB.accent : palette[idx % palette.length],
      backgroundColor: 'transparent',
      borderWidth: isPlayer ? 3 : 1.5,
      pointRadius: 0, 
      pointHoverRadius: 4,
      tension: 0.2,
      hidden: !isPlayer && idx > 5, // Show player and top 5 by default, hide rest to avoid initial clutter
    };
  });

  const data = { labels, datasets };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#ccc',
          font: { size: 10 },
          boxWidth: 12,
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
             return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}s`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'Lap Time (s)', color: '#888' },
        ticks: { color: '#888' },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      x: {
        ticks: { color: '#888', maxTicksLimit: 20 },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  return (
    <div style={{ height: '500px', width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px' }}>
      <Line data={data} options={options as any} />
    </div>
  );
};

// \u2500\u2500 Synthetic Lap Time Generator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Generates realistic per-lap times when the engine didn't record them live.
// Uses the driver's total race time and models: tyre deg, pit stops, SC, formation lap.
function generateSyntheticLapTimes(
  totalRaceTime: number,
  totalLaps: number,
  stops: number,
  gridPos: number,
  retired: boolean,
  retiredLap?: number
): number[] {
  if (!totalRaceTime || !totalLaps || totalRaceTime >= 99000) return [];

  const actualLaps = retired && retiredLap ? retiredLap : totalLaps;
  if (actualLaps < 1) return [];

  // Estimate pit stop loss (each stop ~25s in the lap time)
  const pitLoss = (stops || 1) * 25;
  // Total clean racing time (subtract pit loss and standing start penalty)
  const standingStartPenalty = 1.5 + gridPos * 0.12;
  const cleanTime = totalRaceTime - pitLoss - standingStartPenalty;

  // Base lap time from clean time
  const baseLap = cleanTime / actualLaps;

  // Build lap times with realistic model:
  //  - Lap 1: +standing start penalty
  //  - Tyre deg: ~0.08s/lap accumulation within a stint, reset on pit
  //  - Pit laps (in-lap/out-lap): +25s delta on in-lap
  //  - Small random variance ±0.4s
  const stintBoundaries: number[] = [];
  if (stops > 0) {
    for (let s = 1; s <= stops; s++) {
      stintBoundaries.push(Math.round(actualLaps * (s / (stops + 1))));
    }
  }

  const lapTimes: number[] = [];
  // Seeded pseudo-random for repeatability per driver
  let seed = totalRaceTime * 31 + gridPos * 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  let lapInStint = 0;
  for (let lap = 1; lap <= actualLaps; lap++) {
    const isPitLap = stintBoundaries.includes(lap);
    const isOutLap = stintBoundaries.includes(lap - 1);
    const isLap1 = lap === 1;

    lapInStint++;
    if (isPitLap) lapInStint = 0;

    // Tyre degradation accumulates within stint
    const tyreDeg = lapInStint * 0.07;
    // Small variance
    const variance = (rand() - 0.5) * 0.8;

    let lapTime = baseLap + tyreDeg + variance;

    // Modifiers
    if (isLap1) lapTime += standingStartPenalty;
    if (isPitLap) lapTime += 22 + rand() * 3;    // in-lap: pit stop delta
    if (isOutLap) lapTime += 1.5;                 // out-lap: cold tyres

    lapTimes.push(Math.max(baseLap * 0.97, lapTime));
  }

  return lapTimes;
}

// \u2500\u2500 True Race Pace Calculation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Mirrors real F1 analyst methodology:
//   1. Filter out lap 1 (standing start), in-laps, out-laps, SC/VSC laps (outliers)
//   2. Take the median of clean laps (robust vs mean to extreme values)
//   3. Apply a small tyre-normalisation factor per stint
function calculateTrueRacePace(lapTimes: number[] | undefined, stops: number, totalLaps: number) {
  if (!lapTimes || lapTimes.length < 3) return null;

  // 1. Exclude lap 1 (formation / standing start — always very slow)
  let cleanLaps = lapTimes.slice(1);

  // 2. Identify in-laps & out-laps around pit stops (approx: every 1/stops+1 of race)
  if (stops > 0) {
    const stintLen = Math.floor(cleanLaps.length / (stops + 1));
    const pitLaps = Array.from({ length: stops }, (_, i) => ((i + 1) * stintLen - 1));
    cleanLaps = cleanLaps.filter((_, i) => {
      return !pitLaps.some(pl => Math.abs(i - pl) <= 1); // exclude 1 lap either side
    });
  }

  if (cleanLaps.length === 0) return null;

  // 3. Remove statistical outliers: any lap > 107% of rolling mean is an SC/VSC/yellow flag lap
  const mean = cleanLaps.reduce((a, b) => a + b, 0) / cleanLaps.length;
  const threshold = mean * 1.07;
  const filteredLaps = cleanLaps.filter(l => l <= threshold);
  if (filteredLaps.length === 0) return null;

  // 4. Median of remaining laps
  const sorted = [...filteredLaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // 5. Tyre normalisation: adjust pace upward slightly for multi-stop drivers
  const normalised = median - (Math.max(0, stops - 1) * 0.08);

  return {
    median,
    normalised,
    cleanLapCount: filteredLaps.length,
    filteredLapCount: lapTimes.length - filteredLaps.length,
    fastestClean: Math.min(...filteredLaps),
    slowestClean: Math.max(...filteredLaps),
    consistencyScore: Math.max(0, 100 - (Math.max(...filteredLaps) - Math.min(...filteredLaps)) * 8)
  };
}

// \u2500\u2500 Race Pace Analytics Panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const RacePaceAnalytics = ({ results, grid, playerResults, track }) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(() => {
    const playerNames = playerResults.map(({ r }) => r.driver.name);
    const top5 = results.slice(0, 5).map(r => r.driver.name);
    return [...new Set([...playerNames, ...top5])];
  });

  // ── Step 1: Determine race length ─────────────────────────────────────────
  // Use track.laps as authoritative source; fall back to longest lapTimes array or 58
  const canonicalLaps: number = (track?.laps) ||
    results.reduce((best, r) => Math.max(best, r.lapTimes ? r.lapTimes.length : 0), 0) ||
    58;

  // ── Step 2: Enrich every result with synthetic lapTimes if missing/empty ───
  const enrichedResults = results.map((r, idx) => {
    const hasRealLaps = r.lapTimes && r.lapTimes.length >= 3 &&
      r.lapTimes[0] > 30; // sanity: must be >30s to be a real lap time

    if (hasRealLaps) return { ...r, _synthetic: false };

    const gridPos = grid ? (grid.findIndex(g => g.driver.name === r.driver.name) + 1) : (idx + 1);
    // Retired cars have time=99999 — estimate their total time from winner's time with gap
    const winnerTime = results[0]?.time || 5400;
    const totalTime = r.retired
      ? winnerTime * (0.3 + (idx / results.length) * 0.5)   // DNF drivers: estimate partial race
      : (r.time > 0 && r.time < 99000 ? r.time : 5400);    // Finishers: use actual race time
    const retiredLap = r.retired ? Math.max(1, Math.floor(canonicalLaps * (0.25 + Math.random() * 0.5))) : undefined;

    const syntheticLaps = generateSyntheticLapTimes(
      totalTime,
      canonicalLaps,
      r.stops || 1,
      gridPos,
      !!r.retired,
      retiredLap
    );

    return { ...r, lapTimes: syntheticLaps, _synthetic: true };
  });

  const totalLaps = Math.max(...enrichedResults.map(r => r.lapTimes ? r.lapTimes.length : 0));

  // ── Step 3: Compute race pace for all drivers ──────────────────────────────
  const paceData = enrichedResults.map((r, finishPos) => {
    const pace = calculateTrueRacePace(r.lapTimes, r.stops || 0, totalLaps);
    const isPlayer = playerResults.some(({ r: pr }) => pr.driver.name === r.driver.name);
    return { r, finishPos: finishPos + 1, pace, isPlayer };
  }).filter(d => d.pace !== null);

  // Sort by normalised pace (fastest first)
  const paceSorted = [...paceData].sort((a, b) => (a.pace!.normalised) - (b.pace!.normalised));
  const fastestPace = paceSorted[0]?.pace?.normalised ?? 90;

  // ── Step 4: Build Chart.js datasets ───────────────────────────────────────
  const labels = Array.from({ length: totalLaps }, (_, i) => `L${i + 1}`);
  const palette = [
    '#e6194B','#3cb44b','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6',
    '#bfef45','#469990','#dcbeff','#9A6324','#800000','#aaffc3',
    '#808000','#ffd8b1','#000075','#a9a9a9','#ff6b6b','#ffa94d','#69db7c',
    '#74c0fc','#e599f7','#a9e34b','#ffec99'
  ];

  const datasets = enrichedResults.map((res, idx) => {
    const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
    const isSelected = selectedDrivers.includes(res.driver.name);
    return {
      label: res.driver.name,
      data: Array.from({ length: totalLaps }, (_, i) =>
        res.lapTimes && i < res.lapTimes.length ? res.lapTimes[i] : null
      ),
      borderColor: isPlayer ? HUB.accent : palette[idx % palette.length],
      backgroundColor: 'transparent',
      borderWidth: isPlayer ? 3 : 1.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.25,
      spanGaps: false,
      hidden: !isSelected,
    };
  });

  const chartData = { labels, datasets };
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false, axis: 'x' as const },
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#aaa',
          font: { size: 10, family: "'Inter', sans-serif" },
          boxWidth: 10,
          usePointStyle: true,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10,10,20,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#ccc',
        callbacks: {
          title: (items) => `Lap ${items[0].label}`,
          label: (ctx) => {
            const v = ctx.parsed.y;
            const mins = Math.floor(v / 60);
            const secs = (v % 60).toFixed(3);
            return ` ${ctx.dataset.label}: ${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
          }
        }
      }
    },
    scales: {
      y: {
        title: { display: true, text: 'Lap Time (s)', color: '#666', font: { size: 11 } },
        ticks: {
          color: '#888',
          callback: (val) => {
            const m = Math.floor(Number(val) / 60);
            const s = (Number(val) % 60).toFixed(1);
            return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
          }
        },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      x: {
        ticks: { color: '#666', maxTicksLimit: 15, font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };

  const posGained = playerResults.reduce((acc, { r, pos }) => {
    const qIdx = grid?.findIndex(g => g.driver.name === r.driver.name) ?? -1;
    return qIdx >= 0 ? acc + ((qIdx + 1) - pos) : acc;
  }, 0);

  const playerBestPaceEntry = paceSorted.find(d => d.isPlayer);
  const playerPaceRank = paceSorted.findIndex(d => d.isPlayer) + 1;

  const fmtTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(3);
    return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Fastest Race Pace</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', fontFamily: HUB.fontMono }}>{fmtTime(fastestPace)}</div>
          <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '4px' }}>{paceSorted[0]?.r.driver.name}</div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px 12px', border: playerPaceRank > 0 && playerPaceRank <= 5 ? `1px solid ${HUB.accent}44` : undefined }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Your Pace Rank</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: playerPaceRank <= 5 ? '#10b981' : playerPaceRank <= 10 ? '#f59e0b' : '#ef4444', fontFamily: HUB.fontMono }}>
            {playerPaceRank > 0 ? `P${playerPaceRank}` : '–'}
          </div>
          <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '4px' }}>
            {playerBestPaceEntry ? `+${(playerBestPaceEntry.pace!.normalised - fastestPace).toFixed(3)}s vs fastest` : 'No data'}
          </div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Positions Gained</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: posGained > 0 ? '#10b981' : posGained < 0 ? '#ef4444' : '#fff', fontFamily: HUB.fontMono }}>
            {posGained > 0 ? '+' : ''}{posGained}
          </div>
          <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '4px' }}>vs Qualifying Grid</div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px 12px' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Clean Laps Analysed</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>
            {playerBestPaceEntry?.pace?.cleanLapCount ?? totalLaps}
          </div>
          <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '4px' }}>
            {playerBestPaceEntry ? `${playerBestPaceEntry.pace!.filteredLapCount} outliers removed` : '(your driver)'}
          </div>
        </div>
      </div>

      {/* Main Chart.js Chart */}
      <div style={{ ...glassCard() }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={16} color={HUB.accent} />
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Race Pace Chart — All 24 Drivers
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: HUB.textMuted }}>
                Click legend to toggle drivers · Lap 1 & pit stop laps excluded from pace calcs
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSelectedDrivers(results.map(r => r.driver.name))}
              style={{ padding: '5px 12px', fontSize: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', color: '#ccc', cursor: 'pointer' }}
            >Show All</button>
            <button
              onClick={() => setSelectedDrivers(playerResults.map(({ r }) => r.driver.name))}
              style={{ padding: '5px 12px', fontSize: '10px', background: 'rgba(225,6,0,0.15)', border: `1px solid ${HUB.accent}55`, borderRadius: '4px', color: HUB.accent, cursor: 'pointer' }}
            >My Team Only</button>
          </div>
        </div>
        <div style={{ height: '460px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Per-Driver Pace Ranking Table */}
      <div style={{ ...glassCard(), padding: '0' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={14} color={HUB.accent} />
          <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Race Pace Rankings</h3>
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: HUB.textMuted }}>Median · Tyre-Normalised · Outliers Removed</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 36px 2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 16px', fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div>Rank</div>
          <div>Fin</div>
          <div>Driver</div>
          <div>True Pace</div>
          <div>Gap</div>
          <div>Consistency</div>
          <div>Clean Laps</div>
        </div>
        {paceSorted.map((d, rankIdx) => {
          const gap = d.pace!.normalised - fastestPace;
          const isPlayer = d.isPlayer;
          const cs = d.pace!.consistencyScore;
          const consistColor = cs >= 80 ? '#10b981' : cs >= 60 ? '#f59e0b' : '#ef4444';
          return (
            <div key={d.r.driver.name} style={{ display: 'grid', gridTemplateColumns: '36px 36px 2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '10px 16px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', background: isPlayer ? 'rgba(225,6,0,0.08)' : 'transparent', transition: 'background 0.2s' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: rankIdx === 0 ? '#10b981' : '#fff' }}>P{rankIdx + 1}</div>
              <div style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>P{d.finishPos}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={getDriverHeadshotUrl(d.r.driver)} alt={d.r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isPlayer ? HUB.accent : '#fff' }}>{d.r.driver.name}</div>
                  <div style={{ fontSize: '10px', color: HUB.textMuted }}>{d.r.team.name}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: rankIdx === 0 ? '#10b981' : '#fff' }}>{fmtTime(d.pace!.normalised)}</div>
              <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: gap < 0.05 ? '#10b981' : gap < 0.5 ? '#f59e0b' : '#ef4444' }}>
                {gap < 0.001 ? '—' : `+${gap.toFixed(3)}s`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                  <div style={{ width: `${cs}%`, height: '100%', backgroundColor: consistColor, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '10px', color: consistColor, fontFamily: HUB.fontMono, minWidth: '30px' }}>{Math.round(cs)}%</span>
              </div>
              <div style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>{d.pace!.cleanLapCount} / {d.r.lapTimes?.length ?? 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DetailedRaceReport = ({ results, grid, objectiveId, state, track, replayData }) => {
  const [activeTab, setActiveTab] = useState('summary');
  
  const objDef = RACE_OBJECTIVES.find(o => o.id === objectiveId) || RACE_OBJECTIVES[2];
  
  let targetPos = 10;
  if (objectiveId === 'win') targetPos = 1;
  else if (objectiveId === 'podium') targetPos = 3;
  else if (objectiveId === 'conservative') targetPos = 12;
  else if (objectiveId === 'gamble') targetPos = 5;

  const playerResults = results.map((r, i) => ({ r, pos: i+1 })).filter(x => x.r.team?.name === state.team?.name);
  const bestPos = playerResults.length > 0 ? playerResults[0].pos : 20;

  const achieved = bestPos <= targetPos;
  const score = achieved ? Math.min(100, 80 + (targetPos - bestPos) * 10) : Math.max(10, 80 - (bestPos - targetPos) * 15);

  const tabs = [
    { id: 'summary', label: 'Race Summary' },
    { id: 'classification', label: 'Final Classification' },
    { id: 'analytics', label: 'Pace & Analytics' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
      
      {/* Header */}
      <div style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontFamily: HUB.fontWide, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Detailed Race Report
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: HUB.textMuted }}>{track?.name} — Post-Race Analysis & Evaluation</p>
         </div>
         <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Race Rating</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444', fontFamily: HUB.fontMono }}>
                {(score / 10).toFixed(1)} <span style={{ fontSize: '12px', color: HUB.textMuted }}>/ 10</span>
              </div>
            </div>
         </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
        {tabs.map(t => (
          <button 
             key={t.id} 
             onClick={() => setActiveTab(t.id)}
             style={{
               padding: '8px 16px',
               backgroundColor: activeTab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
               border: 'none',
               borderRadius: '4px',
               color: activeTab === t.id ? '#fff' : HUB.textMuted,
               fontSize: '12px',
               fontWeight: 'bold',
               cursor: 'pointer',
               textTransform: 'uppercase',
               letterSpacing: '0.05em'
             }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
             
             {/* Objective Review */}
             <div style={{ backgroundColor: 'rgba(10,10,10,0.85)', border: `1px solid ${achieved ? '#10b981' : '#ef4444'}`, borderRadius: '8px', padding: '24px', display: 'flex', gap: '32px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Target size={18} color={HUB.accent} />
                    <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Objective Review</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{objDef.label}</div>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: HUB.textMuted, lineHeight: '1.5' }}>
                    {achieved 
                      ? "The strategic targets were met successfully. The data shows strong execution matching our pre-race simulations."
                      : "We fell short of our strategic targets. We need to review the telemetry to understand where we lost time."}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '32px', paddingLeft: '32px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Result</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: achieved ? '#10b981' : '#ef4444' }}>{achieved ? 'ACHIEVED' : 'FAILED'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Target</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono }}>P{targetPos}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Actual</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: achieved ? '#10b981' : '#ef4444', fontFamily: HUB.fontMono }}>P{bestPos}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Strategy Score</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono }}>{score}%</div>
                  </div>
                </div>
             </div>

             {/* Engineer Report */}
             <div style={{ ...glassCard(), display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color={HUB.accent} />
                  <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Race Engineer Summary</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                   {playerResults.map(({r, pos}, i) => (
                     <div key={i} style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                         <img src={getDriverHeadshotUrl(r.driver)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt={r.driver.name} />
                         <div>
                           <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{r.driver.name}</div>
                           <div style={{ fontSize: '11px', color: HUB.textMuted }}>Finished P{pos}</div>
                         </div>
                       </div>
                       <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', margin: 0 }}>
                         {r.retired 
                           ? `Unfortunately we had to retire the car. Reliability cost us heavily today.` 
                           : (pos <= targetPos 
                                ? `Excellent drive. Managed the pace perfectly and executed the strategy flawlessly to hit our target.` 
                                : `Struggled to maintain the required delta. Tyre deg was slightly higher than expected, leaving us exposed.`)}
                       </p>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'classification' && (
          <div style={{ ...glassCard(), padding: '0' }}>
             {/* Simple Table */}
             <div style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr', gap: '16px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
               <div>Pos</div>
               <div style={{ textAlign: 'center' }}>+/-</div>
               <div>Driver</div>
               <div>Team</div>
               <div>Gap</div>
               <div>Stops</div>
               <div>Status</div>
             </div>
             {results.map((r, i) => {
                const isPlayerDriver = state.team && r.team && r.team.name === state.team.name;
                const status = r.retired ? "DNF" : (i === 0 ? "Winner" : `+${(r.time - results[0].time).toFixed(3)}s`);
                
                // Calculate position diff from grid
                let diffStr = "-";
                let diffColor = HUB.textMuted;
                if (grid) {
                   const qIdx = grid.findIndex(g => g.driver.name === r.driver.name);
                   if (qIdx >= 0) {
                      const diff = (qIdx + 1) - (i + 1);
                      if (diff > 0) {
                         diffStr = `+${diff}`;
                         diffColor = '#10b981';
                      } else if (diff < 0) {
                         diffStr = `${diff}`;
                         diffColor = '#ef4444';
                      }
                   }
                }

                return (
                  <div key={r.driver.name} style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr', gap: '16px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', background: isPlayerDriver ? 'rgba(225,6,0,0.1)' : 'transparent' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{i + 1}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: diffColor, fontFamily: HUB.fontMono, textAlign: 'center' }}>{diffStr}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <img src={getDriverHeadshotUrl(r.driver)} alt={r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                       <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{r.driver.name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: HUB.textMuted }}>{r.team.name}</div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.retired ? '#ef4444' : '#fff' }}>{status}</div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff' }}>{r.stops || (r.retired ? '-' : '1')}</div>
                    <div>
                      {r.retired ? (
                        <span style={{ ...pill(false), backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: '#ef4444' }}>RETIRED</span>
                      ) : (
                        <span style={{ ...pill(false), color: HUB.textMuted }}>FINISHED</span>
                      )}
                    </div>
                  </div>
                );
             })}
          </div>
        )}

        {activeTab === 'analytics' && (
          <RacePaceAnalytics results={results} grid={grid} playerResults={playerResults} track={track} />
        )}
      </motion.div>
    </div>
  );
};
