import React, { useEffect, useRef, useState } from 'react';
import { animate, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { buildHelmetAvatar, getDriverHeadshotUrl } from '../../data/drivers.js';
import { formatGap, GP_POINTS, teamColor } from '../../utils/championshipModel.js';
import { Flag, InfoTip } from './StandingsTables.tsx';

const EASE = [0.22, 1, 0.36, 1] as const;
const pts = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// Visual order left → right is P2, P1, P3.
const SLOTS = [
  { pos: 2, tier: 'silver', label: 'Second' },
  { pos: 1, tier: 'gold', label: 'First' },
  { pos: 3, tier: 'bronze', label: 'Third' },
] as const;

/** Counts from the previously shown value to the new one (from 0 on first mount). */
function useCountUp(value: number, delay = 0) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const ctl = animate(from.current, value, {
      duration: 0.9, delay, ease: EASE,
      onUpdate: v => setShown(Number.isInteger(value) ? Math.round(v) : Math.round(v * 10) / 10),
      onComplete: () => { from.current = value; },
    });
    return () => { ctl.stop(); from.current = value; };
  }, [value]);
  return shown;
}

/** Real headshot when the data has one; otherwise a helmet figure in the team's colour. */
function PodiumAvatar({ name, color, size }: { name: string; color: string; size: number }) {
  const url = getDriverHeadshotUrl(name);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const photo = !failed && url && !url.startsWith('data:');
  return (
    <span className={`st-pd-av${photo ? ' photo' : ''}`} style={{ width: size, height: size, ['--tc' as any]: color }}>
      <img src={photo ? url : buildHelmetAvatar(color)} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

function gapLine(row: any, above: any, below: any) {
  if (row.pos === 1) return below ? { text: formatGap(row.points - below.points), note: 'over P2' } : null;
  return above ? { text: formatGap(row.points - above.points), note: `to P${above.pos}` } : null;
}

function DriverCard({ row, above, below, champ, tier, index, onOpenDriver, onOpenTeam, dim }: {
  row: any; above: any; below: any; champ: any; tier: string; index: number; dim: boolean;
  onOpenDriver: (n: string) => void; onOpenTeam: (n: string) => void;
}) {
  const reduce = useReducedMotion();
  const lead = row.pos === 1;
  const color = teamColor(row.team, champ.playerTeam);
  const shown = useCountUp(row.points, reduce ? 0 : 0.35 + index * 0.12);
  const gap = gapLine(row, above, below);
  const first = row.name.split(' ').slice(0, -1).join(' ');
  const last = row.name.split(' ').slice(-1)[0];

  return (
    <motion.div layoutId={`st-pd-${row.name}`} className={`st-pd-card ${tier}${dim ? ' dim' : ''}${row.isPlayer ? ' mine' : ''}`}
      style={{ ['--tc' as any]: color }}
      transition={{ layout: { duration: reduce ? 0 : 0.6, ease: EASE } }}
      onClick={() => onOpenDriver(row.name)}>
      <PodiumAvatar name={row.name} color={color} size={lead ? 76 : 60} />
      <button type="button" className="st-pd-name" onClick={e => { e.stopPropagation(); onOpenDriver(row.name); }}
        aria-label={`P${row.pos} ${row.name}, ${pts(row.points)} points. Open driver profile`}>
        {first && <span className="f">{first}</span>}
        <span className="l">{last}</span>
      </button>
      <span className="st-pd-meta">
        <Flag name={row.name} />
        {row.team && (
          <button type="button" className="st-pd-team" onClick={e => { e.stopPropagation(); onOpenTeam(row.team); }}
            aria-label={`Open ${row.team} constructor profile`}>
            <i style={{ background: color }} aria-hidden />{row.team}
          </button>
        )}
      </span>
      <span className="st-pd-pts">
        <b className="st-num">{pts(shown)}</b><small>PTS</small>
        {row.tieNotes?.length > 0 && <span onClick={e => e.stopPropagation()}><InfoTip lines={row.tieNotes} /></span>}
      </span>
      <span className="st-pd-sub">
        <span><b>{row.wins}</b> {row.wins === 1 ? 'win' : 'wins'}</span>
        <span><b>{row.podiums}</b> {row.podiums === 1 ? 'podium' : 'podiums'}</span>
      </span>
      {gap && <span className={`st-pd-gap ${lead ? 'up' : gap.text === '0 PTS' ? '' : 'down'}`}>{gap.text}<em>{gap.note}</em></span>}
    </motion.div>
  );
}

function Platform({ slot, row, index }: { slot: typeof SLOTS[number]; row: any; index: number }) {
  const reduce = useReducedMotion();
  const avg = row?.avgFinish ? row.avgFinish.toFixed(1) : '—';
  return (
    // Rises out of the floor: a clip reveal (not a height tween) keeps the numeral undistorted.
    <motion.div className={`st-pd-plat ${slot.tier}`}
      initial={reduce ? false : { clipPath: 'inset(100% -40% 0% -40%)' }} animate={{ clipPath: 'inset(-60% -40% -60% -40%)' }}
      transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.1 + index * 0.1, ease: EASE }}>
      <span className="st-pd-top" aria-hidden />
      <div className="st-pd-front">
        <span className="st-pd-num" aria-hidden>{slot.pos}</span>
        {row && (
          <dl className="st-pd-more">
            <div><dt>Poles</dt><dd>{row.poles}</dd></div>
            <div><dt>Best</dt><dd>{row.bestFinish ? `P${row.bestFinish}` : '—'}</dd></div>
            <div><dt>Avg finish</dt><dd>{avg}</dd></div>
            <div><dt>DNFs</dt><dd>{row.dnfs || 0}</dd></div>
          </dl>
        )}
      </div>
      <span className="st-pd-shadow" aria-hidden />
    </motion.div>
  );
}

/** Drivers' championship top three as a broadcast-style podium, built from the same rows as the table. */
export function ChampionshipPodium({ champ, teamFilter, onOpenDriver, onOpenTeam }: {
  champ: any; teamFilter: string; onOpenDriver: (n: string) => void; onOpenTeam: (n: string) => void;
}) {
  const reduce = useReducedMotion();
  const started = champ.completed > 0;
  const top = started ? champ.drivers.slice(0, 3) : [];
  const [p1, p2] = top;
  const leadGap = p1 && p2 ? p1.points - p2.points : null;
  const available = champ.remaining * GP_POINTS[0];
  const filtered = teamFilter ? champ.drivers.filter((d: any) => d.team === teamFilter) : [];
  const filterBest = filtered[0];
  const filterOffPodium = teamFilter && filterBest && filterBest.pos > 3;

  const leaderLabel = !champ.isCurrent || champ.seasonOver ? `Season ${champ.season} champion` : 'Current championship leader';
  const roundLabel = champ.isCurrent && !champ.seasonOver ? `Round ${champ.currentRound} of ${champ.totalRounds}` : `${champ.completed} of ${champ.totalRounds} rounds`;

  const stats = [
    { k: leaderLabel, v: p1 ? p1.name : '—', sub: p1 ? p1.team : 'After the first Grand Prix', color: p1 ? teamColor(p1.team, champ.playerTeam) : undefined },
    { k: 'Championship round', v: roundLabel, sub: `${champ.completed} completed` },
    { k: 'Points still available', v: champ.remaining ? `${available} PTS` : 'None', sub: champ.remaining ? `${champ.remaining} × ${GP_POINTS[0]} for a win` : 'Title decided' },
    { k: 'Gap P1 to P2', v: leadGap == null ? '—' : formatGap(leadGap, { sign: false }), sub: leadGap == null ? 'No points yet' : leadGap === 0 ? 'Level, split on count-back' : p2 ? `${p2.name.split(' ').slice(-1)[0]} chasing` : '' },
  ];

  return (
    <section className="st-pd" aria-labelledby="st-pd-title">
      <svg className="st-pd-track" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <path d="M120 210 C 80 210 60 180 80 150 L 150 70 C 170 45 205 40 230 58 L 300 110 C 320 125 345 122 360 104 L 420 40 C 440 20 470 22 488 42 L 560 120 C 575 136 600 138 618 126 L 690 80 C 720 62 752 80 748 114 L 736 200 C 732 232 708 250 676 250 L 330 250 C 300 250 285 232 260 222 C 230 210 200 210 170 210 Z" />
      </svg>

      <div className="st-pd-summary" role="list">
        {stats.map((s, i) => (
          <motion.div key={s.k} className="st-pd-stat" role="listitem"
            initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05, ease: EASE }}>
            <span className="k">{s.k}</span>
            <span className="v">{s.color && <i style={{ background: s.color }} aria-hidden />}{s.v}</span>
            <span className="s">{s.sub}</span>
          </motion.div>
        ))}
      </div>

      <div className="st-pd-stage-wrap">
        <h2 id="st-pd-title" className="st-pd-title">Drivers' championship <span>{started ? `top three after round ${champ.progression.rounds[champ.progression.rounds.length - 1]?.round}` : 'podium'}</span></h2>
        <LayoutGroup id={`st-pd-${champ.season}`}>
          <ol className="st-pd-stage">
            {SLOTS.map((slot, i) => {
              const row = top[slot.pos - 1] || null;
              const above = top[slot.pos - 2] || null;
              const below = top[slot.pos] || null;
              return (
                <motion.li key={slot.pos} className={`st-pd-col ${slot.tier}${slot.pos === 1 ? ' lead' : ''}`}
                  aria-label={row ? `${slot.label}: ${row.name}` : `${slot.label}: to be decided`}
                  initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : [0.15, 0, 0.25][i], ease: EASE }}>
                  <span className="st-pd-beam" aria-hidden />
                  <div className="st-pd-slot">
                    {row ? (
                      <DriverCard row={row} above={above} below={below} champ={champ} tier={slot.tier} index={i}
                        dim={!!teamFilter && row.team !== teamFilter} onOpenDriver={onOpenDriver} onOpenTeam={onOpenTeam} />
                    ) : (
                      <div className="st-pd-card empty"><span className="st-pd-av" /><span className="st-pd-tbd">{started ? 'No driver' : 'To be decided'}</span></div>
                    )}
                  </div>
                  <Platform slot={slot} row={row} index={i} />
                </motion.li>
              );
            })}
          </ol>
        </LayoutGroup>
        {!started && <p className="st-pd-note">The podium fills in after the first Grand Prix of the season.</p>}
        {filterOffPodium && (
          <p className="st-pd-note">
            Best {teamFilter} driver: <button type="button" onClick={() => onOpenDriver(filterBest.name)}>P{filterBest.pos} {filterBest.name}</button>, {formatGap(filterBest.points - top[2].points, { sign: false })} off the podium
          </p>
        )}
      </div>
    </section>
  );
}
