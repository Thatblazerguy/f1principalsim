import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { getDriverNationality } from '../../utils/driverProfileModel.js';
import { teamColor } from '../../utils/championshipModel.js';
import { FormChips } from '../FormChips.tsx';

// ─── Shared atoms ────────────────────────────────────────────────────────────

export const lastName = (n: string) => (n || '').split(' ').slice(-1)[0];

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return <img className="st-avatar" src={getDriverHeadshotUrl(name)} alt="" style={{ width: size, height: size }} loading="lazy" />;
}

export function Flag({ name }: { name: string }) {
  const nat = getDriverNationality({ name });
  if (!nat?.flag) return null;
  return <span className="st-flag" role="img" aria-label={nat.country || nat.code} title={nat.country || nat.code}>{nat.flag}</span>;
}

export function TeamMark({ name, player, showName = true }: { name: string | null; player: string | null; showName?: boolean }) {
  if (!name) return <span className="st-team">—</span>;
  return (
    <span className="st-team">
      <i className="st-team-bar" style={{ background: teamColor(name, player) }} aria-hidden />
      {showName && <span>{name}</span>}
    </span>
  );
}

/** Small "i" button with a tooltip rendered in a portal so table scrolling never clips it. */
export function InfoTip({ lines, label = 'Why this position' }: { lines: string[]; label?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // A fixed-position tooltip would drift on scroll, so close it instead.
  useLayoutEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [pos]);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(window.innerWidth - 296, r.left), y: r.bottom + 8 });
  };
  return (
    <>
      <button ref={ref} type="button" className="st-info" aria-label={`${label}: ${lines.join(' ')}`}
        onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}
        onClick={e => e.stopPropagation()}>=</button>
      {pos && createPortal(
        <div className="st-tip-pop" role="tooltip" style={{ left: pos.x, top: pos.y }}>
          {lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>, document.body)}
    </>
  );
}

export function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="st-chg flat" aria-hidden />;
  if (v === 0) return <span className="st-chg flat" title="No change since the previous round">–</span>;
  const up = v > 0;
  return (
    <span className={`st-chg ${up ? 'up' : 'down'}`} title={`${up ? 'Up' : 'Down'} ${Math.abs(v)} since the previous round`}>
      {up ? <ArrowUp size={10} strokeWidth={2.5} /> : <ArrowDown size={10} strokeWidth={2.5} />}{Math.abs(v)}
    </span>
  );
}

function PosCell({ row, started }: { row: any; started: boolean }) {
  if (!started) return <span className="st-pos"><span className="st-pos-n">—</span></span>;
  const cls = row.pos === 1 ? 'lead' : row.pos <= 3 ? 'top' : '';
  return (
    <span className="st-pos">
      <span className={`st-pos-n ${cls}`} title={row.pos === 1 ? 'Championship leader' : undefined}>P{row.pos}</span>
      <Change v={row.posChange} />
      {row.tieNotes?.length > 0 && <InfoTip lines={row.tieNotes} />}
    </span>
  );
}

const pts = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const cell = (v: number, extra = '') => <span className={`st-td c num ${v ? 'strong' : 'zero'} ${extra}`}>{v}</span>;
const rowKey = (onOpen: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
};

function useRowMotion() {
  const reduce = useReducedMotion();
  return reduce ? {} : { layout: 'position' as const, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } };
}

// ─── Driver championship ─────────────────────────────────────────────────────

type SortKey = 'points' | 'wins' | 'podiums' | 'poles' | 'best';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'points', label: 'Pts' }, { key: 'wins', label: 'Wins' }, { key: 'podiums', label: 'Podiums' },
  { key: 'poles', label: 'Poles' }, { key: 'best', label: 'Best' },
];

const D_COLS = '72px minmax(200px, 1.8fr) minmax(120px, 1fr) repeat(6, 50px) 150px 64px';

export function DriverTable({ champ, teamFilter, onOpen, compact = false }: { champ: any; teamFilter: string; onOpen: (name: string) => void; compact?: boolean }) {
  const [sort, setSort] = useState<SortKey>('points');
  const motionProps = useRowMotion();
  const started = champ.completed > 0 || champ.legacy;
  const leaderPts = champ.drivers[0]?.points || 0;

  const rows = useMemo(() => {
    let list = champ.drivers.filter((d: any) => !teamFilter || d.team === teamFilter || d.teams?.includes(teamFilter));
    if (sort !== 'points') {
      const val = (d: any) => sort === 'best' ? (d.bestFinish ?? 999) : d[sort];
      list = [...list].sort((a: any, b: any) => (sort === 'best' ? val(a) - val(b) : val(b) - val(a)) || a.pos - b.pos);
    }
    return compact ? list.slice(0, 10) : list;
  }, [champ, teamFilter, sort, compact]);

  const sortBtn = (k: SortKey, label: string) => (
    <button type="button" className="st-sort" aria-pressed={sort === k} onClick={() => setSort(k)} title={`Sort by ${label.toLowerCase()}`}>
      {label}{sort === k && <ChevronDown size={11} strokeWidth={2} />}
    </button>
  );

  return (
    <section className="st-card" aria-labelledby="st-drivers-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-drivers-title" className="st-card-title lg">Drivers' championship</h2>
          <p className="st-card-sub">
            {champ.completed ? `After ${champ.completed} of ${champ.totalRounds} rounds` : 'No Grand Prix completed yet'}
            {teamFilter ? ` · ${teamFilter} only` : ''}{champ.hasSprints ? ' · points include sprints' : ''}
          </p>
        </div>
        <div className="st-seg" role="group" aria-label="Sort drivers">
          {SORTS.map(s => <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>{s.label === 'Pts' ? 'Points' : s.label}</button>)}
        </div>
      </div>
      {rows.length === 0 ? <p className="st-empty">Drivers appear after their first Grand Prix start.</p> : (
        <div className="st-scroll">
          <div className="st-grid st-thead" style={{ ['--cols' as any]: D_COLS, ['--minw' as any]: '1010px' }} role="row">
            <span className="st-th">Pos</span>
            <span className="st-th">Driver</span>
            <span className="st-th">Constructor</span>
            <span className="st-th c">{sortBtn('wins', 'Wins')}</span>
            <span className="st-th c">{sortBtn('podiums', 'Podiums')}</span>
            <span className="st-th c">P2</span>
            <span className="st-th c">P3</span>
            <span className="st-th c">{sortBtn('poles', 'Poles')}</span>
            <span className="st-th c">{sortBtn('best', 'Best')}</span>
            <span className="st-th">Form, last 5</span>
            <span className="st-th r">{sortBtn('points', 'Pts')}</span>
          </div>
          <div role="rowgroup">
            {rows.map((d: any) => {
              const open = () => onOpen(d.name);
              const gap = leaderPts - d.points;
              return (
                <motion.div key={d.name} {...motionProps}
                  className={`st-grid st-row${d.isPlayer ? ' is-player' : ''}`}
                  style={{ ['--cols' as any]: D_COLS, ['--minw' as any]: '1010px' }}
                  role="button" tabIndex={0} aria-label={`${d.name}, P${d.pos}, ${d.points} points. Open driver profile`}
                  onClick={open} onKeyDown={rowKey(open)}>
                  <PosCell row={d} started={started} />
                  <span className="st-who">
                    <Avatar name={d.name} />
                    <span style={{ minWidth: 0 }}>
                      <span className="st-who-name" style={{ display: 'block' }}>{d.name}</span>
                      <span className="st-who-meta"><Flag name={d.name} />{d.isPlayer && <span className="st-you">Your driver</span>}</span>
                    </span>
                  </span>
                  <span className="st-td"><TeamMark name={d.team} player={champ.playerTeam} /></span>
                  {cell(d.wins)}
                  {cell(d.podiums)}
                  {cell(d.p2)}
                  {cell(d.p3)}
                  {cell(d.poles)}
                  <span className={`st-td c num ${d.bestFinish ? 'strong' : 'zero'}`}>{d.bestFinish ? `P${d.bestFinish}` : '—'}</span>
                  <span className="st-td" onClick={e => e.stopPropagation()}><FormChips results={d.form} /></span>
                  <span className="st-td r">
                    <span className="st-pts">{pts(d.points)}</span>
                    {started && <span className="st-pts-gap">{d.pos === 1 ? 'Leader' : gap === 0 ? 'Level' : `−${pts(gap)}`}</span>}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Constructors championship ───────────────────────────────────────────────

const T_COLS = '72px minmax(170px, 1.4fr) minmax(130px, 1fr) repeat(3, 56px) 92px 150px 78px 64px';

export function MomentumCell({ m }: { m: any }) {
  if (!m) return <span className="st-td c zero">—</span>;
  const cls = m.score >= 60 ? 'up' : m.score <= 40 ? 'down' : 'flat';
  const color = cls === 'up' ? 'var(--st-pos)' : cls === 'down' ? 'var(--st-neg)' : 'var(--st-muted)';
  return (
    <span className="st-td c num" style={{ color, display: 'inline-flex', alignItems: 'center', gap: 4 }}
      title={`Momentum ${m.score}/100 · ${m.recentAvg} pts per race over the last 3 (${m.trend >= 0 ? '+' : ''}${m.trend} vs the races before)`}>
      {m.direction === 'up' ? <ArrowUp size={11} strokeWidth={2.5} /> : m.direction === 'down' ? <ArrowDown size={11} strokeWidth={2.5} /> : null}
      {m.score}
    </span>
  );
}

export function ConstructorTable({ champ, teamFilter, onOpen }: { champ: any; teamFilter: string; onOpen: (name: string) => void }) {
  const motionProps = useRowMotion();
  const started = champ.completed > 0 || champ.legacy;
  const leaderPts = champ.teams[0]?.points || 0;
  return (
    <section className="st-card" aria-labelledby="st-teams-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-teams-title" className="st-card-title lg">Constructors' championship</h2>
          <p className="st-card-sub">Every car's result counts: a P1 and a P3 in one race are two podiums.</p>
        </div>
      </div>
      <div className="st-scroll">
        <div className="st-grid st-thead" style={{ ['--cols' as any]: T_COLS, ['--minw' as any]: '1000px' }}>
          <span className="st-th">Pos</span>
          <span className="st-th">Constructor</span>
          <span className="st-th">Drivers</span>
          <span className="st-th c">Wins</span>
          <span className="st-th c">Podiums</span>
          <span className="st-th c">Poles</span>
          <span className="st-th c">Momentum</span>
          <span className="st-th">Form, last 5</span>
          <span className="st-th c">Last race</span>
          <span className="st-th r">Pts</span>
        </div>
        {champ.teams.map((t: any) => {
          const open = () => onOpen(t.name);
          const gap = leaderPts - t.points;
          const dim = teamFilter && teamFilter !== t.name;
          return (
            <motion.div key={t.name} {...motionProps}
              className={`st-grid st-row${t.isPlayer ? ' is-player' : ''}${dim ? ' is-dim' : ''}`}
              style={{ ['--cols' as any]: T_COLS, ['--minw' as any]: '1000px' }}
              role="button" tabIndex={0} aria-label={`${t.name}, P${t.pos}, ${t.points} points. Open constructor performance`}
              onClick={open} onKeyDown={rowKey(open)}>
              <PosCell row={t} started={started} />
              <span className="st-who">
                <i className="st-team-bar" style={{ background: teamColor(t.name, champ.playerTeam), height: 22 }} aria-hidden />
                <span style={{ minWidth: 0 }}>
                  <span className="st-who-name" style={{ display: 'block' }}>{t.name}</span>
                  {t.isPlayer && <span className="st-who-meta"><span className="st-you">Your team</span></span>}
                </span>
              </span>
              <span className="st-td" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.drivers.length ? t.drivers.map(lastName).join(' · ') : '—'}</span>
              {cell(t.wins)}
              {cell(t.podiums)}
              {cell(t.poles)}
              <MomentumCell m={t.momentum} />
              <span className="st-td" onClick={e => e.stopPropagation()}><FormChips results={t.form} isTeam /></span>
              <span className="st-td c">
                {t.lastRace
                  ? <span><b className="num" style={{ color: 'var(--st-text)', fontWeight: 400 }}>{t.lastRace.bestPos ? `P${t.lastRace.bestPos}` : 'DNF'}</b><span style={{ color: 'var(--st-faint)', fontSize: 11 }}> · +{t.lastRace.points}</span></span>
                  : '—'}
              </span>
              <span className="st-td r">
                <span className="st-pts">{pts(t.points)}</span>
                {started && <span className="st-pts-gap">{t.pos === 1 ? 'Leader' : gap === 0 ? 'Level' : `−${pts(gap)}`}</span>}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
