import React, { useState } from 'react';
import { getDriverHeadshotUrl } from "../data/drivers.js";
import { HUB, glassCard, statCell, actionBtn, sectionLabel, pill } from '../components/HubLayout.tsx';
import { AnimatedNumber, AnimatedBar, SlideUp } from '../components/ui/motion.tsx';

// Reusable Radar Chart
export const RadarChart = ({ pace, quali, racecraft, consistency, color = HUB.accent }) => {
  const size = 120;
  const center = size / 2;
  const maxRadius = size / 2 - 10;
  
  const getPoint = (val, angle) => {
    const r = (Math.max(0, Math.min(100, val)) / 100) * maxRadius;
    const rad = (angle - 90) * (Math.PI / 180);
    return `${center + r * Math.cos(rad)},${center + r * Math.sin(rad)}`;
  };

  const points = `${getPoint(pace, 0)} ${getPoint(quali, 90)} ${getPoint(racecraft, 180)} ${getPoint(consistency, 270)}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={`${center},10 ${size-10},${center} ${center},${size-10} 10,${center}`} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <polygon points={`${center},30 ${size-30},${center} ${center},${size-30} 30,${center}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        <line x1={center} y1="10" x2={center} y2={size-10} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="10" y1={center} x2={size-10} y2={center} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <polygon points={points} fill={`${color}40`} stroke={color} strokeWidth="2" style={{ transition: 'all 0.5s ease' }}/>
      </svg>
      <span style={{ position:'absolute', top: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>PAC</span>
      <span style={{ position:'absolute', right: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>QUA</span>
      <span style={{ position:'absolute', bottom: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>RAC</span>
      <span style={{ position:'absolute', left: 0, fontSize: '8px', color: HUB.textMuted, fontWeight: 700 }}>CON</span>
    </div>
  );
};

export function DriverComparison({ d1, d2, onClose, onConfirm, confirmText = "Confirm", isPromotion = false }) {
  const compare = (v1, v2) => {
    if (v1 > v2) return { d1Color: '#10b981', d2Color: HUB.textMuted, d1Weight: 800, d2Weight: 400, icon1: '▲', icon2: '▼' };
    if (v2 > v1) return { d1Color: HUB.textMuted, d2Color: '#10b981', d1Weight: 400, d2Weight: 800, icon1: '▼', icon2: '▲' };
    return { d1Color: '#fff', d2Color: '#fff', d1Weight: 700, d2Weight: 700, icon1: '▬', icon2: '▬' };
  };

  const metrics = [
    { label: 'Overall Rating', v1: d1.currentRating(), v2: d2.currentRating() },
    { label: 'Pace', v1: d1.pace, v2: d2.pace },
    { label: 'Qualifying', v1: d1.quali, v2: d2.quali },
    { label: 'Racecraft', v1: d1.racecraft, v2: d2.racecraft },
    { label: 'Consistency', v1: d1.consistency, v2: d2.consistency },
    { label: 'Potential Ceiling', v1: d1.potentialCeiling || d1.currentRating(), v2: d2.potentialCeiling || d2.currentRating() },
    { label: 'Salary (M)', v1: d1.salary, v2: d2.salary, prefix: '$' },
    { label: 'Market Value (M)', v1: d1.market, v2: d2.market, prefix: '$' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <SlideUp>
        <div style={{ ...glassCard({ padding: '0', maxWidth: '800px', width: '100%' }), overflow: 'hidden' }}>
          
          <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {sectionLabel(isPromotion ? 'Promotion Analysis' : 'Driver Comparison')}
              <h3 style={{ fontSize: '20px', fontFamily: HUB.fontWide, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
                {isPromotion ? 'Seat Allocation' : 'Head-to-Head'}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: '24px' }}>&times;</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: '24px', padding: '32px' }}>
            {/* Driver 1 */}
            <div style={{ textAlign: 'center' }}>
              <img src={getDriverHeadshotUrl(d1)} alt={d1.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isPromotion ? HUB.borderMid : HUB.accent}`, marginBottom: '12px' }} />
              <h4 style={{ fontSize: '18px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 4px' }}>{d1.name.toUpperCase()}</h4>
              <span style={{ fontSize: '11px', color: HUB.textMuted }}>{isPromotion ? 'Current Driver' : d1.roleLabel || 'Driver 1'}</span>
            </div>

            {/* Radars superimposed or side-by-side? Let's do superimposed for comparison */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
               <RadarChart pace={d1.pace} quali={d1.quali} racecraft={d1.racecraft} consistency={d1.consistency} color={isPromotion ? "#94A3B8" : HUB.accent} />
               <div style={{ position: 'absolute' }}>
                 <RadarChart pace={d2.pace} quali={d2.quali} racecraft={d2.racecraft} consistency={d2.consistency} color={isPromotion ? HUB.accent : "#3b82f6"} />
               </div>
            </div>

            {/* Driver 2 */}
            <div style={{ textAlign: 'center' }}>
              <img src={getDriverHeadshotUrl(d2)} alt={d2.name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${isPromotion ? HUB.accent : '#3b82f6'}`, marginBottom: '12px' }} />
              <h4 style={{ fontSize: '18px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 4px' }}>{d2.name.toUpperCase()}</h4>
              <span style={{ fontSize: '11px', color: HUB.textMuted }}>{isPromotion ? 'Promoted Driver' : d2.roleLabel || 'Driver 2'}</span>
            </div>
          </div>

          <div style={{ padding: '0 32px 32px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
              {metrics.map((m, i) => {
                const diff = compare(m.v1, m.v2);
                return (
                  <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', padding: '12px 24px', borderBottom: i < metrics.length - 1 ? `1px solid ${HUB.border}` : 'none', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, color: diff.d1Color, fontWeight: diff.d1Weight }}>{m.prefix || ''}{m.v1}</span>
                      <span style={{ fontSize: '10px', color: diff.d1Color }}>{diff.icon1}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                    </div>
                    <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: diff.d2Color }}>{diff.icon2}</span>
                      <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, color: diff.d2Color, fontWeight: diff.d2Weight }}>{m.prefix || ''}{m.v2}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {onConfirm && (
            <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.3)', borderTop: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button onClick={onClose} style={{ ...actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.borderMid}` }) }}>Cancel</button>
              <button onClick={onConfirm} style={{ ...actionBtn() }}>{confirmText}</button>
            </div>
          )}
        </div>
      </SlideUp>
    </div>
  );
}
