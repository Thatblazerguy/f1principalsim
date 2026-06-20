import React from 'react';
import { HUB, glassCard } from '../HubLayout.tsx';
import { Mic, Headphones } from 'lucide-react';

export function CommsPanel({ engine }) {
  const comms = engine.comms || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ margin: 0, fontSize: '10px', color: '#fff', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Headphones size={12} color={HUB.accent} />
          Driver Radio & Engineer
        </h3>
      </div>
      <div style={{ padding: '12px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '8px' }}>
        {comms.length === 0 && (
          <p style={{ color: HUB.textMuted, fontSize: '10px', fontStyle: 'italic', textAlign: 'center' }}>Radio silence...</p>
        )}
        {comms.map((c, i) => {
          const isEngineer = c.sender === "Engineer";
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', opacity: i === 0 ? 1 : 0.7 }}>
              <div style={{ marginTop: '2px' }}>
                {isEngineer ? <Headphones size={12} color={HUB.textMuted} /> : <Mic size={12} color={HUB.accent} />}
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: isEngineer ? HUB.textMuted : HUB.accent, marginRight: '6px' }}>
                  {c.sender}
                </span>
                <span style={{ fontSize: '12px', color: '#fff' }}>
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
