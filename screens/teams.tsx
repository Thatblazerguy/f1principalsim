import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers } from "../utils/teamState.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, pill, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { Activity, Target, Zap, Crosshair, TrendingUp, Cpu, Settings, AlertCircle, CheckCircle, BarChart3, LineChart, Users } from 'lucide-react';

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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ─── Helper Functions ───────────────────────────────────────────────────────

function calculateActualPerformance(teamName, raceRecord) {
  const drivers = raceRecord.driverResults?.filter(d => d.team === teamName) || [];
  if (drivers.length === 0) return null;
  // If a driver retired, we count their finish pos as 20th to penalize performance.
  const totalPos = drivers.reduce((sum, d) => sum + (d.retired ? 20 : d.finishPos), 0);
  const avgFinish = totalPos / drivers.length;
  // Map average finish (1-20) to a performance rating (approx 95 to 65).
  // P1 = 95, P20 = 66.5
  return 95 - ((avgFinish - 1) * 1.5);
}

// Generates textual insights based on performance history
function generateInsights(historyData, upgradeHistory) {
  const insights = [];
  if (historyData.length < 2) {
    return ["Insufficient data to generate engineering insights. Complete more races."];
  }

  const recent = historyData.slice(-3);
  const currentPerf = recent[recent.length - 1];
  const delta = currentPerf.actual - currentPerf.projected;

  if (delta > 2) {
    insights.push("The car is currently overperforming aerodynamic expectations.");
  } else if (delta < -2) {
    insights.push("We are failing to extract the projected pace from the car. Check driver extraction or reliability.");
  } else {
    insights.push("Actual track performance correlates closely with wind tunnel projections.");
  }

  // Trend
  const first = historyData[0];
  const paceImprovement = currentPerf.actual - first.actual;
  if (paceImprovement > 3) {
    insights.push("Race pace has improved significantly since the start of the season.");
  } else if (paceImprovement < -3) {
    insights.push("Relative pace has dropped off significantly. Rivals are out-developing us.");
  }

  // Upgrades
  if (upgradeHistory && upgradeHistory.length > 0) {
    const latestUpgrade = upgradeHistory[upgradeHistory.length - 1];
    insights.push(`The latest ${latestUpgrade.part} upgrade appears to be functioning within operational windows.`);
  } else {
    insights.push("The aerodynamic package has stagnated. Factory R&D is highly recommended.");
  }

  return insights;
}

// ─── Main Component ─────────────────────────────────────────────────────────

const PerformanceAnalytics = ({ allTeams }) => {
  const [comparisonTeam, setComparisonTeam] = useState('None');
  const [circuitFilter, setCircuitFilter] = useState('All');

  const playerTeam: any = state.team || {};
  const raceHistory: any[] = state.raceHistory || [];

  // ── Data Processing ──
  const processTeamHistory = (team) => {
    let currentProj = 80; // Baseline
    return raceHistory.map(race => {
      let projected = race.teamResults?.find(t => t.team === team.name)?.carPerformance;
      // Fallback for legacy saves or missing data
      if (!projected) projected = currentProj;
      else currentProj = projected;

      const actual = calculateActualPerformance(team.name, race);
      return {
        round: race.round,
        name: race.name,
        weather: race.weather || 'dry',
        projected,
        actual: actual || projected // Fallback if no actual
      };
    });
  };

  let playerHistory = processTeamHistory(playerTeam);
  
  // Circuit Filtering
  if (circuitFilter !== 'All') {
    playerHistory = playerHistory.filter(h => {
      if (circuitFilter === 'Wet' && h.weather === 'wet') return true;
      if (circuitFilter === 'Dry' && h.weather !== 'wet') return true;
      // TODO: Add high downforce/speed logic if track circuit type is stored in race history
      return false; // For now, if not wet/dry, hide (placeholder for track layout filter)
    });
    // Reset to all if filter resulted in empty array to avoid chart breaking
    if (playerHistory.length === 0) playerHistory = processTeamHistory(playerTeam);
  }

  const comparisonHistory = comparisonTeam !== 'None' 
    ? processTeamHistory(allTeams.find(t => t.name === comparisonTeam)) 
    : [];

  const labels = playerHistory.map(h => `R${h.round}`);
  const projectedData = playerHistory.map(h => h.projected);
  const actualData = playerHistory.map(h => h.actual);

  // Upgrade Markers
  const upgrades = playerTeam.upgradeHistory || [];
  const upgradePoints = playerHistory.map(h => {
    const upg = upgrades.find(u => u.round === h.round);
    return upg ? h.projected : null;
  });

  const datasets = [
    {
      label: 'Projected Performance',
      data: projectedData,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Actual Performance',
      data: actualData,
      borderColor: HUB.accent,
      backgroundColor: 'rgba(225, 6, 0, 0.1)',
      borderWidth: 3,
      pointRadius: 4,
      pointBackgroundColor: '#fff',
      pointBorderColor: HUB.accent,
      tension: 0.3,
      fill: true,
      segment: {
        borderColor: (ctx: any) => {
          if (!ctx.p0DataIndex || !ctx.p1DataIndex) return HUB.accent;
          const proj = projectedData[ctx.p0DataIndex];
          const act = actualData[ctx.p0DataIndex];
          return act >= proj ? '#10b981' : '#ef4444'; // Green if overperforming, Red if under
        }
      }
    },
    {
      label: 'Upgrades',
      data: upgradePoints,
      type: 'scatter',
      backgroundColor: '#f59e0b',
      borderColor: '#fff',
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 10,
      pointStyle: 'rectRot',
      showLine: false,
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const upg = upgrades.find((u: any) => u.round === playerHistory[context.dataIndex].round);
            return `UPGRADE: ${upg?.part || 'Unknown'} (+${upg?.expectedGain || 1.5} OVR)`;
          }
        }
      }
    }
  ];

  if (comparisonTeam !== 'None') {
    datasets.push({
      label: `${comparisonTeam} Projected`,
      data: comparisonHistory.map((h: any) => h.projected),
      borderColor: 'rgba(59, 130, 246, 0.3)',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    } as any);
    datasets.push({
      label: `${comparisonTeam} Actual`,
      data: comparisonHistory.map((h: any) => h.actual),
      borderColor: '#3b82f6', // Blue for rival
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    } as any);
  }

  const chartData: any = { labels, datasets };
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { color: '#ccc', usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        backgroundColor: 'rgba(10,10,20,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#ccc',
        callbacks: {
          label: (ctx: any) => {
            if (ctx.dataset.label === 'Upgrades') return `UPGRADE: ${upgrades.find((u: any) => u.round === playerHistory[ctx.dataIndex].round)?.part}`;
            return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      y: { min: 60, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
    }
  };

  // KPIs
  const allTeamPerfs = allTeams.map(t => ({ name: t.name, perf: t.carPerformance })).sort((a,b) => b.perf - a.perf);
  const currentPaceRank = allTeamPerfs.findIndex(t => t.name === playerTeam.name) + 1;
  const recentPerf = playerHistory[playerHistory.length - 1];
  const delta = recentPerf ? (recentPerf.actual - recentPerf.projected).toFixed(1) : 0;
  const isOverperforming = recentPerf && recentPerf.actual >= recentPerf.projected;

  const insights = generateInsights(playerHistory, upgrades);

  // R&D Effectiveness
  const numUpgrades = upgrades.length;
  const engineeringEfficiency = numUpgrades > 0 ? Math.min(100, 70 + (numUpgrades * 5) + (isOverperforming ? 10 : -5)) : 50;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['All', 'Dry', 'Wet'].map(f => (
            <button key={f} onClick={() => setCircuitFilter(f)} style={{
              background: circuitFilter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: `1px solid ${circuitFilter === f ? 'rgba(255,255,255,0.2)' : 'transparent'}`,
              color: circuitFilter === f ? '#fff' : HUB.textMuted,
              padding: '6px 16px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s'
            }}>{f} Races</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase' }}>Compare Rivals:</span>
          <select 
            value={comparisonTeam} 
            onChange={e => setComparisonTeam(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: `1px solid ${HUB.border}`, padding: '6px 12px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
          >
            <option value="None">None</option>
            {allTeams.filter(t => t.name !== playerTeam.name).map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        {/* Main Graph Area */}
        <div style={{ ...glassCard(), display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LineChart size={18} color={HUB.accent} /> Projected vs Actual Performance
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: HUB.textMuted }}>Continuous tracking of factory wind tunnel projections against actual track pace.</p>
            </div>
            {recentPerf && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }}>Current Delta</span>
                <span style={{ 
                  fontSize: '24px', fontWeight: 800, fontFamily: HUB.fontMono,
                  color: isOverperforming ? '#10b981' : '#ef4444',
                  background: isOverperforming ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '4px 12px', borderRadius: '4px', display: 'inline-block'
                }}>
                  {isOverperforming ? '+' : ''}{delta}
                </span>
                <div style={{ fontSize: '10px', color: isOverperforming ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                  {isOverperforming ? 'Overperforming' : 'Underperforming'}
                </div>
              </div>
            )}
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            {playerHistory.length > 0 ? (
               <Line data={chartData} options={chartOptions} />
            ) : (
               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.textMuted, fontSize: '14px' }}>
                 No historical race data available yet.
               </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: KPIs & Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={glassCard({ padding: '20px' })}>
            <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={14} color={HUB.accent} /> Performance Breakdown
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
                  <span>Pace Rank</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>P{currentPaceRank}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                  <div style={{ width: `${Math.max(0, 100 - (currentPaceRank * 8))}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
                  <span>Engineering Efficiency</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{engineeringEfficiency}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                  <div style={{ width: `${engineeringEfficiency}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
                  <span>Reliability Score</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{playerTeam.car?.reliability || 80}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                  <div style={{ width: `${playerTeam.car?.reliability || 80}%`, height: '100%', background: '#f59e0b', borderRadius: '2px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* AI Engineering Insights */}
          <div style={{ ...glassCard({ padding: '20px' }), flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={14} color={HUB.accent} /> Engineering Insights
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
              {insights.map((insight, i) => (
                <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: `2px solid ${HUB.accent}` }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#ccc', lineHeight: '1.5' }}>{insight}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Projected Season Trend */}
          <div style={{ ...glassCard({ padding: '20px' }), background: `linear-gradient(145deg, rgba(225,6,0,0.05) 0%, rgba(0,0,0,0.2) 100%)` }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={14} color={HUB.accent} /> Season Projection
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Expected Constructors</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>P{currentPaceRank}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Expected Final OVR</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', fontFamily: HUB.fontMono }}>{(playerTeam.carPerformance + (24 - (state.season.round || 1)) * 0.5).toFixed(1)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Legacy Roster Component ────────────────────────────────────────────────
const buildDriverRow = (driver, role, highlight) => {
  const number = getDriverNumber(driver);
  return (
    <div key={driver.name} style={{
      display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px',
      borderBottom:`1px solid ${HUB.border}`, background: highlight ? 'rgba(225,6,0,0.06)' : 'transparent',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
        <span style={{fontSize:'13px', fontWeight:700, color:HUB.textMuted, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', minWidth:'24px'}}>#{number}</span>
        <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}`}} loading="lazy"/>
        <div>
          <p style={{fontSize:'14px', fontWeight:700, color:'#fff', margin:'0 0 2px'}}>{driver.name}</p>
          <p style={{fontSize:'10px', color:HUB.textMuted, textTransform:'uppercase', margin:0}}>{role}</p>
        </div>
      </div>
      <span style={pill()}>Mkt {driver.market}</span>
    </div>
  );
};

const buildTeamCard = (team, isPlayer) => {
  const raceDrivers = isPlayer ? getActiveDrivers(team) : team.drivers;
  const reserve = team.reserveDriver;
  return (
    <div key={team.name} style={{...glassCard({padding:0}), overflow:'hidden'}}>
      <div style={{padding:'24px', borderBottom:`1px solid ${HUB.border}`, background: isPlayer ? 'rgba(225,6,0,0.04)' : 'transparent'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
          <div>
            <p style={{fontSize:'10px', fontWeight:700, color: isPlayer ? HUB.accent : HUB.textMuted, letterSpacing:'0.15em', textTransform:'uppercase', margin:'0 0 4px'}}>{isPlayer ? "Your Team" : "Competitor"}</p>
            <h3 style={{fontSize:'20px', fontWeight:800, color:'#fff', margin:0}}>{team.name}</h3>
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <span style={pill()}>{raceDrivers.length} Main</span>
            <span style={pill()}>{reserve ? 1 : 0} Res</span>
          </div>
        </div>
        <div style={{display:'flex', gap:'16px'}}>
           <span style={{fontSize:'12px', color:HUB.textMuted}}>Car Perf: <strong style={{color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{team.carPerformance}</strong></span>
           <span style={{fontSize:'12px', color:HUB.textMuted}}>Budget: <strong style={{color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${team.budget}M</strong></span>
        </div>
      </div>

      <div>
        <div style={{padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderBottom:`1px solid ${HUB.border}`}}>
          <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em'}}>Race Lineup</span>
        </div>
        {raceDrivers.length ? raceDrivers.map(d => buildDriverRow(d, "Race Driver", isPlayer)) : <div style={{padding:'16px', color:HUB.textMuted, fontSize:'12px'}}>No drivers assigned.</div>}
        
        <div style={{padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderBottom:`1px solid ${HUB.border}`}}>
          <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em'}}>Reserve</span>
        </div>
        {reserve ? buildDriverRow(reserve, "Reserve Driver", isPlayer) : <div style={{padding:'16px', color:HUB.textMuted, fontSize:'12px'}}>No reserve driver.</div>}
      </div>
    </div>
  );
};

export function renderTeams(root) {
  ensureTeamState(state.team);
  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);

  const Content = () => {
    const [viewMode, setViewMode] = useState('analytics'); // 'analytics' | 'rosters'

    return (
      <div>
        <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
          <div>
            {sectionLabel('Factory Overview')}
            {pageTitle('Team Performance')}
            {pageSubtitle('Analyze factory projections, upgrade efficiency, and on-track realities.')}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
            <button 
              onClick={() => setViewMode('analytics')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: viewMode === 'analytics' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === 'analytics' ? '#fff' : HUB.textMuted,
                border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Activity size={14} /> Analytics
            </button>
            <button 
              onClick={() => setViewMode('rosters')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: viewMode === 'rosters' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === 'rosters' ? '#fff' : HUB.textMuted,
                border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Users size={14} /> Rosters
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'analytics' ? (
            <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <PerformanceAnalytics allTeams={allTeams} />
            </motion.div>
          ) : (
            <motion.div key="rosters" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(400px, 1fr))', gap:'24px'}}>
                {allTeams.map((t, idx) => buildTeamCard(t, idx === 0))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  mountLayout(root, 'teams', React.createElement(Content), () => renderTeams(root));
}
