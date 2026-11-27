import React, { useState } from 'react';
import { HUB, glassCard, sectionLabel, btn, btnClass, tyreDot } from '../components/HubLayout.tsx';
import { ArrowLeft } from 'lucide-react';
import { TrackMap } from '../components/ui/TrackMap.tsx';

export function RaceReplay({ race, onClose }) {
  const replay = race.replayData;
  if (!replay || !replay.snapshots || replay.snapshots.length === 0) {
    return (
      <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center' }}>
        <h2 style={{ color: HUB.textPrimary, fontFamily: HUB.fontBold, fontWeight: 400, fontSize: '18px' }}>No replay data available</h2>
        <p style={{ color: HUB.textMuted }}>This race was simulated before the replay system was implemented.</p>
        <button onClick={onClose} className={btnClass('secondary')} style={btn('secondary', 'md')}><ArrowLeft size={16} strokeWidth={1.5} /> Back to history</button>
      </div>
    );
  }

  const [snapIndex, setSnapIndex] = useState(0);
  const snapshot = replay.snapshots[snapIndex];
  
  // Transform snapshot cars so TrackMap can render them
  const mappedCars = snapshot.cars.map(c => ({
    ...c,
    driver: { name: c.id },
    lapFraction: Math.max(0, c.distance % 1),
    isPlayer: false // Replay doesn't explicitly track player UI state, but it doesn't matter for rendering
  }));

  const handleSlider = (e) => {
    setSnapIndex(Number(e.target.value));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(calc(100*var(--vh)) - 100px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          {sectionLabel('Race archive')}
          <h2 style={{ margin: 0, fontSize: '24px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary }}>
            {race.name} Replay
          </h2>
        </div>
        <button onClick={onClose} className={btnClass('secondary')} style={btn('secondary', 'md')}>
          Exit replay
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Track Map */}
          <div style={{ flex: 1, position: 'relative' }}>
             <TrackMap cars={mappedCars} trackName={race.circuit} />
          </div>
          
          {/* Timeline Controls */}
          <div style={{ ...glassCard({ padding: '16px' }), display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>
              <span>Lap 1</span>
              <span style={{ color: HUB.textPrimary }}>Lap {snapshot.lap}</span>
              <span>Lap {replay.totalLaps}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max={replay.snapshots.length - 1} 
              value={snapIndex} 
              onChange={handleSlider}
              style={{ width: '100%', cursor: 'pointer', accentColor: HUB.accent }}
            />
          </div>
        </div>

        {/* Replay Standings */}
        <div style={{ ...glassCard({ padding: 0 }), overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${HUB.border}`, position: 'sticky', top: 0, backgroundColor: HUB.surface, zIndex: 10 }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Standings · Lap {snapshot.lap}</h3>
          </div>
          <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <tbody>
              {mappedCars.sort((a,b) => {
                 if (a.retired !== b.retired) return a.retired ? 1 : -1;
                 return b.distance - a.distance;
              }).map((car, i) => (
                <tr key={car.id} style={{ borderBottom: `1px solid ${HUB.border}` }}>
                  <td style={{ padding: '8px', color: HUB.textMuted, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>{i + 1}</td>
                  <td style={{ padding: '8px', color: HUB.textPrimary, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>{car.id}</td>
                  <td style={{ padding: '8px', color: car.retired ? HUB.negative : HUB.textMuted }}>
                    {car.retired ? 'Out' : car.pitStopStatus !== 'None' ? 'Pit' : ''}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: HUB.textMuted }}>
                      {car.tireCompound ? tyreDot(car.tireCompound) : null}
                      {car.tireCompound?.substring(0,1) || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
