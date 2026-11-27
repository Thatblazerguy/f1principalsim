import React, { useState } from 'react';
import { Trophy, TrendingUp, DollarSign, CalendarDays, Award, Flag, RotateCcw, CheckCircle, Download, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle, pageSubtitle, pill, sectionLabel } from '../../components/HubLayout.tsx';
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
        { id: `adv-${Date.now()}`, message: `Season ${currentYear} concluded · season ${nextYear} begins`, time: Date.now() },
        ...(career.notifications || [])
      ]
    };

    setFIACareer(updated);
    saveFIACareer();
    setCurrentYear(nextYear);
    setHistory(newHistory);
    showNotif(`Advanced to season ${nextYear} · budget +$${Math.round(totalRevenue * 0.4)}M vs last season`);
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
    showNotif('Season report exported');
  };

  return (
    <div style={{ minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 1000, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>
          {notification}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <button
            onClick={() => renderFIADashboard(appRoot)}
            className={btnClass('ghost')}
            style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {pageTitle(`Season ${currentYear} review`)}
            <span style={{ ...pill(), marginBottom: 8 }}>Ratified</span>
          </div>
          {pageSubtitle('Review the approved calendar, finances and regulations, then advance to the next season.')}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleExportReport}
            className={btnClass('secondary')}
            style={btn('secondary', 'md')}
          >
            <Download size={16} strokeWidth={1.5} />Export report
          </button>
          <button
            onClick={handleAdvanceYear}
            className={btnClass('primary')}
            style={btn('primary', 'md')}
          >
            Advance to {currentYear + 1}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: HUB.textFaint, marginBottom: 8 }}>
            <CalendarDays size={16} strokeWidth={1.5} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Rounds approved</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: HUB.textPrimary }}>{calendarRaces.length} Grands Prix</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 4 }}>Full world championship</div>
        </div>

        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: HUB.textFaint, marginBottom: 8 }}>
            <DollarSign size={16} strokeWidth={1.5} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Promoter revenue</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: HUB.textPrimary }}>${totalRevenue}M</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 4 }}>Estimated hosting contracts</div>
        </div>

        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: HUB.textFaint, marginBottom: 8 }}>
            <TrendingUp size={16} strokeWidth={1.5} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Approval rating</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: HUB.textPrimary }}>{career.approvalRating}%</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 4 }}>Paddock & public confidence</div>
        </div>

        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: HUB.textFaint, marginBottom: 8 }}>
            <Award size={16} strokeWidth={1.5} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>FIA budget</span>
          </div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: HUB.textPrimary }}>${career.finances.budget}M</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 4 }}>Operating funds</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
        {/* Left Column: Calendar Overview */}
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>
              Championship calendar ({calendarRaces.length} circuits)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
              <CheckCircle size={14} strokeWidth={1.5} color={HUB.positive} />
              Validated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {calendarRaces.map((r: any, idx: number) => {
              const contract = career.hostingContracts?.[r.circuitId || r.circuit];
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: HUB.raised,
                    border: `1px solid ${HUB.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textFaint, width: 24 }}>
                      {idx + 1}
                    </span>
                    <div>
                      <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>
                        {r.name || r.circuit}
                      </div>
                      <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
                        {r.country || 'International'} · {r.laps || 55} laps
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>
                      ${contract?.hostingFee || 35}M
                    </span>
                    {r.sprint && (
                      <span style={{ ...pill(), marginLeft: 8, padding: '2px 6px', fontSize: 11 }}>
                        Sprint
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
            <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, display: 'block', marginBottom: 12 }}>
              Regulations in force
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${HUB.border}`, paddingBottom: 8 }}>
                <span style={{ color: HUB.textMuted }}>Cost cap</span>
                <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>${career.regulations.technical.costCap.value}M</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${HUB.border}`, paddingBottom: 8 }}>
                <span style={{ color: HUB.textMuted }}>Minimum car weight</span>
                <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{career.regulations.technical.minCarWeight.value} kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${HUB.border}`, paddingBottom: 8 }}>
                <span style={{ color: HUB.textMuted }}>Points for a win</span>
                <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{career.regulations.sporting.pointsSystem.value[0]} pts (P1)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${HUB.border}`, paddingBottom: 8 }}>
                <span style={{ color: HUB.textMuted }}>Fastest lap bonus</span>
                <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{career.regulations.sporting.fastestLapPoint.value ? 'Awarded (1 pt)' : 'Disabled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: HUB.textMuted }}>Max grid size</span>
                <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{career.regulations.sporting.maxGridSize.value} cars</span>
              </div>
            </div>
          </div>

          {/* Past Seasons History */}
          <div style={{ ...glassCard({ padding: '24px' }) }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, display: 'block', marginBottom: 12 }}>
              Past seasons
            </span>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: HUB.textMuted, fontSize: 13 }}>
                No past seasons yet. Advance season {currentYear} to record it.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {history.map((h: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: HUB.raised, borderRadius: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Season {h.year}</span>
                      <span style={{ color: HUB.textMuted, marginLeft: 8 }}>({h.racesCount} GPs)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: HUB.textPrimary }}>${h.revenue}M</span>
                      <span style={{ color: HUB.textMuted }}>{h.finalApproval}% approval</span>
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
