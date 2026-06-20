import React, { useState } from 'react';
import { HUB, glassCard, actionBtn } from '../HubLayout.tsx';

export function PlayerStrategyPanel({ engine, onCommand }) {
  const playerCars = engine.cars.filter(c => c.isPlayer);

  if (playerCars.length === 0) {
    return <div style={{ padding: '16px', color: HUB.textMuted }}>No active drivers.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflowY: 'auto' }}>
      {playerCars.map(car => (
        <DriverControls key={car.id} car={car} engine={engine} onCommand={onCommand} />
      ))}
    </div>
  );
}

function DriverControls({ car, engine, onCommand }) {
  const [pitPanelOpen, setPitPanelOpen] = useState(false);
  const isRetired = car.retired;

  const handleCommand = (cmd, val) => onCommand(car.id, cmd, val);

  return (
    <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', opacity: isRetired ? 0.5 : 1 }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', backgroundColor: HUB.accent }}></div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{car.driver.name.substring(0,3).toUpperCase()}</span>
          <span style={{ fontSize: '10px', color: HUB.textMuted }}>L{car.lap}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{car.tireCompound.substring(0,1)}</span>
          <span style={{ fontSize: '10px', color: car.tireWear > 70 ? '#ef4444' : HUB.textMuted }}>Wear: {Math.round(car.tireWear)}%</span>
        </div>
      </div>

      {/* Controls */}
      {!isRetired && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* PACE */}
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Pace</div>
            <div style={{ display: 'flex', gap: '2px', backgroundColor: '#000', padding: '2px', borderRadius: '4px' }}>
              {["Attack", "Push", "Balanced", "Conserve", "Defend"].map(m => (
                <button
                  key={m}
                  onClick={() => handleCommand("MODE", m)}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase',
                    backgroundColor: car.driverMode === m ? HUB.accent : 'transparent',
                    color: car.driverMode === m ? '#fff' : HUB.textMuted,
                    border: 'none', borderRadius: '2px', cursor: 'pointer'
                  }}
                >
                  {m.substring(0,3)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* FUEL */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Fuel</div>
              <div style={{ display: 'flex', gap: '2px', backgroundColor: '#000', padding: '2px', borderRadius: '4px' }}>
                {["Rich", "Standard", "Lean"].map(m => (
                  <button key={m} onClick={() => handleCommand("FUEL", m)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: car.fuelMode === m ? HUB.accent : 'transparent', color: car.fuelMode === m ? '#fff' : HUB.textMuted, border: 'none', borderRadius: '2px', cursor: 'pointer' }}>
                    {m.substring(0,1)}
                  </button>
                ))}
              </div>
            </div>
            {/* ERS */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>ERS</div>
              <div style={{ display: 'flex', gap: '2px', backgroundColor: '#000', padding: '2px', borderRadius: '4px' }}>
                {["Overtake", "Deploy", "Balanced", "Harvest"].map(m => (
                  <button key={m} onClick={() => handleCommand("ERS", m)} style={{ flex: 1, padding: '4px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: car.ersMode === m ? HUB.accent : 'transparent', color: car.ersMode === m ? '#fff' : HUB.textMuted, border: 'none', borderRadius: '2px', cursor: 'pointer' }}>
                    {m.substring(0,3)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PIT STOP */}
          <div>
            {car.pitStopStatus === "InLap" ? (
               <button onClick={() => handleCommand("CANCEL_PIT")} style={{ ...actionBtn({ padding: '6px' }), width: '100%', fontSize: '10px', backgroundColor: '#ef4444' }}>CANCEL PIT</button>
            ) : car.pitStopStatus === "Pitting" ? (
               <button disabled style={{ ...actionBtn({ padding: '6px' }), width: '100%', fontSize: '10px', opacity: 0.5 }}>PITTING...</button>
            ) : pitPanelOpen ? (
               <div style={{ backgroundColor: '#000', padding: '4px', borderRadius: '4px' }}>
                 <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
                    <button onClick={() => { handleCommand("PIT", "Soft"); setPitPanelOpen(false); }} style={{...actionBtn(), flex: 1, fontSize: '9px', padding: '4px', backgroundColor: '#ef4444', border: 'none'}}>S</button>
                    <button onClick={() => { handleCommand("PIT", "Medium"); setPitPanelOpen(false); }} style={{...actionBtn(), flex: 1, fontSize: '9px', padding: '4px', backgroundColor: '#facc15', color: '#000', border: 'none'}}>M</button>
                    <button onClick={() => { handleCommand("PIT", "Hard"); setPitPanelOpen(false); }} style={{...actionBtn(), flex: 1, fontSize: '9px', padding: '4px', backgroundColor: '#ffffff', color: '#000', border: 'none'}}>H</button>
                    <button onClick={() => { handleCommand("PIT", "Intermediate"); setPitPanelOpen(false); }} style={{...actionBtn(), flex: 1, fontSize: '9px', padding: '4px', backgroundColor: '#22c55e', border: 'none'}}>I</button>
                    <button onClick={() => { handleCommand("PIT", "Wet"); setPitPanelOpen(false); }} style={{...actionBtn(), flex: 1, fontSize: '9px', padding: '4px', backgroundColor: '#3b82f6', border: 'none'}}>W</button>
                 </div>
                 <button onClick={() => setPitPanelOpen(false)} style={{ ...actionBtn({ padding: '4px' }), width: '100%', fontSize: '9px', backgroundColor: 'transparent', border: 'none', color: HUB.textMuted }}>Cancel</button>
               </div>
            ) : (
               <button onClick={() => setPitPanelOpen(true)} style={{ ...actionBtn({ padding: '6px' }), width: '100%', fontSize: '10px' }}>BOX THIS LAP</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
