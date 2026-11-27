import React from 'react';
import { HUB, glassCard, tyreDot } from '../HubLayout.tsx';

const th = { padding: '8px 4px', color: HUB.textFaint, fontWeight: 400, fontFamily: HUB.fontRegular, whiteSpace: 'nowrap' as const };
const td = { padding: '6px 4px', color: HUB.textPrimary, whiteSpace: 'nowrap' as const };
const fig = { ...td, fontFamily: HUB.fontMono };

export function TelemetryCenter({ engine }) {
  // We'll show all cars, but highlight player
  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: HUB.surface, borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
      <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, backgroundColor: HUB.surface, zIndex: 10, borderBottom: `1px solid ${HUB.borderMid}` }}>
          <tr>
            <th style={th}>P</th>
            <th style={th}>Driver</th>
            <th style={th}>Last lap</th>
            <th style={th}>Best lap</th>
            <th style={th}>Tyre (wear)</th>
            <th style={th}>Fuel</th>
            <th style={th}>ERS</th>
            <th style={th}>Temp</th>
            <th style={th}>Health</th>
          </tr>
        </thead>
        <tbody>
          {engine.cars.map((car, i) => {
            if (car.retired) return null;
            const isPlayer = car.isPlayer;
            const formatTime = (t) => t > 0 && t < 999 ? `${Math.floor(t/60)}:${(t%60).toFixed(3).padStart(6, '0')}` : '—';

            return (
              <tr key={car.id} style={{ borderBottom: `1px solid ${HUB.border}`, backgroundColor: isPlayer ? HUB.accentSoft : 'transparent' }}>
                <td style={fig}>{i + 1}</td>
                <td style={{ ...td, fontFamily: HUB.fontBold }}>{car.driver.name.split(' ').pop()}</td>
                <td style={fig}>{formatTime(car.lastLapTime)}</td>
                <td style={fig}>{formatTime(car.bestLapTime)}</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={car.tireCompound}>
                    {tyreDot(car.tireCompound === 'Intermediate' ? 'inter' : car.tireCompound)}
                    {car.tireCompound.substring(0,1)}
                  </span>
                  <span style={{ marginLeft: '4px', color: car.tireWear > 75 ? HUB.negative : HUB.textMuted }}>
                    ({Math.floor(car.tireWear)}%)
                  </span>
                </td>
                <td style={{ ...td, color: car.fuel < 10 ? HUB.negative : HUB.textPrimary }}>{Math.floor(car.fuel)}kg</td>
                <td style={{ ...td, color: car.ers < 20 ? HUB.negative : HUB.textPrimary }}>{Math.floor(car.ers)}%</td>
                <td style={{ ...td, color: car.engineTemp > 110 ? HUB.negative : HUB.textPrimary }}>{Math.floor(car.engineTemp)}°C</td>
                <td style={{ ...td, color: car.reliability < 50 ? HUB.negative : HUB.textPrimary }}>{Math.floor(car.reliability)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
