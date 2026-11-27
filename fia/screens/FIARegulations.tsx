import React, { useState } from 'react';
import { FileText, Info, CheckCircle, AlertTriangle, TrendingUp, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle } from '../../components/HubLayout.tsx';
import { fiaCareer, saveFIACareer, setFIACareer, DEFAULT_REGULATIONS } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

function RegSection({ title, children }) {
  return (
    <div style={{ ...glassCard({ padding: '24px' }), marginBottom: 16 }}>
      <h3 style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, margin: '0 0 16px' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function NumberSetting({ setting, path, value, onChange }: { setting: any; path: string; value: number; onChange: (path: string, v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: HUB.raised, borderRadius: 8, gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>{setting.label}</span>
          {!setting.supported && (
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint, padding: '2px 6px', borderRadius: 6, border: `1px solid ${HUB.border}` }}>
              Display only
            </span>
          )}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>
          Range {setting.min}–{setting.max} {setting.unit}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.unit?.includes('M') ? 5 : 1}
          value={value}
          onChange={e => onChange(path, +e.target.value)}
          style={{ width: 120, accentColor: HUB.accent }}
          disabled={!setting.supported}
        />
        <div style={{
          minWidth: 70, textAlign: 'right',
          fontFamily: HUB.fontBold, fontSize: 14, color: setting.supported ? HUB.textPrimary : HUB.textMuted
        }}>
          {value} {setting.unit}
        </div>
      </div>
    </div>
  );
}

function BoolSetting({ setting, path, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: HUB.raised, borderRadius: 8 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>{setting.label}</span>
          {!setting.supported && (
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint, padding: '2px 6px', borderRadius: 6, border: `1px solid ${HUB.border}` }}>Display only</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(path, !value)}
        disabled={!setting.supported}
        style={{
          height: 32, padding: '0 16px', borderRadius: '8px', fontFamily: HUB.fontBold, fontSize: 12,
          background: value ? HUB.accentSoft : HUB.surface,
          border: `1px solid ${value ? 'rgba(225,6,0,0.4)' : HUB.border}`,
          color: value ? HUB.textPrimary : HUB.textMuted, cursor: setting.supported ? 'pointer' : 'default',
          transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
        }}
      >
        {value ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

function PointsEditor({ points, onChange }) {
  return (
    <div style={{ padding: '12px 16px', background: HUB.raised, borderRadius: 8 }}>
      <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginBottom: 8 }}>Points allocation (P1–P10)</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(points || []).map((pts, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>P{i + 1}</div>
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
                background: HUB.surface, border: `1px solid ${HUB.border}`,
                borderRadius: 6, color: HUB.textPrimary, fontFamily: HUB.fontBold, fontSize: 12, outline: 'none'
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
    showNotif('Regulations saved · they apply from next season');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRegs(JSON.parse(JSON.stringify(DEFAULT_REGULATIONS)));
    showNotif('Regulations reset to defaults');
  };

  const tabs = [
    { id: 'technical', label: 'Technical', icon: <FileText size={16} strokeWidth={1.5} /> },
    { id: 'sporting', label: 'Sporting', icon: <TrendingUp size={16} strokeWidth={1.5} /> },
    { id: 'financial', label: 'Financial', icon: <Info size={16} strokeWidth={1.5} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          background: HUB.raised, border: `1px solid ${HUB.borderMid}`,
          padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary
        }}>
          {notification}
        </div>
      )}

      <main style={{ flex: 1, padding: '40px 64px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 8, marginLeft: -12 })}>
              <ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard
            </button>
            {pageTitle('Regulations')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} className={btnClass('danger')} style={btn('danger', 'md')}>
              Reset to defaults
            </button>
            <button onClick={handleSave} className={btnClass('primary')} style={btn('primary', 'md')}>
              <CheckCircle size={16} strokeWidth={1.5} />{saved ? 'Saved' : 'Save regulations'}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: 8, marginBottom: 24 }}>
          <Info size={16} strokeWidth={1.5} color={HUB.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>
            Settings marked <strong style={{ color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>Display only</strong> are recorded but not yet supported by the race simulation engine. Supported settings are applied to the next approved season.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: 10, width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 20px', borderRadius: 8,
                background: activeTab === tab.id ? HUB.raised : 'transparent',
                border: '1px solid transparent',
                color: activeTab === tab.id ? HUB.textPrimary : HUB.textMuted,
                cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 12, transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
              }}
            >
              <span style={{ display: 'flex', color: activeTab === tab.id ? HUB.textPrimary : HUB.textMuted }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Technical Tab */}
        {activeTab === 'technical' && (
          <RegSection title="Technical regulations">
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
            <RegSection title="Points & scoring">
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
            <RegSection title="Calendar & format">
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
          <RegSection title="Financial regulations">
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
