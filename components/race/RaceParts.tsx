import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipForward, FastForward, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown,
  Flag, Timer, Zap, Wrench, CircleSlash, Repeat, Radio, ListFilter, X, CloudRain, Sun, Thermometer, MonitorPlay, Gauge,
} from 'lucide-react';
import { fmtClock, fmtGap, fmtLap, EVENT_KINDS } from '../../utils/raceControlModel.js';

export const TEAM_ABBR: Record<string, string> = {
  Mercedes: 'MER', Ferrari: 'FER', McLaren: 'MCL', 'Red Bull Racing': 'RBR', Haas: 'HAA', Alpine: 'ALP',
  'Racing Bulls': 'RB', Williams: 'WIL', Audi: 'AUD', Cadillac: 'CAD', 'Aston Martin': 'AMR',
};
export const teamAbbr = (t: string) => TEAM_ABBR[t] || String(t || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
const tyreKey = (c: string) => (c === 'Intermediate' ? 'inter' : String(c || '').toLowerCase());
export const TyreBadge = ({ compound, age }: { compound: string; age?: number }) => (
  <span className="rc-tyre" title={`${compound}${age != null ? `, ${Math.floor(age)} laps old` : ''}`}>
    <i className={`rc-tyre-dot is-${tyreKey(compound)}`}>{String(compound || '?').charAt(0)}</i>
    {age != null && <em>{Math.floor(age)}</em>}
  </span>
);

/* ─── Header ───────────────────────────────────────────────────────────── */

export function RaceHeader({ engine, round, intel, weather, paused, mode, setMode }: any) {
  const leader = engine.cars[0];
  const lap = Math.max(1, Math.min(engine.totalLaps, leader?.lap || 1));
  const progress = Math.min(1, Math.max(0, (leader?.distance || 0) / engine.totalLaps));
  const done = engine.raceCompleted;
  const status = done ? 'Finished' : paused ? 'Paused' : leader?.distance >= engine.totalLaps ? 'Final lap' : lap === engine.totalLaps ? 'Final lap' : 'Racing';
  return (
    <header className="rc-head">
      <div className="rc-head-id">
        <span className="rc-roundtag">R{String(round.round || 0).padStart(2, '0')}</span>
        <div>
          <h1>{round.name}</h1>
          <p>{round.circuit}{intel?.lengthKm ? ` · ${intel.lengthKm} km` : ''}</p>
        </div>
      </div>

      <div className="rc-head-lap" aria-label={`Lap ${lap} of ${engine.totalLaps}`}>
        <div className="rc-head-lapnum"><span>Lap</span><strong>{lap}</strong><em>/ {engine.totalLaps}</em></div>
        <div className="rc-lapbar" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
          {[0.25, 0.5, 0.75].map(t => <i key={t} style={{ left: `${t * 100}%` }} />)}
        </div>
      </div>

      <dl className="rc-head-facts">
        <div><dt>Status</dt><dd><span className={`rc-flag is-${done ? 'done' : paused ? 'paused' : 'green'}`} />{status}</dd></div>
        <div><dt>{engine.isWet ? <CloudRain size={13} strokeWidth={1.5} /> : <Sun size={13} strokeWidth={1.5} />}Track</dt><dd>{engine.weatherStr}{weather?.trackTemperature != null ? ` · ${weather.trackTemperature}°C` : ''}</dd></div>
        {weather?.airTemperature != null && <div><dt><Thermometer size={13} strokeWidth={1.5} />Air</dt><dd>{weather.airTemperature}°C</dd></div>}
        <div><dt><Timer size={13} strokeWidth={1.5} />Race time</dt><dd className="rc-num">{fmtClock(engine.elapsedTime)}</dd></div>
      </dl>

      <div className="rc-seg rc-mode" role="radiogroup" aria-label="View mode">
        {[{ id: 'engineer', label: 'Race engineer', icon: Gauge }, { id: 'broadcast', label: 'Broadcast', icon: MonitorPlay }].map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'is-on' : ''} onClick={() => setMode(m.id)}>
            <m.icon size={14} strokeWidth={1.5} />{m.label}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ─── Timing tower ─────────────────────────────────────────────────────── */

const PIT_FILTERS = [
  { id: 'any', label: 'Any pit status' },
  { id: 'lane', label: 'In the pit lane' },
  { id: 'yet', label: 'Yet to stop' },
  { id: 'stopped', label: 'Has stopped' },
];

function useFlashes(rows: any[]) {
  const prev = useRef<Map<string, number>>(new Map());
  const until = useRef<Map<string, { dir: 'up' | 'down'; t: number }>>(new Map());
  const now = performance.now();
  rows.forEach(r => {
    const p = prev.current.get(r.id);
    if (p != null && p !== r.pos && r.state !== 'out') until.current.set(r.id, { dir: r.pos < p ? 'up' : 'down', t: now + 1600 });
    prev.current.set(r.id, r.pos);
  });
  return (id: string) => { const f = until.current.get(id); return f && f.t > now ? f.dir : null; };
}

export function TimingTower({ rows, selectedId, onSelect, broadcast, collapsed, onCollapse }: any) {
  const [scope, setScope] = useState<'all' | 'ours'>('all');
  const [team, setTeam] = useState('all');
  const [pit, setPit] = useState('any');
  const [gapMode, setGapMode] = useState<'interval' | 'leader'>('interval');
  const flash = useFlashes(rows);
  const teams = useMemo(() => [...new Set(rows.map((r: any) => r.team))].sort() as string[], [rows.length]);

  if (collapsed) {
    return (
      <aside className="rc-tower is-collapsed" aria-label="Timing tower (collapsed)">
        <button type="button" className="rc-icon" onClick={onCollapse} aria-label="Show timing tower" title="Show timing tower"><ChevronsRight size={16} strokeWidth={1.5} /></button>
        <ol className="rc-mini">{rows.slice(0, 22).map((r: any) => <li key={r.id} style={{ ['--tc' as any]: r.color }} className={r.isPlayer ? 'is-ours' : ''}>{r.code}</li>)}</ol>
      </aside>
    );
  }

  const filtered = rows.filter((r: any) => {
    if (scope === 'ours' && !r.isPlayer) return false;
    if (team !== 'all' && r.team !== team) return false;
    if (pit === 'lane' && !['inlap', 'pitting', 'outlap'].includes(r.state)) return false;
    if (pit === 'yet' && r.stops > 0) return false;
    if (pit === 'stopped' && r.stops === 0) return false;
    return true;
  });

  return (
    <aside className={`rc-tower ${broadcast ? 'is-broadcast' : ''}`} aria-label="Live timing">
      <div className="rc-panel-head">
        <h2>Live timing</h2>
        <div className="rc-seg is-small" role="radiogroup" aria-label="Gap shown">
          <button type="button" role="radio" aria-checked={gapMode === 'interval'} className={gapMode === 'interval' ? 'is-on' : ''} onClick={() => setGapMode('interval')}>Interval</button>
          <button type="button" role="radio" aria-checked={gapMode === 'leader'} className={gapMode === 'leader' ? 'is-on' : ''} onClick={() => setGapMode('leader')}>Leader</button>
        </div>
        {!broadcast && <button type="button" className="rc-icon" onClick={onCollapse} aria-label="Hide timing tower" title="Hide timing tower"><ChevronsLeft size={16} strokeWidth={1.5} /></button>}
      </div>
      <div className="rc-tower-filters">
        <div className="rc-seg is-small" role="radiogroup" aria-label="Drivers shown">
          <button type="button" role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'is-on' : ''} onClick={() => setScope('all')}>Overall</button>
          <button type="button" role="radio" aria-checked={scope === 'ours'} className={scope === 'ours' ? 'is-on' : ''} onClick={() => setScope('ours')}>Our drivers</button>
        </div>
        <label className="rc-select"><span className="sr-only">Constructor</span>
          <select value={team} onChange={e => setTeam(e.target.value)}>
            <option value="all">All teams</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="rc-select"><span className="sr-only">Pit status</span>
          <select value={pit} onChange={e => setPit(e.target.value)}>
            {PIT_FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
      </div>
      <div className="rc-tower-cols" aria-hidden="true">
        <span>Pos</span><span>Driver</span><span className="num">{gapMode === 'interval' ? 'Interval' : 'Gap'}</span><span>Tyre</span><span className="num">Stops</span><span className="num">+/−</span>
      </div>
      <ol className="rc-tower-list">
        {filtered.length === 0 && <li className="rc-empty">No drivers match these filters</li>}
        {filtered.map((r: any) => {
          const f = flash(r.id);
          const gap = r.pos === 1 ? (r.state === 'finished' ? 'Winner' : `Lap ${r.lap}`) : gapMode === 'interval' ? fmtGap(r.interval) : fmtGap(r.toLeader);
          const status = r.state === 'out' ? 'DNF' : r.state === 'pitting' ? 'In pit' : r.state === 'inlap' ? 'Box' : r.state === 'outlap' ? 'Out lap' : r.state === 'finished' && r.pos !== 1 ? null : null;
          return (
            <motion.li layout="position" transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} key={r.id}
              className={['rc-row', r.isPlayer && 'is-ours', r.pos <= 3 && 'is-podium', r.pos === 1 && 'is-leader', r.state === 'out' && 'is-out',
                ['inlap', 'pitting', 'outlap'].includes(r.state) && 'is-pit', r.inBattle && 'is-battle', selectedId === r.id && 'is-sel',
                f && `is-flash-${f}`, r.pos === 3 && 'is-cut3', r.pos === 10 && 'is-cut10'].filter(Boolean).join(' ')}
              style={{ ['--tc' as any]: r.color }}>
              <button type="button" onClick={() => onSelect(r.id)} aria-label={`P${r.pos} ${r.name}, ${r.team}. Open telemetry`}>
                <span className="rc-pos">{r.state === 'out' ? '–' : r.pos}</span>
                <span className="rc-drv"><i className="rc-teambar" /><strong>{r.code}</strong><em>{teamAbbr(r.team)}</em>{r.fastest && <span className="rc-fl" title="Fastest lap">FL</span>}</span>
                <span className={`rc-gap num ${r.drs ? 'is-drs' : ''}`}>{status ? <b className={`rc-status is-${r.state}`}>{status}</b> : gap}</span>
                <span className="rc-tcell"><TyreBadge compound={r.compound} age={r.tyreAge} /></span>
                <span className="num rc-stops">{r.stops}</span>
                <span className={`num rc-chg ${r.change > 0 ? 'is-up' : r.change < 0 ? 'is-down' : ''}`}>
                  {r.change > 0 ? <><ArrowUp size={10} strokeWidth={2} />{r.change}</> : r.change < 0 ? <><ArrowDown size={10} strokeWidth={2} />{-r.change}</> : '–'}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ─── Event feed ───────────────────────────────────────────────────────── */

const KIND_ICON: Record<string, any> = { start: Flag, overtake: Repeat, pit: Wrench, fastest: Timer, retire: CircleSlash, finish: Flag, other: Radio };
const FEED_FILTERS = [
  { id: 'all', label: 'All' }, { id: 'ours', label: 'Our drivers' }, { id: 'overtake', label: 'Overtakes' },
  { id: 'pit', label: 'Pit stops' }, { id: 'fastest', label: 'Fastest laps' }, { id: 'retire', label: 'Retirements' },
];

function EventRow({ ev }: { ev: any }) {
  const Icon = KIND_ICON[ev.kind] || Radio;
  return (
    <li className={`rc-ev is-${ev.severity} ${ev.ours ? 'is-ours' : ''}`}>
      <span className="rc-ev-lap rc-num">{ev.lap ? `L${ev.lap}` : ''}<em>{fmtClock(ev.time)}</em></span>
      <span className="rc-ev-ico" title={EVENT_KINDS[ev.kind]?.label}><Icon size={13} strokeWidth={1.5} /></span>
      <span className="rc-ev-text"><strong>{ev.title}</strong>{ev.detail && <em>{ev.detail}</em>}</span>
    </li>
  );
}

export function EventFeed({ events }: { events: any[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const latest = events.slice(0, 3);
  const list = events.filter(e => filter === 'all' ? true : filter === 'ours' ? e.ours : e.kind === filter);
  return (
    <div className={`rc-feed ${open ? 'is-open' : ''}`}>
      <div className="rc-feed-strip">
        <span className="rc-feed-label"><Radio size={13} strokeWidth={1.5} />Race feed</span>
        <ol className="rc-feed-latest" aria-live="polite">
          <AnimatePresence initial={false}>
            {latest.map((ev, i) => (
              <motion.li key={ev.seq ?? `${ev.time}-${ev.msg}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: i === 0 ? 1 : 0.55, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className={`rc-chip is-${ev.severity} ${ev.ours ? 'is-ours' : ''}`}>
                <span className="rc-num">{ev.lap ? `L${ev.lap}` : ''}</span>{ev.title}{ev.detail && <em>{ev.detail}</em>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        <button type="button" className="rc-link" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? <><X size={13} strokeWidth={1.5} />Close</> : <><ListFilter size={13} strokeWidth={1.5} />All events · {events.length}</>}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="rc-feed-panel" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="rc-feed-filters" role="radiogroup" aria-label="Event type">
              {FEED_FILTERS.map(f => (
                <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={`rc-pill ${filter === f.id ? 'is-on' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            <ol className="rc-feed-list">
              {list.length === 0 && <li className="rc-empty">Nothing of this type yet</li>}
              {list.map(ev => <EventRow key={ev.seq ?? `${ev.time}-${ev.msg}`} ev={ev} />)}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Broadcast lower third: the latest notable event, held for a few seconds. */
export function BroadcastBanner({ event }: { event: any }) {
  return (
    <div className="rc-lower" aria-live="polite">
      <AnimatePresence mode="wait">
        {event && (
          <motion.div key={event.seq} className={`rc-lower-card is-${event.kind}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <span className="rc-lower-kind">{EVENT_KINDS[event.kind]?.label}<em className="rc-num">Lap {event.lap}</em></span>
            <span className="rc-lower-body">
              {event.car && <i style={{ background: event.carColor }} />}
              <strong>{event.title}</strong>{event.detail && <em>{event.detail}</em>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Control bar ──────────────────────────────────────────────────────── */

export const SPEEDS = [1, 2, 4, 8, 16];

export function ControlBar({ engine, paused, setPaused, speed, setSpeed, onNextLap, onNextEvent, onFinish, onContinue, busy }: any) {
  const done = engine.raceCompleted;
  const leader = engine.cars[0];
  const lap = Math.max(1, Math.min(engine.totalLaps, leader?.lap || 1));
  const progress = Math.min(1, (leader?.distance || 0) / engine.totalLaps);
  const lapFrac = Math.min(1, Math.max(0, (leader?.distance || 0) % 1));
  return (
    <footer className="rc-bar" aria-label="Race playback">
      {done ? (
        <div className="rc-bar-done">
          <span><Flag size={16} strokeWidth={1.5} />Chequered flag · {leader?.driver?.name} wins</span>
          <button type="button" className="rc-btn is-primary is-lg" onClick={onContinue}>Continue to results<ChevronRight size={16} strokeWidth={1.5} /></button>
        </div>
      ) : (
        <>
          <button type="button" className={`rc-btn is-lg rc-play ${paused ? 'is-primary' : ''}`} onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume race' : 'Pause race'} title="Space">
            {paused ? <Play size={18} strokeWidth={1.75} /> : <Pause size={18} strokeWidth={1.75} />}<span>{paused ? 'Resume' : 'Pause'}</span>
          </button>
          <div className="rc-seg rc-speeds" role="radiogroup" aria-label="Simulation speed">
            {SPEEDS.map((s, i) => (
              <button key={s} type="button" role="radio" aria-checked={speed === s} className={speed === s ? 'is-on' : ''} onClick={() => setSpeed(s)} title={`Key ${i + 1}`}>
                {speed === s && <motion.span layoutId="rc-speed-on" className="rc-seg-on" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} />}
                <span>{s}×</span>
              </button>
            ))}
          </div>
          <div className="rc-bar-skips">
            <button type="button" className="rc-btn" onClick={onNextEvent} disabled={busy}><Zap size={15} strokeWidth={1.5} />Next event</button>
            <button type="button" className="rc-btn" onClick={onNextLap} disabled={busy}><SkipForward size={15} strokeWidth={1.5} />Next lap</button>
            <button type="button" className="rc-btn" onClick={onFinish} disabled={busy}><FastForward size={15} strokeWidth={1.5} />To the flag</button>
          </div>
          <div className="rc-bar-progress">
            <div className="rc-bar-lap"><span>Lap <strong className="rc-num">{lap}</strong> of {engine.totalLaps}</span><em className="rc-num">{Math.round(progress * 100)}% · {paused ? 'Paused' : `${speed}× speed`}</em></div>
            <div className="rc-lapbar is-thin"><span style={{ transform: `scaleX(${progress})` }} /></div>
            <div className="rc-lapbar is-lap" title="Leader's progress through this lap"><span style={{ transform: `scaleX(${lapFrac})` }} /></div>
          </div>
        </>
      )}
    </footer>
  );
}

export { fmtLap };
