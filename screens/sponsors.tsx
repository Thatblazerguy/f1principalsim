import React from 'react';
import { sponsors, SPONSOR_SLOTS } from "../data/sponsors.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { assignSponsorToSlot, countActiveSponsorDeals, ensureSponsorSlots, getTotalSponsorRaceBonus, rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { BadgeCheck, DollarSign, Handshake, AlertTriangle } from 'lucide-react';

export function renderSponsors(root, flashMessage = "") {
  ensureTeamState(state.team);
  if (!state.team) {
     const content = (<div><div style={{marginBottom:'32px'}}>{sectionLabel('Commercial')}{pageTitle('Sponsors')}{pageSubtitle('Create a team first.')}</div></div>);
     mountLayout(root, 'sponsors', content);
     return;
  }

  if (state.sponsorOffers.length === 0) rotateSponsorOffers(state);
  ensureSponsorSlots(state.team);

  const dealCount = countActiveSponsorDeals(state.team);
  const totalRace = getTotalSponsorRaceBonus(state.team);

  const handleAssign = async (slotKey, sponsorId) => {
    const { signingBonusPaid, cleared } = assignSponsorToSlot(state.team, slotKey, sponsorId || null, state.sponsorOffers, state);
    let msg;
    if (cleared) msg = `${slotKey} cleared.`;
    else if (signingBonusPaid > 0) msg = `Brand assigned to ${slotKey}. Signing bonus: $${signingBonusPaid}M.`;
    else msg = `Brand assigned to ${slotKey}. (Bonus already paid)`;
    await syncGame();
    renderSponsors(root, msg);
  };

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('Commercial')}
          {pageTitle('Partnership Agreements')}
          {pageSubtitle('Manage active corporate deals, sponsor reputation tiers, and race weekend objective bonuses.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash Reserve')}{statValue(`$${state.team.budget.toFixed(1)}M`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Committed Slots')}{statValue(`${dealCount}/${SPONSOR_SLOTS.length}`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('GP Bonus Income')}{statValue(`$${totalRace.toFixed(1)}M`, HUB.accent)}</div>
        </div>
      </div>

      {flashMessage && (
        <div style={{padding:'16px', background:'rgba(225,6,0,0.1)', border:`1px solid ${HUB.accent}`, borderRadius:'4px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      {/* Grid of Placements Map & Reputation info */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'40px'}}>
        
        {/* Placements Map (Span 8) */}
        <div style={{...glassCard(), gridColumn:'span 8'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Active Placements</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
            {SPONSOR_SLOTS.map(slot => {
              const currentId = state.team.sponsorSlots[slot.key]?.id ?? "";
              const options = state.sponsorOffers.filter(s => s.slot === slot.placement);
              return (
                <div key={slot.key} style={{background:'rgba(255,255,255,0.01)', border:`1px solid rgba(255,255,255,0.03)`, padding:'16px', borderRadius:'6px'}}>
                  <span style={{fontSize:'10px', fontFamily:HUB.fontBold, color:HUB.accent, textTransform:'uppercase', display:'block', marginBottom:'4px'}}>{slot.label}</span>
                  <p style={{fontSize:'11px', color:HUB.textMuted, margin:'0 0 12px'}}>{slot.blurb}</p>
                  <select 
                    value={currentId} 
                    onChange={(e) => handleAssign(slot.key, e.target.value)}
                    style={{width:'100%', background:'rgba(0,0,0,0.3)', border:`1px solid rgba(255,255,255,0.1)`, padding:'10px', borderRadius:'4px', color:'#fff', outline:'none', fontSize:'12px'}}
                  >
                    <option value="">— Vacant Placement —</option>
                    {options.map(o => <option key={o.id} value={o.id}>{o.name} · +${o.fee}M/GP</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sponsor Reputation overview (Span 4) */}
        <div style={{...glassCard(), gridColumn:'span 4', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Brand Reputation</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0 0 24px'}}>Your constructor reputation level dictates which tier sponsors approach the commercial office.</p>

            <div style={{background:'rgba(255,255,255,0.02)', padding:'16px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)', textAlign:'center', marginBottom:'16px'}}>
              <span style={{fontSize:'10px', color:HUB.textMuted, display:'block', marginBottom:'6px'}}>REPUTATION LEVEL</span>
              <span style={{fontSize:'28px', fontFamily:HUB.fontBold, color:'#fff'}}>A-TIER</span>
              <span style={{fontSize:'9px', color:'#10b981', display:'block', marginTop:'6px'}}>★ PRESTIGE LEVEL COMPLIANT</span>
            </div>
          </div>

          <div style={{borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'16px', fontSize:'11px', lineHeight:'1.5', color:HUB.textMuted}}>
            <span style={{fontFamily:HUB.fontBold, color:'#fff', display:'block', marginBottom:'4px'}}>COMMERCIAL OBJECTIVE</span>
            Keep all 5 sponsor placements active to unlock maximum season payouts.
          </div>
        </div>

      </div>

      <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Available Sponsor Catalog</h3>
      <div style={{display:'flex', flexDirection:'column', gap: '24px'}}>
        {["Title", "Kit", "Sidepod", "Rear Wing", "Halo"].map(slotType => {
          const slotOffers = state.sponsorOffers.filter(s => s.slot === slotType);
          if (slotOffers.length === 0) return null;
          return (
            <div key={slotType}>
              <h4 style={{fontSize:'12px', fontFamily:HUB.fontBold, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 12px'}}>{slotType} Slots</h4>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px'}}>
                {slotOffers.map(sp => (
                  <div key={sp.id} style={{...glassCard({padding:'16px'}), position:'relative'}}>
                    {state.signedSponsors[sp.id] && (
                       <span style={{position:'absolute', top:'16px', right:'16px', ...pill()}}>Signed Before</span>
                    )}
                    <p style={{fontSize:'10px', fontWeight:700, color:HUB.accent, textTransform:'uppercase', margin:'0 0 4px'}}>{sp.industry}</p>
                    <h3 style={{fontSize:'18px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 8px'}}>{sp.name.toUpperCase()}</h3>
                    <p style={{fontSize:'12px', color:HUB.textMuted, margin:'0 0 16px', minHeight:'36px'}}>{sp.perk}</p>
                    <div style={{display:'flex', gap:'12px'}}>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>Signing Bonus</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${sp.bonus}M</span>
                      </div>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>GP Payout</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${sp.fee}M</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  mountLayout(root, 'sponsors', content, () => renderSponsors(root));
}
