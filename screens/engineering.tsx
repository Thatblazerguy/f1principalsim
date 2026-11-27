import React, { useState, useMemo } from 'react';
import { constructorEntries } from "../utils/championshipModel.js";
import { state } from "../state.js";
import { syncGame } from "../lib/supabaseApi.js";
import { GarageView } from "../components/engineering/GarageView.tsx";
import { ensureTeamState, getTeamRoster, getCompetitivenessForecast } from "../utils/teamState.js";
import { ensureFinanceState, FACILITY_CATALOG, STAFF_CATALOG } from "../utils/financeSystem.js";
import {
  COMPONENT_CATALOG, ensureEngineeringState, swapComponent, fitNewComponent,
  getEngineeringAdvisorNotes, getOverallCarRating, getPerformanceTrend
} from "../utils/engineeringSystem.js";
import { DEVELOPMENT_CATALOG, startProject, processProjectCompletions, getCircuitProfile, ensureDevProjectsState } from "../utils/devProjects.js";
import { mountLayout, HUB, glassCard, statCell, btn, btnClass, iconBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { calendar as ALL_CIRCUITS } from '../data/calendar.js';
import { TrackFitPanel } from '../components/ui/TrackFitPanel.tsx';
import {
  Activity, AlertTriangle, BarChart2, BookOpen, CheckCircle, ChevronRight,
  Clock, Cpu, DollarSign, FlaskConical, Gauge, LayoutDashboard, RefreshCw,
  Settings, Shield, ShieldAlert, Target, Timer, TrendingDown, TrendingUp,
  Wrench, Zap, Wind, Layers, MapPin, X, Rotate3d } from 'lucide-react';

// ─── Shared Helpers ───────────────────────────────────────────────────────────
const NEUTRAL = 'rgba(237,237,237,0.5)';
function getHealthColor(wear: number) {
  if (wear < 60) return HUB.textPrimary;
  if (wear < 80) return HUB.warning;
  return HUB.negative;
}
function outcomeColor(outcome: string) {
  if (outcome === 'success' || outcome === 'overperform') return HUB.positive;
  if (outcome === 'underperform') return HUB.warning;
  return HUB.negative;
}
function money(v: number) { return `$${v.toFixed(1)}M`; }
function statBar(value: number, max = 99, color = NEUTRAL) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: '4px', background: HUB.border, borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: `width 400ms ${HUB.ease}` }} />
    </div>
  );
}
function trendIcon(trend: string, delta: number) {
  if (trend === 'up') return <TrendingUp size={16} strokeWidth={1.5} color={HUB.positive} />;
  if (trend === 'down') return <TrendingDown size={16} strokeWidth={1.5} color={HUB.negative} />;
  return <Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />;
}
const riskColor: Record<string, string> = { Low: HUB.textMuted, Medium: HUB.warning, High: HUB.negative };

// ─── TAB 1: Overview ──────────────────────────────────────────────────────────
function OverviewTab({ s }: any) {
  ensureDevProjectsState(s);
  const eng = s.engineering;
  const finance = s.finance || {};
  const staff = finance.staff || [];

  const overallRating = getOverallCarRating(s);
  const { delta, trend } = getPerformanceTrend(s);
  const specs = eng?.carSpecs || {};

  const sortedTeams = constructorEntries(s);
  const constPos = sortedTeams.findIndex(t => t[0] === s.team?.name) + 1;

  const avgStaffRating = staff.length > 0
    ? Math.round(staff.reduce((acc: number, st: any) => acc + (st.rating || 75), 0) / staff.length)
    : 75;

  const activeProjects = (eng?.projects || []).filter((p: any) => p.status === 'active');
  const recentHistory = (eng?.upgradeHistory || []).slice(0, 4);

  const windLevel = finance.facilities?.windTunnel?.level || 1;
  const cfdLevel = finance.facilities?.cfdDepartment?.level || 1;
  const devAlloc = eng?.devAllocation || { currentCar: 70, nextCar: 30 };

  const reliabilityAvg = Math.round(
    Object.values(specs).filter((v: any) => typeof v === 'number' && v < 110).length > 0
      ? (((specs.reliability || 75) + (specs.tyreWear || 75)) / 2)
      : 75
  );

  const topStats = [
    { label: 'Overall car rating', value: overallRating.toFixed(1), unit: '/99', color: HUB.textPrimary, icon: <Gauge size={16} strokeWidth={1.5} color={HUB.textMuted} /> },
    { label: 'Constructor position', value: constPos > 0 ? `P${constPos}` : '-', color: HUB.textPrimary, icon: <Target size={16} strokeWidth={1.5} color={HUB.textMuted} /> },
    { label: 'Performance trend', value: delta >= 0 ? `+${delta}` : `${delta}`, color: trend === 'up' ? HUB.positive : trend === 'down' ? HUB.negative : HUB.textPrimary, icon: trendIcon(trend, delta) },
    { label: 'Reliability', value: `${reliabilityAvg}/99`, color: reliabilityAvg > 80 ? HUB.textPrimary : HUB.warning, icon: <Shield size={16} strokeWidth={1.5} color={HUB.textMuted} /> },
    { label: 'Staff rating', value: `${avgStaffRating}/99`, color: HUB.textPrimary, icon: <Settings size={16} strokeWidth={1.5} color={HUB.textMuted} /> },
    { label: 'Active projects', value: String(activeProjects.length), color: activeProjects.length > 0 ? HUB.textPrimary : HUB.textMuted, icon: <FlaskConical size={16} strokeWidth={1.5} color={HUB.textMuted} /> },
  ];

  const currentRound = s.season?.round || 1;
  const activeCalendar: any[] = s.season?.calendar || ALL_CIRCUITS;
  const upcomingRaces = activeCalendar.slice(currentRound - 1, currentRound + 2); // Next 3 races

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top stat bar */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {topStats.map((stat, i) => (
          <div key={i} style={{ ...glassCard({ padding: '16px' }), display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: HUB.raised, borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center' }}>
              {stat.icon}
            </div>
            <div>
              <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'block', marginBottom: '2px' }}>{stat.label}</span>
              <span style={{ fontSize: '22px', fontWeight: 400, color: stat.color, fontFamily: HUB.fontMono }}>
                {stat.value}<span style={{ fontSize: '11px', color: HUB.textMuted }}>{stat.unit}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Car Performance Radar */}
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} strokeWidth={1.5} color={HUB.textMuted} /> Performance metrics
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              const metricRows = [
                { key: 'cornering', label: 'Cornering' },
                { key: 'downforce', label: 'Downforce' },
                { key: 'topSpeed', label: 'Top speed' },
                { key: 'mechanicalGrip', label: 'Mechanical grip' },
                { key: 'tyreWear', label: 'Tyre management' },
                { key: 'balance', label: 'Balance and stability' },
                { key: 'acceleration', label: 'Acceleration' },
                { key: 'fuelEfficiency', label: 'Fuel efficiency' },
                { key: 'reliability', label: 'Reliability' },
              ];
              // One neutral series; the accent marks only the car's strongest area.
              const strongestKey = metricRows.reduce((best, m) => ((specs[m.key] || 75) > (specs[best] || 75) ? m.key : best), metricRows[0].key);
              return metricRows.map(({ key, label }) => {
              const val = specs[key] || 75;
              const barColor = key === strongestKey ? HUB.accent : NEUTRAL;
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: key === strongestKey ? HUB.textPrimary : HUB.textMuted }}>{label}</span>
                  {statBar(val, 99, barColor)}
                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'right' }}>{val.toFixed(0)}</span>
                </div>
              );
            });
            })()}
          </div>
        </div>

        {/* Sidebar: Tunnel usage + active projects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...glassCard({ padding: '20px' }) }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wind size={16} strokeWidth={1.5} color={HUB.textMuted} /> Wind tunnel and CFD
            </h3>
            {[
              { label: 'Current car (WT)', value: devAlloc.currentCar, color: NEUTRAL },
              { label: 'Next car (WT)', value: devAlloc.nextCar, color: NEUTRAL },
              { label: 'Wind tunnel level', value: windLevel * 20, color: NEUTRAL, suffix: `Lv${windLevel}` },
              { label: 'CFD level', value: cfdLevel * 20, color: NEUTRAL, suffix: `Lv${cfdLevel}` },
            ].map((row, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>{row.label}</span>
                  <span style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{row.suffix || `${row.value}%`}</span>
                </div>
                {statBar(row.value, 100, row.color)}
              </div>
            ))}
          </div>

          <div style={{ ...glassCard({ padding: '20px' }) }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} strokeWidth={1.5} color={HUB.textMuted} /> Active projects
            </h3>
            {activeProjects.length === 0 && <p style={{ fontSize: '12px', color: HUB.textMuted }}>No projects running. Start one in the Development tab</p>}
            {activeProjects.slice(0, 4).map((p: any, i: number) => (
              <div key={i} style={{ borderBottom: `1px solid ${HUB.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
                <p style={{ fontSize: '12px', color: HUB.textPrimary, margin: '0 0 4px', fontWeight: 400, fontFamily: HUB.fontBold }}>{p.label}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>Done: R{p.completionRound}</span>
                  <span style={{ fontSize: '11px', color: riskColor[p.risk] }}>{p.risk} risk</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade History */}
      {recentHistory.length > 0 && (
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} strokeWidth={1.5} color={HUB.textMuted} /> Recent upgrades
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentHistory.map((h: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px', gap: '16px', alignItems: 'center', padding: '10px 12px', background: HUB.raised, borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>R{h.round}</span>
                <span style={{ fontSize: '12px', color: HUB.textPrimary }}>{h.label}</span>
                <span style={{ fontSize: '11px', color: outcomeColor(h.outcome), textAlign: 'center' }}>
                  {h.outcome}
                </span>
                <span style={{ fontSize: '11px', color: HUB.textMuted, textAlign: 'right' }}>{h.expectedGain}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Races Forecast */}
      {upcomingRaces.length > 0 && (
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} strokeWidth={1.5} color={HUB.textMuted} /> Upcoming races forecast
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${upcomingRaces.length}, 1fr)`, gap: '16px' }}>
            {upcomingRaces.map((entry: any, i: number) => {
              // calendar entries are always full objects {name, circuit, country, ...}
              const raceObj = typeof entry === 'string'
                ? ALL_CIRCUITS.find((circ: any) => circ.name === entry)
                : entry;
              const profile = getCircuitProfile(raceObj?.circuit);
              const forecast = getCompetitivenessForecast(s, raceObj?.circuit);
              
              return (
                <div key={i} style={{ padding: '16px', background: HUB.raised, borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>Round {currentRound + i}</span>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>{raceObj?.country}</span>
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 4px', color: HUB.textPrimary }}>{raceObj?.name}</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <span style={pill()}>{profile.type}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${HUB.border}`, paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '2px' }}>Expected rank</div>
                    <div style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>
                      {forecast.rank === 1 ? 'Fastest car' : `P${forecast.rank} / ${forecast.finish}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 2: Development ───────────────────────────────────────────────────────
function DevelopmentTab({ s, onFlash }: any) {
  const [selectedCat, setSelectedCat] = useState<string>('aero');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const eng = s.engineering;
  const cat = DEVELOPMENT_CATALOG[selectedCat];
  const activeProjects = (eng?.projects || []).filter((p: any) => p.status === 'active');

  const isRunning = (catId: string, itemId: string) =>
    activeProjects.some((p: any) => p.categoryId === catId && p.itemId === itemId);

  const handleStart = async (itemId: string) => {
    const result = startProject(s, selectedCat, itemId);
    if (result.ok) {
      onFlash(`${result.project.label} started, completes in round ${result.project.completionRound}`);
      await syncGame();
    } else {
      onFlash(`${result.reason}`);
    }
    setConfirming(null);
  };

  return (
    <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
      {/* Category Sidebar */}
      <div className="mobile-tabs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(DEVELOPMENT_CATALOG).map(([id, c]: any) => (
          <button
            key={id}
            onClick={() => { setSelectedCat(id); setSelectedItem(null); setConfirming(null); }}
            style={{
              padding: '12px 16px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
              background: selectedCat === id ? HUB.accentSoft : HUB.surface,
              border: `1px solid ${selectedCat === id ? 'rgba(225,6,0,0.4)' : HUB.border}`,
              color: selectedCat === id ? HUB.textPrimary : HUB.textMuted, transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`,
              fontFamily: HUB.fontBold, fontSize: '13px'
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Item Grid */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>{cat.label}</h3>
          <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '4px 0 0' }}>Select an upgrade area to launch a development project</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {Object.entries(cat.items).map(([itemId, item]: any) => {
            const running = isRunning(selectedCat, itemId);
            const isSelected = selectedItem === itemId;
            const canAfford = (s.team?.budget || 0) >= item.baseCost;

            return (
              <div
                key={itemId}
                onClick={() => { setSelectedItem(isSelected ? null : itemId); setConfirming(null); }}
                style={{
                  ...glassCard({ padding: '20px' }),
                  cursor: 'pointer', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`,
                  borderColor: isSelected ? 'rgba(225,6,0,0.4)' : HUB.border,
                  background: isSelected ? HUB.accentSoft : HUB.surface
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>{item.label}</h4>
                    <p style={{ fontSize: '11px', color: HUB.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>{item.description}</p>
                  </div>
                  {running && <span style={{ ...pill(), fontSize: '11px', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>In progress</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Cost</span>
                    <span style={{ fontSize: '13px', fontWeight: 400, color: canAfford ? HUB.textPrimary : HUB.negative, fontFamily: HUB.fontMono }}>{money(item.baseCost)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Time</span>
                    <span style={{ fontSize: '13px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{item.baseRaces}R</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Risk</span>
                    <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold, color: riskColor[item.risk] }}>{item.risk}</span>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '12px' }}>
                  <span style={{ fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Expected:</span>{' '}
                  {Object.entries(item.statBonuses).map(([k, v]: any) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ')}
                </div>

                {isSelected && !running && (
                  <div>
                    {confirming === itemId ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleStart(itemId); }}
                          disabled={!canAfford}
                          className={btnClass('primary')}
                          style={btn('primary', 'sm', { flex: 1 })}>
                          Confirm and spend {money(item.baseCost)}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                          className={btnClass('secondary')}
                          style={btn('secondary', 'sm')}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirming(itemId); }}
                        disabled={!canAfford}
                        className={btnClass('primary')}
                        style={btn('primary', 'sm', { width: '100%' })}>
                        {canAfford ? `Launch project` : `Cannot afford`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 3: Projects ─────────────────────────────────────────────────────────
function ProjectsTab({ s, onFlash }: any) {
  const eng = s.engineering;
  const allProjects = eng?.projects || [];
  const active = allProjects.filter((p: any) => p.status === 'active');
  const completed = allProjects.filter((p: any) => p.status !== 'active');
  const devAlloc = eng?.devAllocation || { currentCar: 70, nextCar: 30 };
  const currentRound = s.season?.round || 1;

  const handleAllocChange = async (currentCarPct: number) => {
    if (!eng) return;
    const clamped = Math.max(0, Math.min(100, currentCarPct));
    eng.devAllocation = { currentCar: clamped, nextCar: 100 - clamped };
    onFlash(`Wind tunnel allocation updated: ${clamped}% current car, ${100 - clamped}% next year's car`);
    await syncGame();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Allocation slider */}
      <div style={{ ...glassCard({ padding: '24px' }) }}>
        <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={16} strokeWidth={1.5} color={HUB.textMuted} /> Wind tunnel and CFD allocation
        </h3>
        <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 16px' }}>
          Distribute development resources between current championship push and next year's car concept.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: HUB.textPrimary, minWidth: '100px' }}>Current car: <strong style={{ color: HUB.accentInk, fontWeight: 400, fontFamily: HUB.fontBold }}>{devAlloc.currentCar}%</strong></span>
          <input
            type="range" min={0} max={100} step={5}
            value={devAlloc.currentCar}
            onChange={(e) => handleAllocChange(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: HUB.accent }}
          />
          <span style={{ fontSize: '12px', color: HUB.textPrimary, minWidth: '100px', textAlign: 'right' }}>Next car: <strong style={{ color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{devAlloc.nextCar}%</strong></span>
        </div>
        <p style={{ fontSize: '11px', color: HUB.textMuted, margin: '12px 0 0' }}>
          Higher current car allocation finishes projects sooner. Lower allocation prepares the car for next season's regulation changes.
        </p>
      </div>

      {/* Active Projects */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Active projects</h3>
        {active.length === 0 && (
          <div style={{ ...glassCard({ padding: '32px' }), textAlign: 'center' }}>
            <FlaskConical size={24} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', color: HUB.textMuted }}>No active projects. Start one in the Development tab</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {active.map((p: any, i: number) => {
            const progress = Math.max(0, Math.min(100, ((currentRound - p.startRound) / (p.completionRound - p.startRound)) * 100));
            const racesLeft = Math.max(0, p.completionRound - currentRound);
            const cat = DEVELOPMENT_CATALOG[p.categoryId];
            return (
              <div key={i} style={{ ...glassCard({ padding: '20px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 2px' }}>{p.label}</h4>
                    <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{p.engineer}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: riskColor[p.risk] }}>{p.risk} risk</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>Progress</span>
                    <span style={{ fontSize: '11px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{racesLeft === 0 ? 'Completes this race' : `${racesLeft}R remaining`}</span>
                  </div>
                  {statBar(progress, 100, NEUTRAL)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div><span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Confidence</span><span style={{ fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{p.confidence}%</span></div>
                  <div><span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Cost</span><span style={{ fontSize: '13px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{money(p.cost)}</span></div>
                  <div><span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block' }}>Due</span><span style={{ fontSize: '13px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>R{p.completionRound}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed Projects */}
      {completed.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Completed projects</h3>
          <div style={{ ...glassCard({ padding: '0' }), overflow: 'hidden' }}>
            {completed.slice(0, 10).map((p: any, i: number) => {
              const outColor = outcomeColor(p.outcome);
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px', gap: '16px', alignItems: 'center', padding: '12px 20px', borderBottom: i < completed.length - 1 ? `1px solid ${HUB.border}` : 'none' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>R{p.completedRound || p.startRound}</span>
                  <span style={{ fontSize: '13px', color: HUB.textPrimary }}>{p.label}</span>
                  <span style={{ fontSize: '11px', color: outColor, fontWeight: 400, fontFamily: HUB.fontBold }}>{p.outcome}</span>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, textAlign: 'right' }}>{money(p.cost)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 4: Components (existing system) ──────────────────────────────────────
function ComponentsTab({ s, onFlash }: any) {
  const [selectedDriver, setSelectedDriver] = useState<string>(s.team?.drivers[0]?.name || "");
  const roster = [...(s.team?.drivers || []), ...(s.team?.reserveDriver ? [s.team.reserveDriver] : [])];

  const handleSwap = async (compKey: string) => {
    const pool = s.engineering.driverPools[selectedDriver][compKey];
    const activeIndex = pool.findIndex((c: any) => c.active);
    const nextIndex = (activeIndex + 1) % pool.length;
    if (swapComponent(s, selectedDriver, compKey, nextIndex)) {
      onFlash(`Swapped to ${compKey}-${nextIndex + 1} for ${selectedDriver}`);
      await syncGame();
    }
  };
  const handleFit = async (compKey: string) => {
    if (confirm(`Fit a new ${compKey}? Exceeding allocation incurs grid penalties.`)) {
      const res = fitNewComponent(s, selectedDriver, compKey);
      if (res?.ok) {
        onFlash(`Fitted new ${res.newId} for ${selectedDriver}${res.penalty > 0 ? `. Penalty: +${res.penalty} grid places` : ''}`);
        await syncGame();
      }
    }
  };
  const driverNotes = getEngineeringAdvisorNotes(s, selectedDriver);
  const pendingPenalty = s.engineering.pendingPenalties[selectedDriver] || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {roster.map((driver: any) => (
            <button key={driver.name} onClick={() => setSelectedDriver(driver.name)}
              style={{ padding: '8px 16px', background: selectedDriver === driver.name ? HUB.accentSoft : HUB.surface, border: `1px solid ${selectedDriver === driver.name ? 'rgba(225,6,0,0.4)' : HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontFamily: HUB.fontBold }}>
              <img src={getDriverHeadshotUrl(driver)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              {driver.name}
            </button>
          ))}
        </div>
        {pendingPenalty > 0 && (
          <div style={{ ...glassCard({ padding: '10px 16px' }), borderColor: 'rgba(229,72,77,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} strokeWidth={1.5} color={HUB.negative} />
            <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.negative }}>+{pendingPenalty} grid penalty</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'span 8 1fr', gap: '24px' }}>
        <div style={{ gridColumn: 'span 8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {Object.entries(COMPONENT_CATALOG).map(([key, catalog]: any) => {
            const pool = s.engineering.driverPools[selectedDriver]?.[key];
            if (!pool) return null;
            const active = pool.find((c: any) => c.active) || pool[0];
            const healthColor = getHealthColor(active.wear);
            return (
              <div key={key} style={{ ...glassCard({ padding: '16px' }), display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>{catalog.name}</span>
                    <h4 style={{ fontSize: '18px', color: HUB.textPrimary, margin: '2px 0 0', fontFamily: HUB.fontMono }}>{active.id}</h4>
                  </div>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>{pool.length}/{catalog.allocation}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Condition</span>
                    {statBar(Math.max(0, 100 - active.wear), 100, healthColor)}
                    <span style={{ fontSize: '12px', color: healthColor, fontFamily: HUB.fontMono, display: 'block', marginTop: '4px' }}>{Math.max(0, 100 - active.wear).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Performance</span>
                    <span style={{ fontSize: '14px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{active.performance.toFixed(1)}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {pool.length > 1 && (
                    <button onClick={() => handleSwap(key)} className={btnClass('secondary')} style={btn('secondary', 'sm', { flex: 1 })}>
                      <RefreshCw size={14} strokeWidth={1.5} /> Swap component
                    </button>
                  )}
                  <button onClick={() => handleFit(key)} className={btnClass(pool.length >= catalog.allocation ? 'danger' : 'secondary')} style={btn(pool.length >= catalog.allocation ? 'danger' : 'secondary', 'sm', { flex: 1 })}>
                    <Zap size={14} strokeWidth={1.5} /> Fit new
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...glassCard({ padding: '24px' }), marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} strokeWidth={1.5} color={HUB.textMuted} /> Chief engineer notes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {driverNotes.map((note: string, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: note.includes('CRITICAL') ? HUB.negative : note.includes('Warning') ? HUB.warning : HUB.textFaint, marginTop: '7px', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: HUB.textPrimary, margin: 0, lineHeight: 1.45 }}>{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 5: Performance Analysis ─────────────────────────────────────────────
function PerformanceTab({ s }: any) {
  const specs = s.engineering?.carSpecs || {};
  const allTeams = [s.team, ...(s.aiTeams || [])].filter(Boolean);
  const nextRound = s.season?.round || 1;
  const nextRace = (s.season?.calendar || ALL_CIRCUITS).find((r: any) => r.round === nextRound);
  const circuitProfile = nextRace ? getCircuitProfile(nextRace.circuit) : { strengths: [], weaknesses: [], type: 'Mixed' };

  allTeams.sort((a: any, b: any) => b.carPerformance - a.carPerformance);

  const performanceMetrics = [
    { key: 'topSpeed', label: 'Top speed' },
    { key: 'cornering', label: 'Cornering' },
    { key: 'downforce', label: 'Downforce' },
    { key: 'mechanicalGrip', label: 'Mechanical grip' },
    { key: 'acceleration', label: 'Acceleration' },
    { key: 'tyreWear', label: 'Tyre management' },
    { key: 'fuelEfficiency', label: 'Fuel efficiency' },
    { key: 'reliability', label: 'Reliability' },
  ];

  // Helper to get a team's spec value
  const getTeamSpec = (team: any, key: string) => {
    if (team.isPlayerTeam && specs[key]) {
      return specs[key];
    }
    // For AI teams: use their specs or carPerformance as fallback
    if (team.specs) {
      // Map from our detailed specs to team.specs if available
      if (key === 'cornering' || key === 'downforce') return team.specs.aero || team.carPerformance || 80;
      if (key === 'mechanicalGrip' || key === 'tyreWear' || key === 'balance') return team.specs.chassis || team.carPerformance || 80;
      if (key === 'reliability') return team.specs.reliability || team.carPerformance || 80;
    }
    // Default fallback
    return team.carPerformance || 80;
  };

  // Get development priorities based on circuit
  const getDevelopmentPriorities = () => {
    if (!nextRace) return [];
    const priorities: any[] = [];
    const type = circuitProfile.type;

    if (type === 'Power' || type === 'Highspeed') {
      priorities.push({ category: 'powerUnit', label: 'Power Unit', priority: 'High' });
      priorities.push({ category: 'aero', label: 'Drag Reduction', priority: 'Medium' });
      priorities.push({ category: 'chassis', label: 'Mechanical Grip', priority: 'Low' });
    } else if (type === 'Technical' || type === 'Street') {
      priorities.push({ category: 'chassis', label: 'Mechanical Grip', priority: 'High' });
      priorities.push({ category: 'aero', label: 'Downforce', priority: 'Medium' });
      priorities.push({ category: 'powerUnit', label: 'Power Unit', priority: 'Low' });
    } else {
      priorities.push({ category: 'aero', label: 'Balanced Aero', priority: 'Medium' });
      priorities.push({ category: 'chassis', label: 'Balance', priority: 'Medium' });
      priorities.push({ category: 'powerUnit', label: 'ERS Efficiency', priority: 'Medium' });
    }

    return priorities;
  };

  const devPriorities = getDevelopmentPriorities();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Circuit Analysis & Development Priorities */}
      {nextRace && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} strokeWidth={1.5} color={HUB.textMuted} /> Circuit analysis: {nextRace.name}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'block', marginBottom: '8px' }}>Circuit strengths</span>
                {circuitProfile.strengths.map((str: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <CheckCircle size={12} color={HUB.positive} />
                    <span style={{ fontSize: '12px', color: HUB.textPrimary }}>{str.replace('.', ': ').replace(/([A-Z])/g, ' $1')}</span>
                  </div>
                ))}
                {circuitProfile.strengths.length === 0 && <span style={{ fontSize: '12px', color: HUB.textMuted }}>Balanced circuit</span>}
              </div>
              <div>
                <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'block', marginBottom: '8px' }}>Circuit weaknesses</span>
                {circuitProfile.weaknesses.map((weak: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <AlertTriangle size={12} color={HUB.negative} />
                    <span style={{ fontSize: '12px', color: HUB.textPrimary }}>{weak.replace('.', ': ').replace(/([A-Z])/g, ' $1')}</span>
                  </div>
                ))}
                {circuitProfile.weaknesses.length === 0 && <span style={{ fontSize: '12px', color: HUB.textMuted }}>Balanced circuit</span>}
              </div>
            </div>
          </div>

          <div style={{ ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={16} strokeWidth={1.5} color={HUB.textMuted} /> Development priorities
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {devPriorities.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: HUB.raised, borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: HUB.textPrimary }}>{p.label}</span>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 400, fontFamily: HUB.fontBold, 
                    color: p.priority === 'High' ? HUB.textPrimary : p.priority === 'Medium' ? HUB.textMuted : HUB.textFaint }}>
                    {p.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Metric Comparisons */}
      {performanceMetrics.map((metric: any) => {
        // Sort teams by this specific metric
        const sortedByMetric = [...allTeams].sort((a: any, b: any) => getTeamSpec(b, metric.key) - getTeamSpec(a, metric.key));
        return (
          <div key={metric.key} style={{ ...glassCard({ padding: '24px' }) }}>
            <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {metric.label}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedByMetric.map((team: any, i: number) => {
                const isPlayer = team.name === s.team?.name;
                const val = getTeamSpec(team, metric.key);
                const playerVal = getTeamSpec(s.team, metric.key);
                const delta = isPlayer ? 0 : parseFloat((val - playerVal).toFixed(1));
                return (
                  <div key={team.name} style={{ display: 'grid', gridTemplateColumns: '30px 200px 1fr 60px 70px', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: i < sortedByMetric.length - 1 ? `1px solid ${HUB.border}` : 'none' }}>
                    <span style={{ fontSize: '13px', fontWeight: 400, color: isPlayer ? HUB.accentInk : HUB.textPrimary, fontFamily: HUB.fontMono }}>P{i + 1}</span>
                    <span style={{ fontSize: '12px', color: HUB.textPrimary, fontWeight: 400, fontFamily: isPlayer ? HUB.fontBold : HUB.fontRegular }}>{team.name}</span>
                    {statBar(val, 99, isPlayer ? HUB.accent : NEUTRAL)}
                    <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'right' }}>{val.toFixed(0)}</span>
                    <span style={{ fontSize: '11px', color: delta === 0 ? HUB.textMuted : delta > 0 ? HUB.negative : HUB.positive, textAlign: 'right' }}>
                      {delta === 0 ? 'You' : (delta > 0 ? `+${delta}` : `${delta}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Constructor Car Performance Rankings */}
      <div style={{ ...glassCard({ padding: '24px' }) }}>
        <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} strokeWidth={1.5} color={HUB.textMuted} /> Constructor car performance
        </h3>
        {allTeams.map((team: any, i: number) => {
          const isPlayer = team.name === s.team?.name;
          const perf = team.carPerformance || 80;
          const delta = isPlayer ? 0 : parseFloat((perf - (s.team?.carPerformance || 80)).toFixed(1));
          return (
            <div key={team.name} style={{ display: 'grid', gridTemplateColumns: '30px 200px 1fr 60px 70px', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: i < allTeams.length - 1 ? `1px solid ${HUB.border}` : 'none' }}>
              <span style={{ fontSize: '14px', fontWeight: 400, color: isPlayer ? HUB.accentInk : HUB.textPrimary, fontFamily: HUB.fontMono }}>P{i + 1}</span>
              <span style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: isPlayer ? HUB.fontBold : HUB.fontRegular }}>{team.name}</span>
              {statBar(perf, 99, isPlayer ? HUB.accent : NEUTRAL)}
              <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'right' }}>{perf.toFixed(1)}</span>
              <span style={{ fontSize: '11px', color: delta === 0 ? HUB.textMuted : delta > 0 ? HUB.negative : HUB.positive, textAlign: 'right' }}>
                {delta === 0 ? 'You' : (delta > 0 ? `+${delta}` : `${delta}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB 6: Facilities ───────────────────────────────────────────────────────
function FacilitiesTab({ s, onFlash }: any) {
  const finance = s.finance || {};
  const facilities = finance.facilities || {};

  const handleUpgrade = async (facilityId: string) => {
    const { getFacilityUpgradeCost } = await import('../utils/financeSystem.js');
    const cost = getFacilityUpgradeCost(facilityId, finance);
    const facility = facilities[facilityId];
    const catalog = FACILITY_CATALOG.find((f: any) => f.id === facilityId);
    if (!catalog || !facility) return;
    if (facility.level >= catalog.maxLevel) { onFlash('Already at maximum level'); return; }
    if ((s.team?.budget || 0) < cost) { onFlash(`Insufficient budget, requires $${cost.toFixed(1)}M`); return; }
    s.team.budget = parseFloat((s.team.budget - cost).toFixed(1));
    facility.upgrading = true;
    facility.readyDay = (s.season?.currentDay || 1) + catalog.buildDays;
    onFlash(`${catalog.name} upgrade started, ready in ${catalog.buildDays} days`);
    await syncGame();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
      {FACILITY_CATALOG.map((catalog: any) => {
        const facility = facilities[catalog.id] || { level: 1, upgrading: false };
        const isMax = facility.level >= catalog.maxLevel;
        const isBuilding = facility.upgrading;
        const { getFacilityUpgradeCost } = { getFacilityUpgradeCost: (id: string, f: any) => {
          const cat = FACILITY_CATALOG.find(c => c.id === id);
          if (!cat || !f?.facilities?.[id]) return 0;
          return parseFloat((cat.baseCost * Math.pow(1.42, Math.max(0, f.facilities[id].level - 1))).toFixed(1));
        }};
        const cost = getFacilityUpgradeCost(catalog.id, finance);
        const canAfford = (s.team?.budget || 0) >= cost;

        return (
          <div key={catalog.id} style={{ ...glassCard({ padding: '20px' }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 4px' }}>{catalog.name}</h4>
                <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{catalog.benefit}</p>
              </div>
              <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary, background: HUB.raised, padding: '4px 8px', borderRadius: '6px' }}>Lv{facility.level}</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: catalog.maxLevel }).map((_, lvl) => (
                  <div key={lvl} style={{ flex: 1, height: '6px', borderRadius: '2px', background: lvl < facility.level ? NEUTRAL : HUB.border }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: HUB.textMuted }}>Level {facility.level}/{catalog.maxLevel}</span>
              </div>
            </div>
            <button
              onClick={() => handleUpgrade(catalog.id)}
              disabled={isMax || isBuilding || !canAfford}
              className={btnClass('primary')}
              style={btn('primary', 'md', { width: '100%' })}
            >
              {isMax ? 'Max level' : isBuilding ? 'Upgrading' : !canAfford ? `Need $${cost.toFixed(1)}M` : `Upgrade for $${cost.toFixed(1)}M`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB 7: Engineering Reports ───────────────────────────────────────────────
function ReportsTab({ s }: any) {
  const reports = s.engineering?.raceReports || [];
  const upgradeHistory = s.engineering?.upgradeHistory || [];
  const [reportsSubTab, setReportsSubTab] = useState<'raceReports' | 'upgradeHistory'>('raceReports');

  const subTabs = [
    { id: 'raceReports', label: 'Race reports', icon: <BookOpen size={14} strokeWidth={1.5} /> },
    { id: 'upgradeHistory', label: 'Upgrade history', icon: <RefreshCw size={14} strokeWidth={1.5} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportsSubTab(tab.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 16px',
              background: reportsSubTab === tab.id ? HUB.accentSoft : HUB.surface,
              border: `1px solid ${reportsSubTab === tab.id ? 'rgba(225,6,0,0.4)' : HUB.border}`,
              borderRadius: '8px',
              color: reportsSubTab === tab.id ? HUB.textPrimary : HUB.textMuted,
              cursor: 'pointer',
              fontFamily: HUB.fontBold,
              fontSize: '12px',
              transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {reportsSubTab === 'raceReports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.length === 0 ? (
            <div style={{ ...glassCard({ padding: '60px' }), textAlign: 'center' }}>
              <BookOpen size={24} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', color: HUB.textMuted, margin: 0 }}>No reports yet</h3>
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '8px 0 0' }}>Engineering reports are generated after each race weekend</p>
            </div>
          ) : (
            reports.map((report: any, i: number) => (
              <div key={i} style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={16} strokeWidth={1.5} color={HUB.textMuted} /> Round {report.round} engineering report
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {report.notes.map((note: string, ni: number) => (
                    <div key={ni} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', background: HUB.raised, borderRadius: '8px' }}>
                      <ChevronRight size={14} color={HUB.textFaint} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <p style={{ fontSize: '13px', color: HUB.textPrimary, margin: 0, lineHeight: 1.45 }}>{note}</p>
                    </div>
                  ))}
                </div>
                {report.completedProjects?.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px' }}>
                    <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>
                      Upgrades introduced: {report.completedProjects.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {reportsSubTab === 'upgradeHistory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {upgradeHistory.length === 0 ? (
            <div style={{ ...glassCard({ padding: '60px' }), textAlign: 'center' }}>
              <RefreshCw size={24} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', color: HUB.textMuted, margin: 0 }}>No upgrades yet</h3>
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '8px 0 0' }}>Upgrade history will appear here as you complete development projects</p>
            </div>
          ) : (
            <div style={{ ...glassCard({ padding: '0' }), overflow: 'hidden' }}>
              {upgradeHistory.map((upgrade: any, i: number) => {
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 100px 100px', gap: '16px', alignItems: 'center', padding: '12px 20px', borderBottom: i < upgradeHistory.length - 1 ? `1px solid ${HUB.border}` : 'none' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>Round {upgrade.round}</span>
                    <span style={{ fontSize: '13px', color: HUB.textPrimary }}>{upgrade.label}</span>
                    <span style={{ fontSize: '11px', color: outcomeColor(upgrade.outcome), fontWeight: 400, fontFamily: HUB.fontBold }}>{upgrade.outcome}</span>
                    <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{upgrade.expectedGain}</span>
                    <span style={{ fontSize: '12px', color: HUB.textMuted, textAlign: 'right', fontFamily: HUB.fontMono }}>${upgrade.cost.toFixed(1)}M</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Engineering Screen ───────────────────────────────────────────────────
const TABS = [
  { id: 'garage', label: 'Garage', icon: <Rotate3d size={16} strokeWidth={1.5} /> },
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} strokeWidth={1.5} /> },
  { id: 'development', label: 'Development', icon: <FlaskConical size={16} strokeWidth={1.5} /> },
  { id: 'projects', label: 'Projects', icon: <Layers size={16} strokeWidth={1.5} /> },
  { id: 'components', label: 'Components', icon: <Cpu size={16} strokeWidth={1.5} /> },
  { id: 'performance', label: 'Performance', icon: <BarChart2 size={16} strokeWidth={1.5} /> },
  { id: 'trackfit', label: 'Track Fit AI', icon: <Target size={16} strokeWidth={1.5} /> },
  { id: 'facilities', label: 'Facilities', icon: <Wrench size={16} strokeWidth={1.5} /> },
  { id: 'reports', label: 'Reports', icon: <BookOpen size={16} strokeWidth={1.5} /> },
];

function EngineeringHQ({ root, initialTab }: { root: HTMLElement; initialTab?: string }) {
  ensureTeamState(state.team!);
  ensureEngineeringState(state);
  ensureFinanceState(state);

  const [activeTab, setActiveTab] = useState(initialTab || 'garage');
  const [flashMessage, setFlashMessage] = useState('');
  const s = state as any;

  const budget = s.team?.budget || 0;
  const overallRating = getOverallCarRating(s);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {pageTitle('Engineering')}
          {pageSubtitle('Development programmes, component management and performance analysis.')}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={statCell({ minWidth: '120px' })}>
            {statLabel('Car rating')}
            {statValue(overallRating.toFixed(1))}
          </div>
          <div style={statCell({ minWidth: '120px' })}>
            {statLabel('Budget')}
            {statValue(`$${budget.toFixed(1)}M`, budget > 20 ? HUB.textPrimary : HUB.warning)}
          </div>
        </div>
      </div>

      {/* Flash message */}
      {flashMessage && (
        <div style={{ padding: '12px 16px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, fontSize: '13px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {flashMessage}
          <button onClick={() => setFlashMessage('')} className={btnClass('ghost')} style={iconBtn('sm', { marginLeft: 'auto' })} aria-label="Dismiss message" title="Dismiss message"><X size={16} strokeWidth={1.5} /></button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="mobile-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${HUB.border}`, paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? HUB.accent : 'transparent'}`,
              color: activeTab === tab.id ? HUB.textPrimary : HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: '13px', transition: `border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`, marginBottom: '-1px'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'garage'       && <GarageView s={s} onFlash={setFlashMessage} />}
        {activeTab === 'overview'     && <OverviewTab s={s} />}
        {activeTab === 'development'  && <DevelopmentTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'projects'     && <ProjectsTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'components'   && <ComponentsTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'performance'  && <PerformanceTab s={s} />}
        {activeTab === 'trackfit'     && <TrackFitPanel s={s} />}
        {activeTab === 'facilities'   && <FacilitiesTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'reports'      && <ReportsTab s={s} />}
      </div>
    </div>
  );
}

export function renderEngineering(root: HTMLElement, initialTab?: string) {
  ensureTeamState(state.team!);
  mountLayout(root, 'engineering', <EngineeringHQ key={initialTab || 'garage'} root={root} initialTab={initialTab} />, () => renderEngineering(root, initialTab));
}
