import React, { useState, useEffect } from 'react';
import {
  Shield, Globe, CalendarDays, Map, FileText, Users,
  TrendingUp, AlertTriangle, CheckCircle, Clock, Plus,
  Trophy, DollarSign, Zap, Activity, Flag, ChevronRight,
  Settings, LogOut
} from 'lucide-react';
import { renderToAppRoot } from '../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, statCell, sectionLabel, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';
import {
  fiaCareer, saveFIACareer, setFIACareer, loadFIACareer, createDefaultFIACareer, generateRandomEvent,
  validateCalendar, calculateCalendarScorecard, LICENSE_STATUS
} from './fiaState.js';
import { CIRCUIT_LIBRARY } from './circuitLibrary.js';
import { renderFIACircuitLibrary } from './screens/FIACircuitLibrary.tsx';
import { renderFIACircuitDesigner } from './screens/FIACircuitDesigner.tsx';
import { renderFIACalendarBoard } from './screens/FIACalendarBoard.tsx';
import { renderFIARegulations } from './screens/FIARegulations.tsx';
import { renderFIADecisions } from './screens/FIADecisions.tsx';
import { renderFIAEntries } from './screens/FIAEntries.tsx';
import { renderFIASeasonReview } from './screens/FIASeasonReview.tsx';
import { renderFIALicensing } from './screens/FIALicensing.tsx';
import { renderFIAContracts } from './screens/FIAContracts.tsx';
import { renderLanding } from '../screens/landing.tsx';

// ── FIA Design tokens (extends HUB) ──────────────────────────────────────────
// FIA mode shares the team-side graphite ramp and red accent. The extra keys are
// kept for the FIA screens: green/gold map to semantic positive/warning, blue/purple
// are neutral (no decorative hues).
export const FIA = {
  ...HUB,
  accent: HUB.accent,
  gold: HUB.warning,
  blue: HUB.textMuted,
  green: HUB.positive,
  purple: HUB.textMuted,
  sidebar: HUB.sidebar,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ApprovalMeter({ value }: { value: number }) {
  const color = value >= 70 ? HUB.positive : value >= 50 ? HUB.warning : HUB.negative;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 6, background: HUB.raised, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: `width 400ms ${HUB.ease}` }} />
      </div>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, minWidth: 36 }}>{value}%</span>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = HUB.textPrimary }: any) {
  return (
    <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ color: HUB.textFaint, display: 'flex' }}>{icon}</div>
        <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{label}</span>
      </div>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 26, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>{sub}</span>}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  const [hovered, setHovered] = useState(false);
  const isActive = active;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 8,
        color: isActive || hovered ? HUB.textPrimary : HUB.textMuted,
        border: 'none',
        background: isActive ? HUB.accentSoft : hovered ? HUB.raised : 'transparent',
        cursor: 'pointer', fontSize: 13, fontFamily: isActive ? HUB.fontBold : HUB.fontRegular,
        width: '100%', textAlign: 'left', transition: `background-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`,
        position: 'relative'
      }}
    >
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: HUB.accent, borderRadius: '0 3px 3px 0' }} />
      )}
      <span style={{ display: 'flex', color: isActive ? HUB.accentInk : hovered ? HUB.textPrimary : HUB.textMuted }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Main FIA Dashboard Screen ─────────────────────────────────────────────────
function FIADashboard({ appRoot, activeScreen = 'dashboard', career: initialCareer }) {
  const [career, setCareer] = useState(initialCareer);
  const [activeTab, setActiveTab] = useState(activeScreen);

  const navigate = (screen: string, renderFn: (root: HTMLElement) => void) => {
    setActiveTab(screen);
    renderFn(appRoot);
  };

  const handleResolveEvent = (eventId: string, choiceId: string) => {
    const event = career.pendingDecisions.find(e => e.instanceId === eventId);
    if (!event) return;
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return;

    const updated = {
      ...career,
      approvalRating: Math.max(0, Math.min(100, career.approvalRating + (choice.approvalDelta || 0))),
      finances: {
        ...career.finances,
        budget: career.finances.budget + (choice.budgetDelta || 0),
      },
      pendingDecisions: career.pendingDecisions.filter(e => e.instanceId !== eventId),
      resolvedDecisions: [...career.resolvedDecisions, { ...event, resolvedChoice: choiceId, resolvedAt: Date.now() }],
    };
    setFIACareer(updated);
    setCareer(updated);
    saveFIACareer();
  };

  const handleAddEvent = () => {
    const event = generateRandomEvent(career);
    const updated = { ...career, pendingDecisions: [...career.pendingDecisions, event] };
    setFIACareer(updated);
    setCareer(updated);
    saveFIACareer();
  };

  // Scorecard from current approved calendar
  const currentCalendar = career.approvedCalendars[career.approvedCalendars.length - 1]?.circuits || [];
  const scorecard = calculateCalendarScorecard(currentCalendar, career);
  const calendarValidation = currentCalendar.length > 0
    ? validateCalendar(currentCalendar, career)
    : { errors: [], warnings: [], isValid: false };

  const licensedCount = Object.values(career.circuitLicenses).filter(
    (l: any) => l.status === LICENSE_STATUS.LICENSED
  ).length;

  const navIcon = { size: 16, strokeWidth: 1.5 };
  const navItems = [
    { id: 'dashboard', icon: <Shield {...navIcon} />, label: 'FIA dashboard' },
    null,
    { id: 'circuits', icon: <Map {...navIcon} />, label: 'Circuit library' },
    { id: 'designer', icon: <Zap {...navIcon} />, label: 'Circuit designer' },
    { id: 'licensing', icon: <CheckCircle {...navIcon} />, label: 'Circuit inspection' },
    null,
    { id: 'calendar', icon: <CalendarDays {...navIcon} />, label: 'Calendar board' },
    { id: 'contracts', icon: <DollarSign {...navIcon} />, label: 'Hosting contracts' },
    null,
    { id: 'regulations', icon: <FileText {...navIcon} />, label: 'Regulations' },
    { id: 'entries', icon: <Users {...navIcon} />, label: 'Team entries' },
    { id: 'decisions', icon: <AlertTriangle {...navIcon} />, label: 'FIA decisions' },
    { id: 'review', icon: <Trophy {...navIcon} />, label: 'Season review' },
  ];

  const navHandlers: Record<string, () => void> = {
    dashboard: () => setActiveTab('dashboard'),
    circuits: () => navigate('circuits', renderFIACircuitLibrary),
    designer: () => navigate('designer', renderFIACircuitDesigner),
    licensing: () => navigate('licensing', renderFIALicensing),
    calendar: () => navigate('calendar', renderFIACalendarBoard),
    contracts: () => navigate('contracts', renderFIAContracts),
    regulations: () => navigate('regulations', renderFIARegulations),
    entries: () => navigate('entries', renderFIAEntries),
    decisions: () => navigate('decisions', renderFIADecisions),
    review: () => navigate('review', renderFIASeasonReview),
  };

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100*var(--vh))', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: FIA.sidebar,
        borderRight: `1px solid ${HUB.border}`,
        display: 'flex', flexDirection: 'column', padding: '28px 0', position: 'fixed',
        left: 0, top: 0, height: 'calc(100*var(--vh))', zIndex: 50
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, padding: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={16} strokeWidth={1.5} color={HUB.textPrimary} />
            </div>
            <div>
              <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary }}>
                FIA
              </div>
              <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>
                Governing body
              </div>
            </div>
          </div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginTop: 4 }}>
            {career.careerName}
          </div>
        </div>

        {/* Approval Rating */}
        <div style={{ padding: '0 24px', marginBottom: 24 }}>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginBottom: 8 }}>
            Approval rating
          </div>
          <ApprovalMeter value={career.approvalRating} />
        </div>

        <div style={{ height: 1, background: HUB.border, margin: '0 16px 16px' }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto', scrollbarWidth: 'none' }}>
          {navItems.map((item, i) => {
            if (!item) return <div key={`d-${i}`} style={{ height: 1, background: HUB.border, margin: '6px 4px' }} />;
            return (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={navHandlers[item.id]}
              />
            );
          })}
        </nav>

        {/* Bottom: Exit FIA */}
        <div style={{ padding: '16px 12px 0' }}>
          <div style={{ height: 1, background: HUB.border, margin: '0 4px 12px' }} />
          <NavItem
            icon={<LogOut size={16} strokeWidth={1.5} />}
            label="Exit FIA mode"
            active={false}
            onClick={() => renderLanding(appRoot)}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: 240, flex: 1, padding: '40px 48px', overflowY: 'auto', minHeight: 'calc(100*var(--vh))' }}>
        <div style={{ position: 'relative', maxWidth: 1200 }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            {sectionLabel(`Season ${career.currentYear}`)}
            {pageTitle('FIA dashboard')}
            {pageSubtitle('Govern the championship, shape the calendar and set the rules.')}
          </div>

          {/* Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <StatCard icon={<CalendarDays size={16} strokeWidth={1.5} />} label="Calendar" value={scorecard.totalRaces} sub={scorecard.totalRaces > 0 ? 'Races approved' : 'No calendar set'} />
            <StatCard icon={<Map size={16} strokeWidth={1.5} />} label="Licensed" value={licensedCount} sub={`of ${CIRCUIT_LIBRARY.length} circuits`} />
            <StatCard icon={<DollarSign size={16} strokeWidth={1.5} />} label="Budget" value={`$${career.finances.budget}M`} sub="FIA operating funds" />
            <StatCard
              icon={<AlertTriangle size={16} strokeWidth={1.5} />}
              label="Decisions"
              value={career.pendingDecisions.length}
              sub="Awaiting resolution"
              color={career.pendingDecisions.length > 0 ? HUB.warning : HUB.textPrimary}
            />
          </div>

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Calendar Status */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    {sectionLabel('Championship calendar')}
                    <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: 0 }}>Season {career.currentYear}</h3>
                  </div>
                  <button
                    onClick={() => navigate('calendar', renderFIACalendarBoard)}
                    className={btnClass('secondary')}
                    style={btn('secondary', 'sm')}
                  >
                    Open calendar
                  </button>
                </div>

                {scorecard.totalRaces > 0 ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: 'Races', value: scorecard.totalRaces },
                        { label: 'Sprints', value: scorecard.sprintWeekends },
                        { label: 'Continents', value: scorecard.continentsRepresented },
                        { label: 'Est. revenue', value: `$${scorecard.estimatedRevenue}M` },
                        { label: 'European races', value: scorecard.europeanRaces },
                        { label: 'Regions', value: scorecard.regionsRepresented },
                      ].map((item, i) => (
                        <div key={i} style={statCell()}>
                          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>{item.label}</div>
                          <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, marginTop: 4 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Validation Status */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      background: HUB.raised,
                      border: `1px solid ${HUB.border}`,
                      borderRadius: 8
                    }}>
                      {calendarValidation.isValid
                        ? <CheckCircle size={16} strokeWidth={1.5} color={HUB.positive} />
                        : <AlertTriangle size={16} strokeWidth={1.5} color={HUB.negative} />
                      }
                      <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textPrimary }}>
                        {calendarValidation.isValid
                          ? 'Calendar passes all validation checks'
                          : `${calendarValidation.errors.length} error(s), ${calendarValidation.warnings.length} warning(s)`
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: HUB.textMuted }}>
                    <CalendarDays size={32} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 12 }} />
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 14, margin: 0 }}>No calendar approved yet</p>
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, margin: '4px 0 16px' }}>Open the calendar board to build your season.</p>
                    <button onClick={() => navigate('calendar', renderFIACalendarBoard)} className={btnClass('primary')} style={btn('primary', 'md')}>
                      Build calendar
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ marginBottom: 12 }}>{sectionLabel('Quick actions')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { label: 'License a circuit', icon: <CheckCircle size={16} strokeWidth={1.5} />, action: () => navigate('licensing', renderFIALicensing) },
                    { label: 'Design new circuit', icon: <Map size={16} strokeWidth={1.5} />, action: () => navigate('designer', renderFIACircuitDesigner) },
                    { label: 'Edit regulations', icon: <FileText size={16} strokeWidth={1.5} />, action: () => navigate('regulations', renderFIARegulations) },
                    { label: 'Resolve decisions', icon: <AlertTriangle size={16} strokeWidth={1.5} />, action: () => navigate('decisions', renderFIADecisions) },
                    { label: 'Team entries', icon: <Users size={16} strokeWidth={1.5} />, action: () => navigate('entries', renderFIAEntries) },
                    { label: 'Hosting contracts', icon: <DollarSign size={16} strokeWidth={1.5} />, action: () => navigate('contracts', renderFIAContracts) },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      className={btnClass('secondary')}
                      style={btn('secondary', 'md', { width: '100%', justifyContent: 'flex-start' })}
                    >
                      <span style={{ display: 'flex', color: HUB.textMuted }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approve Season button */}
              {calendarValidation.isValid && (
                <div style={{ ...glassCard({ padding: '24px' }) }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      {sectionLabel('Season ready')}
                      <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: '0 0 4px' }}>
                        Approve season {career.currentYear}
                      </h3>
                      <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, margin: 0 }}>
                        Calendar validated · Regulations set
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('review', renderFIASeasonReview)}
                      className={btnClass('primary')}
                      style={btn('primary', 'md')}
                    >
                      Approve season
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Pending Decisions */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>
                    Pending decisions
                  </div>
                  <button
                    onClick={handleAddEvent}
                    className={btnClass('ghost')}
                    style={btn('ghost', 'sm')}
                  >
                    <Plus size={14} strokeWidth={1.5} />New decision
                  </button>
                </div>

                {career.pendingDecisions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: HUB.textMuted }}>
                    <CheckCircle size={28} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 8 }} />
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, margin: 0 }}>No pending decisions</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {career.pendingDecisions.slice(0, 3).map(event => (
                      <div key={event.instanceId} style={{
                        background: HUB.raised, border: `1px solid ${HUB.border}`,
                        borderRadius: 8, padding: '16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <AlertTriangle size={12} strokeWidth={1.5} color={HUB.warning} />
                          <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Decision required</span>
                        </div>
                        <p style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, margin: '0 0 6px' }}>{event.title}</p>
                        <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: '0 0 12px', lineHeight: 1.5 }}>
                          {event.description}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {event.choices.map(choice => (
                            <button
                              key={choice.id}
                              onClick={() => handleResolveEvent(event.instanceId, choice.id)}
                              className={btnClass('secondary')}
                              style={btn('secondary', 'sm', { width: '100%', justifyContent: 'space-between' })}
                              title={choice.label}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{choice.label}</span>
                              <span style={{ flexShrink: 0, fontFamily: HUB.fontBold, fontSize: 11, color: choice.approvalDelta >= 0 ? HUB.positive : HUB.negative }}>
                                {choice.approvalDelta >= 0 ? '+' : ''}{choice.approvalDelta}% approval
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {career.pendingDecisions.length > 3 && (
                      <button
                        onClick={() => navigate('decisions', renderFIADecisions)}
                        className={btnClass('ghost')}
                        style={btn('ghost', 'sm', { width: '100%' })}
                      >
                        View {career.pendingDecisions.length - 3} more decisions
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Season History */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, marginBottom: 16 }}>
                  Season history
                </div>
                {career.seasonHistory.length === 0 ? (
                  <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                    No completed seasons yet
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {career.seasonHistory.slice(-5).reverse().map((season: any, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: HUB.raised, borderRadius: 8 }}>
                        <div>
                          <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>Season {season.year}</div>
                          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{season.races} races · Champion: {season.champion || 'TBD'}</div>
                        </div>
                        <Trophy size={16} strokeWidth={1.5} color={HUB.textFaint} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications */}
              {career.notifications.length > 0 && (
                <div style={{ ...glassCard({ padding: '24px' }) }}>
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, marginBottom: 12 }}>
                    Recent notifications
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {career.notifications.slice(0, 4).map((n: any, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < 3 ? `1px solid ${HUB.border}` : 'none' }}>
                        <Activity size={12} strokeWidth={1.5} color={HUB.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, lineHeight: 1.4 }}>{n.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Export render function ────────────────────────────────────────────────────
export function renderFIADashboard(root: HTMLElement, options: { activeScreen?: string; career?: any } = {}) {
  let career = options.career || fiaCareer || loadFIACareer();
  if (!career) {
    career = createDefaultFIACareer();
    setFIACareer(career);
    saveFIACareer();
  } else {
    setFIACareer(career);
  }
  renderToAppRoot(root, <FIADashboard appRoot={root} activeScreen={options.activeScreen || 'dashboard'} career={career} />);
}
