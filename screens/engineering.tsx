import React, { useState, useMemo } from 'react';
import { state } from "../state.js";
import { syncGame } from "../lib/supabaseApi.js";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { ensureFinanceState, FACILITY_CATALOG, STAFF_CATALOG } from "../utils/financeSystem.js";
import {
  COMPONENT_CATALOG, ensureEngineeringState, swapComponent, fitNewComponent,
  getEngineeringAdvisorNotes, getOverallCarRating, getPerformanceTrend
} from "../utils/engineeringSystem.js";
import { DEVELOPMENT_CATALOG, startProject, processProjectCompletions, getCircuitProfile, ensureDevProjectsState } from "../utils/devProjects.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { calendar } from '../data/calendar.js';
import {
  Activity, AlertTriangle, BarChart2, BookOpen, CheckCircle, ChevronRight,
  Clock, Cpu, DollarSign, FlaskConical, Gauge, LayoutDashboard, RefreshCw,
  Settings, Shield, ShieldAlert, Target, Timer, TrendingDown, TrendingUp,
  Wrench, Zap, Wind, Layers
} from 'lucide-react';

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function getHealthColor(wear: number) {
  if (wear < 30) return '#10b981';
  if (wear < 60) return '#eab308';
  if (wear < 80) return '#f97316';
  return '#ef4444';
}
function money(v: number) { return `$${v.toFixed(1)}M`; }
function statBar(value: number, max = 99, color = HUB.accent) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
    </div>
  );
}
function trendIcon(trend: string, delta: number) {
  if (trend === 'up') return <TrendingUp size={14} color="#10b981" />;
  if (trend === 'down') return <TrendingDown size={14} color="#ef4444" />;
  return <Activity size={14} color="#f59e0b" />;
}
const riskColor: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };

// ─── TAB 1: Overview ──────────────────────────────────────────────────────────
function OverviewTab({ s }: any) {
  ensureDevProjectsState(s);
  const eng = s.engineering;
  const finance = s.finance || {};
  const staff = finance.staff || [];

  const overallRating = getOverallCarRating(s);
  const { delta, trend } = getPerformanceTrend(s);
  const specs = eng?.carSpecs || {};

  const sortedTeams = Object.entries(s.standings?.teams || {}).sort((a: any, b: any) => b[1] - a[1]);
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
    { label: 'Overall Car Rating', value: overallRating.toFixed(1), unit: '/99', color: '#fff', icon: <Gauge size={18} color={HUB.accent} /> },
    { label: 'Constructor Position', value: constPos > 0 ? `P${constPos}` : '-', color: '#fff', icon: <Target size={18} color="#3b82f6" /> },
    { label: 'Performance Trend', value: delta >= 0 ? `+${delta}` : `${delta}`, color: trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#f59e0b', icon: trendIcon(trend, delta) },
    { label: 'Reliability', value: `${reliabilityAvg}/99`, color: reliabilityAvg > 80 ? '#10b981' : '#f59e0b', icon: <Shield size={18} color="#10b981" /> },
    { label: 'Staff Rating', value: `${avgStaffRating}/99`, color: '#fff', icon: <Settings size={18} color="#8b5cf6" /> },
    { label: 'Active Projects', value: String(activeProjects.length), color: activeProjects.length > 0 ? '#3b82f6' : HUB.textMuted, icon: <FlaskConical size={18} color="#3b82f6" /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top stat bar */}
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {topStats.map((stat, i) => (
          <div key={i} style={{ ...glassCard({ padding: '20px' }), display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center' }}>
              {stat.icon}
            </div>
            <div>
              <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>{stat.label}</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: stat.color, fontFamily: HUB.fontMono }}>
                {stat.value}<span style={{ fontSize: '11px', color: HUB.textMuted }}>{stat.unit}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Car Performance Radar */}
        <div style={{ ...glassCard({ padding: '28px' }) }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} color={HUB.accent} /> Performance Metrics
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'cornering', label: 'Cornering' },
              { key: 'downforce', label: 'Downforce' },
              { key: 'topSpeed', label: 'Top Speed' },
              { key: 'mechanicalGrip', label: 'Mechanical Grip' },
              { key: 'tyreWear', label: 'Tyre Management' },
              { key: 'balance', label: 'Balance & Stability' },
              { key: 'acceleration', label: 'Acceleration' },
              { key: 'fuelEfficiency', label: 'Fuel Efficiency' },
              { key: 'reliability', label: 'Reliability' },
            ].map(({ key, label }) => {
              const val = specs[key] || 75;
              const barColor = val > 85 ? '#10b981' : val > 75 ? '#3b82f6' : val > 65 ? '#f59e0b' : '#ef4444';
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 36px', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>{label}</span>
                  {statBar(val, 99, barColor)}
                  <span style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: '#fff', textAlign: 'right' }}>{val.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: Tunnel usage + active projects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...glassCard({ padding: '20px' }) }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wind size={15} color="#3b82f6" /> Tunnel & CFD Allocation
            </h3>
            {[
              { label: 'Current Car (WT)', value: devAlloc.currentCar, color: HUB.accent },
              { label: 'Next Car (WT)', value: devAlloc.nextCar, color: '#3b82f6' },
              { label: 'Wind Tunnel Lv.', value: windLevel * 20, color: '#8b5cf6', suffix: `Lv${windLevel}` },
              { label: 'CFD Dept Lv.', value: cfdLevel * 20, color: '#8b5cf6', suffix: `Lv${cfdLevel}` },
            ].map((row, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>{row.label}</span>
                  <span style={{ fontSize: '11px', fontFamily: HUB.fontMono, color: '#fff' }}>{row.suffix || `${row.value}%`}</span>
                </div>
                {statBar(row.value, 100, row.color)}
              </div>
            ))}
          </div>

          <div style={{ ...glassCard({ padding: '20px' }) }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, color: '#fff', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="#f59e0b" /> Active Projects
            </h3>
            {activeProjects.length === 0 && <p style={{ fontSize: '12px', color: HUB.textMuted }}>No projects running. Start one in the Development tab.</p>}
            {activeProjects.slice(0, 4).map((p: any, i: number) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', marginBottom: '10px' }}>
                <p style={{ fontSize: '12px', color: '#fff', margin: '0 0 4px', fontWeight: 700 }}>{p.label}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: HUB.textMuted }}>Done: R{p.completionRound}</span>
                  <span style={{ fontSize: '10px', color: riskColor[p.risk] }}>{p.risk} Risk</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade History */}
      {recentHistory.length > 0 && (
        <div style={{ ...glassCard({ padding: '24px' }) }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} color={HUB.accent} /> Recent Upgrade History
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentHistory.map((h: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px', gap: '16px', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>R{h.round}</span>
                <span style={{ fontSize: '12px', color: '#fff' }}>{h.label}</span>
                <span style={{ fontSize: '11px', color: riskColor[h.outcome === 'success' ? 'Low' : h.outcome === 'overperform' ? 'Low' : h.outcome === 'underperform' ? 'Medium' : 'High'], textAlign: 'center' }}>
                  {h.outcome.toUpperCase()}
                </span>
                <span style={{ fontSize: '11px', color: HUB.textMuted, textAlign: 'right' }}>{h.expectedGain}</span>
              </div>
            ))}
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
      onFlash(`✅ ${result.project.label} started. Completion: Round ${result.project.completionRound}.`);
      await syncGame();
    } else {
      onFlash(`❌ ${result.reason}`);
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
              padding: '14px 16px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
              background: selectedCat === id ? `${c.color}18` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${selectedCat === id ? c.color : 'rgba(255,255,255,0.06)'}`,
              color: selectedCat === id ? '#fff' : HUB.textMuted, transition: 'all 0.15s',
              fontFamily: HUB.fontBold, fontSize: '13px',
            }}
          >
            <span style={{ display: 'block', color: selectedCat === id ? c.color : HUB.textMuted, fontSize: '10px', marginBottom: '2px', letterSpacing: '0.1em' }}>
              {id.toUpperCase()}
            </span>
            {c.label}
          </button>
        ))}
      </div>

      {/* Item Grid */}
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>{cat.label}</h3>
          <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '4px 0 0' }}>Select an upgrade area to launch a development project.</p>
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
                  cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: isSelected ? cat.color : running ? '#10b981' : 'rgba(255,255,255,0.06)',
                  background: isSelected ? `${cat.color}10` : running ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0 }}>{item.label}</h4>
                    <p style={{ fontSize: '11px', color: HUB.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>{item.description}</p>
                  </div>
                  {running && <span style={{ fontSize: '10px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>IN PROGRESS</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>COST</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: canAfford ? '#fff' : '#ef4444', fontFamily: HUB.fontMono }}>{money(item.baseCost)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>TIME</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: HUB.fontMono }}>{item.baseRaces}R</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>RISK</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: riskColor[item.risk] }}>{item.risk}</span>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#fff' }}>Expected:</span>{' '}
                  {Object.entries(item.statBonuses).map(([k, v]: any) => `${v > 0 ? '+' : ''}${v} ${k}`).join(', ')}
                </div>

                {isSelected && !running && (
                  <div>
                    {confirming === itemId ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleStart(itemId); }}
                          disabled={!canAfford}
                          style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px', flex: 1, backgroundColor: canAfford ? HUB.accent : 'rgba(255,255,255,0.05)' }), opacity: canAfford ? 1 : 0.5 }}>
                          Confirm & Spend {money(item.baseCost)}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                          style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.border}` }) }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirming(itemId); }}
                        disabled={!canAfford}
                        style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px', width: '100%', backgroundColor: canAfford ? `${cat.color}22` : 'rgba(255,255,255,0.03)', border: `1px solid ${canAfford ? cat.color : HUB.border}` }), color: canAfford ? cat.color : HUB.textMuted, opacity: canAfford ? 1 : 0.6 }}>
                        {canAfford ? `Launch Project` : `Cannot Afford`}
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
    onFlash(`Wind Tunnel allocation updated: ${clamped}% current car, ${100 - clamped}% next year's car.`);
    await syncGame();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Allocation slider */}
      <div style={{ ...glassCard({ padding: '24px' }) }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={16} color="#3b82f6" /> Wind Tunnel & CFD Resource Allocation
        </h3>
        <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 16px' }}>
          Distribute development resources between current championship push and next year's car concept.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#fff', minWidth: '100px' }}>Current Car: <strong style={{ color: HUB.accent }}>{devAlloc.currentCar}%</strong></span>
          <input
            type="range" min={0} max={100} step={5}
            value={devAlloc.currentCar}
            onChange={(e) => handleAllocChange(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: HUB.accent }}
          />
          <span style={{ fontSize: '12px', color: '#fff', minWidth: '100px', textAlign: 'right' }}>Next Car: <strong style={{ color: '#3b82f6' }}>{devAlloc.nextCar}%</strong></span>
        </div>
        <p style={{ fontSize: '11px', color: HUB.textMuted, margin: '12px 0 0' }}>
          ⚡ Higher current car allocation = faster project completion. Lower allocation = better prepared for next season's regulation changes.
        </p>
      </div>

      {/* Active Projects */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>Active Projects</h3>
        {active.length === 0 && (
          <div style={{ ...glassCard({ padding: '32px' }), textAlign: 'center' }}>
            <FlaskConical size={40} color={HUB.textMuted} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', color: HUB.textMuted }}>No active projects. Start one in the Development tab.</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {active.map((p: any, i: number) => {
            const progress = Math.max(0, Math.min(100, ((currentRound - p.startRound) / (p.completionRound - p.startRound)) * 100));
            const racesLeft = Math.max(0, p.completionRound - currentRound);
            const cat = DEVELOPMENT_CATALOG[p.categoryId];
            return (
              <div key={i} style={{ ...glassCard({ padding: '20px' }), borderLeft: `3px solid ${cat?.color || HUB.accent}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{p.label}</h4>
                    <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{p.engineer}</p>
                  </div>
                  <span style={{ fontSize: '10px', color: riskColor[p.risk], background: `${riskColor[p.risk]}15`, padding: '3px 8px', borderRadius: '999px' }}>{p.risk}</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>Progress</span>
                    <span style={{ fontSize: '11px', color: '#fff', fontFamily: HUB.fontMono }}>{racesLeft === 0 ? 'Complete this race!' : `${racesLeft}R remaining`}</span>
                  </div>
                  {statBar(progress, 100, cat?.color || HUB.accent)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div><span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>CONFIDENCE</span><span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{p.confidence}%</span></div>
                  <div><span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>COST</span><span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: HUB.fontMono }}>{money(p.cost)}</span></div>
                  <div><span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block' }}>DONE R</span><span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: HUB.fontMono }}>R{p.completionRound}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed Projects */}
      {completed.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>Completed Projects</h3>
          <div style={{ ...glassCard({ padding: '0' }), overflow: 'hidden' }}>
            {completed.slice(0, 10).map((p: any, i: number) => {
              const outColor = p.outcome === 'success' ? '#10b981' : p.outcome === 'overperform' ? '#3b82f6' : p.outcome === 'underperform' ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px 80px', gap: '16px', alignItems: 'center', padding: '14px 20px', borderBottom: i < completed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>R{p.completedRound || p.startRound}</span>
                  <span style={{ fontSize: '13px', color: '#fff' }}>{p.label}</span>
                  <span style={{ fontSize: '11px', color: outColor, textTransform: 'uppercase', fontWeight: 700 }}>{p.outcome}</span>
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
      onFlash(`Swapped to ${compKey}-${nextIndex + 1} for ${selectedDriver}.`);
      await syncGame();
    }
  };
  const handleFit = async (compKey: string) => {
    if (confirm(`Fit a new ${compKey}? Exceeding allocation incurs grid penalties.`)) {
      const res = fitNewComponent(s, selectedDriver, compKey);
      if (res?.ok) {
        onFlash(`Fitted new ${res.newId} for ${selectedDriver}. ${res.penalty > 0 ? `PENALTY: +${res.penalty} Grid Places applied.` : ''}`);
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
              style={{ padding: '12px 20px', background: selectedDriver === driver.name ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)', border: `1px solid ${selectedDriver === driver.name ? HUB.accent : HUB.border}`, borderRadius: '8px', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontFamily: HUB.fontBold }}>
              <img src={getDriverHeadshotUrl(driver)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              {driver.name}
            </button>
          ))}
        </div>
        {pendingPenalty > 0 && (
          <div style={{ ...glassCard({ padding: '10px 16px' }), borderColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>+{pendingPenalty} Grid Penalty</span>
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
                    <h4 style={{ fontSize: '18px', color: '#fff', margin: '2px 0 0', fontFamily: HUB.fontMono }}>{active.id}</h4>
                  </div>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>{pool.length}/{catalog.allocation}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Condition</span>
                    {statBar(Math.max(0, 100 - active.wear), 100, healthColor)}
                    <span style={{ fontSize: '12px', color: healthColor, fontFamily: HUB.fontMono, display: 'block', marginTop: '4px' }}>{Math.max(0, 100 - active.wear).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Performance</span>
                    <span style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontMono }}>{active.performance.toFixed(1)}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {pool.length > 1 && (
                    <button onClick={() => handleSwap(key)} style={{ ...actionBtn({ padding: '6px 10px', fontSize: '11px', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.border}` }) }}>
                      <RefreshCw size={12} style={{ marginRight: '4px' }} /> Swap
                    </button>
                  )}
                  <button onClick={() => handleFit(key)} style={{ ...actionBtn({ padding: '6px 10px', fontSize: '11px', flex: 1, backgroundColor: pool.length >= catalog.allocation ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }) }}>
                    <Zap size={12} style={{ marginRight: '4px' }} /> Fit New
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...glassCard({ padding: '24px' }), marginTop: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={16} /> Chief Engineer Notes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {driverNotes.map((note: string, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: note.includes('CRITICAL') ? '#ef4444' : note.includes('Warning') ? '#eab308' : HUB.accent, marginTop: '7px', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: '#ddd', margin: 0, lineHeight: 1.45 }}>{note}</p>
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
  const nextRace = calendar.find((r: any) => r.round === nextRound);
  const circuitProfile = nextRace ? getCircuitProfile(nextRace.circuit) : { strengths: [], weaknesses: [], type: 'Mixed' };

  allTeams.sort((a: any, b: any) => b.carPerformance - a.carPerformance);

  const performanceMetrics = [
    { key: 'topSpeed', label: 'Top Speed', color: '#f59e0b' },
    { key: 'cornering', label: 'Cornering', color: '#3b82f6' },
    { key: 'downforce', label: 'Downforce', color: '#8b5cf6' },
    { key: 'mechanicalGrip', label: 'Mechanical Grip', color: '#10b981' },
    { key: 'acceleration', label: 'Acceleration', color: '#ef4444' },
    { key: 'tyreWear', label: 'Tyre Management', color: '#f97316' },
    { key: 'fuelEfficiency', label: 'Fuel Efficiency', color: '#06b6d4' },
    { key: 'reliability', label: 'Reliability', color: '#22c55e' },
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
          <div style={{ ...glassCard({ padding: '24px' }), borderLeft: `3px solid ${HUB.accent}` }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} color={HUB.accent} /> Circuit Analysis: {nextRace.name}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>Circuit Strengths</span>
                {circuitProfile.strengths.map((str: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <CheckCircle size={12} color="#10b981" />
                    <span style={{ fontSize: '12px', color: '#fff' }}>{str.replace('.', ': ').replace(/([A-Z])/g, ' $1')}</span>
                  </div>
                ))}
                {circuitProfile.strengths.length === 0 && <span style={{ fontSize: '12px', color: HUB.textMuted }}>Balanced circuit</span>}
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>Circuit Weaknesses</span>
                {circuitProfile.weaknesses.map((weak: string, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <AlertTriangle size={12} color="#ef4444" />
                    <span style={{ fontSize: '12px', color: '#fff' }}>{weak.replace('.', ': ').replace(/([A-Z])/g, ' $1')}</span>
                  </div>
                ))}
                {circuitProfile.weaknesses.length === 0 && <span style={{ fontSize: '12px', color: HUB.textMuted }}>Balanced circuit</span>}
              </div>
            </div>
          </div>

          <div style={{ ...glassCard({ padding: '24px' }), borderLeft: `3px solid #f59e0b` }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={16} color="#f59e0b" /> Development Priorities
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {devPriorities.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#fff' }}>{p.label}</span>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    color: p.priority === 'High' ? '#ef4444' : p.priority === 'Medium' ? '#f59e0b' : '#10b981',
                    textTransform: 'uppercase'
                  }}>
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
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: metric.color }} />
              {metric.label} Comparison
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sortedByMetric.map((team: any, i: number) => {
                const isPlayer = team.name === s.team?.name;
                const val = getTeamSpec(team, metric.key);
                const playerVal = getTeamSpec(s.team, metric.key);
                const delta = isPlayer ? 0 : parseFloat((val - playerVal).toFixed(1));
                return (
                  <div key={team.name} style={{ display: 'grid', gridTemplateColumns: '30px 200px 1fr 60px 70px', gap: '12px', alignItems: 'center', padding: '8px 0', borderBottom: i < sortedByMetric.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: isPlayer ? metric.color : '#fff', fontFamily: HUB.fontMono }}>P{i + 1}</span>
                    <span style={{ fontSize: '12px', color: isPlayer ? metric.color : '#fff', fontWeight: isPlayer ? 800 : 400 }}>{team.name}</span>
                    {statBar(val, 99, isPlayer ? metric.color : '#3b82f6')}
                    <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#fff', textAlign: 'right' }}>{val.toFixed(0)}</span>
                    <span style={{ fontSize: '11px', color: delta === 0 ? HUB.textMuted : delta > 0 ? '#ef4444' : '#10b981', textAlign: 'right' }}>
                      {delta === 0 ? 'YOU' : (delta > 0 ? `+${delta}` : `${delta}`)}
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
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={16} color="#3b82f6" /> Overall Constructor Performance Rankings
        </h3>
        {allTeams.map((team: any, i: number) => {
          const isPlayer = team.name === s.team?.name;
          const perf = team.carPerformance || 80;
          const delta = isPlayer ? 0 : parseFloat((perf - (s.team?.carPerformance || 80)).toFixed(1));
          return (
            <div key={team.name} style={{ display: 'grid', gridTemplateColumns: '30px 200px 1fr 60px 70px', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: i < allTeams.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: isPlayer ? HUB.accent : '#fff', fontFamily: HUB.fontMono }}>P{i + 1}</span>
              <span style={{ fontSize: '13px', color: isPlayer ? HUB.accent : '#fff', fontWeight: isPlayer ? 800 : 400 }}>{team.name}</span>
              {statBar(perf, 99, isPlayer ? HUB.accent : '#3b82f6')}
              <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#fff', textAlign: 'right' }}>{perf.toFixed(1)}</span>
              <span style={{ fontSize: '11px', color: delta === 0 ? HUB.textMuted : delta > 0 ? '#ef4444' : '#10b981', textAlign: 'right' }}>
                {delta === 0 ? 'YOU' : (delta > 0 ? `+${delta}` : `${delta}`)}
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
    if (facility.level >= catalog.maxLevel) { onFlash('Already at maximum level.'); return; }
    if ((s.team?.budget || 0) < cost) { onFlash(`Insufficient budget. Requires ${cost.toFixed(1)}M.`); return; }
    s.team.budget = parseFloat((s.team.budget - cost).toFixed(1));
    facility.upgrading = true;
    facility.readyDay = (s.season?.currentDay || 1) + catalog.buildDays;
    onFlash(`${catalog.name} upgrade started. Ready in ${catalog.buildDays} days.`);
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
                <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>{catalog.name}</h4>
                <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{catalog.benefit}</p>
              </div>
              <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: isMax ? '#10b981' : '#fff', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>Lv{facility.level}</span>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: catalog.maxLevel }).map((_, lvl) => (
                  <div key={lvl} style={{ flex: 1, height: '6px', borderRadius: '2px', background: lvl < facility.level ? HUB.accent : 'rgba(255,255,255,0.08)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '9px', color: HUB.textMuted }}>Level {facility.level}/{catalog.maxLevel}</span>
              </div>
            </div>
            <button
              onClick={() => handleUpgrade(catalog.id)}
              disabled={isMax || isBuilding || !canAfford}
              style={{
                ...actionBtn({ padding: '10px 16px', fontSize: '12px', width: '100%', backgroundColor: isMax ? 'rgba(255,255,255,0.03)' : isBuilding ? 'rgba(255,255,255,0.03)' : canAfford ? HUB.accent : 'rgba(239,68,68,0.08)' }),
                opacity: (isMax || isBuilding) ? 0.5 : canAfford ? 1 : 0.7,
                cursor: (isMax || isBuilding) ? 'not-allowed' : 'pointer'
              }}
            >
              {isMax ? 'MAXED OUT' : isBuilding ? 'UPGRADING...' : !canAfford ? `Need $${cost.toFixed(1)}M` : `Upgrade → $${cost.toFixed(1)}M`}
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
    { id: 'raceReports', label: 'Race Reports', icon: <BookOpen size={12} /> },
    { id: 'upgradeHistory', label: 'Upgrade History', icon: <RefreshCw size={12} /> },
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
              padding: '8px 16px',
              background: reportsSubTab === tab.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${reportsSubTab === tab.id ? HUB.accent : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '6px',
              color: reportsSubTab === tab.id ? '#fff' : HUB.textMuted,
              cursor: 'pointer',
              fontFamily: HUB.fontBold,
              fontSize: '11px',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {reportsSubTab === 'raceReports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.length === 0 ? (
            <div style={{ ...glassCard({ padding: '60px' }), textAlign: 'center' }}>
              <BookOpen size={48} color={HUB.textMuted} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', color: HUB.textMuted, margin: 0 }}>No reports yet</h3>
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '8px 0 0' }}>Engineering reports are generated after each race weekend.</p>
            </div>
          ) : (
            reports.map((report: any, i: number) => (
              <div key={i} style={{ ...glassCard({ padding: '24px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={16} color={HUB.accent} /> Round {report.round} Engineering Report
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {report.notes.map((note: string, ni: number) => (
                    <div key={ni} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                      <ChevronRight size={14} color={HUB.accent} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <p style={{ fontSize: '13px', color: '#ddd', margin: 0, lineHeight: 1.45 }}>{note}</p>
                    </div>
                  ))}
                </div>
                {report.completedProjects?.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px' }}>
                    <p style={{ fontSize: '11px', color: '#10b981', margin: 0 }}>
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
              <RefreshCw size={48} color={HUB.textMuted} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', color: HUB.textMuted, margin: 0 }}>No upgrades yet</h3>
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '8px 0 0' }}>Upgrade history will appear here as you complete development projects.</p>
            </div>
          ) : (
            <div style={{ ...glassCard({ padding: '0' }), overflow: 'hidden' }}>
              {upgradeHistory.map((upgrade: any, i: number) => {
                const outcomeColors: any = {
                  overperform: '#3b82f6',
                  success: '#10b981',
                  underperform: '#f59e0b',
                  fail: '#ef4444',
                };
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 100px 100px', gap: '16px', alignItems: 'center', padding: '14px 20px', borderBottom: i < upgradeHistory.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>Round {upgrade.round}</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{upgrade.label}</span>
                    <span style={{ fontSize: '11px', color: outcomeColors[upgrade.outcome], textTransform: 'uppercase', fontWeight: 700 }}>{upgrade.outcome}</span>
                    <span style={{ fontSize: '12px', color: '#fff', fontFamily: HUB.fontMono }}>{upgrade.expectedGain}</span>
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
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
  { id: 'development', label: 'Development', icon: <FlaskConical size={14} /> },
  { id: 'projects', label: 'Projects', icon: <Layers size={14} /> },
  { id: 'components', label: 'Components', icon: <Cpu size={14} /> },
  { id: 'performance', label: 'Performance', icon: <BarChart2 size={14} /> },
  { id: 'facilities', label: 'Facilities', icon: <Wrench size={14} /> },
  { id: 'reports', label: 'Reports', icon: <BookOpen size={14} /> },
];

function EngineeringHQ({ root }: { root: HTMLElement }) {
  ensureTeamState(state.team!);
  ensureEngineeringState(state);
  ensureFinanceState(state);

  const [activeTab, setActiveTab] = useState('overview');
  const [flashMessage, setFlashMessage] = useState('');
  const s = state as any;

  const budget = s.team?.budget || 0;
  const overallRating = getOverallCarRating(s);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {sectionLabel('Technical Department')}
          {pageTitle('Engineering Headquarters')}
          {pageSubtitle('Development programmes, component management, and performance analysis.')}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={statCell({ minWidth: '120px' })}>
            {statLabel('Car Rating')}
            {statValue(overallRating.toFixed(1), overallRating > 85 ? '#10b981' : '#fff')}
          </div>
          <div style={statCell({ minWidth: '120px' })}>
            {statLabel('Budget')}
            {statValue(`$${budget.toFixed(1)}M`, budget > 20 ? '#10b981' : '#f59e0b')}
          </div>
        </div>
      </div>

      {/* Flash message */}
      {flashMessage && (
        <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${HUB.accent}`, borderRadius: '8px', color: '#fff', fontSize: '13px', marginBottom: '24px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Zap size={14} color={HUB.accent} />
          {flashMessage}
          <button onClick={() => setFlashMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="mobile-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? HUB.accent : 'transparent'}`,
              color: activeTab === tab.id ? '#fff' : HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: '12px',
              letterSpacing: '0.05em', transition: 'all 0.15s', marginBottom: '-1px',
            }}
          >
            {tab.icon}
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview'     && <OverviewTab s={s} />}
        {activeTab === 'development'  && <DevelopmentTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'projects'     && <ProjectsTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'components'   && <ComponentsTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'performance'  && <PerformanceTab s={s} />}
        {activeTab === 'facilities'   && <FacilitiesTab s={s} onFlash={setFlashMessage} />}
        {activeTab === 'reports'      && <ReportsTab s={s} />}
      </div>
    </div>
  );
}

export function renderEngineering(root: HTMLElement) {
  ensureTeamState(state.team!);
  mountLayout(root, 'engineering', <EngineeringHQ root={root} />, () => renderEngineering(root));
}
