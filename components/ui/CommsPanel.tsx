import React from 'react';
import { HUB, glassCard } from '../HubLayout.tsx';
import { Mic, Headphones } from 'lucide-react';

export function CommsPanel({ engine }) {
  const comms = engine.comms || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${HUB.border}` }}>
        <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color: HUB.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Headphones size={14} strokeWidth={1.5} color={HUB.textMuted} />
          Driver and engineer radio
        </h3>
      </div>
      <div style={{ padding: '12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '8px' }}>
        {comms.length === 0 && (
          <p style={{ margin: 0, color: HUB.textFaint, fontSize: '12px', textAlign: 'center' }}>No radio messages yet</p>
        )}
        {comms.map((c, i) => {
          const isEngineer = c.sender === "Engineer";
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', opacity: i === 0 ? 1 : 0.7 }}>
              <div style={{ marginTop: '2px' }}>
                {isEngineer
                  ? <Headphones size={12} strokeWidth={1.5} color={HUB.textFaint} />
                  : <Mic size={12} strokeWidth={1.5} color={HUB.textMuted} />}
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 400, fontFamily: HUB.fontBold, color: isEngineer ? HUB.textMuted : HUB.textPrimary, marginRight: '6px' }}>
                  {c.sender}
                </span>
                <span style={{ fontSize: '12px', color: HUB.textPrimary }}>
                  "{c.msg}"
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
