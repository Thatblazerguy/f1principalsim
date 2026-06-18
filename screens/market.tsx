import React from 'react';
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { ShieldCheck, Compass, Briefcase, Search, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';

function isDriverEmployed(name) {
  if (state.team.drivers.some(d => d.name === name)) return true;
  if (state.team.reserveDriver?.name === name) return true;
  if (state.aiTeams) {
    for (const aiTeam of state.aiTeams) {
      if (aiTeam.drivers.some(d => d.name === name)) return true;
      if (aiTeam.reserveDriver?.name === name) return true;
    }
  }
  return false;
}

export function renderMarket(root) {
  if (!root) return;
  ensureTeamState(state.team);

  if (!state.team) {
     const content = (
       <div>
         <div style={{marginBottom:'32px'}}>
           {sectionLabel('Talent Scouting')}
           {pageTitle('Driver Market')}
           {pageSubtitle('Establish constructor setup registry before scouting prospective candidates.')}
         </div>
       </div>
     );
     mountLayout(root, 'market', content);
     return;
  }

  const handleSign = async (d) => {
    if (isDriverEmployed(d.name)) return;
    if (state.team.reserveDriver) return;
    state.team.signDriver(d, "reserve");
    await syncGame();
    renderMarket(root);
  };

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('Talent Scouting')}
          {pageTitle('Driver Recruitment')}
          {pageSubtitle('Filter through active grid drivers and F2 prospects to recruit for your team.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'120px'})}>
            {statLabel('Operations budget')}
            <div style={{fontSize:'16px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>
              $<AnimatedNumber value={state.team.budget || 0} formatter={(v) => v.toFixed(1)} />M
            </div>
          </div>
          <div style={statCell({minWidth:'120px'})}>
            {statLabel('Driver Cap status')}
            {statValue(`${state.team.drivers.length} / ${state.team.reserveDriver ? 1 : 0}`)}
          </div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'24px'}}>
        {drivers.filter(d => !isDriverEmployed(d.name)).map((d, i) => {
          // potential metrics
          const potential = Math.min(99, Math.round(d.pace * 1.04 + 3));
          const isAcademy = d.driverRole === 'academy';
          
          return (
            <SlideUp key={d.name} delay={i * 0.05}>
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              style={{...glassCard({padding:'0'}), display:'flex', flexDirection:'column', justifyContent:'space-between', borderLeft:`3px solid ${d.market >= 85 ? HUB.accent : 'rgba(255,255,255,0.05)'}`}}
            >
              <div style={{padding:'20px', borderBottom:`1px solid ${HUB.border}`}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px'}}>
                  <div>
                    <span style={{fontSize:'8px', color:HUB.textMuted, display:'block', marginBottom:'4px', letterSpacing:'0.05em'}}>{d.category} CLASS</span>
                    <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                      <img src={getDriverHeadshotUrl(d)} alt={d.name} style={{width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}`}} loading="lazy"/>
                      <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, margin:0, color:'#fff'}}>{d.name.toUpperCase()}</h3>
                    </div>
                  </div>
                  {isAcademy ? <span style={pill(true)}>ACADEMY</span> : <span style={pill(false)}>MARKET: {d.market}</span>}
                </div>
                <p style={{fontSize:'12px', color:HUB.textMuted, margin:0}}>Age {d.age} · Salary ${d.salary}M · Est. Potential {potential} OVR</p>
              </div>

              <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', flex:1}}>
                 <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                   <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Pace</span>
                   <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.pace||0).toFixed(1)}</span>
                 </div>
                 <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                   <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Quali</span>
                   <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.quali||0).toFixed(1)}</span>
                 </div>
                 <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                   <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Racecraft</span>
                   <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.racecraft||0).toFixed(1)}</span>
                 </div>
                 <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                   <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Consistency</span>
                   <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.consistency||0).toFixed(1)}</span>
                 </div>
              </div>

              <div style={{padding:'20px', borderTop:`1px solid ${HUB.border}`, background:'rgba(0,0,0,0.1)'}}>
                <button onClick={() => handleSign(d)} disabled={!!state.team.reserveDriver} style={{...actionBtn({width:'100%', borderRadius:'4px'}), opacity: state.team.reserveDriver ? 0.5 : 1}}>
                  {state.team.reserveDriver ? 'SYSTEM AT CAPACITY' : 'OFFER RESERVE CONTRACT'}
                </button>
              </div>
            </motion.div>
            </SlideUp>
          );
        })}
      </div>
    </div>
  );

  mountLayout(root, 'market', content, () => renderMarket(root));
}
