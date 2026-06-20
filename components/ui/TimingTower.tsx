import React, { useState } from 'react';
import { HUB } from '../HubLayout.tsx';
import { ChevronUp, ChevronDown } from 'lucide-react';

const TIRE_COLORS = {
  "Soft": "#ef4444",
  "Medium": "#facc15",
  "Hard": "#ffffff",
  "Intermediate": "#22c55e",
  "Wet": "#3b82f6"
};

export function TimingTower({ cars }) {
  const [showPosChange, setShowPosChange] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, backgroundColor: 'rgba(10,10,10,0.95)', zIndex: 10, fontSize: '9px', color: HUB.textMuted, fontWeight: 'bold', letterSpacing: '0.05em' }}>
        <div 
          style={{ width: '32px', textAlign: 'center', cursor: 'pointer', color: showPosChange ? '#10b981' : HUB.textMuted, transition: 'color 0.2s' }}
          onClick={() => setShowPosChange(!showPosChange)}
          title="Toggle Position Change"
        >
          {showPosChange ? 'CHG' : 'POS'}
        </div>
        <div style={{ flex: 1, paddingLeft: '12px' }}>DRIVER</div>
        <div style={{ width: '60px', textAlign: 'right' }}>INTERVAL</div>
        <div style={{ width: '30px', textAlign: 'center', marginLeft: '8px' }}>TYR</div>
        <div style={{ width: '20px', textAlign: 'center' }}>PIT</div>
      </div>
      
      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cars.map((car, idx) => {
          const isPlayer = car.isPlayer;
          const pos = idx + 1;
          
          let interval = "";
          if (car.retired) {
            interval = "OUT";
          } else if (idx === 0) {
            interval = "Leader";
          } else {
            const carAhead = cars[idx - 1];
            if (carAhead && !carAhead.retired) {
               const distBehind = carAhead.distance - car.distance;
               // Extrapolate distance to time using leader's speed or track base time. 
               // 1 lap = ~90 seconds. So time = dist * 90.
               const timeBehind = distBehind * 90; 
               interval = `+${timeBehind.toFixed(3)}`;
            } else {
               interval = "OUT";
            }
          }

          if (car.pitStopStatus === "Pitting" || car.pitStopStatus === "InLap") {
            interval = "PIT";
          }

          const teamColor = car.team.color || HUB.accent;

          return (
            <div key={car.id} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '4px 12px', 
              borderBottom: '1px solid rgba(255,255,255,0.02)',
              backgroundColor: isPlayer ? 'rgba(255,255,255,0.05)' : 'transparent',
              position: 'relative'
            }}>
              {/* Team Color Strip */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', backgroundColor: teamColor }}></div>
              
              {/* POS / CHG */}
              <div style={{ width: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                {showPosChange ? (
                   (() => {
                     const change = car.gridPos - pos;
                     if (change > 0) return <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', fontSize: '11px' }}><ChevronUp size={12} strokeWidth={3}/>{change}</span>;
                     if (change < 0) return <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', fontSize: '11px' }}><ChevronDown size={12} strokeWidth={3}/>{Math.abs(change)}</span>;
                     return <span style={{ color: 'rgba(255,255,255,0.2)' }}>-</span>;
                   })()
                ) : (
                  pos
                )}
              </div>
              
              {/* DRIVER */}
              <div style={{ flex: 1, paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.05em' }}>
                  {car.driver.name.substring(0,3).toUpperCase()}
                </span>
                {isPlayer && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: HUB.accent }}></div>}
              </div>
              
              {/* INTERVAL */}
              <div style={{ width: '60px', textAlign: 'right', fontSize: '11px', fontFamily: HUB.fontMono, color: interval === 'PIT' ? '#facc15' : interval === 'OUT' ? '#ef4444' : (idx === 0 ? HUB.accent : '#ddd') }}>
                {interval}
              </div>
              
              {/* TYRE */}
              <div style={{ width: '30px', textAlign: 'center', marginLeft: '8px' }}>
                 <div style={{ 
                   display: 'inline-block',
                   width: '16px', height: '16px', 
                   borderRadius: '50%', 
                   border: `2px solid ${TIRE_COLORS[car.tireCompound]}`,
                   color: '#fff',
                   fontSize: '9px',
                   lineHeight: '12px',
                   fontWeight: 'bold',
                   textAlign: 'center',
                   backgroundColor: 'transparent'
                 }}>
                   {car.tireCompound.substring(0,1)}
                 </div>
              </div>
              
              {/* PITS */}
              <div style={{ width: '20px', textAlign: 'center', fontSize: '10px', color: HUB.textMuted, fontWeight: 'bold' }}>
                {car.pitStops || 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
