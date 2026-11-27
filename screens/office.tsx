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
import { FACILITY_CATALOG, ensureFinanceState, getFacilityUpgradeCost, requestFacilityInvestment } from "../utils/financeSystem.js";
import { mountLayout, HUB, glassCard, statCell, btn, btnClass, pill, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { Cpu, Shield, Activity, Sliders, Play, Settings } from 'lucide-react';

function getRoundFromDay(day) {
  return Math.floor((Math.max(1, day) - 1) / 14) + 1;
}

export function renderOffice(root, flashMessage = "") {
  ensureTeamState(state.team);
  const finance = ensureFinanceState(state);
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
      renderOffice(root, `${part.charAt(0).toUpperCase()}${part.slice(1)} project started, expected by ${formatSeasonDate(state.season.year || 1, request.entry.readyDay)} (round ${etaRound})`);
    }, 900);
  };

  const handleFacilityInvestment = async (facilityId) => {
    const request = requestFacilityInvestment(state, facilityId);
    await syncGame();
    renderOffice(root, request.ok
      ? `${request.facility.name} investment approved, construction completes on ${formatSeasonDate(state.season.year || 1, request.readyDay)}`
      : request.reason);
  };

  const content = (
    <div>
      {/* Title */}
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {pageTitle('R&D')}
          {pageSubtitle('Run structural projects, wind tunnel allocation and upgrade part manufacture.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Budget')}
             {statValue(`$${(state.team.budget || 0).toFixed(1)}M`)}
          </div>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Car performance')}
             {statValue((state.team.carPerformance || 0).toFixed(1))}
          </div>
          <div style={statCell({minWidth:'100px'})}>
             {statLabel('Team level')}
             {statValue(`Lv ${state.team.level}`)}
          </div>
        </div>
      </div>

      {/* R&D Active status bar */}
      {flashMessage && (
        <div style={{padding:'12px 16px', background:HUB.raised, border:`1px solid ${HUB.border}`, borderRadius:'8px', color:HUB.textPrimary, fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      {/* Main R&D Layout split: Left Side blueprint, Right Side upgrades */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px'}}>
        
        {/* Left Side: Car blueprint blueprint panel (Span 5) */}
        <div style={{...glassCard(), gridColumn:'span 5', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px'}}>Car blueprint</h3>
            
            {/* SVG Wireframe Car Representation */}
            <div style={{background:HUB.bg, padding:'24px', borderRadius:'8px', border:`1px solid ${HUB.border}`, position:'relative', marginBottom:'24px', display:'flex', justifyContent:'center'}}>
              <svg width="100%" height="100" viewBox="0 0 200 60" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2">
                {/* Nose cone & wing */}
                <path d="M10,30 L30,28 L60,28 L90,26 L120,27 L150,29 L180,30" />
                <path d="M10,25 L10,35 M5,30 L20,30" stroke="rgba(237,237,237,0.4)" strokeWidth="1.5" />
                {/* Cockpit / Halo */}
                <path d="M90,26 Q100,12 115,15 Q125,20 130,27" />
                <circle cx="110" cy="22" r="4" stroke="rgba(237,237,237,0.3)" />
                {/* Wheels */}
                <circle cx="45" cy="40" r="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <circle cx="155" cy="40" r="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <circle cx="45" cy="40" r="4" fill="rgba(255,255,255,0.2)" />
                <circle cx="155" cy="40" r="4" fill="rgba(255,255,255,0.2)" />
                {/* Rear wing */}
                <path d="M180,30 L180,14 L195,14 M180,20 L195,20" stroke="rgba(237,237,237,0.4)" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Performance Radar Metrics */}
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              {(() => {
                const specRows = [
                  { name: "Aerodynamics", val: state.team.specs?.aero || 80 },
                  { name: "Chassis grip", val: state.team.specs?.chassis || 80 },
                  { name: "Reliability", val: state.team.specs?.reliability || 80 }
                ];
                // One neutral series; the accent marks only the strongest area.
                const best = Math.max(...specRows.map(r => r.val));
                return specRows.map(spec => ({ ...spec, color: spec.val === best ? HUB.accent : 'rgba(237,237,237,0.5)' }));
              })().map(spec => (
                <div key={spec.name}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px'}}>
                    <span style={{color:HUB.textMuted}}>{spec.name}</span>
                    <span style={{color:HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold}}>{spec.val}%</span>
                  </div>
                  <div style={{width:'100%', height:'4px', background:HUB.border, borderRadius:'999px', overflow:'hidden'}}>
                    <div style={{height:'100%', backgroundColor:spec.color, width:`${spec.val}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{borderTop:`1px solid ${HUB.border}`, paddingTop:'20px', marginTop:'24px'}}>
            <h4 style={{fontSize: '14px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 8px'}}>Wind tunnel allocation</h4>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:HUB.raised, padding:'10px 12px', borderRadius:'8px'}}>
              <span style={{fontSize:'12px', color:HUB.textMuted}}>Active allocation</span>
              <span style={{fontSize:'13px', fontFamily:HUB.fontBold, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>74% capacity</span>
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
                    <h3 style={{fontSize:'16px', fontWeight: 400, fontFamily: HUB.fontBold, margin:'0 0 4px', color:HUB.textPrimary }}>{part}</h3>
                    <p style={{fontSize:'12px', color:HUB.textMuted, margin:0}}>
                      {pending
                        ? `ETA: ${etaDays} day${etaDays === 1 ? "" : "s"} (Round ${etaRound})`
                        : `Current: Lv ${currentLevel} · Next: $${cost}M`
                      }
                    </p>
                  </div>
                  <span style={{...pill(), whiteSpace:'nowrap'}}>
                    {pending ? "In development" : "Available"}
                  </span>
                </div>

                <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                    <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Reserved cash</span>
                    <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>${cost}M</span>
                  </div>
                  <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                    <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Upgrade value</span>
                    <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>+1.5 OVR</span>
                  </div>
                </div>

                <div style={{padding:'20px', borderTop:`1px solid ${HUB.border}`}}>
                  <button
                    onClick={() => handleUpgrade(part)}
                    disabled={!canAfford && !pending}
                    aria-disabled={pending || undefined}
                    className={btnClass('secondary')}
                    style={btn('secondary', 'md', { width:'100%' })}
                  >
                    {pending ? "In development" : `Allocate R&D funds`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <div style={{...glassCard(), marginTop:'24px'}}>
        <div style={{display:'flex', justifyContent:'space-between', gap:'20px', alignItems:'flex-start', marginBottom:'20px'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 8px' }}>Permanent facilities</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:0, lineHeight:1.5}}>Infrastructure upgrades improve long-term development, reliability, setup confidence, and operational pace.</p>
          </div>
          <span style={{...pill(), whiteSpace:'nowrap'}}>Linked to board review</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'16px'}}>
          {FACILITY_CATALOG.map((facility) => {
            const current = finance.facilities[facility.id];
            const cost = getFacilityUpgradeCost(facility.id, finance);
            const canInvest = state.team.budget >= cost && !current.upgrading && current.level < facility.maxLevel;
            return (
              <div key={facility.id} style={{padding:'16px', border:`1px solid ${HUB.border}`, borderRadius:'8px', background:HUB.raised}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px', marginBottom:'10px'}}>
                  <div>
                    <h4 style={{fontSize:'13px', color:HUB.textPrimary, fontFamily:HUB.fontBold, margin:'0 0 4px'}}>{facility.name}</h4>
                    <p style={{fontSize:'11px', color:HUB.textMuted, margin:0, lineHeight:1.4}}>{facility.benefit}</p>
                  </div>
                  <span style={{...pill(), backgroundColor:HUB.surface, whiteSpace:'nowrap'}}>{current.upgrading ? 'Building' : `Lv ${current.level}/${facility.maxLevel}`}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'16px'}}>
                  <span style={{fontSize:'12px', color:HUB.textMuted}}>
                    {current.upgrading ? `Ready day ${current.readyDay}` : `Next $${cost}M`}
                  </span>
                  <button
                    onClick={() => handleFacilityInvestment(facility.id)}
                    disabled={!canInvest}
                    className={btnClass('secondary')}
                    style={btn('secondary', 'sm')}
                  >
                    Invest in upgrade
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
