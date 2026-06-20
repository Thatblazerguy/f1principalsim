import React, { useState } from 'react';
import { HUB, glassCard, sectionLabel, actionBtn } from '../components/HubLayout.tsx';
import { TrackMap } from '../components/ui/TrackMap.tsx';

export function RaceReplay({ race, onClose }) {
  const replay = race.replayData;
  if (!replay || !replay.snapshots || replay.snapshots.length === 0) {
    return (
      <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>No Replay Data Available</h2>
        <p style={{ color: HUB.textMuted }}>This race was simulated before the replay system was implemented.</p>
        <button onClick={onClose} style={actionBtn()}>Back to History</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          {sectionLabel('RACE ARCHIVE')}
          <h2 style={{ margin: 0, fontSize: '24px', fontFamily: HUB.fontBold, color: '#fff', textTransform: 'uppercase' }}>
            {race.name} Replay
          </h2>
        </div>
        <button onClick={onClose} style={{ ...actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.borderMid}` }) }}>
          Exit Replay
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
              <span>LAP 1</span>
              <span style={{ color: '#fff' }}>LAP {snapshot.lap}</span>
              <span>LAP {replay.totalLaps}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max={replay.snapshots.length - 1} 
              value={snapIndex} 
              onChange={handleSlider}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Replay Standings */}
        <div style={{ ...glassCard({ padding: 0 }), overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, backgroundColor: 'rgba(15,15,15,0.95)', zIndex: 10 }}>
            <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>Standings - Lap {snapshot.lap}</h3>
          </div>
          <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <tbody>
              {mappedCars.sort((a,b) => {
                 if (a.retired !== b.retired) return a.retired ? 1 : -1;
                 return b.distance - a.distance;
              }).map((car, i) => (
                <tr key={car.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px', color: HUB.textMuted, fontWeight: 'bold' }}>{i + 1}</td>
                  <td style={{ padding: '8px', color: '#fff', fontWeight: 'bold' }}>{car.id}</td>
                  <td style={{ padding: '8px', color: car.retired ? '#ef4444' : HUB.textMuted }}>
                    {car.retired ? 'OUT' : car.pitStopStatus !== 'None' ? 'PIT' : ''}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ color: car.tireCompound === 'Soft' ? '#ef4444' : car.tireCompound === 'Medium' ? '#facc15' : '#fff' }}>
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
