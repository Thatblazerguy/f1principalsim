import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { niceScale, useScrub, useWidth } from '../dashboard/chartKit.tsx';

type Mode = 'drivers' | 'teams';
type Metric = 'points' | 'position';

// Rivals get distinct neutral-leaning hues; the player's entries are always red.
const PALETTE = ['#ededed', '#4a8fe0', '#d9a43a', '#4cc38a', '#b48ef0', '#5fd0d0', '#e88fb4', '#9aa0a6'];
const PLAYER = ['#E10600', '#ff8a85'];
const MAX_SELECTED = 8;
const PAD = { l: 44, r: 20, t: 16, b: 30 };

function defaults(champ: any, mode: Mode): string[] {
  const rows = mode === 'drivers' ? champ.drivers : champ.teams;
  const mine = rows.filter((r: any) => r.isPlayer).map((r: any) => r.name);
  const others = rows.filter((r: any) => !r.isPlayer).slice(0, mode === 'drivers' ? 4 : 4).map((r: any) => r.name);
  return [...mine, ...others].slice(0, MAX_SELECTED);
}

/** Championship progression: real totals and positions after each completed Grand Prix. */
export function ProgressionChart({ champ, height = 280, initialMode = 'drivers' }: { champ: any; height?: number; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [metric, setMetric] = useState<Metric>('points');
  const [selected, setSelected] = useState<Record<Mode, string[]>>(() => ({ drivers: defaults(champ, 'drivers'), teams: defaults(champ, 'teams') }));
  const [wrapRef, width] = useWidth<HTMLDivElement>(720);
  const reduce = useReducedMotion();

  // New season / new data → reset to sensible defaults.
  useEffect(() => {
    setSelected(s => ({
      drivers: s.drivers.some(n => champ.drivers.some((d: any) => d.name === n)) ? s.drivers : defaults(champ, 'drivers'),
      teams: s.teams.some(n => champ.teams.some((t: any) => t.name === n) && champ.completed) ? s.teams : defaults(champ, 'teams'),
    }));
  }, [champ.season, champ.drivers.length, champ.completed]);

  const rows = mode === 'drivers' ? champ.drivers : champ.teams;
  const snaps: Record<string, { points: number; pos: number }>[] = mode === 'drivers' ? champ.progression.drivers : champ.progression.teams;
  const rounds = champ.progression.rounds;
  const chosen = selected[mode].filter(n => rows.some((r: any) => r.name === n));

  // Stable colours: player first, then palette by selection order.
  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    let p = 0, o = 0;
    for (const n of chosen) {
      const isP = rows.find((r: any) => r.name === n)?.isPlayer;
      map[n] = isP ? PLAYER[Math.min(p++, PLAYER.length - 1)] : PALETTE[o++ % PALETTE.length];
    }
    return map;
  }, [chosen.join('|'), mode]);

  const toggle = (name: string) => setSelected(s => {
    const cur = s[mode];
    const next = cur.includes(name) ? cur.filter(n => n !== name) : cur.length >= MAX_SELECTED ? cur : [...cur, name];
    return { ...s, [mode]: next };
  });

  const H = height;
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  // Points start from zero before round 1; positions only exist after a race.
  const xCount = metric === 'points' ? rounds.length + 1 : rounds.length;
  const xAt = (i: number) => PAD.l + (xCount <= 1 ? innerW / 2 : (i / (xCount - 1)) * innerW);
  const xi = (k: number) => xAt(metric === 'points' ? k + 1 : k); // k = completed-round index

  const maxPts = Math.max(10, ...chosen.flatMap(n => snaps.map(s => s[n]?.points || 0)));
  const { hi, ticks } = niceScale(0, maxPts, 4);
  const fieldSize = Math.max(2, rows.length);
  const y = (v: number) => metric === 'points'
    ? PAD.t + innerH - (v / hi) * innerH
    : PAD.t + ((v - 1) / (fieldSize - 1)) * innerH;
  const posTicks = useMemo(() => {
    const step = fieldSize > 12 ? 5 : fieldSize > 6 ? 2 : 1;
    const out = [1]; for (let p = step; p <= fieldSize; p += step) if (p !== 1) out.push(p);
    return out;
  }, [fieldSize]);

  const xs = useMemo(() => rounds.map((_: any, k: number) => xi(k)), [rounds, width, metric]);
  const { index, scrubbing, handlers } = useScrub(xs, rounds.length - 1);
  // Crosshair + readout only while the user is pointing at (or keyboard-focused on) the chart.
  const active = scrubbing && index != null ? index : null;

  const pathFor = (name: string) => {
    const pts = snaps.map((s, k) => [xi(k), y(metric === 'points' ? (s[name]?.points ?? 0) : (s[name]?.pos ?? fieldSize))]);
    if (metric === 'points') pts.unshift([xAt(0), y(0)]);
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  };

  const xTickEvery = rounds.length > 16 ? 4 : rounds.length > 8 ? 2 : 1;
  const order = [...chosen].sort((a, b) => Number(!!rows.find((r: any) => r.name === a)?.isPlayer) - Number(!!rows.find((r: any) => r.name === b)?.isPlayer));

  const tipRows = active != null
    ? chosen.map(n => ({ n, ...snaps[active][n], prev: active > 0 ? snaps[active - 1][n]?.points ?? 0 : 0 }))
        .filter(r => r.points != null).sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99))
    : [];
  const tipLeft = active != null ? Math.min(Math.max(xi(active) + 16, 8), width - 270) : 0;
  const tipFlip = active != null && xi(active) > width * 0.6;

  return (
    <section className="st-card" aria-labelledby="st-prog-title" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="st-card-head">
        <div>
          <h2 id="st-prog-title" className="st-card-title">Championship progression</h2>
          <p className="st-card-sub">{rounds.length ? `${metric === 'points' ? 'Points' : 'Position'} after each of ${rounds.length} completed Grand Prix` : 'Starts after the first Grand Prix'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="st-seg" role="group" aria-label="Championship">
            <button type="button" aria-pressed={mode === 'drivers'} onClick={() => setMode('drivers')}>Drivers</button>
            <button type="button" aria-pressed={mode === 'teams'} onClick={() => setMode('teams')}>Constructors</button>
          </div>
          <div className="st-seg" role="group" aria-label="Measure">
            <button type="button" aria-pressed={metric === 'points'} onClick={() => setMetric('points')}>Points</button>
            <button type="button" aria-pressed={metric === 'position'} onClick={() => setMetric('position')}>Position</button>
          </div>
        </div>
      </div>

      <div className="st-chips" role="group" aria-label={`Choose ${mode === 'drivers' ? 'drivers' : 'constructors'} to compare (up to ${MAX_SELECTED})`}>
        {rows.map((r: any) => {
          const on = chosen.includes(r.name);
          return (
            <button key={r.name} type="button" className="st-chip" aria-pressed={on} onClick={() => toggle(r.name)}
              disabled={!on && chosen.length >= MAX_SELECTED} title={on ? `Hide ${r.name}` : `Show ${r.name}`}>
              <i style={on ? { background: colorOf[r.name] } : undefined} />
              {mode === 'drivers' ? r.name.split(' ').slice(-1)[0] : r.name}
            </button>
          );
        })}
      </div>

      <div ref={wrapRef} className="st-chart-wrap" style={{ flex: 1 }}>
        {!rounds.length ? (
          <div className="dbx-chart-empty" style={{ minHeight: H - 40 }}><p>Points appear after the first Grand Prix.</p></div>
        ) : (
          <>
            <svg width={width} height={H} className="st-chart" tabIndex={0} role="img"
              aria-label={`${mode === 'drivers' ? 'Drivers' : 'Constructors'} championship ${metric} by round. Use arrow keys to step through rounds.`}
              {...handlers}>
              {metric === 'points'
                ? ticks.map(t => (
                  <g key={t}>
                    <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(237,237,237,0.06)" />
                    <text x={PAD.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="st-axis">{t}</text>
                  </g>))
                : posTicks.map(p => (
                  <g key={p}>
                    <line x1={PAD.l} x2={width - PAD.r} y1={y(p)} y2={y(p)} stroke="rgba(237,237,237,0.06)" />
                    <text x={PAD.l - 10} y={y(p)} dy="0.32em" textAnchor="end" className="st-axis">P{p}</text>
                  </g>))}
              {metric === 'points' && <text x={xAt(0)} y={H - 8} textAnchor="middle" className="st-axis">Start</text>}
              {rounds.map((r: any, k: number) => (k % xTickEvery === 0 || k === rounds.length - 1) && (
                <text key={r.round} x={xi(k)} y={H - 8} textAnchor="middle" className="st-axis">R{r.round}</text>
              ))}
              {active != null && <line x1={xi(active)} x2={xi(active)} y1={PAD.t} y2={PAD.t + innerH} stroke="rgba(237,237,237,0.25)" strokeDasharray="3 3" />}

              {order.map(n => {
                const isPlayer = rows.find((r: any) => r.name === n)?.isPlayer;
                return (
                  <g key={`${mode}-${metric}-${n}`}>
                    <motion.path d={pathFor(n)} fill="none" stroke={colorOf[n]} strokeWidth={isPlayer ? 2.5 : 1.6}
                      strokeLinejoin="round" strokeLinecap="round"
                      initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    {snaps.map((s, k) => {
                      const v = metric === 'points' ? s[n]?.points : s[n]?.pos;
                      if (v == null) return null;
                      const on = active === k;
                      return <circle key={k} cx={xi(k)} cy={y(v)} r={on ? 4 : rounds.length <= 12 ? 2.25 : 0} fill={on ? colorOf[n] : '#0d0d0f'} stroke={colorOf[n]} strokeWidth={1.5} />;
                    })}
                  </g>
                );
              })}
            </svg>
            {active != null && tipRows.length > 0 && (
              <div className="st-chart-tip" style={tipFlip ? { left: Math.max(8, xi(active) - 280) } : { left: tipLeft }} aria-live="polite">
                <h4>R{rounds[active].round}<span>{rounds[active].name}</span></h4>
                {tipRows.map(r => (
                  <div key={r.n} className="st-tip-row">
                    <i style={{ background: colorOf[r.n] }} />
                    <span className="n">{mode === 'drivers' ? r.n.split(' ').slice(-1)[0] : r.n}</span>
                    <span className="p">P{r.pos}</span>
                    <span className="v">{r.points}{active > 0 && r.points - r.prev > 0 ? <span style={{ color: 'var(--st-pos)', fontSize: 10 }}> +{r.points - r.prev}</span> : null}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
