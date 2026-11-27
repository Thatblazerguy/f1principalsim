import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, Timer } from 'lucide-react';
import { btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { getDriverNationality } from '../../utils/driverProfileModel.js';
import { teamColor } from '../../utils/championshipModel.js';
import { FormChips } from '../FormChips.tsx';
import { Avatar, MomentumCell, TeamMark } from './StandingsTables.tsx';
import '../dashboard/dashboard-interactive.css';

export type Detail = { kind: 'driver' | 'team'; name: string } | { kind: 'race'; race: any } | null;

const EASE = [0.22, 1, 0.36, 1] as const;

function Shell({ open, title, kicker, onClose, children, head }: { open: boolean; title: string; kicker: string; onClose: () => void; children: React.ReactNode; head?: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useDialogFocus(open, panelRef, onClose, closeRef);
  return (
    <div className="dbx-drawer-root">
      <motion.div className="dbx-overlay" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25, ease: EASE }} />
      <motion.div ref={panelRef} className="dbx-drawer st-drawer st-root" role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ gap: 0 }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32 }} transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}>
        <header className="dbx-drawer-head">
          <div style={{ minWidth: 0, display: 'flex', gap: 14, alignItems: 'center' }}>
            {head}
            <div style={{ minWidth: 0 }}>
              <span className="dbx-k">{kicker}</span>
              <h2 id={titleId} className="dbx-drawer-title" style={{ color: 'var(--st-text)' }}>{title}</h2>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className={btnClass('ghost')} style={iconBtn('sm')}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        <div className="dbx-drawer-body">{children}</div>
      </motion.div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return <div className="st-mini"><span className="st-k">{k}</span><b>{v}</b>{sub && <span className="st-k" style={{ marginTop: 2 }}>{sub}</span>}</div>;
}

/** Bars for points per round plus a line for championship position. */
function RoundBars({ races, posByRound, color }: { races: any[]; posByRound: Map<number, number>; color: string }) {
  const reduce = useReducedMotion();
  if (!races.length) return null;
  const W = 560, H = 120, pad = 18;
  const max = Math.max(1, ...races.map(r => r.points));
  const bw = Math.min(22, (W - pad * 2) / races.length - 4);
  const xAt = (i: number) => pad + (i + 0.5) * ((W - pad * 2) / races.length);
  const positions = races.map(r => posByRound.get(r.round) ?? null);
  const maxPos = Math.max(2, ...positions.filter((p): p is number => p != null));
  const yPos = (p: number) => 10 + ((p - 1) / (maxPos - 1)) * (H - 40);
  const line = positions.map((p, i) => p == null ? null : `${xAt(i).toFixed(1)},${yPos(p).toFixed(1)}`).filter(Boolean).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-spark" role="img" aria-label="Points per round and championship position">
      {races.map((r, i) => {
        const h = Math.max(2, (r.points / max) * (H - 40));
        return (
          <g key={r.round}>
            <motion.rect x={xAt(i) - bw / 2} y={H - 22 - h} width={bw} height={h} rx={2} fill={color} opacity={0.55}
              style={{ transformOrigin: `${xAt(i)}px ${H - 22}px` }}
              initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.45, ease: EASE, delay: i * 0.02 }} />
            <text x={xAt(i)} y={H - 8} textAnchor="middle" className="st-axis" style={{ fontSize: 9 }}>R{r.round}</text>
            <title>{`R${r.round} ${r.name}: ${r.points} pts${positions[i] ? `, P${positions[i]} in the championship` : ''}`}</title>
          </g>
        );
      })}
      {line && <polyline points={line} fill="none" stroke="#ededed" strokeWidth={1.25} strokeOpacity={0.7} />}
      {positions.map((p, i) => p == null ? null : <circle key={i} cx={xAt(i)} cy={yPos(p)} r={2} fill="#ededed" />)}
    </svg>
  );
}

function DriverDetail({ champ, name, driverObj }: { champ: any; name: string; driverObj: any }) {
  const d = champ.drivers.find((x: any) => x.name === name);
  if (!d) return <p className="st-empty">No Grand Prix starts recorded for {name} in this season.</p>;
  const posByRound = new Map<number, number>(champ.progression.rounds.map((r: any, i: number) => [r.round, champ.progression.drivers[i][name]?.pos]));
  const nat = getDriverNationality({ name, ...(driverObj || {}) });
  return (
    <>
      <div className="dbx-section">
        <div className="st-who-meta" style={{ fontSize: 12, marginBottom: 12 }}>
          {nat?.flag && <span className="st-flag">{nat.flag}</span>}{nat?.country && <span>{nat.country}</span>}
          <TeamMark name={d.team} player={champ.playerTeam} />
          {d.teams.length > 1 && <span>· also raced for {d.teams.filter((t: string) => t !== d.team).join(', ')}</span>}
        </div>
        <div className="st-stat-grid">
          <Stat k="Position" v={champ.completed ? `P${d.pos}` : '—'} sub={d.posChange ? `${d.posChange > 0 ? '+' : '−'}${Math.abs(d.posChange)} last round` : undefined} />
          <Stat k="Points" v={d.points} sub={d.sprintPoints ? `${d.sprintPoints} from sprints` : undefined} />
          <Stat k="Wins" v={d.wins} />
          <Stat k="Podiums" v={d.podiums} sub={`${d.wins} · ${d.p2} · ${d.p3}`} />
          <Stat k="Poles" v={d.poles} />
          <Stat k="Starts" v={d.starts} sub={d.dnfs ? `${d.dnfs} DNF` : 'No DNFs'} />
          <Stat k="Avg finish" v={d.avgFinish ? `P${d.avgFinish.toFixed(1)}` : '—'} />
          <Stat k="Avg grid" v={d.avgGrid ? `P${d.avgGrid.toFixed(1)}` : '—'} />
        </div>
        {d.tieNotes?.length > 0 && <p className="dbx-note">{d.tieNotes.join(' ')}</p>}
      </div>
      <div className="dbx-section">
        <h3 className="dbx-section-title">Points per round · championship position</h3>
        <RoundBars races={d.races} posByRound={posByRound} color={d.isPlayer ? '#E10600' : teamColor(d.team, champ.playerTeam)} />
        <div style={{ marginTop: 10 }}><span className="st-k" style={{ marginBottom: 6 }}>Form, last 5</span><FormChips results={d.form} /></div>
      </div>
      {driverObj && (
        <div className="dbx-section">
          <h3 className="dbx-section-title">Current ratings</h3>
          <div className="st-stat-grid">
            <Stat k="Race pace" v={driverObj.pace ?? '—'} />
            <Stat k="Qualifying" v={driverObj.quali ?? '—'} />
            <Stat k="Racecraft" v={driverObj.racecraft ?? '—'} />
            <Stat k="Consistency" v={driverObj.consistency ?? '—'} />
          </div>
        </div>
      )}
      <div className="dbx-section">
        <h3 className="dbx-section-title">Race by race</h3>
        <table className="st-res-table">
          <thead><tr><th>Rd</th><th>Grand Prix</th><th className="n">Grid</th><th className="n">Finish</th><th className="n">Pts</th><th className="n">Champ.</th></tr></thead>
          <tbody>
            {[...d.races].reverse().map((r: any) => (
              <tr key={r.round}>
                <td>R{r.round}</td><td className="trunc strong">{r.name}</td>
                <td className="n">{r.gridPos ? `P${r.gridPos}` : '—'}</td>
                <td className="n" style={{ color: r.retired ? 'var(--st-neg)' : r.finishPos <= 3 ? 'var(--st-text)' : undefined }}>{r.retired ? 'DNF' : `P${r.finishPos}`}</td>
                <td className="n strong">{r.points}</td>
                <td className="n">{posByRound.get(r.round) ? `P${posByRound.get(r.round)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TeamDetail({ champ, name }: { champ: any; name: string }) {
  const t = champ.teams.find((x: any) => x.name === name);
  if (!t) return <p className="st-empty">No results recorded for {name} in this season.</p>;
  const posByRound = new Map<number, number>(champ.progression.rounds.map((r: any, i: number) => [r.round, champ.progression.teams[i][name]?.pos]));
  const drivers = champ.drivers.filter((d: any) => t.drivers.includes(d.name));
  const teamPtsFrom = (dn: string) => drivers.find((d: any) => d.name === dn)?.races.filter((r: any) => r.team === name).reduce((s: number, r: any) => s + r.points, 0) || 0;
  return (
    <>
      <div className="dbx-section">
        <div className="st-stat-grid">
          <Stat k="Position" v={champ.completed ? `P${t.pos}` : '—'} sub={t.posChange ? `${t.posChange > 0 ? '+' : '−'}${Math.abs(t.posChange)} last round` : undefined} />
          <Stat k="Points" v={t.points} />
          <Stat k="Wins" v={t.wins} />
          <Stat k="Podiums" v={t.podiums} sub={`${t.wins} · ${t.p2} · ${t.p3}`} />
          <Stat k="Poles" v={t.poles} />
          <Stat k="Retirements" v={t.dnfs} />
          <Stat k="Pts, last 5" v={t.last5Points} />
          <Stat k="Momentum" v={<MomentumCell m={t.momentum} />} />
        </div>
        {t.tieNotes?.length > 0 && <p className="dbx-note">{t.tieNotes.join(' ')}</p>}
      </div>
      <div className="dbx-section">
        <h3 className="dbx-section-title">Driver contribution</h3>
        {drivers.map((d: any) => {
          const pts = teamPtsFrom(d.name);
          const share = t.points ? pts / t.points : 0;
          return (
            <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) 120px 48px', gap: 10, alignItems: 'center', minHeight: 40 }}>
              <Avatar name={d.name} size={26} />
              <span style={{ minWidth: 0 }}>
                <span className="st-li-name">{d.name}</span>
                <span className="st-li-sub">P{d.pos} in drivers · {d.wins}W · {d.podiums} podiums</span>
              </span>
              <span className="st-cmp-bar b" style={{ height: 4 }}><i style={{ width: `${share * 100}%`, background: teamColor(name, champ.playerTeam) }} /></span>
              <span className="st-num" style={{ textAlign: 'right' }}>{pts}</span>
            </div>
          );
        })}
      </div>
      <div className="dbx-section">
        <h3 className="dbx-section-title">Points per round · championship position</h3>
        <RoundBars races={t.races} posByRound={posByRound} color={teamColor(name, champ.playerTeam)} />
      </div>
      <div className="dbx-section">
        <h3 className="dbx-section-title">Race by race</h3>
        <table className="st-res-table">
          <thead><tr><th>Rd</th><th>Grand Prix</th><th>Finishes</th><th className="n">Pts</th><th className="n">Champ.</th></tr></thead>
          <tbody>
            {[...t.races].reverse().map((r: any) => (
              <tr key={r.round}>
                <td>R{r.round}</td><td className="trunc strong">{r.name}</td>
                <td>{r.positions.map((p: any) => `${p.name.split(' ').slice(-1)[0]} ${p.retired ? 'DNF' : `P${p.finishPos}`}`).join(' · ')}</td>
                <td className="n strong">{r.points}</td>
                <td className="n">{posByRound.get(r.round) ? `P${posByRound.get(r.round)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Classification({ race, playerTeam }: { race: any; playerTeam: string }) {
  const res = [...(race.driverResults || [])].sort((a, b) => a.finishPos - b.finishPos);
  return (
    <div className="dbx-section">
      <p className="dbx-note" style={{ marginTop: 0, marginBottom: 12 }}>{race.circuit}{race.weather ? ` · ${race.weather}` : ''}</p>
      <table className="st-res-table">
        <thead><tr><th>Pos</th><th>Driver</th><th>Constructor</th><th className="n">Grid</th><th className="n">+/−</th><th className="n">Pts</th></tr></thead>
        <tbody>
          {res.map(r => {
            const delta = r.gridPos && !r.retired ? r.gridPos - r.finishPos : null;
            return (
              <tr key={r.name} className={r.team === playerTeam ? 'is-player' : ''}>
                <td className="strong" style={{ color: r.retired ? 'var(--st-neg)' : undefined }}>{r.retired ? 'DNF' : `P${r.finishPos}`}</td>
                <td className="trunc strong">
                  {r.name}{race.fastestLap === r.name && <span title="Fastest lap" style={{ marginLeft: 6, color: '#b48ef0', verticalAlign: 'middle' }}><Timer size={11} /></span>}
                </td>
                <td><TeamMark name={r.team} player={playerTeam} /></td>
                <td className="n">{r.gridPos ? `P${r.gridPos}` : '—'}</td>
                <td className="n" style={{ color: delta > 0 ? 'var(--st-pos)' : delta < 0 ? 'var(--st-neg)' : undefined }}>{delta == null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}</td>
                <td className="n strong">{r.points || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StandingsDetail({ detail, champ, findDriver, onClose }: { detail: Detail; champ: any; findDriver: (n: string) => any; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {detail && (
        detail.kind === 'race' ? (
          <Shell key="race" open title={detail.race.name} kicker={`Round ${detail.race.round} · full classification`} onClose={onClose}>
            <Classification race={detail.race} playerTeam={champ.playerTeam} />
          </Shell>
        ) : detail.kind === 'driver' ? (
          <Shell key={`d-${detail.name}`} open title={detail.name} kicker="Driver profile" onClose={onClose} head={<Avatar name={detail.name} size={48} />}>
            <DriverDetail champ={champ} name={detail.name} driverObj={findDriver(detail.name)} />
          </Shell>
        ) : (
          <Shell key={`t-${detail.name}`} open title={detail.name} kicker="Constructor performance" onClose={onClose}
            head={<i className="st-team-bar" style={{ height: 40, width: 4, background: teamColor(detail.name, champ.playerTeam) }} />}>
            <TeamDetail champ={champ} name={detail.name} />
          </Shell>
        )
      )}
    </AnimatePresence>,
    document.body,
  );
}
