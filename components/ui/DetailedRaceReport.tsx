import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HUB, glassCard, pill } from '../HubLayout.tsx';
import { Target, Flag, Clock, Zap, Activity, Users, ChevronRight, BarChart3, AlertCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { RACE_OBJECTIVES, evaluateObjective } from '../../utils/raceObjectives.js';
import { analyseRace, detectPitLaps, pitLapsFromEvents, neutralisedLapSet } from '../../utils/racePace.js';
import { RacePaceDeepDive } from './RacePaceDeepDive.tsx';

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

// One line colour per driver so series stay distinguishable on dark. The player's
// drivers always draw in HUB.accent and lead; nothing else uses red.
const DRIVER_PALETTE = [
  '#ededed', '#d9a43a', '#4cc38a', '#8fb3d9', '#c98a5a', '#a1a1a6', '#e8c547', '#7fb3b3',
  '#d4a5a5', '#b8c78a', '#c6b38e', '#9fb0c4', '#e0c3a0', '#8fbf9f', '#bfbfbf', '#d9b38c',
  '#9dbfa8', '#c9c08f', '#a8b8a0', '#cfa9a0', '#b0b7c9', '#dcd3b0', '#8f8f94', '#c2d1c0'
];

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', backgroundColor: HUB.raised, borderRadius: '8px' }}>
        <p style={{ color: HUB.textMuted, fontSize: '13px' }}>No lap-by-lap times recorded for this session</p>
      </div>
    );
  }

  // Find max laps
  const maxLaps = Math.max(...results.map(r => r.lapTimes ? r.lapTimes.length : 0));
  const labels = Array.from({ length: maxLaps }, (_, i) => `L${i + 1}`);

  const palette = DRIVER_PALETTE;

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
      borderWidth: isPlayer ? 2.5 : 1.25,
      order: isPlayer ? 0 : 1,
      pointRadius: 0, 
      pointHoverRadius: 4,
      tension: 0.2,
      hidden: !isPlayer && idx > 5, // Show player and top 5 by default, hide rest to avoid initial clutter
    };
  });

  // Player's drivers lead the legend
  const data = { labels, datasets: [...datasets].sort((a, b) => a.order - b.order) };
  
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
          color: HUB.textMuted,
          font: { size: 11 },
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
        title: { display: true, text: 'Lap time (s)', color: HUB.textFaint },
        ticks: { color: HUB.textFaint },
        grid: { color: HUB.border },
      },
      x: {
        ticks: { color: HUB.textFaint, maxTicksLimit: 20 },
        grid: { color: HUB.border }
      }
    }
  };

  return (
    <div style={{ height: '500px', width: '100%', backgroundColor: HUB.bg, borderRadius: '8px', padding: '16px' }}>
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
      // Real laps: find the actual stop laps (recorded events + lap-time outliers)
      const detected = detectPitLaps(r.lapTimes, {
        knownPitLaps: pitLapsFromEvents(r.driver.name, replayData),
        neutralLaps: neutralisedLapSet(replayData),
      });
      const pitLaps = new Set<number>(detected);
      const outLaps = new Set<number>(detected.map(l => l + 1));
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

  // 3. Race pace: shared analyser (real stop laps, SC/VSC removed, stint trends)
  const raceAnalysis = analyseRace(enrichedResults, replayData, { grid });
  const paceData = raceAnalysis.ranked.map(a => {
    const idx = enrichedResults.findIndex(r => r.driver.name === a.name);
    const r = enrichedResults[idx];
    const isPlayer = playerResults.some(({ r: pr }) => pr.driver.name === a.name);
    const pace = {
      median: a.analysis.median,
      normalised: a.analysis.median,
      cleanLapCount: a.analysis.cleanLapCount,
      filteredLapCount: a.analysis.excludedLapCount,
      fastestClean: a.analysis.best,
      slowestClean: a.analysis.worst,
      consistencyScore: a.analysis.consistency,
      trend: a.analysis.trend,
    };
    return { r, finishPos: idx + 1, pace, isPlayer };
  });

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
  const palette = DRIVER_PALETTE;
  // Stable colour per driver (by finishing order), player's drivers in accent
  const colorFor = (driverName: string) => {
    if (playerResults.some(({ r }) => r.driver.name === driverName)) return HUB.accent;
    const idx = enrichedResults.findIndex(r => r.driver.name === driverName);
    return palette[Math.max(0, idx) % palette.length];
  };

  const datasets = enrichedResults.map((res, idx) => {
    const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
    const isSelected = activeDrivers.includes(res.driver.name);
    
    // Legend hover effect
    let alpha = isSelected ? 1.0 : 0.2;
    let borderWidth = isPlayer ? 2.5 : 1.25;
    
    if (hoveredDriver) {
      if (hoveredDriver === res.driver.name) {
        alpha = 1.0;
        borderWidth = 3;
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
        if (res.retired && cleanData && lapNum === cleanData.length) return HUB.negative;
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
          borderColor: 'rgba(237,237,237,0.3)',
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
        ctx.font = '11px "Formula1-Bold", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, s0 + (s1 - s0) / 2, top + 4);
        ctx.restore();
      };
      if (replayData?.scLaps?.length === 2) {
        drawBand(replayData.scLaps[0], replayData.scLaps[1], 'rgba(217,164,58,0.12)', 'SC', HUB.warning);
      }
      if (replayData?.vscLaps?.length === 2) {
        drawBand(replayData.vscLaps[0], replayData.vscLaps[1], 'rgba(217,164,58,0.06)', 'VSC', 'rgba(217,164,58,0.7)');
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
        ctx.fillStyle = 'rgba(237,237,237,0.02)';
        ctx.fillRect(xPre, top, gapWidth, bottom - top);

        // Vertical dashed boundary lines at gap edges
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(237,237,237,0.18)';
        [xPre, xPost].forEach(xp => {
          ctx.beginPath();
          ctx.moveTo(xp, top);
          ctx.lineTo(xp, bottom);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // "Pit" label centred in the gap
        const pillW = Math.max(28, Math.min(gapWidth - 4, 32));
        const pillH = 18;
        const pillX = gapMid - pillW / 2;
        const pillY = midY - pillH / 2;

        ctx.fillStyle = HUB.raised;
        ctx.strokeStyle = HUB.borderMid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 4);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = HUB.textPrimary;
        ctx.font = '11px "Formula1-Bold", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Pit', gapMid, midY);

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
        backgroundColor: HUB.sidebar,
        borderColor: HUB.borderMid,
        borderWidth: 1,
        titleColor: HUB.textPrimary,
        bodyColor: HUB.textMuted,
        padding: 12,
        titleFont: { size: 13, family: HUB.fontBold },
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
                info += '  ·  Pitted this lap';
              } else if (isOut) {
                info += '  ·  Out-lap (cold tyres)';
              } else if (res.retired && res.cleanLapTimes && lapNum === res.cleanLapTimes.length) {
                info += `  ·  DNF${res.dnfReason ? ': ' + res.dnfReason : ''}`;
              }
            }
            return info;
          },
          afterBody: (items) => {
            const lapNum = items[0].dataIndex + 1;
            const lines: string[] = [];
            if (replayData?.scLaps?.length === 2 && lapNum >= replayData.scLaps[0] && lapNum <= replayData.scLaps[1]) {
              lines.push('Safety car period');
            }
            if (replayData?.vscLaps?.length === 2 && lapNum >= replayData.vscLaps[0] && lapNum <= replayData.vscLaps[1]) {
              lines.push('Virtual safety car');
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
        title: { display: true, text: 'Lap time (s)', color: HUB.textFaint, font: { size: 11 } },
        ticks: {
          color: HUB.textFaint,
          callback: (val) => {
            const m = Math.floor(Number(val) / 60);
            const s = (Number(val) % 60).toFixed(1);
            return `${m}:${Number(s) < 10 ? '0' : ''}${s}`;
          }
        },
        grid: { color: HUB.border }
      },
      x: {
        ticks: { color: HUB.textFaint, maxTicksLimit: 20, font: { size: 11 } },
        grid: { color: HUB.border }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Fastest race pace</div>
          <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(fastestPace)}</div>
          <div style={{ fontSize: '12px', color: HUB.textMuted, marginTop: '4px' }}>{paceSorted[0]?.r.driver.name}</div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Your pace rank</div>
          <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.accentInk, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>
            {playerPaceRank > 0 ? `P${playerPaceRank}` : '–'}
          </div>
          <div style={{ fontSize: '12px', color: HUB.textMuted, marginTop: '4px' }}>
            {playerBestPaceEntry ? `+${(playerBestPaceEntry.pace!.normalised - fastestPace).toFixed(3)}s vs fastest` : 'No data'}
          </div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Positions gained</div>
          <div style={{ fontSize: '22px', fontWeight: 400, color: posGained > 0 ? HUB.positive : posGained < 0 ? HUB.negative : HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>
            {posGained > 0 ? '+' : ''}{posGained}
          </div>
          <div style={{ fontSize: '12px', color: HUB.textMuted, marginTop: '4px' }}>vs qualifying grid</div>
        </div>
        <div style={{ ...glassCard(), textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Clean laps analysed</div>
          <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>
            {playerBestPaceEntry?.pace?.cleanLapCount ?? totalLaps}
          </div>
          <div style={{ fontSize: '12px', color: HUB.textMuted, marginTop: '4px' }}>
            {playerBestPaceEntry ? `${playerBestPaceEntry.pace!.filteredLapCount} outliers removed` : '(your driver)'}
          </div>
        </div>
      </div>

      {/* Main Chart.js Chart */}
      <div style={{ ...glassCard() }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontBold }}>
                Lap times
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: HUB.textFaint }}>
                SC and VSC laps shaded · pit laps marked "Pit"
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '12px', color: HUB.textMuted, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginRight: '8px' }}>
              <input type="checkbox" checked={showMedian} onChange={e => setShowMedian(e.target.checked)} style={{ accentColor: HUB.accent }} />
              Show median pace
            </label>
            {['My Team', 'Top 10', 'Podium Battle', 'All Drivers'].map(fm => (
              <button
                key={fm}
                onClick={() => setFilterMode(fm)}
                aria-pressed={filterMode === fm}
                className="hub-btn"
                style={{
                  height: '28px',
                  padding: '0 12px',
                  fontSize: '12px',
                  background: filterMode === fm ? HUB.accentSoft : HUB.raised,
                  border: `1px solid ${filterMode === fm ? 'rgba(225,6,0,0.4)' : HUB.border}`,
                  borderRadius: '8px',
                  color: filterMode === fm ? HUB.textPrimary : HUB.textMuted,
                  cursor: 'pointer',
                  fontWeight: 400,
                  fontFamily: HUB.fontRegular,
                  transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
                }}
              >
                {fm === 'My Team' ? 'My team' : fm === 'Podium Battle' ? 'Podium' : fm === 'All Drivers' ? 'All drivers' : fm}
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ height: '480px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} plugins={[f1TelemetryPlugin]} />
        </div>

        {/* Custom Interactive Legend */}
        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: HUB.bg, borderRadius: '8px' }}>
           {enrichedResults.filter(r => filterMode === 'All Drivers' || activeDrivers.includes(r.driver.name))
             .sort((a, b) => Number(playerResults.some(({ r }) => r.driver.name === b.driver.name)) - Number(playerResults.some(({ r }) => r.driver.name === a.driver.name)))
             .map((res, idx) => {
             const isHovered = hoveredDriver === res.driver.name;
             const isPlayer = playerResults.some(({ r }) => r.driver.name === res.driver.name);
             const baseColor = colorFor(res.driver.name);
             return (
               <div
                 key={res.driver.name}
                 onMouseEnter={() => setHoveredDriver(res.driver.name)}
                 onMouseLeave={() => setHoveredDriver(null)}
                 style={{
                   display: 'flex', alignItems: 'center', gap: '6px',
                   padding: '4px 10px',
                   borderRadius: '6px',
                   background: isHovered ? HUB.raised : 'transparent',
                   cursor: 'pointer',
                   border: `1px solid ${isHovered ? HUB.borderMid : 'transparent'}`,
                   transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`
                 }}
               >
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: baseColor }} />
                 <span style={{ fontSize: '12px', color: isHovered || isPlayer ? HUB.textPrimary : HUB.textMuted, fontWeight: 400, fontFamily: isPlayer ? HUB.fontBold : HUB.fontRegular }}>
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
        // icon is a short plain-text tag shown on each event chip

        // Safety Car
        if (replayData?.scLaps?.length === 2) {
          timelineEvents.push({ lap: replayData.scLaps[0], type: 'SC', label: 'Safety car', detail: `Laps ${replayData.scLaps[0]}–${replayData.scLaps[1]}`, color: HUB.warning, icon: 'SC' });
        }
        // VSC
        if (replayData?.vscLaps?.length === 2) {
          timelineEvents.push({ lap: replayData.vscLaps[0], type: 'VSC', label: 'Virtual SC', detail: `Laps ${replayData.vscLaps[0]}–${replayData.vscLaps[1]}`, color: HUB.warning, icon: 'VSC' });
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
              color: isPlayer ? HUB.accent : HUB.textFaint,
              icon: 'Pit'
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
              color: HUB.negative,
              icon: 'DNF'
            });
          }
        });

        timelineEvents.sort((a, b) => a.lap - b.lap);
        if (timelineEvents.length === 0) return null;

        return (
          <div style={{ ...glassCard() }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Flag size={16} strokeWidth={1.5} color={HUB.textMuted} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Race events</h3>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: HUB.textFaint }}>{timelineEvents.length} events</span>
            </div>
            {/* Timeline track */}
            <div style={{ position: 'relative', paddingBottom: '8px' }}>
              {/* Lap axis */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '12px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: HUB.border, transform: 'translateY(-50%)' }} />
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
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: ev.color,
                        flexShrink: 0
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Event cards row */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {timelineEvents.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${HUB.border}`,
                      background: ev.type === 'PIT' && playerResults.some(({ r }) => r.driver.name === ev.label) ? HUB.accentSoft : HUB.raised,
                      fontSize: '12px',
                      color: HUB.textMuted,
                      whiteSpace: 'nowrap' as const
                    }}
                  >
                    <span style={{ fontFamily: HUB.fontBold, fontSize: '11px', color: ev.type === 'SC' || ev.type === 'VSC' ? HUB.warning : ev.type === 'DNF' ? HUB.negative : HUB.textFaint }}>{ev.icon}</span>
                    <span style={{ fontFamily: HUB.fontMono, fontSize: '11px', color: HUB.textFaint }}>L{ev.lap}</span>
                    <span style={{ fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: playerResults.some(({ r }) => r.driver.name === ev.label) ? HUB.accentInk : HUB.textPrimary }}>{ev.label}</span>
                    <span style={{ color: HUB.textFaint, fontSize: '11px' }}>·</span>
                    <span style={{ color: HUB.textMuted, fontSize: '11px' }}>{ev.detail}</span>
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
          <div style={{ padding: '16px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Race pace ranking</h3>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: HUB.textFaint }}>Median of clean laps · stops, SC and slow laps removed</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 36px 2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 16px', fontSize: '12px', color: HUB.textFaint, backgroundColor: HUB.bg }}>
            <div>Rank</div>
            <div>Fin</div>
            <div>Driver</div>
            <div>True pace</div>
            <div>Gap</div>
            <div>Consistency</div>
            <div>Clean laps</div>
          </div>
          {paceSorted.map((d, rankIdx) => {
            const gap = d.pace!.normalised - fastestPace;
            const isPlayer = d.isPlayer;
            const cs = d.pace!.consistencyScore;
            const consistColor = cs >= 80 ? HUB.positive : cs >= 60 ? HUB.warning : HUB.negative;
            return (
              <div key={d.r.driver.name} style={{ display: 'grid', gridTemplateColumns: '36px 36px 2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 16px', alignItems: 'center', borderBottom: `1px solid ${HUB.border}`, background: isPlayer ? HUB.accentSoft : 'transparent' }}>
                <div style={{ fontSize: '13px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary }}>P{rankIdx + 1}</div>
                <div style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>P{d.finishPos}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={getDriverHeadshotUrl(d.r.driver)} alt={d.r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: isPlayer ? HUB.accentInk : HUB.textPrimary }}>{d.r.driver.name}</div>
                    <div style={{ fontSize: '11px', color: HUB.textMuted }}>{d.r.team.name}</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{fmtTime(d.pace!.normalised)}</div>
                <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textMuted }}>
                  {gap < 0.001 ? '—' : `+${gap.toFixed(3)}s`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '4px', backgroundColor: HUB.raised, borderRadius: '2px' }}>
                    <div style={{ width: `${cs}%`, height: '100%', backgroundColor: consistColor, borderRadius: '2px', transition: `width 400ms ${HUB.ease}` }} />
                  </div>
                  <span style={{ fontSize: '11px', color: consistColor, fontFamily: HUB.fontMono, minWidth: '30px' }}>{Math.round(cs)}%</span>
                </div>
                <div style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>{d.pace!.cleanLapCount} / {d.r.lapTimes?.length ?? 0}</div>
              </div>
            );
          })}
        </div>

        {/* Pit Events Panel */}
        {replayData?.events?.filter(e => e.type === 'PIT_STOP').length > 0 && (
          <div style={{ ...glassCard(), padding: '0', position: 'sticky', top: '80px' }}>
            <div style={{ padding: '16px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Pit stops</h3>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: HUB.textFaint }}>{replayData.events.filter(e => e.type === 'PIT_STOP').length} stops</span>
            </div>
            <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {replayData.events.filter(e => e.type === 'PIT_STOP').map((ev, i) => {
                const isPlayer = playerResults.some(({ r }) => r.driver.name === ev.driver);
                const posDiff = (ev.newPos ?? 0) - (ev.oldPos ?? 0);
                return (
                  <div key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${HUB.border}`, background: isPlayer ? HUB.accentSoft : 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: isPlayer ? HUB.accentInk : HUB.textPrimary }}>{ev.driver}</span>
                      <span style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: HUB.textMuted }}>Lap {ev.lap}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: HUB.textMuted }}>{ev.strategy}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                      <div style={{ fontSize: '12px', color: HUB.textFaint }}>Stationary time</div>
                      <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{ev.time}s</div>
                      <div style={{ fontSize: '12px', color: HUB.textFaint }}>Position</div>
                      <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: posDiff > 0 ? HUB.negative : posDiff < 0 ? HUB.positive : HUB.textPrimary }}>
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

      <RacePaceDeepDive
        results={enrichedResults}
        analysis={raceAnalysis}
        playerNames={playerResults.map(({ r }) => r.driver.name)}
        activeDrivers={activeDrivers}
        colorFor={colorFor}
        replayData={replayData}
      />
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

  const statusColor = status === 'Achieved' ? HUB.positive : status === 'Partially Achieved' ? HUB.warning : HUB.negative;
  const StatusIcon = status === 'Achieved' ? CheckCircle2 : status === 'Partially Achieved' ? AlertTriangle : XCircle;

  const playerResults = results.map((r, i) => ({ r, pos: i+1 })).filter(x => x.r.team?.name === state.team?.name);

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'classification', label: 'Classification' },
    { id: 'analytics', label: 'Pace' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
      
      {/* Header */}
      <div style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>
              Race report
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: HUB.textMuted }}>{track?.name}</p>
         </div>
         <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '4px' }}>Race rating</div>
              <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                {(successScore / 10).toFixed(1)} <span style={{ fontSize: '12px', color: HUB.textMuted }}>/ 10</span>
              </div>
            </div>
         </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${HUB.border}` }}>
        {tabs.map(t => (
          <button 
             key={t.id} 
             onClick={() => setActiveTab(t.id)}
             style={{
               padding: '12px 16px',
               backgroundColor: 'transparent',
               border: 'none',
               borderBottom: activeTab === t.id ? `2px solid ${HUB.accent}` : '2px solid transparent',
               color: activeTab === t.id ? HUB.textPrimary : HUB.textMuted,
               fontSize: '13px',
               fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif",
               cursor: 'pointer' }}
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
             <div style={{ ...glassCard(), position: 'relative', overflow: 'hidden' }}>
               {/* Selected objective header */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                 <Target size={16} strokeWidth={1.5} color={HUB.textMuted} />
                 <span style={{ fontSize: '12px', color: HUB.textFaint }}>Race objective</span>
               </div>

               <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                 {/* Left: objective info */}
                 <div style={{ flex: 1, minWidth: '200px' }}>
                   <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.textPrimary, marginBottom: '8px', fontFamily: HUB.fontBold }}>
                     {objectiveDef.label}
                   </div>
                   <p style={{ margin: '0 0 12px', fontSize: '13px', color: HUB.textMuted, lineHeight: '1.5' }}>
                     {objectiveDef.rationale || 'Pre-race strategic target.'}
                   </p>
                   {/* Key Events */}
                   {keyEvents.length > 0 && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       {keyEvents.map((evt, i) => (
                         <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: HUB.textFaint, flexShrink: 0 }} />
                           <span style={{ fontSize: '12px', color: HUB.textMuted }}>{evt}</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Right: evaluation metrics */}
                 <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                   <div style={{ textAlign: 'center', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                     <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Status</div>
                     <div style={{ fontSize: '14px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><StatusIcon size={16} strokeWidth={1.5} /> {status}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                     <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Expected</div>
                     <div style={{ fontSize: '14px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{objectiveDef.expectedFinishRange || `P${objectiveDef.targetPosition || '?'}`}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                     <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Actual</div>
                     <div style={{ fontSize: '14px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>P{actualPosition}</div>
                   </div>
                   <div style={{ textAlign: 'center', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                     <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Success</div>
                     <div style={{ fontSize: '14px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{successScore}%</div>
                   </div>
                   <div style={{ textAlign: 'center', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                     <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Prediction accuracy</div>
                     <div style={{ fontSize: '14px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{aiPredictionAccuracy}%</div>
                   </div>
                 </div>
               </div>

               {/* Driver & Engineering ratings */}
               <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${HUB.border}`, flexWrap: 'wrap' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '12px', color: HUB.textFaint }}>Driver rating</span>
                   <span style={{ fontSize: '18px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{driverRating}<span style={{ fontSize: '11px', color: HUB.textMuted }}>/10</span></span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '12px', color: HUB.textFaint }}>Engineering rating</span>
                   <span style={{ fontSize: '18px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{engineeringRating}<span style={{ fontSize: '11px', color: HUB.textMuted }}>/10</span></span>
                 </div>
                 {objectiveDef.sponsorRewardM && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ fontSize: '12px', color: HUB.textFaint }}>Sponsor reward</span>
                     <span style={{ fontSize: '14px', fontWeight: 400, color: status !== 'Not Achieved' ? HUB.positive : HUB.textMuted, fontFamily: HUB.fontMono }}>{status !== 'Not Achieved' ? `+$${objectiveDef.sponsorRewardM}M` : '$0M'}</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Engineer Report */}
             <div style={{ ...glassCard(), display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Race engineer summary</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                   {playerResults.map(({r, pos}, i) => (
                     <div key={i} style={{ padding: '16px', backgroundColor: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                         <img src={getDriverHeadshotUrl(r.driver)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt={r.driver.name} />
                         <div>
                           <div style={{ fontSize: '14px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary }}>{r.driver.name}</div>
                           <div style={{ fontSize: '12px', color: HUB.textMuted }}>Finished P{pos}</div>
                         </div>
                       </div>
                       <p style={{ fontSize: '13px', color: HUB.textPrimary, lineHeight: '1.5', margin: 0 }}>
                         {r.retired 
                           ? `Unfortunately we had to retire the car. Reliability cost us heavily today.` 
                           : (status === 'Achieved' 
                                ? `Good drive. Managed the pace and executed the strategy to hit our target.` : status === 'Partially Achieved' ? `A solid effort — close to the target. Tyre management in the final stint was key.` 
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
             <div style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr 2fr', gap: '16px', padding: '12px 16px', borderBottom: `1px solid ${HUB.border}`, backgroundColor: HUB.bg, fontSize: '12px', color: HUB.textFaint }}>
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
                         diffColor = HUB.positive;
                      } else if (diff < 0) {
                         diffStr = `${diff}`;
                         diffColor = HUB.negative;
                      }
                   }
                }

                return (
                  <div key={r.driver.name} style={{ display: 'grid', gridTemplateColumns: '40px 40px 2fr 2fr 1fr 1fr 1fr 2fr', gap: '16px', padding: '12px 16px', alignItems: 'center', borderBottom: `1px solid ${HUB.border}`, background: isPlayerDriver ? HUB.accentSoft : 'transparent' }}>
                    <div style={{ fontSize: '14px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary }}>{i + 1}</div>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: diffColor, fontFamily: HUB.fontMono, textAlign: 'center' }}>{diffStr}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <img src={getDriverHeadshotUrl(r.driver)} alt={r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                       <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary }}>{r.driver.name}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: HUB.textMuted }}>{r.team.name}</div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.retired ? HUB.negative : HUB.textPrimary }}>{status}</div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{r.stops || (r.retired ? '-' : '1')}</div>
                    <div>
                      {r.retired ? (
                        <span style={{ ...pill(false), color: HUB.negative }}>Retired</span>
                      ) : (
                        <span style={{ ...pill(false), color: HUB.textMuted }}>Finished</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: HUB.textMuted }}>
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
