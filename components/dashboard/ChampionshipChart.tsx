import React, { useMemo, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { HUB } from '../HubLayout.tsx';
import { EASE, niceScale, useScrub, useWidth } from './chartKit.tsx';

type Round = { round: number; name: string; totals: Record<string, number>; leader: string; leaderPoints: number };
type Series = { name: string; isPlayer: boolean; points: number[] };

// Rivals are neutral; standing order sets their lightness so they stay tellable apart.
const RIVAL_ALPHA = [0.62, 0.46, 0.34, 0.26, 0.2];
const H = 240;
const PAD = { l: 40, r: 16, t: 16, b: 28 };

export function ChampionshipChart({ rounds, series, totalRounds }: { rounds: Round[]; series: Series[]; totalRounds: number }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>(640);
  const inView = useInView(wrapRef, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const [focus, setFocus] = useState<string | null>(null);

  const domainMax = Math.max(totalRounds, rounds[rounds.length - 1]?.round || 1);
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (round: number) => PAD.l + (round / domainMax) * innerW;
  const maxPts = Math.max(10, ...series.flatMap(s => s.points));
  const { hi, ticks } = niceScale(0, maxPts, 4);
  const y = (v: number) => PAD.t + innerH - (v / hi) * innerH;

  const xs = useMemo(() => rounds.map(r => x(r.round)), [rounds, width, domainMax]);
  const { index, scrubbing, handlers } = useScrub(xs, rounds.length - 1);
  const at = index != null ? rounds[index] : null;

  const color = (s: Series, i: number) => s.isPlayer ? HUB.accent : `rgba(237,237,237,${RIVAL_ALPHA[Math.max(0, i - 1)] ?? 0.2})`;
  const opacityFor = (s: Series) => !focus || s.isPlayer || s.name === focus ? 1 : 0.28;
  const pathFor = (s: Series) => ['M', x(0), y(0), ...rounds.flatMap((r, i) => ['L', x(r.round), y(s.points[i])])].join(' ');
  const toggleFocus = (name: string) => setFocus(f => (f === name ? null : name));

  // Draw order: neutral first, focused rival above them, player on top.
  const order = series.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s));
  function rank(s: Series) { return s.isPlayer ? 2 : s.name === focus ? 1 : 0; }

  const xTicks = useMemo(() => {
    const step = domainMax > 16 ? 4 : domainMax > 8 ? 2 : 1;
    const out: number[] = [];
    for (let r = step; r <= domainMax; r += step) out.push(r);
    return out;
  }, [domainMax]);

  const player = series.find(s => s.isPlayer);
  const announce = at && player
    ? `Round ${at.round}, ${at.name}. ${series.map(s => `${s.name} ${s.points[index!]} points`).join(', ')}. Leader ${at.leader} on ${at.leaderPoints}.`
    : '';

  if (!rounds.length) {
    return (
      <div ref={wrapRef} className="dbx-chart-empty">
        <svg width="100%" height="120" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 40">
          {[8, 18, 28, 38].map(v => <line key={v} x1="0" x2="100" y1={v} y2={v} stroke="rgba(237,237,237,0.05)" strokeWidth="0.3" />)}
        </svg>
        <p>Points appear after the first race.</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef}>
      {/* Legend doubles as the readout: values follow the crosshair. */}
      <div className="dbx-legend" role="group" aria-label="Teams on the chart">
        {series.map((s, i) => {
          const pts = index != null ? s.points[index] : 0;
          const gap = at ? at.leaderPoints - pts : 0;
          const leads = at && at.leader === s.name;
          const content = (
            <>
              <span className="dbx-swatch" style={{ background: color(s, i) }} />
              <span className="dbx-legend-name">{s.isPlayer ? `${s.name} (you)` : s.name}</span>
              <span className="dbx-legend-val">{pts}</span>
              <span className="dbx-legend-gap">{leads ? 'Leads' : gap === 0 ? 'Level' : `−${gap}`}</span>
            </>
          );
          return s.isPlayer
            ? <div key={s.name} className="dbx-legend-item is-player">{content}</div>
            : (
              <button key={s.name} type="button" className="dbx-legend-item" aria-pressed={focus === s.name}
                onClick={() => toggleFocus(s.name)} style={{ opacity: opacityFor(s) === 1 ? 1 : 0.55 }}
                title={focus === s.name ? 'Clear focus' : `Focus ${s.name}`}>
                {content}
              </button>
            );
        })}
      </div>

      <div className="dbx-chart-wrap">
        <svg
          width={width} height={H} className="dbx-chart" tabIndex={0} role="slider"
          aria-label="Constructors' points by round. Arrow keys step through rounds."
          aria-valuemin={rounds[0].round} aria-valuemax={rounds[rounds.length - 1].round}
          aria-valuenow={at?.round} aria-valuetext={announce}
          {...handlers}
        >
          {/* grid */}
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(237,237,237,0.06)" />
              <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="dbx-axis">{t}</text>
            </g>
          ))}
          {xTicks.map(r => (
            <text key={r} x={x(r)} y={H - 8} textAnchor="middle" className="dbx-axis">R{r}</text>
          ))}
          {/* completed part of the season */}
          <rect x={x(0)} y={PAD.t} width={Math.max(0, x(rounds[rounds.length - 1].round) - x(0))} height={innerH} fill="rgba(237,237,237,0.015)" />

          {/* lines */}
          {order.map(({ s, i }, k) => (
            <g key={s.name} style={{ opacity: opacityFor(s), transition: `opacity 250ms ${HUB.ease}` }}>
              <motion.path
                d={pathFor(s)} fill="none" stroke={color(s, i)}
                strokeWidth={s.isPlayer ? 2.25 : s.name === focus ? 2 : 1.25}
                strokeLinejoin="round" strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={inView || reduce ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.08 * k }}
              />
              {!s.isPlayer && (
                <path d={pathFor(s)} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onClick={() => toggleFocus(s.name)} />
              )}
              <circle cx={x(rounds[rounds.length - 1].round)} cy={y(s.points[s.points.length - 1])} r={s.isPlayer ? 3.5 : 2.5} fill={color(s, i)}
                style={{ opacity: inView || reduce ? 1 : 0, transition: `opacity 300ms ${HUB.ease} ${reduce ? 0 : 900}ms` }} />
            </g>
          ))}

          {/* crosshair */}
          {at && scrubbing && (
            <g pointerEvents="none">
              <line x1={xs[index!]} x2={xs[index!]} y1={PAD.t} y2={PAD.t + innerH} stroke="rgba(237,237,237,0.35)" strokeDasharray="2 3" />
              {series.map((s, i) => (
                <circle key={s.name} cx={xs[index!]} cy={y(s.points[index!])} r={s.isPlayer ? 4.5 : 3.5}
                  fill={HUB.bg} stroke={color(s, i)} strokeWidth={1.5} opacity={opacityFor(s)} />
              ))}
              <g transform={`translate(${Math.min(Math.max(xs[index!], PAD.l + 20), width - PAD.r - 20)}, ${PAD.t - 2})`}>
                <rect x={-20} y={-12} width={40} height={16} rx={8} fill={HUB.raised} stroke="rgba(237,237,237,0.14)" />
                <text y={0} dy="-0.1em" textAnchor="middle" className="dbx-axis dbx-axis-strong">R{at.round}</text>
              </g>
            </g>
          )}
        </svg>
      </div>
      <p className="dbx-readout-line" aria-hidden>
        {at ? <>Round {at.round} · {at.name}{scrubbing ? '' : ' · latest'}</> : null}
      </p>
    </div>
  );
}
