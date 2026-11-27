import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { getDriverNationality } from '../../utils/driverProfileModel.js';
import { useDialogFocus } from '../useDialogFocus.ts';
import { trajectory, estimate, ovr, potential } from '../../game/academyEngine.js';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const money = (v: number) => `$${(v ?? 0) < 1 && (v ?? 0) > -1 && v !== 0 ? (v ?? 0).toFixed(2) : (v ?? 0).toFixed(1)}M`;
const initials = (n: string) => String(n || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');

export function Avatar({ d, size = 40 }: { d: any; size?: number }) {
  const url = getDriverHeadshotUrl(d);
  const real = url && !String(url).startsWith('data:') ? url : null;
  const nat = getDriverNationality(d);
  return (
    <span className="ac-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {real ? <img src={real} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : initials(d?.name)}
      {nat?.flag && <span className="ac-flag">{nat.flag}</span>}
    </span>
  );
}
export const nationalityText = (d: any) => getDriverNationality(d)?.country || d?.nationality || '–';

export function Traj({ d }: { d: any }) {
  const t = trajectory(d);
  const Icon = t.id === 'rapid' ? ArrowUpRight : t.id === 'normal' ? TrendingUp : t.id === 'stagnant' ? Minus : TrendingDown;
  return <span className={`ac-traj is-${t.id}`} title={`${t.perSeason >= 0 ? '+' : ''}${t.perSeason} overall a season at the current rate`}><Icon size={13} strokeWidth={1.75} />{t.label}</span>;
}

export const Badge = ({ id, label }: { id: string; label: string }) => <span className={`ac-badge is-${id}`}>{label}</span>;

/** Estimate bar: a solid value for known numbers, a band for ranges. */
export function EstBar({ est, max = 99, tone = '' }: { est: any; max?: number; tone?: string }) {
  if (!est.known) return <div className="ac-bar" />;
  const l = (est.low / max) * 100; const h = (est.high / max) * 100;
  return (
    <div className="ac-bar">
      {est.exact
        ? <motion.span className={tone} initial={false} animate={{ width: `${h}%` }} transition={{ duration: 0.5, ease: EASE }} />
        : <motion.span className={`is-range ${tone}`} initial={false} animate={{ left: `${l}%`, width: `${Math.max(2, h - l)}%` }} transition={{ duration: 0.5, ease: EASE }} />}
    </div>
  );
}

/** Overall and potential with estimates, as the player knows them. */
export function ratingEstimates(state: any, d: any) {
  return { o: estimate(state, d, 'overall', ovr(d)), p: estimate(state, d, 'potential', potential(d)) };
}

export function Spark({ history }: { history: any[] }) {
  const h = (history || []).slice(-24);
  if (h.length < 2) return <p className="ac-note">The development curve builds up as the season runs.</p>;
  const W = 520; const H = 64; const P = 6;
  const ys = h.map((x) => x.ovr); const lo = Math.min(...ys) - 1; const hi = Math.max(...ys) + 1;
  const x = (i: number) => P + (i / (h.length - 1)) * (W - P * 2);
  const y = (v: number) => H - 12 - ((v - lo) / (hi - lo)) * (H - 22);
  return (
    <svg className="ac-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Overall from ${ys[0]} to ${ys[ys.length - 1]}`}>
      <line x1={P} x2={W - P} y1={H - 12} y2={H - 12} />
      <motion.path d={h.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.ovr).toFixed(1)}`).join('')} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: EASE }} />
      <text x={P} y={H - 1}>S{h[0].year} day {h[0].day} · {ys[0]}</text>
      <text x={W - P} y={H - 1} textAnchor="end">Now · {ys[ys.length - 1]}</text>
    </svg>
  );
}

export function Radar({ series, labels }: { series: { name: string; color: string; values: number[] }[]; labels: string[] }) {
  const S = 280; const C = S / 2; const R = 100; const n = labels.length;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; const r = ((Math.max(30, v) - 30) / 69) * R; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
  return (
    <svg className="ac-radar" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Attribute comparison">
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} className="grid" points={labels.map((_, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return `${C + Math.cos(a) * R * k},${C + Math.sin(a) * R * k}`; }).join(' ')} />)}
      {labels.map((l, i) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return <text key={l} x={C + Math.cos(a) * (R + 18)} y={C + Math.sin(a) * (R + 18) + 3} textAnchor="middle">{l}</text>; })}
      {series.map((s) => (
        <motion.polygon key={s.name} points={s.values.map((v, i) => pt(i, v).join(',')).join(' ')} fill={s.color} fillOpacity={0.14} stroke={s.color} strokeWidth={1.75}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} />
      ))}
    </svg>
  );
}

/** Confirmation dialog for spending and other big decisions. */
export function Confirm({ open, title, body, confirmLabel = 'Confirm', onConfirm, onClose, danger, wide, hideCancel }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(!!open, ref, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="ac-layer">
          <motion.div className="ac-scrim is-top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div ref={ref} className={`ac-dialog ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, x: '-50%', y: '-46%' }} animate={{ opacity: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, x: '-50%', y: '-48%' }} transition={{ duration: 0.2, ease: EASE }}>
            <h2>{title}</h2>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--hub-t2)' }}>{body}</div>
            <div className="ac-dialog-foot">
              {!hideCancel && <button type="button" className="ac-btn is-ghost" onClick={onClose}>Cancel</button>}
              <button type="button" className={`ac-btn ${danger ? '' : 'is-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Morale({ v }: { v: number }) {
  const m = Math.round(v ?? 70);
  const c = m >= 70 ? 'var(--hub-pos)' : m >= 45 ? 'var(--hub-warn)' : 'var(--hub-neg)';
  return <span className="ac-morale"><i style={{ background: c }} />{m}</span>;
}
