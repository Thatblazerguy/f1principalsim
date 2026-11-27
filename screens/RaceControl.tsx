import React, { useState, useEffect, useRef } from 'react';
import { HUB, btn, btnClass, iconBtn, pill } from '../components/HubLayout.tsx';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { TrackMap } from '../components/ui/TrackMap.tsx';
import { TimingTower } from '../components/ui/TimingTower.tsx';
import { PlayerStrategyPanel } from '../components/ui/PlayerStrategyPanel.tsx';
import { TelemetryCenter } from '../components/ui/TelemetryCenter.tsx';
import { CommsPanel } from '../components/ui/CommsPanel.tsx';
import { WeatherPanel } from '../components/ui/WeatherPanel.tsx';
import { AnimatedTabs } from '../components/ui/animated-tabs.tsx';
import { BattleTracker } from '../components/ui/BattleTracker.tsx';
import { RaceEngineerPanel } from '../components/ui/RaceEngineerPanel.tsx';
import { LiveEventFeed } from '../components/ui/LiveEventFeed.tsx';
import { RaceEngineer } from '../game/RaceEngineer.js';
import { Play, Pause, FastForward, SkipForward, ChevronRight } from 'lucide-react';

export function RaceControl({ teams, track, laps, qualifyingGrid, selectedStrategies, selectedObjective, weekendContext, onRaceComplete }) {
  // Engine instance Ref
  const engineRef = useRef(null);
  const strategyEngineRef = useRef(null);
  
  // React State for rendering
  const [frame, setFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [rightTab, setRightTab] = useState('strategy');
  
  useEffect(() => {
    engineRef.current = new LiveRaceEngine(teams, track, laps, qualifyingGrid, selectedStrategies, weekendContext);
    strategyEngineRef.current = new RaceEngineer(engineRef.current, { objective: selectedObjective });
    setFrame(f => f + 1);
  }, [teams, track, laps, qualifyingGrid, selectedStrategies, selectedObjective, weekendContext]);

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (!engineRef.current || engineRef.current.raceCompleted) {
        if (engineRef.current?.raceCompleted) {
          setFrame(f => f + 1);
        }
        return;
      }

      if (!paused) {
        const deltaMs = time - lastTime;
        const dt = Math.min(deltaMs, 100) / 1000; 
        engineRef.current.tick(dt * speed);
        strategyEngineRef.current?.update();
        setFrame(f => f + 1);
      }
      
      lastTime = time;
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [paused, speed]);

  const handleCommand = (driverId, command, value) => {
    if (!engineRef.current) return;
    // A manual call from the strategy panel takes the car off engineer auto
    const car = engineRef.current.cars.find(c => c.id === driverId);
    if (car?.autoEngineer) strategyEngineRef.current?.setAuto(driverId, false);
    engineRef.current.playerCommand(driverId, command, value);
    setFrame(f => f + 1);
  };

  const skipToNextLap = () => {
    if (!engineRef.current) return;
    const currentLap = engineRef.current.cars[0]?.lap || 0;
    const targetLap = currentLap + 1;
    while (!engineRef.current.raceCompleted && engineRef.current.cars[0].lap < targetLap) {
      engineRef.current.tick(0.1);
      strategyEngineRef.current?.update();
    }
    setFrame(f => f + 1);
  };

  const skipToFinish = () => {
    if (!engineRef.current) return;
    while (!engineRef.current.raceCompleted) {
      engineRef.current.tick(1.0);
      strategyEngineRef.current?.update();
    }
    setFrame(f => f + 1);
  };

  const finishRace = () => {
    if (engineRef.current && engineRef.current.raceCompleted) {
      onRaceComplete(engineRef.current.finalClassification, engineRef.current.getReplayData());
    }
  };

  if (!engineRef.current) return <div>Loading Race...</div>;

  const engine = engineRef.current;
  const isFinished = engine.raceCompleted;

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 100px)', overflow: 'hidden', backgroundColor: HUB.sidebar, borderRadius: '16px', border: `1px solid ${HUB.border}` }}>
      
      {/* ── Layer 0: The Track Canvas ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <TrackMap cars={engine.cars} trackName={track.name || track.circuit || ""} />
      </div>
      
      {/* ── Layer 1: HUD / Floating Overlays ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        
        {/* Left Flank: F1 Timing Tower */}
        <div style={{ position: 'absolute', left: '16px', top: '16px', bottom: '16px', width: '320px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Race Header Status */}
          <div style={{ backgroundColor: 'rgba(17,17,19,0.88)', border: `1px solid ${HUB.border}`, borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontFamily: HUB.fontWide, color: '#fff', textTransform: 'uppercase', lineHeight: '1.1' }}>
                {track.name}
              </h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{...pill(), fontSize: '11px', padding: '2px 6px'}}>{engine.weatherStr}</span>
                {isFinished && <span style={{...pill(true), fontSize: '11px', padding: '2px 6px'}}>Finished</span>}
              </div>
            </div>
            
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '11px', color: HUB.textMuted, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", marginBottom: '2px' }}>Lap</div>
              <div style={{ fontSize: '24px', fontFamily: HUB.fontMono, fontWeight: 400, color: '#fff', lineHeight: '1' }}>
                {Math.max(1, engine.cars[0]?.lap || 1)} <span style={{ fontSize: '14px', color: HUB.textFaint }}>/ {engine.totalLaps}</span>
              </div>
            </div>
          </div>

          <TimingTower cars={engine.cars} />
        </div>

        {/* Floating Battles Overlay (Pass-through clicks) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <BattleTracker cars={engine.cars} />
        </div>

        {/* Top Right: Live Event Feed (Toast Notifications) */}
        <LiveEventFeed events={engine.events} />

        {/* Right Flank: Operations Sidebar */}
        <div style={{ position: 'absolute', right: '16px', top: '16px', bottom: '16px', width: '380px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Header */}
          <div style={{ backgroundColor: 'rgba(17,17,19,0.88)', border: `1px solid ${HUB.border}`, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
             <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontBold }}>Pit wall</h3>
          </div>

          {/* Scrolling Sections */}
          <div style={{ flex: 1, backgroundColor: 'rgba(17,17,19,0.88)', border: `1px solid ${HUB.border}`, borderRadius: '12px', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
             
             <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 400, color: HUB.textFaint, fontFamily: HUB.fontRegular, borderBottom: `1px solid ${HUB.border}`, paddingBottom: '8px' }}>Race engineer</h4>
               <RaceEngineerPanel engineer={strategyEngineRef.current} engine={engine} onChange={() => setFrame(f => f + 1)} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 400, color: HUB.textFaint, fontFamily: HUB.fontRegular, borderBottom: `1px solid ${HUB.border}`, paddingBottom: '8px' }}>Strategy</h4>
               <PlayerStrategyPanel engine={engine} onCommand={handleCommand} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 400, color: HUB.textFaint, fontFamily: HUB.fontRegular, borderBottom: `1px solid ${HUB.border}`, paddingBottom: '8px' }}>Telemetry</h4>
               <TelemetryCenter engine={engine} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 400, color: HUB.textFaint, fontFamily: HUB.fontRegular, borderBottom: `1px solid ${HUB.border}`, paddingBottom: '8px' }}>Radio</h4>
               <CommsPanel engine={engine} />
             </section>
             
          </div>
        </div>

        {/* Bottom Center: Pit Wall Console */}
        <div style={{ 
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', 
          pointerEvents: 'auto', display: 'flex', gap: '8px', 
          backgroundColor: 'rgba(17,17,19,0.88)', 
          border: `1px solid ${HUB.border}`, borderRadius: '12px', padding: '6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {!isFinished ? (
            <>
              <button className={btnClass('ghost')} onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'}
                style={iconBtn('sm', paused ? { backgroundColor: HUB.raised, color: HUB.textPrimary } : { color: HUB.textPrimary })}>
                {paused ? <Play size={16} strokeWidth={1.5} /> : <Pause size={16} strokeWidth={1.5} />}
              </button>
              <div style={{ width: '1px', backgroundColor: HUB.border, margin: '4px' }} />
              <div role="radiogroup" aria-label="Simulation speed" style={{ display: 'flex', gap: '2px' }}>
                {[1, 2, 4, 8, 16].map(s => (
                  <button key={s} role="radio" aria-checked={speed === s} className={btnClass('ghost')} onClick={() => setSpeed(s)}
                    style={btn('ghost', 'sm', { minWidth: '40px', padding: '0 8px', fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', ...(speed === s ? { backgroundColor: HUB.raised, color: HUB.textPrimary, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' } : {}) })}>
                    {s}×
                  </button>
                ))}
              </div>
              <div style={{ width: '1px', backgroundColor: HUB.border, margin: '4px' }} />
              <button className={btnClass('ghost')} onClick={skipToNextLap} style={iconBtn('sm')} aria-label="Skip to next lap" title="Skip to next lap">
                <SkipForward size={16} strokeWidth={1.5} />
              </button>
              <button className={btnClass('ghost')} onClick={skipToFinish} style={iconBtn('sm')} aria-label="Skip to finish" title="Skip to finish">
                <FastForward size={16} strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <button className={btnClass('primary')} onClick={finishRace} style={btn('primary', 'md')}>
              Continue to results <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
