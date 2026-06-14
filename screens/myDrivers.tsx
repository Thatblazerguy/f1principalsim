import React from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { Target, Heart, Award, TrendingUp, Sliders, Settings, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber, AnimatedBar } from '../components/ui/motion.tsx';

// Simple 4-axis SVG Radar Chart for Driver Attributes
const RadarChart = ({ pace, quali, racecraft, consistency, color = HUB.accent }) => {
  const size = 120;
  const center = size / 2;
  const maxRadius = size / 2 - 10;
  
  // Calculate points (0 to 100 scaled to maxRadius)
  const getPoint = (val, angle) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * maxRadius;
    const rad = (angle - 90) * (Math.PI / 180);
    return `${center + r * Math.cos(rad)},${center + r * Math.sin(rad)}`;
  };

  const points = `${getPoint(pace, 0)} ${getPoint(quali, 90)} ${getPoint(racecraft, 180)} ${getPoint(consistency, 270)}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background Grid */}
        <polygon points={`${center},10 ${size-10},${center} ${center},${size-10} 10,${center}`} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <polygon points={`${center},30 ${size-30},${center} ${center},${size-30} 30,${center}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        
        {/* Axes */}
        <line x1={center} y1="10" x2={center} y2={size-10} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="10" y1={center} x2={size-10} y2={center} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {/* Data Polygon */}
        <motion.polygon 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0, delay: 0.2 }}
          points={points} 
          fill={`${color}40`} 
          stroke={color} 
          strokeWidth="2" 
          style={{ transformOrigin: 'center' }}
        />
      </svg>
      {/* Axis Labels */}
      <span style={{ position:'absolute', top: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>PAC</span>
      <span style={{ position:'absolute', right: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>QUA</span>
      <span style={{ position:'absolute', bottom: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>RAC</span>
      <span style={{ position:'absolute', left: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>CON</span>
    </div>
  );
};

export function renderMyDrivers(root, notice = "") {
  ensureTeamState(state.team);
  const activeNames = new Set(getActiveDrivers(state.team).map(d => d.name));

  const handleAction = async (action, name) => {
    if (action === 'release') {
      state.team.releaseDriver(name);
      await syncGame();
      renderMyDrivers(root, `${name} released.`);
    } else if (action === 'demote') {
      const moved = state.team.demoteToReserve(name);
      if (moved) await syncGame();
      renderMyDrivers(root, moved ? `${name} moved to reserve.` : "Reserve slot full.");
    } else if (action === 'promote') {
      const promoted = state.team.promoteReserve();
      if (promoted) await syncGame();
      renderMyDrivers(root, promoted ? `${name} promoted.` : "Main lineup full.");
    }
  };

  const handleSlotChange = async (slot, e) => {
    let s1 = slot === 1 ? e.target.value : (document.getElementById("activeSlot1")?.value || "");
    let s2 = slot === 2 ? e.target.value : (document.getElementById("activeSlot2")?.value || "");

    if (!s1 || !s2) return;

    if (s1 === s2) {
      const fallback = getTeamRoster(state.team).find(d => d.name !== (slot === 1 ? s1 : s2));
      if (fallback) {
         if (slot === 1) s2 = fallback.name;
         else s1 = fallback.name;
      }
    }

    const activeDrivers = setTeamActiveDrivers(state.team, [s1, s2]);
    await syncGame();
    renderMyDrivers(root, `Active lineup updated.`);
  };

  const buildStat = (label, value, trend = null) => (
    <div style={{background:'rgba(255,255,255,0.02)', padding:'10px 14px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)'}}>
      <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{label}</span>
      <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
        <span style={{fontSize:'15px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{value}</span>
        {trend && (
          <span style={{fontSize:'10px', color: trend === '▲' ? '#10b981' : trend === '▼' ? '#ef4444' : HUB.textMuted}}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );

  const getTrend = (val) => {
    // Mock trend logic based on value parity
    if (val > 88) return '▬';
    return val % 2 === 0 ? '▲' : '▬';
  };

  const buildDriverCard = (driver, role, isActive, delayIndex = 0) => {
    const points = state.standings.drivers[driver.name] ?? 0;
    const raceNumber = getDriverNumber(driver);

    // Mock development curve stats
    const potentialRating = Math.min(99, Math.round(driver.pace * 1.05 + 2));
    const morale = 94; // %
    const chemistry = 88;
    const age = driver.age || 25;
    
    // Mock Season Stats
    const wins = Math.floor(points / 25);
    const podiums = Math.floor(points / 15);
    const top10s = Math.floor(points / 5);
    const avgFinish = Math.max(1, 14 - Math.floor(points / 10));

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4, delay: delayIndex * 0.05 }}
        key={driver.name} style={{...glassCard({padding:0}), display:'flex', flexDirection:'column', justifyContent:'space-between', borderTop: isActive ? `3px solid ${HUB.accent}` : '1px solid rgba(255,255,255,0.05)'}}
      >
        {/* Profile Header */}
        <div style={{padding:'24px', borderBottom:`1px solid ${HUB.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:'rgba(255,255,255,0.02)'}}>
          <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
            <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'64px', height:'64px', borderRadius:'50%', objectFit:'cover', border:`2px solid ${isActive ? HUB.accent : 'rgba(255,255,255,0.1)'}`}} loading="lazy"/>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <span style={{fontSize:'16px', fontFamily:HUB.fontMono, color:HUB.accent}}>#{raceNumber}</span>
                <span style={pill(isActive)}>{isActive ? "ACTIVE SEAT" : `${role.toUpperCase()} DRIVER`}</span>
              </div>
              <h3 style={{fontSize:'22px', fontFamily:HUB.fontBold, margin:'4px 0 0', color:'#fff'}}>{driver.name.toUpperCase()}</h3>
              <span style={{fontSize: '11px', color: HUB.textMuted, display: 'block', marginTop: '4px'}}>Age {age} • {driver.category} Class</span>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
             <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom: '2px'}}>CONTRACT TERM</span>
             <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums'}}>2 Years</span>
          </div>
        </div>

        {/* Season Statistics Strip */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${HUB.border}`, background: 'rgba(0,0,0,0.2)' }}>
          {[
            { label: 'PTS', val: points },
            { label: 'WINS', val: wins },
            { label: 'PODIUMS', val: podiums },
            { label: 'TOP 10', val: top10s },
            { label: 'AVG FIN', val: `P${avgFinish}` }
          ].map((stat, i) => (
            <div key={i} style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderRight: i < 4 ? `1px solid ${HUB.border}` : 'none' }}>
              <span style={{ display: 'block', fontSize: '9px', color: HUB.textMuted, marginBottom: '2px' }}>{stat.label}</span>
              <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, color: '#fff' }}>{typeof stat.val === 'number' ? <AnimatedNumber value={stat.val}/> : stat.val}</span>
            </div>
          ))}
        </div>

        <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', flex:1 }}>
          {/* Performance Data */}
          <div>
             <h4 style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Performance Telemetry</h4>
             <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <RadarChart pace={driver.pace} quali={driver.quali} racecraft={driver.racecraft} consistency={driver.consistency} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flex: 1 }}>
                  {buildStat("Pace", (driver.pace || 0).toFixed(1), getTrend(driver.pace))}
                  {buildStat("Qualifying", (driver.quali || 0).toFixed(1), getTrend(driver.quali))}
                  {buildStat("Racecraft", (driver.racecraft || 0).toFixed(1), getTrend(driver.racecraft))}
                  {buildStat("Consistency", (driver.consistency || 0).toFixed(1), '▬')}
                </div>
             </div>
          </div>

          {/* Development & Status */}
          <div>
            <h4 style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Personnel Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Potential OVR</span>
                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#fff' }}><AnimatedNumber value={potentialRating}/> Cap</span>
                </div>
                <AnimatedBar value={potentialRating} color={HUB.accent} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Morale</span>
                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#fff' }}><AnimatedNumber value={morale}/>%</span>
                </div>
                <AnimatedBar value={morale} color="#10b981" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Team Chemistry</span>
                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#fff' }}><AnimatedNumber value={chemistry}/>%</span>
                </div>
                <AnimatedBar value={chemistry} color="#3b82f6" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                 <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block', marginBottom: '2px' }}>SALARY / GP</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff' }}>${(driver.salary / 24).toFixed(2)}M</span>
                 </div>
                 <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block', marginBottom: '2px' }}>MARKET VAL</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff' }}>${(driver.market || 0).toFixed(1)}M</span>
                 </div>
              </div>

            </div>
          </div>
        </div>

        {/* Contract controls */}
        <div style={{padding:'20px 24px', borderTop:`1px solid ${HUB.border}`, background:'rgba(0,0,0,0.1)', display:'flex', gap:'12px'}}>
          <button onClick={() => handleAction('release', driver.name)} style={{...actionBtn({backgroundColor:'transparent', border:`1px solid ${HUB.border}`, color:'#f87171', boxShadow:'none', flex:1, borderRadius:'4px'})}}>RELEASE CONTRACT</button>
          {role === "Main" ? (
            <button onClick={() => handleAction('demote', driver.name)} disabled={!!state.team.reserveDriver} style={{...actionBtn({flex:1, borderRadius:'4px'}), opacity: state.team.reserveDriver ? 0.5 : 1}}>DEMOTE TO RESERVE</button>
          ) : (
            <button onClick={() => handleAction('promote', driver.name)} disabled={state.team.drivers.length >= 2} style={{...actionBtn({flex:1, borderRadius:'4px'}), opacity: state.team.drivers.length >= 2 ? 0.5 : 1}}>PROMOTE TO SEAT</button>
          )}
        </div>
      </motion.div>
    );
  };

  const roster = getTeamRoster(state.team);
  const active = getActiveDrivers(state.team);
  const slotOne = active[0]?.name ?? roster[0]?.name ?? "";
  const slotTwo = active[1]?.name ?? roster[1]?.name ?? roster.find(d => d.name !== slotOne)?.name ?? "";

  const renderHeadToHead = () => {
    if (active.length !== 2) return null;
    const [d1, d2] = active;
    
    const compare = (v1, v2) => {
       if (v1 > v2) return { d1Color: '#10b981', d2Color: HUB.textMuted, d1Weight: 800, d2Weight: 400 };
       if (v2 > v1) return { d1Color: HUB.textMuted, d2Color: '#10b981', d1Weight: 400, d2Weight: 800 };
       return { d1Color: '#fff', d2Color: '#fff', d1Weight: 700, d2Weight: 700 };
    };

    const metrics = [
      { label: 'Pace', v1: d1.pace, v2: d2.pace, isScore: true },
      { label: 'Qualifying', v1: d1.quali, v2: d2.quali, isScore: true },
      { label: 'Racecraft', v1: d1.racecraft, v2: d2.racecraft, isScore: true },
      { label: 'Points', v1: state.standings.drivers[d1.name]||0, v2: state.standings.drivers[d2.name]||0, isScore: true },
      { label: 'Market Value', v1: d1.market, v2: d2.market, isScore: true, prefix: '$', suffix: 'M' },
    ];

    return (
      <SlideUp delay={0.1}>
      <div style={{ ...glassCard({ padding: '24px' }), marginBottom: '32px' }}>
         <h3 style={{fontSize:'12px', fontFamily:HUB.fontBold, color:'#94A3B8', margin:'0 0 20px', textTransform:'uppercase', letterSpacing:'0.15em'}}>Lineup Head-to-Head</h3>
         
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: '24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
               <h4 style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: '#fff', margin: 0 }}>{d1.name.toUpperCase()}</h4>
               <img src={getDriverHeadshotUrl(d1)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {metrics.map(m => {
                 const diff = compare(m.v1, m.v2);
                 const fmt1 = m.isScore ? m.v1.toFixed(1) : m.v1;
                 const fmt2 = m.isScore ? m.v2.toFixed(1) : m.v2;
                 return (
                   <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', alignItems: 'center', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: diff.d1Color, fontWeight: diff.d1Weight, textAlign: 'right' }}>
                        {m.prefix}{fmt1}{m.suffix}
                      </span>
                      <span style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>{m.label}</span>
                      <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: diff.d2Color, fontWeight: diff.d2Weight, textAlign: 'left' }}>
                        {m.prefix}{fmt2}{m.suffix}
                      </span>
                   </div>
                 );
               })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-start' }}>
               <img src={getDriverHeadshotUrl(d2)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
               <h4 style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: '#fff', margin: 0 }}>{d2.name.toUpperCase()}</h4>
            </div>
         </div>
      </div>
      </SlideUp>
    );
  };

  const content = (
    <div>
      <div style={{marginBottom:'32px'}}>
        {sectionLabel('Personnel Operations')}
        {pageTitle('Driver Dossiers')}
        {pageSubtitle('Manage active contracts, monitor development trajectories, and optimize your weekend lineup.')}
      </div>

      {notice && (
        <div style={{padding:'16px', background:'rgba(225,6,0,0.1)', border:`1px solid ${HUB.accent}`, borderRadius:'4px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {notice}
        </div>
      )}

      {/* Head to Head */}
      {renderHeadToHead()}

      {/* Active Lineup Operations Panel */}
      <SlideUp delay={0.15}>
      <div style={{...glassCard({padding:'24px'}), marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 6px', textTransform:'uppercase'}}>Race Weekend Lineup</h3>
          <p style={{fontSize:'13px', color:HUB.textMuted, margin:0, maxWidth:'450px'}}>Select which two contracted drivers will take the active seats in the upcoming event.</p>
        </div>
        <div style={{display:'flex', gap:'24px'}}>
           <div>
             <span style={{fontSize:'9px', fontFamily:HUB.fontBold, color:HUB.textMuted, textTransform:'uppercase', display:'block', marginBottom:'6px'}}>ACTIVE SEAT 01</span>
             <select id="activeSlot1" value={slotOne} onChange={(e) => handleSlotChange(1, e)} style={{background:'rgba(0,0,0,0.3)', color:'#fff', border:`1px solid ${HUB.borderMid}`, padding:'10px 16px', borderRadius:'4px', width:'200px', outline:'none'}}>
               {roster.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
             </select>
           </div>
           <div>
             <span style={{fontSize:'9px', fontFamily:HUB.fontBold, color:HUB.textMuted, textTransform:'uppercase', display:'block', marginBottom:'6px'}}>ACTIVE SEAT 02</span>
             <select id="activeSlot2" value={slotTwo} onChange={(e) => handleSlotChange(2, e)} style={{background:'rgba(0,0,0,0.3)', color:'#fff', border:`1px solid ${HUB.borderMid}`, padding:'10px 16px', borderRadius:'4px', width:'200px', outline:'none'}}>
               {roster.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
             </select>
           </div>
        </div>
      </div>
      </SlideUp>

      <motion.div layout style={{display:'grid', gridTemplateColumns:'1fr', gap:'32px'}}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '32px' }}>
           {state.team.drivers.map((d, i) => buildDriverCard(d, "Main", activeNames.has(d.name), i))}
        </div>
        
        {state.team.reserveDriver ? (
           <div style={{ marginTop: '16px' }}>
              <h3 style={{fontSize:'14px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', borderBottom:`1px solid ${HUB.border}`, paddingBottom: '12px'}}>Reserve Driver / Academy</h3>
              {buildDriverCard(state.team.reserveDriver, "Reserve", activeNames.has(state.team.reserveDriver.name), 3)}
           </div>
        ) : (
           <div style={{ marginTop: '16px' }}>
              <h3 style={{fontSize:'14px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', borderBottom:`1px solid ${HUB.border}`, paddingBottom: '12px'}}>Reserve Driver / Academy</h3>
              <SlideUp delay={0.2}>
              <div style={{...glassCard({ padding: '32px' }), display:'flex', alignItems:'center', justifyContent:'space-between', borderLeft:`4px solid rgba(255,255,255,0.1)`}}>
                 <div>
                    <span style={{ fontSize: '10px', color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>SYSTEM ALERT</span>
                    <h4 style={{ fontSize: '20px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 8px' }}>RESERVE SEAT AVAILABLE</h4>
                    <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0, maxWidth: '500px', lineHeight: 1.5 }}>
                       Signing a reserve driver provides a backup option in case of poor performance and allows you to develop young academy talent in your simulator.
                    </p>
                 </div>
                 <div style={{ display: 'flex', gap: '16px' }}>
                    <button style={{...actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.border}`, borderRadius: '4px', padding: '12px 24px' })}}>
                       VIEW MARKET
                    </button>
                    <button style={{...actionBtn({ backgroundColor: HUB.accent, color: '#fff', borderRadius: '4px', padding: '12px 24px' })}}>
                       SCOUT TALENT
                    </button>
                 </div>
              </div>
              </SlideUp>
           </div>
        )}
      </motion.div>
    </div>
  );

  mountLayout(root, 'drivers', content, () => renderMyDrivers(root));
}
