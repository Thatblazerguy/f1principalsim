import React, { useState } from 'react';
import { FileText, Info, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import { fiaCareer, saveFIACareer, setFIACareer, DEFAULT_REGULATIONS } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

function RegSection({ title, children }) {
  return (
    <div style={{ ...glassCard({ padding: '24px' }), marginBottom: 16 }}>
      <h3 style={{ fontFamily: HUB.fontWide, fontSize: 14, color: '#fff', margin: '0 0 20px', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function NumberSetting({ setting, path, value, onChange }: { setting: any; path: string; value: number; onChange: (path: string, v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{setting.label}</span>
          {!setting.supported && (
            <span style={{ fontFamily: HUB.fontBold, fontSize: 9, color: '#F59E0B', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', letterSpacing: '0.05em' }}>
              DISPLAY ONLY
            </span>
          )}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>
          Range: {setting.min}–{setting.max} {setting.unit}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.unit?.includes('M') ? 5 : 1}
          value={value}
          onChange={e => onChange(path, +e.target.value)}
          style={{ width: 120 }}
          disabled={!setting.supported}
        />
        <div style={{
          minWidth: 70, textAlign: 'right',
          fontFamily: HUB.fontBold, fontSize: 14, color: setting.supported ? '#fff' : HUB.textMuted,
        }}>
          {value} {setting.unit}
        </div>
      </div>
    </div>
  );
}

function BoolSetting({ setting, path, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{setting.label}</span>
          {!setting.supported && (
            <span style={{ fontFamily: HUB.fontBold, fontSize: 9, color: '#F59E0B', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)' }}>DISPLAY ONLY</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(path, !value)}
        disabled={!setting.supported}
        style={{
          padding: '6px 16px', borderRadius: 999, fontFamily: HUB.fontBold, fontSize: 11,
          background: value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${value ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: value ? FIA.green : HUB.textMuted, cursor: setting.supported ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
      >
        {value ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

function PointsEditor({ points, onChange }) {
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, marginBottom: 10 }}>Points Allocation (P1–P10)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(points || []).map((pts, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 9, color: HUB.textMuted }}>P{i + 1}</div>
            <input
              type="number"
              min="0"
              max="50"
              value={pts}
              onChange={e => {
                const updated = [...points];
                updated[i] = +e.target.value;
                onChange(updated);
              }}
              style={{
                width: 40, textAlign: 'center', padding: '6px 4px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#fff', fontFamily: HUB.fontBold, fontSize: 12, outline: 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FIARegulationsScreen({ appRoot }) {
  const career = fiaCareer!;
  const [regs, setRegs] = useState(() => JSON.parse(JSON.stringify(career.regulations || DEFAULT_REGULATIONS)));
  const [activeTab, setActiveTab] = useState<'technical' | 'sporting' | 'financial'>('technical');
  const [saved, setSaved] = useState(false);
  const [notification, setNotification] = useState('');

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleChange = (path: string, value: any) => {
    const parts = path.split('.');
    setRegs(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      let cur = updated;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]].value = value;
      return updated;
    });
  };

  const handleSave = () => {
    const updated = { ...career, regulations: regs };
    setFIACareer(updated);
    saveFIACareer();
    setSaved(true);
    showNotif('Regulations saved and will apply from next season.');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRegs(JSON.parse(JSON.stringify(DEFAULT_REGULATIONS)));
    showNotif('Regulations reset to defaults.');
  };

  const tabs = [
    { id: 'technical', label: 'Technical', icon: <FileText size={14} /> },
    { id: 'sporting', label: 'Sporting', icon: <TrendingUp size={14} /> },
    { id: 'financial', label: 'Financial', icon: <Info size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
          padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green,
        }}>
          {notification}
        </div>
      )}

      <main style={{ flex: 1, padding: '40px 64px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 8, padding: 0 }}>
              ← FIA Dashboard
            </button>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>FIA Regulations</div>
            <h1 style={{ fontFamily: HUB.fontWide, fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Regulations Editor</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={{ padding: '10px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}>
              Reset to Defaults
            </button>
            <button onClick={handleSave} style={{ ...actionBtn({ padding: '10px 24px', fontSize: 11 }), display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={13} /> {saved ? '✓ Saved' : 'Save Regulations'}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, marginBottom: 24 }}>
          <Info size={14} color={FIA.blue} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>
            Settings marked <strong style={{ color: '#F59E0B' }}>DISPLAY ONLY</strong> are recorded but not yet supported by the race simulation engine. Supported settings are applied to the next approved season.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 10, width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 8,
                background: activeTab === tab.id ? 'rgba(225,6,0,0.12)' : 'transparent',
                border: activeTab === tab.id ? `1px solid rgba(225,6,0,0.3)` : '1px solid transparent',
                color: activeTab === tab.id ? '#fff' : HUB.textMuted,
                cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 12, transition: 'all 0.15s',
              }}
            >
              <span style={{ color: activeTab === tab.id ? FIA.accent : HUB.textMuted }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Technical Tab */}
        {activeTab === 'technical' && (
          <RegSection title="Technical Regulations">
            {Object.entries(regs.technical).map(([key, setting]: [string, any]) => (
              typeof setting.value === 'number' ? (
                <NumberSetting key={key} setting={setting} path={`technical.${key}`} value={setting.value} onChange={handleChange} />
              ) : (
                <BoolSetting key={key} setting={setting} path={`technical.${key}`} value={setting.value} onChange={handleChange} />
              )
            ))}
          </RegSection>
        )}

        {/* Sporting Tab */}
        {activeTab === 'sporting' && (
          <div>
            <RegSection title="Points & Scoring">
              <PointsEditor
                points={regs.sporting.pointsSystem.value}
                onChange={pts => setRegs(prev => {
                  const u = JSON.parse(JSON.stringify(prev));
                  u.sporting.pointsSystem.value = pts;
                  return u;
                })}
              />
              <BoolSetting setting={regs.sporting.fastestLapPoint} path="sporting.fastestLapPoint" value={regs.sporting.fastestLapPoint.value} onChange={handleChange} />
            </RegSection>
            <RegSection title="Calendar & Format">
              {['maxCalendarSize', 'minCalendarSize', 'maxSprintWeekends', 'maxGridSize'].map(key => (
                <NumberSetting
                  key={key}
                  setting={regs.sporting[key]}
                  path={`sporting.${key}`}
                  value={regs.sporting[key].value}
                  onChange={handleChange}
                />
              ))}
            </RegSection>
          </div>
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <RegSection title="Financial Regulations">
            {Object.entries(regs.financial).map(([key, setting]: [string, any]) => (
              typeof setting.value === 'number' ? (
                <NumberSetting key={key} setting={setting} path={`financial.${key}`} value={setting.value} onChange={handleChange} />
              ) : (
                <BoolSetting key={key} setting={setting} path={`financial.${key}`} value={setting.value} onChange={handleChange} />
              )
            ))}
          </RegSection>
        )}
      </main>
    </div>
  );
}

export function renderFIARegulations(root: HTMLElement) {
  renderToAppRoot(root, <FIARegulationsScreen appRoot={root} />);
}
