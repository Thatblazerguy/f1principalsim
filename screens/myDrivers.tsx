import React, { useState } from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber, AnimatedBar } from '../components/ui/motion.tsx';
import { RadarChart } from '../components/driverComparison.tsx';

export function renderMyDrivers(root, initialFlashMessage = "") {
  ensureTeamState(state.team);
  const activeNames = new Set(getActiveDrivers(state.team).map(d => d.name));

  const MyDriversPage = () => {
    const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
    const [promotionModalOpen, setPromotionModalOpen] = useState(false);
    const [driverToReplace, setDriverToReplace] = useState(null);

    const handleAction = async (action, driverName) => {
      if (action === 'release') {
        if(confirm(`Are you sure you want to release ${driverName}? This action cannot be undone.`)) {
          if (state.team.reserveDriver?.name === driverName) {
            state.team.reserveDriver = null;
          } else {
            state.team.drivers = state.team.drivers.filter((d: any) => d.name !== driverName);
          }
          await syncGame();
          setFlashMessage(`Released ${driverName} from their contract.`);
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
                 driver.careerTimeline = driver.careerTimeline || [];
                 driver.careerTimeline.unshift({ seasonYear: state.season.year || 1, event: 'Demoted', detail: 'Demoted to Reserve Driver' });
                 
                 state.team.reserveDriver = driver;
                 await syncGame();
                 setFlashMessage(`Demoted ${driverName} to Reserve Driver.`);
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
                 reserve.careerTimeline = reserve.careerTimeline || [];
                 reserve.careerTimeline.unshift({ seasonYear: state.season.year || 1, event: 'Race Seat', detail: 'Promoted to active Race Seat' });
                 
                 state.team.drivers.push(reserve);
                 await syncGame();
                 setFlashMessage(`Promoted ${driverName} to Race Seat.`);
             } else {
                 setPromotionModalOpen(true);
             }
         }
      }
    };

    const confirmPromotion = async (replaceDriverName) => {
       const replaceDriver = state.team.drivers.find(d => d.name === replaceDriverName);
       if (!replaceDriver) return;

       if(confirm(`Replace ${replaceDriverName} with ${state.team.reserveDriver.name}? ${replaceDriverName} will be released.`)) {
           if (state.team.promoteReserveToSeat(replaceDriverName, state)) {
              await syncGame();
              setFlashMessage(`Promoted new driver and released ${replaceDriverName}.`);
              setPromotionModalOpen(false);
           }
       }
    };

    const buildStat = (label, value, trend = null) => (
      <div style={{background:'rgba(255,255,255,0.02)', padding:'10px 14px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)'}}>
        <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'4px', textTransform:'uppercase'}}>{label}</span>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
          <span style={{fontSize:'15px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{value}</span>
        </div>
      </div>
    );

    const buildDriverCard = (driver, role, isActive, delayIndex = 0) => {
      const points = state.standings.drivers[driver.name] ?? 0;
      const raceNumber = getDriverNumber(driver);
      const potentialRating = driver.potentialCeiling || Math.min(99, Math.round(driver.pace * 1.05 + 2));
      const morale = driver.morale || 94;
      const chemistry = 88;
      const age = driver.age || 25;
      const wins    = state.driverWins?.[driver.name] || 0;
      const podiums  = state.driverPodiums?.[driver.name] || 0;
      const bestPos  = state.bestFinishes?.[driver.name] || '—';
      const top10s   = typeof bestPos === 'number' && bestPos <= 10 ? '✓' : '—';

      return (
        <motion.div 
          layout
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4, delay: delayIndex * 0.05 }}
          key={driver.name} style={{...glassCard({padding:0}), display:'flex', flexDirection:'column', justifyContent:'space-between', borderTop: isActive ? `3px solid ${HUB.accent}` : '1px solid rgba(255,255,255,0.05)'}}
        >
          <div style={{padding:'24px', borderBottom:`1px solid ${HUB.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start', background:'rgba(255,255,255,0.02)'}}>
            <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
              <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'64px', height:'64px', borderRadius:'50%', objectFit:'cover', border:`2px solid ${isActive ? HUB.accent : 'rgba(255,255,255,0.1)'}`}} loading="lazy"/>
              <div>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <span style={{fontSize:'16px', fontFamily:HUB.fontMono, color:HUB.accent}}>#{raceNumber}</span>
                  <span style={pill(isActive)}>{driver.roleLabel ? driver.roleLabel.toUpperCase() : isActive ? "ACTIVE SEAT" : `${role.toUpperCase()} DRIVER`}</span>
                </div>
                <h3 style={{fontSize:'22px', fontFamily:HUB.fontBold, margin:'4px 0 0', color:'#fff'}}>{driver.name.toUpperCase()}</h3>
                <span style={{fontSize: '11px', color: HUB.textMuted, display: 'block', marginTop: '4px'}}>Age {age} • {driver.category} Class</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: `1px solid ${HUB.border}`, background: 'rgba(0,0,0,0.2)' }}>
            {[
              { label: 'PTS',      val: points },
              { label: 'WINS',     val: wins },
              { label: 'PODIUMS',  val: podiums },
              { label: 'TOP 10',   val: top10s },
              { label: 'BEST FIN', val: typeof bestPos === 'number' ? `P${bestPos}` : '—' }
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderRight: i < 4 ? `1px solid ${HUB.border}` : 'none' }}>
                <span style={{ display: 'block', fontSize: '9px', color: HUB.textMuted, marginBottom: '2px' }}>{stat.label}</span>
                <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, color: '#fff' }}>{typeof stat.val === 'number' ? <AnimatedNumber value={stat.val}/> : stat.val}</span>
              </div>
            ))}
          </div>

          <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', flex:1 }}>
            <div>
               <h4 style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.1em' }}>Performance Telemetry</h4>
               <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <RadarChart pace={driver.pace} quali={driver.quali} racecraft={driver.racecraft} consistency={driver.consistency} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flex: 1 }}>
                    {buildStat("Pace", (driver.pace || 0).toFixed(1))}
                    {buildStat("Qualifying", (driver.quali || 0).toFixed(1))}
                    {buildStat("Racecraft", (driver.racecraft || 0).toFixed(1))}
                    {buildStat("Consistency", (driver.consistency || 0).toFixed(1))}
                  </div>
               </div>
            </div>

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
                  <AnimatedBar value={morale} color={morale > 50 ? "#10b981" : "#f87171"} />
                </div>
              </div>
            </div>
          </div>
          
          <div style={{padding:'20px 24px', borderTop:`1px solid ${HUB.border}`, background:'rgba(0,0,0,0.1)', display:'flex', gap:'12px'}}>
            <button onClick={() => handleAction('release', driver.name)} style={{...actionBtn({backgroundColor:'transparent', border:`1px solid ${HUB.border}`, color:'#f87171', boxShadow:'none', flex:1, borderRadius:'4px'})}}>RELEASE CONTRACT</button>
            {role === "Main" ? (
              <button onClick={() => handleAction('demote', driver.name)} disabled={!!state.team.reserveDriver} style={{...actionBtn({flex:1, borderRadius:'4px'}), opacity: state.team.reserveDriver ? 0.5 : 1}}>DEMOTE TO RESERVE</button>
            ) : (
              <button onClick={() => handleAction('promote', driver.name)} style={{...actionBtn({flex:1, borderRadius:'4px'})}}>PROMOTE TO SEAT</button>
            )}
          </div>
        </motion.div>
      );
    };

    return (
      <div>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {sectionLabel('Personnel Management')}
            {pageTitle('Driver Dossiers')}
            {pageSubtitle('Manage contracts, review telemetry, and analyze driver morale.')}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={statCell()}>
               {statLabel('Active Roster')}
               {statValue(`${state.team.drivers.length} / 2`)}
            </div>
            <div style={statCell()}>
               {statLabel('Reserve Seat')}
               {statValue(state.team.reserveDriver ? "Filled" : "Empty")}
            </div>
          </div>
        </div>

        {flashMessage && (
          <div style={{ padding: '16px', background: 'rgba(225,6,0,0.1)', border: `1px solid ${HUB.accent}`, borderRadius: '4px', color: '#fff', fontSize: '13px', marginBottom: '24px' }}>
            {flashMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
          {state.team.drivers.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 16px', textTransform: 'uppercase' }}>Active Lineup</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                <AnimatePresence>
                  {state.team.drivers.map((driver: any, idx: number) => buildDriverCard(driver, "Main", true, idx))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Reserve Driver Section */}
          <div>
            <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 16px', textTransform: 'uppercase' }}>Reserve Driver</h3>
            {state.team.reserveDriver ? (
              <div style={{ maxWidth: '600px' }}>
                <AnimatePresence>
                  {buildDriverCard(state.team.reserveDriver, "Reserve", false, 0)}
                </AnimatePresence>
              </div>
            ) : (
              <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center', border: `1px dashed ${HUB.borderMid}` }}>
                <span style={{ color: HUB.textMuted, fontSize: '14px' }}>Reserve seat is currently empty. Scout the market or promote from your academy.</span>
              </div>
            )}
          </div>
        </div>

        {/* Promotion Modal */}
        {promotionModalOpen && state.team.reserveDriver && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <div style={{ ...glassCard({ padding: '0', maxWidth: '600px', width: '100%' }), overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {sectionLabel('Seat Allocation')}
                  <h3 style={{ fontSize: '20px', fontFamily: HUB.fontWide, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Replace a Race Driver</h3>
                </div>
                <button onClick={() => setPromotionModalOpen(false)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: '24px' }}>&times;</button>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ color: HUB.textMuted, marginBottom: '16px', fontSize: '13px' }}>Your active lineup is full. Select which race driver to replace with <strong style={{ color: '#fff' }}>{state.team.reserveDriver.name}</strong>. The replaced driver will be released.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {state.team.drivers.map((d: any) => (
                    <div key={d.name} style={{ ...glassCard({ padding: '16px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontBold }}>{d.name}</span>
                        <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>OVR {d.currentRating ? d.currentRating() : '—'} · ${(d.salary / 24).toFixed(2)}M/race</span>
                      </div>
                      <button onClick={() => { setDriverToReplace(d.name); confirmPromotion(d.name); }} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '11px' }) }}>Replace</button>
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

  mountLayout(root, 'drivers', <MyDriversPage />, () => renderMyDrivers(root, initialFlashMessage));
}
