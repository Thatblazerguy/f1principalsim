import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Route, Plus, Minus, Lock, Check, AlertTriangle, Info, RotateCcw } from 'lucide-react';
import { HUB, glassCard, btn, btnClass, tyreDot } from '../HubLayout.tsx';
import {
  PLAN_RULES,
  MAX_STOPS,
  MIN_STINT,
  PIT_LOSS,
  pitBounds,
  movePit,
  addStop,
  removeStop,
  setCompound,
  nextCompound,
  samePlan,
  encodePlanLabel,
  planFromLabel,
  recommendedPlan,
  driverProfile,
  projectPlan,
  planIssues,
  buildFieldBaseline,
  finishingRange,
} from '../../utils/strategyModel.js';
import './strategy-builder.css';

type Plan = { compounds: string[]; pitLaps: number[]; source?: string };

const KEY: Record<string, string> = { Soft: 'S', Medium: 'M', Hard: 'H' };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lastName = (n: string) => String(n || '').split(' ').pop();
const tyreColor = (c: string) => HUB.tyre[String(c).toLowerCase()] || HUB.textFaint;

function fmtRace(t: number) {
  if (!Number.isFinite(t)) return '–';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
function fmtLap(t: number) {
  const m = Math.floor(t / 60);
  return `${m}:${(t % 60).toFixed(3).padStart(6, '0')}`;
}
function fmtDelta(d: number) {
  if (!Number.isFinite(d)) return '–';
  if (Math.abs(d) < 0.05) return '±0.0s';
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}s`;
}
const planShort = (p: Plan) => `${p.compounds.map((c) => KEY[c] || c[0]).join('–')} · ${p.pitLaps.map((l) => `L${l}`).join(', ') || 'no stop'}`;

/** Tween a number toward its target (eased, ~450ms). Instant with reduced motion. */
function useTween(value: number, reduced: boolean, duration = 450) {
  const [v, setV] = useState(value);
  const cur = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (reduced || !Number.isFinite(value) || !Number.isFinite(cur.current)) {
      cur.current = value;
      setV(value);
      return;
    }
    const from = cur.current;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const x = from + (value - from) * (1 - Math.pow(1 - k, 3));
      cur.current = x;
      setV(x);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced, duration]);
  return v;
}

// ─── Wear chart ───────────────────────────────────────────────────────────────

function WearChart({ proj, recProj, totalLaps, driverName }: { proj: any; recProj: any; totalLaps: number; driverName: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 180;
  const pad = { l: 38, r: 10, t: 12, b: 24 };
  const w = width - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const x = (lap: number) => pad.l + (lap / totalLaps) * w;
  const y = (wear: number) => pad.t + (1 - clamp(wear, 0, 100) / 100) * h;

  const pathFor = (p: any) => {
    let d = `M${x(0).toFixed(1)},${y(0).toFixed(1)}`;
    p.laps.forEach((l: any) => {
      d += `L${x(l.lap).toFixed(1)},${y(l.wear).toFixed(1)}`;
      if (l.pit) d += `L${x(l.lap).toFixed(1)},${y(0).toFixed(1)}`;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const lap = Math.ceil(((e.clientX - r.left - pad.l) / w) * totalLaps);
    setHover(clamp(lap, 1, totalLaps));
  };

  const hl = hover ? proj.laps[hover - 1] : null;
  const hr = hover ? recProj.laps[hover - 1] : null;
  const ticks = [1, ...Array.from({ length: Math.floor(totalLaps / 10) }, (_, i) => (i + 1) * 10).filter((l) => totalLaps - l >= 4), totalLaps];

  return (
    <div ref={wrap} className="sb-chart" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" aria-label={`Projected tyre wear per lap for ${driverName}, with pit stops on laps ${proj.laps.filter((l: any) => l.pit).map((l: any) => l.lap).join(', ') || 'none'}.`}>
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={pad.l + w} y1={y(g)} y2={y(g)} stroke={HUB.border} strokeDasharray={g === 100 ? '0' : '2 4'} />
            <text x={pad.l - 8} y={y(g) + 3} textAnchor="end" fontSize="10" fill={HUB.textFaint} style={{ fontVariantNumeric: 'tabular-nums' }}>{g}%</text>
          </g>
        ))}
        <text x={pad.l + w} y={y(100) - 4} textAnchor="end" fontSize="10" fill={HUB.textFaint}>Cliff</text>
        {ticks.map((l) => (
          <text key={l} x={x(l - 0.5)} y={H - 6} textAnchor="middle" fontSize="10" fill={HUB.textFaint} style={{ fontVariantNumeric: 'tabular-nums' }}>{l}</text>
        ))}
        {/* compound strip */}
        {proj.stints.map((s: any, i: number) => (
          <rect key={i} x={x(s.start - 1)} y={pad.t + h + 2} width={Math.max(0, x(s.end) - x(s.start - 1) - 1)} height={3} rx={1.5} fill={tyreColor(s.compound)} opacity={0.7} />
        ))}
        <path d={pathFor(recProj)} fill="none" stroke={HUB.textFaint} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.8} />
        <path d={pathFor(proj)} fill="none" stroke={HUB.accent} strokeWidth={2} strokeLinejoin="round" />
        {hl && (
          <g pointerEvents="none">
            <line x1={x(hl.lap)} x2={x(hl.lap)} y1={pad.t} y2={pad.t + h} stroke={HUB.borderMid} />
            {hr && <circle cx={x(hr.lap)} cy={y(hr.wear)} r={3} fill={HUB.bg} stroke={HUB.textFaint} strokeWidth={1.25} />}
            <circle cx={x(hl.lap)} cy={y(hl.wear)} r={4} fill={HUB.accent} stroke={HUB.bg} strokeWidth={2} />
          </g>
        )}
      </svg>
      {hl && (
        <div className="sb-readout" style={x(hl.lap) > width - 190 ? { right: width - x(hl.lap) + 12 } : { left: x(hl.lap) + 12 }}>
          <div><strong>Lap {hl.lap}</strong> · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>{tyreDot(hl.compound, 8)}{hl.compound}</span>{hl.pit ? ' · box' : ''}</div>
          <div>Wear <strong>{Math.round(hl.wear)}%</strong> · {hl.age} laps old</div>
          <div>Lap time <strong>{fmtLap(hl.pit ? hl.lapTime - PIT_LOSS - 0.6 : hl.lapTime)}</strong>{hl.pit ? ` + ${PIT_LOSS.toFixed(0)}s stop` : ''}</div>
          {hr && <div>Recommended <strong>{Math.round(hr.wear)}%</strong> on {hr.compound.toLowerCase()}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export interface StrategyBuilderProps {
  appState: any;
  track: any;
  totalLaps: number;
  playerTeam: any;
  drivers: any[];
  teams: any[];
  grid?: any[] | null;
  weekendContext?: any;
  /** weekendProgress.selectedStrategies: what the race reads. */
  selectedStrategies: Record<string, any>;
  rainProbability: number;
  onLock: (labels: Record<string, string>) => void;
}

export function StrategyBuilder({ appState, track, totalLaps, playerTeam, drivers, teams, grid, weekendContext, selectedStrategies, rainProbability, onLock }: StrategyBuilderProps) {
  const reduced = !!useReducedMotion();
  const N = totalLaps;
  const names = drivers.map((d) => d.name);
  const driverKey = names.join('|');
  const gridKey = (grid || []).map((e: any) => e?.driver?.name).join('|');

  const profiles = useMemo(() => {
    const out: Record<string, any> = {};
    drivers.forEach((d) => { out[d.name] = driverProfile({ team: playerTeam, driver: d, track, weekendContext, appState }); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverKey, track?.round, weekendContext]);

  const recs = useMemo(() => {
    const out: Record<string, Plan> = {};
    names.forEach((n) => { out[n] = recommendedPlan(profiles[n], track, N); });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, N]);

  const field = useMemo(
    () => buildFieldBaseline({ teams, track, totalLaps: N, weekendContext, appState, grid }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track?.round, N, gridKey, driverKey, weekendContext],
  );

  const [locked, setLocked] = useState<Record<string, string>>(() => ({ ...(selectedStrategies || {}) }));
  const [plans, setPlans] = useState<Record<string, Plan>>(() => {
    const out: Record<string, Plan> = {};
    names.forEach((n) => {
      const fromLock = planFromLabel(selectedStrategies?.[n], profiles[n], N);
      const r = recs[n];
      out[n] = fromLock || { compounds: r.compounds.slice(), pitLaps: r.pitLaps.slice() };
    });
    return out;
  });
  const [active, setActive] = useState(0);
  const name = names[clamp(active, 0, names.length - 1)];
  const rec = recs[name];
  const plan = plans[name] || rec;
  const profile = profiles[name];

  const planRef = useRef(plan);
  planRef.current = plan;
  const setPlan = useCallback((p: Plan) => setPlans((prev) => ({ ...prev, [name]: { compounds: p.compounds, pitLaps: p.pitLaps } })), [name]);

  // ── Projections ──
  const proj = useMemo(() => projectPlan(profile, plan, N), [profile, plan, N]);
  const recProj = useMemo(() => projectPlan(profile, rec, N), [profile, rec, N]);
  const range = useMemo(() => finishingRange(field, name, proj.total, profile, N), [field, name, proj.total, profile, N]);
  const issues = useMemo(() => planIssues(profile, plan, N), [profile, plan, N]);
  const blockedBy = names
    .map((n) => ({ n, issue: planIssues(profiles[n], (plans[n] || recs[n]), N).find((i: any) => i.blocking) }))
    .filter((x) => x.issue);
  const delta = proj.total - recProj.total;

  const tTotal = useTween(proj.total, reduced);
  const tDelta = useTween(delta, reduced);
  const tBest = useTween(range.best, reduced);
  const tWorst = useTween(range.worst, reduced);

  // ── Drag ──
  const barRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ index: number; rect: DOMRect; grab: number } | null>(null);
  const pendingX = useRef(0);
  const raf = useRef(0);
  const [drag, setDrag] = useState<{ index: number; frac: number } | null>(null);
  const [activeStop, setActiveStop] = useState<number | null>(null);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => { setDrag(null); setActiveStop(null); dragInfo.current = null; }, [name]);

  const flush = () => {
    raf.current = 0;
    const info = dragInfo.current;
    if (!info) return;
    const p = planRef.current;
    const { min, max } = pitBounds(p, info.index, N);
    const frac = clamp(((pendingX.current - info.grab - info.rect.left) / info.rect.width) * N, min, max);
    setDrag({ index: info.index, frac });
    const snapped = Math.round(frac);
    if (snapped !== p.pitLaps[info.index]) setPlan(movePit(p, info.index, snapped, N));
  };

  const onHandleDown = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = barRef.current!.getBoundingClientRect();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    (e.currentTarget as HTMLElement).focus({ preventScroll: true });
    const handleX = rect.left + (plan.pitLaps[index] / N) * rect.width;
    dragInfo.current = { index, rect, grab: e.clientX - handleX };
    pendingX.current = e.clientX;
    setActiveStop(index);
    setDrag({ index, frac: plan.pitLaps[index] });
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragInfo.current) return;
    pendingX.current = e.clientX;
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (!dragInfo.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pendingX.current = e.clientX;
    flush();
    dragInfo.current = null;
    setDrag(null);
  };

  const onHandleKey = (e: React.KeyboardEvent, index: number) => {
    const step = e.shiftKey ? 5 : 1;
    const cur = plan.pitLaps[index];
    const { min, max } = pitBounds(plan, index, N);
    let to: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = cur - step;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = cur + step;
    else if (e.key === 'PageDown') to = cur - 5;
    else if (e.key === 'PageUp') to = cur + 5;
    else if (e.key === 'Home') to = min;
    else if (e.key === 'End') to = max;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && plan.pitLaps.length > PLAN_RULES.minStops) {
      e.preventDefault();
      setPlan(removeStop(plan, index));
      setActiveStop(null);
      return;
    }
    if (to == null) return;
    e.preventDefault();
    setPlan(movePit(plan, index, to, N));
  };

  // ── Actions ──
  const canAdd = plan.pitLaps.length < MAX_STOPS && addStop(plan, N) !== plan;
  const canRemove = plan.pitLaps.length > PLAN_RULES.minStops;
  const isRecommended = samePlan(plan, rec);
  const lockedPlans = names.map((n) => locked[n] && planFromLabel(locked[n], profiles[n], N));
  const isLocked = (n: string, i: number) => !!lockedPlans[i] && samePlan(lockedPlans[i] as Plan, (plans[n] || recs[n]));
  const allLocked = names.every((n, i) => isLocked(n, i));

  const doLock = () => {
    if (blockedBy.length) return;
    const labels: Record<string, string> = {};
    names.forEach((n) => { labels[n] = encodePlanLabel((plans[n] || recs[n])); });
    onLock(labels);
    setLocked((prev) => ({ ...prev, ...labels }));
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length;
    setActive(next);
    const tabs = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[next]?.focus();
  };

  // Visual stint boundaries (dragged handle follows the pointer, unsnapped)
  const visPits = plan.pitLaps.map((l, k) => (drag && drag.index === k ? drag.frac : l));
  const bounds = [0, ...visPits, N];
  const rulerLaps = [1, ...[0.25, 0.5, 0.75].map((f) => Math.round(N * f)), N];

  const statCell = (label: string, value: React.ReactNode, sub: React.ReactNode, color: string = HUB.textPrimary) => (
    <div className="sb-stat">
      <div style={{ fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>{label}</div>
      <div className="sb-stat-value" style={{ color }}>{value}</div>
      <div className="sb-stat-sub">{sub}</div>
    </div>
  );

  return (
    <section aria-labelledby="sb-title" className="sb-root" style={{ ...glassCard(), marginBottom: 24 }}>
      {/* Header */}
      <div className="sb-rise" style={{ animationDelay: '0ms',  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <h4 id="sb-title" style={{ margin: 0, fontSize: 16, fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Route size={16} strokeWidth={1.5} color={HUB.textMuted} /> Race strategy
        </h4>
        <div className="sb-tabs" role="tablist" aria-label="Driver" onKeyDown={onTabKey}>
          {names.map((n, i) => {
            const on = i === active;
            const st = isLocked(n, i) ? 'locked' : locked[n] ? 'edited' : null;
            return (
              <button key={n} role="tab" id={`sb-tab-${i}`} aria-selected={on} aria-controls="sb-panel" tabIndex={on ? 0 : -1} className="sb-tab" onClick={() => setActive(i)}>
                {lastName(n)}
                {st === 'locked' && <Check size={14} strokeWidth={1.5} color={HUB.positive} aria-label="locked" />}
                {st === 'edited' && <span aria-label="changed since lock" style={{ width: 6, height: 6, borderRadius: 3, background: HUB.warning }} />}
              </button>
            );
          })}
        </div>
      </div>
      <p className="sb-rise" style={{ animationDelay: '0ms',  margin: '0 0 20px', fontSize: 13, color: HUB.textMuted }}>
        {N} laps · {PIT_LOSS.toFixed(1)}s pit loss · two dry compounds required · stints of {MIN_STINT}+ laps
      </p>

      <div id="sb-panel" role="tabpanel" aria-labelledby={`sb-tab-${active}`}>
        {/* Live projections */}
        <div className="sb-rise sb-stats" style={{ animationDelay: '60ms' }}>
          {statCell('Race time', fmtRace(tTotal), 'Pace model, clean air')}
          {statCell(
            'Vs recommended',
            fmtDelta(tDelta),
            `Rec. ${planShort(rec)}`,
            Math.abs(delta) < 0.05 ? HUB.textPrimary : delta < 0 ? HUB.positive : HUB.negative,
          )}
          {statCell(
            'Expected finish',
            Math.round(tBest) === Math.round(tWorst) ? `P${Math.round(tBest)}` : `P${Math.round(tBest)}–P${Math.round(tWorst)}`,
            `Most likely P${range.likely} of ${range.fieldSize}`,
          )}
          {statCell('Stops', plan.pitLaps.length, plan.compounds.map((c) => c.toLowerCase()).join(' → '))}
        </div>

        {/* Lap bar */}
        <div className="sb-rise sb-barwrap" style={{ animationDelay: '120ms' }}>
          <div ref={barRef} className={`sb-bar${drag ? ' sb-bar--dragging' : ''}`}>
            <div className="sb-segs">
              {plan.compounds.map((c, i) => {
                const a = bounds[i];
                const b = bounds[i + 1];
                const startLap = i === 0 ? 1 : plan.pitLaps[i - 1] + 1;
                const endLap = i === plan.compounds.length - 1 ? N : plan.pitLaps[i];
                const narrow = (b - a) / N < 0.16;
                return (
                  <button
                    key={i}
                    type="button"
                    className="sb-seg"
                    style={{ left: `${(a / N) * 100}%`, width: `${((b - a) / N) * 100}%` }}
                    onClick={() => setPlan(setCompound(plan, i, nextCompound(c)))}
                    aria-label={`Stint ${i + 1}, ${c}, laps ${startLap} to ${endLap}. Press to change compound to ${nextCompound(c)}.`}
                    title="Change compound"
                  >
                    {tyreDot(c, 10)}
                    <span>{narrow ? KEY[c] : c}</span>
                    {!narrow && <span className="sb-seg-laps">L{startLap}–{endLap}</span>}
                    <span className="sb-seg-strip" style={{ background: tyreColor(c) }} />
                  </button>
                );
              })}
            </div>
            {plan.pitLaps.map((l, k) => {
              const { min, max } = pitBounds(plan, k, N);
              return (
                <button
                  key={`h${k}`}
                  type="button"
                  role="slider"
                  className="sb-handle"
                  data-active={drag?.index === k || activeStop === k}
                  style={{ left: `${(visPits[k] / N) * 100}%` }}
                  aria-label={`Pit stop ${k + 1}`}
                  aria-valuemin={min}
                  aria-valuemax={max}
                  aria-valuenow={l}
                  aria-valuetext={`Lap ${l}, ${plan.compounds[k]} to ${plan.compounds[k + 1]}`}
                  aria-orientation="horizontal"
                  onPointerDown={(e) => onHandleDown(e, k)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                  onKeyDown={(e) => onHandleKey(e, k)}
                  onFocus={() => setActiveStop(k)}
                >
                  <span className="sb-handle-tag">L{l}</span>
                </button>
              );
            })}
          </div>
          {rec.pitLaps.map((l, k) => (
            <span key={`g${k}`} className="sb-ghost" style={{ left: `${(l / N) * 100}%`, top: 26 + 44 }} title={`Recommended stop, lap ${l}`} aria-hidden />
          ))}
          <div className="sb-ruler" aria-hidden>
            {rulerLaps.map((l) => <span key={l} style={{ left: `${((l - 0.5) / N) * 100}%` }}>{l}</span>)}
          </div>
        </div>

        {/* Controls */}
        <div className="sb-rise" style={{ animationDelay: '180ms',  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => setPlan(addStop(plan, N))} disabled={!canAdd} aria-disabled={!canAdd}>
            <Plus size={16} strokeWidth={1.5} /> Add stop
          </button>
          <button
            type="button"
            className={btnClass('secondary')}
            style={btn('secondary', 'sm')}
            onClick={() => { setPlan(removeStop(plan, activeStop ?? undefined)); setActiveStop(null); }}
            disabled={!canRemove}
            aria-disabled={!canRemove}
          >
            <Minus size={16} strokeWidth={1.5} /> Remove stop{activeStop != null && canRemove ? ` ${activeStop + 1}` : ''}
          </button>
          <button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm')} onClick={() => setPlan({ compounds: rec.compounds.slice(), pitLaps: rec.pitLaps.slice() })} disabled={isRecommended}>
            <RotateCcw size={16} strokeWidth={1.5} /> Use recommended
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: HUB.textFaint, marginLeft: 'auto' }}>
            <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `7px solid ${HUB.textFaint}` }} aria-hidden />
            Recommended: {rec.source?.split('(')[0].trim()} · {rec.pitLaps.map((l) => `L${l}`).join(', ')}
          </span>
        </div>

        {/* Wear chart */}
        <div className="sb-rise" style={{ animationDelay: '240ms',  background: HUB.raised, borderRadius: 10, padding: '12px 12px 4px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: HUB.textMuted }}>Tyre wear per lap</span>
            <span style={{ display: 'inline-flex', gap: 14, color: HUB.textFaint, fontSize: 11 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: HUB.accent }} />{lastName(name)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: `1.5px dashed ${HUB.textFaint}` }} />Recommended</span>
            </span>
          </div>
          <WearChart proj={proj} recProj={recProj} totalLaps={N} driverName={name} />
        </div>

        {/* Issues and notes */}
        <div className="sb-rise" style={{ animationDelay: '300ms',  display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {issues.map((iss: any, i: number) => (
            <p key={i} style={{ margin: 0, fontSize: 12, color: iss.blocking ? HUB.negative : HUB.warning, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} /> {iss.text}
            </p>
          ))}
          {rainProbability > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: HUB.textFaint, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Info size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
              {rainProbability}% chance the race starts wet. If it does, every car starts on intermediates and this plan isn't used.
            </p>
          )}
          <p style={{ margin: 0, fontSize: 12, color: HUB.textFaint, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Info size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
            Projections use the race pace model with no traffic, safety cars or failures. The finishing range adds this driver's lap-to-lap spread and mistake rate.
          </p>
        </div>
      </div>

      {/* Lock */}
      <div className="sb-rise" style={{ animationDelay: '300ms',  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderTop: `1px solid ${HUB.border}`, paddingTop: 16 }}>
        <p style={{ margin: 0, fontSize: 12, color: allLocked ? HUB.positive : HUB.textMuted, display: 'flex', alignItems: 'center', gap: 8, maxWidth: '60ch' }}>
          {allLocked ? <Check size={16} strokeWidth={1.5} /> : <Lock size={16} strokeWidth={1.5} color={HUB.textFaint} />}
          {blockedBy.length
            ? `${lastName(blockedBy[0].n)}: ${blockedBy[0].issue.text}`
            : allLocked
              ? 'Both plans are locked for Race control and quick sim.'
              : 'Locking saves both drivers’ plans for Race control and quick sim.'}
        </p>
        <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={doLock} disabled={blockedBy.length > 0 || allLocked} aria-disabled={blockedBy.length > 0 || allLocked}>
          <Lock size={16} strokeWidth={1.5} /> Lock in strategy
        </button>
      </div>
    </section>
  );
}

export default StrategyBuilder;
