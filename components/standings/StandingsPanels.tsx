import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Timer } from 'lucide-react';
import { formatGap, getPodiumLeaders, teamColor } from '../../utils/championshipModel.js';
import { FormChips } from '../FormChips.tsx';
import { Avatar, InfoTip, MomentumCell, TeamMark, lastName } from './StandingsTables.tsx';

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── KPI strip ───────────────────────────────────────────────────────────────

export function SummaryKpis({ champ, summary }: { champ: any; summary: any }) {
  const started = champ.completed > 0 || champ.legacy;
  const me = summary.team;
  const aheadGap = summary.ahead?.gap ?? null;
  const behindGap = summary.behind?.gap ?? null;
  const levelNote = (other: string, gap: number) => gap === 0 && me?.tieNotes?.find((t: string) => t.includes(other));
  const items = [
    {
      k: 'Constructors position', v: started && summary.pos ? `P${summary.pos}` : '—', color: 'var(--st-accent-ink)',
      sub: started ? (summary.pos === 1 ? 'Championship leader' : `${summary.gapToLeader} pts to the leader`) : 'Season not started',
    },
    { k: 'Constructors points', v: String(summary.points), sub: me ? `${me.wins} win${me.wins === 1 ? '' : 's'} · ${me.podiums} podium${me.podiums === 1 ? '' : 's'}` : '' },
    {
      k: 'Gap to team ahead',
      v: !started ? '—' : summary.ahead ? formatGap(-aheadGap) : 'Leading',
      color: !started || !summary.ahead ? undefined : aheadGap > 0 ? 'var(--st-neg)' : undefined,
      sub: summary.ahead ? `P${summary.pos - 1} · ${summary.ahead.name}` : started ? 'No one ahead' : '',
      tip: summary.ahead ? levelNote(summary.ahead.name, aheadGap) : null,
    },
    {
      k: 'Gap to team behind',
      v: !started ? '—' : summary.behind ? formatGap(behindGap) : 'Last',
      color: !started || !summary.behind ? undefined : behindGap > 0 ? 'var(--st-pos)' : undefined,
      sub: summary.behind ? `P${summary.pos + 1} · ${summary.behind.name}` : '',
      tip: summary.behind ? levelNote(summary.behind.name, behindGap) : null,
    },
    {
      k: 'Championship round',
      v: champ.isCurrent ? (champ.seasonOver ? 'Final' : `R${champ.currentRound}`) : `S${champ.season}`,
      sub: champ.isCurrent ? (champ.seasonOver ? 'Season complete' : `of ${champ.totalRounds}`) : 'Past season',
    },
    { k: 'Completed', v: String(champ.completed), sub: champ.completed === 1 ? 'Grand Prix' : 'Grands Prix' },
    { k: 'Remaining', v: String(champ.remaining), sub: champ.remaining ? `${champ.remaining * 43} pts on offer per team` : 'Title decided' },
  ];
  return (
    <div className="st-kpis" role="list" aria-label="Championship summary">
      {items.map(it => (
        <div key={it.k} className="st-kpi" role="listitem">
          <span className="st-k">{it.k}</span>
          <span className="st-kpi-val" style={{ color: it.color || 'var(--st-text)' }}>{it.v}</span>
          <span className="st-kpi-sub">{it.sub}{it.tip && <InfoTip lines={[it.tip]} label="Tie-break" />}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Team momentum ───────────────────────────────────────────────────────────

const momentumLabel = (m: any) => !m ? null : m.score >= 60 ? ['up', 'Rising'] : m.score <= 40 ? ['down', 'Falling'] : ['flat', 'Steady'];

export function MomentumPanel({ champ, teamName, onOpenTeam }: { champ: any; teamName: string; onOpenTeam: (n: string) => void }) {
  const reduce = useReducedMotion();
  const t = champ.teams.find((x: any) => x.name === teamName) || champ.teams.find((x: any) => x.isPlayer);
  if (!t) return null;
  const m = t.momentum;
  const lbl = momentumLabel(m);
  const maxPts = Math.max(1, ...t.form.map((r: any) => r.points));
  const others = champ.teams.filter((x: any) => x.name !== t.name && x.momentum);
  const rising = [...others].sort((a: any, b: any) => b.momentum.score - a.momentum.score).slice(0, 2);
  const falling = [...others].sort((a: any, b: any) => a.momentum.score - b.momentum.score).slice(0, 2).filter((x: any) => !rising.includes(x));
  const posChg = t.posChange5;

  return (
    <section className="st-card" aria-labelledby="st-mom-title" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="st-card-head">
        <div>
          <h2 id="st-mom-title" className="st-card-title">Team momentum</h2>
          <p className="st-card-sub">{t.name} · last {t.form.length || 0} races</p>
        </div>
      </div>
      <div className="st-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!m ? <p className="st-card-sub" style={{ margin: 0 }}>Momentum needs at least two completed races.</p> : (
          <div className="st-mom-score">
            <b style={{ color: lbl![0] === 'up' ? 'var(--st-pos)' : lbl![0] === 'down' ? 'var(--st-neg)' : 'var(--st-text)' }}>{m.score}</b>
            <span className={`st-tag ${lbl![0]}`}>{lbl![1]}</span>
            <InfoTip label="How momentum is calculated" lines={[
              'Half: share of the points available over the last 3 races.',
              `Half: trend — ${m.recentAvg} pts per race over the last 3, ${m.trend >= 0 ? '+' : ''}${m.trend} vs the races before.`,
              '50 is steady. Above 60 is rising, below 40 is falling.',
            ]} />
          </div>
        )}
        {t.form.length > 0 && (
          <div className="st-timeline" aria-label="Points per race, last five races">
            {t.form.map((r: any, i: number) => (
              <div key={r.round} className="st-tl-col" title={`R${r.round} ${r.name}: ${r.points} pts, best ${r.bestPos ? `P${r.bestPos}` : 'DNF'}${r.podiums ? `, ${r.podiums} podium${r.podiums > 1 ? 's' : ''}` : ''}`}>
                <span className="st-tl-pts">{r.points}</span>
                <span className={`st-tl-bar${t.isPlayer ? ' is-player' : ''}`}>
                  <motion.i style={{ height: `${Math.max(4, (r.points / maxPts) * 100)}%` }}
                    initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 * i }} />
                </span>
                <span className="st-tl-rd">R{r.round}{r.podiums ? ' ●'.repeat(Math.min(2, r.podiums)) : ''}</span>
              </div>
            ))}
          </div>
        )}
        <div className="st-mini-stats">
          <div className="st-mini"><span className="st-k">Pts, last 5</span><b>{t.last5Points}</b></div>
          <div className="st-mini"><span className="st-k">Podiums, last 5</span><b>{t.last5Podiums}</b></div>
          <div className="st-mini">
            <span className="st-k">{t.posChange5From ? `Since R${t.posChange5From}` : 'Position'}</span>
            <b style={{ color: posChg > 0 ? 'var(--st-pos)' : posChg < 0 ? 'var(--st-neg)' : undefined, display: 'flex', alignItems: 'center', gap: 2 }}>
              {posChg == null ? '—' : posChg === 0 ? '±0' : <>{posChg > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{Math.abs(posChg)}</>}
            </b>
          </div>
        </div>
        {(rising.length > 0 || falling.length > 0) && (
          <div>
            <span className="st-k" style={{ marginBottom: 4 }}>Across the grid</span>
            <div className="st-movers">
              {[...rising, ...falling].map((x: any) => (
                <button key={x.name} type="button" className="st-mover" onClick={() => onOpenTeam(x.name)}>
                  <TeamMark name={x.name} player={champ.playerTeam} />
                  <span style={{ fontSize: 11, color: 'var(--st-faint)' }}>{x.momentum.trend >= 0 ? '+' : ''}{x.momentum.trend}/race</span>
                  <MomentumCell m={x.momentum} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Recent results ──────────────────────────────────────────────────────────

export function RecentResults({ champ, race, onOpenClassification, onOpenHistory, onOpenDriver }: {
  champ: any; race: any; onOpenClassification: (r: any) => void; onOpenHistory: () => void; onOpenDriver: (n: string) => void;
}) {
  if (!race) {
    return (
      <section className="st-card" aria-labelledby="st-recent-title">
        <div className="st-card-head"><h2 id="st-recent-title" className="st-card-title">Latest Grand Prix</h2></div>
        <p className="st-empty">Results appear after the first Grand Prix.</p>
      </section>
    );
  }
  const results = [...(race.driverResults || [])].sort((a, b) => a.finishPos - b.finishPos);
  const podium = results.filter(r => !r.retired).slice(0, 3);
  const mine = results.filter(r => r.team === champ.playerTeam);
  const teamPts = new Map<string, number>();
  results.forEach(r => teamPts.set(r.team, (teamPts.get(r.team) || 0) + (r.points || 0)));
  const teamRows = [...teamPts.entries()].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const awarded = results.reduce((s, r) => s + (r.points || 0), 0);

  return (
    <section className="st-card" aria-labelledby="st-recent-title">
      <div className="st-card-head">
        <div style={{ minWidth: 0 }}>
          <h2 id="st-recent-title" className="st-card-title">Latest Grand Prix</h2>
          <p className="st-card-sub">Round {race.round} · {race.name}</p>
        </div>
      </div>
      <div className="st-list">
        {podium.map(r => (
          <button key={r.name} type="button" className={`st-li${r.team === champ.playerTeam ? ' is-player' : ''}`} onClick={() => onOpenDriver(r.name)}>
            <span className={`st-li-pos${r.finishPos === 1 ? ' p1' : ''}`}>P{r.finishPos}</span>
            <span className="st-li-main"><Avatar name={r.name} size={26} />
              <span className="st-li-text"><span className="st-li-name">{r.name}</span><span className="st-li-sub">{r.team}</span></span>
            </span>
            <span className="st-li-val">+{r.points}</span>
          </button>
        ))}
      </div>
      {mine.length > 0 && <>
        <div className="st-section-k">Your drivers</div>
        {mine.map(r => (
          <div key={r.name} className="st-kv">
            <span>{r.name}{r.gridPos ? <span style={{ color: 'var(--st-faint)' }}> · from P{r.gridPos}</span> : null}</span>
            <b style={{ color: r.retired ? 'var(--st-neg)' : undefined }}>{r.retired ? 'DNF' : `P${r.finishPos}`} · {r.points} pts</b>
          </div>
        ))}
      </>}
      <div className="st-section-k">Constructor points this race</div>
      {teamRows.map(([team, p]) => (
        <div key={team} className="st-kv">
          <TeamMark name={team} player={champ.playerTeam} />
          <b>{p}</b>
        </div>
      ))}
      <div className="st-kv" style={{ marginTop: 4 }}><span>Points awarded</span><b>{awarded}</b></div>
      {race.fastestLap && (
        <div className="st-kv"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Timer size={12} /> Fastest lap</span><b>{race.fastestLap}</b></div>
      )}
      <div className="st-actions">
        <button type="button" className="hub-btn hub-btn-secondary" onClick={() => onOpenClassification(race)}>Full classification</button>
        <button type="button" className="hub-btn hub-btn-ghost" onClick={onOpenHistory}>Race history</button>
      </div>
    </section>
  );
}

// ─── Podium leaderboard ──────────────────────────────────────────────────────

export function PodiumLeaderboard({ champ, teamFilter, onOpenDriver, limit = 8 }: { champ: any; teamFilter: string; onOpenDriver: (n: string) => void; limit?: number }) {
  const list = getPodiumLeaders(champ).filter((d: any) => !teamFilter || d.team === teamFilter);
  const shown = list.slice(0, limit);
  return (
    <section className="st-card" aria-labelledby="st-pod-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-pod-title" className="st-card-title">Podium leaderboard</h2>
          <p className="st-card-sub">Grand Prix podiums{champ.hasSprints ? ' (sprints excluded)' : ''} · {champ.isCurrent ? 'this season' : `season ${champ.season}`}</p>
        </div>
      </div>
      {shown.length === 0 ? <p className="st-empty">No podiums yet{teamFilter ? ` for ${teamFilter}` : ''}.</p> : (
        <div className="st-list">
          {shown.map((d: any, i: number) => (
            <button key={d.name} type="button" className={`st-li${d.isPlayer ? ' is-player' : ''}`} onClick={() => onOpenDriver(d.name)}
              aria-label={`${d.name}: ${d.podiums} podiums, ${d.wins} wins, ${d.p2} second, ${d.p3} third`}>
              <span className="st-li-pos">{i + 1}</span>
              <span className="st-li-main"><Avatar name={d.name} size={26} />
                <span className="st-li-text"><span className="st-li-name">{d.name}</span><span className="st-li-sub">{d.team}</span></span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span className="st-pcounts" aria-hidden>
                  <span className="st-pc w" title="Wins">{d.wins}</span>
                  <span className="st-pc" title="Second places">{d.p2}</span>
                  <span className="st-pc" title="Third places">{d.p3}</span>
                </span>
                <span className="st-li-val">{d.podiums}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {list.length > shown.length && <p className="st-card-sub" style={{ padding: '10px 20px 16px' }}>+{list.length - shown.length} more drivers with podiums</p>}
    </section>
  );
}

/** Constructors' podium split: wins, P2s, P3s and total, every car counted. */
export function ConstructorPodiums({ champ, onOpenTeam }: { champ: any; onOpenTeam: (n: string) => void }) {
  const list = [...champ.teams].filter((t: any) => t.podiums > 0)
    .sort((a: any, b: any) => b.podiums - a.podiums || b.wins - a.wins || b.p2 - a.p2 || a.pos - b.pos);
  return (
    <section className="st-card" aria-labelledby="st-cpod-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-cpod-title" className="st-card-title">Constructor podiums</h2>
          <p className="st-card-sub">Each car on the podium counts once</p>
        </div>
      </div>
      {list.length === 0 ? <p className="st-empty">No podiums yet.</p> : (
        <div className="st-list">
          {list.map((t: any, i: number) => (
            <button key={t.name} type="button" className={`st-li${t.isPlayer ? ' is-player' : ''}`} onClick={() => onOpenTeam(t.name)}>
              <span className="st-li-pos">{i + 1}</span>
              <span className="st-li-main"><TeamMark name={t.name} player={champ.playerTeam} /></span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span className="st-pcounts" aria-hidden>
                  <span className="st-pc w" title="Wins">{t.wins}</span>
                  <span className="st-pc" title="Second places">{t.p2}</span>
                  <span className="st-pc" title="Third places">{t.p3}</span>
                </span>
                <span className="st-li-val">{t.podiums}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Season results list ─────────────────────────────────────────────────────

export function SeasonResults({ champ, onOpenClassification }: { champ: any; onOpenClassification: (r: any) => void }) {
  const races = [...champ.grandsPrix].reverse();
  const cols = '56px minmax(180px, 1.4fr) repeat(3, minmax(120px, 1fr)) minmax(110px, 0.8fr) 120px';
  return (
    <section className="st-card" aria-labelledby="st-res-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-res-title" className="st-card-title lg">Race results</h2>
          <p className="st-card-sub">Every completed Grand Prix of {champ.isCurrent ? 'this season' : `season ${champ.season}`}</p>
        </div>
      </div>
      {!races.length ? <p className="st-empty">No completed Grand Prix yet.</p> : (
        <div className="st-scroll">
          <div className="st-grid st-thead" style={{ ['--cols' as any]: cols, ['--minw' as any]: '960px' }}>
            <span className="st-th">Rd</span><span className="st-th">Grand Prix</span>
            <span className="st-th">Winner</span><span className="st-th">Second</span><span className="st-th">Third</span>
            <span className="st-th">Your best</span><span className="st-th r" />
          </div>
          {races.map((race: any) => {
            const res = [...race.driverResults].sort((a: any, b: any) => a.finishPos - b.finishPos);
            const pod = res.filter((r: any) => !r.retired).slice(0, 3);
            const mine = res.filter((r: any) => r.team === champ.playerTeam);
            const best = mine.filter((r: any) => !r.retired).sort((a: any, b: any) => a.finishPos - b.finishPos)[0];
            const open = () => onOpenClassification(race);
            return (
              <div key={race.round} className="st-grid st-row" style={{ ['--cols' as any]: cols, ['--minw' as any]: '960px' }}
                role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
                aria-label={`Round ${race.round} ${race.name}. Open classification`}>
                <span className="st-td num">R{race.round}</span>
                <span className="st-td strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{race.name}</span>
                {[0, 1, 2].map(i => (
                  <span key={i} className="st-td" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pod[i] ? <><i className="st-team-bar" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, background: teamColor(pod[i].team, champ.playerTeam) }} />{pod[i].name}</> : '—'}
                  </span>
                ))}
                <span className="st-td num strong">{best ? `P${best.finishPos}` : mine.length ? 'DNF' : '—'}<span style={{ color: 'var(--st-faint)', fontFamily: 'Formula1-Regular' }}>{mine.length ? ` · ${mine.reduce((s: number, r: any) => s + r.points, 0)} pts` : ''}</span></span>
                <span className="st-td r" style={{ color: 'var(--st-faint)', fontSize: 12 }}>Classification ›</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Momentum table (analytics) ──────────────────────────────────────────────

export function MomentumTable({ champ, onOpenTeam }: { champ: any; onOpenTeam: (n: string) => void }) {
  const list = [...champ.teams].sort((a: any, b: any) => (b.momentum?.score ?? -1) - (a.momentum?.score ?? -1) || a.pos - b.pos);
  const cols = '36px minmax(160px, 1.3fr) 160px 80px 80px 90px 90px';
  return (
    <section className="st-card" aria-labelledby="st-momt-title">
      <div className="st-card-head">
        <div>
          <h2 id="st-momt-title" className="st-card-title">Momentum across the grid</h2>
          <p className="st-card-sub">From the last five Grands Prix only</p>
        </div>
      </div>
      <div className="st-scroll">
        <div className="st-grid st-thead" style={{ ['--cols' as any]: cols, ['--minw' as any]: '760px' }}>
          <span className="st-th">#</span><span className="st-th">Constructor</span><span className="st-th">Last 5</span>
          <span className="st-th c">Pts</span><span className="st-th c">Podiums</span><span className="st-th c">Pos change</span><span className="st-th c">Momentum</span>
        </div>
        {list.map((t: any, i: number) => (
          <div key={t.name} className={`st-grid st-row${t.isPlayer ? ' is-player' : ''}`} style={{ ['--cols' as any]: cols, ['--minw' as any]: '760px' }}
            role="button" tabIndex={0} onClick={() => onOpenTeam(t.name)} onKeyDown={e => { if (e.key === 'Enter') onOpenTeam(t.name); }}>
            <span className="st-td num">{i + 1}</span>
            <span className="st-td strong"><TeamMark name={t.name} player={champ.playerTeam} /></span>
            <span className="st-td" onClick={e => e.stopPropagation()}><FormChips results={t.form} isTeam /></span>
            <span className="st-td c num strong">{t.last5Points}</span>
            <span className="st-td c num">{t.last5Podiums}</span>
            <span className="st-td c num" style={{ color: t.posChange5 > 0 ? 'var(--st-pos)' : t.posChange5 < 0 ? 'var(--st-neg)' : undefined }}>
              {t.posChange5 == null ? '—' : t.posChange5 === 0 ? '±0' : `${t.posChange5 > 0 ? '+' : '−'}${Math.abs(t.posChange5)}`}
            </span>
            <MomentumCell m={t.momentum} />
          </div>
        ))}
      </div>
    </section>
  );
}

export { lastName };
