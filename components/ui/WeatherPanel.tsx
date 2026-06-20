import React from 'react';
import { HUB } from '../HubLayout.tsx';

export function WeatherPanel({ engine }) {
  const isWet = engine.isWet;
  
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Track Temp</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: isWet ? '#3b82f6' : '#ef4444' }}>
            {isWet ? '22°C' : '41°C'}
          </div>
        </div>
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Air Temp</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
            {isWet ? '18°C' : '28°C'}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Rain Probability</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: isWet ? '85%' : '15%', height: '100%', backgroundColor: '#3b82f6', transition: 'width 1s ease' }}></div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{isWet ? '85%' : '15%'}</span>
        </div>
      </div>

      <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '12px' }}>Forecast Timeline</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['+0m', '+15m', '+30m', '+45m'].map((time, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: HUB.textMuted }}>{time}</span>
              <div style={{ 
                width: '24px', height: '24px', borderRadius: '50%', 
                backgroundColor: isWet ? '#3b82f6' : (idx > 1 && Math.random() > 0.7 ? '#3b82f6' : '#facc15'),
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
