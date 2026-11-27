import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { LiveRaceEngine } from '../game/LiveRaceEngine.js';
import { RaceEngineer } from '../game/RaceEngineer.js';
import { state } from '../state.js';
import { getCircuitIntel } from '../utils/weekendModel.js';
import { getRoundWeather } from '../utils/driverProfileModel.js';
import {
  towerRows, findBattles, createHistory, recordHistory, describeEvent, teamColor,
} from '../utils/raceControlModel.js';
import { RaceHeader, TimingTower, EventFeed, BroadcastBanner, ControlBar, SPEEDS } from '../components/race/RaceParts.tsx';
import { LiveCircuit } from '../components/race/LiveCircuit.tsx';
import { PitWall } from '../components/race/PitWall.tsx';
import { TelemetryPanel } from '../components/race/TelemetryPanel.tsx';
import { BattleBoard } from '../components/race/BattleBoard.tsx';
import '../components/race/race.css';

/*
 * Live race control. The LiveRaceEngine is the single source of truth: this
 * screen ticks it on requestAnimationFrame at the chosen speed (paused = no
 * ticks), lets the AI race engineer read it, and re-renders the panels ten
 * times a second. The map runs its own animation loop that reads the engine
 * directly. Player commands go through engine.playerCommand, as before.
 *
 * The running race is kept in a module-level slot so a remount (theme switch)
 * picks up the same race instead of restarting it.
 */

const RENDER_MS = 100;
let live: null | { key: string; engine: any; engineer: any; history: any } = null;

/** Round of a race that is running but not yet handed to the results screen. */
export const liveRaceRound = () => (live && !live.engine.consumed ? live.engine.track?.round ?? null : null);

const NOTABLE = (ev: any) => ['start', 'finish', 'retire', 'fastest'].includes(ev.kind)
  || (ev.kind === 'overtake' && (ev.ours || ev.pos <= 10)) || (ev.kind === 'pit' && ev.ours);

export function RaceControl({ teams, track, laps, qualifyingGrid, selectedStrategies, selectedObjective, weekendContext, onRaceComplete }: any) {
  const raceKey = `${track?.round}:${laps}:${(qualifyingGrid || []).map((g: any) => g.driver?.name).join(',')}`;
  const engineRef = useRef<any>(null);
  const engineerRef = useRef<any>(null);
  const historyRef = useRef<any>(createHistory());
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<'engineer' | 'broadcast'>('engineer');
  const [teleId, setTeleId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [towerCollapsed, setTowerCollapsed] = useState(false);
  const [wallCollapsed, setWallCollapsed] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const speedRef = useRef(speed); speedRef.current = speed;
  const passes = useRef<Map<string, number>>(new Map());
  const lastSeq = useRef(0);
  const banner = useRef<{ ev: any; until: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const rerender = useCallback(() => setFrame(f => f + 1), []);

  // Create (or resume) the race
  if (!engineRef.current) {
    if (live && live.key === raceKey && !live.engine.consumed) {
      engineRef.current = live.engine; engineerRef.current = live.engineer; historyRef.current = live.history;
    } else {
      const engine = new LiveRaceEngine(teams, track, laps, qualifyingGrid, selectedStrategies, weekendContext);
      const engineer = new RaceEngineer(engine, { objective: selectedObjective });
      live = { key: raceKey, engine, engineer, history: historyRef.current };
      engineRef.current = engine; engineerRef.current = engineer;
    }
  }

  // Everything that has to happen after each engine step, including inside skips
  const afterTick = useCallback(() => {
    const e = engineRef.current;
    engineerRef.current?.update();
    recordHistory(historyRef.current, e);
    // Stops planned for a later lap: call the car in at the start of that lap
    e.cars.forEach((c: any) => {
      const st = c.scheduledStop; if (!st) return;
      if (c.retired || c.distance >= e.totalLaps) { c.scheduledStop = null; return; }
      if (c.pitStopStatus === 'None' && c.lapTimes.length + 1 >= st.lap) { e.playerCommand(c.id, 'PIT', st.compound); c.scheduledStop = null; }
    });
    // Overtake highlights for the map
    if (e.eventSeq !== lastSeq.current) {
      const now = performance.now();
      for (const ev of e.events) {
        if ((ev.seq ?? 0) <= lastSeq.current) break;
        if (ev.kind === 'overtake') passes.current.set(ev.driver, now + 1800);
      }
      lastSeq.current = e.eventSeq;
    }
  }, []);

  // Main loop: tick the engine at the chosen speed; render panels at 10 fps
  useEffect(() => {
    let raf = 0; let last = performance.now(); let lastRender = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const e = engineRef.current; if (!e) return;
      const dt = Math.min(t - last, 100) / 1000; last = t;
      if (!pausedRef.current && !e.raceCompleted) { e.tick(dt * speedRef.current); afterTick(); }
      if (t - lastRender >= RENDER_MS) { lastRender = t; setFrame(f => f + 1); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [afterTick]);

  // Keyboard: space pauses, 1–5 pick the speed
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.code === 'Space') { ev.preventDefault(); setPaused(p => !p); }
      const n = Number(ev.key); if (n >= 1 && n <= SPEEDS.length) setSpeed(SPEEDS[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.classList.add('rc-active');
    return () => document.body.classList.remove('rc-active');
  }, []);

  const runUntil = (done: (e: any) => boolean, step: number) => {
    const e = engineRef.current; if (!e || e.raceCompleted) return;
    setBusy(true);
    let guard = 0;
    while (!e.raceCompleted && !done(e) && guard++ < 400000) { e.tick(step); afterTick(); }
    setBusy(false);
    rerender();
  };
  const nextLap = () => { const target = (engineRef.current.cars[0]?.lap || 0) + 1; runUntil(e => e.cars[0].lap >= target, 0.1); };
  const nextEvent = () => { const seq = engineRef.current.eventSeq; runUntil(e => e.eventSeq !== seq, 0.25); };
  const toFlag = () => runUntil(() => false, 1.0);

  const handleCommand = (driverId: string, command: string, value?: string) => {
    const e = engineRef.current; if (!e) return;
    const car = e.cars.find((c: any) => c.id === driverId);
    if (car?.autoEngineer) engineerRef.current?.setAuto(driverId, false); // a manual call takes the car off auto
    if (command === 'PIT' || command === 'CANCEL_PIT') car.scheduledStop = null;
    e.playerCommand(driverId, command, value);
    rerender();
  };
  const handleSchedule = (driverId: string, plan: { lap: number; compound: string } | null) => {
    const e = engineRef.current; const car = e.cars.find((c: any) => c.id === driverId); if (!car) return;
    if (plan && car.autoEngineer) engineerRef.current?.setAuto(driverId, false);
    car.scheduledStop = plan;
    if (plan) e.addComm('Engineer', `${car.driver.name.split(' ').pop()}, plan is to box on lap ${plan.lap} for ${plan.compound}s.`, true);
    rerender();
  };
  const finishRace = () => {
    const e = engineRef.current;
    if (e?.raceCompleted) { e.consumed = true; live = null; onRaceComplete(e.finalClassification, e.getReplayData()); }
  };

  const engine = engineRef.current;
  const engineer = engineerRef.current;
  const playerTeam = state.team?.name;
  const intel = useMemo(() => getCircuitIntel(track), [track]);
  const weather = getRoundWeather(state, track?.round);
  const rows = towerRows(engine, playerTeam);
  const battles = findBattles(engine, rows, historyRef.current);
  const playerIds = new Set<string>(engine.cars.filter((c: any) => c.isPlayer).map((c: any) => c.id));
  const events = engine.events.map((ev: any) => describeEvent(ev, engine, playerIds));
  const now = performance.now();
  const recentPass = new Set<string>([...passes.current].filter(([, t]) => t > now).map(([id]) => id));

  // Broadcast lower third: newest notable event, held five seconds
  const newestNotable = events.find(NOTABLE);
  if (newestNotable && (!banner.current || (newestNotable.seq ?? 0) > (banner.current.ev.seq ?? 0))) {
    banner.current = { ev: { ...newestNotable, carColor: newestNotable.car ? teamColor(newestNotable.car.team.name, playerTeam) : null }, until: now + 5000 };
  }
  const bannerEv = banner.current && banner.current.until > now ? banner.current.ev : null;

  const broadcast = mode === 'broadcast';
  const showTele = teleId && rows.some(r => r.id === teleId);
  const cls = ['rc-root', broadcast && 'is-broadcast', towerCollapsed && !broadcast && 'tower-collapsed', (wallCollapsed || broadcast) && 'wall-collapsed', showTele && 'has-tele'].filter(Boolean).join(' ');
  const selectCar = (id: string) => { setTeleId(id); if (playerIds.has(id)) setFocusId(id); };

  const ui = (
    <div className={cls}>
      <RaceHeader engine={engine} round={track} intel={intel} weather={weather} paused={paused} mode={mode} setMode={setMode} />
      <div className="rc-body">
        <TimingTower rows={rows} selectedId={teleId} onSelect={selectCar} broadcast={broadcast}
          collapsed={towerCollapsed && !broadcast} onCollapse={() => setTowerCollapsed(c => !c)} />

        <main className="rc-centre">
          <EventFeed events={events} />
          <div className="rc-stage">
            <LiveCircuit engineRef={engineRef} round={track} intel={intel} rows={rows} selectedId={teleId} onSelect={selectCar}
              battles={battles} lengthKm={intel?.lengthKm} broadcast={broadcast} recentPass={recentPass} />
            <BattleBoard battles={battles} onFocus={(id: string) => setTeleId(t => t === id ? t : id)} selectedId={teleId} compact={!broadcast} />
            {broadcast && <BroadcastBanner event={bannerEv} />}
            <AnimatePresence>
              {showTele && (
                <TelemetryPanel key="tele" engine={engine} rows={rows} history={historyRef.current} id={teleId} onSelect={setTeleId}
                  onClose={() => setTeleId(null)} lengthKm={intel?.lengthKm} />
              )}
            </AnimatePresence>
          </div>
        </main>

        {!broadcast && (
          <PitWall engine={engine} engineer={engineer} rows={rows} battles={battles} history={historyRef.current}
            focusId={focusId} setFocusId={setFocusId} onCommand={handleCommand} onSchedule={handleSchedule}
            collapsed={wallCollapsed} onCollapse={() => setWallCollapsed(c => !c)} onTelemetry={(id: string) => setTeleId(id)} />
        )}
      </div>
      <ControlBar engine={engine} paused={paused} setPaused={setPaused} speed={speed} setSpeed={setSpeed}
        onNextLap={nextLap} onNextEvent={nextEvent} onFinish={toFlag} onContinue={finishRace} busy={busy} />
    </div>
  );

  return createPortal(ui, document.body);
}
