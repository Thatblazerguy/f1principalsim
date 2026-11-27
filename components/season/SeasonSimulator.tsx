import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, Pause, Play, Square, FastForward, ChevronRight, CloudRain, Sun, Flag } from 'lucide-react';
import { state } from '../../state.js';
import { btn, btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { canSimulateNextDay, getRoundRaceDay } from '../../utils/seasonTimeline.js';
import {
  EVENT_META, ensureSeasonSim, getCalendarEvents, getUpcomingEvents, getTargetDay,
  simulateSeasonDay, dayInfo, dayKind, getArrivalBriefing,
} from '../../utils/seasonSimulation.js';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import { syncGame } from '../../lib/supabaseApi.js';
import './season-sim.css';

export type AdvanceMode = 'days' | 'event' | 'race';
export interface AdvanceRequest { mode: AdvanceMode; days?: number }

interface Props {
  open: boolean;
  /** Start a run as soon as the panel opens (e.g. "Skip to race day" from the command palette). */
  autoStart?: AdvanceRequest | null;
  onClose: (changed: boolean) => void;
  onEnterWeekend: () => void;
}

type Run = { mode: AdvanceMode; startDay: number; target: number; paused: boolean; reason?: string };

const EASE = [0.22, 1, 0.36, 1] as const;
const PACE_MS = { watch: 520, fast: 150 } as const;
type Pace = keyof typeof PACE_MS;
const PACE_KEY = 'f1p-sim-pace';
const STRIP_BEFORE = 4;
const STRIP_DAYS = 36;

const readPace = (): Pace => { try { return localStorage.getItem(PACE_KEY) === 'fast' ? 'fast' : 'watch'; } catch { return 'watch'; } };
const writePace = (p: Pace) => { try { localStorage.setItem(PACE_KEY, p); } catch { /* storage blocked */ } };

const QUICK: { label: string; req: AdvanceRequest }[] = [
  { label: '1 day', req: { mode: 'days', days: 1 } },
  { label: '3 days', req: { mode: 'days', days: 3 } },
  { label: '1 week', req: { mode: 'days', days: 7 } },
  { label: 'Next event', req: { mode: 'event' } },
];

export function SeasonSimulator({ open, autoStart, onClose, onEnterWeekend }: Props) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const [run, setRun] = useState<Run | null>(null);
  const [pace, setPace] = useState<Pace>(readPace);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [arrival, setArrival] = useState(false);
  const [focusDay, setFocusDay] = useState<number | null>(null);
  const changed = useRef(false);
  const runRef = useRef<Run | null>(null);
  runRef.current = run;

  if (open) ensureSeasonSim(state);
  const today = state.season?.currentDay || 1;
  const total = Math.min(state.season?.totalRounds || 24, (state.season?.calendar || []).length || 24);
  const seasonOver = (state.season?.round || 1) > total;
  const round = (state.season?.calendar || []).find((r: any) => r.round === state.season?.round);
  const raceDay = round ? getRoundRaceDay(round.round) : today;
  const raceComplete = state.weekendProgress?.round === state.season?.round && !!state.weekendProgress?.raceComplete;
  const weekendOpen = !seasonOver && today >= raceDay && !raceComplete;
  const canAdvance = canSimulateNextDay(state);

  // Persist and close out a run (keeps every simulated day — nothing is rolled back)
  const finish = useCallback(async () => {
    setRun(null);
    if (changed.current) await syncGame();
  }, []);

  const close = useCallback(async () => {
    if (runRef.current) await finish();
    setArrival(false);
    setFresh(new Set());
    onClose(changed.current);
    changed.current = false;
  }, [finish, onClose]);

  useDialogFocus(open, panelRef, () => { void close(); });

  // Opening on an already-open race weekend goes straight to the arrival card (before first paint)
  useLayoutEffect(() => {
    if (!open) return;
    setFocusDay(null);
    if (weekendOpen) setArrival(true);
    else if (autoStart && canSimulateNextDay(state)) start(autoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const start = (req: AdvanceRequest) => {
    if (!canSimulateNextDay(state) || runRef.current) return;
    const from = state.season.currentDay;
    const target = getTargetDay(state, req.mode, req.days || 1);
    setFresh(new Set());
    setFocusDay(null);
    setRun({ mode: req.mode, startDay: from, target: Math.max(target, from + 1), paused: false });
  };

  // The clock: one shared game tick per step, scheduled while running and not paused
  useEffect(() => {
    if (!open || !run || run.paused) return;
    const id = window.setTimeout(async () => {
      const res = simulateSeasonDay(state);
      if (!res.advanced) { await finish(); rerender(); return; }
      changed.current = true;
      if (res.items.length) setFresh((prev) => new Set([...prev, ...res.items.map((i: any) => i.key)]));
      if (res.arrived) { await finish(); setArrival(true); return; }
      if (res.day >= run.target) { await finish(); return; }
      if (res.important) {
        const why = res.items.find((i: any) => i.important)?.title;
        setRun({ ...run, paused: true, reason: why });
        await syncGame();
        return;
      }
      setRun({ ...run }); // schedule the next day
    }, reduce ? Math.min(PACE_MS[pace], 200) : PACE_MS[pace]);
    return () => window.clearTimeout(id);
  }, [open, run, pace, reduce, finish]);

  // Space pauses / resumes while running
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !runRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'BUTTON' || tag === 'INPUT') return;
      e.preventDefault();
      setRun((r) => (r ? { ...r, paused: !r.paused, reason: undefined } : r));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const stripFrom = Math.max(1, today - STRIP_BEFORE);
  const stripTo = Math.max(stripFrom + STRIP_DAYS - 1, raceDay + 2);
  const events = useMemo(() => (open ? getCalendarEvents(state, stripFrom, stripTo) : {}), [open, stripFrom, stripTo, today, run?.paused]);
  const upcoming = open ? getUpcomingEvents(state, 7) : [];
  const feed: any[] = open ? (state.seasonSim?.feed || []).slice(0, 24) : [];
  const info = dayInfo(state, today);
  const daysToRace = Math.max(0, raceDay - today);
  const nextEventDay = upcoming[0]?.day;

  if (!open) return null;

  const setPaceAnd = (p: Pace) => { setPace(p); writePace(p); };
  const progress = run ? Math.min(1, (today - run.startDay) / Math.max(1, run.target - run.startDay)) : 0;

  return createPortal(
    <div className="ssim-root" role="presentation">
      <motion.div className="ssim-overlay" onClick={() => { if (!run || run.paused) void close(); }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} />
      <motion.div ref={panelRef} className="ssim-panel" role="dialog" aria-modal="true" aria-labelledby="ssim-title"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, ease: EASE }}>

        <AnimatePresence mode="wait" initial={false}>
          {arrival ? (
            <ArrivalCard key="arrival" reduce={!!reduce}
              onEnter={() => { void close().then(onEnterWeekend); }}
              onBack={() => { void close(); }} />
          ) : (
            <motion.div key="clock" className="ssim-clock"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.2 }}>
              {/* Header: the date is the hero */}
              <header className="ssim-head">
                <div className="ssim-head-date">
                  <span className="ssim-kicker" id="ssim-title">Season clock · Season {state.season?.year || 1}</span>
                  <div className="ssim-date" aria-live="polite">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={today} className="ssim-date-main"
                        initial={reduce ? { opacity: 0 } : { y: 18, opacity: 0, filter: 'blur(3px)' }}
                        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                        exit={reduce ? { opacity: 0 } : { y: -18, opacity: 0, filter: 'blur(3px)' }}
                        transition={{ duration: 0.28, ease: EASE }}>
                        <b>{info.weekday}</b> {info.dayOfMonth} {info.month}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <span className="ssim-sub">Day {today}{round ? ` · Round ${round.round} of ${total}` : ''}</span>
                </div>
                <div className="ssim-head-next">
                  {seasonOver ? (
                    <span className="ssim-sub">Season complete</span>
                  ) : round && (
                    <>
                      <span className="ssim-kicker">Next race</span>
                      <span className="ssim-next-name">{round.name.replace(' Grand Prix', '')} <em>GP</em></span>
                      <span className="ssim-countdown"><b>{daysToRace}</b> {daysToRace === 1 ? 'day' : 'days'} to lights out</span>
                    </>
                  )}
                </div>
                <button className={btnClass('ghost', 'ssim-close')} style={iconBtn('md')} aria-label="Close season clock" onClick={() => void close()}>
                  <X size={18} strokeWidth={1.5} />
                </button>
              </header>

              {/* Timeline strip */}
              <CalendarStrip from={stripFrom} to={stripTo} today={today} events={events} reduce={!!reduce}
                focusDay={focusDay} onFocusDay={setFocusDay} running={!!run && !run.paused} />

              {/* Controls */}
              <div className="ssim-controls">
                {run ? (
                  <div className="ssim-running">
                    <div className="ssim-progress-row">
                      <span className="ssim-run-label">
                        {run.paused ? (run.reason ? <>Paused · <b>{stripEmoji(run.reason)}</b></> : 'Paused') : <>Simulating <b>{info.label}</b></>}
                      </span>
                      <span className="ssim-run-count">{today - run.startDay} / {run.target - run.startDay} days</span>
                    </div>
                    <div className="ssim-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Simulation progress">
                      <motion.span animate={{ scaleX: progress }} transition={{ duration: reduce ? 0 : 0.35, ease: EASE }} />
                      {!run.paused && !reduce && <i className="ssim-progress-sheen" />}
                    </div>
                    <div className="ssim-run-actions">
                      <button className={btnClass(run.paused ? 'primary' : 'secondary')} style={btn(run.paused ? 'primary' : 'secondary', 'md')}
                        onClick={() => setRun({ ...run, paused: !run.paused, reason: undefined })}>
                        {run.paused ? <><Play size={14} strokeWidth={1.75} /> Resume</> : <><Pause size={14} strokeWidth={1.75} /> Pause</>}
                      </button>
                      <button className={btnClass('ghost')} style={btn('ghost', 'md')} onClick={() => void finish().then(rerender)}>
                        <Square size={12} strokeWidth={1.75} /> Stop here
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ssim-quick">
                    <div className="ssim-quick-set" role="group" aria-label="Advance time">
                      {QUICK.map((q) => (
                        <button key={q.label} className={btnClass('secondary')} style={btn('secondary', 'md')}
                          disabled={!canAdvance || (q.req.mode === 'event' && !nextEventDay)} onClick={() => start(q.req)}
                          title={q.req.mode === 'event' && upcoming[0] ? `${upcoming[0].title} · ${dayInfo(state, upcoming[0].day).label}` : undefined}>
                          {q.label}
                        </button>
                      ))}
                    </div>
                    {weekendOpen ? (
                      <button className={btnClass('primary')} style={btn('primary', 'md')} onClick={() => setArrival(true)}>
                        <Flag size={14} strokeWidth={1.75} /> Race weekend briefing
                      </button>
                    ) : (
                      <button className={btnClass('primary')} style={btn('primary', 'md')} disabled={!canAdvance} onClick={() => start({ mode: 'race' })}>
                        To race weekend <FastForward size={14} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                )}
                <div className="ssim-pace" role="radiogroup" aria-label="Simulation pace">
                  {(['watch', 'fast'] as Pace[]).map((p) => (
                    <button key={p} role="radio" aria-checked={pace === p} className={pace === p ? 'is-on' : ''} onClick={() => setPaceAnd(p)}>
                      {p === 'watch' ? 'Watch' : 'Fast'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed + upcoming */}
              <div className="ssim-body">
                <section className="ssim-feed" aria-label="Newswire">
                  <h3 className="ssim-h">Newswire</h3>
                  {feed.length === 0 ? (
                    <p className="ssim-empty">News from the factory and the paddock appears here as the days pass.</p>
                  ) : (
                    <ul className="ssim-feed-list">
                      <AnimatePresence initial={false}>
                        {feed.map((f) => (
                          <motion.li key={f.key} layout={!reduce} className={`ssim-item${fresh.has(f.key) ? ' is-fresh' : ''}${f.important ? ' is-key' : ''}`}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                            <span className="ssim-bar" data-type={f.type} aria-hidden />
                            <div className="ssim-item-meta">
                              <span className="ssim-tag" data-type={f.type}>{f.dept || EVENT_META[f.type]?.label}</span>
                              <span>{f.year === (state.season?.year || 1) ? dayInfo(state, f.day).label : `Season ${f.year}`}</span>
                            </div>
                            <p className="ssim-item-title">{stripEmoji(f.title)}</p>
                            {f.detail && <p className="ssim-item-detail">{stripEmoji(f.detail)}</p>}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </section>
                <section className="ssim-up" aria-label="Coming up">
                  <h3 className="ssim-h">Coming up</h3>
                  {upcoming.length === 0 ? <p className="ssim-empty">Nothing scheduled.</p> : (
                    <ol className="ssim-up-list">
                      {upcoming.map((e: any) => {
                        const d = dayInfo(state, e.day);
                        const n = e.day - today;
                        return (
                          <li key={e.key} className={e.type === 'race' ? 'is-race' : ''}>
                            <span className="ssim-dot" data-type={e.type} aria-hidden />
                            <div>
                              <p className="ssim-up-title">{e.title}</p>
                              <p className="ssim-up-detail">{d.label}{e.detail ? ` · ${e.detail}` : ''}</p>
                            </div>
                            <span className="ssim-up-in">{n === 1 ? 'Tomorrow' : `${n}d`}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Timeline strip ─────────────────────────────────────────────────────────
const LEGEND: { type: string; label: string }[] = [
  { type: 'race', label: 'Race weekend' },
  { type: 'development', label: 'R&D' },
  { type: 'factory', label: 'Factory' },
  { type: 'contract', label: 'Contracts' },
  { type: 'sponsor', label: 'Sponsors' },
  { type: 'market', label: 'Market' },
  { type: 'scouting', label: 'Academy' },
  { type: 'board', label: 'Board' },
];

function CalendarStrip({ from, to, today, events, reduce, focusDay, onFocusDay, running }: {
  from: number; to: number; today: number; events: Record<number, any[]>; reduce: boolean;
  focusDay: number | null; onFocusDay: (d: number | null) => void; running: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const days = useMemo(() => Array.from({ length: to - from + 1 }, (_, i) => from + i), [from, to]);

  // Keep "today" a few cells in from the left edge as the clock runs
  useLayoutEffect(() => {
    const el = scroller.current;
    const cell = el?.querySelector<HTMLElement>(`[data-day="${today}"]`);
    if (!el || !cell) return;
    const left = Math.max(0, cell.offsetLeft - cell.offsetWidth * 2.5);
    el.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
  }, [today, reduce]);

  const shown = focusDay ?? days.find((d) => d > today && (events[d] || []).length) ?? null;
  const shownEvents = shown ? (events[shown] || []) : [];
  const shownInfo = shown ? dayInfo(state, shown) : null;

  return (
    <div className="ssim-strip-wrap">
      <div className="ssim-strip" ref={scroller} role="list" aria-label="Season calendar">
        {days.map((d) => {
          const info = dayInfo(state, d);
          const kind = dayKind(state, d);
          const evs = (events[d] || []).filter((e: any) => e.type !== 'race' && e.type !== 'practice' && e.type !== 'qualifying');
          const isToday = d === today;
          const isPast = d < today;
          const firstOfMonth = info.dayOfMonth === 1 || d === from;
          const label = [info.label, kind !== 'rest' ? EVENT_META[kind]?.label : null, ...(events[d] || []).filter((e: any) => !['practice', 'qualifying', 'race'].includes(e.type)).map((e: any) => e.title)].filter(Boolean).join(' · ');
          return (
            <button key={d} type="button" role="listitem" data-day={d} title={label} aria-label={label}
              aria-current={isToday ? 'date' : undefined} aria-pressed={focusDay === d}
              className={`ssim-day k-${kind}${isPast ? ' is-past' : ''}${isToday ? ' is-today' : ''}${focusDay === d ? ' is-focus' : ''}`}
              onClick={() => onFocusDay(focusDay === d ? null : d)}>
              <span className="ssim-month">{firstOfMonth ? info.month : ''}</span>
              <span className="ssim-wd">{info.weekday.slice(0, 1)}</span>
              <span className="ssim-dn">{info.dayOfMonth}</span>
              <span className="ssim-marks" aria-hidden>
                {evs.slice(0, 3).map((e: any) => <i key={e.key} data-type={e.type} />)}
              </span>
              <span className="ssim-kind" aria-hidden>{kind === 'race' ? 'Race' : kind === 'qualifying' ? 'Q' : kind === 'practice' ? 'FP' : ''}</span>
              {isToday && (
                <motion.span className="ssim-cursor" layoutId="ssim-cursor" aria-hidden
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }} />
              )}
              {isToday && running && !reduce && <span className="ssim-pulse" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="ssim-strip-foot">
        <div className="ssim-focus" aria-live="polite">
          {shownInfo ? (
            <>
              <span className="ssim-focus-date">{shownInfo.label}</span>
              {shownEvents.length ? shownEvents.map((e: any) => (
                <span key={e.key} className="ssim-focus-ev"><i data-type={e.type} />{e.title}</span>
              )) : <span className="ssim-focus-ev is-quiet">Factory day. Nothing scheduled.</span>}
            </>
          ) : <span className="ssim-focus-ev is-quiet">Select a day to see what is scheduled.</span>}
        </div>
        <ul className="ssim-legend" aria-label="Legend">
          {LEGEND.map((l) => <li key={l.type}><i data-type={l.type} />{l.label}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ─── Race weekend arrival ───────────────────────────────────────────────────
function ArrivalCard({ reduce, onEnter, onBack }: { reduce: boolean; onEnter: () => void; onBack: () => void }) {
  const b = useMemo(() => getArrivalBriefing(state), []);
  const enterRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const t = window.setTimeout(() => enterRef.current?.focus(), reduce ? 0 : 900); return () => window.clearTimeout(t); }, [reduce]);
  if (!b) return null;
  const d = getTrackPath(b.name);
  const w = b.weather;
  const stagger = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE, delay: reduce ? 0 : 0.55 + i * 0.07 },
  });
  const title = b.name.replace(' Grand Prix', '');

  return (
    <motion.div className="ssim-arrival" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.span className="ssim-arrival-wipe" aria-hidden
        initial={reduce ? { opacity: 0 } : { scaleX: 0 }} animate={reduce ? { opacity: 0 } : { scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{ duration: 0.9, ease: EASE, times: [0, 0.55, 1] }} />
      <svg className="ssim-arrival-track" viewBox="-40 -40 580 580" aria-hidden preserveAspectRatio="xMidYMid meet">
        <motion.path d={d} fill="none" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={{ pathLength: { duration: reduce ? 0 : 1.6, ease: [0.65, 0, 0.35, 1], delay: 0.2 }, opacity: { duration: 0.3, delay: 0.2 } }} />
      </svg>

      <div className="ssim-arrival-inner">
        <button className={btnClass('ghost', 'ssim-close')} style={iconBtn('md')} aria-label="Close" onClick={onBack}>
          <X size={18} strokeWidth={1.5} />
        </button>
        <motion.span className="ssim-kicker ssim-arrival-kicker" {...stagger(-3)}>
          Race weekend · Round {b.round} of {b.totalRounds}{b.sprint ? ' · Sprint' : ''}
        </motion.span>
        <h2 className="ssim-arrival-title" id="ssim-title">
          {title.split(' ').map((word, i) => (
            <span key={i} className="ssim-arrival-word">
              <motion.span initial={reduce ? { opacity: 0 } : { y: '105%' }} animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.3 + i * 0.08 }}>{word}</motion.span>
            </span>
          ))}
          <motion.em {...stagger(-2)}>Grand Prix</motion.em>
        </h2>
        <motion.p className="ssim-arrival-sub" {...stagger(-1)}>{b.circuit} · {b.country} · {b.laps} laps · {b.date}</motion.p>

        <div className="ssim-arrival-grid">
          <motion.div className="ssim-brief" {...stagger(0)}>
            <span className="ssim-k">Constructors</span>
            <span className="ssim-v">P{b.team.pos}<small> · {b.team.pts} pts</small></span>
            <span className="ssim-s">{b.team.pos === 1 ? 'Leading the championship' : b.team.leader.pts === b.team.pts ? `Level on points with ${shortName(b.team.leader.name)}` : `${b.team.leader.pts - b.team.pts} pts behind ${shortName(b.team.leader.name)}`}</span>
          </motion.div>
          <motion.div className="ssim-brief" {...stagger(1)}>
            <span className="ssim-k">Drivers</span>
            {b.drivers.map((dr: any) => (
              <span key={dr.name} className="ssim-driver"><b>P{dr.pos || '—'}</b> {dr.name.split(' ').slice(-1)[0]} <small>{dr.pts} pts</small></span>
            ))}
          </motion.div>
          <motion.div className="ssim-brief" {...stagger(2)}>
            <span className="ssim-k">Forecast</span>
            {w ? (
              <>
                <span className="ssim-v ssim-v-icon">{w.isWet ? <CloudRain size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}{w.isWet ? 'Wet' : 'Dry'}<small> · {w.airTemperature}°C</small></span>
                <span className="ssim-s">{w.rainProbability}% rain risk · track {w.trackTemperature}°C</span>
              </>
            ) : <span className="ssim-s">No forecast yet</span>}
          </motion.div>
          <motion.div className="ssim-brief" {...stagger(3)}>
            <span className="ssim-k">Objective</span>
            <span className="ssim-v ssim-v-text">{stripEmoji(b.objective) || 'Balanced race'}</span>
            {b.rival && <span className="ssim-s">{(b.rivalGap ?? 0) >= 0 ? 'Hold off' : 'Chase down'} {shortName(b.rival)}{b.rivalGap != null ? ` · ${Math.abs(b.rivalGap)} pts` : ''}</span>}
          </motion.div>
        </div>

        {b.changes.length > 0 && (
          <motion.div className="ssim-changes" {...stagger(4)}>
            <span className="ssim-k">Since the last race</span>
            <ul>
              {b.changes.map((c: any, i: number) => (
                <li key={i}><i data-type={c.type} aria-hidden /><b>{stripEmoji(c.title)}</b>{c.detail ? <span> {stripEmoji(c.detail)}</span> : null}</li>
              ))}
            </ul>
          </motion.div>
        )}

        <motion.div className="ssim-arrival-cta" {...stagger(5)}>
          <button ref={enterRef} className={btnClass('primary')} style={btn('primary', 'lg')} onClick={onEnter}>
            Enter race weekend <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          <button className={btnClass('ghost')} style={btn('ghost', 'lg')} onClick={onBack}>Back to dashboard</button>
        </motion.div>
      </div>
    </motion.div>
  );
}

const shortName = (n = '') => n.replace(/\s+(F1 Team|Racing|Formula One Team|HP)$/i, '');
function stripEmoji(s?: string | null) {
  return String(s || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
}
