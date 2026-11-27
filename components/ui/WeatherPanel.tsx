import React from 'react';
import { Sun, CloudRain } from 'lucide-react';
import { HUB } from '../HubLayout.tsx';

const cell = { backgroundColor: HUB.surface, padding: '12px', borderRadius: '8px', border: `1px solid ${HUB.border}` };
const label = { fontSize: '11px', color: HUB.textFaint, fontFamily: HUB.fontRegular };
const figure = { fontSize: '24px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary };

export function WeatherPanel({ engine }) {
  const isWet = engine.isWet;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={cell}>
          <div style={{ ...label, marginBottom: '4px' }}>Track temp</div>
          <div style={figure}>{isWet ? '22°C' : '41°C'}</div>
        </div>
        <div style={cell}>
          <div style={{ ...label, marginBottom: '4px' }}>Air temp</div>
          <div style={figure}>{isWet ? '18°C' : '28°C'}</div>
        </div>
      </div>

      <div style={cell}>
        <div style={{ ...label, marginBottom: '8px' }}>Rain probability</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', backgroundColor: HUB.raised, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: isWet ? '85%' : '15%', height: '100%', backgroundColor: HUB.textMuted, transition: `width 400ms ${HUB.ease}` }}></div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{isWet ? '85%' : '15%'}</span>
        </div>
      </div>

      <div style={cell}>
        <div style={{ ...label, marginBottom: '12px' }}>Forecast</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {['+0m', '+15m', '+30m', '+45m'].map((time, idx) => {
            const rain = isWet ? true : (idx > 1 && Math.random() > 0.7);
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={label}>{time}</span>
                {rain
                  ? <CloudRain size={16} strokeWidth={1.5} color={HUB.textPrimary} aria-label="Rain" />
                  : <Sun size={16} strokeWidth={1.5} color={HUB.textMuted} aria-label="Dry" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
