import React, { useState, useMemo } from 'react';
import { Search, Filter, Map, Plus, Globe, BarChart2, X, ChevronDown, ArrowLeftRight, Zap, Shield, Flame, Droplets, Wind, Cpu, Activity } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import {
  CIRCUIT_LIBRARY, searchCircuits, REGIONS, TYPES,
  getCircuitById, CALENDAR_STATUSES, CALENDAR_STATUS_META
} from '../circuitLibrary.js';
import { fiaCareer, saveFIACareer, setFIACareer, LICENSE_STATUS, getLicenseForCircuit, setCircuitLicense } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';
import { renderFIACircuitDesigner } from './FIACircuitDesigner.tsx';

// ── Calendar Status Badge ─────────────────────────────────────────────────────
function CalendarStatusBadge({ status }: { status?: string }) {
  const meta = status && (CALENDAR_STATUS_META as any)[status];
  if (!meta) return null;
  const color = meta.color || '#94A3B8';
  return (
    <span style={{
      fontFamily: HUB.fontBold, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 999, border: `1px solid ${color}44`, color, background: `${color}18`,
      whiteSpace: 'nowrap',
    }}>{meta.shortLabel}</span>
  );
}

// ── Circuit Type Badge ────────────────────────────────────────────────────────
const TRACK_COLORS: Record<string, string> = { permanent: '#3B82F6', street: '#F59E0B', temporary: '#10B981' };
function CircuitTypeBadge({ type }: { type: string }) {
  const color = TRACK_COLORS[type] || '#fff';
  return (
    <span style={{
      fontFamily: HUB.fontBold, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 999, border: `1px solid ${color}33`, color, background: `${color}11`,
    }}>{type}</span>
  );
}

// ── License Badge ─────────────────────────────────────────────────────────────
function LicenseBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    [LICENSE_STATUS.LICENSED]: { label: 'Licensed', color: '#10B981' },
    [LICENSE_STATUS.CONDITIONALLY_APPROVED]: { label: 'Conditional', color: '#F59E0B' },
    [LICENSE_STATUS.AWAITING_INSPECTION]: { label: 'Awaiting', color: '#3B82F6' },
    [LICENSE_STATUS.DRAFT]: { label: 'Draft', color: '#94A3B8' },
    [LICENSE_STATUS.SUSPENDED]: { label: 'Suspended', color: '#EF4444' },
    [LICENSE_STATUS.REJECTED]: { label: 'Rejected', color: '#EF4444' },
  };
  const { label, color } = (status && map[status]) || { label: 'Unlicensed', color: '#94A3B8' };
  return (
    <span style={{
      fontFamily: HUB.fontBold, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 999, border: `1px solid ${color}33`, color, background: `${color}11`,
    }}>{label}</span>
  );
}

// ── Perf Bar ─────────────────────────────────────────────────────────────────
function PerfBar({ label, value, icon, color = '#E10600' }: { label: string; value: number; icon?: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {icon && <span style={{ color }}>{icon}</span>}
          <span style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>{label}</span>
        </div>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color }}>{value}/10</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value * 10}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{label}</span>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{value}</span>
    </div>
  );
}

// ── Compare Bar (used in comparison panel) ────────────────────────────────────
function CompareRow({ label, a, b }: { label: string; a: any; b: any }) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  const aBetter = aNum !== null && bNum !== null ? aNum > bNum : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
      <div style={{ textAlign: 'right', fontFamily: HUB.fontBold, fontSize: 11, color: aBetter === true ? '#10B981' : aBetter === false ? HUB.textMuted : '#fff' }}>{a}</div>
      <div style={{ fontFamily: HUB.fontRegular, fontSize: 9, color: HUB.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: aBetter === false ? '#10B981' : aBetter === true ? HUB.textMuted : '#fff' }}>{b}</div>
    </div>
  );
}

// ── Circuit Detail Panel ──────────────────────────────────────────────────────
function CircuitDetailPanel({ circuit, onClose, onLicense, career }: any) {
  const license = getLicenseForCircuit(career, circuit.circuitId);
  const perf = circuit.perf || {};
  const meta = circuit.calendarStatus && (CALENDAR_STATUS_META as any)[circuit.calendarStatus];

  return (
    <div style={{ ...glassCard({ padding: '24px' }), position: 'sticky', top: 0, maxHeight: '90vh', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <CircuitTypeBadge type={circuit.type} />
            <CalendarStatusBadge status={circuit.calendarStatus} />
            <LicenseBadge status={license?.status || null} />
          </div>
          <h2 style={{ fontFamily: HUB.fontWide, fontSize: 16, color: '#fff', margin: '0 0 4px', textTransform: 'uppercase', lineHeight: 1.2 }}>{circuit.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={11} color={HUB.textMuted} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{circuit.country} · {circuit.region}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
      </div>

      {/* Calendar Status Note */}
      {circuit.calendarStatusNote && (
        <div style={{ background: `${(meta?.color || '#94A3B8')}11`, border: `1px solid ${(meta?.color || '#94A3B8')}33`, borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: meta?.color || '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Status Note</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>{circuit.calendarStatusNote}</p>
        </div>
      )}

      {/* Key Characteristics */}
      {circuit.keyCharacteristics?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>KEY CHARACTERISTICS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {circuit.keyCharacteristics.map((k: string) => (
              <span key={k} style={{ fontFamily: HUB.fontRegular, fontSize: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '2px 8px', color: '#CBD5E1' }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>CIRCUIT SPECS</div>
        <StatRow label="Circuit Length" value={`${circuit.lengthKm} km`} />
        <StatRow label="Race Laps" value={circuit.laps} />
        <StatRow label="Corners" value={circuit.corners} />
        <StatRow label="Longest Straight" value={`${circuit.longestStraightM}m`} />
        <StatRow label="Elevation Change" value={`${circuit.elevationChangeM}m`} />
        <StatRow label="Overtaking Difficulty" value={`${circuit.overtakingDifficulty}%`} />
        <StatRow label="Tyre Severity" value={circuit.tyreSeverity} />
        <StatRow label="Safety Rating" value={`${circuit.safetyRating}/100`} />
        <StatRow label="Hosting Fee" value={`$${circuit.hostingFee}M/yr`} />
      </div>

      {/* Performance Profile */}
      {Object.keys(perf).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>PERFORMANCE DEMANDS (1–10)</div>
          <PerfBar label="Engine / Power Unit" value={perf.engineImportance ?? 5} icon={<Zap size={10} />} color="#E10600" />
          <PerfBar label="Downforce / Aero" value={perf.downforceRequirement ?? 5} icon={<Wind size={10} />} color="#3B82F6" />
          <PerfBar label="Mechanical Grip" value={perf.mechanicalGripImportance ?? 5} icon={<Activity size={10} />} color="#10B981" />
          <PerfBar label="Tyre Degradation" value={perf.tyreDegradation ?? 5} icon={<Flame size={10} />} color="#F59E0B" />
          <PerfBar label="Braking Intensity" value={perf.brakingIntensity ?? 5} icon={<Shield size={10} />} color="#8B5CF6" />
          <PerfBar label="Cooling Requirement" value={perf.coolingRequirement ?? 5} icon={<Cpu size={10} />} color="#EC4899" />
          <PerfBar label="Wet Weather" value={perf.wetWeatherSensitivity ?? 3} icon={<Droplets size={10} />} color="#60A5FA" />
        </div>
      )}

      {/* Ideal Car */}
      {circuit.idealCar && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: `3px solid ${FIA.accent}` }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: FIA.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>IDEAL CAR SETUP</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>{circuit.idealCar}</p>
        </div>
      )}

      <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{circuit.description}</p>

      {/* Source */}
      {circuit.sourceUrl && (
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>
          Source: <a href={circuit.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA' }}>Reference</a> · Verified: {circuit.lastVerified || 'N/A'}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(!license || license.status === LICENSE_STATUS.DRAFT) && (
          <button onClick={() => onLicense(circuit)} style={{ ...actionBtn({ padding: '10px', fontSize: 11 }), width: '100%' }}>
            Submit for Inspection →
          </button>
        )}
        {!license && (
          <button onClick={() => onLicense(circuit)} style={{ padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, width: '100%' }}>
            Grant License (Full Authority)
          </button>
        )}
      </div>
    </div>
  );
}

// ── Circuit Comparison Panel ──────────────────────────────────────────────────
function ComparePanel({ a, b, onClose }: { a: any; b: any; onClose: () => void }) {
  const perfKeys = [
    { key: 'engineImportance', label: 'Engine' },
    { key: 'downforceRequirement', label: 'Downforce' },
    { key: 'mechanicalGripImportance', label: 'Mech Grip' },
    { key: 'tyreDegradation', label: 'Tyre Deg' },
    { key: 'brakingIntensity', label: 'Braking' },
    { key: 'coolingRequirement', label: 'Cooling' },
    { key: 'wetWeatherSensitivity', label: 'Wet Weather' },
  ];

  return (
    <div style={{ ...glassCard({ padding: '24px' }), position: 'sticky', top: 0, maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeftRight size={14} color={FIA.accent} />
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff', textTransform: 'uppercase' }}>Circuit Comparison</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{a.name}</div>
          <CalendarStatusBadge status={a.calendarStatus} />
        </div>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textAlign: 'center', alignSelf: 'center' }}>VS</div>
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{b.name}</div>
          <CalendarStatusBadge status={b.calendarStatus} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>CIRCUIT SPECS</div>
        <CompareRow label="Length" a={`${a.lengthKm}km`} b={`${b.lengthKm}km`} />
        <CompareRow label="Corners" a={a.corners} b={b.corners} />
        <CompareRow label="Longest Straight" a={`${a.longestStraightM}m`} b={`${b.longestStraightM}m`} />
        <CompareRow label="Elevation" a={`${a.elevationChangeM}m`} b={`${b.elevationChangeM}m`} />
        <CompareRow label="Overtaking Diff%" a={a.overtakingDifficulty} b={b.overtakingDifficulty} />
        <CompareRow label="Tyre Severity" a={a.tyreSeverity} b={b.tyreSeverity} />
        <CompareRow label="Hosting Fee" a={`$${a.hostingFee}M`} b={`$${b.hostingFee}M`} />
      </div>

      {(a.perf && b.perf) && (
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>PERFORMANCE DEMANDS</div>
          {perfKeys.map(({ key, label }) => (
            <CompareRow key={key} label={label} a={a.perf[key] ?? '—'} b={b.perf[key] ?? '—'} />
          ))}
        </div>
      )}

      {a.idealCar && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `2px solid ${FIA.accent}` }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: FIA.accent, marginBottom: 3 }}>IDEAL CAR — {a.name}</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, margin: 0 }}>{a.idealCar}</p>
        </div>
      )}
      {b.idealCar && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `2px solid #3B82F6` }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 9, color: '#3B82F6', marginBottom: 3 }}>IDEAL CAR — {b.name}</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, margin: 0 }}>{b.idealCar}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
function FIACircuitLibrary({ appRoot }: any) {
  const career = fiaCareer;
  const [query, setQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [compareA, setCompareA] = useState<any>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [notification, setNotification] = useState('');

  const allCircuits = useMemo(() => {
    const custom = (career?.customCircuits || []).map((c: any) => ({ ...c, calendarStatus: 'CUSTOM' }));
    return [...searchCircuits(query, {
      region: filterRegion || undefined,
      type: filterType || undefined,
      calendarStatus: filterStatus || undefined,
    }), ...custom];
  }, [query, filterRegion, filterType, filterStatus, career?.customCircuits?.length]);

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 2500); };

  const handleLicense = (circuit: any) => {
    if (!career) return;
    setCircuitLicense(career, circuit.circuitId, LICENSE_STATUS.LICENSED, 'Quick-licensed via Circuit Library');
    setFIACareer({ ...career });
    saveFIACareer();
    showNotification(`${circuit.name} has been licensed!`);
    setSelected(null);
  };

  const handleCardClick = (circuit: any) => {
    if (compareMode) {
      if (!compareA) {
        setCompareA(circuit);
        showNotification(`Selected ${circuit.name} for comparison. Pick the second circuit.`);
      } else if (compareA.circuitId !== circuit.circuitId) {
        setSelected({ _compare: true, a: compareA, b: circuit });
        setCompareA(null);
        setCompareMode(false);
      }
    } else {
      setSelected(selected?.circuitId === circuit.circuitId ? null : circuit);
    }
  };

  const isComparePanel = selected && selected._compare;
  const isDetailPanel = selected && !selected._compare;

  const selectColor = '#94A3B8';

  const selectStyle = {
    padding: '9px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: '#10B981', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {notification}
        </div>
      )}

      <main style={{ flex: 1, padding: '40px 48px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 8, padding: 0 }}>
              ← FIA Dashboard
            </button>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>FIA Circuit Library</div>
            <h1 style={{ fontFamily: HUB.fontWide, fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Circuit Library</h1>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, marginTop: 8 }}>
              {CIRCUIT_LIBRARY.length} circuits · {allCircuits.length} matching filter
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setCompareMode(!compareMode); setCompareA(null); setSelected(null); }}
              style={{ ...actionBtn({ padding: '10px 18px', fontSize: 11 }), display: 'flex', alignItems: 'center', gap: 8, background: compareMode ? 'rgba(59,130,246,0.2)' : 'rgba(225,6,0,0.18)', border: `1px solid ${compareMode ? '#3B82F6' : 'rgba(225,6,0,0.4)'}` }}
            >
              <ArrowLeftRight size={13} /> {compareMode ? 'Cancel Compare' : 'Compare Circuits'}
            </button>
            <button onClick={() => renderFIACircuitDesigner(appRoot)} style={{ ...actionBtn({ padding: '10px 18px', fontSize: 11 }), display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={13} /> Design New Circuit
            </button>
          </div>
        </div>

        {compareMode && (
          <div style={{ marginBottom: 18, padding: '12px 18px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 10, fontFamily: HUB.fontRegular, fontSize: 12, color: '#60A5FA', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeftRight size={14} />
            {compareA ? `Comparing ${compareA.name} with... Click a second circuit.` : 'Click any two circuits to compare them side-by-side.'}
          </div>
        )}

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={13} color={HUB.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, country, characteristic..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={selectStyle}>
            <option value="">All Regions</option>
            {REGIONS.map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">All Types</option>
            {TYPES.map((t: string) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All Status</option>
            {CALENDAR_STATUSES.map((s: string) => {
              const m = (CALENDAR_STATUS_META as any)[s];
              return <option key={s} value={s}>{m?.label || s}</option>;
            })}
          </select>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: (isDetailPanel || isComparePanel) ? '1fr 400px' : '1fr', gap: 24, alignItems: 'start' }}>
          {/* Circuit Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: (isDetailPanel || isComparePanel) ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 14 }}>
            {allCircuits.map((circuit: any) => {
              const license = getLicenseForCircuit(career, circuit.circuitId);
              const isSelected = selected?.circuitId === circuit.circuitId || compareA?.circuitId === circuit.circuitId;
              const meta = circuit.calendarStatus && (CALENDAR_STATUS_META as any)[circuit.calendarStatus];
              const statusColor = meta?.color || '#94A3B8';
              return (
                <button
                  key={circuit.circuitId}
                  onClick={() => handleCardClick(circuit)}
                  style={{
                    ...glassCard({ padding: '16px' }),
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    border: isSelected ? `1px solid ${statusColor}` : '1px solid rgba(255,255,255,0.06)',
                    background: isSelected ? `${statusColor}11` : 'rgba(26,30,46,0.5)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
                >
                  {/* Top badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CircuitTypeBadge type={circuit.type} />
                      <CalendarStatusBadge status={circuit.calendarStatus} />
                    </div>
                    <LicenseBadge status={license?.status || null} />
                  </div>

                  <h3 style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff', margin: '0 0 3px', lineHeight: 1.3 }}>{circuit.name}</h3>
                  <p style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, margin: '0 0 10px' }}>
                    {circuit.country} · {circuit.region}
                  </p>

                  {/* Key characteristics tags */}
                  {circuit.keyCharacteristics && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
                      {circuit.keyCharacteristics.slice(0, 3).map((k: string) => (
                        <span key={k} style={{ fontSize: 8, fontFamily: HUB.fontRegular, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '1px 6px', color: HUB.textMuted }}>{k}</span>
                      ))}
                    </div>
                  )}

                  {/* Quick stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {[
                      { label: 'Length', value: `${circuit.lengthKm}km` },
                      { label: 'Corners', value: circuit.corners },
                      { label: 'Overtaking', value: `${circuit.overtakingDifficulty}%` },
                      { label: 'Fee', value: `$${circuit.hostingFee}M` },
                    ].map((s, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '5px 7px' }}>
                        <div style={{ fontFamily: HUB.fontRegular, fontSize: 8, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                        <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}

            {allCircuits.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: HUB.textMuted }}>
                <Map size={40} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
                <p style={{ fontFamily: HUB.fontRegular, fontSize: 14 }}>No circuits match your search.</p>
              </div>
            )}
          </div>

          {/* Detail or Compare Panel */}
          {isDetailPanel && (
            <CircuitDetailPanel
              circuit={selected}
              career={career}
              onClose={() => setSelected(null)}
              onLicense={handleLicense}
            />
          )}
          {isComparePanel && (
            <ComparePanel
              a={selected.a}
              b={selected.b}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export function renderFIACircuitLibrary(root: HTMLElement) {
  renderToAppRoot(root, <FIACircuitLibrary appRoot={root} />);
}
