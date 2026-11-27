import React, { useState, useMemo } from 'react';
import { Search, Filter, Map, Plus, Globe, BarChart2, X, ChevronDown, ArrowLeftRight, Zap, Shield, Flame, Droplets, Wind, Cpu, Activity, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, iconBtn, pageTitle, sectionLabel } from '../../components/HubLayout.tsx';
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
  return (
    <span style={{
      fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted,
      whiteSpace: 'nowrap'
    }}>{sentenceCase(meta.label)}</span>
  );
}

// Library labels are stored in title case ("On 2026 Calendar") — show them in sentence case.
function sentenceCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// ── Circuit Type Badge ────────────────────────────────────────────────────────
function CircuitTypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted,
      padding: '2px 6px', borderRadius: 6, border: `1px solid ${HUB.border}`, background: HUB.raised,
      textTransform: 'capitalize'
    }}>{type}</span>
  );
}

// ── License Badge ─────────────────────────────────────────────────────────────
function LicenseBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    [LICENSE_STATUS.LICENSED]: { label: 'Licensed', color: HUB.positive },
    [LICENSE_STATUS.CONDITIONALLY_APPROVED]: { label: 'Conditional', color: HUB.warning },
    [LICENSE_STATUS.AWAITING_INSPECTION]: { label: 'Awaiting', color: HUB.textMuted },
    [LICENSE_STATUS.DRAFT]: { label: 'Draft', color: HUB.textFaint },
    [LICENSE_STATUS.SUSPENDED]: { label: 'Suspended', color: HUB.negative },
    [LICENSE_STATUS.REJECTED]: { label: 'Rejected', color: HUB.negative },
  };
  const { label, color } = (status && map[status]) || { label: 'Unlicensed', color: HUB.textFaint };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, whiteSpace: 'nowrap'
    }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />{label}</span>
  );
}

// ── Perf Bar ─────────────────────────────────────────────────────────────────
function PerfBar({ label, value, icon, color = 'rgba(237,237,237,0.5)' }: { label: string; value: number; icon?: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon && <span style={{ display: 'flex', color: HUB.textFaint }}>{icon}</span>}
          <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{label}</span>
        </div>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{value}/10</span>
      </div>
      <div style={{ height: 4, background: HUB.raised, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value * 10}%`, background: color, borderRadius: 2, transition: `width 400ms ${HUB.ease}` }} />
      </div>
    </div>
  );
}

// ── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${HUB.border}` }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{label}</span>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{value}</span>
    </div>
  );
}

// ── Compare Bar (used in comparison panel) ────────────────────────────────────
function CompareRow({ label, a, b }: { label: string; a: any; b: any }) {
  const aNum = typeof a === 'number' ? a : null;
  const bNum = typeof b === 'number' ? b : null;
  const aBetter = aNum !== null && bNum !== null ? aNum > bNum : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, padding: '6px 0', borderBottom: `1px solid ${HUB.border}`, alignItems: 'center' }}>
      <div style={{ textAlign: 'right', fontFamily: HUB.fontBold, fontSize: 12, color: aBetter === false ? HUB.textFaint : HUB.textPrimary }}>{a}</div>
      <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: aBetter === true ? HUB.textFaint : HUB.textPrimary }}>{b}</div>
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
          <h2 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: '0 0 4px', lineHeight: 1.2 }}>{circuit.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={12} strokeWidth={1.5} color={HUB.textFaint} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{circuit.country} · {circuit.region}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" title="Close" className={btnClass('ghost')} style={iconBtn('sm')}><X size={16} strokeWidth={1.5} /></button>
      </div>

      {/* Calendar Status Note */}
      {circuit.calendarStatusNote && (
        <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>{meta?.label ? sentenceCase(meta.label) : 'Status note'}</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>{circuit.calendarStatusNote}</p>
        </div>
      )}

      {/* Key Characteristics */}
      {circuit.keyCharacteristics?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {sectionLabel('Key characteristics')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {circuit.keyCharacteristics.map((k: string) => (
              <span key={k} style={{ fontFamily: HUB.fontRegular, fontSize: 12, background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 6, padding: '2px 8px', color: HUB.textMuted }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ marginBottom: 16 }}>
        {sectionLabel('Circuit specs')}
        <StatRow label="Circuit length" value={`${circuit.lengthKm} km`} />
        <StatRow label="Race laps" value={circuit.laps} />
        <StatRow label="Corners" value={circuit.corners} />
        <StatRow label="Longest straight" value={`${circuit.longestStraightM}m`} />
        <StatRow label="Elevation change" value={`${circuit.elevationChangeM}m`} />
        <StatRow label="Overtaking difficulty" value={`${circuit.overtakingDifficulty}%`} />
        <StatRow label="Tyre severity" value={circuit.tyreSeverity} />
        <StatRow label="Safety rating" value={`${circuit.safetyRating}/100`} />
        <StatRow label="Hosting fee" value={`$${circuit.hostingFee}M/yr`} />
      </div>

      {/* Performance Profile */}
      {Object.keys(perf).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>{sectionLabel('Performance demands (1–10)')}</div>
          <PerfBar label="Engine / power unit" value={perf.engineImportance ?? 5} icon={<Zap size={12} strokeWidth={1.5} />} />
          <PerfBar label="Downforce / aero" value={perf.downforceRequirement ?? 5} icon={<Wind size={12} strokeWidth={1.5} />} />
          <PerfBar label="Mechanical grip" value={perf.mechanicalGripImportance ?? 5} icon={<Activity size={12} strokeWidth={1.5} />} />
          <PerfBar label="Tyre degradation" value={perf.tyreDegradation ?? 5} icon={<Flame size={12} strokeWidth={1.5} />} />
          <PerfBar label="Braking intensity" value={perf.brakingIntensity ?? 5} icon={<Shield size={12} strokeWidth={1.5} />} />
          <PerfBar label="Cooling requirement" value={perf.coolingRequirement ?? 5} icon={<Cpu size={12} strokeWidth={1.5} />} />
          <PerfBar label="Wet weather" value={perf.wetWeatherSensitivity ?? 3} icon={<Droplets size={12} strokeWidth={1.5} />} />
        </div>
      )}

      {/* Ideal Car */}
      {circuit.idealCar && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8 }}>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>Ideal car setup</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary, margin: 0, lineHeight: 1.5 }}>{circuit.idealCar}</p>
        </div>
      )}

      <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{circuit.description}</p>

      {/* Verification */}
      {circuit.lastVerified && (
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint, marginBottom: 16 }}>
          Verified: {circuit.lastVerified}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(!license || license.status === LICENSE_STATUS.DRAFT) && (
          <button onClick={() => onLicense(circuit)} className={btnClass('primary')} style={btn('primary', 'md', { width: '100%' })}>
            Submit for inspection
          </button>
        )}
        {!license && (
          <button onClick={() => onLicense(circuit)} className={btnClass('secondary')} style={btn('secondary', 'md', { width: '100%' })}>
            Grant license
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
    { key: 'mechanicalGripImportance', label: 'Mech grip' },
    { key: 'tyreDegradation', label: 'Tyre deg' },
    { key: 'brakingIntensity', label: 'Braking' },
    { key: 'coolingRequirement', label: 'Cooling' },
    { key: 'wetWeatherSensitivity', label: 'Wet weather' },
  ];

  return (
    <div style={{ ...glassCard({ padding: '24px' }), position: 'sticky', top: 0, maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeftRight size={16} strokeWidth={1.5} color={HUB.textMuted} />
          <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>Circuit comparison</span>
        </div>
        <button onClick={onClose} aria-label="Close" title="Close" className={btnClass('ghost')} style={iconBtn('sm')}><X size={16} strokeWidth={1.5} /></button>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 16, padding: '10px 0', borderBottom: `1px solid ${HUB.border}` }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>{a.name}</div>
          <CalendarStatusBadge status={a.calendarStatus} />
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, textAlign: 'center', alignSelf: 'center' }}>vs</div>
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>{b.name}</div>
          <CalendarStatusBadge status={b.calendarStatus} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        {sectionLabel('Circuit specs')}
        <CompareRow label="Length" a={`${a.lengthKm}km`} b={`${b.lengthKm}km`} />
        <CompareRow label="Corners" a={a.corners} b={b.corners} />
        <CompareRow label="Longest straight" a={`${a.longestStraightM}m`} b={`${b.longestStraightM}m`} />
        <CompareRow label="Elevation" a={`${a.elevationChangeM}m`} b={`${b.elevationChangeM}m`} />
        <CompareRow label="Overtaking diff %" a={a.overtakingDifficulty} b={b.overtakingDifficulty} />
        <CompareRow label="Tyre severity" a={a.tyreSeverity} b={b.tyreSeverity} />
        <CompareRow label="Hosting fee" a={`$${a.hostingFee}M`} b={`$${b.hostingFee}M`} />
      </div>

      {(a.perf && b.perf) && (
        <div>
          {sectionLabel('Performance demands')}
          {perfKeys.map(({ key, label }) => (
            <CompareRow key={key} label={label} a={a.perf[key] ?? '—'} b={b.perf[key] ?? '—'} />
          ))}
        </div>
      )}

      {a.idealCar && (
        <div style={{ marginTop: 16, padding: '10px 12px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8 }}>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>Ideal car · {a.name}</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>{a.idealCar}</p>
        </div>
      )}
      {b.idealCar && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8 }}>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>Ideal car · {b.name}</div>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>{b.idealCar}</p>
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
    showNotification(`${circuit.name} licensed`);
    setSelected(null);
  };

  const handleCardClick = (circuit: any) => {
    if (compareMode) {
      if (!compareA) {
        setCompareA(circuit);
        showNotification(`${circuit.name} selected · pick a second circuit`);
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

  const selectStyle = {
    height: 36, padding: '0 12px', background: HUB.raised, border: `1px solid ${HUB.border}`,
    borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {notification}
        </div>
      )}

      <main style={{ flex: 1, padding: '40px 48px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}>
              <ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard
            </button>
            {pageTitle('Circuit library')}
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 14, color: HUB.textMuted, margin: 0 }}>
              {CIRCUIT_LIBRARY.length} circuits · {allCircuits.length} matching filter
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setCompareMode(!compareMode); setCompareA(null); setSelected(null); }}
              className={btnClass('secondary')}
              style={btn('secondary', 'md')}
              aria-pressed={compareMode}
            >
              <ArrowLeftRight size={16} strokeWidth={1.5} />{compareMode ? 'Cancel compare' : 'Compare circuits'}
            </button>
            <button onClick={() => renderFIACircuitDesigner(appRoot)} className={btnClass('primary')} style={btn('primary', 'md')}>
              <Plus size={16} strokeWidth={1.5} />Design new circuit
            </button>
          </div>
        </div>

        {compareMode && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowLeftRight size={16} strokeWidth={1.5} />
            {compareA ? `Comparing ${compareA.name} · pick a second circuit` : 'Pick two circuits to compare them side by side'}
          </div>
        )}

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} strokeWidth={1.5} color={HUB.textFaint} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, country, characteristic"
              style={{ width: '100%', height: 36, padding: '0 12px 0 36px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={selectStyle}>
            <option value="">All regions</option>
            {REGIONS.map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">All types</option>
            {TYPES.map((t: string) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            {CALENDAR_STATUSES.map((s: string) => {
              const m = (CALENDAR_STATUS_META as any)[s];
              return <option key={s} value={s}>{m?.label ? sentenceCase(m.label) : s}</option>;
            })}
          </select>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: (isDetailPanel || isComparePanel) ? '1fr 400px' : '1fr', gap: 24, alignItems: 'start' }}>
          {/* Circuit Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: (isDetailPanel || isComparePanel) ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 16 }}>
            {allCircuits.map((circuit: any) => {
              const license = getLicenseForCircuit(career, circuit.circuitId);
              const isSelected = selected?.circuitId === circuit.circuitId || compareA?.circuitId === circuit.circuitId;
              return (
                <button
                  key={circuit.circuitId}
                  onClick={() => handleCardClick(circuit)}
                  style={{
                    ...glassCard({ padding: '16px' }),
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    border: isSelected ? '1px solid rgba(225,6,0,0.4)' : `1px solid ${HUB.border}`,
                    background: isSelected ? HUB.accentSoft : HUB.surface,
                    transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, transform 150ms ${HUB.ease}`
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = HUB.borderMid; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = HUB.border; e.currentTarget.style.transform = 'translateY(0)'; } }}
                >
                  {/* Top badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CircuitTypeBadge type={circuit.type} />
                      <CalendarStatusBadge status={circuit.calendarStatus} />
                    </div>
                    <LicenseBadge status={license?.status || null} />
                  </div>

                  <h3 style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, margin: '0 0 4px', lineHeight: 1.3 }}>{circuit.name}</h3>
                  <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: '0 0 12px' }}>
                    {circuit.country} · {circuit.region}
                  </p>

                  {/* Key characteristics tags */}
                  {circuit.keyCharacteristics && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                      {circuit.keyCharacteristics.slice(0, 3).map((k: string) => (
                        <span key={k} style={{ fontSize: 11, fontFamily: HUB.fontRegular, background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 6, padding: '2px 6px', color: HUB.textMuted }}>{k}</span>
                      ))}
                    </div>
                  )}

                  {/* Quick stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[
                      { label: 'Length', value: `${circuit.lengthKm}km` },
                      { label: 'Corners', value: circuit.corners },
                      { label: 'Overtaking', value: `${circuit.overtakingDifficulty}%` },
                      { label: 'Fee', value: `$${circuit.hostingFee}M` },
                    ].map((s, i) => (
                      <div key={i} style={{ background: HUB.raised, borderRadius: 6, padding: '4px 8px' }}>
                        <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint }}>{s.label}</div>
                        <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}

            {allCircuits.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: HUB.textMuted }}>
                <Map size={40} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 12 }} />
                <p style={{ fontFamily: HUB.fontRegular, fontSize: 14 }}>No circuits match your search</p>
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
