import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getDriverScopeStats } from '../../utils/championshipModel.js';
import { FormChips } from '../FormChips.tsx';
import { Avatar, Flag, TeamMark } from './StandingsTables.tsx';

type Scope = 'season' | 'last5' | 'career';
type Metric = { label: string; a: number | null; b: number | null; better: 'higher' | 'lower'; fmt?: (v: number) => string; max?: number; hint?: string };

const p = (v: number) => `P${Math.round(v)}`;
const p1 = (v: number) => `P${v.toFixed(1)}`;

function Row({ m, i }: { m: Metric; i: number }) {
  const reduce = useReducedMotion();
  const has = m.a != null && m.b != null;
  const aLead = has && (m.better === 'higher' ? m.a! > m.b! : m.a! < m.b!);
  const bLead = has && (m.better === 'higher' ? m.b! > m.a! : m.b! < m.a!);
  // Bar share: for "lower is better" invert so the better value gets the longer bar.
  let sa = 0, sb = 0;
  if (has) {
    if (m.max) { sa = m.a! / m.max; sb = m.b! / m.max; }
    else if (m.better === 'higher') { const t = Math.max(m.a!, m.b!) || 1; sa = m.a! / t; sb = m.b! / t; }
    else { const lo = Math.min(m.a!, m.b!) || 1; sa = lo / (m.a! || 1); sb = lo / (m.b! || 1); }
  }
  const fmt = (v: number | null) => v == null ? '—' : m.fmt ? m.fmt(v) : String(Math.round(v * 10) / 10);
  const grow = (s: number, origin: string) => ({
    style: { width: `${Math.max(0, Math.min(1, s)) * 100}%`, transformOrigin: origin },
    initial: reduce ? false : { scaleX: 0 }, animate: { scaleX: 1 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.03 * i },
  });
  return (
    <div className="st-cmp-row" title={m.hint}>
      <span className={`st-cmp-v a${aLead ? ' lead' : ''}`}>{fmt(m.a)}</span>
      <span className="st-cmp-mid">
        <span className="st-cmp-label">{m.label}</span>
        <span className="st-cmp-bars" aria-hidden>
          <span className="st-cmp-bar a"><motion.i {...(grow(sa, 'right') as any)} /></span>
          <span className="st-cmp-bar b"><motion.i {...(grow(sb, 'left') as any)} /></span>
        </span>
      </span>
      <span className={`st-cmp-v b${bLead ? ' lead' : ''}`}>{fmt(m.b)}</span>
    </div>
  );
}

/** Any two drivers, side by side. Results come from race records; ratings from the driver's current attributes. */
export function DriverComparison({ state, champ, findDriver, defaultPair }: { state: any; champ: any; findDriver: (n: string) => any; defaultPair: [string, string] }) {
  const names = champ.drivers.map((d: any) => d.name);
  const [a, setA] = useState(defaultPair[0]);
  const [b, setB] = useState(defaultPair[1]);
  const [scope, setScope] = useState<Scope>('season');

  useEffect(() => {
    if (!names.includes(a)) setA(defaultPair[0]);
    if (!names.includes(b)) setB(defaultPair[1]);
  }, [champ.season, names.length]);

  const sa = useMemo(() => getDriverScopeStats(state, a, scope, champ.season), [state, a, scope, champ.season, champ.completed]);
  const sb = useMemo(() => getDriverScopeStats(state, b, scope, champ.season), [state, b, scope, champ.season, champ.completed]);
  const ra = champ.drivers.find((d: any) => d.name === a);
  const rb = champ.drivers.find((d: any) => d.name === b);
  const da = findDriver(a);
  const db = findDriver(b);

  if (names.length < 2) {
    return (
      <section className="st-card"><div className="st-card-head"><h2 className="st-card-title">Driver comparison</h2></div>
        <p className="st-empty">Two drivers need a Grand Prix start before they can be compared.</p></section>
    );
  }

  const results: Metric[] = [
    { label: 'Points', a: sa.points, b: sb.points, better: 'higher' },
    { label: 'Wins', a: sa.wins, b: sb.wins, better: 'higher' },
    { label: 'Podiums', a: sa.podiums, b: sb.podiums, better: 'higher' },
    { label: 'Pole positions', a: sa.poles, b: sb.poles, better: 'higher' },
    { label: 'Average finish', a: sa.avgFinish, b: sb.avgFinish, better: 'lower', fmt: p1, hint: 'Classified finishes only' },
    { label: 'Average qualifying', a: sa.avgGrid, b: sb.avgGrid, better: 'lower', fmt: p1, hint: 'Grid position' },
    { label: 'Best finish', a: sa.bestFinish, b: sb.bestFinish, better: 'lower', fmt: p },
    { label: 'Finish spread', a: sa.stdDev, b: sb.stdDev, better: 'lower', fmt: v => `±${v.toFixed(1)}`, hint: 'Standard deviation of finishing positions: lower is more consistent' },
    { label: 'Retirements', a: sa.dnfs, b: sb.dnfs, better: 'lower' },
  ];
  const ratings: Metric[] = [
    { label: 'Race pace', a: da?.pace ?? null, b: db?.pace ?? null, better: 'higher', max: 100 },
    { label: 'Qualifying', a: da?.quali ?? null, b: db?.quali ?? null, better: 'higher', max: 100 },
    { label: 'Consistency', a: da?.consistency ?? null, b: db?.consistency ?? null, better: 'higher', max: 100 },
    { label: 'Racecraft', a: da?.racecraft ?? null, b: db?.racecraft ?? null, better: 'higher', max: 100 },
  ];
  const scopeLabel = scope === 'season' ? (champ.isCurrent ? 'This season' : `Season ${champ.season}`) : scope === 'last5' ? 'Last five starts' : 'All recorded seasons';

  const side = (name: string, set: (v: string) => void, row: any, cls: string) => (
    <div className={`st-cmp-side ${cls}`}>
      <Avatar name={name} size={52} />
      <div className="st-cmp-who">
        <select className="st-select" value={name} onChange={e => set(e.target.value)} aria-label={cls === 'a' ? 'First driver' : 'Second driver'}>
          {names.map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="st-who-meta" style={{ justifyContent: cls === 'b' ? 'flex-end' : 'flex-start' }}>
          <Flag name={name} /><TeamMark name={row?.team} player={champ.playerTeam} />
          {row && <span>· P{row.pos} · {row.points} pts</span>}
        </span>
      </div>
    </div>
  );

  return (
    <section className="st-card" aria-labelledby="st-cmp-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-cmp-title" className="st-card-title lg">Driver comparison</h2>
          <p className="st-card-sub">{scopeLabel} · {sa.starts} vs {sb.starts} starts</p>
        </div>
        <div className="st-seg" role="group" aria-label="Comparison period">
          <button type="button" aria-pressed={scope === 'season'} onClick={() => setScope('season')}>Season</button>
          <button type="button" aria-pressed={scope === 'last5'} onClick={() => setScope('last5')}>Last 5</button>
          <button type="button" aria-pressed={scope === 'career'} onClick={() => setScope('career')}>Career</button>
        </div>
      </div>
      <div className="st-cmp-head">
        {side(a, setA, ra, 'a')}
        <span style={{ color: 'var(--st-faint)', fontSize: 12 }}>vs</span>
        {side(b, setB, rb, 'b')}
      </div>
      <div className="st-cmp-body" key={`${a}|${b}|${scope}`}>
        <div className="st-cmp-group">
          <h4>Results</h4>
          {results.map((m, i) => <Row key={m.label} m={m} i={i} />)}
        </div>
        <div className="st-cmp-group">
          <h4>Driver ratings (current)</h4>
          {ratings.map((m, i) => <Row key={m.label} m={m} i={i} />)}
          <h4 style={{ marginTop: 18 }}>Recent form</h4>
          <div className="st-cmp-form">
            <FormChips results={sa.form} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><FormChips results={sb.form} /></div>
          </div>
          <p className="st-cmp-note">
            Results are counted from completed Grands Prix only{scope === 'career' ? ' across every season recorded in this save' : ''}.
            Ratings are each driver's current attributes{!da || !db ? '; drivers without a rating show —' : ''}.
          </p>
        </div>
      </div>
    </section>
  );
}
