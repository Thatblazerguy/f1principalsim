import React, { useState, useEffect } from 'react';
import {
  Shield, Globe, CalendarDays, Map, FileText, Users,
  TrendingUp, AlertTriangle, CheckCircle, Clock, Plus,
  Trophy, DollarSign, Zap, Activity, Flag, ChevronRight,
  Settings, LogOut
} from 'lucide-react';
import { renderToAppRoot } from '../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../components/HubLayout.tsx';
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
export const FIA = {
  ...HUB,
  accent: '#E10600',
  gold: '#F59E0B',
  blue: '#3B82F6',
  green: '#10B981',
  purple: '#8B5CF6',
  sidebar: '#06080F',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ApprovalMeter({ value }: { value: number }) {
  const color = value >= 70 ? FIA.green : value >= 50 ? FIA.gold : FIA.accent;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 14, color, minWidth: 36 }}>{value}%</span>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = '#fff' }: any) {
  return (
    <div style={{ ...glassCard({ padding: '20px' }), display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ color: FIA.accent }}>{icon}</div>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 26, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{sub}</span>}
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
        padding: '10px 14px', borderRadius: 8,
        color: isActive ? '#fff' : hovered ? '#fff' : HUB.textMuted,
        border: 'none',
        background: isActive ? 'rgba(225,6,0,0.12)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        cursor: 'pointer', fontSize: 13, fontFamily: HUB.fontBold,
        width: '100%', textAlign: 'left', transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: FIA.accent, borderRadius: '0 3px 3px 0' }} />
      )}
      <span style={{ color: isActive ? FIA.accent : hovered ? '#fff' : HUB.textMuted }}>{icon}</span>
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

  const navItems = [
    { id: 'dashboard', icon: <Shield size={17} />, label: 'FIA Dashboard' },
    null,
    { id: 'circuits', icon: <Map size={17} />, label: 'Circuit Library' },
    { id: 'designer', icon: <Zap size={17} />, label: 'Circuit Designer' },
    { id: 'licensing', icon: <CheckCircle size={17} />, label: 'Circuit Inspection' },
    null,
    { id: 'calendar', icon: <CalendarDays size={17} />, label: 'Calendar Board' },
    { id: 'contracts', icon: <DollarSign size={17} />, label: 'Hosting Contracts' },
    null,
    { id: 'regulations', icon: <FileText size={17} />, label: 'Regulations' },
    { id: 'entries', icon: <Users size={17} />, label: 'Team Entries' },
    { id: 'decisions', icon: <AlertTriangle size={17} />, label: 'FIA Decisions' },
    { id: 'review', icon: <Trophy size={17} />, label: 'Season Review' },
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: FIA.sidebar,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', padding: '28px 0', position: 'fixed',
        left: 0, top: 0, height: '100vh', zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              background: FIA.accent, borderRadius: 8, padding: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: HUB.fontWide, fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                FIA
              </div>
              <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Organization
              </div>
            </div>
          </div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, marginTop: 4 }}>
            {career.careerName}
          </div>
        </div>

        {/* Approval Rating */}
        <div style={{ padding: '0 24px', marginBottom: 24 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
            Approval Rating
          </div>
          <ApprovalMeter value={career.approvalRating} />
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px 16px' }} />

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto', scrollbarWidth: 'none' }}>
          {navItems.map((item, i) => {
            if (!item) return <div key={`d-${i}`} style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 4px' }} />;
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
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 4px 12px' }} />
          <NavItem
            icon={<LogOut size={17} />}
            label="Exit FIA Mode"
            active={false}
            onClick={() => renderLanding(appRoot)}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: 240, flex: 1, padding: '40px 48px', overflowY: 'auto', minHeight: '100vh' }}>
        {/* Background grid */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200 }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: FIA.accent, animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Season {career.currentYear} · FIA Operations
              </span>
            </div>
            <h1 style={{ fontFamily: HUB.fontWide, fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
              FIA Dashboard
            </h1>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, marginTop: 8 }}>
              Govern the championship. Shape the calendar. Set the rules.
            </p>
          </div>

          {/* Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <StatCard icon={<CalendarDays size={16} />} label="Calendar" value={scorecard.totalRaces} sub={scorecard.totalRaces > 0 ? 'Races approved' : 'No calendar set'} />
            <StatCard icon={<Map size={16} />} label="Licensed" value={licensedCount} sub={`of ${CIRCUIT_LIBRARY.length} circuits`} color={FIA.green} />
            <StatCard icon={<DollarSign size={16} />} label="Budget" value={`$${career.finances.budget}M`} sub="FIA operating funds" color={FIA.gold} />
            <StatCard
              icon={<AlertTriangle size={16} />}
              label="Decisions"
              value={career.pendingDecisions.length}
              sub="Awaiting resolution"
              color={career.pendingDecisions.length > 0 ? FIA.accent : FIA.green}
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
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Championship Calendar</div>
                    <h3 style={{ fontFamily: HUB.fontWide, fontSize: 18, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Season {career.currentYear}</h3>
                  </div>
                  <button
                    onClick={() => navigate('calendar', renderFIACalendarBoard)}
                    style={{ ...actionBtn({ padding: '8px 16px', fontSize: 10 }) }}
                  >
                    Open Calendar →
                  </button>
                </div>

                {scorecard.totalRaces > 0 ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: 'Races', value: scorecard.totalRaces },
                        { label: 'Sprints', value: scorecard.sprintWeekends },
                        { label: 'Continents', value: scorecard.continentsRepresented },
                        { label: 'Est. Revenue', value: `$${scorecard.estimatedRevenue}M` },
                        { label: 'European Races', value: scorecard.europeanRaces },
                        { label: 'Regions', value: scorecard.regionsRepresented },
                      ].map((item, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontFamily: HUB.fontRegular, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                          <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: '#fff', marginTop: 2 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Validation Status */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                      background: calendarValidation.isValid ? 'rgba(16,185,129,0.08)' : 'rgba(225,6,0,0.08)',
                      border: `1px solid ${calendarValidation.isValid ? 'rgba(16,185,129,0.2)' : 'rgba(225,6,0,0.2)'}`,
                      borderRadius: 8,
                    }}>
                      {calendarValidation.isValid
                        ? <CheckCircle size={14} color={FIA.green} />
                        : <AlertTriangle size={14} color={FIA.accent} />
                      }
                      <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: calendarValidation.isValid ? FIA.green : FIA.accent }}>
                        {calendarValidation.isValid
                          ? 'Calendar passes all validation checks'
                          : `${calendarValidation.errors.length} error(s), ${calendarValidation.warnings.length} warning(s)`
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: HUB.textMuted }}>
                    <CalendarDays size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, margin: 0 }}>No calendar approved yet.</p>
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, margin: '4px 0 16px', opacity: 0.7 }}>Open the Calendar Board to build your season.</p>
                    <button onClick={() => navigate('calendar', renderFIACalendarBoard)} style={{ ...actionBtn({ padding: '10px 20px', fontSize: 11 }) }}>
                      Build Calendar
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>Quick Actions</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'License a Circuit', icon: <CheckCircle size={14} />, action: () => navigate('licensing', renderFIALicensing) },
                    { label: 'Design New Circuit', icon: <Map size={14} />, action: () => navigate('designer', renderFIACircuitDesigner) },
                    { label: 'Edit Regulations', icon: <FileText size={14} />, action: () => navigate('regulations', renderFIARegulations) },
                    { label: 'Resolve Decisions', icon: <AlertTriangle size={14} />, action: () => navigate('decisions', renderFIADecisions) },
                    { label: 'Team Entries', icon: <Users size={14} />, action: () => navigate('entries', renderFIAEntries) },
                    { label: 'Hosting Contracts', icon: <DollarSign size={14} />, action: () => navigate('contracts', renderFIAContracts) },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 16px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold,
                        fontSize: 12, transition: 'all 0.15s', width: '100%',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(225,6,0,0.08)'; e.currentTarget.style.borderColor = 'rgba(225,6,0,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <span style={{ color: FIA.accent }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approve Season button */}
              {calendarValidation.isValid && (
                <div style={{
                  ...glassCard({ padding: '24px' }),
                  background: 'linear-gradient(135deg, rgba(225,6,0,0.1), rgba(225,6,0,0.05))',
                  border: '1px solid rgba(225,6,0,0.3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                        Season Ready
                      </div>
                      <h3 style={{ fontFamily: HUB.fontWide, fontSize: 18, color: '#fff', margin: '0 0 6px' }}>
                        Approve Season {career.currentYear}
                      </h3>
                      <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>
                        Calendar validated · Regulations set · Ready to race
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('review', renderFIASeasonReview)}
                      style={{
                        ...actionBtn({ padding: '14px 28px', fontSize: 12 }),
                        background: 'linear-gradient(135deg, #E10600, #FF4040)',
                      }}
                    >
                      APPROVE SEASON →
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
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                    Pending Decisions
                  </div>
                  <button
                    onClick={handleAddEvent}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 10 }}
                  >
                    <Plus size={12} /> New
                  </button>
                </div>

                {career.pendingDecisions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: HUB.textMuted }}>
                    <CheckCircle size={28} color="rgba(16,185,129,0.4)" style={{ marginBottom: 8 }} />
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, margin: 0 }}>No pending decisions.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {career.pendingDecisions.slice(0, 3).map(event => (
                      <div key={event.instanceId} style={{
                        background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.15)',
                        borderRadius: 10, padding: '14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <AlertTriangle size={12} color={FIA.accent} />
                          <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: FIA.accent }}>Decision Required</span>
                        </div>
                        <p style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff', margin: '0 0 6px' }}>{event.title}</p>
                        <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, margin: '0 0 12px', lineHeight: 1.5 }}>
                          {event.description}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {event.choices.map(choice => (
                            <button
                              key={choice.id}
                              onClick={() => handleResolveEvent(event.instanceId, choice.id)}
                              style={{
                                padding: '8px 12px', borderRadius: 6, textAlign: 'left',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                color: '#fff', cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 11,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(225,6,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(225,6,0,0.3)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            >
                              {choice.label}
                              <span style={{ float: 'right', fontFamily: HUB.fontBold, fontSize: 10, color: choice.approvalDelta >= 0 ? FIA.green : FIA.accent }}>
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
                        style={{ padding: '8px', color: HUB.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 11, textAlign: 'center' }}
                      >
                        + {career.pendingDecisions.length - 3} more decisions →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Season History */}
              <div style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Season History
                </div>
                {career.seasonHistory.length === 0 ? (
                  <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, textAlign: 'center', padding: '16px 0' }}>
                    No completed seasons yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {career.seasonHistory.slice(-5).reverse().map((season: any, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>Season {season.year}</div>
                          <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>{season.races} races · Champion: {season.champion || 'TBD'}</div>
                        </div>
                        <Trophy size={14} color={FIA.gold} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notifications */}
              {career.notifications.length > 0 && (
                <div style={{ ...glassCard({ padding: '20px' }) }}>
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Recent Notifications
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {career.notifications.slice(0, 4).map((n: any, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <Activity size={11} color={HUB.textMuted} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, lineHeight: 1.4 }}>{n.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
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
