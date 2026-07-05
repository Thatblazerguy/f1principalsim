const fs = require('fs');

const code = `import React, { useState, useMemo } from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber, AnimatedBar } from '../components/ui/motion.tsx';
import { RadarChart } from '../components/driverComparison.tsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, Tooltip, Legend, Filler);

// --- Helpers for Analytics ---
const computeDriverAnalytics = (driverName, teamName, raceHistory) => {
  if (!raceHistory || raceHistory.length === 0) return null;
  
  let starts = 0;
  let finishes = 0;
  let wins = 0;
  let podiums = 0;
  let pointsFinishes = 0;
  let dnfs = 0;
  let totalFinishPos = 0;
  let totalGridPos = 0;
  let totalPoints = 0;
  let bestFinish = 99;
  let worstFinish = 0;
  let fastestLaps = 0;
  let gridCount = 0;
  
  const historyData = [];

  raceHistory.forEach(race => {
    const dr = race.driverResults?.find(d => d.name === driverName);
    if (!dr) return;
    
    starts++;
    if (race.fastestLap === driverName) fastestLaps++;
    
    if (dr.retired) {
      dnfs++;
    } else {
      finishes++;
      totalFinishPos += dr.finishPos;
      if (dr.finishPos < bestFinish) bestFinish = dr.finishPos;
      if (dr.finishPos > worstFinish) worstFinish = dr.finishPos;
      if (dr.finishPos === 1) wins++;
      if (dr.finishPos <= 3) podiums++;
      if (dr.finishPos <= 10) pointsFinishes++;
    }
    
    totalPoints += (dr.points || 0);
    
    let gPos = dr.gridPos;
    if (gPos) {
      gridCount++;
      totalGridPos += gPos;
    }
    
    historyData.push({
      round: race.round,
      name: race.name,
      finishPos: dr.retired ? 20 : dr.finishPos,
      gridPos: gPos,
      points: dr.points || 0,
      retired: dr.retired
    });
  });

  const avgFinish = finishes > 0 ? totalFinishPos / finishes : 0;
  const avgGrid = gridCount > 0 ? totalGridPos / gridCount : 0;
  
  let positionsGainedAvg = 0;
  if (avgGrid > 0 && avgFinish > 0) {
     positionsGainedAvg = avgGrid - avgFinish;
  }

  return {
    starts, finishes, wins, podiums, pointsFinishes, dnfs,
    bestFinish: bestFinish === 99 ? '-' : bestFinish,
    worstFinish: worstFinish === 0 ? '-' : worstFinish,
    totalPoints, fastestLaps, avgFinish, avgGrid, positionsGainedAvg,
    historyData
  };
};

const getTeamCarRank = (teamName) => {
  const allTeams = [state.team, ...(state.aiTeams || [])].filter(Boolean);
  allTeams.sort((a, b) => (b.carPerformance || 80) - (a.carPerformance || 80));
  const rank = allTeams.findIndex(t => t.name === teamName) + 1;
  return rank > 0 ? rank : 5; // fallback
};

const generateAIReport = (driver, stats, extractionDelta) => {
  if (!stats || stats.starts === 0) return "Not enough data to generate an AI Performance Report. Awaiting race telemetry.";
  
  const sentences = [];
  
  if (extractionDelta > 2) {
    sentences.push(\`\${driver.name} is consistently extracting more performance than the car's expected pace.\`);
  } else if (extractionDelta < -2) {
    sentences.push(\`The driver is currently struggling to extract the maximum potential from the machinery.\`);
  } else {
    sentences.push(\`\${driver.name} is delivering exactly what is expected from the car's performance baseline.\`);
  }
  
  if (stats.avgGrid > 0 && stats.positionsGainedAvg > 1.5) {
    sentences.push("Excellent racecraft and tyre management has produced stronger race pace than qualifying pace.");
  } else if (stats.avgGrid > 0 && stats.positionsGainedAvg < -1.5) {
    sentences.push("The driver is losing significant time during the race compared to their starting position.");
  }
  
  if (stats.dnfs >= 3) {
    sentences.push("High incidence of retirements is severely compromising their championship campaign.");
  } else if (stats.starts > 5 && stats.dnfs === 0) {
    sentences.push("Exceptional consistency and mechanical sympathy – zero retirements so far this season.");
  }

  if (driver.quali > driver.pace + 2) {
     sentences.push("Qualifying is a distinct strength, frequently placing the car higher than its true race pace allows.");
  } else if (driver.pace > driver.quali + 2) {
     sentences.push("A Sunday specialist, making up for lackluster qualifying performances with relentless race pace.");
  }

  return sentences.join(" ");
};

export const MyDriversPage = ({ root, initialFlashMessage }: { root: HTMLElement, initialFlashMessage: string }) => {
  ensureTeamState(state.team);
  
  const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
  const [selectedTab, setSelectedTab] = useState(0); // 0 = Driver 1, 1 = Driver 2, 2 = Reserve
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);

  // --- Handlers ---
  const handleAction = async (action, driverName) => {
    if (action === 'release') {
      if(confirm(\`Are you sure you want to release \${driverName}? This action cannot be undone.\`)) {
        if (state.team.reserveDriver?.name === driverName) {
          state.team.reserveDriver = null;
          setSelectedTab(0);
        } else {
          state.team.drivers = state.team.drivers.filter((d: any) => d.name !== driverName);
          setSelectedTab(0);
        }
        await syncGame();
        setFlashMessage(\`Released \${driverName} from their contract.\`);
      }
    } else if (action === 'demote') {
       if (!state.team.reserveDriver) {
           const driverIndex = state.team.drivers.findIndex(d => d.name === driverName);
           if (driverIndex !== -1) {
               const driver = state.team.drivers[driverIndex];
               state.team.drivers.splice(driverIndex, 1);
               driver.contractType = 'reserve';
               driver.driverRole = 'reserve';
               driver.roleLabel = 'Reserve Driver';
               state.team.reserveDriver = driver;
               setSelectedTab(2);
               await syncGame();
               setFlashMessage(\`Demoted \${driverName} to Reserve Driver.\`);
           }
       }
    } else if (action === 'promote') {
       if (state.team.reserveDriver?.name === driverName) {
           if (state.team.drivers.length < 2) {
               state.team.promoteReserveToSeat(null, state);
               const reserve = state.team.reserveDriver;
               state.team.reserveDriver = null;
               reserve.contractType = 'race';
               reserve.driverRole = state.team.drivers.length === 0 ? 'lead' : 'second';
               reserve.roleLabel = 'Race Driver';
               state.team.drivers.push(reserve);
               setSelectedTab(state.team.drivers.length - 1);
               await syncGame();
               setFlashMessage(\`Promoted \${driverName} to Race Seat.\`);
           } else {
               setPromotionModalOpen(true);
           }
       }
    }
  };

  const confirmPromotion = async (replaceDriverName) => {
     if(confirm(\`Replace \${replaceDriverName} with \${state.team.reserveDriver.name}? \${replaceDriverName} will be released.\`)) {
         if (state.team.promoteReserveToSeat(replaceDriverName, state)) {
            await syncGame();
            setFlashMessage(\`Promoted new driver and released \${replaceDriverName}.\`);
            setPromotionModalOpen(false);
            setSelectedTab(0);
         }
     }
  };

  // --- Data aggregation ---
  const allDrivers = [
    ...state.team.drivers,
    ...(state.team.reserveDriver ? [state.team.reserveDriver] : [])
  ];

  const currentDriver = allDrivers[selectedTab];
  
  const stats = useMemo(() => {
    if (!currentDriver) return null;
    return computeDriverAnalytics(currentDriver.name, state.team.name, state.raceHistory || []);
  }, [currentDriver, state.raceHistory]);

  const teammate = useMemo(() => {
    if (!currentDriver || currentDriver.driverRole === 'reserve') return null;
    return state.team.drivers.find(d => d.name !== currentDriver.name);
  }, [currentDriver, state.team.drivers]);

  const teammateStats = useMemo(() => {
    if (!teammate) return null;
    return computeDriverAnalytics(teammate.name, state.team.name, state.raceHistory || []);
  }, [teammate, state.raceHistory]);

  if (!currentDriver) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          {sectionLabel('Personnel Management')}
          {pageTitle('Driver Intelligence Center')}
          {pageSubtitle('Comprehensive telemetry and performance evaluation.')}
        </div>
        <div style={{...glassCard({padding: '48px'}), textAlign: 'center'}}>
          <h3 style={{color: '#fff', margin: 0}}>No drivers found on the roster.</h3>
        </div>
      </div>
    );
  }

  // Derived metrics
  const carRank = getTeamCarRank(state.team.name);
  const expectedFinish = carRank * 2 - 1; // e.g. Rank 1 = P1/P2 (avg 1.5). Rank 5 = P9/P10 (avg 9.5)
  const extractionDelta = stats ? (expectedFinish - stats.avgFinish) : 0; 
  // Positive delta = outperforming (e.g. expected 9.5, actual 5.0 -> +4.5)

  let extractionStatus = "Average";
  let extractionColor = "#eab308";
  if (extractionDelta > 1.5) { extractionStatus = "Overperforming"; extractionColor = "#10b981"; }
  else if (extractionDelta < -1.5) { extractionStatus = "Underperforming"; extractionColor = "#f87171"; }

  const aiReport = generateAIReport(currentDriver, stats, extractionDelta);

  // Chart data
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      y: { reverse: true, min: 1, max: 20, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
    },
    plugins: { 
      legend: { position: 'top', labels: { color: '#fff' } },
      tooltip: { mode: 'index', intersect: false }
    }
  };

  const chartData = stats && stats.historyData.length > 0 ? {
    labels: stats.historyData.map(d => \`R\${d.round}\`),
    datasets: [
      {
        label: 'Race Finish',
        data: stats.historyData.map(d => d.finishPos),
        borderColor: HUB.accent,
        backgroundColor: 'rgba(225, 6, 0, 0.1)',
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Grid Position',
        data: stats.historyData.map(d => d.gridPos || null),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 3,
        tension: 0,
        fill: false,
      }
    ]
  } : null;

  return (
    <div style={{ paddingBottom: '80px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* --- HEADER --- */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {sectionLabel('Personnel Management')}
          {pageTitle('Driver Intelligence Center')}
          {pageSubtitle('Comprehensive telemetry, seasonal analytics, and contract evaluation.')}
        </div>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '8px', border: \`1px solid \${HUB.border}\` }}>
          {allDrivers.map((d, idx) => (
            <button key={d.name} onClick={() => setSelectedTab(idx)} style={{
              background: selectedTab === idx ? HUB.accent : 'transparent',
              color: selectedTab === idx ? '#fff' : HUB.textMuted,
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: HUB.fontBold,
              fontSize: '13px',
              transition: '0.2s all'
            }}>
              {d.name.split(' ').pop()} {d.driverRole === 'reserve' ? '(RES)' : ''}
            </button>
          ))}
        </div>
      </div>

      {flashMessage && (
        <div style={{ padding: '16px', background: 'rgba(225,6,0,0.1)', border: \`1px solid \${HUB.accent}\`, borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '24px' }}>
          {flashMessage}
        </div>
      )}

      {/* --- SECTION 1: DRIVER OVERVIEW --- */}
      <div style={{ ...glassCard({ padding: 0 }), marginBottom: '24px', display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: '0 0 240px', background: 'rgba(0,0,0,0.3)', borderRight: \`1px solid \${HUB.border}\`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
           <img src={getDriverHeadshotUrl(currentDriver)} alt={currentDriver.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: \`3px solid \${HUB.accent}\`, marginBottom: '16px' }} loading="lazy" />
           <h2 style={{ fontSize: '24px', color: '#fff', fontFamily: HUB.fontBold, margin: '0 0 4px', textAlign: 'center' }}>{currentDriver.name}</h2>
           <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <span style={{ fontSize: '18px', color: HUB.accent, fontFamily: HUB.fontMono, fontWeight: 800 }}>#{getDriverNumber(currentDriver)}</span>
             <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '10px', color: '#fff' }}>{currentDriver.category}</span>
           </div>
        </div>

        <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px' }}>
             <div>
               <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Age</span>
               <span style={{ fontSize: '18px', color: '#fff', fontFamily: HUB.fontMono }}>{currentDriver.age || 25}</span>
             </div>
             <div>
               <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Salary</span>
               <span style={{ fontSize: '18px', color: '#fff', fontFamily: HUB.fontMono }}>\${((currentDriver.salary || 500000) / 1000000).toFixed(1)}M</span>
             </div>
             <div>
               <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Contract</span>
               <span style={{ fontSize: '18px', color: '#fff', fontFamily: HUB.fontMono }}>{currentDriver.contractDuration || 1} Yrs</span>
             </div>
             <div>
               <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Morale</span>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span style={{ fontSize: '18px', color: '#fff', fontFamily: HUB.fontMono }}>{currentDriver.morale || 90}%</span>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: (currentDriver.morale || 90) > 70 ? '#10b981' : '#f87171' }}></div>
               </div>
             </div>
             <div>
               <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Potential</span>
               <span style={{ fontSize: '18px', color: '#a855f7', fontFamily: HUB.fontMono }}>{currentDriver.potentialCeiling || 90}</span>
             </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '32px', borderTop: \`1px solid \${HUB.border}\`, paddingTop: '24px' }}>
            <button onClick={() => handleAction('release', currentDriver.name)} style={{ ...actionBtn({ backgroundColor: 'transparent', border: \`1px solid \${HUB.border}\`, color: '#f87171', padding: '8px 16px', fontSize: '12px' }) }}>Release Contract</button>
            {currentDriver.driverRole !== 'reserve' ? (
              <button onClick={() => handleAction('demote', currentDriver.name)} disabled={!!state.team.reserveDriver} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px' }), opacity: state.team.reserveDriver ? 0.5 : 1 }}>Demote to Reserve</button>
            ) : (
              <button onClick={() => handleAction('promote', currentDriver.name)} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px' }) }}>Promote to Seat</button>
            )}
          </div>
        </div>
      </div>

      {stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
          
          {/* --- SECTION 3: CAR EXTRACTION INDEX --- */}
          <div style={{ gridColumn: 'span 4', ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Car Extraction Index</h3>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', borderRadius: '50%', border: \`8px solid rgba(255,255,255,0.05)\`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: \`inset 0 0 20px \${extractionColor}40\` }}>
                 <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: \`8px solid \${extractionColor}\`, clipPath: \`polygon(0 0, 100% 0, 100% \${Math.max(0, 100 - ((extractionDelta + 5) / 10) * 100)}%, 0 \${Math.max(0, 100 - ((extractionDelta + 5) / 10) * 100)}%)\`, transition: 'all 1s ease-out' }}></div>
                 <div style={{ textAlign: 'center', zIndex: 2 }}>
                   <span style={{ display: 'block', fontSize: '32px', color: extractionColor, fontFamily: HUB.fontMono, fontWeight: 800 }}>{extractionDelta > 0 ? '+' : ''}{extractionDelta.toFixed(1)}</span>
                   <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Positions</span>
                 </div>
              </div>
              
              <div style={{ marginTop: '24px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: \`1px solid \${HUB.border}\` }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Est. Car Capability</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: HUB.fontMono }}>P{expectedFinish.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: \`1px solid \${HUB.border}\` }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Driver Avg Finish</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: HUB.fontMono }}>P{stats.avgFinish.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Status</span>
                  <span style={{ fontSize: '12px', color: extractionColor, fontWeight: 700 }}>{extractionStatus}</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- SECTION 2: SEASON PERFORMANCE --- */}
          <div style={{ gridColumn: 'span 8', ...glassCard({ padding: '24px' }) }}>
             <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Season Performance</h3>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
               {[
                 { label: 'Championship Pts', val: stats.totalPoints },
                 { label: 'Avg Finish', val: \`P\${stats.avgFinish.toFixed(1)}\` },
                 { label: 'Avg Grid', val: stats.avgGrid > 0 ? \`P\${stats.avgGrid.toFixed(1)}\` : 'N/A' },
                 { label: 'Pos Gained/Lost', val: stats.avgGrid > 0 ? (stats.positionsGainedAvg > 0 ? \`+\${stats.positionsGainedAvg.toFixed(1)}\` : stats.positionsGainedAvg.toFixed(1)) : 'N/A' },
                 { label: 'Best Finish', val: \`P\${stats.bestFinish}\` },
                 { label: 'Podiums', val: stats.podiums },
                 { label: 'Wins', val: stats.wins },
                 { label: 'Fastest Laps', val: stats.fastestLaps },
                 { label: 'Points Finishes', val: stats.pointsFinishes },
                 { label: 'DNFs', val: stats.dnfs }
               ].map((item, i) => (
                 <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: \`1px solid rgba(255,255,255,0.02)\` }}>
                   <span style={{ display: 'block', fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>{item.label}</span>
                   <span style={{ fontSize: '20px', color: '#fff', fontFamily: HUB.fontMono }}>{item.val}</span>
                 </div>
               ))}
             </div>
             {stats.avgGrid === 0 && <span style={{display: 'block', marginTop: '16px', fontSize: '10px', color: HUB.textMuted}}>* Grid positions unavailable for historical simulation data.</span>}
          </div>

          {/* --- SECTION 8: AI PERFORMANCE REPORT --- */}
          <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px', borderLeft: \`4px solid \${HUB.accent}\` }), background: 'rgba(225,6,0,0.05)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
               <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(225,6,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.accent }}>
                 <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </div>
               <div>
                 <h4 style={{ fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>Performance Dept. Summary</h4>
                 <p style={{ margin: 0, fontSize: '14px', color: '#e2e8f0', lineHeight: 1.6 }}>{aiReport}</p>
               </div>
            </div>
          </div>

          {/* --- SECTION 5: PERFORMANCE TIMELINE --- */}
          <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Performance Timeline</h3>
            <div style={{ height: '300px' }}>
              {chartData ? <Line data={chartData} options={chartOptions} /> : <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.textMuted}}>No race data available.</div>}
            </div>
          </div>

          {/* --- SECTION 4 & 9: ATTRIBUTES --- */}
          <div style={{ gridColumn: 'span 4', ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Telemetry Attributes</h3>
            <div style={{ marginBottom: '24px' }}>
              <RadarChart pace={currentDriver.pace} quali={currentDriver.quali} racecraft={currentDriver.racecraft} consistency={currentDriver.consistency} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {[
                 { label: 'Race Pace', val: currentDriver.pace },
                 { label: 'Qualifying', val: currentDriver.quali },
                 { label: 'Racecraft', val: currentDriver.racecraft },
                 { label: 'Consistency', val: currentDriver.consistency },
                 { label: 'Tyre Management', val: Math.round((currentDriver.pace + currentDriver.consistency) / 2) },
                 { label: 'Pressure Handling', val: Math.round((currentDriver.quali + currentDriver.racecraft) / 2) }
               ].map(attr => (
                 <div key={attr.label}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                     <span style={{ fontSize: '11px', color: HUB.textMuted }}>{attr.label}</span>
                     <span style={{ fontSize: '11px', color: '#fff', fontFamily: HUB.fontMono }}>{attr.val.toFixed(1)}</span>
                   </div>
                   <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                     <div style={{ height: '100%', width: \`\${(attr.val / 100) * 100}%\`, background: HUB.accent }}></div>
                   </div>
                 </div>
               ))}
            </div>
          </div>

          {/* --- SECTION 7: HEAD TO HEAD --- */}
          <div style={{ gridColumn: 'span 8', ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Teammate Comparison</h3>
            {teammate && teammateStats ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: \`1px solid \${HUB.border}\` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={getDriverHeadshotUrl(currentDriver)} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    <span style={{ color: '#fff', fontSize: '16px', fontFamily: HUB.fontBold }}>{currentDriver.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#fff', fontSize: '16px', fontFamily: HUB.fontBold }}>{teammate.name}</span>
                    <img src={getDriverHeadshotUrl(teammate)} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Championship Points', v1: stats.totalPoints, v2: teammateStats.totalPoints, inv: false },
                    { label: 'Average Finish', v1: stats.avgFinish.toFixed(1), v2: teammateStats.avgFinish.toFixed(1), inv: true },
                    { label: 'Race Wins', v1: stats.wins, v2: teammateStats.wins, inv: false },
                    { label: 'Podiums', v1: stats.podiums, v2: teammateStats.podiums, inv: false },
                    { label: 'Average Grid', v1: stats.avgGrid.toFixed(1), v2: teammateStats.avgGrid.toFixed(1), inv: true },
                    { label: 'DNFs', v1: stats.dnfs, v2: teammateStats.dnfs, inv: true }
                  ].map(stat => {
                     let winner = 0;
                     if (stat.v1 !== stat.v2) {
                       if (stat.inv) { winner = Number(stat.v1) < Number(stat.v2) ? 1 : 2; }
                       else { winner = Number(stat.v1) > Number(stat.v2) ? 1 : 2; }
                     }
                     
                     return (
                       <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ flex: 1, textAlign: 'left', fontSize: '14px', fontFamily: HUB.fontMono, color: winner === 1 ? HUB.accent : '#fff' }}>{stat.v1}</span>
                         <span style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase' }}>{stat.label}</span>
                         <span style={{ flex: 1, textAlign: 'right', fontSize: '14px', fontFamily: HUB.fontMono, color: winner === 2 ? HUB.accent : '#fff' }}>{stat.v2}</span>
                       </div>
                     );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.textMuted }}>No active teammate available for comparison.</div>
            )}
          </div>

          {/* --- SECTION 11: SEASON HEATMAP --- */}
          <div style={{ gridColumn: 'span 12', ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold, textTransform: 'uppercase', marginBottom: '24px' }}>Season Heatmap</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
               {stats.historyData.length > 0 ? stats.historyData.map((d, i) => {
                 let bg = '#1e293b'; // default dark
                 if (d.retired) bg = '#7f1d1d'; // dark red
                 else if (d.finishPos <= 3) bg = '#059669'; // emerald
                 else if (d.finishPos <= 10) bg = '#65a30d'; // lime green
                 else if (d.finishPos <= 15) bg = '#ca8a04'; // yellow
                 
                 return (
                   <div key={i} title={\`\${d.name}: \${d.retired ? 'DNF' : 'P' + d.finishPos}\`} style={{
                     width: '40px', height: '40px', borderRadius: '4px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     border: \`1px solid rgba(255,255,255,0.1)\`
                   }}>
                     <span style={{ fontSize: '11px', color: '#fff', fontFamily: HUB.fontMono }}>{d.retired ? 'DNF' : d.finishPos}</span>
                   </div>
                 );
               }) : <div style={{ color: HUB.textMuted }}>No race data.</div>}
            </div>
          </div>

        </div>
      ) : (
        <div style={{...glassCard({padding: '48px'}), textAlign: 'center', color: HUB.textMuted}}>
          Complete at least one race to generate Intelligence Center analytics.
        </div>
      )}

      {/* Promotion Modal */}
      {promotionModalOpen && state.team.reserveDriver && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div style={{ ...glassCard({ padding: '0', maxWidth: '600px', width: '100%' }), overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: \`1px solid \${HUB.border}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {sectionLabel('Seat Allocation')}
                <h3 style={{ fontSize: '20px', fontFamily: HUB.fontWide, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Replace a Race Driver</h3>
              </div>
              <button onClick={() => setPromotionModalOpen(false)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: HUB.textMuted, marginBottom: '16px', fontSize: '13px' }}>Select which race driver to replace with <strong style={{ color: '#fff' }}>{state.team.reserveDriver.name}</strong>. The replaced driver will be released.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {state.team.drivers.map((d: any) => (
                  <div key={d.name} style={{ ...glassCard({ padding: '16px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold }}>{d.name}</span>
                    </div>
                    <button onClick={() => confirmPromotion(d.name)} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '11px' }) }}>Replace</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function renderMyDrivers(root: HTMLElement, initialFlashMessage = "") {
  mountLayout(root, 'drivers', <MyDriversPage root={root} initialFlashMessage={initialFlashMessage} />, () => renderMyDrivers(root, initialFlashMessage));
}
`

fs.writeFileSync('screens/myDrivers.tsx', code);
