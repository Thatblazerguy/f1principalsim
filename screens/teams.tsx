import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { state } from "../state.js";
import { mountLayout, HUB, glassCard, statCell, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { Activity, Target, Zap, TrendingUp, Cpu, Settings, AlertCircle, Crosshair, BarChart3, LineChart, ChevronRight, Users } from 'lucide-react';
import { computeTeamOVR, computeTeamBreakdown } from '../utils/teamRating.js';
import { getTeamsSeasonPace, formatDelta } from '../utils/racePace.js';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScatterController
} from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, ScatterController);

// ─── Data Generation & Derivation ──────────────────────────────────────────

const assignEngineManufacturer = (teamName: string) => {
  const t = teamName.toLowerCase();
  if (t.includes('ferrari') || t.includes('haas') || t.includes('alfa')) return 'Ferrari';
  if (t.includes('red bull') || t.includes('alphatauri') || t.includes('rb')) return 'Honda RBPT';
  if (t.includes('mercedes') || t.includes('mclaren') || t.includes('aston') || t.includes('williams')) return 'Mercedes';
  if (t.includes('alpine') || t.includes('renault')) return 'Renault';
  if (t.includes('audi') || t.includes('sauber')) return 'Audi';
  return 'Honda RBPT'; // default generic fallback
};

const deriveCarMetrics = (team: any) => {
  const specs = team.specs || {};
  const car = team.car || {};
  const engineManufacturer = assignEngineManufacturer(team.name);
  const baseEngine = getEngineStats(engineManufacturer).hp;

  const aero = Math.round((specs.aero || team.carPerformance || 80) + ((car.aero || 1) - 1) * 1.5);
  const chassis = Math.round((specs.chassis || team.carPerformance || 80) + ((car.chassis || 1) - 1) * 1.5);
  const engine = Math.round(baseEngine + ((car.engine || 1) - 1) * 1.5);
  const rel = Math.round((specs.reliability || team.carPerformance || 80) + ((car.reliability || 1) - 1) * 1.5);
  
  return {
    Overall: computeTeamOVR(team),
    Aerodynamics: aero,
    PowerUnit: engine,
    MechanicalGrip: chassis,
    TyreManagement: Math.round(chassis * 0.7 + aero * 0.3),
    DragEfficiency: Math.round(aero * 0.8 + engine * 0.2),
    Cornering: Math.round(aero * 0.6 + chassis * 0.4),
    StraightLineSpeed: Math.round(engine * 0.8 + aero * 0.2),
    Reliability: rel,
    Weight: Math.round(chassis * 0.5 + rel * 0.5)
  };
};

const getEngineStats = (manufacturer: string) => {
  const mapping: any = {
    'Mercedes': { hp: 95, deploy: 98, rel: 90, fuel: 92, expectedMax: 96 },
    'Ferrari': { hp: 98, deploy: 90, rel: 85, fuel: 88, expectedMax: 99 },
    'Honda RBPT': { hp: 96, deploy: 95, rel: 94, fuel: 90, expectedMax: 97 },
    'Renault': { hp: 88, deploy: 85, rel: 80, fuel: 85, expectedMax: 90 },
    'Audi': { hp: 90, deploy: 92, rel: 88, fuel: 95, expectedMax: 95 }
  };
  return mapping[manufacturer] || mapping['Honda RBPT'];
};

const calculateActualPerformance = (teamName: string, raceRecord: any) => {
  const drivers = raceRecord.driverResults?.filter((d: any) => d.team === teamName) || [];
  if (drivers.length === 0) return null;
  const totalPos = drivers.reduce((sum: number, d: any) => sum + (d.retired ? 20 : d.finishPos), 0);
  const avgFinish = totalPos / drivers.length;
  return 95 - ((avgFinish - 1) * 1.5);
};

// ─── Component ─────────────────────────────────────────────────────────────

const PerformanceAnalytics = ({ allTeams }: { allTeams: any[] }) => {
  const s = state as any;
  const [comparisonTeam, setComparisonTeam] = useState(allTeams.find(t => t.name !== s.team!.name)?.name || 'None');
  const [activeMetricFilter, setActiveMetricFilter] = useState('Overall');

  const playerTeam = s.team || {};
  const currentYear = (s.season?.year) || 1;
  const raceHistory: any[] = (s.raceHistory || []).filter((r: any) => r.season === currentYear);
  const completedRaces = raceHistory.length;

  const playerEngine = assignEngineManufacturer(playerTeam.name);
  const playerMetrics = deriveCarMetrics(playerTeam);
  
  const rivalTeam = allTeams.find(t => t.name === comparisonTeam) || playerTeam;
  const rivalEngine = assignEngineManufacturer(rivalTeam.name);
  const rivalMetrics = deriveCarMetrics(rivalTeam);

  // -- Race pace from recorded lap times --
  const seasonPace = useMemo(() => getTeamsSeasonPace(s.raceHistory || [], currentYear), [s.raceHistory, currentYear]);
  const myPace = seasonPace.teams.find((t: any) => t.team === playerTeam.name);
  const myPaceRank = seasonPace.teams.findIndex((t: any) => t.team === playerTeam.name) + 1;
  const rivalPace = seasonPace.teams.find((t: any) => t.team === rivalTeam.name);

  // -- Insights Generation --
  const generateEngineeringInsights = () => {
    const insights = [];
    const sortedAero = [...allTeams].sort((a,b) => (b.car?.aero||0) - (a.car?.aero||0));
    const myAeroRank = sortedAero.findIndex(t => t.name === playerTeam.name) + 1;
    
    insights.push(`Our aerodynamic package ranks ${myAeroRank === 1 ? '1st' : myAeroRank === 2 ? '2nd' : myAeroRank === 3 ? '3rd' : myAeroRank + 'th'} on the grid.`);
    
    if (playerMetrics.TyreManagement < 75) insights.push("Our tyre degradation metrics are among the worst in the paddock.");
    else if (playerMetrics.TyreManagement > 90) insights.push("We possess excellent mechanical grip and tyre preservation.");

    if (playerMetrics.StraightLineSpeed > playerMetrics.Cornering + 5) insights.push("We are sacrificing cornering stability for straight-line speed.");
    else if (playerMetrics.Cornering > playerMetrics.StraightLineSpeed + 5) insights.push("We have a high-downforce platform, sacrificing top speed.");

    if (myPace) {
      insights.push(`On long-run pace we're the ${myPaceRank === 1 ? 'quickest' : `${myPaceRank}${myPaceRank === 2 ? 'nd' : myPaceRank === 3 ? 'rd' : 'th'} quickest`} car, averaging ${myPace.avgGapPct.toFixed(3)}% off the fastest.`);
      if (myPace.recentGapPct != null) {
        const delta = myPace.recentGapPct - myPace.avgGapPct;
        if (delta < -0.1) insights.push(`The last three races show us closing in: ${myPace.recentGapPct.toFixed(3)}% off, against ${myPace.avgGapPct.toFixed(3)}% on the season.`);
        else if (delta > 0.1) insights.push(`We've dropped back recently: ${myPace.recentGapPct.toFixed(3)}% off over the last three races, against ${myPace.avgGapPct.toFixed(3)}% on the season.`);
      }
    }

    if (completedRaces >= 3 && playerTeam.upgradeHistory?.length > 0) {
      insights.push(`The latest floor package has successfully correlated with factory expectations.`);
    }

    return insights;
  };

  const insights = generateEngineeringInsights();

  // -- Graph Data Prep --
  
  // 1. Grid Comparison Bar Chart
  const gridComparisonData = {
    labels: allTeams.map(t => t.name),
    datasets: [{
      label: activeMetricFilter,
      data: allTeams.map(t => {
        const metrics: any = deriveCarMetrics(t);
        return metrics[activeMetricFilter] || computeTeamOVR(t);
      }),
      backgroundColor: allTeams.map(t => t.name === playerTeam.name ? HUB.accent : 'rgba(237,237,237,0.5)'),
      borderRadius: 4,
    }]
  };
  const gridComparisonOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { min: 60, max: 100, grid: { color: HUB.border }, ticks: { color: HUB.textFaint } }, y: { grid: { display: false }, ticks: { color: HUB.textMuted } } },
    plugins: { legend: { display: false } }
  };

  // 2. Engine Radar Chart
  const manufacturers = ['Mercedes', 'Ferrari', 'Honda RBPT', 'Renault', 'Audi'];
  const pEng = getEngineStats(playerEngine);
  const rEng = getEngineStats(rivalEngine);

  const engineRadarData = {
    labels: ['Peak HP', 'Deployment', 'Reliability', 'Fuel efficiency', 'Expected ceiling'],
    datasets: [
      {
        label: playerTeam.name + ` (${playerEngine})`,
        data: [pEng.hp, pEng.deploy, pEng.rel, pEng.fuel, pEng.expectedMax],
        borderColor: HUB.accent,
        backgroundColor: 'rgba(225, 6, 0, 0.2)',
        borderWidth: 2,
      },
      {
        label: rivalTeam.name + ` (${rivalEngine})`,
        data: [rEng.hp, rEng.deploy, rEng.rel, rEng.fuel, rEng.expectedMax],
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 2,
        borderDash: [5, 5]
      }
    ]
  };
  const radarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { r: { min: 70, max: 100, grid: { color: HUB.borderMid }, angleLines: { color: HUB.borderMid }, pointLabels: { color: HUB.textMuted }, ticks: { display: false } } },
    plugins: { legend: { position: 'bottom', labels: { color: HUB.textMuted } } }
  };

  // 3. Attribute Radar Chart (Player vs Rival)
  const attrRadarData = {
    labels: ['Aerodynamics', 'Mechanical grip', 'Tyre mgmt', 'Drag efficiency', 'Cornering', 'Top speed'],
    datasets: [
      {
        label: playerTeam.name,
        data: [playerMetrics.Aerodynamics, playerMetrics.MechanicalGrip, playerMetrics.TyreManagement, playerMetrics.DragEfficiency, playerMetrics.Cornering, playerMetrics.StraightLineSpeed],
        borderColor: HUB.accent,
        backgroundColor: 'rgba(225, 6, 0, 0.2)',
        borderWidth: 2,
      },
      {
        label: rivalTeam.name,
        data: [rivalMetrics.Aerodynamics, rivalMetrics.MechanicalGrip, rivalMetrics.TyreManagement, rivalMetrics.DragEfficiency, rivalMetrics.Cornering, rivalMetrics.StraightLineSpeed],
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 2,
        borderDash: [5, 5]
      }
    ]
  };

  // 4. Projected vs Actual History — sorted by round, non-linear projection
  const sortedHistory = [...raceHistory].sort((a: any, b: any) => a.round - b.round);

  const upgrades = playerTeam.upgradeHistory || [];

  // Build actual data — only for rounds we have completed
  const actualData: { round: number; label: string; actual: number }[] = [];
  let runningProj = playerTeam.carPerformance ?? 80;

  sortedHistory.forEach((race: any) => {
    const actual = calculateActualPerformance(playerTeam.name, race);
    actualData.push({
      round: race.round,
      label: `R${race.round}`,
      actual: actual ?? runningProj,
    });
  });

  // Build projected data — all completed rounds PLUS future rounds up to totalRounds
  // Non-linear: small incremental baseline drift + upgrade spikes
  const totalRounds = Math.max(actualData.length, (state as any).season?.totalRounds || 24);
  const completedRoundNums = new Set(sortedHistory.map((r: any) => r.round));
  const allRounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  let projBase = playerTeam.carPerformance ?? 80;
  const projectedByRound: number[] = allRounds.map((round) => {
    const upg = upgrades.find((u: any) => u.round === round);
    if (upg) {
      // Upgrade delivers a bump — between 0.8 and 2.5 OVR depending on gain
      projBase = parseFloat((projBase + (upg.expectedGain ?? 1.5) * 0.8).toFixed(2));
    } else {
      // Organic development: faster earlier, tapering off
      const roundProgress = round / totalRounds;
      const baseGain = 0.05 + (1 - roundProgress) * 0.15;
      // Add small random-but-seeded variation using round number as deterministic seed
      const variation = ((round * 7919) % 100) / 1000 - 0.05; // -0.05 to +0.045
      projBase = parseFloat((projBase + baseGain + variation).toFixed(2));
    }
    return projBase;
  });

  // Labels: only completed rounds on x-axis
  const labels = actualData.map(h => h.label);
  // Projected for completed rounds only (slice to match)
  const projectedSlice = allRounds
    .slice(0, completedRoundNums.size)
    .map(r => projectedByRound[r - 1]);

  // Full projected pace for ALL rounds (shown as future forecast beyond actuals)
  const fullProjectedLabels = allRounds.map(r => `R${r}`);
  const upgradePoints = allRounds.map(r => {
    const upg = upgrades.find((u: any) => u.round === r);
    return upg ? projectedByRound[r - 1] : null;
  });

  const projVsActualData = {
    labels: fullProjectedLabels,
    datasets: [
      {
        label: 'Projected pace',
        data: projectedByRound,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
      {
        label: 'Actual pace',
        data: [
          ...actualData.map(h => h.actual),
          // null-pad the rest of the future rounds
          ...Array(Math.max(0, totalRounds - actualData.length)).fill(null)
        ],
        borderColor: HUB.accent,
        backgroundColor: HUB.accent,
        borderWidth: 2,
        pointRadius: (ctx: any) => ctx.dataIndex < actualData.length ? 4 : 0,
        fill: false,
        tension: 0.3,
        spanGaps: false,
      },
      {
        label: 'Upgrades',
        data: upgradePoints,
        type: 'scatter',
        backgroundColor: HUB.textPrimary,
        borderColor: HUB.bg,
        borderWidth: 2,
        pointRadius: 8,
        pointStyle: 'rectRot',
        showLine: false,
      } as any
    ]
  };

  const lineOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint } }, y: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint } } },
    plugins: { legend: { position: 'bottom', labels: { color: HUB.textMuted } } }
  };

  return (
    <div style={{ paddingBottom: '80px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {pageTitle('Teams')}
          {pageSubtitle(completedRaces < 3 
            ? 'Pre-season car ratings and grid estimates.'
            : `Projected and actual pace across ${completedRaces} races.`)}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={statCell()}>{statLabel('Races logged')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', color:HUB.textPrimary, fontSize:'18px', fontWeight: 400}}>{completedRaces}</span></div>
          <div style={statCell()}>
            {statLabel('Compare against')}
            <select 
              value={comparisonTeam} 
              onChange={(e) => setComparisonTeam(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: HUB.textPrimary, fontSize: '14px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", outline: 'none', cursor: 'pointer' }}
            >
              {allTeams.filter(t => t.name !== playerTeam.name).map(t => (
                <option key={t.name} value={t.name} style={{ background: HUB.bg, color: HUB.textPrimary }}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* --- GRID COMPARISON (Always visible, adapts to filter) --- */}
        <div style={{ gridColumn: 'span 8', ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={16} strokeWidth={1.5} color={HUB.textMuted} /> Constructor order</h3>
             <div style={{ display: 'flex', gap: '8px' }}>
               {['Overall', 'Aerodynamics', 'PowerUnit', 'TyreManagement'].map(metric => (
                 <button 
                   key={metric}
                   onClick={() => setActiveMetricFilter(metric)}
                   style={{ background: activeMetricFilter === metric ? HUB.accentSoft : HUB.raised, border: `1px solid ${activeMetricFilter === metric ? 'rgba(225,6,0,0.4)' : HUB.border}`, color: activeMetricFilter === metric ? HUB.textPrimary : HUB.textMuted, height: '28px', padding: '0 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}
                 >
                   {metric === 'PowerUnit' ? 'Power unit' : metric === 'TyreManagement' ? 'Tyre management' : metric}
                 </button>
               ))}
             </div>
          </div>
          <div style={{ height: '350px' }}>
             <Bar data={gridComparisonData} options={gridComparisonOptions} />
          </div>
        </div>

        {/* --- ENGINEERING INSIGHTS --- */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ ...glassCard({ padding: '24px' }), flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={16} strokeWidth={1.5} color={HUB.textMuted} /> Engineering brief</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {insights.map((note, i) => (
                 <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                   <ChevronRight size={16} strokeWidth={1.5} color={HUB.textFaint} style={{ marginTop: '1px', flexShrink: 0 }} />
                   <p style={{ fontSize: '13px', color: HUB.textPrimary, margin: 0, lineHeight: 1.5 }}>{note}</p>
                 </div>
               ))}
            </div>
          </div>

          <div style={{ ...glassCard({ padding: '24px' }) }}>
             <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={16} strokeWidth={1.5} color={HUB.textMuted} /> Development trajectory</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Current base OVR</span><span style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontMono }}>{playerTeam.carPerformance}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Projected ceiling</span><span style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontMono }}>{Math.round(playerTeam.carPerformance + (playerTeam.budget / 10))}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Confidence interval</span><span style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>87%</span></div>
             </div>
          </div>

        </div>

        {/* --- CAR ATTRIBUTES RADAR --- */}
        <div style={{ gridColumn: 'span 6', ...glassCard({ padding: '24px' }) }}>
           <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Crosshair size={16} strokeWidth={1.5} color={HUB.textMuted} /> Car profile vs {rivalTeam.name}</h3>
           <div style={{ height: '300px' }}>
              <Radar data={attrRadarData} options={radarOptions} />
           </div>
        </div>

        {/* --- POWER UNIT RADAR --- */}
        <div style={{ gridColumn: 'span 6', ...glassCard({ padding: '24px' }) }}>
           <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} strokeWidth={1.5} color={HUB.textMuted} /> Power unit</h3>
           <div style={{ height: '300px' }}>
              <Radar data={engineRadarData} options={radarOptions} />
           </div>
        </div>

        {/* --- PROGRESSIVE UNLOCK: PROJECTED VS ACTUAL (Requires 3+ races) --- */}
        <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }), opacity: completedRaces >= 3 ? 1 : 0.5, position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><LineChart size={16} strokeWidth={1.5} color={HUB.textMuted} /> Projected vs actual pace</h3>
             {completedRaces >= 3 && <span style={pill(false)}>Tracking</span>}
          </div>

          {completedRaces < 3 ? (
             <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: HUB.bg, borderRadius: '8px', border: `1px dashed ${HUB.borderMid}` }}>
                <Activity size={24} strokeWidth={1.5} color={HUB.textMuted} style={{ marginBottom: '16px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: '0 0 8px' }}>Not enough races yet</h4>
                <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>This chart needs at least 3 completed races</p>
             </div>
          ) : (
             <div style={{ height: '350px' }}>
                <Line data={projVsActualData} options={lineOptions} />
             </div>
          )}

        </div>


        {/* --- RACE PACE (from recorded lap times) --- */}
        <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} strokeWidth={1.5} color={HUB.textMuted} /> Race pace</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: HUB.textFaint }}>Median clean-lap pace of each team's quicker car, as a gap to the fastest car in each race</p>
            </div>
            {seasonPace.analysedRaces > 0 && <span style={pill(false)}>{seasonPace.analysedRaces} {seasonPace.analysedRaces === 1 ? 'race' : 'races'} analysed</span>}
          </div>

          {seasonPace.teams.length === 0 ? (
            <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: HUB.bg, borderRadius: '8px', border: `1px dashed ${HUB.borderMid}` }}>
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>Race pace appears after the first race with recorded lap times</p>
            </div>
          ) : (
            <>
              {myPace && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { label: 'Pace order', val: `P${myPaceRank}`, sub: `of ${seasonPace.teams.length} teams` },
                    myPaceRank === 1 && seasonPace.teams[1]
                      ? { label: 'Margin to P2', val: `${(seasonPace.teams[1].avgGapPct - myPace.avgGapPct).toFixed(3)}%`, sub: `Clear of ${seasonPace.teams[1].team} on average`, color: HUB.positive }
                      : { label: 'Avg gap to fastest', val: `${myPace.avgGapPct.toFixed(3)}%`, sub: `Best ${myPace.bestGapPct.toFixed(3)}% · worst ${myPace.worstGapPct.toFixed(3)}%` },
                    { label: 'Last 3 races', val: myPace.recentGapPct == null ? '–' : myPace.recentGapPct < 0.0005 ? 'Fastest' : `${myPace.recentGapPct.toFixed(3)}%`, sub: myPace.recentGapPct == null ? 'Needs 3 races' : myPace.recentGapPct < myPace.avgGapPct - 0.05 ? 'Gaining' : myPace.recentGapPct > myPace.avgGapPct + 0.05 ? 'Losing ground' : 'Steady', color: myPace.recentGapPct == null ? HUB.textPrimary : myPace.recentGapPct < myPace.avgGapPct - 0.05 ? HUB.positive : myPace.recentGapPct > myPace.avgGapPct + 0.05 ? HUB.negative : HUB.textPrimary },
                    { label: 'Tyre drop-off', val: myPace.avgTrend == null ? '–' : `${formatDelta(myPace.avgTrend)}s`, sub: 'Per lap within a stint' },
                    { label: `vs ${rivalTeam.name}`, val: rivalPace ? `${formatDelta(myPace.avgGapPct - rivalPace.avgGapPct, 3)}%` : '–', sub: rivalPace ? (myPace.avgGapPct < rivalPace.avgGapPct ? 'We are quicker' : 'They are quicker') : 'No data', color: rivalPace ? (myPace.avgGapPct < rivalPace.avgGapPct ? HUB.positive : HUB.negative) : HUB.textPrimary },
                  ].map(k => (
                    <div key={k.label} style={statCell({ padding: '16px' })}>
                      <span style={{ display: 'block', fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>{k.label}</span>
                      <span style={{ display: 'block', fontSize: '20px', color: (k as any).color || HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>{k.val}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>{k.sub}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Season average gap to fastest (%)</div>
                  <div style={{ height: '300px' }}>
                    <Bar
                      data={{
                        labels: seasonPace.teams.map((t: any) => t.team),
                        datasets: [{
                          label: 'Avg gap',
                          data: seasonPace.teams.map((t: any) => Number(t.avgGapPct.toFixed(4))),
                          backgroundColor: seasonPace.teams.map((t: any) => t.team === playerTeam.name ? HUB.accent : t.team === rivalTeam.name ? 'rgba(237,237,237,0.7)' : 'rgba(237,237,237,0.35)'),
                          borderRadius: 4,
                        }],
                      }}
                      options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { x: { min: 0, grid: { color: HUB.border }, ticks: { color: HUB.textFaint, callback: (v: any) => `${v}%` } }, y: { grid: { display: false }, ticks: { color: HUB.textMuted } } },
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `+${c.parsed.x.toFixed(3)}% per lap` } } },
                      } as any}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Gap to fastest by round (%)</div>
                  <div style={{ height: '300px' }}>
                    {(() => {
                      const rounds = Array.from(new Set(seasonPace.teams.flatMap((t: any) => t.races.map((r: any) => r.round)))).sort((a: any, b: any) => a - b) as number[];
                      const series = (t: any) => rounds.map(rd => t?.races.find((r: any) => r.round === rd)?.gapPct ?? null);
                      return (
                        <Line
                          data={{
                            labels: rounds.map(r => `R${r}`),
                            datasets: [
                              { label: playerTeam.name, data: series(myPace), borderColor: HUB.accent, backgroundColor: HUB.accent, borderWidth: 2, pointRadius: 4, tension: 0.25, spanGaps: true },
                              ...(rivalPace ? [{ label: rivalTeam.name, data: series(rivalPace), borderColor: 'rgba(237,237,237,0.6)', backgroundColor: 'rgba(237,237,237,0.6)', borderDash: [5, 5], borderWidth: 2, pointRadius: 3, tension: 0.25, spanGaps: true }] : []),
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { min: 0, grid: { color: HUB.border }, ticks: { color: HUB.textFaint, callback: (v: any) => `${Number(v).toFixed(2)}%` } }, x: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint } } },
                            plugins: { legend: { position: 'bottom', labels: { color: HUB.textMuted } }, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c: any) => c.parsed.y == null ? null : `${c.dataset.label}: +${c.parsed.y.toFixed(3)}%` } } },
                          } as any}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '820px' }}>
                  {(() => {
                    const cols = '40px 1.6fr 80px 90px 90px 90px 70px 90px 70px 90px';
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '12px', padding: '8px 12px', fontSize: '12px', color: HUB.textFaint, background: HUB.bg, borderRadius: '8px 8px 0 0' }}>
                          <div>#</div><div>Team</div><div>Avg rank</div><div>Avg gap</div><div>Best</div><div>Last 3</div><div>Fastest</div><div>Drop-off</div><div>Cons.</div><div>Car gap</div>
                        </div>
                        {seasonPace.teams.map((t: any, i: number) => {
                          const isMe = t.team === playerTeam.name;
                          const recentDelta = t.recentGapPct == null ? null : t.recentGapPct - t.avgGapPct;
                          return (
                            <div key={t.team} style={{ display: 'grid', gridTemplateColumns: cols, gap: '12px', padding: '10px 12px', fontSize: '12px', alignItems: 'center', borderBottom: `1px solid ${HUB.border}`, background: isMe ? HUB.accentSoft : 'transparent', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>
                              <div style={{ color: HUB.textMuted }}>{i + 1}</div>
                              <div style={{ fontFamily: HUB.fontBold, color: isMe ? HUB.accentInk : HUB.textPrimary }}>{t.team}</div>
                              <div>P{t.avgPaceRank.toFixed(1)}</div>
                              <div>{t.avgGapPct < 0.0005 ? '—' : `+${t.avgGapPct.toFixed(3)}%`}</div>
                              <div style={{ color: HUB.textMuted }}>{t.bestGapPct < 0.0005 ? 'Fastest' : `+${t.bestGapPct.toFixed(3)}%`}</div>
                              <div style={{ color: recentDelta == null ? HUB.textFaint : recentDelta < -0.05 ? HUB.positive : recentDelta > 0.05 ? HUB.negative : HUB.textMuted }}>{t.recentGapPct == null ? '–' : `+${t.recentGapPct.toFixed(3)}%`}</div>
                              <div style={{ color: t.fastestCount ? HUB.textPrimary : HUB.textFaint }}>{t.fastestCount}</div>
                              <div style={{ color: HUB.textMuted }}>{t.avgTrend == null ? '–' : `${formatDelta(t.avgTrend)}s`}</div>
                              <div style={{ color: t.avgConsistency >= 75 ? HUB.positive : t.avgConsistency >= 50 ? HUB.warning : HUB.negative }}>{t.avgConsistency}</div>
                              <div style={{ color: HUB.textMuted }}>{t.avgIntraGap == null ? '–' : `${t.avgIntraGap.toFixed(3)}s`}</div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>
              <span style={{ display: 'block', marginTop: '12px', fontSize: '11px', color: HUB.textFaint }}>
                Gaps are in percent so different circuits compare fairly. Drop-off is the average lap-time trend within a stint. Car gap is the average per-lap difference between the two drivers.
              </span>
            </>
          )}
        </div>

        {/* --- GRID LINEUPS --- */}
        <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }), marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: HUB.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={16} strokeWidth={1.5} color={HUB.textMuted} /> 2026 constructor grid</h3>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>Weighted rating model</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {allTeams.map(team => {
              const bd: any = computeTeamBreakdown(team);
              const isPlayerTeam = team.name === playerTeam.name;
              const barColor = isPlayerTeam ? HUB.accent : 'rgba(237,237,237,0.5)';
              const attrs = [
                { label: 'Car perf', value: bd.carPerf, color: barColor },
                { label: 'Aero', value: bd.aero, color: barColor },
                { label: 'Mech. grip', value: bd.mechanicalGrip, color: barColor },
                { label: 'Reliability', value: bd.reliability, color: barColor },
                { label: 'Driver pair', value: bd.driverPair, color: barColor },
                { label: 'Dev. rate', value: bd.devRate, color: barColor },
                { label: 'Team ops', value: bd.teamOps, color: barColor },
              ];
              const ovrColor = HUB.textPrimary;
              return (
                <div key={team.name} style={{ background: HUB.raised, borderRadius: '14px', border: `1px solid ${isPlayerTeam ? 'rgba(225,6,0,0.4)' : HUB.border}`, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: HUB.fontBold, fontSize: '14px', color: HUB.textPrimary }}>{team.name}</div>
                      <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '2px' }}>
                        {team.drivers?.map((d: any) => d.name.split(' ').pop()).join(' / ') || 'No drivers'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: HUB.fontMono, fontSize: '22px', fontWeight: 400, color: ovrColor, lineHeight: 1 }}>{bd.overall}</div>
                      <div style={{ fontSize: '11px', color: HUB.textMuted }}>OVR</div>
                    </div>
                  </div>

                  {/* Attribute Bars */}
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attrs.map(attr => (
                      <div key={attr.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: HUB.textMuted, width: '72px', flexShrink: 0, fontFamily: HUB.fontRegular }}>{attr.label}</span>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(237,237,237,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${((attr.value - 55) / (99 - 55)) * 100}%`, height: '100%', background: attr.color, borderRadius: '2px', transition: `width 400ms ${HUB.ease}` }} />
                        </div>
                        <span style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: HUB.textPrimary, width: '24px', textAlign: 'right', flexShrink: 0 }}>{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export const renderTeams = (root: HTMLElement) => {
  const s = state as any;
  if (!s.team) {
    mountLayout(root, 'teams', <div style={{ color: HUB.textPrimary, padding: '40px', textAlign: 'center' }}>No team selected. Complete setup first</div>, () => renderTeams(root));
    return;
  }
  
  const allTeams = [s.team, ...(s.aiTeams || [])].sort((a, b) => b.carPerformance - a.carPerformance);
  mountLayout(root, 'teams', <PerformanceAnalytics allTeams={allTeams} />, () => renderTeams(root));
};
