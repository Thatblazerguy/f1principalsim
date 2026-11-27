import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, GitCompare, SlidersHorizontal, Wallet, Gauge, Users, Sparkles, Telescope, Dumbbell, Trophy, Newspaper,
  TrendingUp, UserPlus, Plane, AlertTriangle, Building2, GraduationCap, FileSearch, Flag, CheckCircle2, X,
} from 'lucide-react';
import { AnimatedNumber } from '../ui/motion.tsx';
import {
  ensureAcademy, academyOverview, marketList, scoutStatus, estimate, ovr, potential, juniorValue, juniorSalary, signingFee, SERIES,
  trajectory, interestIn, PIPELINE, PIPELINE_LABELS, LADDER, financeSummary, LEDGER_LABELS, objectiveProgress, rewardText,
  allocateFunds, signProspect, startProgramme, cancelProgramme, moveSeries, promoteToReserve, promoteToRaceSeat, planRaceSeat,
  releaseProspect, renewContract, toggleShortlist, PROGRAMMES, WORKLOADS, programmeEffectiveness, FACILITIES, facilityInfo,
  upgradeFacility, scoutCandidates, hireScout, releaseScout, assignScoutTask, recallScoutTask, SCOUT_REGIONS, ASSIGNMENTS,
  MAX_SCOUTS, knowledgeOf, loanOffers, sendOnLoan, recallLoan, extendLoan, sellLoanee, loanProgress, standingsFor,
  ATTRIBUTE_LABELS, juniorRoundsPerSeason, superLicence, promotionAdvice, knownDriver,
} from '../../game/academyEngine.js';
import { Avatar, Badge, EstBar, Traj, Morale, Confirm, Radar, money, nationalityText, ratingEstimates, EASE } from './parts.tsx';
import { ProfileDrawer } from './ProfileDrawer.tsx';
import './academy.css';

type Tab = 'overview' | 'prospects' | 'scouting' | 'development' | 'loans';

export function AcademyHQ({ appState, onPersist, initialFlash = '' }: { appState: any; onPersist: () => Promise<void>; initialFlash?: string }) {
  const ac = ensureAcademy(appState);
  const [tab, setTab] = useState<Tab>('overview');
  const [, bump] = useState(0);
  const [flash, setFlash] = useState<{ text: string; tone: string } | null>(initialFlash ? { text: initialFlash, tone: '' } : null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [loanFor, setLoanFor] = useState<string | null>(null);
  const [scoutFor, setScoutFor] = useState<string | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const ov = academyOverview(appState);

  const done = (r: any) => {
    if (!r) return;
    setFlash({ text: r.text, tone: r.ok ? 'pos' : 'neg' });
    bump((x) => x + 1);
    if (r.ok) void onPersist();
  };
  const ask = (c: any) => setConfirm(c);
  /** Actions from the drawer and panels, as "verb:args". */
  const act = (cmd: string) => {
    const [verb, a, b, c] = cmd.split(':');
    if (verb === 'sign') return done(signProspect(appState, a));
    if (verb === 'prog') return done(startProgramme(appState, a, b, c));
    if (verb === 'stopprog') return done(cancelProgramme(appState, a));
    if (verb === 'series') return done(moveSeries(appState, a, b));
    if (verb === 'reserve') { const r = promoteToReserve(appState, a); if (r.ok) setOpen(null); return done(r); }
    if (verb === 'seat') { const r = promoteToRaceSeat(appState, a, b); if (r.ok) setOpen(null); return done(r); }
    if (verb === 'plan') return done(planRaceSeat(appState, a, b));
    if (verb === 'release') { const r = releaseProspect(appState, a); if (r.ok) setOpen(null); return done(r); }
    if (verb === 'renew') return done(renewContract(appState, a));
    if (verb === 'tab') { setOpen(null); setTab(a as Tab); if (b) setLoanFor(b); return; }
  };
  const star = (n: string) => { toggleShortlist(appState, n); bump((x) => x + 1); void onPersist(); };
  const pickCompare = (n: string) => setCompare((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c.slice(-2), n]));
  const scoutDriver = (n: string) => { setOpen(null); setScoutFor(n); setTab('scouting'); };

  const kpis: any[] = [
    { icon: Wallet, label: 'Academy budget', value: ov.budget, fmt: (v: number) => money(v), sub: <button type="button" className="ac-link" onClick={() => setAllocOpen(true)}>Add funds from the team</button> },
    { icon: Gauge, label: 'Academy rating', value: ov.rating, fmt: (v: number) => `${Math.round(v)}`, sub: `Level ${ov.level} · reputation ${ov.reputation}` },
    { icon: Users, label: 'Signed prospects', value: ov.signed, fmt: (v: number) => `${Math.round(v)}`, sub: `${ov.loaned} on loan` },
    { icon: GraduationCap, label: 'Squad capacity', value: ov.capacity, raw: `${ov.signed}/${ov.capacity}`, sub: `${Math.max(0, ov.capacity - ov.signed)} places free` },
    { icon: Sparkles, label: 'Average potential', value: ov.avgPotential ?? 0, raw: ov.avgPotential == null ? '–' : null, fmt: (v: number) => `${Math.round(v)}`, sub: 'Academy and loan drivers' },
    { icon: Telescope, label: 'Active scouts', value: ov.activeScouts, raw: `${ov.activeScouts}/${ov.scouts}`, sub: `Up to ${MAX_SCOUTS(ov.level)} at this level` },
    { icon: Dumbbell, label: 'Development projects', value: ov.programmes, fmt: (v: number) => `${Math.round(v)}`, sub: 'Programmes running' },
  ];
  const market = marketList(appState).filter((d: any) => !ac.prospects.some((p: any) => p.name === d.name));
  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'prospects', label: 'Prospects', count: market.length }, { id: 'scouting', label: 'Scouting', count: ac.scoutStaff.length },
    { id: 'development', label: 'Development', count: ov.programmes }, { id: 'loans', label: 'Loans', count: ac.loanedOut.length },
  ];

  return (
    <div className="ac-root">
      <div className="ac-head">
        <div><h1>Academy</h1><p>Discover, sign and develop junior drivers, from karting to a race seat.</p></div>
      </div>

      <div className="ac-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="ac-kpi"><span>{k.label}</span><strong>{k.raw ? k.raw : <AnimatedNumber value={k.value} formatter={k.fmt} />}</strong><em>{k.sub}</em></div>
        ))}
      </div>

      <nav className="ac-tabs" role="tablist" aria-label="Academy sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ac-tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && <em>{t.count}</em>}
            {tab === t.id && <motion.span layoutId="ac-tab-line" className="ac-tab-line" transition={{ duration: 0.3, ease: EASE }} />}
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {flash && (
          <motion.div className={`ac-flash is-${flash.tone}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status">
            <span>{flash.text}</span>
            <button type="button" className="ac-icon" onClick={() => setFlash(null)} aria-label="Dismiss"><X size={14} strokeWidth={1.5} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
          {tab === 'overview' && <Overview {...{ appState, ov, setOpen, stage, setStage, setAllocOpen, setTab }} />}
          {tab === 'prospects' && <Prospects {...{ appState, market, setOpen, compare, pickCompare, star, setShowCompare }} />}
          {tab === 'scouting' && <Scouting {...{ appState, done, ask, setOpen, scoutFor, setScoutFor }} />}
          {tab === 'development' && <Development {...{ appState, done, ask, setOpen }} />}
          {tab === 'loans' && <Loans {...{ appState, done, ask, setOpen, loanFor, setLoanFor }} />}
        </motion.div>
      </AnimatePresence>

      <ProfileDrawer state={appState} name={open} onClose={() => setOpen(null)} act={act} ask={ask} onCompare={(n: string) => { pickCompare(n); setOpen(null); setTab('prospects'); }}
        onScout={scoutDriver} shortlisted={!!open && ac.shortlist.includes(open)} onShortlist={star} />
      <Confirm open={!!confirm} {...(confirm || {})} onClose={() => setConfirm(null)} />
      <AllocateDialog open={allocOpen} appState={appState} onClose={() => setAllocOpen(false)} onDone={done} />
      <CompareDialog open={showCompare} appState={appState} names={compare} onClose={() => setShowCompare(false)} />
    </div>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────────── */

const NEWS_ICON: Record<string, { icon: any; tone?: string }> = {
  development: { icon: TrendingUp, tone: 'good' }, programme: { icon: Dumbbell }, discovery: { icon: Telescope }, report: { icon: FileSearch },
  signing: { icon: UserPlus, tone: 'red' }, loan: { icon: Plane }, promotion: { icon: GraduationCap, tone: 'red' }, title: { icon: Trophy, tone: 'good' },
  race: { icon: Flag }, morale: { icon: AlertTriangle, tone: 'bad' }, departure: { icon: AlertTriangle, tone: 'bad' }, finance: { icon: Wallet, tone: 'bad' },
  facility: { icon: Building2 }, level: { icon: Sparkles, tone: 'good' }, objective: { icon: CheckCircle2, tone: 'good' }, ai: { icon: Users }, series: { icon: Flag },
  contract: { icon: FileSearch }, reputation: { icon: Gauge }, scout: { icon: Telescope }, transfer: { icon: Wallet }, system: { icon: Newspaper },
};

function Overview({ appState, ov, setOpen, stage, setStage, setAllocOpen, setTab }: any) {
  const ac = appState.academy;
  const squad = [...ac.prospects.map((d: any) => ({ d, loan: false })), ...ac.loanedOut.map((d: any) => ({ d, loan: true }))];
  const graduates = [appState.team.reserveDriver, ...(appState.team.drivers || [])].filter((d: any) => d?.academyGraduate);
  const counts: Record<string, { n: number; loans: number }> = Object.fromEntries(PIPELINE.map((s) => [s, { n: 0, loans: 0 }]));
  squad.forEach(({ d, loan }: any) => { const s = LADDER.includes(d.series) ? d.series : (SERIES[d.series]?.tier >= 4 ? 'f2' : 'f3'); counts[s].n++; if (loan) counts[s].loans++; });
  graduates.forEach((d: any) => { const s = appState.team.reserveDriver?.name === d.name ? 'reserve' : 'f1'; counts[s].n++; });
  const shown = stage ? squad.filter(({ d }: any) => (LADDER.includes(d.series) ? d.series : SERIES[d.series]?.tier >= 4 ? 'f2' : 'f3') === stage) : squad;
  const xpPct = Math.min(1, ov.xp / ov.xpNext);
  const fin = financeSummary(appState);
  const objs = objectiveProgress(appState);
  const devGain = squad.length ? squad.reduce((s: number, { d }: any) => s + (ovr(d) - (d.signedOvr ?? ovr(d))), 0) : 0;
  const R = 62; const C = 2 * Math.PI * R;

  return (
    <div className="ac-ov">
      <div className="ac-ov-left">
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Academy performance</h2><p>Level {ov.level} of 10</p></div>
          <div className="ac-perf">
            <div className="ac-ring" title={`${ov.xp} of ${ov.xpNext} XP to level ${ov.level + 1}`}>
              <svg viewBox="0 0 148 148" aria-hidden="true">
                <circle cx="74" cy="74" r={R} className="ac-ring-track" />
                <motion.circle cx="74" cy="74" r={R} className="ac-ring-fill" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - xpPct) }} transition={{ duration: 0.9, ease: EASE }} />
              </svg>
              <div className="ac-ring-text"><span>Level</span><strong>{ov.level}</strong><em>{ov.xpNext - ov.xp} XP to next</em></div>
            </div>
            <dl className="ac-perf-stats">
              <div className="ac-stat"><dt>Academy rating</dt><dd>{ov.rating}<small>/100</small></dd></div>
              <div className="ac-stat"><dt>Reputation</dt><dd>{ov.reputation}<small>/100</small></dd></div>
              <div className="ac-stat"><dt>Graduates</dt><dd>{ov.graduates}</dd></div>
              <div className="ac-stat"><dt>Prospects</dt><dd>{ov.signed + ov.loaned}<small>{ov.loaned ? `${ov.loaned} on loan` : ''}</small></dd></div>
              <div className="ac-stat"><dt>Average potential</dt><dd>{ov.avgPotential ?? '–'}</dd></div>
              <div className="ac-stat"><dt>Development since signing</dt><dd>{devGain >= 0 ? '+' : ''}{devGain}<small>overall, all drivers</small></dd></div>
            </dl>
          </div>
        </section>

        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Development pipeline</h2><p>{stage ? <button type="button" className="ac-link" onClick={() => setStage(null)}>Show all stages</button> : 'Click a stage to filter the squad'}</p></div>
          <div className="ac-pipe">
            {PIPELINE.map((s) => (
              <button key={s} type="button" className={`ac-stage ${stage === s ? 'is-on' : ''} ${counts[s].n ? '' : 'is-empty'}`} onClick={() => setStage(stage === s ? null : s)} aria-pressed={stage === s}>
                <span>{PIPELINE_LABELS[s]}</span><strong>{counts[s].n}</strong>
                <i>{Array.from({ length: counts[s].n }).map((_, i) => <b key={i} className={i < counts[s].loans ? 'is-loan' : ''} />)}</i>
              </button>
            ))}
          </div>
        </section>

        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Academy squad</h2><p>{stage ? `${PIPELINE_LABELS[stage]} · ${shown.length}` : `${squad.length} drivers`}</p></div>
          {shown.length ? (
            <div className="ac-squad">
              <div className="ac-sq-head"><span>Driver</span><span>Series</span><span>Age</span><span>Overall / potential</span><span>Trajectory</span><span>Morale</span><span>Contract</span></div>
              {shown.map(({ d, loan }: any) => (
                <button key={d.name} type="button" className="ac-sq-row" onClick={() => setOpen(d.name)}>
                  <span className="ac-who"><Avatar d={d} size={36} /><div><strong>{d.name}</strong><em>{nationalityText(d)}{loan ? ` · on loan, ${d.loanStatus?.team}` : d.programme ? ` · ${PROGRAMMES[d.programme.id].label}` : ''}</em></div></span>
                  <span>{SERIES[d.series]?.label}</span>
                  <span className="ac-num">{d.age}</span>
                  <span className="ac-ovpot"><span><b>{ovr(d)}</b>{potential(d)}</span><div className="ac-bar"><span className="is-pot" style={{ width: `${potential(d)}%` }} /><motion.span initial={false} animate={{ width: `${ovr(d)}%` }} transition={{ duration: 0.5 }} /></div></span>
                  <span><Traj d={d} /></span>
                  <span><Morale v={d.morale} /></span>
                  <span className="ac-muted">{d.contractYearsRemaining} season{d.contractYearsRemaining === 1 ? '' : 's'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="ac-empty">{squad.length ? 'No drivers at this stage.' : <>No academy drivers yet. <button type="button" className="ac-link" onClick={() => setTab('prospects')}>Browse prospects</button> or send a scout out.</>}</p>
          )}
          {graduates.length > 0 && <p className="ac-note" style={{ marginTop: 12 }}>Graduates with the team: {graduates.map((g: any) => g.name).join(', ')}.</p>}
        </section>

        <section className="ac-panel ac-fin">
          <div className="ac-panel-head"><h2>Academy finances</h2><button type="button" className="ac-btn is-sm" onClick={() => setAllocOpen(true)}><Wallet size={13} strokeWidth={1.5} />Allocate funds</button></div>
          <div className="ac-fin-split">
            <div>
              <h4>This season</h4>
              <dl>
                {Object.entries(fin.by).filter(([k]) => k !== 'allocation').map(([k, v]: any) => (
                  <div key={k}><dt>{LEDGER_LABELS[k]}</dt><dd className={v < 0 ? 'ac-neg' : v > 0 ? 'ac-pos' : ''}>{v === 0 ? '–' : `${v > 0 ? '+' : '−'}${money(Math.abs(v))}`}</dd></div>
                ))}
                <div className="is-total"><dt>Total development spending</dt><dd>{money(fin.spent)}</dd></div>
                <div><dt>{LEDGER_LABELS.allocation}</dt><dd className="ac-pos">{fin.funded ? `+${money(fin.funded)}` : '–'}</dd></div>
              </dl>
            </div>
            <div>
              <h4>Running costs, per season</h4>
              <dl>
                <div><dt>Driver salaries</dt><dd>{money(fin.commitments.salaries)}</dd></div>
                <div><dt>Junior race seats</dt><dd>{money(fin.commitments.seats)}</dd></div>
                <div><dt>Scout salaries</dt><dd>{money(fin.commitments.scouts)}</dd></div>
                <div><dt>Loan teams' contributions</dt><dd className={fin.commitments.loans >= 0 ? 'ac-pos' : 'ac-neg'}>{fin.commitments.loans >= 0 ? '+' : '−'}{money(Math.abs(fin.commitments.loans))}</dd></div>
                <div className="is-total"><dt>Net running cost</dt><dd>{money(fin.commitments.total)}</dd></div>
              </dl>
              <p className="ac-note" style={{ marginTop: 8 }}>Charged every four weeks from the academy budget. If it runs dry, drivers' morale and the academy's reputation suffer.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="ac-ov-right">
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Academy news</h2><p>{ac.news.length} updates</p></div>
          {ac.news.length ? (
            <ol className="ac-news">
              {ac.news.slice(0, 40).map((n: any) => {
                const I = NEWS_ICON[n.type] || NEWS_ICON.system;
                const clickable = n.driver && knownDriver(appState, n.driver);
                return (
                  <li key={n.id}>
                    <span className={`ac-news-ico is-${I.tone || ''}`}><I.icon size={13} strokeWidth={1.5} /></span>
                    <div>{clickable ? <button type="button" onClick={() => setOpen(n.driver)}><p>{n.text}</p></button> : <p>{n.text}</p>}<em>Season {n.year} · day {n.day}</em></div>
                  </li>
                );
              })}
            </ol>
          ) : <p className="ac-empty">Nothing yet. News comes from development, scouting, junior races, loans and the market as days pass.</p>}
        </section>

        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Objectives</h2><p>{objs.filter((o: any) => o.done).length} of {objs.length} complete</p></div>
          <div className="ac-objs">
            {objs.map((o: any) => (
              <div key={o.id} className={`ac-obj ${o.done ? 'is-done' : ''}`}>
                <i>{o.done ? <CheckCircle2 size={12} strokeWidth={2} /> : null}</i>
                <div><strong>{o.label}</strong><em>{o.detail} · {rewardText(o.reward)}</em>
                  {!o.done && o.target > 1 && <div className="ac-bar"><motion.span className="is-red" initial={false} animate={{ width: `${(o.value / o.target) * 100}%` }} /></div>}</div>
                <span>{o.value}/{o.target}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Prospects marketplace ────────────────────────────────────────────── */

const SORTS: Record<string, { label: string; key: (r: any) => number; dir: number }> = {
  potential: { label: 'Highest potential', key: (r) => r.p.mid ?? -1, dir: -1 },
  overall: { label: 'Highest overall', key: (r) => r.o.mid ?? -1, dir: -1 },
  young: { label: 'Youngest', key: (r) => r.d.age, dir: 1 },
  cost: { label: 'Lowest recruitment cost', key: (r) => r.cost, dir: 1 },
  trajectory: { label: 'Best development trajectory', key: (r) => r.traj.perSeason, dir: -1 },
  value: { label: 'Best overall value', key: (r) => ((r.p.mid ?? 60) - 55) / Math.max(0.3, r.cost), dir: -1 },
};
const STATUSES = ['unscouted', 'initial', 'evaluating', 'recommended', 'available', 'contracted', 'notInterested'];
const STATUS_LABEL: Record<string, string> = { unscouted: 'Unscouted', initial: 'Initial observation', evaluating: 'Under evaluation', recommended: 'Highly recommended', available: 'Available to sign', contracted: 'Already contracted', notInterested: 'Not interested' };
const TRAJ = [['rapid', 'Improving rapidly'], ['normal', 'Progressing normally'], ['stagnant', 'Stagnating'], ['declining', 'Declining']];
const NO_FILTER = { maxAge: 25, nat: '', series: '', minOvr: 0, minPot: 0, maxValue: 6, maxSalary: 2, traj: '', status: '', shortlist: false };

function Prospects({ appState, market, setOpen, compare, pickCompare, star, setShowCompare }: any) {
  const ac = appState.academy;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('potential');
  const [show, setShow] = useState(false);
  const [f, setF] = useState<any>(NO_FILTER);
  const rows = useMemo(() => market.map((d: any) => {
    const { o, p } = ratingEstimates(appState, d);
    const status = scoutStatus(appState, d);
    const cost = signingFee(d) + juniorSalary(d) + (SERIES[d.series]?.seatCost || 0);
    return { d, o, p, status, cost, value: juniorValue(d), salary: juniorSalary(d), traj: trajectory(d), kn: knowledgeOf(appState, d.name), interest: interestIn(appState, d) };
  }), [market, appState, ac.knowledge, ac.shortlist.length]);
  const nats = [...new Set(rows.map((r: any) => nationalityText(r.d)))].sort() as string[];
  const list = rows.filter((r: any) => {
    if (q && !`${r.d.name} ${r.d.juniorTeam || ''} ${r.d.aiTeam || ''} ${nationalityText(r.d)}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (r.d.age > f.maxAge) return false;
    if (f.nat && nationalityText(r.d) !== f.nat) return false;
    if (f.series && r.d.series !== f.series) return false;
    if (f.minOvr && (r.o.high ?? 0) < f.minOvr) return false;
    if (f.minPot && (r.p.high ?? 0) < f.minPot) return false;
    if (r.value > f.maxValue || r.salary > f.maxSalary) return false;
    if (f.traj && r.traj.id !== f.traj) return false;
    if (f.status && r.status.id !== f.status) return false;
    if (f.shortlist && !ac.shortlist.includes(r.d.name)) return false;
    return true;
  }).sort((a: any, b: any) => (SORTS[sort].key(a) - SORTS[sort].key(b)) * SORTS[sort].dir);

  return (
    <div>
      <div className="ac-tools">
        <label className="ac-field ac-search"><span className="sr-only">Search</span><Search size={14} strokeWidth={1.5} /><input type="search" placeholder="Search name, team or nationality" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="ac-field" style={{ width: 220 }}>Sort<select value={sort} onChange={(e) => setSort(e.target.value)}>{Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></label>
        <button type="button" className={`ac-btn ${show ? '' : 'is-ghost'}`} onClick={() => setShow((v) => !v)} aria-expanded={show}><SlidersHorizontal size={14} strokeWidth={1.5} />Filters</button>
        <button type="button" className={`ac-btn ${f.shortlist ? '' : 'is-ghost'}`} onClick={() => setF({ ...f, shortlist: !f.shortlist })} aria-pressed={f.shortlist}><Star size={14} strokeWidth={1.5} />Shortlist · {ac.shortlist.length}</button>
        <span className="ac-muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>{list.length} of {rows.length} drivers</span>
      </div>
      <AnimatePresence initial={false}>
        {show && (
          <motion.div className="ac-filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <label className="ac-field">Max age <b>{f.maxAge}</b><input type="range" min={15} max={25} value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: +e.target.value })} /></label>
            <label className="ac-field">Overall at least <b>{f.minOvr || 'any'}</b><input type="range" min={0} max={85} value={f.minOvr} onChange={(e) => setF({ ...f, minOvr: +e.target.value })} /></label>
            <label className="ac-field">Potential at least <b>{f.minPot || 'any'}</b><input type="range" min={0} max={95} value={f.minPot} onChange={(e) => setF({ ...f, minPot: +e.target.value })} /></label>
            <label className="ac-field">Market value up to <b>{money(f.maxValue)}</b><input type="range" min={0.2} max={6} step={0.1} value={f.maxValue} onChange={(e) => setF({ ...f, maxValue: +e.target.value })} /></label>
            <label className="ac-field">Salary up to <b>{money(f.maxSalary)}</b><input type="range" min={0.1} max={2} step={0.05} value={f.maxSalary} onChange={(e) => setF({ ...f, maxSalary: +e.target.value })} /></label>
            <label className="ac-field">Nationality<select value={f.nat} onChange={(e) => setF({ ...f, nat: e.target.value })}><option value="">Any</option>{nats.map((n) => <option key={n}>{n}</option>)}</select></label>
            <label className="ac-field">Current series<select value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })}><option value="">Any</option>{Object.values(SERIES).map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="ac-field">Trajectory<select value={f.traj} onChange={(e) => setF({ ...f, traj: e.target.value })}><option value="">Any</option>{TRAJ.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="ac-field">Scouting status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
            <div className="ac-filter-foot"><span className="ac-note">Rating filters use the top of each scouting range.</span><button type="button" className="ac-link" onClick={() => setF(NO_FILTER)}>Reset filters</button></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ac-grid">
        <AnimatePresence initial={false}>
          {list.map((r: any) => (
            <motion.div key={r.d.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
              className={`ac-card is-${r.status.id} ${compare.includes(r.d.name) ? 'is-picked' : ''}`} role="button" tabIndex={0}
              onClick={() => setOpen(r.d.name)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(r.d.name); }} aria-label={`${r.d.name}, ${r.status.label}`}>
              <div className="ac-card-top">
                <Avatar d={r.d} size={46} />
                <div><strong>{r.d.name}</strong><em>{r.d.age} · {nationalityText(r.d)}</em><em>{SERIES[r.d.series]?.label}{r.d.aiTeam ? ` · ${r.d.aiTeam} junior` : r.d.juniorTeam ? ` · ${r.d.juniorTeam}` : ''}</em></div>
                <div className="ac-card-acts" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className={`ac-icon ${ac.shortlist.includes(r.d.name) ? 'is-on' : ''}`} onClick={() => star(r.d.name)} aria-label={ac.shortlist.includes(r.d.name) ? 'Remove from shortlist' : 'Add to shortlist'}><Star size={13} strokeWidth={1.5} fill={ac.shortlist.includes(r.d.name) ? 'currentColor' : 'none'} /></button>
                  <button type="button" className={`ac-icon ${compare.includes(r.d.name) ? 'is-on' : ''}`} onClick={() => pickCompare(r.d.name)} aria-label="Pick for comparison"><GitCompare size={13} strokeWidth={1.5} /></button>
                </div>
              </div>
              <div className="ac-card-meta"><Badge id={r.status.id} label={r.status.label} /><Traj d={r.d} /></div>
              <div className="ac-card-rat">
                <div><span>Overall<b>{r.o.text}</b></span><EstBar est={r.o} /></div>
                <div><span>Potential<b>{r.p.text}</b></span><EstBar est={r.p} tone="is-red" /></div>
              </div>
              <div className="ac-card-foot">
                <div><span>Market value</span><b className="ac-num">{money(r.value)}</b></div>
                <div><span>Salary</span><b className="ac-num">{money(r.salary)}</b></div>
                <div><span>{r.d.juniorStats?.starts ? 'This season' : 'Interest'}</span><b>{r.d.juniorStats?.starts ? `${r.d.juniorStats.wins}W · ${r.d.juniorStats.points} pts` : r.kn.k >= 30 ? `${r.interest}/100` : '–'}</b></div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && <p className="ac-empty">No prospects match these filters.</p>}
      </div>

      {compare.length > 0 && (
        <div className="ac-tray">
          <span>Comparing {compare.join(', ')}</span>
          <button type="button" className="ac-btn is-ghost is-sm" onClick={() => compare.forEach((n: string) => pickCompare(n))}>Clear</button>
          <button type="button" className="ac-btn is-primary is-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}><GitCompare size={13} strokeWidth={1.5} />Compare {compare.length}</button>
        </div>
      )}
    </div>
  );
}

/* ─── Comparison ───────────────────────────────────────────────────────── */

const CMP_COLORS = ['#E10600', '#5aa9e6', '#e8c547'];
function CompareDialog({ open, appState, names, onClose }: any) {
  const ds = (names || []).map((n: string) => knownDriver(appState, n)).filter(Boolean);
  const keys = ['pace', 'quali', 'racecraft', 'consistency', 'tyre', 'adaptability'];
  const rows: [string, (d: any) => { v: number | null; text: string }, number][] = [
    ['Overall', (d) => { const e = estimate(appState, d, 'overall', ovr(d)); return { v: e.mid, text: e.text }; }, 1],
    ['Potential', (d) => { const e = estimate(appState, d, 'potential', potential(d)); return { v: e.mid, text: e.text }; }, 1],
    ...keys.map((k) => [ATTRIBUTE_LABELS[k], (d: any) => { const e = estimate(appState, d, k, d[k] ?? 60); return { v: e.mid, text: e.text }; }, 1] as any),
    ['Age', (d) => ({ v: d.age, text: String(d.age) }), -1],
    ['Trajectory (overall a season)', (d) => { const t = trajectory(d); return { v: t.perSeason, text: `${t.perSeason >= 0 ? '+' : ''}${t.perSeason}` }; }, 1],
    ['First-season cost', (d) => { const c = signingFee(d) + juniorSalary(d) + (SERIES[d.series]?.seatCost || 0); return { v: c, text: money(c) }; }, -1],
    ['Salary expectation', (d) => ({ v: juniorSalary(d), text: money(juniorSalary(d)) }), -1],
  ];
  return (
    <Confirm open={open} title="Prospect comparison" confirmLabel="Done" wide hideCancel onConfirm={() => {}} onClose={onClose}
      body={ds.length < 2 ? 'Pick at least two prospects.' : (
        <div className="ac-cmp">
          <div>
            <Radar labels={keys.map((k) => ATTRIBUTE_LABELS[k].split(' ')[0])} series={ds.map((d: any, i: number) => ({ name: d.name, color: CMP_COLORS[i], values: keys.map((k) => estimate(appState, d, k, d[k] ?? 60).mid ?? 40) }))} />
            <div className="ac-cmp-key">{ds.map((d: any, i: number) => <span key={d.name}><i style={{ background: CMP_COLORS[i] }} />{d.name}</span>)}</div>
            <p className="ac-note" style={{ marginTop: 8 }}>Unsigned drivers are shown by the middle of their scouting range.</p>
          </div>
          <table className="ac-table ac-cmp-table">
            <thead><tr><th /> {ds.map((d: any) => <th key={d.name} className="num">{d.name.split(' ').pop()}</th>)}</tr></thead>
            <tbody>
              {rows.map(([label, fn, better]) => {
                const vals = ds.map((d: any) => fn(d));
                const nums = vals.map((v: any) => v.v).filter((v: any) => v != null);
                const best = nums.length ? (better > 0 ? Math.max(...nums) : Math.min(...nums)) : null;
                return <tr key={label}><td>{label}</td>{vals.map((v: any, i: number) => <td key={i} className={`num ${v.v === best && nums.length > 1 ? 'is-best' : ''}`}>{v.text}</td>)}</tr>;
              })}
            </tbody>
          </table>
        </div>
      )} />
  );
}

/* ─── Funding ──────────────────────────────────────────────────────────── */

function AllocateDialog({ open, appState, onClose, onDone }: any) {
  const [amt, setAmt] = useState(5);
  const max = Math.max(0, Math.floor(appState.team?.budget || 0));
  return (
    <Confirm open={open} title="Fund the academy" confirmLabel={`Move ${money(amt)}`} onClose={onClose} onConfirm={() => onDone(allocateFunds(appState, amt))}
      body={<>
        <p style={{ marginBottom: 12 }}>Moves money from the team budget ({money(appState.team?.budget || 0)}) into the academy budget ({money(appState.academy.budget)}). It can't be moved back.</p>
        <label className="ac-field">Amount <b>{money(amt)}</b><input type="range" min={1} max={Math.max(1, Math.min(60, max))} step={1} value={amt} onChange={(e) => setAmt(+e.target.value)} /></label>
      </>} />
  );
}

/* ─── Scouting ─────────────────────────────────────────────────────────── */

const SCOUT_ATTRS: [string, string][] = [['ability', 'Scouting ability'], ['technical', 'Technical assessment'], ['potentialEye', 'Potential identification'], ['experience', 'Experience'], ['reliability', 'Reliability']];

function Scouting({ appState, done, ask, setOpen, scoutFor, setScoutFor }: any) {
  const ac = appState.academy;
  const cands = scoutCandidates(appState);
  const watch = Object.entries(ac.knowledge).filter(([n, k]: any) => k.k > 0 && !ac.prospects.some((d: any) => d.name === n) && knownDriver(appState, n)).sort((a: any, b: any) => b[1].k - a[1].k).slice(0, 16);
  return (
    <div className="ac-two">
      <div className="ac-col">
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Scouting department</h2><p>{ac.scoutStaff.length} of {MAX_SCOUTS(ac.level)} scouts · knowledge drives how precise every estimate is</p></div>
          <div className="ac-scouts">
            {ac.scoutStaff.map((s: any) => <ScoutCard key={s.id} {...{ appState, s, done, ask, scoutFor, setScoutFor }} />)}
          </div>
        </section>
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Drivers under observation</h2><p>Knowledge builds through monitoring and evaluations</p></div>
          {watch.length ? (
            <table className="ac-table">
              <thead><tr><th>Driver</th><th>Series</th><th className="num">Overall</th><th className="num">Potential</th><th>Knowledge</th><th>Status</th></tr></thead>
              <tbody>{watch.map(([n, k]: any) => { const d = knownDriver(appState, n); const { o, p } = ratingEstimates(appState, d); const st = scoutStatus(appState, d); return (
                <tr key={n}><td><button type="button" className="ac-link" onClick={() => setOpen(n)}>{n}</button></td><td>{SERIES[d.series]?.short}</td><td className="num">{o.text}</td><td className="num">{p.text}</td>
                  <td style={{ minWidth: 120 }}><div className="ac-bar"><motion.span className="is-red" initial={false} animate={{ width: `${k.k}%` }} /></div></td><td><Badge id={st.id} label={st.label} /></td></tr>); })}</tbody>
            </table>
          ) : <p className="ac-empty">No drivers observed yet. Send a scout to discover talent or monitor a prospect.</p>}
        </section>
      </div>
      <div className="ac-col">
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Scouting reports</h2><p>Full evaluations</p></div>
          {ac.reports.length ? <ul className="ac-list">{ac.reports.slice(0, 12).map((r: any) => <li key={r.name}><button type="button" className="ac-link" onClick={() => setOpen(r.name)}>{r.name}</button><b>{r.scout} · S{r.year} day {r.day}</b></li>)}</ul>
            : <p className="ac-empty">No full reports yet. Order one with a full evaluation; accuracy depends on the scout's technical and potential reads.</p>}
        </section>
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Scouts available</h2><p>Hiring costs half a season's salary</p></div>
          <div className="ac-cands">
            {cands.map((c: any) => (
              <div key={c.id} className="ac-cand">
                <div><strong>{c.name}</strong><em>Ability {c.ability} · technical {c.technical} · potential {c.potentialEye} · experience {c.experience} · reliability {c.reliability}</em></div>
                <button type="button" className="ac-btn is-sm" disabled={ac.scoutStaff.length >= MAX_SCOUTS(ac.level)} onClick={() => ask({ title: `Hire ${c.name}?`, confirmLabel: `Hire for ${money(c.salary * 0.5)}`, body: <>{money(c.salary)} a season in salary, plus {money(c.salary * 0.5)} now from the academy budget.</>, onConfirm: () => done(hireScout(appState, c.id)) })}>Hire · {money(c.salary)}</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScoutCard({ appState, s, done, ask, scoutFor, setScoutFor }: any) {
  const ac = appState.academy;
  const [type, setType] = useState(scoutFor ? 'evaluate' : 'discover');
  const [area, setArea] = useState('europe');
  const [target, setTarget] = useState(scoutFor || '');
  const targets = marketList(appState).filter((d: any) => !ac.prospects.some((p: any) => p.name === d.name));
  const a = s.assignment;
  const pct = a ? (a.days ? a.progress / a.days : (knowledgeOf(appState, a.target).k) / 70) : 0;
  const submit = () => {
    const task = type === 'discover' ? { type, area } : { type, target };
    if (type === 'evaluate') ask({ title: `Evaluate ${target}?`, confirmLabel: `Start for ${money(ASSIGNMENTS.evaluate.cost)}`, body: <>{s.name} studies {target} for about {Math.round(24 - s.ability * 0.1)} days and files a full report.</>, onConfirm: () => { done(assignScoutTask(appState, s.id, task)); setScoutFor(null); } });
    else { done(assignScoutTask(appState, s.id, task)); setScoutFor(null); }
  };
  return (
    <div className="ac-scout">
      <div className="ac-scout-head"><div><strong>{s.name}</strong><br /><em>{money(s.salary)} a season · {s.finds} finds</em></div>
        <button type="button" className="ac-link" onClick={() => ask({ title: `Release ${s.name}?`, confirmLabel: 'Release', danger: true, body: 'Their salary stops. Any work in progress is lost.', onConfirm: () => done(releaseScout(appState, s.id)) })}>Release</button></div>
      <div className="ac-attrs">{SCOUT_ATTRS.map(([k, l]) => <div key={k} className="ac-attr"><span>{l}</span><div className="ac-bar"><span style={{ width: `${s[k]}%` }} /></div><b>{s[k]}</b></div>)}</div>
      {a ? (
        <div className="ac-task">
          <div className="ac-task-head"><span>{a.type === 'discover' ? `Discovering talent: ${SCOUT_REGIONS[a.area]?.label}` : a.type === 'monitor' ? `Monitoring ${a.target}` : `Evaluating ${a.target}`}</span><button type="button" className="ac-link" onClick={() => done(recallScoutTask(appState, s.id))}>Recall</button></div>
          <div className="ac-bar"><motion.span className="is-red" initial={false} animate={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
          <span className="ac-muted">{a.days ? `Day ${a.progress} of ${a.days}` : `Knowledge ${Math.round(knowledgeOf(appState, a.target).k)}% (monitoring reaches 70%)`}</span>
        </div>
      ) : (
        <div className="ac-assign">
          <label className="ac-field">Assignment<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(ASSIGNMENTS).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          {type === 'discover'
            ? <label className="ac-field">Region<select value={area} onChange={(e) => setArea(e.target.value)}>{Object.entries(SCOUT_REGIONS).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            : <label className="ac-field">Driver<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{targets.map((d: any) => <option key={d.name} value={d.name}>{d.name} · {SERIES[d.series]?.short}</option>)}</select></label>}
          <p className="ac-note" style={{ gridColumn: '1 / -1' }}>{ASSIGNMENTS[type].summary}. {type === 'discover' ? `Travel ${money(SCOUT_REGIONS[area].dayCost * 30)} a month.` : type === 'monitor' ? `${money(ASSIGNMENTS.monitor.dayCost * 30)} a month.` : `${money(ASSIGNMENTS.evaluate.cost)} up front.`}</p>
          <button type="button" className="ac-btn is-sm" disabled={type !== 'discover' && !target} onClick={submit}><Telescope size={13} strokeWidth={1.5} />Send {s.name.split(' ')[0]}</button>
        </div>
      )}
    </div>
  );
}

/* ─── Development ──────────────────────────────────────────────────────── */

function Development({ appState, done, ask, setOpen }: any) {
  const ac = appState.academy;
  return (
    <div className="ac-two">
      <section className="ac-panel">
        <div className="ac-panel-head"><h2>Training programmes</h2><p>Gains come day by day, capped by each driver's potential</p></div>
        {ac.prospects.length ? ac.prospects.map((d: any) => <DevRow key={d.name} {...{ appState, d, done, ask, setOpen }} />)
          : <p className="ac-empty">Sign prospects to start development programmes. Drivers on loan develop through racing instead.</p>}
        <p className="ac-note" style={{ marginTop: 12 }}>Effectiveness depends on the programme's facilities, driver coaching, age (best up to 19, fading after 21), headroom to potential, morale and workload. Repeating a programme gives less each time.</p>
      </section>
      <section className="ac-panel">
        <div className="ac-panel-head"><h2>Facilities</h2><p>Academy level {ac.level} allows up to level {facilityInfo(appState, 'simulator').cap}</p></div>
        <div className="ac-facs">
          {Object.keys(FACILITIES).map((k) => {
            const f = facilityInfo(appState, k);
            return (
              <div key={k} className="ac-fac">
                <div className="ac-fac-head"><strong>{f.label}</strong><span className="ac-pips" aria-label={`Level ${f.level} of ${f.max}`}>{Array.from({ length: f.max }).map((_, i) => <i key={i} className={i < f.level ? 'is-on' : i >= f.cap ? 'is-cap' : ''} />)}</span></div>
                <p>{f.effect}</p>
                <div className="ac-fac-nums"><span>Level<b>{f.level}</b></span><span>Effectiveness<b>{f.effectiveness}%</b></span><span>Next<b>{f.next == null ? 'Max' : `${f.next}% (+${f.gain})`}</b></span></div>
                {f.level < f.max && (
                  <button type="button" className="ac-btn is-sm" disabled={f.locked} title={f.locked ? `Needs academy level ${f.level * 2 - 1}` : undefined}
                    onClick={() => ask({ title: `Upgrade ${f.label}?`, confirmLabel: `Upgrade for ${money(f.cost)}`, body: <>Level {f.level} to {f.level + 1}: effectiveness {f.effectiveness}% to {f.next}%. {money(f.cost)} from the academy budget ({money(ac.budget)}).</>, onConfirm: () => done(upgradeFacility(appState, k)) })}>
                    {f.locked ? 'Raise the academy level first' : `Upgrade · ${money(f.cost)}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DevRow({ appState, d, done, ask, setOpen }: any) {
  const [prog, setProg] = useState('qualifying');
  const [load, setLoad] = useState('normal');
  const p = PROGRAMMES[prog];
  const eff = programmeEffectiveness(appState, d, prog, load);
  const cost = p.cost * WORKLOADS[load].costMult;
  const expected = Math.round(0.11 * eff * p.days * 10) / 10;
  return (
    <div className="ac-devrow">
      <div className="ac-prog">
        <button type="button" className="ac-who" style={{ border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => setOpen(d.name)}>
          <Avatar d={d} size={40} /><div><strong>{d.name}</strong><em>{d.age} · {SERIES[d.series]?.label} · overall {ovr(d)} of {potential(d)}</em></div>
        </button>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Traj d={d} /><Morale v={d.morale} /></div>
        <span className="ac-muted">{Object.entries(d.programmeCount || {}).map(([k, n]: any) => `${PROGRAMMES[k]?.label} ×${n}`).join(' · ') || 'No programmes completed'}</span>
      </div>
      {d.programme ? (
        <div className="ac-prog">
          <div className="ac-prog-head"><strong>{PROGRAMMES[d.programme.id].label}</strong><em>{WORKLOADS[d.programme.workload].label} · {Math.max(0, Math.ceil(d.programme.days - d.programme.progress))} days left</em></div>
          <div className="ac-bar"><motion.span className="is-red" initial={false} animate={{ width: `${(d.programme.progress / d.programme.days) * 100}%` }} /></div>
          <span className="ac-muted">{Object.keys(PROGRAMMES[d.programme.id].targets).map((a) => `${ATTRIBUTE_LABELS[a]} ${d.programme.startValues?.[a] ?? d[a]} → ${d[a]}`).join(' · ')}</span>
          <button type="button" className="ac-link" style={{ alignSelf: 'flex-start' }} onClick={() => done(cancelProgramme(appState, d.name))}>Stop programme</button>
        </div>
      ) : (
        <div className="ac-prog">
          <div className="ac-picker">
            {Object.entries(PROGRAMMES).map(([k, v]: any) => (
              <button key={k} type="button" className={`ac-pick ${prog === k ? 'is-on' : ''}`} onClick={() => setProg(k)} aria-pressed={prog === k}><strong>{v.label}</strong><em>{v.summary}</em></button>
            ))}
          </div>
          <div className="ac-plan">
            <p><b>{p.days} days · {money(cost)}</b> · effectiveness <b>{Math.round(eff * 100)}%</b> · expected about +{expected} across {Object.keys(p.targets).map((a) => ATTRIBUTE_LABELS[a].toLowerCase()).join(' and ')}, before the potential cap. {p.tradeoff}.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="ac-seg" role="radiogroup" aria-label="Workload">{Object.entries(WORKLOADS).map(([k, v]: any) => <button key={k} type="button" role="radio" aria-checked={load === k} className={load === k ? 'is-on' : ''} onClick={() => setLoad(k)}>{v.label}</button>)}</div>
              <button type="button" className="ac-btn is-sm is-primary" onClick={() => ask({ title: `Start ${p.label.toLowerCase()} for ${d.name}?`, confirmLabel: `Start for ${money(cost)}`, body: <>{p.days} days on a {WORKLOADS[load].label.toLowerCase()} workload. {money(cost)} from the academy budget ({money(appState.academy.budget)}).</>, onConfirm: () => done(startProgramme(appState, d.name, prog, load)) })}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Loans ────────────────────────────────────────────────────────────── */

function Loans({ appState, done, ask, setOpen, loanFor, setLoanFor }: any) {
  const ac = appState.academy;
  const who = loanFor && ac.prospects.some((d: any) => d.name === loanFor) ? loanFor : ac.prospects[0]?.name || '';
  const offers = who ? loanOffers(appState, who) : [];
  const [series, setSeries] = useState<string>(ac.loanedOut[0]?.series || ac.prospects[0]?.series || 'f3');
  const table = standingsFor(appState, series);
  return (
    <div className="ac-col">
      {ac.loanReviews.length > 0 && (
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Loan reviews</h2><p>Loans that ended at the season change</p></div>
          {ac.loanReviews.map((r: any) => (
            <div key={r.name} className="ac-offer">
              <div><strong>{r.name}</strong><p>{r.team} · {r.series} · season {r.year} · overall {r.devGain >= 0 ? '+' : ''}{r.devGain} · {r.objectives.filter((o: any) => o.met).length}/{r.objectives.length} objectives met</p></div>
              <div className="ac-acts">
                <button type="button" className="ac-btn is-sm" onClick={() => setOpen(r.name)}>Promote or plan</button>
                <button type="button" className="ac-btn is-sm" onClick={() => setLoanFor(r.name)}>Find a new loan</button>
                <button type="button" className="ac-btn is-sm is-ghost" onClick={() => { ac.loanReviews = ac.loanReviews.filter((x: any) => x.name !== r.name); done({ ok: true, text: `${r.name} stays at the academy.` }); }}>Keep at the academy</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="ac-panel">
        <div className="ac-panel-head"><h2>Drivers on loan</h2><p>{ac.loanedOut.length} placed · results come from the junior championships</p></div>
        {ac.loanedOut.length ? (
          <div className="ac-loans">
            {ac.loanedOut.map((d: any) => {
              const lp = loanProgress(appState, d); const ls = d.loanStatus;
              return (
                <div key={d.name} className="ac-loan">
                  <button type="button" className="ac-who" style={{ border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => setOpen(d.name)}>
                    <Avatar d={d} size={44} /><div><strong>{d.name}</strong><em>{ls.team} · {ls.series} · until end of season {ls.endYear}</em></div>
                  </button>
                  <div className="ac-loan-stats">
                    <div><span>Starts</span><b>{lp.stats?.starts || 0}</b></div><div><span>Wins</span><b>{lp.stats?.wins || 0}</b></div><div><span>Podiums</span><b>{lp.stats?.podiums || 0}</b></div>
                    <div><span>Points</span><b>{lp.stats?.points || 0}</b></div><div><span>Position</span><b>{lp.position ? `P${lp.position}` : '–'}</b></div>
                  </div>
                  <dl className="ac-terms">
                    <div><dt>Racing</dt><dd>{ls.seats}</dd></div>
                    <div><dt>Financial terms</dt><dd className={ls.contribution >= 0 ? 'ac-pos' : 'ac-neg'}>{ls.contribution >= 0 ? `They pay ${money(ls.contribution)} a season` : `We paid ${money(-ls.contribution)}`}</dd></div>
                    <div><dt>Development</dt><dd>Overall {lp.devGain >= 0 ? '+' : ''}{lp.devGain} · <Traj d={d} /></dd></div>
                    <div><dt>Morale</dt><dd><Morale v={d.morale} /></dd></div>
                  </dl>
                  <ul className="ac-checks">{lp.objectives.map((o: any) => <li key={o.label} className={o.met ? 'is-met' : ''}><i>{o.met ? '✓' : ''}</i>{o.label}<em>{o.now}</em></li>)}</ul>
                  <div className="ac-acts">
                    <button type="button" className="ac-btn is-sm" disabled={!ls.recallClause} title={ls.recallClause ? undefined : 'No recall clause in this deal'} onClick={() => ask({ title: `Recall ${d.name}?`, confirmLabel: 'Recall', body: 'They return to the academy now. Morale drops by 8.', onConfirm: () => done(recallLoan(appState, d.name)) })}>Recall{ls.recallClause ? '' : ' (no clause)'}</button>
                    <button type="button" className="ac-btn is-sm" onClick={() => done(extendLoan(appState, d.name))}>Extend a season</button>
                    <button type="button" className="ac-btn is-sm is-ghost" onClick={() => ask({ title: `Sell ${d.name} to ${ls.team}?`, confirmLabel: `Sell for ${money(juniorValue(d) * 0.9)}`, danger: true, body: `A permanent transfer: they leave the academy for good and the fee goes into the academy budget.`, onConfirm: () => done(sellLoanee(appState, d.name)) })}>Permanent transfer</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="ac-empty">No drivers on loan. A loan gives race experience at another team's expense, without the academy's own training.</p>}
      </section>

      <div className="ac-two">
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Loan offers</h2>
            <label className="ac-field" style={{ minWidth: 220 }}><span className="sr-only">Driver</span><select value={who} onChange={(e) => setLoanFor(e.target.value)}>{ac.prospects.map((d: any) => <option key={d.name} value={d.name}>{d.name} · overall {ovr(d)}</option>)}</select></label></div>
          {!who ? <p className="ac-empty">Sign prospects to receive loan offers.</p> : offers.length ? (
            <div className="ac-offers">
              {offers.map((o: any) => (
                <div key={o.id} className="ac-offer">
                  <div><strong>{o.team} · {o.seriesLabel}</strong>
                    <p>{o.duration} season{o.duration > 1 ? 's' : ''} · {o.seats} · {o.contribution >= 0 ? `they pay ${money(o.contribution)} a season` : `loan fee ${money(-o.contribution)}`} · {o.recallClause ? 'recall clause' : 'no recall clause'}<br />Objectives: {o.objectives.map((x: any) => x.label.toLowerCase()).join('; ')}</p></div>
                  <button type="button" className="ac-btn is-sm" onClick={() => ask({ title: `Loan ${who} to ${o.team}?`, confirmLabel: 'Agree loan', body: <>{o.seriesLabel}, {o.duration} season{o.duration > 1 ? 's' : ''}. {o.contribution < 0 ? `Loan fee ${money(-o.contribution)} now from the academy budget.` : `${o.team} contributes ${money(o.contribution)} a season.`} Training programmes stop while they're away.</>, onConfirm: () => done(sendOnLoan(appState, who, o.id)) })}>Agree</button>
                </div>
              ))}
            </div>
          ) : <p className="ac-empty">No series suits this driver's level right now.</p>}
        </section>
        <section className="ac-panel">
          <div className="ac-panel-head"><h2>Junior standings</h2>
            <label className="ac-field" style={{ minWidth: 180 }}><span className="sr-only">Series</span><select value={series} onChange={(e) => setSeries(e.target.value)}>{Object.values(SERIES).map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
          <p className="ac-note" style={{ marginBottom: 8 }}>{table.races} of {juniorRoundsPerSeason(appState)} rounds · our drivers highlighted</p>
          <table className="ac-table">
            <thead><tr><th className="num">Pos</th><th>Driver</th><th>Team</th><th className="num">Wins</th><th className="num">Points</th></tr></thead>
            <tbody>{table.rows.slice(0, 12).map((r: any) => <tr key={r.name} className={r.kind === 'academy' || r.kind === 'loan' ? 'is-ours' : ''}><td className="num">{r.pos}</td><td>{r.kind === 'field' ? r.name : <button type="button" className="ac-link" onClick={() => setOpen(r.name)}>{r.name}</button>}</td><td className="ac-muted">{r.team || '–'}</td><td className="num">{r.wins}</td><td className="num">{r.points}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
