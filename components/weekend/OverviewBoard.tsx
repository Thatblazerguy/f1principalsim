import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Thermometer, Wind, CloudRain, Sun, Droplets, Radio, CircleDot, Timer, ShieldAlert, Wrench, Factory, Trophy, Target,
  Map as MapIcon, Swords, Coins, MessagesSquare, ChevronRight, AlertTriangle, Check, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { HUB, btn, btnClass } from '../HubLayout.tsx';
import { AnimatedNumber } from '../ui/motion.tsx';
import { FinishDistributionBar } from '../ui/ObjectiveCards.tsx';
import { CircuitThumb } from './CircuitMap.tsx';
import { getChampionshipSeries } from '../../utils/dashboardModel.js';
import {
  getPowerUnitReadiness, getFactoryStatus, getChampionshipSituation, getRivalIntel, getCommsTimeline,
  getChallengeHistory, CHALLENGE_RULES, ord,
} from '../../utils/weekendModel.js';

const EASE = [0.22, 1, 0.36, 1] as const;
const last = (n: string) => String(n || '').split(' ').pop();
// "Finish Without DNF" → "Finish without DNF" (acronyms stay upper case)
const sentence = (t: string) => String(t || '').replace(/(^|\s)(\w)(\w*)/g, (m, sp, a, rest, off) => (off === 0 || (rest && rest === rest.toUpperCase() && /[A-Z]/.test(rest)) ? m : sp + a.toLowerCase() + rest));

function Panel({ id, code, title, icon: Icon, action, className = '', children, delay = 0, reduced }: any) {
  return (
    <motion.section
      className={`wk-panel ${className}`} aria-labelledby={`wk-${id}`}
      initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
    >
      <div className="wk-panel-head">
        <h2 id={`wk-${id}`} className="wk-panel-title"><span className="wk-code">{code}</span><Icon size={16} strokeWidth={1.5} />{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

// ─── A. Race control overview ────────────────────────────────────────────────
function WeatherGlyph({ wet }: { wet: boolean }) {
  return (
    <span className={`wk-glyph ${wet ? 'is-wet' : 'is-dry'}`} aria-hidden="true">
      {wet ? <CloudRain size={22} strokeWidth={1.25} /> : <Sun size={22} strokeWidth={1.25} />}
      {wet && <><i /><i /><i /></>}
    </span>
  );
}

function RaceControl({ weather, session, daysUntilRace, raceWindowOpen, reduced }: any) {
  const w = weather || {};
  const tempPct = (t: number) => Math.max(0, Math.min(1, (t - 10) / 40));
  const tiles = [
    { k: 'Session', v: session.current, sub: session.next, icon: Radio, light: session.live ? 'live' : session.raceDone ? 'done' : 'idle' },
    { k: 'Track temperature', v: w.trackTemperature != null ? `${w.trackTemperature}°C` : '–', bar: w.trackTemperature != null ? tempPct(w.trackTemperature) : null, icon: Thermometer },
    { k: 'Air temperature', v: w.airTemperature != null ? `${w.airTemperature}°C` : '–', bar: w.airTemperature != null ? tempPct(w.airTemperature) : null, icon: Wind },
    { k: 'Rain probability', v: w.rainProbability != null ? `${w.rainProbability}%` : '–', bar: w.rainProbability != null ? w.rainProbability / 100 : null, warn: (w.rainProbability ?? 0) > 30, icon: Droplets },
    { k: 'Track condition', v: w.isWet == null ? '–' : w.isWet ? 'Wet expected' : 'Dry expected', sub: w.isWet ? 'Every car starts on intermediates' : 'Slick tyres and your strategy apply', icon: CircleDot },
    { k: 'Circuit', v: !raceWindowOpen ? 'Closed' : session.raceDone ? 'Race complete' : session.qualiDone ? 'Parc fermé' : 'Open', sub: !raceWindowOpen ? `Opens in ${daysUntilRace} day${daysUntilRace === 1 ? '' : 's'}` : session.qualiDone ? 'Setup locked' : 'Setup changes allowed', icon: ShieldAlert },
  ];
  return (
    <div className="wk-rc">
      <div className="wk-rc-hero">
        <WeatherGlyph wet={!!w.isWet} />
        <div>
          <strong>{w.isWet == null ? 'No forecast' : w.isWet ? 'Wet race forecast' : 'Dry race forecast'}</strong>
          <span>{session.raceDone ? 'Race complete' : daysUntilRace > 0 ? `Lights out in ${daysUntilRace} day${daysUntilRace === 1 ? '' : 's'}` : 'All sessions run today'}</span>
        </div>
      </div>
      <div className="wk-rc-grid">
        {tiles.map((t, i) => (
          <div key={t.k} className="wk-tile">
            <span className="wk-tile-k"><t.icon size={14} strokeWidth={1.5} />{t.k}{t.light && <span className={`wk-light is-${t.light}`} />}</span>
            <strong className={t.warn ? 'is-warn' : ''}>{t.v}</strong>
            {t.bar != null && <span className="wk-meter"><motion.span initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: t.bar }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.04 }} className={t.warn ? 'is-warn' : ''} /></span>}
            {t.sub && <em>{t.sub}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── B. Power unit ───────────────────────────────────────────────────────────
function PowerUnit({ s, drivers }: any) {
  const [idx, setIdx] = useState(0);
  const d = drivers[Math.min(idx, drivers.length - 1)];
  const rows = d ? getPowerUnitReadiness(s, d.name) : [];
  const warnings = rows.filter((r: any) => r.status === 'Critical' || r.status === 'Worn' || r.overAllocation);
  if (!d) return <p className="wk-empty">No race drivers in the team.</p>;
  return (
    <>
      <div className="wk-seg" role="tablist" aria-label="Driver">
        {drivers.map((dr: any, i: number) => (
          <button key={dr.name} role="tab" aria-selected={i === idx} className={`wk-seg-btn ${i === idx ? 'is-on' : ''}`} onClick={() => setIdx(i)}>{last(dr.name)}</button>
        ))}
      </div>
      <ul className="wk-pu">
        {rows.map((r: any) => (
          <li key={r.key} className={`wk-pu-row is-${r.status.toLowerCase().replace(' ', '')}`} title={`${r.name}: ${r.health == null ? 'no data' : `${Math.round(r.health)}% health`}, ${r.used} of ${r.allocation} used this season`}>
            <span className="wk-pu-k">{r.key}</span>
            <span className="wk-pu-name">{r.name}</span>
            <span className="wk-pu-bar"><span style={{ transform: `scaleX(${(r.health ?? 0) / 100})` }} /></span>
            <span className="wk-pu-val">{r.health == null ? '–' : `${Math.round(r.health)}%`}</span>
            <span className={`wk-pu-alloc ${r.overAllocation ? 'is-over' : ''}`}>{r.used}/{r.allocation}</span>
          </li>
        ))}
      </ul>
      <p className={`wk-note ${warnings.length ? 'is-warn' : ''}`}>
        {warnings.length
          ? <><AlertTriangle size={14} strokeWidth={1.5} />{warnings.map((w: any) => `${w.key} ${w.overAllocation ? 'over allocation' : w.status.toLowerCase()}`).join(' · ')}</>
          : <><Check size={14} strokeWidth={1.5} />All components healthy. Bars show health; x/y is units used of the season allocation.</>}
      </p>
    </>
  );
}

// ─── C. Factory ──────────────────────────────────────────────────────────────
function FactoryStatus({ s, onOpen }: any) {
  const f = getFactoryStatus(s);
  const round = s.season?.round || 1;
  const Row = ({ item, children }: any) => (
    <li><button type="button" className="wk-row-btn" onClick={() => onOpen(item.tab)}>{children}<ChevronRight size={14} strokeWidth={1.5} className="wk-row-chev" /></button></li>
  );
  return (
    <div className="wk-factory">
      <div className="wk-factory-stats">
        <div><span>Car rating</span><strong>{f.carPerformance != null ? <AnimatedNumber value={f.carPerformance} formatter={(v) => v.toFixed(1)} /> : '–'}</strong></div>
        <div><span>Car level</span><strong>{f.carLevel ?? '–'}</strong></div>
        <div><span>In development</span><strong>{f.active.length}</strong></div>
      </div>
      <p className="wk-sublabel">Development projects</p>
      {f.active.length ? (
        <ul className="wk-list">
          {f.active.slice(0, 3).map((p: any) => (
            <Row key={p.id} item={p}>
              <span className="wk-row-main"><strong>{p.label}</strong><em>{p.gain} · due round {p.eta}{p.eta <= round ? ' (this round)' : ''}</em></span>
              <span className="wk-mini-bar"><span style={{ transform: `scaleX(${p.progress})` }} /></span>
            </Row>
          ))}
        </ul>
      ) : <p className="wk-empty">Nothing in development. <button type="button" className="wk-link" onClick={() => onOpen('development')}>Start a project</button></p>}
      <p className="wk-sublabel">Manufacturing queue</p>
      {f.queue.length ? (
        <ul className="wk-list">
          {f.queue.slice(0, 2).map((q: any) => (
            <Row key={q.id} item={q}><span className="wk-row-main"><strong>{q.label}</strong><em>{q.daysLeft ? `Ready in ${q.daysLeft} days · ${q.readyDate}` : 'Ready'}</em></span></Row>
          ))}
        </ul>
      ) : <p className="wk-empty">Queue empty.</p>}
      {(f.introduced.length > 0 || f.latest) && (
        <>
          <p className="wk-sublabel">Latest on the car</p>
          <ul className="wk-list">
            {f.introduced.slice(0, 2).map((p: any) => (
              <Row key={p.id} item={p}><span className="wk-row-main"><strong>{p.label}</strong><em>{p.outcome === 'overperform' ? 'Beat target' : p.outcome === 'underperform' ? 'Below target' : 'Introduced'} · {p.gain}</em></span></Row>
            ))}
            {!f.introduced.length && f.latest && (
              <Row item={{ tab: 'development' }}><span className="wk-row-main"><strong>{f.latest.part}</strong><em>+{f.latest.expectedGain} rating</em></span></Row>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

// ─── D. Championship ─────────────────────────────────────────────────────────
function Championship({ s, drivers, standingsImpact }: any) {
  const c = getChampionshipSituation(s, drivers);
  const series = useMemo(() => getChampionshipSeries(s, 1), [s.raceHistory?.length]);
  const mine = series.series.find((x: any) => x.isPlayer);
  const rival = series.series.find((x: any) => !x.isPlayer);
  if (!c.anyPoints) {
    const field = [s.team, ...(s.aiTeams || [])].filter(Boolean).sort((a: any, b: any) => (b.carPerformance || 0) - (a.carPerformance || 0));
    const carRank = field.findIndex((t: any) => t.name === s.team.name) + 1;
    return (
      <div className="wk-champ">
        <div className="wk-champ-big"><strong>–</strong><span>No points scored yet. Positions appear after the first race.</span></div>
        {carRank > 0 && (
          <div className="wk-gaps">
            <div><span>Car performance rank</span><strong>{ord(carRank)} of {field.length}</strong></div>
            <div><span>Fastest car</span><strong style={{ fontSize: 13 }}>{field[0]?.name}</strong></div>
          </div>
        )}
        <ul className="wk-champ-drivers">
          {c.drivers.map((d: any) => <li key={d.name}><span>{d.name}</span><em>0 pts</em></li>)}
        </ul>
        {standingsImpact?.nearestRival && <p className="wk-note">Pre-season reference rival: <strong>{standingsImpact.nearestRival}</strong></p>}
      </div>
    );
  }
  const total = c.drivers.reduce((a: number, d: any) => a + d.points, 0) || 1;
  const pts = (arr: number[]) => {
    const max = Math.max(1, ...(mine?.points || []), ...(rival?.points || []));
    return arr.map((v, i) => `${(i / Math.max(1, arr.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
  };
  return (
    <div className="wk-champ">
      <div className="wk-champ-big">
        <strong>{ord(c.teamPos)}</strong>
        <span><AnimatedNumber value={c.teamPoints} /> pts · {c.leader && c.leader.name !== s.team.name ? `${c.leader.points - c.teamPoints} behind ${c.leader.name}` : 'Leading the constructors'}</span>
      </div>
      <div className="wk-gaps">
        {c.ahead && <div><span>Ahead · {c.ahead.name}</span><strong className="is-down">−{c.ahead.gap}</strong></div>}
        {c.behind && <div><span>Behind · {c.behind.name}</span><strong className="is-up">+{c.behind.gap}</strong></div>}
      </div>
      <ul className="wk-champ-drivers">
        {c.drivers.map((d: any, i: number) => (
          <li key={d.name}>
            <span>{i === 0 ? 'Lead · ' : ''}{d.name}</span>
            <em>{d.pos ? ord(d.pos) : '–'} · {d.points} pts</em>
            <span className="wk-share"><span style={{ transform: `scaleX(${d.points / total})` }} /></span>
          </li>
        ))}
      </ul>
      {mine && mine.points.length > 1 && (
        <figure className="wk-spark" aria-label={`Points after each round: ${mine.points.join(', ')}`}>
          <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
            {rival && <polyline points={pts(rival.points)} className="wk-spark-rival" />}
            <polyline points={pts(mine.points)} className="wk-spark-me" />
          </svg>
          <figcaption><span className="wk-key-me" />{s.team.name}{rival && <><span className="wk-key-rival" />{rival.name}</>}</figcaption>
        </figure>
      )}
    </div>
  );
}

// ─── E. Objectives ───────────────────────────────────────────────────────────
function Objectives({ raceWeekend, selected, onSelect, locked }: any) {
  const list = raceWeekend?.objectives || [];
  const rec = raceWeekend?.recommendedObjective?.id;
  const sel = list.find((o: any) => o.id === selected);
  const riskTone = (r: string) => (r === 'Low' ? 'low' : r === 'Medium' ? 'med' : 'high');
  return (
    <div className="wk-obj">
      {raceWeekend?.finishDistribution && <div className="wk-obj-dist"><FinishDistributionBar finishDist={raceWeekend.finishDistribution} compact={true} /></div>}
      <div className="wk-obj-cards" role="radiogroup" aria-label="Race objective">
        {list.map((o: any) => {
          const on = o.id === selected;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} disabled={locked} className={`wk-mission ${on ? 'is-on' : ''}`} onClick={() => onSelect(o.id)}>
              <span className="wk-mission-top">
                <span className="wk-mission-target">{o.targetPosition ? `P${o.targetPosition}` : '–'}</span>
                {o.id === rec && <span className="wk-badge">Recommended</span>}
                {on && <span className="wk-badge is-on">Selected</span>}
              </span>
              <strong>{o.label}</strong>
              <span className="wk-mission-prob">
                <span className="wk-meter"><span style={{ transform: `scaleX(${(o.successProbability || 0) / 100})` }} /></span>
                <em>{o.successProbability}% chance</em>
              </span>
              <span className="wk-mission-meta">
                <span className={`wk-risk is-${riskTone(o.riskLevel)}`}>{o.riskLevel} risk</span>
                <span>${o.sponsorRewardM}M</span>
                <span>{o.championshipImpact}</span>
              </span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="wk-consequence" aria-live="polite">
          <div><span>If achieved</span><strong>+${sel.sponsorRewardM}M sponsor reward · board impact {String(sel.boardImpact).toLowerCase()}</strong></div>
          <div><span>Within two places</span><strong>Partially achieved</strong></div>
          <div><span>Expected finish</span><strong>{sel.expectedFinishRange || '–'}</strong></div>
          {sel.rationale && <p>{sel.rationale}</p>}
        </div>
      )}
      {locked && <p className="wk-note">The objective was set in the pre-race briefing.</p>}
    </div>
  );
}

// ─── F. Track intelligence ───────────────────────────────────────────────────
const PERF_LABELS: [string, string][] = [
  ['engineImportance', 'Power sensitivity'], ['downforceRequirement', 'Downforce demand'], ['mechanicalGripImportance', 'Mechanical grip'],
  ['tyreDegradation', 'Tyre degradation'], ['brakingIntensity', 'Braking intensity'], ['coolingRequirement', 'Cooling demand'], ['wetWeatherSensitivity', 'Wet sensitivity'],
];

function TrackIntel({ intel, trackProfile, insights, brakingCount, onOpenMap }: any) {
  if (!intel) return null;
  const facts: [string, string | null][] = [
    ['Length', intel.lengthKm ? `${intel.lengthKm} km` : null],
    ['Corners', intel.corners ? String(intel.corners) : null],
    ['Laps', intel.laps ? String(intel.laps) : null],
    ['Main straight', intel.longestStraightM ? `${intel.longestStraightM} m` : null],
    ['Overtaking difficulty', intel.overtaking != null ? `${intel.overtaking}/100` : null],
    ['Tyre severity', intel.tyreSeverity],
    ['Base degradation', trackProfile?.baseDegradation != null ? `×${Number(trackProfile.baseDegradation).toFixed(2)}` : null],
    ['Heavy braking zones', brakingCount != null ? `${brakingCount} (estimated)` : null],
  ];
  return (
    <div className="wk-intel">
      <button type="button" className="wk-intel-map" onClick={onOpenMap} aria-label="Open the interactive circuit map">
        <CircuitThumb grandPrix={intel.grandPrix} corners={intel.corners} />
        <span className="wk-intel-legend"><i className="s1" />S1<i className="s2" />S2<i className="s3" />S3<i className="drs" />DRS<i className="brk" />Braking</span>
        <span className="wk-intel-open"><MapIcon size={14} strokeWidth={1.5} />Open map</span>
      </button>
      <div className="wk-intel-body">
        <dl className="wk-facts">{facts.filter(f => f[1]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {intel.perf && (
          <ul className="wk-perf" aria-label="Circuit demands, 1 to 10">
            {PERF_LABELS.filter(([k]) => intel.perf[k] != null).map(([k, l]) => (
              <li key={k}><span>{l}</span><span className="wk-dots" aria-label={`${intel.perf[k]} of 10`}>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < intel.perf[k] ? 'on' : ''} />)}</span></li>
            ))}
          </ul>
        )}
        <ul className="wk-insights">{insights.map((m: string, i: number) => <li key={i}><ChevronRight size={14} strokeWidth={1.5} />{m}</li>)}</ul>
      </div>
    </div>
  );
}

// ─── G. Rival watch ──────────────────────────────────────────────────────────
function RivalWatch({ s }: any) {
  const intel = getRivalIntel(s);
  return (
    <div className="wk-rivals">
      <table className="wk-table">
        <thead><tr><th>#</th><th>Team</th><th>Lineup</th><th className="num">Points</th><th>Car vs yours</th><th className="num">Facility upgrades</th><th>Threat</th></tr></thead>
        <tbody>
          {intel.rivals.map((r: any) => (
            <tr key={r.name}>
              <td className="num">{r.rank}</td>
              <td><strong>{r.name}</strong></td>
              <td>{r.drivers.map((d: any) => <span key={d.name} className="wk-lineup">{last(d.name)} <em>{d.rating}</em></span>)}</td>
              <td className="num">{r.points}{r.pointsGap !== 0 && <em className={r.pointsGap > 0 ? 'is-down' : 'is-up'}> {r.pointsGap > 0 ? '+' : '−'}{Math.abs(r.pointsGap)}</em>}</td>
              <td>
                <span className="wk-diverge" aria-label={`${r.perfGap > 0 ? '+' : ''}${r.perfGap.toFixed(1)} car performance`}>
                  <span className={r.perfGap > 0 ? 'is-pos' : 'is-neg'} style={{ width: `${Math.min(50, Math.abs(r.perfGap) * 6)}%`, [r.perfGap > 0 ? 'left' : 'right']: '50%' } as any} />
                </span>
                <em className="wk-diverge-v">{r.perfGap > 0.05 ? <ArrowUpRight size={12} strokeWidth={1.5} /> : r.perfGap < -0.05 ? <ArrowDownRight size={12} strokeWidth={1.5} /> : <Minus size={12} strokeWidth={1.5} />}{r.perfGap > 0 ? '+' : ''}{r.perfGap.toFixed(1)}</em>
              </td>
              <td className="num">{r.facilities}</td>
              <td><span className={`wk-threat is-${r.threat.toLowerCase()}`}>{r.threat}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="wk-note">Nearest three by {intel.basis}. Threat is high when their car is quicker and they're within 15 points, medium when the cars are within 2 rating points.</p>
    </div>
  );
}

// ─── H. Bonus challenges ─────────────────────────────────────────────────────
function Bonuses({ s, challenges }: any) {
  const [open, setOpen] = useState<string | null>(null);
  const hist = getChallengeHistory(s);
  return (
    <div className="wk-bonus">
      {challenges.map((c: any) => {
        const h = hist[c.id]; const on = open === c.id;
        return (
          <button key={c.id} type="button" className={`wk-bonus-card ${on ? 'is-on' : ''}`} aria-expanded={on} onClick={() => setOpen(on ? null : c.id)}>
            <span className="wk-bonus-top"><strong>{sentence(c.label)}</strong><span className="wk-bonus-state">Judged after the race</span></span>
            <span className="wk-bonus-rewards">
              <span><em>Cash</em><b className="is-pos">+${c.cash}M</b></span>
              <span><em>Board</em><b>+{c.boardConfidence}</b></span>
              <span><em>Reputation</em><b>+{c.reputation}</b></span>
            </span>
            {on && <span className="wk-bonus-rule">{CHALLENGE_RULES[c.id] || ''}</span>}
            <span className="wk-bonus-hist">{h ? `${h.done} of ${h.attempts} achieved · last round ${h.last.round} ${h.last.complete ? 'achieved' : 'missed'}` : 'Not attempted yet'}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── I. Comms ────────────────────────────────────────────────────────────────
function Comms({ items, onNavigate }: any) {
  if (!items.length) return <p className="wk-empty">No messages yet. Team updates appear here as the season runs.</p>;
  return (
    <ol className="wk-comms">
      {items.map((m: any) => (
        <li key={m.id} className={m.urgent ? 'is-urgent' : ''}>
          <span className="wk-comms-dot" aria-hidden="true" />
          <div className="wk-comms-meta"><span>{m.when}</span><strong>{m.from}</strong>{m.urgent && <em>Important</em>}</div>
          <p>{m.text}</p>
          {m.screen && <button type="button" className="wk-link" onClick={() => onNavigate(m.screen)}>{m.screen === 'prep' ? 'Open setup and strategy' : `Open ${m.screen}`}<ChevronRight size={12} strokeWidth={1.5} /></button>}
        </li>
      ))}
    </ol>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────
export function OverviewBoard(props: any) {
  const { s, raceWeekend, weekendProgress, drivers, session, daysUntilRace, raceWindowOpen, selectedObjective, onSelectObjective,
    intel, trackProfile, insights, brakingCount, challenges, setupRuns, raceDay, onNavigate, reduced } = props;
  const comms = getCommsTimeline(s, { weekendProgress, setupRuns, raceDay, raceWindowOpen });
  return (
    <div className="wk-board">
      <Panel id="rc" code="A" title="Race control" icon={Radio} className="wk-a" reduced={reduced}>
        <RaceControl weather={raceWeekend?.weather} session={session} daysUntilRace={daysUntilRace} raceWindowOpen={raceWindowOpen} reduced={reduced} />
      </Panel>
      <Panel id="champ" code="D" title="Championship" icon={Trophy} className="wk-d" delay={0.04} reduced={reduced}>
        <Championship s={s} drivers={drivers} standingsImpact={raceWeekend?.standingsImpact} />
      </Panel>
      <Panel id="pu" code="B" title="Power unit" icon={ShieldAlert} className="wk-b" delay={0.08} reduced={reduced}
        action={<button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm')} onClick={() => onNavigate('engineering', 'components')}>Engineering<ChevronRight size={14} strokeWidth={1.5} /></button>}>
        <PowerUnit s={s} drivers={drivers} />
      </Panel>

      <Panel id="obj" code="E" title="Race objective" icon={Target} className="wk-e" delay={0.12} reduced={reduced}
        action={<span className="wk-muted">{raceWeekend?.tier?.label}</span>}>
        <Objectives raceWeekend={raceWeekend} selected={selectedObjective} onSelect={onSelectObjective} locked={!!weekendProgress?.raceComplete} />
      </Panel>
      <Panel id="fac" code="C" title="Engineering and factory" icon={Factory} className="wk-c" delay={0.16} reduced={reduced}
        action={<button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm')} onClick={() => onNavigate('engineering', 'projects')}>Open<ChevronRight size={14} strokeWidth={1.5} /></button>}>
        <FactoryStatus s={s} onOpen={(tab: string) => onNavigate('engineering', tab)} />
      </Panel>

      <Panel id="intel" code="F" title="Track intelligence" icon={MapIcon} className="wk-f" delay={0.2} reduced={reduced}>
        <TrackIntel intel={intel} trackProfile={trackProfile} insights={insights} brakingCount={brakingCount} onOpenMap={() => onNavigate('prep')} />
      </Panel>
      <Panel id="rivals" code="G" title="Rival watch" icon={Swords} className="wk-g" delay={0.24} reduced={reduced}>
        <RivalWatch s={s} />
      </Panel>

      <Panel id="bonus" code="H" title="Bonus challenges" icon={Coins} className="wk-h" delay={0.28} reduced={reduced}>
        <Bonuses s={s} challenges={challenges} />
      </Panel>
      <Panel id="comms" code="I" title="Team communications" icon={MessagesSquare} className="wk-i" delay={0.32} reduced={reduced}>
        <Comms items={comms} onNavigate={onNavigate} />
      </Panel>
    </div>
  );
}
