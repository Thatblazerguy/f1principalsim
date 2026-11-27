import React, { useMemo } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { HUB } from '../HubLayout.tsx';
import { EASE, money, niceScale, useScrub, useWidth } from './chartKit.tsx';

type Point = { round: number; name: string; income: number; spend: number; net: number; balance: number };

const H = 200;
const PAD = { l: 52, r: 12, t: 12, b: 22 };
const BAR_STRIP = 52; // height of the per-race net strip under the balance line
const GAP = 14;

/** Balance after each race (line) over per-race net from the finance engine (bars). */
export function BudgetChart({ points, startBalance }: { points: Point[]; startBalance: number | null }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(360);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();

  const n = points.length;
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const band = innerW / Math.max(1, n);
  const cx = (i: number) => PAD.l + band * (i + 0.5);

  const lineTop = PAD.t, lineH = H - PAD.t - PAD.b - BAR_STRIP - GAP;
  const balances = [startBalance ?? 0, ...points.map(p => p.balance)];
  const { lo, hi, ticks } = niceScale(Math.min(...balances), Math.max(...balances), 3);
  const yb = (v: number) => lineTop + lineH - ((v - lo) / Math.max(1e-6, hi - lo)) * lineH;

  const stripTop = lineTop + lineH + GAP;
  const zeroY = stripTop + BAR_STRIP / 2;
  const maxNet = Math.max(0.1, ...points.map(p => Math.abs(p.net)));
  const barH = (v: number) => (Math.abs(v) / maxNet) * (BAR_STRIP / 2 - 2);
  const barW = Math.max(3, Math.min(18, band * 0.5));

  const xs = useMemo(() => points.map((_, i) => cx(i)), [n, width]);
  const { index, scrubbing, handlers } = useScrub(xs, n - 1);
  const at = index != null ? points[index] : null;

  if (!n) {
    return (
      <div ref={wrapRef} className="dbx-chart-empty dbx-chart-empty-sm">
        <p>Budget history appears after the first race.</p>
      </div>
    );
  }

  const linePath = ['M', PAD.l, yb(startBalance ?? points[0].balance), ...points.flatMap((p, i) => ['L', cx(i), yb(p.balance)])].join(' ');
  const announce = at ? `Round ${at.round}, ${at.name}. Balance ${money(at.balance)}. Income ${money(at.income)}, spend ${money(at.spend)}, net ${money(at.net, true)}.` : '';

  return (
    <div ref={wrapRef}>
      <div className="dbx-budget-readout" aria-hidden>
        <div>
          <span className="dbx-k">Balance</span>
          <span className="dbx-v">{at ? money(at.balance) : '—'}</span>
        </div>
        <div className="dbx-budget-split">
        <div>
          <span className="dbx-k">Income</span>
          <span className="dbx-v dbx-v-sm">{at ? money(at.income) : '—'}</span>
        </div>
        <div>
          <span className="dbx-k">Spend</span>
          <span className="dbx-v dbx-v-sm">{at ? money(at.spend) : '—'}</span>
        </div>
        <div>
          <span className="dbx-k">Net</span>
          <span className="dbx-v dbx-v-sm" style={{ color: at && at.net < 0 ? HUB.negative : at && at.net > 0 ? HUB.positive : HUB.textPrimary }}>{at ? money(at.net, true) : '—'}</span>
        </div>
        </div>
      </div>

      <div className="dbx-chart-wrap">
        <svg width={width} height={H} className="dbx-chart" tabIndex={0} role="slider"
          aria-label="Budget by race. Arrow keys step through races."
          aria-valuemin={points[0].round} aria-valuemax={points[n - 1].round} aria-valuenow={at?.round} aria-valuetext={announce}
          {...handlers}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={yb(t)} y2={yb(t)} stroke="rgba(237,237,237,0.06)" />
              <text x={PAD.l - 8} y={yb(t)} dy="0.32em" textAnchor="end" className="dbx-axis">${Math.round(t)}M</text>
            </g>
          ))}
          <line x1={PAD.l} x2={width - PAD.r} y1={zeroY} y2={zeroY} stroke="rgba(237,237,237,0.12)" />
          <text x={PAD.l - 8} y={zeroY} dy="0.32em" textAnchor="end" className="dbx-axis">Net</text>

          {/* per-race net bars grow from the zero line */}
          {points.map((p, i) => {
            const h = barH(p.net);
            const active = index === i && scrubbing;
            return (
              <motion.rect key={p.round}
                x={cx(i) - barW / 2} width={barW} rx={1.5}
                y={p.net >= 0 ? zeroY - h : zeroY} height={Math.max(1, h)}
                fill={p.net >= 0 ? HUB.positive : HUB.negative}
                style={{ transformBox: 'fill-box', transformOrigin: p.net >= 0 ? 'bottom' : 'top' }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: inView || reduce ? 1 : 0, opacity: !scrubbing || active ? 0.75 : 0.35 }}
                transition={{ scaleY: { duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.04 }, opacity: { duration: 0.15 } }}
              />
            );
          })}

          {/* balance line */}
          <motion.path d={linePath} fill="none" stroke={HUB.textPrimary} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: inView || reduce ? 1 : 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.15 }} />

          {at && scrubbing && (
            <g pointerEvents="none">
              <line x1={xs[index!]} x2={xs[index!]} y1={PAD.t} y2={stripTop + BAR_STRIP} stroke="rgba(237,237,237,0.35)" strokeDasharray="2 3" />
              <circle cx={xs[index!]} cy={yb(at.balance)} r={4} fill={HUB.bg} stroke={HUB.textPrimary} strokeWidth={1.5} />
            </g>
          )}
          <text x={PAD.l} y={H - 4} className="dbx-axis">{points[0].round === 1 ? 'Start' : `R${points[0].round}`}</text>
          <text x={width - PAD.r} y={H - 4} textAnchor="end" className="dbx-axis">R{points[n - 1].round}</text>
        </svg>
      </div>
      <p className="dbx-readout-line" aria-hidden>{at ? <>Round {at.round} · {at.name}{scrubbing ? '' : ' · latest'}</> : null}</p>
    </div>
  );
}
