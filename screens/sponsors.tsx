import React from 'react';
import { sponsors, SPONSOR_SLOTS } from "../data/sponsors.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { assignSponsorToSlot, countActiveSponsorDeals, ensureSponsorSlots, getTotalSponsorRaceBonus, rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { ensureFinanceState } from "../utils/financeSystem.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, HUB, glassCard, statCell, pill, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { BadgeCheck, DollarSign, Handshake, AlertTriangle } from 'lucide-react';

export function renderSponsors(root, flashMessage = "") {
  ensureTeamState(state.team);
  if (!state.team) {
     const content = (<div><div style={{marginBottom:'32px'}}>{pageTitle('Sponsors')}{pageSubtitle('Create a team first.')}</div></div>);
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
    if (cleared) msg = `${slotKey} cleared`;
    else if (signingBonusPaid > 0) msg = `Brand assigned to ${slotKey}, signing bonus $${signingBonusPaid}M`;
    else msg = `Brand assigned to ${slotKey}, bonus already paid`;
    await syncGame();
    renderSponsors(root, msg);
  };

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {pageTitle('Sponsors')}
          {pageSubtitle('Manage active deals, sponsor reputation and race weekend objective bonuses.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash reserve')}{statValue(`$${state.team.budget.toFixed(1)}M`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Slots filled')}{statValue(`${dealCount}/${SPONSOR_SLOTS.length}`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Monthly income')}{statValue(`$${totalRace.toFixed(1)}M`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Relationship')}{statValue(`${finance.sponsorHappiness}%`, finance.sponsorHappiness >= 60 ? HUB.textPrimary : HUB.warning)}</div>
        </div>
      </div>

      {flashMessage && (
        <div style={{padding:'12px 16px', background:HUB.raised, border:`1px solid ${HUB.border}`, borderRadius:'8px', color:HUB.textPrimary, fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      {/* Grid of Placements Map & Reputation info */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'40px'}}>
        
        {/* Placements Map (Span 8) */}
        <div style={{...glassCard(), gridColumn:'span 8'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px' }}>Active placements</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
            {SPONSOR_SLOTS.map(slot => {
              const currentId = state.team.sponsorSlots[slot.key]?.id ?? "";
              const options = state.sponsorOffers.filter(s => s.slot === slot.placement);
              return (
                <div key={slot.key} style={{background:HUB.raised, border:`1px solid ${HUB.border}`, padding:'16px', borderRadius:'8px'}}>
                  <span style={{fontSize: '14px', fontFamily:HUB.fontBold, color:HUB.textPrimary, display:'block', marginBottom:'4px'}}>{slot.label}</span>
                  <p style={{fontSize:'12px', color:HUB.textMuted, margin:'0 0 12px'}}>{slot.blurb}</p>
                  <select 
                    value={currentId} 
                    onChange={(e) => handleAssign(slot.key, e.target.value)}
                    style={{width:'100%', height:'36px', background:HUB.bg, border:`1px solid ${HUB.border}`, padding:'0 12px', borderRadius:'8px', color:HUB.textPrimary, outline:'none', fontSize:'13px', fontFamily:HUB.fontRegular}}
                  >
                    <option value="">Vacant</option>
                    {options.map(o => <option key={o.id} value={o.id}>{o.name} · +${o.monthlyIncome ?? o.fee}M/mo</option>)}
                  </select>
                  {state.team.sponsorSlots[slot.key]?.objectives?.length > 0 && (
                    <div style={{marginTop:'12px', display:'flex', flexDirection:'column', gap:'8px'}}>
                      {state.team.sponsorSlots[slot.key].objectives.slice(0, 2).map((objective) => (
                        <div key={objective.id + objective.deadline} style={{padding:'8px 12px', borderRadius:'8px', background:HUB.surface, border:`1px solid ${HUB.border}`}}>
                          <div style={{display:'flex', justifyContent:'space-between', gap:'8px'}}>
                            <span style={{fontSize: '11px', color:HUB.textPrimary, fontFamily:HUB.fontBold}}>{objective.label}</span>
                            <span style={{fontSize: '11px', color:objective.complete ? HUB.positive : HUB.textMuted}}>{objective.complete ? 'Achieved' : `R${objective.deadline}`}</span>
                          </div>
                          <span style={{fontSize: '11px', color:HUB.textMuted}}>Reward ${objective.reward}M · Penalty ${objective.penalty}M · {objective.difficulty}</span>
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
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px' }}>Brand reputation</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0 0 24px'}}>Brand prestige, contract length, and relationship level now determine sponsor value and future offer quality.</p>

            <div style={{background:HUB.raised, padding:'16px', borderRadius:'8px', border:`1px solid ${HUB.border}`, textAlign:'center', marginBottom:'16px'}}>
              <span style={{fontSize: '12px', color:HUB.textFaint, display:'block', marginBottom:'8px'}}>Commercial reputation</span>
              <span style={{fontSize:'28px', fontFamily:HUB.fontBold, color:HUB.textPrimary}}>{finance.reputation}</span>
              <span style={{fontSize: '12px', color:finance.sponsorHappiness >= 60 ? HUB.textMuted : HUB.warning, display:'block', marginTop:'8px'}}>Relationship {finance.sponsorHappiness}%</span>
            </div>
          </div>

          <div style={{borderTop:`1px solid ${HUB.border}`, paddingTop:'16px', fontSize:'13px', lineHeight:'1.5', color:HUB.textMuted}}>
            <span style={{fontFamily:HUB.fontBold, color:HUB.textPrimary, display:'block', marginBottom:'4px'}}>Commercial objective</span>
            Complete sponsor objectives to improve relationship levels and unlock richer contract renewals.
          </div>
        </div>

      </div>

      <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px' }}>Available sponsors</h3>
      <div style={{display:'flex', flexDirection:'column', gap: '24px'}}>
        {["Title", "Kit", "Sidepod", "Rear Wing", "Halo"].map(slotType => {
          const slotOffers = state.sponsorOffers.filter(s => s.slot === slotType);
          if (slotOffers.length === 0) return null;
          return (
            <div key={slotType}>
              <h4 style={{fontSize:'12px', fontFamily:HUB.fontBold, color:HUB.textMuted, margin:'0 0 12px'}}>{slotType} slots</h4>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px'}}>
                {slotOffers.map(sp => (
                  <div key={sp.id} style={{...glassCard({padding:'16px'}), position:'relative'}}>
                    {state.signedSponsors[sp.id] && (
                       <span style={{position:'absolute', top:'16px', right:'16px', ...pill()}}>Signed before</span>
                    )}
                    <p style={{fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color:HUB.textFaint, margin:'0 0 4px'}}>{sp.partnerType || sp.industry}</p>
                    <h3 style={{fontSize:'18px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 8px'}}>{sp.name}</h3>
                    <p style={{fontSize:'12px', color:HUB.textMuted, margin:'0 0 16px', minHeight:'36px'}}>{sp.strategicBenefit || sp.perk}</p>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                      <div style={{flex:1, background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                         <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Signing bonus</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>${sp.signingBonus ?? sp.bonus}M</span>
                      </div>
                      <div style={{flex:1, background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                         <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Monthly income</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>${sp.monthlyIncome ?? sp.fee}M</span>
                      </div>
                      <div style={{flex:1, background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                         <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Contract</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>{sp.contractLength} rounds</span>
                      </div>
                      <div style={{flex:1, background:HUB.raised, padding:'8px 12px', borderRadius:'8px'}}>
                         <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Prestige</span>
                         <span style={{fontSize:'14px', fontFamily:HUB.fontMono, color:HUB.textPrimary, fontVariantNumeric:'tabular-nums' }}>{sp.brandPrestige}</span>
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
