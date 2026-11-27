import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle, sectionLabel } from '../../components/HubLayout.tsx';
import { CIRCUIT_LIBRARY } from '../circuitLibrary.js';
import { fiaCareer, saveFIACareer, setFIACareer, LICENSE_STATUS, getLicenseForCircuit, setCircuitLicense } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

const STATUS_MAP = {
  [LICENSE_STATUS.DRAFT]: { label: 'Draft', color: HUB.textFaint, icon: <Clock size={14} strokeWidth={1.5} /> },
  [LICENSE_STATUS.AWAITING_INSPECTION]: { label: 'Awaiting inspection', color: HUB.textMuted, icon: <Clock size={14} strokeWidth={1.5} /> },
  [LICENSE_STATUS.CONDITIONALLY_APPROVED]: { label: 'Conditional', color: HUB.warning, icon: <AlertTriangle size={14} strokeWidth={1.5} /> },
  [LICENSE_STATUS.LICENSED]: { label: 'Licensed', color: HUB.positive, icon: <CheckCircle size={14} strokeWidth={1.5} /> },
  [LICENSE_STATUS.SUSPENDED]: { label: 'Suspended', color: HUB.negative, icon: <XCircle size={14} strokeWidth={1.5} /> },
  [LICENSE_STATUS.REJECTED]: { label: 'Rejected', color: HUB.negative, icon: <XCircle size={14} strokeWidth={1.5} /> },
};

function SafetyCheck({ label, pass, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: HUB.raised }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{value}</span>
        {pass
          ? <CheckCircle size={14} strokeWidth={1.5} color={HUB.positive} />
          : <AlertTriangle size={14} strokeWidth={1.5} color={HUB.warning} />
        }
      </div>
    </div>
  );
}

function FIALicensingScreen({ appRoot }) {
  const career = fiaCareer!;
  const [selected, setSelected] = useState<any>(null);
  const [notification, setNotification] = useState('');
  const [notes, setNotes] = useState('');

  const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 2500); };

  const allCircuits = [...CIRCUIT_LIBRARY, ...(career.customCircuits || [])];

  const handleSetStatus = (status: string) => {
    if (!selected) return;
    setCircuitLicense(career, selected.circuitId, status, notes);
    setFIACareer({ ...career });
    saveFIACareer();
    showNotif(`${selected.name}: status set to ${STATUS_MAP[status]?.label || status}`);
    setSelected(null);
    setNotes('');
  };

  // Run inspection checks
  const getInspectionResults = (circuit: any) => [
    { label: 'Track length', value: `${circuit.lengthKm}km`, pass: circuit.lengthKm >= 3 && circuit.lengthKm <= 9 },
    { label: 'Safety rating', value: `${circuit.safetyRating}/100`, pass: circuit.safetyRating >= 80 },
    { label: 'Corners', value: circuit.corners, pass: circuit.corners >= 4 && circuit.corners <= 35 },
    { label: 'Longest straight', value: `${circuit.longestStraightM}m`, pass: circuit.longestStraightM <= 2500 },
    { label: 'Pit lane config', value: 'Defined', pass: true },
    { label: 'Medical facilities', value: 'On site', pass: circuit.safetyRating >= 75 },
  ];

  const sortedCircuits = allCircuits.sort((a: any, b: any) => {
    const la = getLicenseForCircuit(career, a.circuitId);
    const lb = getLicenseForCircuit(career, b.circuitId);
    const order = { awaiting_inspection: 0, conditionally_approved: 1, draft: 2, licensed: 3, rejected: 4, suspended: 5 };
    return (order[la?.status || 'draft'] || 2) - (order[lb?.status || 'draft'] || 2);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>
          {notification}
        </div>
      )}

      {/* Left: Circuit list */}
      <main style={{ flex: 1, padding: '40px 40px', overflowY: 'auto' }}>
        <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}><ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard</button>
        <div style={{ marginBottom: 24 }}>{pageTitle('Circuit licensing')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedCircuits.map((circuit: any) => {
            const license = getLicenseForCircuit(career, circuit.circuitId);
            const statusInfo = STATUS_MAP[license?.status || 'draft'] || STATUS_MAP[LICENSE_STATUS.DRAFT];
            const isSelected = selected?.circuitId === circuit.circuitId;

            return (
              <button
                key={circuit.circuitId}
                onClick={() => setSelected(isSelected ? null : circuit)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 10,
                  background: isSelected ? HUB.accentSoft : HUB.surface,
                  border: `1px solid ${isSelected ? 'rgba(225,6,0,0.4)' : HUB.border}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary }}>{circuit.name}</div>
                  <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{circuit.country} · {circuit.region} · Safety {circuit.safetyRating}/100</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'flex', color: statusInfo.color }}>{statusInfo.icon}</span>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{statusInfo.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Right: Inspection Panel */}
      {selected && (
        <aside style={{ width: 360, flexShrink: 0, background: HUB.sidebar, borderLeft: `1px solid ${HUB.border}`, padding: '32px 24px', overflowY: 'auto' }}>
          <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: '0 0 4px' }}>{selected.name}</h3>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: '0 0 24px' }}>{selected.country} · {selected.type}</p>

          {/* Inspection Report */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>{sectionLabel('Inspection report')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {getInspectionResults(selected).map((check, i) => (
                <SafetyCheck key={i} label={check.label} value={check.value} pass={check.pass} />
              ))}
            </div>
          </div>

          {/* Inspector Notes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 4 }}>{sectionLabel('Notes')}</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add inspection notes or conditions"
              style={{
                width: '100%', minHeight: 80, padding: '10px 12px', background: HUB.raised,
                border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary,
                fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.LICENSED)} className={btnClass('primary')} style={btn('primary', 'md', { width: '100%' })}>
              <CheckCircle size={16} strokeWidth={1.5} />Grant full license
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.CONDITIONALLY_APPROVED)} className={btnClass('secondary')} style={btn('secondary', 'md', { width: '100%' })}>
              Grant conditional approval
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.SUSPENDED)} className={btnClass('danger')} style={btn('danger', 'md', { width: '100%' })}>
              Suspend or reject license
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.AWAITING_INSPECTION)} className={btnClass('ghost')} style={btn('ghost', 'md', { width: '100%' })}>
              Mark awaiting inspection
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export function renderFIALicensing(root: HTMLElement) {
  renderToAppRoot(root, <FIALicensingScreen appRoot={root} />);
}
