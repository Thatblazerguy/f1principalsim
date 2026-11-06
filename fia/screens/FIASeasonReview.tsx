import React, { useState } from 'react';
import { Trophy, TrendingUp, DollarSign, CalendarDays, Award, Flag, ArrowRight, RotateCcw, CheckCircle, Download, FileText, ChevronRight } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import { fiaCareer, saveFIACareer, setFIACareer, generateRandomEvent } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';
import { calendar } from '../../data/calendar.js';
import { aiTeams } from '../../data/teams.js';

function FIASeasonReviewScreen({ appRoot }) {
  const career = fiaCareer!;
  const [notification, setNotification] = useState('');
  const [currentYear, setCurrentYear] = useState(career.currentYear);
  const [history, setHistory] = useState(career.seasonHistory || []);

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const calendarRaces = career.approvedCalendars?.length > 0
    ? career.approvedCalendars[career.approvedCalendars.length - 1].circuits
    : (career.calendarDrafts?.[0]?.circuits || calendar);

  // Financial summary
  const totalRevenue = calendarRaces.reduce((acc: number, r: any) => {
    const fee = career.hostingContracts?.[r.circuitId || r.circuit]?.hostingFee || 35;
    return acc + fee;
  }, 0);

  const handleAdvanceYear = () => {
    const nextYear = currentYear + 1;
    const seasonRecord = {
      year: currentYear,
      racesCount: calendarRaces.length,
      revenue: totalRevenue,
      finalApproval: career.approvalRating,
      completedAt: Date.now(),
    };

    const newHistory = [seasonRecord, ...history];
    const newDecisions = [
      generateRandomEvent(career),
      generateRandomEvent(career)
    ];

    const updated = {
      ...career,
      currentYear: nextYear,
      approvalRating: Math.min(100, career.approvalRating + 5),
      finances: {
        ...career.finances,
        budget: career.finances.budget + totalRevenue * 0.4,
        annualRevenue: totalRevenue,
      },
      seasonHistory: newHistory,
      pendingDecisions: [...(career.pendingDecisions || []), ...newDecisions],
      notifications: [
        { id: `adv-${Date.now()}`, message: `Season ${currentYear} concluded. Welcoming Season ${nextYear}!`, time: Date.now() },
        ...(career.notifications || [])
      ]
    };

    setFIACareer(updated);
    saveFIACareer();
    setCurrentYear(nextYear);
    setHistory(newHistory);
    showNotif(`Successfully advanced to Season ${nextYear}! Budget increased by $${Math.round(totalRevenue * 0.4)}M.`);
  };

  const handleExportReport = () => {
    const report = {
      title: `FIA Championship Report - Season ${currentYear}`,
      careerName: career.careerName,
      year: currentYear,
      approvalRating: career.approvalRating,
      budget: career.finances.budget,
      calendar: calendarRaces,
      regulations: career.regulations,
      seasonHistory: history,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FIA_Championship_Report_${currentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotif('Exported season report.');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 1000, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green }}>
          {notification}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <button
            onClick={() => renderFIADashboard(appRoot)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, letterSpacing: '0.1em', marginBottom: 8 }}
          >
            ← BACK TO FIA DASHBOARD
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
              Season {currentYear} Governance & Review
            </h1>
            <span style={{ background: 'rgba(225,6,0,0.15)', border: '1px solid rgba(225,6,0,0.4)', color: FIA.accent, padding: '4px 10px', borderRadius: 6, fontFamily: HUB.fontBold, fontSize: 11 }}>
              FIA RATIFIED
            </span>
          </div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, margin: '6px 0 0' }}>
            Review approved championship specifications, financials, and transition to the next governance cycle.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleExportReport}
            style={{
              ...actionBtn({ padding: '10px 18px', fontSize: 11 }),
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Download size={14} /> EXPORT REPORT
          </button>
          <button
            onClick={handleAdvanceYear}
            style={{
              ...actionBtn({ padding: '10px 20px', fontSize: 11 }),
              background: 'linear-gradient(135deg, #E10600, #FF3B30)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ADVANCE TO {currentYear + 1} <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ ...glassCard({ padding: '20px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: FIA.accent, marginBottom: 6 }}>
            <CalendarDays size={16} />
            <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase' }}>Rounds Approved</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: '#fff' }}>{calendarRaces.length} Grands Prix</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 4 }}>Full World Championship</div>
        </div>

        <div style={{ ...glassCard({ padding: '20px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: FIA.gold, marginBottom: 6 }}>
            <DollarSign size={16} />
            <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase' }}>Promoter Revenue</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: FIA.gold }}>${totalRevenue}M</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 4 }}>Estimated hosting contracts</div>
        </div>

        <div style={{ ...glassCard({ padding: '20px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: FIA.green, marginBottom: 6 }}>
            <TrendingUp size={16} />
            <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase' }}>Approval Rating</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: FIA.green }}>{career.approvalRating}%</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 4 }}>Paddock & public confidence</div>
        </div>

        <div style={{ ...glassCard({ padding: '20px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60A5FA', marginBottom: 6 }}>
            <Award size={16} />
            <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase' }}>Current FIA Treasury</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: '#60A5FA' }}>${career.finances.budget}M</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 4 }}>Operational liquidity</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Left Column: Calendar Overview */}
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Ratified Championship Calendar ({calendarRaces.length} Circuits)
            </span>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: FIA.green }}>
              <CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              VALIDATED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
            {calendarRaces.map((r: any, idx: number) => {
              const contract = career.hostingContracts?.[r.circuitId || r.circuit];
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: FIA.accent, width: 24 }}>
                      #{idx + 1}
                    </span>
                    <div>
                      <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff' }}>
                        {r.name || r.circuit}
                      </div>
                      <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>
                        {r.country || 'International'} · {r.laps || 55} Laps
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: FIA.gold }}>
                      ${contract?.hostingFee || 35}M
                    </span>
                    {r.sprint && (
                      <span style={{ marginLeft: 8, background: 'rgba(139,92,246,0.2)', color: '#A78BFA', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontFamily: HUB.fontBold }}>
                        SPRINT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Regulations & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Active Regulations snapshot */}
          <div style={{ ...glassCard({ padding: '24px' }) }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Enforced Regulatory Directives
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                <span style={{ color: HUB.textMuted }}>Cost Cap:</span>
                <span style={{ fontFamily: HUB.fontBold, color: '#fff' }}>${career.regulations.technical.costCap.value}M</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                <span style={{ color: HUB.textMuted }}>Minimum Car Weight:</span>
                <span style={{ fontFamily: HUB.fontBold, color: '#fff' }}>{career.regulations.technical.minCarWeight.value} kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                <span style={{ color: HUB.textMuted }}>Points Winner Allocation:</span>
                <span style={{ fontFamily: HUB.fontBold, color: '#fff' }}>{career.regulations.sporting.pointsSystem.value[0]} pts (P1)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                <span style={{ color: HUB.textMuted }}>Fastest Lap Bonus:</span>
                <span style={{ fontFamily: HUB.fontBold, color: FIA.green }}>{career.regulations.sporting.fastestLapPoint.value ? 'Awarded (1 pt)' : 'Disabled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: HUB.textMuted }}>Max Grid Allowance:</span>
                <span style={{ fontFamily: HUB.fontBold, color: '#fff' }}>{career.regulations.sporting.maxGridSize.value} Cars</span>
              </div>
            </div>
          </div>

          {/* Past Seasons History */}
          <div style={{ ...glassCard({ padding: '24px' }) }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Archived FIA Seasons History
            </span>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: HUB.textMuted, fontSize: 12 }}>
                No prior seasons archived yet. Advance Season {currentYear} to record your legacy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {history.map((h: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: 12 }}>
                    <div>
                      <span style={{ fontFamily: HUB.fontBold, color: '#fff' }}>Season {h.year}</span>
                      <span style={{ color: HUB.textMuted, marginLeft: 8 }}>({h.racesCount} GPs)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: FIA.gold }}>${h.revenue}M</span>
                      <span style={{ color: FIA.green }}>{h.finalApproval}% approval</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderFIASeasonReview(root: HTMLElement) {
  renderToAppRoot(root, <FIASeasonReviewScreen appRoot={root} />);
}
