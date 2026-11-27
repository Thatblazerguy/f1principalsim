import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapIcon, Wrench, FileText, GitCompare, ChevronRight, X, CloudRain, Sun, Thermometer } from 'lucide-react';
import { HUB, btn, btnClass, iconBtn, tyreDot } from '../HubLayout.tsx';
import { AnimatedNumber } from '../ui/motion.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { getDriverHeadshotUrl, getDriverNumber } from '../../data/drivers.js';
import { driverOverall, SALARY_DIVISOR, getRacesRemaining } from '../../utils/contractOfferModel.js';
import { PROFILE_ATTRIBUTES, getDriverNationality } from '../../utils/driverProfileModel.js';
import './drivers.css';

const EASE = [0.22, 1, 0.36, 1] as const;
const surname = (n: string) => n.split(' ').pop() || n;
const firstNames = (n: string) => n.split(' ').slice(0, -1).join(' ');
const roleText = (d: any) => (d.driverRole === 'reserve' || d.contractType === 'reserve' ? 'Reserve driver' : d.driverRole === 'lead' ? 'Lead driver' : 'Race driver');
const seasons = (n: any) => (n == null ? '–' : `${n} ${n === 1 ? 'season' : 'seasons'}`);
const ord = (n: number) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const moraleTone = (m: number) => (m >= 75 ? HUB.positive : m >= 50 ? HUB.warning : HUB.negative);

/** Larger headshot where the CDN offers one; null for generated initials avatars. */
function portraitUrl(d: any): string | null {
  const url = getDriverHeadshotUrl(d);
  if (!url || url.startsWith('data:')) return null;
  return url.replace('/1col/', '/3col/');
}

// ─── Lineup (left) ──────────────────────────────────────────────────────────
export function DriverLineup({ drivers, selected, onSelect }: { drivers: any[]; selected: number; onSelect: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = drivers.length;
    let j = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    if (j >= 0) { e.preventDefault(); onSelect(j); refs.current[j]?.focus(); }
  };
  return (
    <section className="dm-panel dm-lineup" aria-label="Driver lineup">
      <p className="dm-kicker">Lineup</p>
      <div className="dm-lineup-list" role="radiogroup" aria-label="Select a driver">
        {drivers.map((d, i) => {
          const on = i === selected;
          const morale = d.morale ?? 75;
          return (
            <button key={d.name} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
              className={`dm-lineup-row ${on ? 'is-on' : ''}`} onClick={() => onSelect(i)} onKeyDown={e => onKey(e, i)}>
              {on && <motion.span layoutId="dm-lineup-active" className="dm-lineup-active" transition={{ duration: 0.35, ease: EASE }} />}
              <span className="dm-lineup-num">{getDriverNumber(d)}</span>
              <span className="dm-lineup-name">
                <strong>{surname(d.name)}</strong>
                <em>{roleText(d)}{d.academyGraduate ? ' · Academy graduate' : ''}</em>
              </span>
              <span className="dm-lineup-ovr">{driverOverall(d)}</span>
              <span className="dm-lineup-dot" style={{ background: moraleTone(morale) }} title={`Morale ${morale}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Weekend telemetry + team (left, under lineup) ──────────────────────────
export function WeekendPanel({ facts, roundNo, total, completed, weather, team, teamPos, activeProjects, onOpenCircuit, onGarage }: any) {
  const progress = total ? completed / total : 0;
  return (
    <>
      <section className="dm-panel dm-tele" aria-label="Race weekend">
        <div className="dm-tele-head">
          <p className="dm-kicker">Round {roundNo} of {total}</p>
          <span className="dm-live"><span />{completed >= total ? 'Season complete' : 'Next race'}</span>
        </div>
        <h3 className="dm-tele-title">{facts?.grandPrix || 'Season complete'}</h3>
        {facts && <p className="dm-muted" style={{ margin: '2px 0 12px' }}>{facts.circuit}</p>}
        <dl className="dm-tele-rows">
          <div><dt><Thermometer size={14} strokeWidth={1.5} />Track temp</dt><dd>{weather ? `${weather.trackTemperature}°C` : 'At race weekend'}</dd></div>
          <div><dt>{weather?.isWet ? <CloudRain size={14} strokeWidth={1.5} /> : <Sun size={14} strokeWidth={1.5} />}Conditions</dt>
            <dd>{weather ? `${weather.isWet ? 'Wet' : 'Dry'} · ${weather.rainProbability}% rain` : 'Not forecast yet'}</dd></div>
          <div><dt>{tyreDot(facts?.tyreSeverity === 'High' ? 'soft' : facts?.tyreSeverity === 'Low' ? 'hard' : 'medium', 10)}Tyre wear</dt><dd>{facts?.tyreSeverity || '–'}</dd></div>
        </dl>
        {facts && (
          <button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm', { width: '100%', justifyContent: 'space-between', marginTop: 8 })} onClick={onOpenCircuit}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><MapIcon size={16} strokeWidth={1.5} />Circuit map</span><ChevronRight size={14} strokeWidth={1.5} />
          </button>
        )}
      </section>

      <section className="dm-panel dm-team" aria-label="Team">
        <p className="dm-kicker">Constructors' championship</p>
        <div className="dm-team-row">
          <strong className="dm-team-pos">{teamPos ? ord(teamPos.pos) : '–'}</strong>
          <span className="dm-muted">{teamPos ? <><AnimatedNumber value={teamPos.points} /> pts</> : 'No points scored yet'}</span>
        </div>
        <div className="dm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed} aria-label="Season progress">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <span className="dm-faint">{completed} of {total} races run</span>
        <button type="button" className="dm-garage" onClick={onGarage} aria-label={`Open the garage. ${activeProjects} upgrades in development`}>
          <svg viewBox="0 0 120 36" aria-hidden="true" className="dm-garage-car">
            <path d="M4 26h18l6-6h22l8-8h20l10 8h18l8 6h2v4H4z" />
            <circle cx="24" cy="28" r="5" /><circle cx="94" cy="28" r="5" />
          </svg>
          <span className="dm-garage-text"><strong>Team garage</strong><em>{activeProjects ? `${activeProjects} upgrade${activeProjects === 1 ? '' : 's'} in development` : 'No upgrades running'}</em></span>
          <Wrench size={16} strokeWidth={1.5} />
        </button>
      </section>
    </>
  );
}

// ─── Hero (centre) ──────────────────────────────────────────────────────────
/** Surname in the wide face, sized down until it fits its column (no wrapping, no overflow). */
function FitName({ text, max = 68, min = 24 }: { text: string; max?: number; min?: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement?.parentElement; // .dm-hero-copy
    if (!el || !box) return;
    const fit = () => {
      const avail = box.clientWidth;
      if (!avail) return;
      let size = Math.min(max, avail * 0.12);
      el.style.fontSize = `${size}px`;
      const w = el.scrollWidth;
      if (w > avail) size = Math.max(min, size * (avail / w) * 0.98);
      el.style.fontSize = `${size}px`;
    };
    fit();
    (document as any).fonts?.ready?.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text, max, min]);
  return <h2 ref={ref} className="dm-last">{text}</h2>;
}

function OverallRing({ overall, potential }: { overall: number; potential: number | null }) {
  const r = 54; const c = 2 * Math.PI * r;
  return (
    <div className="dm-ring" role="img" aria-label={`Overall ${overall}${potential ? `, potential ${potential}` : ''}`}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="dm-ring-track" />
        {potential != null && <circle cx="64" cy="64" r={r} className="dm-ring-pot" strokeDasharray={c} strokeDashoffset={c * (1 - potential / 100)} />}
        <circle cx="64" cy="64" r={r} className="dm-ring-val" strokeDasharray={c} strokeDashoffset={c * (1 - overall / 100)} />
      </svg>
      <div className="dm-ring-text">
        <strong><AnimatedNumber value={overall} /></strong>
        <span>Overall</span>
      </div>
    </div>
  );
}

export function DriverHero({ driver, team, champPos, reduced }: { driver: any; team: any; champPos: any; reduced: boolean }) {
  const nat = getDriverNationality(driver);
  const photo = portraitUrl(driver);
  const [photoOk, setPhotoOk] = useState(true);
  useEffect(() => setPhotoOk(true), [driver.name]);
  const num = getDriverNumber(driver);
  const overall = driverOverall(driver);
  const morale = driver.morale ?? 75;
  const facts = [
    { k: 'Contract', v: seasons(driver.contractYearsRemaining) },
    { k: 'Salary', v: `$${driver.salary ?? 0}M / season` },
    { k: 'Morale', v: String(morale), dot: moraleTone(morale) },
    { k: 'Championship', v: champPos ? `${ord(champPos.pos)} · ${champPos.points} pts` : 'No points yet' },
  ];
  const rise = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: EASE, delay: 0.08 + i * 0.05 } });

  return (
    <section className="dm-hero" aria-label={`${driver.name} profile`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={driver.name} className="dm-hero-inner"
          initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.16 } }}>
          <div className="dm-stagebox" aria-hidden="true">
            <motion.div className="dm-spot" initial={reduced ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }} />
            <span className="dm-bignum">{num}</span>
            <motion.div className="dm-portrait"
              initial={reduced ? false : { clipPath: 'inset(100% 0 0 0)', y: 24 }} animate={{ clipPath: 'inset(0% 0 0 0)', y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}>
              {photo && photoOk
                ? <img src={photo} alt="" onError={() => setPhotoOk(false)} />
                : <span className="dm-initials">{driver.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}</span>}
            </motion.div>
            <span className="dm-floorline" />
          </div>

          <div className="dm-hero-copy">
            <motion.p className="dm-kicker" {...rise(0)}>{roleText(driver)} · {team.name}</motion.p>
            <motion.p className="dm-first" {...rise(1)}>{firstNames(driver.name)}</motion.p>
            <motion.div {...rise(2)}><FitName text={surname(driver.name)} /></motion.div>
            <motion.div className="dm-idline" {...rise(3)}>
              <span className="dm-numchip">#{num}</span>
              {nat && <span className="dm-nat">{nat.flag && <span className="dm-flag" aria-hidden="true">{nat.flag}</span>}{nat.country || nat.code}</span>}
              <span className="dm-muted">Age {driver.age ?? '–'}</span>
            </motion.div>
            <motion.div className="dm-ratings" {...rise(4)}>
              <OverallRing overall={overall} potential={driver.potentialCeiling ?? null} />
              <div className="dm-pot">
                <span className="dm-faint">Potential</span>
                <strong>{driver.potentialCeiling ?? '–'}</strong>
                <span className="dm-faint">{driver.potentialCeiling ? `${Math.max(0, driver.potentialCeiling - overall)} to grow` : ''}</span>
              </div>
            </motion.div>
          </div>

          <motion.dl className="dm-factstrip" {...rise(5)}>
            {facts.map(f => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.dot && <span className="dm-dot" style={{ background: f.dot }} />}{f.v}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ─── Stats (right) ──────────────────────────────────────────────────────────
export function DriverStats({ driver, teammate, summary, mateSummary }: { driver: any; teammate: any; summary: any; mateSummary: any }) {
  const mate = surname(teammate?.name || '');
  const cells = summary ? [
    { k: 'Points', v: summary.points, m: mateSummary?.points, hi: true },
    { k: 'Wins', v: summary.wins, m: mateSummary?.wins, hi: true },
    { k: 'Podiums', v: summary.podiums, m: mateSummary?.podiums, hi: true },
    { k: 'Poles', v: summary.poles, m: mateSummary?.poles, hi: true },
    { k: 'Avg qualifying', v: summary.avgGrid, m: mateSummary?.avgGrid, hi: false, pos: true },
    { k: 'Avg finish', v: summary.avgFinish, m: mateSummary?.avgFinish, hi: false, pos: true },
  ] : [];
  return (
    <section className="dm-panel dm-stats" aria-label="Performance">
      <div className="dm-stats-head">
        <p className="dm-kicker">Attributes</p>
        {teammate && <span className="dm-legend"><span className="dm-legend-you" />{surname(driver.name)}<span className="dm-legend-mate" />{mate}</span>}
      </div>
      <ul className="dm-attrs">
        {PROFILE_ATTRIBUTES.map(a => {
          const v = Math.round(Number(driver[a.key]) || 0);
          const m = teammate ? Math.round(Number(teammate[a.key]) || 0) : null;
          const diff = m == null ? null : v - m;
          return (
            <li key={a.key} className="dm-attr" title={a.hint || undefined}
              aria-label={`${a.label} ${v}${m != null ? `, ${mate} ${m}` : ''}`}>
              <span className="dm-attr-label">{a.label}{a.hint && <em> · {a.hint.toLowerCase()}</em>}</span>
              <span className="dm-attr-val"><AnimatedNumber value={v} /></span>
              <span className="dm-attr-bar">
                <span className="dm-attr-fill" style={{ transform: `scaleX(${v / 100})` }} />
                {m != null && <span className="dm-attr-mate" style={{ left: `${m}%` }} />}
              </span>
              <span className={`dm-attr-diff ${diff == null ? '' : diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}`}>
                {diff == null ? '' : diff === 0 ? '=' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="dm-divider" />
      <div className="dm-stats-head">
        <p className="dm-kicker">This season</p>
        {teammate && summary && <span className="dm-faint">vs {mate}</span>}
      </div>
      {summary ? (
        <>
          <div className="dm-season">
            {cells.map(c => {
              const num = typeof c.v === 'number' ? c.v : null;
              const mnum = typeof c.m === 'number' ? c.m : null;
              const better = num != null && mnum != null && num !== mnum ? (c.hi ? num > mnum : num < mnum) : null;
              return (
                <div key={c.k} className="dm-season-cell">
                  <span className="dm-faint">{c.k}</span>
                  <strong>{num == null ? '–' : c.pos ? `P${num.toFixed(1)}` : <AnimatedNumber value={num} />}</strong>
                  {mnum != null && <em className={better === true ? 'is-up' : better === false ? 'is-down' : ''}>{c.pos ? `P${mnum.toFixed(1)}` : mnum}</em>}
                </div>
              );
            })}
          </div>
          <div className="dm-form" aria-label="Recent form, last five races">
            <span className="dm-faint">Recent form</span>
            <div className="dm-form-row">
              {summary.form.map((f: any) => (
                <span key={f.round} className={`dm-form-chip ${f.pos == null ? 'is-dnf' : f.pos <= 3 ? 'is-podium' : f.pos <= 10 ? 'is-points' : ''}`}
                  title={`Round ${f.round}, ${f.name}: ${f.pos == null ? 'retired' : `P${f.pos}`}${f.grid ? ` from P${f.grid}` : ''}`}>
                  {f.pos == null ? 'DNF' : f.pos}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="dm-empty">No races run yet this season. Points, wins, podiums and form appear after {surname(driver.name)}'s first start.</p>
      )}
    </section>
  );
}

// ─── Contract (right) ───────────────────────────────────────────────────────
export function ContractPanel({ driver, isReserve, reserveTaken, talksClosed, onRenew, onSalary, onDetails, onCompare, onRelease, onDemote, onPromote }: any) {
  const perRace = (driver.salary || 0) / SALARY_DIVISOR;
  return (
    <section className="dm-panel dm-contract" aria-label="Contract">
      <div className="dm-stats-head">
        <p className="dm-kicker">Contract</p>
        <button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm', { height: 28, padding: '0 10px' })} onClick={onDetails}>
          <FileText size={14} strokeWidth={1.5} />Details
        </button>
      </div>
      <div className="dm-contract-figs">
        <div><span className="dm-faint">Salary</span><strong>${driver.salary ?? 0}M</strong><em>${perRace.toFixed(2)}M a race</em></div>
        <div><span className="dm-faint">Remaining</span><strong>{driver.contractYearsRemaining ?? '–'}</strong><em>{driver.contractYearsRemaining === 1 ? 'season' : 'seasons'}</em></div>
        <div><span className="dm-faint">Role</span><strong style={{ fontSize: 15 }}>{isReserve ? 'Reserve' : 'Race seat'}</strong><em>{driver.contractType || 'race'} contract</em></div>
      </div>
      <div className="dm-actions">
        <button type="button" className={btnClass('primary')} style={btn('primary', 'md', { flex: 1 })} onClick={onRenew} disabled={talksClosed}>Renew contract</button>
        <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md', { flex: 1 })} onClick={onSalary} disabled={talksClosed}>Negotiate salary</button>
      </div>
      {talksClosed && <p className="dm-faint" style={{ margin: '8px 0 0' }}>{surname(driver.name)} refused an offer this round. Talks reopen next round.</p>}
      <div className="dm-actions dm-actions-quiet">
        <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={onCompare}><GitCompare size={14} strokeWidth={1.5} />Compare</button>
        {isReserve
          ? <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={onPromote}>Promote to race seat</button>
          : <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={onDemote} disabled={reserveTaken} title={reserveTaken ? 'The reserve seat is taken' : undefined}>Demote to reserve</button>}
        <button type="button" className={btnClass('danger')} style={btn('danger', 'sm')} onClick={onRelease}>Release</button>
      </div>
    </section>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────────────
function Dialog({ open, onClose, labelId, children, wide = false }: { open: boolean; onClose: () => void; labelId: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(open, ref, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="dm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelId} className={`dm-dialog ${wide ? 'is-wide' : ''}`}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.3, ease: EASE }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export type ConfirmSpec = { title: string; body: string; confirm: string; danger?: boolean; run: () => void | Promise<void> } | null;

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const last = useRef(spec);
  if (spec) last.current = spec;
  const s = last.current;
  return (
    <Dialog open={!!spec} onClose={onClose} labelId="dm-confirm-title">
      {s && (
        <>
          <h3 id="dm-confirm-title" className="dm-dialog-title">{s.title}</h3>
          <p className="dm-dialog-body">{s.body}</p>
          <div className="dm-dialog-foot">
            <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={onClose}>Cancel</button>
            <button type="button" className={btnClass(s.danger ? 'danger' : 'primary')} style={btn(s.danger ? 'danger' : 'primary', 'md')} disabled={busy}
              onClick={async () => { setBusy(true); try { await s.run(); } finally { setBusy(false); onClose(); } }}>{s.confirm}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function ContractDetails({ driver, open, onClose, appState }: { driver: any; open: boolean; onClose: () => void; appState: any }) {
  const last = useRef(driver);
  if (driver) last.current = driver;
  const d = last.current;
  if (!d) return null;
  const perRace = (d.salary || 0) / SALARY_DIVISOR;
  const left = getRacesRemaining(appState);
  const rows: [string, string][] = [
    ['Contract type', d.contractType === 'reserve' ? 'Reserve' : 'Race'],
    ['Role', roleText(d)],
    ['Salary', `$${d.salary ?? 0}M a season`],
    ['Charged per race weekend', `$${perRace.toFixed(2)}M (salary ÷ ${SALARY_DIVISOR})`],
    [`Still to pay this season (${left} races)`, `$${(perRace * left).toFixed(1)}M`],
    ['Seasons remaining', seasons(d.contractYearsRemaining)],
    ['Signing fee paid', d.signingFee != null ? `$${d.signingFee}M` : '–'],
    ['Morale', String(d.morale ?? 75)],
    ['Market value', d.market != null ? String(d.market) : '–'],
  ];
  const history = (d.careerTimeline || []).slice(0, 5);
  return (
    <Dialog open={open} onClose={onClose} labelId="dm-details-title" wide>
      <div className="dm-dialog-head">
        <div>
          <p className="dm-kicker">Contract details</p>
          <h3 id="dm-details-title" className="dm-dialog-title">{d.name}</h3>
        </div>
        <button type="button" className={btnClass('ghost')} style={iconBtn('md')} onClick={onClose} aria-label="Close contract details"><X size={16} strokeWidth={1.5} /></button>
      </div>
      <dl className="dm-details">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <p className="dm-kicker" style={{ marginTop: 20 }}>Career notes</p>
      {history.length ? (
        <ul className="dm-history">
          {history.map((h: any, i: number) => (
            <li key={i}><span className="dm-faint">Season {h.seasonYear}</span><strong>{h.event}</strong><span className="dm-muted">{h.detail}</span></li>
          ))}
        </ul>
      ) : <p className="dm-empty">No contract changes recorded yet.</p>}
    </Dialog>
  );
}
