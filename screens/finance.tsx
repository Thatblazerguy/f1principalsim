import React from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { getTotalSponsorRaceBonus } from "../utils/sponsorDeals.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { DollarSign, AlertCircle, TrendingUp, TrendingDown, Landmark } from 'lucide-react';

export function renderFinance(root) {
  ensureTeamState(state.team);
  
  const roster = getTeamRoster(state.team);
  const totalSalaries = roster.reduce((sum, d) => sum + d.salary, 0);
  const sponsorRevenue = getTotalSponsorRaceBonus(state.team);
  
  // Cost cap data
  const spentCarUpgrades = Object.keys(state.team.car).reduce((sum, part) => {
    const lvl = state.team.car[part];
    // upgrade cost formula is 50 * currentLevel. We estimate spent.
    return sum + (lvl * 15);
  }, 35);
  
  const totalSpent = spentCarUpgrades + totalSalaries;
  const costCapLimit = 140; // $140M
  const costCapRemaining = Math.max(0, costCapLimit - totalSpent);

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('Financial Control')}
          {pageTitle('Finance Command')}
          {pageSubtitle('Monitor cash flows, cost cap allowances, and operations payroll budgets.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash Reserve')}{statValue(`$${state.team.budget.toFixed(1)}M`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Total Spent')}{statValue(`$${totalSpent.toFixed(1)}M`)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cost Cap Limit')}{statValue(`$${costCapLimit}M`)}</div>
        </div>
      </div>

      {/* Grid of Ledger Modules */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'32px'}}>
        
        {/* Cost Cap tracker (Span 7) */}
        <div style={{...glassCard(), gridColumn:'span 7', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Cost Cap Compliance</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0 0 24px'}}>Track constructor development investments against the FIA $140M regulations.</p>
            
            {/* Visual Progress bar */}
            <div style={{background:'rgba(255,255,255,0.05)', height:'24px', borderRadius:'4px', overflow:'hidden', position:'relative', marginBottom:'16px'}}>
              <div style={{
                height:'100%', 
                background: `linear-gradient(90deg, ${HUB.accent}, #ef4444)`, 
                width: `${Math.min(100, (totalSpent / costCapLimit) * 100)}%`,
                transition: 'width 0.5s'
              }} />
              <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', fontSize:'11px', fontWeight:700, fontFamily:HUB.fontMono}}>
                <span>EXPENDED: ${totalSpent.toFixed(1)}M</span>
                <span>{(totalSpent / costCapLimit * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'20px'}}>
            <div>
              <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'4px'}}>CAP COMPLIANCE</span>
              <span style={{fontSize:'12px', color:'#10b981', display:'flex', alignItems:'center', gap:'6px', fontWeight:700}}>
                <ShieldCheck size={14}/> UNDER REGULATION CAP
              </span>
            </div>
            <div style={{textAlign:'right'}}>
              <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'4px'}}>REMAINING ALLOWANCE</span>
              <span style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${costCapRemaining.toFixed(1)}M</span>
            </div>
          </div>
        </div>

        {/* Operating Cash Flow projection (Span 5) */}
        <div style={{...glassCard(), gridColumn:'span 5', display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
          <div>
            <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Race Cash Flow</h3>
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0 0 24px'}}>Estimated revenue vs payroll payouts per race weekend.</p>

            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(16,185,129,0.06)', borderRadius:'4px'}}>
                <span style={{fontSize:'12px', color:'#10b981', display:'flex', alignItems:'center', gap:'8px'}}><TrendingUp size={14}/> Sponsor Payout</span>
                <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:'#10b981', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>+${sponsorRevenue.toFixed(1)}M</span>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(239,68,68,0.06)', borderRadius:'4px'}}>
                <span style={{fontSize:'12px', color:'#ef4444', display:'flex', alignItems:'center', gap:'8px'}}><TrendingDown size={14}/> Driver Payroll</span>
                <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:'#ef4444', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>-${totalSalaries.toFixed(1)}M</span>
              </div>
            </div>
          </div>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'20px', marginTop:'16px'}}>
            <span style={{fontSize:'11px', color:HUB.textMuted}}>NET WEEKEND BALANCE</span>
            <span style={{
              fontSize:'16px', 
              fontFamily:HUB.fontBold, 
              color: (sponsorRevenue - totalSalaries) >= 0 ? '#10b981' : '#ef4444',
              fontVariantNumeric:'tabular-nums',
              letterSpacing:'0.03em'
            }}>
              {(sponsorRevenue - totalSalaries) >= 0 ? '+' : ''}${(sponsorRevenue - totalSalaries).toFixed(2)}M
            </span>
          </div>
        </div>

      </div>

      {/* Driver Ledger payroll (Dossier detail style) */}
      <div style={glassCard()}>
        <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase'}}>Driver Payroll Dossier</h3>
        <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
          {roster.map(driver => (
            <div key={driver.name} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.03)'}}>
              <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
                <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover'}} />
                <div>
                  <span style={{fontSize:'13px', fontWeight:700, color:'#fff'}}>{driver.name}</span>
                  <span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>Active Contract</span>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <span style={{fontSize:'13px', fontFamily:HUB.fontMono, color:'#fff', fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${driver.salary.toFixed(1)}M / Year</span>
                <span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>Pay per GP: ${(driver.salary / 24).toFixed(3)}M</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  mountLayout(root, 'finance', content, () => renderFinance(root));
}

// Simple internal icon helper for ShieldCheck
function ShieldCheck({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
  );
}
