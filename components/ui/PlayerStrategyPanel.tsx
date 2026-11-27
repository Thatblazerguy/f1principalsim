import React, { useState } from 'react';
import { HUB, btn, btnClass, tyreDot } from '../HubLayout.tsx';

// tyreDot keys: soft / medium / hard / inter / wet
const dotKey = (compound) => (compound === 'Intermediate' ? 'inter' : compound);

const PACE_MODES = [
  { value: 'Attack', label: 'Atk' },
  { value: 'Push', label: 'Push' },
  { value: 'Balanced', label: 'Bal' },
  { value: 'Conserve', label: 'Cons' },
  { value: 'Defend', label: 'Def' },
];
const FUEL_MODES = [
  { value: 'Rich', label: 'Rich' },
  { value: 'Standard', label: 'Std' },
  { value: 'Lean', label: 'Lean' },
];
const ERS_MODES = [
  { value: 'Overtake', label: 'OT' },
  { value: 'Deploy', label: 'Dep' },
  { value: 'Balanced', label: 'Bal' },
  { value: 'Harvest', label: 'Harv' },
];
const COMPOUNDS = ['Soft', 'Medium', 'Hard', 'Intermediate', 'Wet'];

const controlLabel = {
  fontSize: '11px', color: HUB.textFaint, marginBottom: '4px', fontFamily: HUB.fontRegular,
};

function Segmented({ options, value, onSelect }) {
  return (
    <div
      role="radiogroup"
      style={{
        display: 'flex', gap: '2px', padding: '2px', height: '28px', boxSizing: 'border-box',
        backgroundColor: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px',
      }}
    >
      {options.map(o => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            title={o.value}
            onClick={() => onSelect(o.value)}
            style={{
              flex: 1, minWidth: 0, padding: 0,
              fontSize: '11px', fontWeight: 400, fontFamily: HUB.fontBold,
              backgroundColor: selected ? HUB.accentSoft : 'transparent',
              color: selected ? HUB.textPrimary : HUB.textMuted,
              boxShadow: selected ? `inset 0 0 0 1px ${HUB.accent}` : 'none',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              transition: `background-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PlayerStrategyPanel({ engine, onCommand }) {
  const playerCars = engine.cars.filter(c => c.isPlayer);

  if (playerCars.length === 0) {
    return <div style={{ padding: '16px', fontSize: '12px', color: HUB.textMuted }}>No active drivers</div>;
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
    <div style={{ backgroundColor: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '8px', overflow: 'hidden', opacity: isRetired ? 0.5 : 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${HUB.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{car.driver.name.substring(0,3).toUpperCase()}</span>
          <span style={{ fontSize: '11px', color: HUB.textFaint }}>Lap {car.lap}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: HUB.fontBold, color: HUB.textPrimary }} title={car.tireCompound}>
            {tyreDot(dotKey(car.tireCompound))}
            {car.tireCompound.substring(0,1)}
          </span>
          <span style={{ fontSize: '11px', color: car.tireWear > 70 ? HUB.negative : HUB.textMuted }}>Wear {Math.round(car.tireWear)}%</span>
        </div>
      </div>

      {/* Controls */}
      {!isRetired && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <div>
            <div style={controlLabel}>Pace</div>
            <Segmented options={PACE_MODES} value={car.driverMode} onSelect={m => handleCommand("MODE", m)} />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={controlLabel}>Fuel</div>
              <Segmented options={FUEL_MODES} value={car.fuelMode} onSelect={m => handleCommand("FUEL", m)} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={controlLabel}>ERS</div>
              <Segmented options={ERS_MODES} value={car.ersMode} onSelect={m => handleCommand("ERS", m)} />
            </div>
          </div>

          {/* Pit stop */}
          <div>
            {car.pitStopStatus === "InLap" ? (
               <button onClick={() => handleCommand("CANCEL_PIT")} className={btnClass('danger')} style={btn('danger', 'sm', { width: '100%' })}>Cancel pit</button>
            ) : car.pitStopStatus === "Pitting" ? (
               <button disabled className={btnClass('secondary')} style={btn('secondary', 'sm', { width: '100%' })}>Pitting…</button>
            ) : pitPanelOpen ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 <div style={controlLabel}>Fit compound</div>
                 <div style={{ display: 'flex', gap: '4px' }}>
                    {COMPOUNDS.map(c => (
                      <button
                        key={c}
                        title={c}
                        onClick={() => { handleCommand("PIT", c); setPitPanelOpen(false); }}
                        className={btnClass('secondary')}
                        style={btn('secondary', 'sm', { flex: 1, minWidth: 0, padding: 0 })}
                      >
                        {tyreDot(dotKey(c))}
                        {c.substring(0,1)}
                      </button>
                    ))}
                 </div>
                 <button onClick={() => setPitPanelOpen(false)} className={btnClass('ghost')} style={btn('ghost', 'sm', { width: '100%' })}>Cancel</button>
               </div>
            ) : (
               <button onClick={() => setPitPanelOpen(true)} className={btnClass('primary')} style={btn('primary', 'sm', { width: '100%' })}>Box this lap</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
