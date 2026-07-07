import React from 'react';
import { sponsors, SPONSOR_SLOTS } from "../data/sponsors.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { assignSponsorToSlot, countActiveSponsorDeals, ensureSponsorSlots, getTotalSponsorRaceBonus, rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { ensureFinanceState } from "../utils/financeSystem.js";
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
  const finance = ensureFinanceState(state);
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
          <div style={statCell({minWidth:'120px'})}>{statLabel('Monthly Income')}{statValue(`$${totalRace.toFixed(1)}M`, HUB.accent)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Relationship')}{statValue(`${finance.sponsorHappiness}%`, finance.sponsorHappiness >= 60 ? '#10b981' : '#f59e0b')}</div>
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
                    {options.map(o => <option key={o.id} value={o.id}>{o.name} · +${o.monthlyIncome ?? o.fee}M/mo</option>)}
                  </select>
                  {state.team.sponsorSlots[slot.key]?.objectives?.length > 0 && (
                    <div style={{marginTop:'12px', display:'flex', flexDirection:'column', gap:'8px'}}>
                      {state.team.sponsorSlots[slot.key].objectives.slice(0, 2).map((objective) => (
                        <div key={objective.id + objective.deadline} style={{padding:'8px 10px', borderRadius:'6px', background:'rgba(255,255,255,0.025)', border:`1px solid ${HUB.border}`}}>
                          <div style={{display:'flex', justifyContent:'space-between', gap:'8px'}}>
                            <span style={{fontSize:'10px', color:'#fff', fontFamily:HUB.fontBold}}>{objective.label}</span>
                            <span style={{fontSize:'9px', color:objective.complete ? '#10b981' : HUB.textMuted}}>{objective.complete ? 'Achieved' : `R${objective.deadline}`}</span>
                          </div>
                          <span style={{fontSize:'9px', color:HUB.textMuted}}>Reward ${objective.reward}M · Penalty ${objective.penalty}M · {objective.difficulty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sponsor Reputation overview (Span 4) */}
        <div style={{...glassCard(), gridColumn:'span 4', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Brand Reputation</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0 0 24px'}}>Brand prestige, contract length, and relationship level now determine sponsor value and future offer quality.</p>

            <div style={{background:'rgba(255,255,255,0.02)', padding:'16px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)', textAlign:'center', marginBottom:'16px'}}>
              <span style={{fontSize:'10px', color:HUB.textMuted, display:'block', marginBottom:'6px'}}>COMMERCIAL REPUTATION</span>
              <span style={{fontSize:'28px', fontFamily:HUB.fontBold, color:'#fff'}}>{finance.reputation}</span>
              <span style={{fontSize:'9px', color:finance.sponsorHappiness >= 60 ? '#10b981' : '#f59e0b', display:'block', marginTop:'6px'}}>RELATIONSHIP {finance.sponsorHappiness}%</span>
            </div>
          </div>

          <div style={{borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'16px', fontSize:'11px', lineHeight:'1.5', color:HUB.textMuted}}>
            <span style={{fontFamily:HUB.fontBold, color:'#fff', display:'block', marginBottom:'4px'}}>COMMERCIAL OBJECTIVE</span>
            Complete sponsor objectives to improve relationship levels and unlock richer contract renewals.
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
                    <p style={{fontSize:'10px', fontWeight:700, color:HUB.accent, textTransform:'uppercase', margin:'0 0 4px'}}>{sp.partnerType || sp.industry}</p>
                    <h3 style={{fontSize:'18px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 8px'}}>{sp.name.toUpperCase()}</h3>
                    <p style={{fontSize:'12px', color:HUB.textMuted, margin:'0 0 16px', minHeight:'36px'}}>{sp.strategicBenefit || sp.perk}</p>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>Signing Bonus</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${sp.signingBonus ?? sp.bonus}M</span>
                      </div>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>Monthly Income</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${sp.monthlyIncome ?? sp.fee}M</span>
                      </div>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>Contract</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{sp.contractLength} R</span>
                      </div>
                      <div style={{flex:1, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:'6px'}}>
                         <span style={{fontSize:'9px', color:HUB.textMuted, textTransform:'uppercase', display:'block'}}>Prestige</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{sp.brandPrestige}</span>
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
