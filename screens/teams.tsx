import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { state } from "../state.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { Activity, Target, Zap, TrendingUp, Cpu, Settings, AlertCircle, Crosshair, BarChart3, LineChart, ChevronRight } from 'lucide-react';

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
  Filler
} from 'chart.js';
import { Line, Bar, Radar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

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

const deriveCarMetrics = (car: any, ovr: number) => {
  const aero = car?.aero || 80;
  const chassis = car?.chassis || 80;
  const engine = car?.engine || 80;
  const rel = car?.reliability || 80;
  
  return {
    Overall: ovr,
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
  const raceHistory: any[] = s.raceHistory || [];
  const completedRaces = raceHistory.length;

  const playerEngine = assignEngineManufacturer(playerTeam.name);
  const playerMetrics = deriveCarMetrics(playerTeam.car, playerTeam.carPerformance);
  
  const rivalTeam = allTeams.find(t => t.name === comparisonTeam) || playerTeam;
  const rivalEngine = assignEngineManufacturer(rivalTeam.name);
  const rivalMetrics = deriveCarMetrics(rivalTeam.car, rivalTeam.carPerformance);

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
        const metrics: any = deriveCarMetrics(t.car, t.carPerformance);
        return metrics[activeMetricFilter] || t.carPerformance;
      }),
      backgroundColor: allTeams.map(t => t.name === playerTeam.name ? HUB.accent : 'rgba(255,255,255,0.1)'),
      borderRadius: 4,
    }]
  };
  const gridComparisonOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: { x: { min: 60, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { display: false } } },
    plugins: { legend: { display: false } }
  };

  // 2. Engine Radar Chart
  const manufacturers = ['Mercedes', 'Ferrari', 'Honda RBPT', 'Renault', 'Audi'];
  const pEng = getEngineStats(playerEngine);
  const rEng = getEngineStats(rivalEngine);

  const engineRadarData = {
    labels: ['Peak HP', 'Deployment', 'Reliability', 'Fuel Efficiency', 'Expected Ceiling'],
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
    scales: { r: { min: 70, max: 100, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' }, ticks: { display: false } } },
    plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }
  };

  // 3. Attribute Radar Chart (Player vs Rival)
  const attrRadarData = {
    labels: ['Aerodynamics', 'Mechanical Grip', 'Tyre Mgmt', 'Drag Efficiency', 'Cornering', 'Top Speed'],
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
  const totalRounds = (state as any).season?.totalRounds || 24;
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
        label: 'Projected Pace',
        data: projectedByRound,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
      {
        label: 'Actual Pace',
        data: [
          ...actualData.map(h => h.actual),
          // null-pad the rest of the future rounds
          ...Array(totalRounds - actualData.length).fill(null)
        ],
        borderColor: HUB.accent,
        backgroundColor: 'rgba(225, 6, 0, 0.08)',
        borderWidth: 3,
        pointRadius: (ctx: any) => ctx.dataIndex < actualData.length ? 4 : 0,
        fill: true,
        tension: 0.3,
        spanGaps: false,
      },
      {
        label: 'Upgrades',
        data: upgradePoints,
        type: 'scatter',
        backgroundColor: '#f59e0b',
        borderColor: '#fff',
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
    scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { color: 'rgba(255,255,255,0.05)' } } },
    plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } }
  };

  return (
    <div style={{ paddingBottom: '80px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {sectionLabel('Factory Diagnostics')}
          {pageTitle('Team Performance Analytics')}
          {pageSubtitle(completedRaces < 3 
            ? 'Pre-season engineering evaluation and grid estimations.'
            : `Telemetry and track data correlation over ${completedRaces} races.`)}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={statCell()}>{statLabel('Races Logged')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', color:'#fff', fontSize:'18px', fontWeight:800}}>{completedRaces}</span></div>
          <div style={statCell()}>
            {statLabel('Rival Comparison')}
            <select 
              value={comparisonTeam} 
              onChange={(e) => setComparisonTeam(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: HUB.accent, fontSize: '14px', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
            >
              {allTeams.filter(t => t.name !== playerTeam.name).map(t => (
                <option key={t.name} value={t.name} style={{ background: '#111', color: '#fff' }}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* --- GRID COMPARISON (Always visible, adapts to filter) --- */}
        <div style={{ gridColumn: 'span 8', ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart3 size={16} color={HUB.accent} /> Constructor Hierarchy</h3>
             <div style={{ display: 'flex', gap: '8px' }}>
               {['Overall', 'Aerodynamics', 'PowerUnit', 'TyreManagement'].map(metric => (
                 <button 
                   key={metric}
                   onClick={() => setActiveMetricFilter(metric)}
                   style={{ background: activeMetricFilter === metric ? HUB.accent : 'rgba(255,255,255,0.05)', border: 'none', color: activeMetricFilter === metric ? '#fff' : HUB.textMuted, padding: '4px 12px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                 >
                   {metric.replace(/([A-Z])/g, ' $1').trim()}
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
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={16} /> Engineering Brief</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {insights.map((note, i) => (
                 <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                   <ChevronRight size={14} color={HUB.accent} style={{ marginTop: '2px', flexShrink: 0 }} />
                   <p style={{ fontSize: '13px', color: '#e5e7eb', margin: 0, lineHeight: 1.4 }}>{note}</p>
                 </div>
               ))}
            </div>
          </div>

          <div style={{ ...glassCard({ padding: '24px' }) }}>
             <h3 style={{ fontSize: '12px', fontWeight: 800, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={16} /> Development Trajectory</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Current Base OVR</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>{playerTeam.carPerformance}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Projected Ceiling</span><span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700, fontFamily: HUB.fontMono }}>{Math.round(playerTeam.carPerformance + (playerTeam.budget / 10))}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Confidence Interval</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>87%</span></div>
             </div>
          </div>

        </div>

        {/* --- CAR ATTRIBUTES RADAR --- */}
        <div style={{ gridColumn: 'span 6', ...glassCard({ padding: '24px' }) }}>
           <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Crosshair size={16} color={HUB.accent} /> Telemetry Profile (vs {rivalTeam.name})</h3>
           <div style={{ height: '300px' }}>
              <Radar data={attrRadarData} options={radarOptions} />
           </div>
        </div>

        {/* --- POWER UNIT RADAR --- */}
        <div style={{ gridColumn: 'span 6', ...glassCard({ padding: '24px' }) }}>
           <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} color={HUB.accent} /> Power Unit Evaluation</h3>
           <div style={{ height: '300px' }}>
              <Radar data={engineRadarData} options={radarOptions} />
           </div>
        </div>

        {/* --- PROGRESSIVE UNLOCK: PROJECTED VS ACTUAL (Requires 3+ races) --- */}
        <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }), opacity: completedRaces >= 3 ? 1 : 0.5, position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><LineChart size={16} color={HUB.accent} /> Track Correlation (Projected vs Actual)</h3>
             {completedRaces >= 3 && <span style={{ ...pill(true), background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Live Tracking</span>}
          </div>

          {completedRaces < 3 ? (
             <div style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Activity size={32} color={HUB.textMuted} style={{ marginBottom: '16px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Insufficient Track Data</h4>
                <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>This diagnostic graph requires at least 3 completed races to form a reliable correlation trendline.</p>
             </div>
          ) : (
             <div style={{ height: '350px' }}>
                <Line data={projVsActualData} options={lineOptions} />
             </div>
          )}

        </div>

      </div>
    </div>
  );
};

export const renderTeams = (root: HTMLElement) => {
  const s = state as any;
  if (!s.team) {
    mountLayout(root, 'teams', <div style={{ color: '#fff', padding: '40px', textAlign: 'center' }}>No team selected. Complete setup first.</div>, () => renderTeams(root));
    return;
  }
  
  const allTeams = [s.team, ...(s.aiTeams || [])].sort((a, b) => b.carPerformance - a.carPerformance);
  mountLayout(root, 'teams', <PerformanceAnalytics allTeams={allTeams} />, () => renderTeams(root));
};
