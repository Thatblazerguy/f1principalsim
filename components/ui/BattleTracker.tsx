import React, { useState, useEffect } from 'react';
import { HUB } from '../HubLayout.tsx';

export function BattleTracker({ cars }) {
  const [battles, setBattles] = useState([]);

  useEffect(() => {
    // 5Hz update interval for battles so it doesn't thrash too hard
    const interval = setInterval(() => {
       if (!cars) return;
       const newBattles = [];
       // cars are sorted by distance by LiveRaceEngine
       for (let i = 1; i < cars.length; i++) {
         const car = cars[i];
         const carAhead = cars[i-1];
         
         if (car.retired || carAhead.retired) continue;
         if (car.pitStopStatus.includes("Pit") || carAhead.pitStopStatus.includes("Pit")) continue;

         const gap = carAhead.distance - car.distance;
         if (gap < 0.015 && gap > 0) { // roughly 1 second
           newBattles.push({
             pos: i,
             car: car,
             carAhead: carAhead,
             gapTime: (gap * 90).toFixed(1)
           });
         }
       }
       setBattles(newBattles);
    }, 200);

    return () => clearInterval(interval);
  }, [cars]);

  if (battles.length === 0) return null;

  return (
    <div style={{ position: 'absolute', bottom: '88px', right: '416px', display: 'flex', flexDirection: 'column-reverse', gap: '8px', zIndex: 10, pointerEvents: 'none' }}>
      {battles.slice(0, 3).map((b, idx) => (
        <div key={idx} style={{ 
          backgroundColor: 'rgba(10,10,10,0.85)', 
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: `3px solid ${HUB.accent}`,
          padding: '8px 12px',
          borderRadius: '4px',
          backdropFilter: 'blur(4px)',
          minWidth: '160px'
        }}>
          <div style={{ fontSize: '10px', color: HUB.textMuted, fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>
            Battle for P{b.pos}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>{b.carAhead.driver.name.substring(0,3).toUpperCase()}</span>
             <span style={{ fontSize: '12px', color: HUB.accent, fontFamily: HUB.fontMono, fontWeight: 'bold' }}>+{b.gapTime}</span>
             <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>{b.car.driver.name.substring(0,3).toUpperCase()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
