import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HUB, glassCard, pill } from '../HubLayout.tsx';
import { Target, Flag, Clock, Zap, Activity, Users, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { RACE_OBJECTIVES, evaluateObjective } from '../../utils/raceObjectives.js';

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

// ── Synthetic Lap Time Generator ──────────────────────────────────────────
// Generates realistic per-lap times when the engine didn't record them live.
// Returns:
//   lapTimes      - raw times including pit stop deltas (used for race result calculations)
//   cleanLapTimes - on-track pace only, with pit delta stripped (used for the pace graph)
//   pitLaps       - set of lap numbers that were pit-in laps
//   outLaps       - set of lap numbers that were out-laps (cold tyres)
function generateSyntheticLapTimes(
  totalRaceTime: number,
  totalLaps: number,
  stops: number,
  gridPos: number,
  retired: boolean,
  retiredLap?: number
): { lapTimes: number[]; cleanLapTimes: number[]; pitLaps: Set<number>; outLaps: Set<number> } {
  const empty = { lapTimes: [], cleanLapTimes: [], pitLaps: new Set<number>(), outLaps: new Set<number>() };
  if (!totalRaceTime || !totalLaps || totalRaceTime >= 99000) return empty;

  const actualLaps = retired && retiredLap ? retiredLap : totalLaps;
  if (actualLaps < 1) return empty;

  const pitLoss = (stops || 1) * 25;
  const standingStartPenalty = 1.5 + gridPos * 0.12;
  const cleanTime = totalRaceTime - pitLoss - standingStartPenalty;
  const baseLap = cleanTime / actualLaps;

  const stintBoundaries: number[] = [];
  if (stops > 0) {
    for (let s = 1; s <= stops; s++) {
      stintBoundaries.push(Math.round(actualLaps * (s / (stops + 1))));
    }
  }

  const lapTimes: number[] = [];
  const cleanLapTimes: number[] = [];
  const pitLapsSet = new Set<number>();
  const outLapsSet = new Set<number>();

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
    if (isPitLap) { lapInStint = 0; pitLapsSet.add(lap); }
    if (isOutLap) outLapsSet.add(lap);

    const tyreDeg = lapInStint * 0.07;
    const variance = (rand() - 0.5) * 0.8;

    let onTrackPace = baseLap + tyreDeg + variance;
    if (isLap1) onTrackPace += standingStartPenalty;
    if (isOutLap) onTrackPace += 1.5;

    const cleanTime_ = Math.max(baseLap * 0.97, onTrackPace);
    cleanLapTimes.push(cleanTime_);

    const rawLapTime = isPitLap ? cleanTime_ + 22 + rand() * 3 : cleanTime_;
    lapTimes.push(rawLapTime);
  }

  return { lapTimes, cleanLapTimes, pitLaps: pitLapsSet, outLaps: outLapsSet };
}

// ── True Race Pace Calculation ──────────────────────────────────────────────
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

// ─── Race Pace Analytics Panel ──────────────────────────────────────────────
const RacePaceAnalytics = ({ results, grid, playerResults, track, replayData }) => {
  const [filterMode, setFilterMode] = useState<string>('My Team');
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [showMedian, setShowMedian] = useState<boolean>(false);

  // 1. Determine race length
  const canonicalLaps: number = (track?.laps) ||
    results.reduce((best, r) => Math.max(best, r.lapTimes ? r.lapTimes.length : 0), 0) ||
    58;

  // 2. Enrich results — store both raw and clean lap times
  const enrichedResults = results.map((r, idx) => {
    const hasRealLaps = r.lapTimes && r.lapTimes.length >= 3 && r.lapTimes[0] > 30;
    if (hasRealLaps) {
      // For real laps, derive clean times by stripping approx pit delta
      const pitLaps = new Set<number>();
      const outLaps = new Set<number>();
      const stops = r.stops || 1;
      const len = r.lapTimes.length;
      if (stops > 0) {
        for (let s = 1; s <= stops; s++) {
          const pl = Math.round(len * (s / (stops + 1)));
          pitLaps.add(pl);
          outLaps.add(pl + 1);
        }
      }
      const cleanLapTimes = r.lapTimes.map((t: number, i: number) => {
        const lap = i + 1;
        if (pitLaps.has(lap)) return Math.max(t - 22, t * 0.82); // strip pit delta
        return t;
      });
      return { ...r, cleanLapTimes, pitLaps, outLaps, _synthetic: false };
    }

    const gridPos = grid ? (grid.findIndex(g => g.driver.name === r.driver.name) + 1) : (idx + 1);
    const winnerTime = results[0]?.time || 5400;
    const totalTime = r.retired
      ? winnerTime * (0.3 + (idx / results.length) * 0.5)
      : (r.time > 0 && r.time < 99000 ? r.time : 5400);
    const retiredLap = r.retired ? Math.max(1, Math.floor(canonicalLaps * (0.25 + Math.random() * 0.5))) : undefined;

    const { lapTimes, cleanLapTimes, pitLaps, outLaps } = generateSyntheticLapTimes(
      totalTime, canonicalLaps, r.stops || 1, gridPos, !!r.retired, retiredLap
    );

    return { ...r, lapTimes, cleanLapTimes, pitLaps, outLaps, _synthetic: true };
  });

  const totalLaps = Math.max(...enrichedResults.map(r => r.cleanLapTimes ? r.cleanLapTimes.length : (r.lapTimes ? r.lapTimes.length : 0)));

  // 3. Compute race pace using clean lap times (no pit deltas)
  const paceData = enrichedResults.map((r, finishPos) => {
    const lapsToAnalyse = r.cleanLapTimes && r.cleanLapTimes.length > 0 ? r.cleanLapTimes : r.lapTimes;
    const pace = calculateTrueRacePace(lapsToAnalyse, r.stops || 0, totalLaps);
    const isPlayer = playerResults.some(({ r: pr }) => pr.driver.name === r.driver.name);
    return { r, finishPos: finishPos + 1, pace, isPlayer };
  }).filter(d => d.pace !== null);

  const paceSorted = [...paceData].sort((a, b) => (a.pace!.normalised) - (b.pace!.normalised));
  const fastestPace = paceSorted[0]?.pace?.normalised ?? 90;

  // Driver Filtering Logic (moved up — needed before dataset build and Y-axis)
  const getFilteredDrivers = () => {
    if (filterMode === 'All Drivers') return enrichedResults.map(r => r.driver.name);
    if (filterMode === 'My Team') return playerResults.map(({r}) => r.driver.name);
    if (filterMode === 'Top 10') return enrichedResults.slice(0, 10).map(r => r.driver.name);
    if (filterMode === 'Podium Battle') return enrichedResults.slice(0, 3).map(r => r.driver.name);
    return playerResults.map(({r}) => r.driver.name);
  };
  const activeDrivers = getFilteredDrivers();

  // Compute SC/VSC laps set for exclusion in Y-axis scan
  const neutralisedLaps = new Set<number>();
  if (replayData?.scLaps?.length === 2) {
    for (let l = replayData.scLaps[0]; l <= replayData.scLaps[1]; l++) neutralisedLaps.add(l);
  }
  if (replayData?.vscLaps?.length === 2) {
    for (let l = replayData.vscLaps[0]; l <= replayData.vscLaps[1]; l++) neutralisedLaps.add(l);
  }

  // Dynamic Y-Axis: scan ALL plotted (non-null, non-outlier) lap times of active drivers
  const Y_PAD = 0.20;
  const Y_MIN_RANGE = 0.8; // never collapse the axis to less than this
  let yMin = Infinity;
  let yMax = -Infinity;

  enrichedResults.forEach(res => {
    if (!activeDrivers.includes(res.driver.name)) return;
    const cleanData = res.cleanLapTimes && res.cleanLapTimes.length > 0 ? res.cleanLapTimes : res.lapTimes;
    if (!cleanData) return;
    const pitLapSet: Set<number> = res.pitLaps instanceof Set ? res.pitLaps : new Set();
    cleanData.forEach((t: number, i: number) => {
      const lapNum = i + 1;
      if (lapNum === 1) return;           // skip standing-start lap
      if (pitLapSet.has(lapNum)) return;  // skip pit laps (they would be null in the chart)
      if (neutralisedLaps.has(lapNum)) return; // skip SC/VSC laps
      if (t <= 0 || t > 300) return;     // guard against corrupt values
      if (t < yMin) yMin = t;
      if (t > yMax) yMax = t;
    });
  });

  // Fallback if nothing was collected
  if (!isFinite(yMin) || !isFinite(yMax) || yMin >= yMax) {
    yMin = fastestPace - 1.5;
    yMax = fastestPace + 3.0;
  }

  // Enforce minimum visible range so the graph doesn't collapse on very consistent pace
  const yRange = yMax - yMin;
  if (yRange < Y_MIN_RANGE) {
    const centre = (yMin + yMax) / 2;
    yMin = centre - Y_MIN_RANGE / 2;
    yMax = centre + Y_MIN_RANGE / 2;
  }

  const yAxisMin = yMin - Y_PAD;
  const yAxisMax = yMax + Y_PAD;

  // 4. Build Chart.js datasets
  const labels = Array.from({ length: totalLaps }, (_, i) => `L${i + 1}`);
  const palette = [
    '#e6194B','#3cb44b','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6',
    '#bfef45','#469990','#dcbeff','#9A6324','#800000','#aaffc3',
    '#808000','#ffd8b1','#000075','#a9a9a9','#ff6b6b','#ffa94d','#69db7c',
    '#74c0fc','#e599f7','#a9e34b','#ffec99'
  ];

  const datasets = enrichedResults.map((res, idx) => {
    const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
    const isSelected = activeDrivers.includes(res.driver.name);
    
    // Legend hover effect
    let alpha = isSelected ? 1.0 : 0.2;
    let borderWidth = isPlayer ? 3 : 1.5;
    
    if (hoveredDriver) {
      if (hoveredDriver === res.driver.name) {
        alpha = 1.0;
        borderWidth = 4;
      } else {
        alpha = 0.1;
      }
    } else if (!isSelected) {
      alpha = 0.3;
      borderWidth = 1.0;
    }

    // Convert hex to rgba
    const baseColor = isPlayer ? HUB.accent : palette[idx % palette.length];
    const rgbaColor = baseColor.startsWith('#') 
      ? `rgba(${parseInt(baseColor.slice(1,3),16)}, ${parseInt(baseColor.slice(3,5),16)}, ${parseInt(baseColor.slice(5,7),16)}, ${alpha})`
      : baseColor;

    // Plot clean pace — pit laps become TRUE GAPS (null) so no spike, no interpolation
    const cleanData = res.cleanLapTimes && res.cleanLapTimes.length > 0 ? res.cleanLapTimes : res.lapTimes;
    const pitLapSet: Set<number> = res.pitLaps instanceof Set ? res.pitLaps : new Set();
    return {
      label: res.driver.name,
      data: Array.from({ length: totalLaps }, (_, i) => {
        const lapNum = i + 1;
        // Lap 1: skip (standing start noise)
        if (lapNum === 1) return null;
        // Pit laps: null creates a clean gap
        if (pitLapSet.has(lapNum)) return null;
        return cleanData && i < cleanData.length ? cleanData[i] : null;
      }),
      borderColor: rgbaColor,
      backgroundColor: 'transparent',
      borderWidth,
      order: isPlayer || (hoveredDriver === res.driver.name) ? 1 : 2,
      cubicInterpolationMode: 'monotone' as const,
      pointStyle: (ctx) => {
        const lapNum = ctx.dataIndex + 1;
        if (res.retired && cleanData && lapNum === cleanData.length) return 'triangle';
        return 'circle';
      },
      pointRadius: (ctx) => {
        const lapNum = ctx.dataIndex + 1;
        if (res.retired && cleanData && lapNum === cleanData.length) return 6;
        return (lapNum % 10 === 0) && isSelected ? 2 : 0;
      },
      pointHoverRadius: 5,
      pointBackgroundColor: (ctx) => {
        const lapNum = ctx.dataIndex + 1;
        if (res.retired && cleanData && lapNum === cleanData.length) return '#ef4444';
        return rgbaColor;
      },
      spanGaps: false, // CRITICAL: false = real gap at pit laps, no interpolation
      hidden: !isSelected && filterMode !== 'All Drivers',
    };
  });

  // Optional: Median Pace Overlays
  if (showMedian) {
    activeDrivers.forEach(driverName => {
      const driverPace = paceData.find(d => d.r.driver.name === driverName);
      if (driverPace && driverPace.pace) {
        datasets.push({
          label: `${driverName} Median`,
          data: Array.from({ length: totalLaps }, () => driverPace.pace!.median),
          borderColor: 'rgba(255,255,255,0.3)',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 3,
          hidden: false,
          backgroundColor: 'transparent',
          cubicInterpolationMode: 'default' as const,
          spanGaps: true,
          pointStyle: 'circle' as const,
          pointBackgroundColor: 'transparent'
        });
      }
    });
  }

  const chartData = { labels, datasets };

  // Collect pit laps for all active drivers for the annotation plugin
  const driverPitLaps: Array<{ lap: number; color: string; driverName: string }> = [];
  enrichedResults.forEach((res, idx) => {
    if (!activeDrivers.includes(res.driver.name)) return;
    const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
    const baseColor = isPlayer ? HUB.accent : palette[idx % palette.length];
    if (res.pitLaps) {
      res.pitLaps.forEach((lap: number) => {
        driverPitLaps.push({ lap, color: baseColor, driverName: res.driver.name });
      });
    }
  });

  // F1 Custom Telemetry Plugin — SC/VSC Bands + Tyre Gap Markers
  const f1TelemetryPlugin = {
    id: 'f1TelemetryPlugin',
    beforeDraw: (chart) => {
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;

      // --- SC / VSC shaded bands ---
      const drawBand = (start, end, color, label, textColor) => {
        if (!start || !end) return;
        const s0 = x.getPixelForValue(start - 1);
        const s1 = x.getPixelForValue(end - 1);
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(s0, top, Math.max(s1 - s0, 2), bottom - top);
        // Top label
        ctx.fillStyle = textColor;
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, s0 + (s1 - s0) / 2, top + 4);
        ctx.restore();
      };
      if (replayData?.scLaps?.length === 2) {
        drawBand(replayData.scLaps[0], replayData.scLaps[1], 'rgba(234,179,8,0.13)', 'SC', 'rgba(234,179,8,0.9)');
      }
      if (replayData?.vscLaps?.length === 2) {
        drawBand(replayData.vscLaps[0], replayData.vscLaps[1], 'rgba(234,179,8,0.07)', 'VSC', 'rgba(234,179,8,0.55)');
      }
    },
    afterDraw: (chart) => {
      const { ctx, chartArea: { top, bottom }, scales: { x, y } } = chart;
      const midY = top + (bottom - top) * 0.5;

      // --- Tyre gap markers — one per unique pit lap across active drivers ---
      const byLap = new Map<number, Array<{ color: string; driverName: string }>>();
      driverPitLaps.forEach(({ lap, color, driverName }) => {
        if (!byLap.has(lap)) byLap.set(lap, []);
        byLap.get(lap)!.push({ color, driverName });
      });

      byLap.forEach((entries, lap) => {
        // x-pixel for the center of the gap: midpoint between pre-pit and post-pit laps
        const xPre  = x.getPixelForValue(lap - 2); // lap before pit
        const xPost = x.getPixelForValue(lap);      // lap after pit (out-lap)
        const gapMid = (xPre + xPost) / 2;
        const gapWidth = xPost - xPre;

        ctx.save();

        // Subtle gap-fill shading
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(xPre, top, gapWidth, bottom - top);

        // Vertical dashed boundary lines at gap edges
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        [xPre, xPost].forEach(xp => {
          ctx.beginPath();
          ctx.moveTo(xp, top);
          ctx.lineTo(xp, bottom);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Tyre icon pill centered in the gap
        const pillW = Math.max(28, Math.min(gapWidth - 4, 36));
        const pillH = 18;
        const pillX = gapMid - pillW / 2;
        const pillY = midY - pillH / 2;

        ctx.fillStyle = 'rgba(15,15,25,0.92)';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        // Tyre emoji + PIT text
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛞 PIT', gapMid, midY);

        ctx.restore();
      });
    }
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: false, axis: 'x' as const },
    animation: { x: { type: 'number', easing: 'easeOutQuart', duration: 600 }, y: { type: 'number', easing: 'easeInOutQuart', duration: 300 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,15,20,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#ccc',
        padding: 12,
        titleFont: { size: 13, family: HUB.fontWide },
        bodyFont: { size: 12, family: HUB.fontMono },
        callbacks: {
          title: (items) => `Lap ${items[0].label.replace('L', '')}`,
          label: (ctx) => {
            if (ctx.dataset.label.includes('Median')) return null;
            const res = enrichedResults.find(r => r.driver.name === ctx.dataset.label);
            const lapNum = ctx.dataIndex + 1;
            const v = ctx.parsed.y;
            if (v == null) return null;
            const mins = Math.floor(v / 60);
            const secs = (v % 60).toFixed(3);
            let info = `${ctx.dataset.label}: ${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;

            if (res) {
              const isPit = res.pitLaps instanceof Set ? res.pitLaps.has(lapNum) : (res.plannedPitLap === lapNum || res.secondPitLap === lapNum);
              const isOut = res.outLaps instanceof Set ? res.outLaps.has(lapNum) : false;
              if (isPit) {
                info += '  ·  🛞 Pitted this lap';
              } else if (isOut) {
                info += '  ·  Out-lap (cold tyres)';
              } else if (res.retired && res.cleanLapTimes && lapNum === res.cleanLapTimes.length) {
                info += `  ·  ❌ DNF${res.dnfReason ? ': ' + res.dnfReason : ''}`;
              }
            }
            return info;
          },
          afterBody: (items) => {
            const lapNum = items[0].dataIndex + 1;
            const lines: string[] = [];
            if (replayData?.scLaps?.length === 2 && lapNum >= replayData.scLaps[0] && lapNum <= replayData.scLaps[1]) {
              lines.push('🚗 Safety Car period');
            }
            if (replayData?.vscLaps?.length === 2 && lapNum >= replayData.vscLaps[0] && lapNum <= replayData.vscLaps[1]) {
              lines.push('🟨 Virtual Safety Car');
            }
            return lines;
          }
        }
      }
    },
    scales: {
      y: {
        min: yAxisMin,
        max: yAxisMax,
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
        ticks: { color: '#666', maxTicksLimit: 20, font: { size: 10 } },
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
      <div style={{ ...glassCard(), padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} color={HUB.accent} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: HUB.fontWide }}>
                Telemetry & Pace
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: HUB.textMuted }}>
                Auto-zoom Y-axis · SC/VSC shaded · Pit gaps show 🛞 marker
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginRight: '8px' }}>
              <input type="checkbox" checked={showMedian} onChange={e => setShowMedian(e.target.checked)} />
              Show Median Pace
            </label>
            {['My Team', 'Top 10', 'Podium Battle', 'All Drivers'].map(fm => (
              <button
                key={fm}
                onClick={() => setFilterMode(fm)}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: filterMode === fm ? 'rgba(225,6,0,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${filterMode === fm ? HUB.accent : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px',
                  color: filterMode === fm ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  fontWeight: filterMode === fm ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                {fm}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ height: '480px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} plugins={[f1TelemetryPlugin]} />
        </div>

        {/* Custom Interactive Legend */}
        <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
           {enrichedResults.filter(r => filterMode === 'All Drivers' || activeDrivers.includes(r.driver.name)).map((res, idx) => {
             const isHovered = hoveredDriver === res.driver.name;
             const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
             const baseColor = isPlayer ? HUB.accent : palette[idx % palette.length];
             return (
               <div
                 key={res.driver.name}
                 onMouseEnter={() => setHoveredDriver(res.driver.name)}
                 onMouseLeave={() => setHoveredDriver(null)}
                 style={{
                   display: 'flex', alignItems: 'center', gap: '6px',
                   padding: '4px 10px',
                   borderRadius: '12px',
                   background: isHovered ? 'rgba(255,255,255,0.1)' : 'transparent',
                   cursor: 'pointer',
                   border: `1px solid ${isHovered ? baseColor : 'transparent'}`,
                   transition: 'all 0.2s'
                 }}
               >
                 <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: baseColor }} />
                 <span style={{ fontSize: '11px', color: isHovered || isPlayer ? '#fff' : '#aaa', fontWeight: isPlayer ? 'bold' : 'normal' }}>
                   {res.driver.name}
                 </span>
               </div>
             );
           })}
        </div>
      </div>

      {/* Race Events Timeline */}
      {(() => {
        // Build a unified timeline of events sorted by lap
        const timelineEvents: Array<{ lap: number; type: string; label: string; detail: string; color: string; icon: string }> = [];

        // Safety Car
        if (replayData?.scLaps?.length === 2) {
          timelineEvents.push({ lap: replayData.scLaps[0], type: 'SC', label: 'Safety Car', detail: `Laps ${replayData.scLaps[0]}–${replayData.scLaps[1]}`, color: 'rgba(234,179,8,0.9)', icon: '🚗' });
        }
        // VSC
        if (replayData?.vscLaps?.length === 2) {
          timelineEvents.push({ lap: replayData.vscLaps[0], type: 'VSC', label: 'Virtual SC', detail: `Laps ${replayData.vscLaps[0]}–${replayData.vscLaps[1]}`, color: 'rgba(234,179,8,0.6)', icon: '🟨' });
        }
        // Pit stops
        if (replayData?.events) {
          replayData.events.filter(e => e.type === 'PIT_STOP').forEach(ev => {
            const isPlayer = playerResults.some(({ r }) => r.driver.name === ev.driver);
            const posDiff = (ev.newPos ?? 0) - (ev.oldPos ?? 0);
            const posLabel = ev.oldPos && ev.newPos ? `P${ev.oldPos}→P${ev.newPos}` : '';
            timelineEvents.push({
              lap: ev.lap,
              type: 'PIT',
              label: ev.driver,
              detail: `${ev.strategy} · ${ev.time}s${posLabel ? ' · ' + posLabel : ''}`,
              color: isPlayer ? HUB.accent : 'rgba(255,255,255,0.6)',
              icon: '🛞'
            });
          });
        }
        // DNFs
        enrichedResults.filter(r => r.retired).forEach(r => {
          const dnfLap = r.cleanLapTimes?.length ?? r.lapTimes?.length ?? 0;
          if (dnfLap > 0) {
            timelineEvents.push({
              lap: dnfLap,
              type: 'DNF',
              label: r.driver.name,
              detail: r.dnfReason || 'Retirement',
              color: '#ef4444',
              icon: '❌'
            });
          }
        });

        timelineEvents.sort((a, b) => a.lap - b.lap);
        if (timelineEvents.length === 0) return null;

        return (
          <div style={{ ...glassCard(), padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Flag size={16} color={HUB.accent} />
              <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Race Events Timeline</h3>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: HUB.textMuted }}>{timelineEvents.length} events</span>
            </div>
            {/* Timeline track */}
            <div style={{ position: 'relative', paddingBottom: '8px' }}>
              {/* Lap axis */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '12px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.08)', transform: 'translateY(-50%)' }} />
                {timelineEvents.map((ev, i) => {
                  const leftPct = totalLaps > 0 ? Math.max(0, Math.min(100, ((ev.lap - 1) / totalLaps) * 100)) : i * 4;
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'default',
                        zIndex: 1
                      }}
                      title={`Lap ${ev.lap} · ${ev.label} · ${ev.detail}`}
                    >
                      {/* Event dot */}
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: ev.type === 'SC' ? '#eab308' : ev.type === 'VSC' ? '#ca8a04' : ev.type === 'DNF' ? '#ef4444' : ev.type === 'PIT' ? 'rgba(255,255,255,0.7)' : '#fff',
                        border: `2px solid ${ev.color}`,
                        boxShadow: `0 0 6px ${ev.color}`,
                        flexShrink: 0
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Event cards row */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {timelineEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      border: `1px solid ${
                        ev.type === 'SC' ? 'rgba(234,179,8,0.5)' :
                        ev.type === 'VSC' ? 'rgba(234,179,8,0.3)' :
                        ev.type === 'DNF' ? 'rgba(239,68,68,0.4)' :
                        ev.type === 'PIT' && playerResults.some(({ r }) => r.driver.name === ev.label) ? `${HUB.accent}55` :
                        'rgba(255,255,255,0.1)'
                      }`,
                      background: `${
                        ev.type === 'SC' ? 'rgba(234,179,8,0.08)' :
                        ev.type === 'VSC' ? 'rgba(234,179,8,0.04)' :
                        ev.type === 'DNF' ? 'rgba(239,68,68,0.08)' :
                        ev.type === 'PIT' && playerResults.some(({ r }) => r.driver.name === ev.label) ? 'rgba(225,6,0,0.08)' :
                        'rgba(255,255,255,0.03)'
                      }`,
                      fontSize: '11px',
                      color: '#ccc',
                      whiteSpace: 'nowrap' as const
                    }}
                  >
                    <span>{ev.icon}</span>
                    <span style={{ fontFamily: HUB.fontMono, fontSize: '10px', color: ev.type === 'SC' || ev.type === 'VSC' ? '#eab308' : '#888' }}>L{ev.lap}</span>
                    <span style={{ fontWeight: 600, color: ev.type === 'DNF' ? '#ef4444' : playerResults.some(({ r }) => r.driver.name === ev.label) ? HUB.accent : '#ddd' }}>{ev.label}</span>
                    <span style={{ color: '#666', fontSize: '10px' }}>·</span>
                    <span style={{ color: '#999', fontSize: '10px' }}>{ev.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pit Events Panel + Per-Driver Pace Ranking — side by side on wide screens */}
      <div style={{ display: 'grid', gridTemplateColumns: replayData?.events?.filter(e => e.type === 'PIT_STOP').length > 0 ? '1fr 320px' : '1fr', gap: '16px', alignItems: 'start' }}>

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

        {/* Pit Events Panel */}
        {replayData?.events?.filter(e => e.type === 'PIT_STOP').length > 0 && (
          <div style={{ ...glassCard(), padding: '0', position: 'sticky', top: '80px' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🛞</span>
              <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pit Events</h3>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: HUB.textMuted }}>{replayData.events.filter(e => e.type === 'PIT_STOP').length} stops</span>
            </div>
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {replayData.events.filter(e => e.type === 'PIT_STOP').map((ev, i) => {
                const isPlayer = playerResults.some(({ r }) => r.driver.name === ev.driver);
                const posDiff = (ev.newPos ?? 0) - (ev.oldPos ?? 0);
                return (
                  <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: isPlayer ? 'rgba(225,6,0,0.06)' : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isPlayer ? HUB.accent : '#ddd' }}>{ev.driver}</span>
                      <span style={{ fontSize: '10px', fontFamily: HUB.fontMono, color: HUB.textMuted, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>Lap {ev.lap}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: '4px' }}>🛞 {ev.strategy}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div style={{ fontSize: '10px', color: HUB.textMuted }}>Stationary time</div>
                      <div style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: '#fff' }}>{ev.time}s</div>
                      <div style={{ fontSize: '10px', color: HUB.textMuted }}>Position</div>
                      <div style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: posDiff > 3 ? '#ef4444' : posDiff > 0 ? '#f59e0b' : '#10b981' }}>
                        P{ev.oldPos} → P{ev.newPos} {posDiff > 0 ? `(-${posDiff})` : posDiff < 0 ? `(+${Math.abs(posDiff)})` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const DetailedRaceReport = ({ results, grid, objectiveId, state, track, replayData }) => {
  const [activeTab, setActiveTab] = useState('summary');

  // Retrieve the full objective definition from weekendProgress if available
  const storedObjData = (state as any)?.weekendProgress?.selectedObjectiveData;
  // Build a minimal fallback from the legacy static list
  const legacyObj = RACE_OBJECTIVES.find(o => o.id === objectiveId) || RACE_OBJECTIVES[2];
  const legacyFallback = {
    ...legacyObj,
    rationale: 'Pre-race strategy briefing analysis.',
    expectedFinishRange: legacyObj.targetPosition ? `P${legacyObj.targetPosition}` : 'Points',
    successProbability: 60,
    riskLevel: legacyObj.risk || 'Medium',
    sponsorRewardM: 1.4,
    boardImpact: 'Medium',
    championshipImpact: legacyObj.targetPosition ? `+${Math.max(0, [25,18,15,12,10,8,6,4,2,1][legacyObj.targetPosition-1]||0)} pts` : 'Varies',
    targetPosition: legacyObj.targetPosition || 10,
  };
  const objectiveDef = storedObjData || legacyFallback;

  // Run the AI evaluator
  const evaluation = evaluateObjective(objectiveDef, results, grid, state.team, track, replayData);
  const { status, successScore, aiPredictionAccuracy, keyEvents, driverRating, engineeringRating, actualPosition } = evaluation;

  const statusColor = status === 'Achieved' ? '#10b981' : status === 'Partially Achieved' ? '#f59e0b' : '#ef4444';
  const statusEmoji = status === 'Achieved' ? '✅' : status === 'Partially Achieved' ? '⚠️' : '❌';

  const playerResults = results.map((r, i) => ({ r, pos: i+1 })).filter(x => x.r.team?.name === state.team?.name);

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
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: successScore >= 80 ? '#10b981' : successScore >= 50 ? '#f59e0b' : '#ef4444', fontFamily: HUB.fontMono }}>
                {(successScore / 10).toFixed(1)} <span style={{ fontSize: '12px', color: HUB.textMuted }}>/ 10</span>
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
             
             {/* ── Objective Review Card ── */}
             <div style={{
               backgroundColor: 'rgba(10,10,10,0.85)',
               border: `1px solid ${statusColor}40`,
               borderRadius: '10px', padding: '24px',
               position: 'relative', overflow: 'hidden'
             }}>
               {/* Accent line */}
               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${statusColor}, transparent)` }} />

               {/* Selected objective header */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                 <Target size={16} color={HUB.accent} />
                 <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Selected Objective — Post-Race Evaluation</span>
               </div>

               <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                 {/* Left: objective info */}
                 <div style={{ flex: 1, minWidth: '200px' }}>
                   <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff', marginBottom: '6px', fontFamily: HUB.fontBold }}>
                     {objectiveDef.emoji || ''} {objectiveDef.label}
                   </div>
                   <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#aaa', lineHeight: '1.5', fontStyle: 'italic' }}>
                     "{objectiveDef.rationale || 'Pre-race strategic target.'}"
                   </p>
                   {/* Key Events */}
                   {keyEvents.length > 0 && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       {keyEvents.map((evt, i) => (
                         <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: HUB.accent, flexShrink: 0 }} />
                           <span style={{ fontSize: '11px', color: '#ccc' }}>{evt}</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Right: evaluation metrics */}
                 <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                   <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px 18px' }}>
                     <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
                     <div style={{ fontSize: '14px', fontWeight: 900, color: statusColor }}>{statusEmoji} {status}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px 18px' }}>
                     <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Expected</div>
                     <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono }}>{objectiveDef.expectedFinishRange || `P${objectiveDef.targetPosition || '?'}`}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px 18px' }}>
                     <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Actual</div>
                     <div style={{ fontSize: '14px', fontWeight: 900, color: statusColor, fontFamily: HUB.fontMono }}>P{actualPosition}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px 18px' }}>
                     <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Success</div>
                     <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono }}>{successScore}%</div>
                   </div>
                   <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px 18px' }}>
                     <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>AI Accuracy</div>
                     <div style={{ fontSize: '14px', fontWeight: 900, color: '#3b82f6', fontFamily: HUB.fontMono }}>{aiPredictionAccuracy}%</div>
                   </div>
                 </div>
               </div>

               {/* Driver & Engineering ratings */}
               <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Driver Rating</span>
                   <span style={{ fontSize: '18px', fontWeight: 900, color: driverRating >= 8 ? '#10b981' : driverRating >= 6 ? '#f59e0b' : '#ef4444', fontFamily: HUB.fontMono }}>{driverRating}<span style={{ fontSize: '11px', color: HUB.textMuted }}>/10</span></span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Engineering Rating</span>
                   <span style={{ fontSize: '18px', fontWeight: 900, color: engineeringRating >= 8 ? '#10b981' : engineeringRating >= 6 ? '#f59e0b' : '#ef4444', fontFamily: HUB.fontMono }}>{engineeringRating}<span style={{ fontSize: '11px', color: HUB.textMuted }}>/10</span></span>
                 </div>
                 {objectiveDef.sponsorRewardM && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Sponsor Reward</span>
                     <span style={{ fontSize: '14px', fontWeight: 800, color: '#10b981', fontFamily: HUB.fontMono }}>{status !== 'Not Achieved' ? `+$${objectiveDef.sponsorRewardM}M` : '$0M'}</span>
                   </div>
                 )}
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
                           : (status === 'Achieved' 
                                ? `Excellent drive. Managed the pace perfectly and executed the strategy flawlessly to hit our target.` : status === 'Partially Achieved' ? `A solid effort — close to the target. Tyre management in the final stint was key.` 
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
             <div style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr 2fr', gap: '16px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
               <div>Pos</div>
               <div style={{ textAlign: 'center' }}>+/-</div>
               <div>Driver</div>
               <div>Team</div>
               <div>Gap</div>
               <div>Stops</div>
               <div>Status</div>
               <div>Notes</div>
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
                  <div key={r.driver.name} style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr 2fr', gap: '16px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.02)', background: isPlayerDriver ? 'rgba(225,6,0,0.1)' : 'transparent' }}>
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
                    <div style={{ fontSize: '11px', color: HUB.textMuted }}>
                      {r.explanation || (r.dnfReason ? r.dnfReason : '-')}
                    </div>
                  </div>
                );
             })}
          </div>
        )}

        {activeTab === 'analytics' && (
          <RacePaceAnalytics results={results} grid={grid} playerResults={playerResults} track={track} replayData={replayData} />
        )}
      </motion.div>
    </div>
  );
};
