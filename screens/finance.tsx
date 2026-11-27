import React, { useState } from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import {
  BUDGET_ALLOCATION_LABELS,
  FACILITY_CATALOG,
  applyEmergencyFinanceAction,
  getEmergencyActionAvailability,
  ensureFinanceState,
  getDriverCommercialValue,
  getFinanceAdvisorNotes,
  getTeamCommercialSummary,
  setBudgetAllocation,
} from "../utils/financeSystem.js";
import { mountLayout, HUB, glassCard, statCell, btn, btnClass, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { AlertTriangle, Banknote, BarChart3, BriefcaseBusiness, Building2, CircleDollarSign, Landmark, TrendingDown, TrendingUp, Users } from 'lucide-react';

const money = (value: number) => `${value >= 0 ? '' : '-'}$${Math.abs(value || 0).toFixed(1)}M`;

function MiniBar({ value, max = 100, color = 'rgba(237,237,237,0.5)' }: { value: number, max?: number, color?: string }) {
  return (
    <div style={{ height: '6px', background: HUB.border, borderRadius: '999px', overflow: 'hidden' }}>
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
    { label: 'Sponsors', value: summary.monthlySponsorIncome },
    { label: 'Merchandise', value: summary.driverMerch },
    { label: 'Prize money', value: latestReport?.prizeMoney || 0 },
  ];
  const expenses = [
    { label: 'Operations', value: summary.operatingCosts },
    { label: 'Drivers', value: summary.driverSalaries },
    { label: 'Staff', value: summary.staffSalaries },
    { label: 'Facilities', value: summary.facilityMaintenance },
  ];
  // Neutral steps: the largest line is brightest, the rest step down. No hue.
  const NEUTRAL_STEPS = ['rgba(237,237,237,0.72)', 'rgba(237,237,237,0.52)', 'rgba(237,237,237,0.36)', 'rgba(237,237,237,0.24)'];
  const stepFor = (items: { value: number }[], value: number) => {
    const rank = [...items].sort((a, b) => b.value - a.value).findIndex((item) => item.value === value);
    return NEUTRAL_STEPS[Math.max(0, Math.min(NEUTRAL_STEPS.length - 1, rank))];
  };
  const maxIncome = Math.max(1, ...incomeSources.map((item) => item.value));
  const maxExpense = Math.max(1, ...expenses.map((item) => item.value));

  const handleAllocationChange = async (key: string, value: number) => {
    setBudgetAllocation(state, key, value);
    await syncGame();
    setFlashMessage("Budget allocation updated. Future performance and board reviews will reflect the new priorities");
  };

  const handleEmergencyAction = async (actionId: string, label: string) => {
    const result = applyEmergencyFinanceAction(state, actionId);
    if (!result.ok) {
      setFlashMessage(`${label} unavailable: ${result.reason}`);
      return;
    }
    await syncGame();
    setFlashMessage(`${label} done. The short-term cash gain carries a long-term cost`);
  };

  return (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'24px'}}>
        <div>
          {pageTitle('Finance')}
          {pageSubtitle('Build the team’s financial future through sponsor contracts, operating budgets, facilities, staff, and board confidence.')}
        </div>
        <div style={{display:'flex', gap:'16px', flexWrap:'wrap', justifyContent:'flex-end'}}>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Cash reserve')}{statValue(money(state.team.budget || 0), (state.team.budget || 0) >= 25 ? HUB.textPrimary : HUB.warning)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Last race net')}{statValue(money(latestReport?.netProfit || 0), (latestReport?.netProfit || 0) >= 0 ? HUB.positive : HUB.negative)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Board')}{statValue(`${finance.boardSatisfaction}%`, finance.boardSatisfaction >= 65 ? HUB.textPrimary : HUB.warning)}</div>
          <div style={statCell({minWidth:'120px'})}>{statLabel('Season-end forecast')}{statValue(money(summary.projectedEndBalance), summary.projectedEndBalance >= 0 ? HUB.textPrimary : HUB.negative)}</div>
        </div>
      </div>

      {flashMessage && (
        <div style={{padding:'12px 16px', background:HUB.raised, border:`1px solid ${HUB.border}`, borderRadius:'8px', color:HUB.textPrimary, fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 7'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><BarChart3 size={16} strokeWidth={1.5} color={HUB.textMuted}/> Monthly cash flow</h3>
          <div style={{display:'flex', alignItems:'end', gap:'10px', height:'180px', padding:'12px', border:`1px solid ${HUB.border}`, borderRadius:'8px', background:HUB.bg}}>
            {(finance.cashFlow.length ? finance.cashFlow : [{ label: 'Start', income: summary.monthlySponsorIncome + summary.driverMerch, expenses: summary.operatingCosts, net: summary.monthlySponsorIncome + summary.driverMerch - summary.operatingCosts }]).map((flow) => {
              const height = Math.min(100, Math.max(8, Math.abs(flow.net) * 8));
              return (
                <div key={flow.label} style={{flex:1, minWidth:'36px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:'8px'}}>
                  <div title={`${flow.label}: ${money(flow.net)}`} style={{width:'100%', maxWidth:'38px', height:`${height}%`, borderRadius:'6px 6px 2px 2px', background: flow.net >= 0 ? HUB.positive : HUB.negative}} />
                  <span style={{fontSize: '11px', color:HUB.textMuted, fontFamily:HUB.fontMono}}>{flow.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><CircleDollarSign size={16} strokeWidth={1.5} color={HUB.textMuted}/> Income sources</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px'}}>
            {incomeSources.map((source) => (
              <div key={source.label}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px'}}>
                  <span style={{color:HUB.textMuted}}>{source.label}</span>
                  <span style={{color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{money(source.value)}</span>
                </div>
                <MiniBar value={source.value} max={maxIncome} color={stepFor(incomeSources, source.value)} />
              </div>
            ))}
          </div>
          <h3 style={{fontSize:'14px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 12px' }}>Expense breakdown</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {expenses.map((expense) => (
              <div key={expense.label}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px'}}>
                  <span style={{color:HUB.textMuted}}>{expense.label}</span>
                  <span style={{color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{money(expense.value)}</span>
                </div>
                <MiniBar value={expense.value} max={maxExpense} color={stepFor(expenses, expense.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><Landmark size={16} strokeWidth={1.5} color={HUB.textMuted}/> Budget allocation</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {Object.entries(finance.budgetAllocation).map(([key, value]) => (
              <label key={key} style={{display:'grid', gridTemplateColumns:'130px 1fr 44px', alignItems:'center', gap:'12px'}}>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>{BUDGET_ALLOCATION_LABELS[key] || key}</span>
                <input type="range" min="0" max="45" value={Number(value)} onChange={(event) => handleAllocationChange(key, Number(event.target.value))} />
                <span style={{fontSize:'12px', color:HUB.textPrimary, fontFamily:HUB.fontMono, textAlign:'right'}}>{value}%</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 4'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><BriefcaseBusiness size={16} strokeWidth={1.5} color={HUB.textMuted}/> Senior staff</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {finance.staff.slice(0, 5).map((staff) => (
              <div key={staff.id} style={{display:'flex', justifyContent:'space-between', gap:'12px', padding:'10px 12px', background:HUB.raised, borderRadius:'8px'}}>
                <div>
                  <span style={{fontSize:'12px', color:HUB.textPrimary, fontFamily:HUB.fontBold}}>{staff.role}</span>
                  <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>{staff.specialty}</span>
                </div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:'12px', color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{staff.rating}</span>
                  <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>{money(staff.salary)}/yr</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 3'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><Building2 size={16} strokeWidth={1.5} color={HUB.textMuted}/> Board review</h3>
          {latestBoard ? (
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <span style={{...pill(), alignSelf:'flex-start'}}>{latestBoard.boardAction}</span>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Revenue</span><span style={{color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{money(latestBoard.revenue)}</span></div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Expenses</span><span style={{color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{money(latestBoard.expenses)}</span></div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span style={{color:HUB.textMuted}}>Satisfaction</span><span style={{color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{latestBoard.boardSatisfaction}%</span></div>
            </div>
          ) : (
            <p style={{fontSize:'13px', color:HUB.textMuted, margin:0, lineHeight:1.5}}>The first monthly board review arrives after two completed race rounds.</p>
          )}
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px', marginBottom:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 6'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><Users size={16} strokeWidth={1.5} color={HUB.textMuted}/> Driver market value</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {roster.map((driver) => {
              const commercial = getDriverCommercialValue(driver);
              return (
                <div key={driver.name} style={{display:'grid', gridTemplateColumns:'36px 1fr 82px 82px', gap:'12px', alignItems:'center', padding:'12px', background:HUB.raised, borderRadius:'8px'}}>
                  <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'36px', height:'36px', borderRadius:'50%', objectFit:'cover'}} />
                  <div>
                    <span style={{fontSize:'13px', color:HUB.textPrimary, fontFamily:HUB.fontBold}}>{driver.name}</span>
                    <span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Popularity {commercial.popularity}% · Sponsor appeal {commercial.sponsorAppeal}</span>
                  </div>
                  <div style={{textAlign:'right'}}><span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Merch</span><span style={{fontSize:'12px', color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{money(commercial.merchandiseRevenue)}</span></div>
                  <div style={{textAlign:'right'}}><span style={{fontSize: '11px', color:HUB.textMuted, display:'block'}}>Media</span><span style={{fontSize:'12px', color:HUB.textPrimary, fontFamily:HUB.fontMono}}>{commercial.mediaRating}</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 6'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><Building2 size={16} strokeWidth={1.5} color={HUB.textMuted}/> Facilities</h3>
          <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
            {FACILITY_CATALOG.slice(0, 8).map((facility) => {
              const current = finance.facilities[facility.id];
              return (
                <div key={facility.id} style={{padding:'12px', background:HUB.raised, borderRadius:'8px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:'12px', marginBottom:'8px'}}>
                    <span style={{fontSize:'12px', color:HUB.textPrimary}}>{facility.name}</span>
                    <span style={{fontSize:'11px', color:HUB.textMuted, fontFamily:HUB.fontMono}}>{current.upgrading ? 'Upgrading · ' : ''}Lv {current.level}/{facility.maxLevel}</span>
                  </div>
                  <MiniBar value={current.level} max={facility.maxLevel} color={current.upgrading ? HUB.textFaint : 'rgba(237,237,237,0.5)'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="responsive-grid" style={{display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:'24px'}}>
        <div style={{...glassCard(), gridColumn:'span 5'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><Banknote size={16} strokeWidth={1.5} color={HUB.textMuted}/> Latest race report</h3>
          {latestReport ? (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              {[
                ['Race income', latestReport.raceIncome],
                ['Sponsor income', latestReport.sponsorIncome],
                ['Prize money', latestReport.prizeMoney],
                ['Merch sales', latestReport.merchandiseSales],
                ['Operating costs', -latestReport.operatingCosts],
                ['Staff salaries', -latestReport.staffSalaries],
                ['Facility costs', -latestReport.facilityCosts],
                ['Net profit', latestReport.netProfit],
              ].map(([label, value]) => (
                <div key={label as string} style={statCell()}>
                  {statLabel(label as string)}
                  {statValue(money(value as number), label === 'Net profit' ? ((value as number) >= 0 ? HUB.positive : HUB.negative) : HUB.textPrimary)}
                </div>
              ))}
            </div>
          ) : (
            <p style={{fontSize:'13px', color:HUB.textMuted, lineHeight:1.5, margin:0}}>Complete a race to generate the first full financial report.</p>
          )}
        </div>

        <div style={{...glassCard(), gridColumn:'span 4'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><TrendingUp size={16} strokeWidth={1.5} color={HUB.textMuted}/> Advisor notes</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
            {advisorNotes.map((note) => (
              <div key={note} style={{display:'flex', gap:'10px', alignItems:'flex-start'}}>
                <span style={{width:'6px', height:'6px', borderRadius:'999px', background:HUB.textFaint, marginTop:'7px', flexShrink:0}} />
                <p style={{fontSize:'13px', color:HUB.textPrimary, margin:0, lineHeight:1.45}}>{note}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{...glassCard(), gridColumn:'span 3'}}>
          <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, color:HUB.textPrimary, margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px'}}><AlertTriangle size={16} strokeWidth={1.5} color={HUB.textMuted}/> Emergency finance</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {[
              ['loan', 'Take bank loan', TrendingDown],
              ['minority_sale', 'Sell minority stake', Landmark],
              ['emergency_sponsor', 'Emergency sponsor deal', CircleDollarSign],
              ['staff_cuts', 'Reduce staff', Users],
            ].map(([id, label, Icon]) => {
              const availability = getEmergencyActionAvailability(state, id as string);
              return (
                <button key={id as string} onClick={() => handleEmergencyAction(id as string, label as string)} disabled={!availability.available} title={availability.reason || undefined} className={btnClass('secondary')} style={btn('secondary', 'md', { justifyContent:'flex-start', ...(availability.available ? {} : { opacity: 0.5, cursor: 'not-allowed' }) })}>
                  <Icon size={16} strokeWidth={1.5} color={HUB.textMuted} />
                  {label as string}
                  {!availability.available && <span style={{marginLeft:'auto', fontSize:'11px', color:HUB.textMuted}}>Unavailable</span>}
                </button>
              );
            })}
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
