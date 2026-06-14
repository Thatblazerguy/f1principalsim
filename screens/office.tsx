import React from 'react';
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import {
  ensureSeasonTimeline,
  requestTimedUpgrade,
  getPendingUpgradeForPart,
  getNextUpgradeAvailability,
  formatSeasonDate,
  getRoundRaceDay,
} from "../utils/seasonTimeline.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, pill, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { Cpu, Shield, Activity, Sliders, Play, Settings } from 'lucide-react';

function getRoundFromDay(day) {
  return Math.floor((Math.max(1, day) - 1) / 14) + 1;
}

export function renderOffice(root, flashMessage = "") {
  ensureTeamState(state.team);
  ensureSeasonTimeline(state);
  const currentDay = state.season.currentDay;
  const nextUpgrade = getNextUpgradeAvailability(state.team, currentDay);
  const nextRaceRound = state.season.round;
  const nextRaceDay = getRoundRaceDay(nextRaceRound);
  const daysUntilRace = Math.max(0, nextRaceDay - currentDay);

  const handleUpgrade = async (part) => {
    const loader = document.createElement("div");
    loader.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;";
    loader.innerHTML = `<div style="width:40px;height:40px;border:4px solid #333;border-top-color:#E10600;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
    document.body.appendChild(loader);

    setTimeout(async () => {
      loader.remove();
      const request = requestTimedUpgrade(state.team, part, state.season.currentDay, state.season.round);
      if (!request.ok) {
        renderOffice(root, request.reason);
        return;
      }
      await syncGame();
      const etaRound = getRoundFromDay(request.entry.readyDay);
      renderOffice(root, `${part.toUpperCase()} project started. Completion expected by ${formatSeasonDate(state.season.year || 1, request.entry.readyDay)} (Round ${etaRound}).`);
    }, 900);
  };

  const content = (
    <div>
      {/* Title */}
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('R&D Center')}
          {pageTitle('Engineering Facility')}
          {pageSubtitle('Direct structural projects, wind tunnel testing allocation, and manufacture aerodynamic upgrade parts.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Budget')}
             {statValue(`$${(state.team.budget || 0).toFixed(1)}M`)}
          </div>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Car Perf.')}
             {statValue((state.team.carPerformance || 0).toFixed(1))}
          </div>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Team Lv')}
             {statValue(`Lv ${state.team.level}`)}
          </div>
        </div>
      </div>

      {/* R&D Active status bar */}
      {flashMessage && (
        <div style={{padding:'16px', background:'rgba(225,6,0,0.1)', border:`1px solid ${HUB.accent}`, borderRadius:'4px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      {/* Main R&D Layout split: Left Side blueprint, Right Side upgrades */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px'}}>
        
        {/* Left Side: Car blueprint blueprint panel (Span 5) */}
        <div style={{...glassCard(), gridColumn:'span 5', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'12px', fontFamily:HUB.fontBold, color:HUB.accent, letterSpacing:'0.15em', textTransform:'uppercase', margin:'0 0 16px'}}>R&D Blueprint</h3>
            
            {/* SVG Wireframe Car Representation */}
            <div style={{background:'rgba(0,0,0,0.2)', padding:'24px', borderRadius:'6px', border:'1px dashed rgba(255,255,255,0.08)', position:'relative', marginBottom:'24px', display:'flex', justifyContent:'center'}}>
              <svg width="100%" height="100" viewBox="0 0 200 60" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2">
                {/* Nose cone & wing */}
                <path d="M10,30 L30,28 L60,28 L90,26 L120,27 L150,29 L180,30" />
                <path d="M10,25 L10,35 M5,30 L20,30" stroke={HUB.accent} strokeWidth="1.5" />
                {/* Cockpit / Halo */}
                <path d="M90,26 Q100,12 115,15 Q125,20 130,27" />
                <circle cx="110" cy="22" r="4" stroke="rgba(225,6,0,0.5)" />
                {/* Wheels */}
                <circle cx="45" cy="40" r="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <circle cx="155" cy="40" r="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <circle cx="45" cy="40" r="4" fill="rgba(255,255,255,0.2)" />
                <circle cx="155" cy="40" r="4" fill="rgba(255,255,255,0.2)" />
                {/* Rear wing */}
                <path d="M180,30 L180,14 L195,14 M180,20 L195,20" stroke={HUB.accent} strokeWidth="1.5" />
              </svg>
              <div style={{position:'absolute', bottom:'10px', left:'15px', fontSize:'9px', color:HUB.textMuted, fontFamily:HUB.fontMono}}>TELEMETRY SHIELD ENGINE ACTIVE</div>
            </div>

            {/* Performance Radar Metrics */}
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {[
                { name: "AERODYNAMICS", val: state.team.specs?.aero || 80, color: HUB.accent },
                { name: "CHASSIS GRIP", val: state.team.specs?.chassis || 80, color: "#3b82f6" },
                { name: "RELIABILITY", val: state.team.specs?.reliability || 80, color: "#10b981" }
              ].map(spec => (
                <div key={spec.name}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px'}}>
                    <span style={{color:HUB.textMuted}}>{spec.name}</span>
                    <span style={{color:'#fff', fontWeight:700}}>{spec.val}%</span>
                  </div>
                  <div style={{width:'100%', height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'999px', overflow:'hidden'}}>
                    <div style={{height:'100%', backgroundColor:spec.color, width:`${spec.val}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'20px', marginTop:'24px'}}>
            <h4 style={{fontSize:'10px', fontFamily:HUB.fontBold, color:'#fff', textTransform:'uppercase', margin:'0 0 8px'}}>Wind Tunnel Allocation</h4>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.02)', padding:'10px 14px', borderRadius:'4px'}}>
              <span style={{fontSize:'12px', color:HUB.textMuted}}>ACTIVE ALLOCATION</span>
              <span style={{fontSize:'13px', fontFamily:HUB.fontBold, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>74% CAPACITY</span>
            </div>
          </div>
        </div>

        {/* Right Side: Upgrades Grid (Span 7) */}
        <div style={{gridColumn:'span 7', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
          {Object.keys(state.team.car).map(part => {
            const currentLevel = state.team.car[part];
            const pending = getPendingUpgradeForPart(state.team, part);
            const cost = 50 * currentLevel;
            const canAfford = state.team.budget >= cost && !pending;
            const etaDays = pending ? Math.max(0, pending.readyDay - currentDay) : 0;
            const etaRound = pending ? getRoundFromDay(pending.readyDay) : null;

            return (
              <div key={part} style={{...glassCard({padding:0}), display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
                <div style={{padding:'20px', borderBottom:`1px solid ${HUB.border}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                  <div>
                    <span style={{fontSize:'8px', color:HUB.textMuted, textTransform:'uppercase', display:'block', marginBottom:'4px'}}>CAR SUB-SYSTEM</span>
                    <h3 style={{fontSize:'16px', fontWeight:800, margin:'0 0 4px', color:'#fff', textTransform:'uppercase'}}>{part}</h3>
                    <p style={{fontSize:'11px', color:HUB.textMuted, margin:0}}>
                      {pending
                        ? `ETA: ${etaDays} day${etaDays === 1 ? "" : "s"} (Round ${etaRound})`
                        : `Current: Lv ${currentLevel} · Next: $${cost}M`
                      }
                    </p>
                  </div>
                  <span style={pill(!!pending)}>
                    {pending ? "IN DEVELOPMENT" : "AVAILABLE"}
                  </span>
                </div>

                <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  <div style={{background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'4px'}}>
                    <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>RESERVED CASH</span>
                    <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${cost}M</span>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'4px'}}>
                    <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>UPGRADE VALUE</span>
                    <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>+1.5 OVR</span>
                  </div>
                </div>

                <div style={{padding:'20px', borderTop:`1px solid ${HUB.border}`}}>
                  <button
                    onClick={() => handleUpgrade(part)}
                    disabled={!canAfford && !pending}
                    style={{
                      ...actionBtn({width:'100%', padding:'10px 16px', borderRadius:'4px'}),
                      opacity: (!canAfford && !pending) || pending ? 0.5 : 1,
                      cursor: (!canAfford && !pending) || pending ? 'not-allowed' : 'pointer',
                      backgroundColor: pending ? 'transparent' : HUB.accent,
                      border: pending ? `1px solid ${HUB.border}` : 'none'
                    }}
                  >
                    {pending ? "PROJECT IN PROG." : `ALLOCATE R&D FUNDS`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform:rotate(360deg); } }
      `}}/>
    </div>
  );

  mountLayout(root, 'engineering', content, () => renderOffice(root));
}
