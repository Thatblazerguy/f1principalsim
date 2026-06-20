import React from 'react';
import { HUB, glassCard } from '../HubLayout.tsx';

export function TelemetryCenter({ engine }) {
  // We'll show all cars, but highlight player
  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'rgba(10,10,10,0.8)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <table style={{ width: '100%', fontSize: '10px', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#111', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <tr>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>P</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>DRIVER</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>LAST LAP</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>BEST LAP</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>TYRE (WEAR)</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>FUEL</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>ERS</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>TEMP</th>
            <th style={{ padding: '8px 4px', color: HUB.textMuted }}>HEALTH</th>
          </tr>
        </thead>
        <tbody>
          {engine.cars.map((car, i) => {
            if (car.retired) return null;
            const isPlayer = car.isPlayer;
            const formatTime = (t) => t > 0 && t < 999 ? `${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6, '0')}` : '—';
            
            return (
              <tr key={car.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: isPlayer ? 'rgba(225,6,0,0.1)' : 'transparent' }}>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>{i + 1}</td>
                <td style={{ padding: '4px', fontWeight: 'bold' }}>{car.driver.name.split(' ').pop()}</td>
                <td style={{ padding: '4px', fontFamily: HUB.fontMono }}>{formatTime(car.lastLapTime)}</td>
                <td style={{ padding: '4px', fontFamily: HUB.fontMono, color: '#10b981' }}>{formatTime(car.bestLapTime)}</td>
                <td style={{ padding: '4px' }}>
                  <span style={{ color: car.tireCompound === 'Soft' ? '#ef4444' : car.tireCompound === 'Medium' ? '#facc15' : '#fff' }}>
                    {car.tireCompound.substring(0,1)}
                  </span>
                  <span style={{ marginLeft: '4px', color: car.tireWear > 75 ? '#ef4444' : HUB.textMuted }}>
                    ({Math.floor(car.tireWear)}%)
                  </span>
                </td>
                <td style={{ padding: '4px', color: car.fuel < 10 ? '#ef4444' : '#fff' }}>{Math.floor(car.fuel)}kg</td>
                <td style={{ padding: '4px', color: car.ers < 20 ? '#ef4444' : car.ers > 80 ? '#10b981' : '#fff' }}>{Math.floor(car.ers)}%</td>
                <td style={{ padding: '4px', color: car.engineTemp > 110 ? '#ef4444' : '#fff' }}>{Math.floor(car.engineTemp)}°C</td>
                <td style={{ padding: '4px', color: car.reliability < 50 ? '#ef4444' : '#fff' }}>{Math.floor(car.reliability)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
