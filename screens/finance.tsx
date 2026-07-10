import React, { useState } from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import {
  BUDGET_ALLOCATION_LABELS,
  FACILITY_CATALOG,
  applyEmergencyFinanceAction,
  ensureFinanceState,
  getDriverCommercialValue,
  getFinanceAdvisorNotes,
  getTeamCommercialSummary,
  setBudgetAllocation,
} from "../utils/financeSystem.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { AlertTriangle, Banknote, BarChart3, BriefcaseBusiness, Building2, CircleDollarSign, Landmark, TrendingDown, TrendingUp, Users } from 'lucide-react';

const money = (value: number) => `${value >= 0 ? '' : '-'}$${Math.abs(value || 0).toFixed(1)}M`;

function MiniBar({ value, max = 100, color = HUB.accent }: { value: number, max?: number, color?: string }) {
  return (
    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

function FinanceDashboard({ root }: { root: HTMLElement }) {
  ensureTeamState(state.team);
  const finance = ensureFinanceState(state);
  const roster = getTeamRoster(state.team);
  const summary = getTeamCommercialSummary(state);
  const latestReport = finance.raceReports[finance.raceReports.length - 1];
  const latestBoard = finance.boardReviews[finance.boardReviews.length - 1];
  const advisorNotes = getFinanceAdvisorNotes(state);
  const [flashMessage, setFlashMessage] = useState("");

  const incomeSources = [
    { label: 'Sponsors', value: summary.monthlySponsorIncome, color: '#10b981' },
    { label: 'Merchandise', value: summary.driverMerch, color: '#3b82f6' },
    { label: 'Prize Money', value: latestReport?.prizeMoney || 0, color: '#f59e0b' },
  ];
  const expenses = [
    { label: 'Operations', value: summary.operatingCosts, color: '#ef4444' },
    { label: 'Drivers', value: summary.driverSalaries, color: '#f97316' },
    { label: 'Staff', value: summary.staffSalaries, color: '#a855f7' },
    { label: 'Facilities', value: summary.facilityMaintenance, color: '#06b6d4' },
  ];
  const maxIncome = Math.max(1, ...incomeSources.map((item) => item.value));
  const maxExpense = Math.max(1, ...expenses.map((item) => item.value));

  const handleAllocationChange = async (key: string, value: number) => {
    setBudgetAllocation(state, key, value);
    await syncGame();
    setFlashMessage("Budget allocation updated. Future performance and board reviews will reflect the new priorities.");
  };

  const handleEmergencyAction = async (actionId: string, label: string) => {
    applyEmergencyFinanceAction(state, actionId);
    await syncGame();
    setFlashMessage(`${label} executed. The short-term cash gain now carries a long-term consequence.`);
  };

  return (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'24px'}}>
        <div>
          {sectionLabel('Finance & Operations')}
          {pageTitle('Team Finance Command')}
          {pageSubtitle('Build the team’s financial future through sponsor contracts, operating budgets, facilities, staff, and board confidence.')}
        </div>
        <div style={{display:'flex', gap:'16px', flexWrap:'wrap', justifyContent:'flex-end'}}>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash Reserve')}{statValue(money(state.team.budget || 0), (state.team.budget || 0) >= 25 ? '#fff' : '#f59e0b')}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash Flow')}{statValue(money(latestReport?.netProfit || 0), (latestReport?.netProfit || 0) >= 0 ? '#10b981' : '#ef4444')}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Board')}{statValue(`${finance.boardSatisfaction}%`, finance.boardSatisfaction >= 65 ? '#10b981' : '#f59e0b')}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Forecast')}{statValue(money(summary.projectedEndBalance), summary.projectedEndBalance >= 0 ? '#10b981' : '#ef4444')}</div>
        </div>
      </div>

      {flashMessage && (
        <div style={{padding:'14px 16px', background:'rgba(225,6,0,0.1)', border:`1px solid ${HUB.accent}`, borderRadius:'8px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 7'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 18px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><BarChart3 size={18}/> Monthly Cash Flow</h3>
          <div style={{display:'flex', alignItems:'end', gap:'10px', height:'180px', padding:'12px', border:`1px solid ${HUB.border}`, borderRadius:'8px', background:'rgba(0,0,0,0.16)'}}>
            {(finance.cashFlow.length ? finance.cashFlow : [{ label: 'Start', income: summary.monthlySponsorIncome + summary.driverMerch, expenses: summary.operatingCosts, net: summary.monthlySponsorIncome + summary.driverMerch - summary.operatingCosts }]).map((flow) => {
              const height = Math.min(100, Math.max(8, Math.abs(flow.net) * 8));
              return (
                <div key={flow.label} style={{flex:1, minWidth:'36px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:'8px'}}>
                  <div title={`${flow.label}: ${money(flow.net)}`} style={{width:'100%', maxWidth:'38px', height:`${height}%`, borderRadius:'6px 6px 2px 2px', background: flow.net >= 0 ? 'linear-gradient(180deg,#34d399,#10b981)' : 'linear-gradient(180deg,#fb7185,#ef4444)'}} />
                  <span style={{fontSize:'10px', color:HUB.textMuted, fontFamily:HUB.fontMono}}>{flow.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 18px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><CircleDollarSign size={18}/> Income Sources</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'14px', marginBottom:'24px'}}>
            {incomeSources.map((source) => (
              <div key={source.label}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px'}}>
                  <span style={{color:HUB.textMuted}}>{source.label}</span>
                  <span style={{color:'#fff', fontFamily:HUB.fontMono}}>{money(source.value)}</span>
                </div>
                <MiniBar value={source.value} max={maxIncome} color={source.color} />
              </div>
            ))}
          </div>
          <h3 style={{fontSize:'14px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 14px', textTransform:'uppercase'}}>Expense Breakdown</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {expenses.map((expense) => (
              <div key={expense.label}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px'}}>
                  <span style={{color:HUB.textMuted}}>{expense.label}</span>
                  <span style={{color:'#fff', fontFamily:HUB.fontMono}}>{money(expense.value)}</span>
                </div>
                <MiniBar value={expense.value} max={maxExpense} color={expense.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><Landmark size={18}/> Budget Allocation</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {Object.entries(finance.budgetAllocation).map(([key, value]) => (
              <label key={key} style={{display:'grid', gridTemplateColumns:'130px 1fr 44px', alignItems:'center', gap:'12px'}}>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>{BUDGET_ALLOCATION_LABELS[key] || key}</span>
                <input type="range" min="0" max="45" value={Number(value)} onChange={(event) => handleAllocationChange(key, Number(event.target.value))} />
                <span style={{fontSize:'12px', color:'#fff', fontFamily:HUB.fontMono, textAlign:'right'}}>{value}%</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 4'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><BriefcaseBusiness size={18}/> Senior Staff</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {finance.staff.slice(0, 5).map((staff) => (
              <div key={staff.id} style={{display:'flex', justifyContent:'space-between', gap:'12px', padding:'10px 12px', background:'rgba(255,255,255,0.025)', borderRadius:'8px'}}>
                <div>
                  <span style={{fontSize:'12px', color:'#fff', fontFamily:HUB.fontBold}}>{staff.role}</span>
                  <span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>{staff.specialty}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:'12px', color:'#10b981', fontFamily:HUB.fontMono}}>{staff.rating}</span>
                  <span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>{money(staff.salary)}/yr</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 3'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><Building2 size={18}/> Board Review</h3>
          {latestBoard ? (
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <span style={pill(true)}>{latestBoard.boardAction}</span>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Revenue</span><span style={{color:'#fff', fontFamily:HUB.fontMono}}>{money(latestBoard.revenue)}</span></div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Expenses</span><span style={{color:'#fff', fontFamily:HUB.fontMono}}>{money(latestBoard.expenses)}</span></div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Satisfaction</span><span style={{color:'#fff', fontFamily:HUB.fontMono}}>{latestBoard.boardSatisfaction}%</span></div>
            </div>
          ) : (
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:0, lineHeight:1.5}}>The first monthly board review arrives after two completed race rounds.</p>
          )}
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 6'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><Users size={18}/> Driver Market Value</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {roster.map((driver) => {
              const commercial = getDriverCommercialValue(driver);
              return (
                <div key={driver.name} style={{display:'grid', gridTemplateColumns:'36px 1fr 82px 82px', gap:'12px', alignItems:'center', padding:'12px', background:'rgba(255,255,255,0.025)', borderRadius:'8px'}}>
                  <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover'}} />
                  <div>
                    <span style={{fontSize:'13px', color:'#fff', fontFamily:HUB.fontBold}}>{driver.name}</span>
                    <span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>Popularity {commercial.popularity}% · Sponsor appeal {commercial.sponsorAppeal}</span>
                  </div>
                  <div style={{textAlign:'right'}}><span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>Merch</span><span style={{fontSize:'12px', color:'#10b981', fontFamily:HUB.fontMono}}>{money(commercial.merchandiseRevenue)}</span></div>
                  <div style={{textAlign:'right'}}><span style={{fontSize:'10px', color:HUB.textMuted, display:'block'}}>Media</span><span style={{fontSize:'12px', color:'#fff', fontFamily:HUB.fontMono}}>{commercial.mediaRating}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 6'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><Building2 size={18}/> Facility Spending</h3>
          <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
            {FACILITY_CATALOG.slice(0, 8).map((facility) => {
              const current = finance.facilities[facility.id];
              return (
                <div key={facility.id} style={{padding:'12px', background:'rgba(255,255,255,0.025)', borderRadius:'8px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:'12px', marginBottom:'8px'}}>
                    <span style={{fontSize:'12px', color:'#fff'}}>{facility.name}</span>
                    <span style={{fontSize:'11px', color:HUB.textMuted, fontFamily:HUB.fontMono}}>Lv {current.level}/{facility.maxLevel}</span>
                  </div>
                  <MiniBar value={current.level} max={facility.maxLevel} color={current.upgrading ? '#f59e0b' : '#10b981'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><Banknote size={18}/> Season Financial Report</h3>
          {latestReport ? (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              {[
                ['Race Income', latestReport.raceIncome],
                ['Sponsor Income', latestReport.sponsorIncome],
                ['Prize Money', latestReport.prizeMoney],
                ['Merch Sales', latestReport.merchandiseSales],
                ['Operating Costs', -latestReport.operatingCosts],
                ['Staff Salaries', -latestReport.staffSalaries],
                ['Facility Costs', -latestReport.facilityCosts],
                ['Net Profit', latestReport.netProfit],
              ].map(([label, value]) => (
                <div key={label as string} style={statCell()}>
                  {statLabel(label as string)}
                  {statValue(money(value as number), (value as number) >= 0 ? '#10b981' : '#ef4444')}
                </div>
              ))}
            </div>
          ) : (
            <p style={{fontSize:'13px', color:HUB.textMuted, lineHeight:1.5, margin:0}}>Complete a race to generate the first full financial report.</p>
          )}
        </div>

        <div style={{...glassCard(), gridColumn:'span 4'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><TrendingUp size={18}/> AI Advisor</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {advisorNotes.map((note) => (
              <div key={note} style={{display:'flex', gap:'10px', alignItems:'flex-start'}}>
                <span style={{width:'6px', height:'6px', borderRadius:'999px', background:HUB.accent, marginTop:'7px', flexShrink:0}} />
                <p style={{fontSize:'13px', color:'#ddd', margin:0, lineHeight:1.45}}>{note}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 3'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:'#fff', margin:'0 0 16px', textTransform:'uppercase', display:'flex', alignItems:'center', gap:'8px'}}><AlertTriangle size={18}/> Emergency Finance</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {[
              ['loan', 'Take Bank Loan', TrendingDown],
              ['minority_sale', 'Sell Minority Ownership', Landmark],
              ['emergency_sponsor', 'Emergency Sponsor Deal', CircleDollarSign],
              ['staff_cuts', 'Reduce Staff', Users],
            ].map(([id, label, Icon]) => (
              <button key={id as string} onClick={() => handleEmergencyAction(id as string, label as string)} style={{...actionBtn({padding:'10px 12px', display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-start', backgroundColor:'rgba(255,255,255,0.05)', boxShadow:'none', border:`1px solid ${HUB.border}`})}}>
                <Icon size={14} />
                {label as string}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderFinance(root: HTMLElement) {
  ensureTeamState(state.team);
  mountLayout(root, 'finance', <FinanceDashboard root={root} />, () => renderFinance(root));
}
