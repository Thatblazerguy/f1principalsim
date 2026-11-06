import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import { CIRCUIT_LIBRARY } from '../circuitLibrary.js';
import { fiaCareer, saveFIACareer, setFIACareer, LICENSE_STATUS, getLicenseForCircuit, setCircuitLicense } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

const STATUS_MAP = {
  [LICENSE_STATUS.DRAFT]: { label: 'Draft', color: '#94A3B8', icon: <Clock size={13} /> },
  [LICENSE_STATUS.AWAITING_INSPECTION]: { label: 'Awaiting Inspection', color: '#3B82F6', icon: <Clock size={13} /> },
  [LICENSE_STATUS.CONDITIONALLY_APPROVED]: { label: 'Conditional', color: '#F59E0B', icon: <AlertTriangle size={13} /> },
  [LICENSE_STATUS.LICENSED]: { label: 'Licensed', color: '#10B981', icon: <CheckCircle size={13} /> },
  [LICENSE_STATUS.SUSPENDED]: { label: 'Suspended', color: '#EF4444', icon: <XCircle size={13} /> },
  [LICENSE_STATUS.REJECTED]: { label: 'Rejected', color: '#EF4444', icon: <XCircle size={13} /> },
};

function SafetyCheck({ label, pass, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: '#fff' }}>{value}</span>
        {pass
          ? <CheckCircle size={12} color="#10B981" />
          : <AlertTriangle size={12} color="#F59E0B" />
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
    { label: 'Track Length', value: `${circuit.lengthKm}km`, pass: circuit.lengthKm >= 3 && circuit.lengthKm <= 9 },
    { label: 'Safety Rating', value: `${circuit.safetyRating}/100`, pass: circuit.safetyRating >= 80 },
    { label: 'Corners', value: circuit.corners, pass: circuit.corners >= 4 && circuit.corners <= 35 },
    { label: 'Longest Straight', value: `${circuit.longestStraightM}m`, pass: circuit.longestStraightM <= 2500 },
    { label: 'Pit Lane Config', value: 'Defined', pass: true },
    { label: 'Medical Facilities', value: 'On site', pass: circuit.safetyRating >= 75 },
  ];

  const sortedCircuits = allCircuits.sort((a: any, b: any) => {
    const la = getLicenseForCircuit(career, a.circuitId);
    const lb = getLicenseForCircuit(career, b.circuitId);
    const order = { awaiting_inspection: 0, conditionally_approved: 1, draft: 2, licensed: 3, rejected: 4, suspended: 5 };
    return (order[la?.status || 'draft'] || 2) - (order[lb?.status || 'draft'] || 2);
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green }}>
          {notification}
        </div>
      )}

      {/* Left: Circuit list */}
      <main style={{ flex: 1, padding: '40px 40px', overflowY: 'auto' }}>
        <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 12, padding: 0 }}>← FIA Dashboard</button>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Circuit Management</div>
        <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: '0 0 24px', textTransform: 'uppercase' }}>Circuit Inspection & Licensing</h1>

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
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10,
                  background: isSelected ? 'rgba(225,6,0,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(225,6,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff' }}>{circuit.name}</div>
                  <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>{circuit.country} · {circuit.region} · Safety: {circuit.safetyRating}/100</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: statusInfo.color }}>
                  {statusInfo.icon}
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{statusInfo.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Right: Inspection Panel */}
      {selected && (
        <aside style={{ width: 360, flexShrink: 0, background: '#06080F', borderLeft: '1px solid rgba(255,255,255,0.05)', padding: '32px 24px', overflowY: 'auto' }}>
          <h3 style={{ fontFamily: HUB.fontWide, fontSize: 16, color: '#fff', margin: '0 0 4px', textTransform: 'uppercase' }}>{selected.name}</h3>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, margin: '0 0 24px' }}>{selected.country} · {selected.type}</p>

          {/* Inspection Report */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Inspection Report</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {getInspectionResults(selected).map((check, i) => (
                <SafetyCheck key={i} label={check.label} value={check.value} pass={check.pass} />
              ))}
            </div>
          </div>

          {/* Inspector Notes */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add inspection notes or conditions..."
              style={{
                width: '100%', minHeight: 80, padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff',
                fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.LICENSED)} style={{ ...actionBtn({ padding: '10px', fontSize: 11 }), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <CheckCircle size={13} /> Grant Full License
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.CONDITIONALLY_APPROVED)} style={{ padding: '10px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, width: '100%' }}>
              Conditional Approval
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.SUSPENDED)} style={{ padding: '10px', borderRadius: 8, background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.2)', color: FIA.accent, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, width: '100%' }}>
              Suspend / Reject
            </button>
            <button onClick={() => handleSetStatus(LICENSE_STATUS.AWAITING_INSPECTION)} style={{ padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, width: '100%' }}>
              Mark Awaiting Inspection
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
