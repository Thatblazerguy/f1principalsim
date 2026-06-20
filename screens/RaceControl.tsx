import React, { useState, useEffect, useRef } from 'react';
import { HUB, actionBtn, pill } from '../components/HubLayout.tsx';
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
import { MLStrategyEngine } from '../game/MLStrategyEngine.js';
import { Play, Pause, FastForward, SkipForward } from 'lucide-react';

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
    strategyEngineRef.current = new MLStrategyEngine(engineRef.current, selectedObjective);
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
        setFrame(f => f + 1);
      }
      
      lastTime = time;
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [paused, speed]);

  const handleCommand = (driverId, command, value) => {
    if (engineRef.current) engineRef.current.playerCommand(driverId, command, value);
  };

  const skipToNextLap = () => {
    if (!engineRef.current) return;
    const currentLap = engineRef.current.cars[0]?.lap || 0;
    const targetLap = currentLap + 1;
    while (!engineRef.current.raceCompleted && engineRef.current.cars[0].lap < targetLap) {
      engineRef.current.tick(0.1);
    }
    setFrame(f => f + 1);
  };

  const skipToFinish = () => {
    if (!engineRef.current) return;
    while (!engineRef.current.raceCompleted) {
      engineRef.current.tick(1.0);
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
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 100px)', overflow: 'hidden', backgroundColor: '#050505', borderRadius: '16px', border: `1px solid ${HUB.border}` }}>
      
      {/* ── Layer 0: The Track Canvas ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <TrackMap cars={engine.cars} trackName={track.name || track.circuit || ""} />
      </div>
      
      {/* ── Layer 1: HUD / Floating Overlays ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        
        {/* Left Flank: F1 Timing Tower */}
        <div style={{ position: 'absolute', left: '16px', top: '16px', bottom: '16px', width: '320px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Race Header Status */}
          <div style={{ backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontFamily: HUB.fontWide, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1.1' }}>
                {track.name}
              </h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{...pill(), fontSize: '9px', padding: '2px 6px'}}>{engine.weatherStr}</span>
                {isFinished && <span style={{...pill(true), backgroundColor: HUB.accent, borderColor: HUB.accent, color: '#fff', fontSize: '9px', padding: '2px 6px'}}>FINISHED</span>}
              </div>
            </div>
            
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '10px', color: HUB.textMuted, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Current Lap</div>
              <div style={{ fontSize: '24px', fontFamily: HUB.fontMono, fontWeight: 'bold', color: '#fff', lineHeight: '1' }}>
                {Math.max(1, engine.cars[0]?.lap || 1)} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>/ {engine.totalLaps}</span>
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
          <div style={{ backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
             <h3 style={{ margin: 0, fontSize: '12px', color: HUB.textMuted, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Operations Control</h3>
          </div>

          {/* Scrolling Sections */}
          <div style={{ flex: 1, backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
             
             <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '10px', color: HUB.accent, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>AI Race Engineer</h4>
               <RaceEngineerPanel strategyEngine={strategyEngineRef.current} engine={engine} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '10px', color: HUB.accent, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>Pit Wall Controls</h4>
               <PlayerStrategyPanel engine={engine} onCommand={handleCommand} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '10px', color: HUB.accent, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>Live Telemetry</h4>
               <TelemetryCenter engine={engine} />
             </section>

             <section>
               <h4 style={{ margin: '0 0 12px 0', fontSize: '10px', color: HUB.accent, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>Radio Comms</h4>
               <CommsPanel engine={engine} />
             </section>
             
          </div>
        </div>

        {/* Bottom Center: Pit Wall Console */}
        <div style={{ 
          position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', 
          pointerEvents: 'auto', display: 'flex', gap: '8px', 
          backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', 
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {!isFinished ? (
            <>
              <button onClick={() => setPaused(!paused)} style={actionBtn({ padding: '10px 14px', backgroundColor: paused ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', color: '#fff' })}>
                {paused ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              {[1, 2, 4, 8, 16].map(s => (
                <button key={s} onClick={() => setSpeed(s)} style={actionBtn({ 
                  padding: '8px 12px', 
                  backgroundColor: speed === s ? HUB.accent : 'transparent', 
                  border: speed === s ? `1px solid ${HUB.accent}` : '1px solid transparent',
                  boxShadow: speed === s ? `0 0 12px ${HUB.accent}40` : 'none',
                  color: speed === s ? '#fff' : HUB.textMuted
                })}>
                  {s}x
                </button>
              ))}
              <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
              <button onClick={skipToNextLap} style={actionBtn({ padding: '10px 14px', backgroundColor: 'transparent', border: 'none', color: HUB.textMuted })} title="Skip to Next Lap">
                <SkipForward size={18} />
              </button>
              <button onClick={skipToFinish} style={actionBtn({ padding: '10px 14px', backgroundColor: 'transparent', border: 'none', color: '#ef4444' })} title="Skip to Finish">
                <FastForward size={18} />
              </button>
            </>
          ) : (
            <button onClick={finishRace} style={{ ...actionBtn({ padding: '12px 48px', fontSize: '14px' }), backgroundColor: HUB.accent, color: '#fff', border: 'none' }}>
              CONTINUE TO RESULTS
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
