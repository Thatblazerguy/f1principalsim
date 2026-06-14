import React from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { Target, Heart, Award, TrendingUp, Sliders, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber, AnimatedBar } from '../components/ui/motion.tsx';

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

  const buildStat = (label, value) => (
    <div style={{background:'rgba(255,255,255,0.02)', padding:'10px 14px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)'}}>
      <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{label}</span>
      <span style={{fontSize:'15px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{value}</span>
    </div>
  );

  const buildDriverCard = (driver, role, isActive) => {
    const points = state.standings.drivers[driver.name] ?? 0;
    const raceNumber = getDriverNumber(driver);

    // Mock development curve stats
    const potentialRating = Math.min(99, Math.round(driver.pace * 1.05 + 2));
    const morale = 94; // %

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        key={driver.name} style={{...glassCard({padding:0}), display:'flex', flexDirection:'column', justifyContent:'space-between'}}
      >
        
        {/* Top Info Header */}
        <div style={{padding:'24px', borderBottom:`1px solid ${HUB.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:'rgba(255,255,255,0.01)'}}>
          <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
            <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'56px', height:'56px', borderRadius:'50%', objectFit:'cover', border:`2px solid ${isActive ? HUB.accent : 'rgba(255,255,255,0.1)'}`}} loading="lazy"/>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:HUB.accent}}>#{raceNumber}</span>
                <span style={pill(isActive)}>{isActive ? "ACTIVE SEAT" : `${role.toUpperCase()} RESERVE`}</span>
              </div>
              <h3 style={{fontSize:'18px', fontFamily:HUB.fontBold, margin:'4px 0 0', color:'#fff'}}>{driver.name.toUpperCase()}</h3>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
             <span style={{fontSize:'9px', color:HUB.textMuted, display:'block'}}>CHAMPIONSHIP POINTS</span>
             <span style={{fontSize:'16px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}><AnimatedNumber value={points} /> PTS</span>
          </div>
        </div>

        {/* Dossier telemetry stats */}
        <div style={{padding:'24px', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px'}}>
          {buildStat("Pace Rating", (driver.pace || 0).toFixed(1))}
          {buildStat("Qualifying", (driver.quali || 0).toFixed(1))}
          {buildStat("Racecraft", (driver.racecraft || 0).toFixed(1))}
          {buildStat("Consistency", (driver.consistency || 0).toFixed(1))}
          {buildStat("Market Value", `$${(driver.market || 0).toFixed(1)}M`)}
          {buildStat("Salary / GP", `$${(driver.salary / 24).toFixed(2)}M`)}
          {buildStat("Driver Morale", `${morale}%`)}
          {buildStat("Potential OVR", `${potentialRating} max`)}
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

  const content = (
    <div>
      <div style={{marginBottom:'32px'}}>
        {sectionLabel('Driver Operations')}
        {pageTitle('Driver Dossiers')}
        {pageSubtitle('Direct active contract statuses, check development curves, and select your race weekend pair.')}
      </div>

      {notice && (
        <div style={{padding:'16px', background:'rgba(225,6,0,0.1)', border:`1px solid ${HUB.accent}`, borderRadius:'4px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {notice}
        </div>
      )}

      {/* Active Lineup Operations Panel */}
      <SlideUp delay={0.05}>
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

      <motion.div layout style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(450px, 1fr))', gap:'24px'}}>
        {state.team.drivers.map(d => buildDriverCard(d, "Main", activeNames.has(d.name)))}
        {state.team.reserveDriver ? buildDriverCard(state.team.reserveDriver, "Reserve", activeNames.has(state.team.reserveDriver.name)) : (
           <div style={{...glassCard(), display:'flex', alignItems:'center', justifyContent:'center', minHeight:'300px', flexDirection:'column', gap:'12px', border:`1px dashed rgba(255,255,255,0.15)`}}>
              <p style={{fontSize:'14px', fontWeight:700, color:HUB.textMuted}}>OPEN SYSTEM RESERVE SEAT</p>
              <p style={{fontSize:'12px', color:'rgba(148,163,184,0.6)', textAlign:'center', maxWidth:'260px'}}>Visit the Driver Market to recruit and sign a replacement reserve driver.</p>
           </div>
        )}
      </motion.div>
    </div>
  );

  mountLayout(root, 'drivers', content, () => renderMyDrivers(root));
}
