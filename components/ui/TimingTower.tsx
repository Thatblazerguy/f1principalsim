import React, { useState } from 'react';
import { HUB } from '../HubLayout.tsx';
import { ChevronUp, ChevronDown } from 'lucide-react';

const TIRE_COLORS: Record<string, string> = {
  Soft: HUB.tyre.soft, Medium: HUB.tyre.medium, Hard: HUB.tyre.hard, Intermediate: HUB.tyre.inter, Wet: HUB.tyre.wet
};

export function TimingTower({ cars }) {
  const [showPosChange, setShowPosChange] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', backgroundColor: 'rgba(17,17,19,0.88)', border: `1px solid ${HUB.border}`, borderRadius: '12px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', padding: '8px 12px', borderBottom: `1px solid ${HUB.border}`, position: 'sticky', top: 0, backgroundColor: HUB.surface, zIndex: 10, fontSize: '11px', color: HUB.textFaint, fontWeight: 400, fontFamily: HUB.fontRegular }}>
        <div 
          style={{ width: '32px', textAlign: 'center', cursor: 'pointer', color: showPosChange ? HUB.textPrimary : HUB.textFaint, transition: 'color 0.2s' }}
          onClick={() => setShowPosChange(!showPosChange)}
          title="Toggle Position Change"
        >
          {showPosChange ? 'CHG' : 'Pos'}
        </div>
        <div style={{ flex: 1, paddingLeft: '12px' }}>Driver</div>
        <div style={{ width: '60px', textAlign: 'right' }}>Interval</div>
        <div style={{ width: '30px', textAlign: 'center', marginLeft: '8px' }}>Tyre</div>
        <div style={{ width: '20px', textAlign: 'center' }}>Pits</div>
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
               // Both finished: real time gap. Otherwise convert distance using this car's lap pace.
               const finishedBoth = car.totalLaps && carAhead.distance >= car.totalLaps && car.distance >= car.totalLaps;
               const distBehind = Math.max(0, carAhead.distance - car.distance);
               const lapPace = car.targetLapTime || car.lastLapTime || 90;
               const timeBehind = finishedBoth ? Math.max(0, car.totalTime - carAhead.totalTime) : distBehind * lapPace;
               interval = `+${timeBehind.toFixed(3)}`;
            } else {
               interval = "OUT";
            }
          }

          if (car.pitStopStatus === "Pitting" || car.pitStopStatus === "InLap") {
            interval = "PIT";
          }

          const teamColor = car.team.color || HUB.accent;

          const posChange = car.gridPos !== undefined ? (car.gridPos - pos) : 0;

          return (
            <div 
              key={car.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                height: '32px', padding: '0 12px',
                borderBottom: `1px solid ${HUB.border}`,
                backgroundColor: isPlayer ? HUB.raised : 'transparent',
                transition: 'background-color 0.2s',
                opacity: car.retired ? 0.5 : 1
              }}
            >
              {/* Team Color Strip */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', backgroundColor: teamColor }}></div>
              
              {/* Position / Change */}
              <div style={{ width: '32px', textAlign: 'center', fontFamily: HUB.fontMono, fontSize: '12px', fontWeight: 400, color: isPlayer ? HUB.textPrimary : HUB.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                {showPosChange ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: posChange > 0 ? HUB.positive : posChange < 0 ? HUB.negative : HUB.textMuted }}>
                    {posChange > 0 ? <ChevronUp size={12} strokeWidth={2} /> : posChange < 0 ? <ChevronDown size={12} strokeWidth={2} /> : <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.2)'}}>-</span>}
                    {Math.abs(posChange) > 0 ? Math.abs(posChange) : ''}
                  </div>
                ) : (
                  pos
                )}
              </div>
              
              {/* DRIVER */}
              <div style={{ flex: 1, paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: '#fff' }}>
                  {car.driver.name.substring(0,3).toUpperCase()}
                </span>
                {isPlayer && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: HUB.accent }}></div>}
              </div>
              
              {/* INTERVAL */}
              <div style={{ width: '60px', textAlign: 'right', fontSize: '11px', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', color: interval === 'PIT' ? HUB.warning : interval === 'OUT' ? HUB.negative : HUB.textMuted }}>
                {interval}
              </div>
              
              {/* TYRE */}
              <div style={{ width: '30px', textAlign: 'center', marginLeft: '8px' }}>
                 <div style={{ 
                   display: 'inline-block',
                   width: '16px', height: '16px', 
                   borderRadius: '50%', 
                   border: `2px solid ${TIRE_COLORS[car.tireCompound]}`,
                   color: HUB.textPrimary,
                   fontSize: '11px',
                   lineHeight: '12px',
                   fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif",
                   textAlign: 'center',
                   backgroundColor: 'transparent'
                 }}>
                   {car.tireCompound.substring(0,1)}
                 </div>
              </div>
              
              {/* PITS */}
              <div style={{ width: '20px', textAlign: 'center', fontSize: '11px', color: HUB.textMuted, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>
                {car.stops ?? car.pitStops ?? 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
