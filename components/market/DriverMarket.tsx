import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Star, Telescope, Users, Wallet, Armchair, Handshake, Newspaper, ArrowUpDown, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { btn, btnClass, iconBtn, pageTitle, pageSubtitle } from '../HubLayout.tsx';
import { AnimatedNumber } from '../ui/motion.tsx';
import { usePrefersReducedMotion } from '../driverToolsMotion.ts';
import { DriverRadarCompare } from '../DriverRadarCompare.tsx';
import { ContractBuilder } from '../ContractBuilder.tsx';
import { Monogram } from '../commercial/commercialUi.tsx';
import { getDriverNationality } from '../../utils/driverProfileModel.js';
import { getChiefScoutRecommendations } from '../../utils/chiefScout.js';
import {
  ensureMarket, marketOverview, freeAgents, prospects, contractedDrivers, assessInterest, sellingStance, availabilityLabel,
  scoutView, marketValue, expectedSalary, overall, potentialOf, findDriver, SCOUT_LEVELS,
} from '../../game/transferMarket.js';
import { DriverProfile, Avatar, money } from './DriverProfile.tsx';
import { ensureAcademy, ovr as acOvr, potential as acPot, promotionAdvice, superLicence, SERIES as AC_SERIES, trajectory } from '../../game/academyEngine.js';
import './market.css';

type Tab = 'free' | 'contracted' | 'prospects' | 'academy' | 'shortlist' | 'negotiations';
const TABS: { id: Tab; label: string }[] = [
  { id: 'free', label: 'Available drivers' }, { id: 'contracted', label: 'Drivers under contract' }, { id: 'prospects', label: 'F2 prospects' }, { id: 'academy', label: 'Our academy' },
  { id: 'shortlist', label: 'My shortlist' }, { id: 'negotiations', label: 'Negotiations' },
];
const SORTS: Record<string, { label: string; fn: (a: any, b: any) => number }> = {
  overall: { label: 'Highest overall', fn: (a, b) => b.ovr - a.ovr },
  potential: { label: 'Highest potential', fn: (a, b) => b.pot - a.pot },
  young: { label: 'Youngest', fn: (a, b) => (a.d.age ?? 30) - (b.d.age ?? 30) },
  salary: { label: 'Lowest salary', fn: (a, b) => (a.d.salary || 0) - (b.d.salary || 0) },
  value: { label: 'Highest market value', fn: (a, b) => b.value - a.value },
  quali: { label: 'Best qualifying', fn: (a, b) => (b.d.quali || 0) - (a.d.quali || 0) },
  pace: { label: 'Best race pace', fn: (a, b) => (b.d.pace || 0) - (a.d.pace || 0) },
  interest: { label: 'Most interested', fn: (a, b) => b.interest - a.interest },
};
const rangeText = (v: any) => (Array.isArray(v) ? `${v[0]}–${v[1]}` : String(v));

function Card({ row, onOpen, shortlisted, onStar, reduced }: any) {
  const { d, team, role, sv, av, value } = row;
  const nat = getDriverNationality(d);
  return (
    <motion.article layout={!reduced} className={`mk-card tone-${av.tone}`} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <button type="button" className="mk-card-main" onClick={() => onOpen(d.name)}>
        <span className="mk-card-top">
          <Avatar driver={d} />
          <span className="mk-card-id">
            <strong>{d.name}</strong>
            <em>{nat?.flag ? `${nat.flag} ` : ''}{nat?.code || ''}{nat ? ' · ' : ''}Age {d.age ?? '–'}</em>
          </span>
          <span className="mk-ovr" title={`Overall ${rangeText(sv.overall)}`}>{Array.isArray(sv.overall) ? `${sv.overall[0]}+` : sv.overall}</span>
        </span>
        <span className="mk-card-team">
          {team ? <><Monogram name={team.name} size={20} />{team.name} · {role === 'race' ? 'race seat' : 'reserve'}</> : <span className="mk-free">{d.category === 'F2' ? 'F2 prospect' : 'Free agent'}</span>}
          {team && <span className="mk-years">{d.contractYearsRemaining} yr{d.contractYearsRemaining === 1 ? '' : 's'} left</span>}
        </span>
        <span className="mk-card-figs">
          <span><em>Potential</em><b>{rangeText(sv.potential)}</b></span>
          <span><em>Value</em><b>{money(value)}</b></span>
          <span><em>{team ? 'Salary' : 'Asking'}</em><b>{money(d.salary || 0)}</b></span>
          <span><em>Scouted</em><b className="mk-dots">{SCOUT_LEVELS.slice(1).map((s) => <i key={s.level} className={sv.level >= s.level ? 'on' : ''} />)}</b></span>
        </span>
        <span className={`mk-avail is-${av.tone}`}><span className="mk-avail-dot" />{av.label}</span>
      </button>
      <button type="button" className={`mk-star ${shortlisted ? 'is-on' : ''}`} onClick={() => onStar(d.name)} aria-pressed={shortlisted} aria-label={shortlisted ? `Remove ${d.name} from shortlist` : `Add ${d.name} to shortlist`}>
        <Star size={14} strokeWidth={1.5} fill={shortlisted ? 'currentColor' : 'none'} />
      </button>
    </motion.article>
  );
}

function ChiefScout({ state, onOpen, onClose }: any) {
  const [req, setReq] = useState('');
  const [res, setRes] = useState<any>(null);
  const quick = ['Find a replacement for our current drivers', 'Find the best young talent with high potential', 'Find a driver under $20M', 'Find the best value signing', 'Find a reserve driver'];
  const ask = (q: string) => { setReq(q); setRes(getChiefScoutRecommendations(state, q)); };
  return (
    <div className="mk-chief">
      <div className="mk-chief-head"><strong><Sparkles size={14} strokeWidth={1.5} />Chief scout</strong><button type="button" className={btnClass('ghost')} style={iconBtn('sm')} onClick={onClose} aria-label="Close chief scout"><X size={14} /></button></div>
      <div className="mk-chips">{quick.map((q) => <button key={q} type="button" className="mk-chip" onClick={() => ask(q)}>{q.replace(/^Find (a |the )?/, '')}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); if (req.trim()) ask(req); }} className="mk-chief-form">
        <input value={req} onChange={(e) => setReq(e.target.value)} placeholder="Describe the driver you need" aria-label="Request" />
        <button type="submit" className={btnClass('secondary')} style={btn('secondary', 'sm')}>Ask</button>
      </form>
      {res?.recommendations?.map((r: any) => (
        <button key={r.driver.name} type="button" className="mk-chief-rec" onClick={() => onOpen(r.driver.name)}>
          <strong>{r.driver.name}</strong><em>{r.report}</em>
        </button>
      ))}
    </div>
  );
}

export function DriverMarket({ appState, onPersist }: { appState: any; onPersist: () => Promise<void> }) {
  ensureMarket(appState);
  const reduced = usePrefersReducedMotion();
  const [tab, setTab] = useState<Tab>('contracted');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('overall');
  const [showFilters, setShowFilters] = useState(false);
  const [f, setF] = useState({ maxAge: 45, minOvr: 0, minPot: 0, maxSalary: 60, nat: '', team: '', maxYears: 5, avail: '', minValue: 0, category: '' });
  const [compare, setCompare] = useState<{ left: string; right?: string } | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [showChief, setShowChief] = useState(false);
  const [quickReserve, setQuickReserve] = useState<any>(null);
  const [version, bump] = useState(0);
  const m = appState.transferMarket;
  const ov = marketOverview(appState);

  const changed = async () => { bump((x) => x + 1); await onPersist(); };
  const star = async (name: string) => {
    m.shortlist = m.shortlist.includes(name) ? m.shortlist.filter((n: string) => n !== name) : [...m.shortlist, name];
    await changed();
  };

  const rowsFor = (list: { d: any; team?: any; role?: string }[]) => list.map(({ d, team, role }) => {
    const a = assessInterest(appState, d.name);
    const st = sellingStance(appState, d.name);
    const sv = scoutView(appState, d.name);
    return { d, team, role, a, st, sv, av: availabilityLabel(appState, d.name, a, st), ovr: overall(d), pot: potentialOf(d), value: marketValue(d), interest: a.score };
  });

  const all = useMemo(() => ({
    free: rowsFor(freeAgents(appState).map((d: any) => ({ d }))),
    contracted: rowsFor(contractedDrivers(appState).map((c: any) => ({ d: c.driver, team: c.team, role: c.role }))),
    prospects: rowsFor(prospects(appState).map((d: any) => ({ d }))),
  }), [version, appState.season?.currentDay, appState.season?.round]);
  const shortlistRows = rowsFor(m.shortlist.map((n: string) => findDriver(appState, n)).filter(Boolean).map((l: any) => ({ d: l.driver, team: l.team && !l.isPlayer ? l.team : null, role: l.role })));

  const nats = useMemo(() => [...new Set([...all.free, ...all.contracted, ...all.prospects].map((r) => getDriverNationality(r.d)?.country).filter(Boolean))].sort(), [all]);
  const teams = useMemo(() => [...new Set(all.contracted.map((r) => r.team.name))].sort(), [all]);
  const avails = useMemo(() => [...new Set([...all.free, ...all.contracted, ...all.prospects].map((r) => r.av.label))].sort(), [all]);

  const filtered = (rows: any[]) => rows
    .filter((r) => !q || `${r.d.name} ${r.team?.name || ''} ${r.d.roleLabel || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => (r.d.age ?? 30) <= f.maxAge && r.ovr >= f.minOvr && r.pot >= f.minPot && (r.d.salary || 0) <= f.maxSalary && r.value >= f.minValue)
    .filter((r) => !f.nat || getDriverNationality(r.d)?.country === f.nat)
    .filter((r) => !f.team || r.team?.name === f.team)
    .filter((r) => !r.team || (r.d.contractYearsRemaining ?? 0) <= f.maxYears)
    .filter((r) => !f.avail || r.av.label === f.avail)
    .filter((r) => !f.category || r.d.category === f.category)
    .sort(SORTS[sort].fn);

  const rows = tab === 'free' ? filtered(all.free) : tab === 'contracted' ? filtered(all.contracted) : tab === 'prospects' ? filtered(all.prospects) : [];
  const kpis = [
    { icon: Wallet, label: 'Operations budget', value: ov.budget, fmt: (v: number) => money(v), sub: ov.committed ? `${money(ov.committed)} committed to pre-contracts` : 'Fees and bonuses come from here' },
    { icon: Armchair, label: 'Race seats free', value: ov.seats.race, fmt: (v: number) => String(Math.round(v)), sub: `${ov.futureSeats.race} free next season` },
    { icon: Users, label: 'Reserve seat', value: ov.seats.reserve, fmt: (v: number) => (Math.round(v) ? 'Free' : 'Filled'), sub: `${ov.futureSeats.reserve ? 'Free' : 'Filled'} next season` },
    { icon: Wallet, label: 'Driver payroll', value: ov.payroll, fmt: (v: number) => money(v), sub: 'a season, charged each race' },
    { icon: Telescope, label: 'Scouting department', value: ov.scouts.busy, fmt: (v: number) => `${Math.round(v)}/${ov.scouts.slots}`, sub: `scouts busy · capability ${ov.scouts.capability}` },
    { icon: Handshake, label: 'Active negotiations', value: ov.negotiations, fmt: (v: number) => String(Math.round(v)), sub: `${ov.preContracts} pre-contract${ov.preContracts === 1 ? '' : 's'} agreed` },
  ];
  const myDrivers = [...(appState.team.drivers || []), ...(appState.team.reserveDriver ? [appState.team.reserveDriver] : [])];
  const counts: Record<Tab, number> = { free: all.free.length, contracted: all.contracted.length, prospects: all.prospects.length, academy: (appState.academy?.prospects?.length || 0) + (appState.academy?.loanedOut?.length || 0), shortlist: m.shortlist.length, negotiations: Object.values(m.talks).filter((t: any) => t.stage !== 'none').length + m.preContracts.length };

  return (
    <div className="mk-root">
      <div className="mk-head">
        <div>{pageTitle('Driver market')}{pageSubtitle('Scout, approach and sign drivers. Free agents, rivals’ drivers and F2 prospects in one market.')}</div>
        <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={() => setShowChief((v) => !v)}><Sparkles size={16} strokeWidth={1.5} />Chief scout</button>
      </div>

      <div className="mk-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="mk-kpi"><span><k.icon size={14} strokeWidth={1.5} />{k.label}</span><strong><AnimatedNumber value={k.value} formatter={k.fmt} /></strong><em>{k.sub}</em></div>
        ))}
      </div>

      <nav className="mk-tabs" role="tablist" aria-label="Market sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`mk-tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="mk-tab" className="mk-tab-line" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
            {t.label}<em>{counts[t.id]}</em>
          </button>
        ))}
      </nav>

      <div className="mk-body">
        <div className="mk-main">
          {['free', 'contracted', 'prospects'].includes(tab) && (
            <>
              <div className="mk-toolbar">
                <div className="mk-search"><Search size={16} strokeWidth={1.5} /><input type="search" placeholder="Search drivers or teams" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drivers" /></div>
                <button type="button" className={btnClass(showFilters ? 'secondary' : 'ghost')} style={btn(showFilters ? 'secondary' : 'ghost', 'sm')} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}><SlidersHorizontal size={14} strokeWidth={1.5} />Filters</button>
                <label className="mk-sort"><ArrowUpDown size={14} strokeWidth={1.5} /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">{Object.entries(SORTS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}</select></label>
                <span className="mk-count">{rows.length} drivers</span>
              </div>
              <AnimatePresence initial={false}>
                {showFilters && (
                  <motion.div className="mk-filters" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="mk-filter-grid">
                      {[['maxAge', 'Max age', 16, 45, 1, (v: number) => String(v)], ['minOvr', 'Min overall', 0, 99, 1, String], ['minPot', 'Min potential', 0, 99, 1, String], ['maxSalary', 'Max salary', 0, 60, 0.5, (v: number) => money(v)], ['minValue', 'Min market value', 0, 100, 1, (v: number) => money(v)], ['maxYears', 'Max contract left', 0, 5, 1, (v: number) => `${v} seasons`]].map(([k, l, min, max, step, fmt]: any) => (
                        <label key={k} className="mk-range"><span>{l}<b>{fmt((f as any)[k])}</b></span><input type="range" min={min} max={max} step={step} value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} /></label>
                      ))}
                      <label className="mk-sel"><span>Nationality</span><select value={f.nat} onChange={(e) => setF({ ...f, nat: e.target.value })}><option value="">Any</option>{nats.map((n) => <option key={n}>{n}</option>)}</select></label>
                      <label className="mk-sel"><span>Current team</span><select value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}><option value="">Any</option>{teams.map((n) => <option key={n}>{n}</option>)}</select></label>
                      <label className="mk-sel"><span>Availability</span><select value={f.avail} onChange={(e) => setF({ ...f, avail: e.target.value })}><option value="">Any</option>{avails.map((n) => <option key={n}>{n}</option>)}</select></label>
                      <label className="mk-sel"><span>Category</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Any</option>{['F1', 'F2', 'FREE'].map((n) => <option key={n} value={n}>{n === 'FREE' ? 'Free agent' : n}</option>)}</select></label>
                    </div>
                    <button type="button" className="mk-link" onClick={() => setF({ maxAge: 45, minOvr: 0, minPot: 0, maxSalary: 60, nat: '', team: '', maxYears: 5, avail: '', minValue: 0, category: '' })}>Reset filters</button>
                  </motion.div>
                )}
              </AnimatePresence>
              {tab === 'contracted' && <p className="mk-note">These drivers have contracts. Moving one needs the driver's agreement and their team's: personal terms, then a transfer fee, unless the contract is ending and a pre-contract is possible. Labels come from contract length, team form, satisfaction, career goals and your team's pull.</p>}
              {tab === 'prospects' && <p className="mk-note">Unsigned F2 drivers aren't raced round by round. Sign one to the academy, paid from the academy budget, and they race in the junior championships, earning results and Super Licence points.</p>}
              <motion.div className="mk-grid" key={tab} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                <AnimatePresence initial={false}>
                  {rows.map((r) => <Card key={r.d.name} row={r} onOpen={setOpen} shortlisted={m.shortlist.includes(r.d.name)} onStar={star} reduced={reduced} />)}
                </AnimatePresence>
                {!rows.length && <p className="mk-empty">No drivers match.</p>}
              </motion.div>
              {tab === 'free' && !appState.team.reserveDriver && (
                <p className="mk-note">Quick reserve deal at the listed salary (the original market rule) is still available from the contract builder: <button type="button" className="mk-link" onClick={() => setQuickReserve(rows[0]?.d || null)} disabled={!rows.length}>open for {rows[0]?.d.name || '–'}</button>.</p>
              )}
            </>
          )}

          {tab === 'academy' && <AcademyPipeline appState={appState} onOpen={setOpen} />}
          {tab === 'shortlist' && (
            <div className="mk-short">
              {shortlistRows.length ? (
                <>
                  <table className="mk-table">
                    <thead><tr><th>Compare</th><th>Driver</th><th>Team</th><th className="num">Overall</th><th className="num">Potential</th><th>Contract</th><th>Interest</th><th className="num">Est. cost</th><th>Scouting</th></tr></thead>
                    <tbody>
                      {shortlistRows.map((r) => (
                        <tr key={r.d.name}>
                          <td><input type="checkbox" checked={pick.includes(r.d.name)} onChange={() => setPick((p) => p.includes(r.d.name) ? p.filter((x) => x !== r.d.name) : [...p.slice(-1), r.d.name])} aria-label={`Compare ${r.d.name}`} /></td>
                          <td><button type="button" className="mk-link" onClick={() => setOpen(r.d.name)}>{r.d.name}</button></td>
                          <td>{r.team?.name || (r.d.category === 'F2' ? 'F2' : 'Free agent')}</td>
                          <td className="num">{rangeText(r.sv.overall)}</td>
                          <td className="num">{rangeText(r.sv.potential)}</td>
                          <td>{r.team ? `${r.d.contractYearsRemaining} season${r.d.contractYearsRemaining === 1 ? '' : 's'}` : 'None'}</td>
                          <td><span className={`mk-avail is-${r.av.tone}`}><span className="mk-avail-dot" />{r.sv.level >= 3 ? `${r.a.score} · ` : ''}{r.av.label}</span></td>
                          <td className="num">{money((r.team ? r.st.fee : 0) + (r.sv.level >= 2 ? expectedSalary(r.d) : r.d.salary || 0))}</td>
                          <td>{SCOUT_LEVELS[r.sv.level].label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mk-short-actions">
                    <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} disabled={pick.length !== 2} onClick={() => setCompare({ left: pick[0], right: pick[1] })}>Compare selected</button>
                    <span className="mk-muted">Est. cost = transfer fee asked + one season of salary. Tick two drivers to compare.</span>
                  </div>
                  <p className="mk-sub">Reminders</p>
                  <ul className="mk-news">
                    {m.news.filter((n: any) => m.shortlist.includes(n.driver)).slice(0, 8).map((n: any) => <li key={n.id}><button type="button" onClick={() => setOpen(n.driver)}><em>S{n.year} · day {n.day}</em>{n.text}</button></li>)}
                    {!m.news.some((n: any) => m.shortlist.includes(n.driver)) && <li className="mk-empty">Reminders appear here when a shortlisted driver's interest changes, a contract enters its final months or talks move.</li>}
                  </ul>
                </>
              ) : <p className="mk-empty">Star drivers anywhere in the market to follow them here.</p>}
            </div>
          )}

          {tab === 'negotiations' && (
            <div className="mk-negs">
              <p className="mk-sub">Your pre-contracts</p>
              {m.preContracts.filter((p: any) => p.toTeam === appState.team.name).length ? (
                <ul className="mk-pcs">{m.preContracts.filter((p: any) => p.toTeam === appState.team.name).map((p: any) => (
                  <li key={p.driver}><button type="button" onClick={() => setOpen(p.driver)}><strong>{p.driver}</strong><em>from {p.fromTeam} · {p.role === 'race' ? 'race seat' : 'reserve'} · {money(p.salary)} × {p.years} · {money(p.bonus)} bonus · joins season {p.effectiveYear}</em></button></li>
                ))}</ul>
              ) : <p className="mk-empty">None agreed.</p>}
              <p className="mk-sub">Open talks</p>
              {Object.entries(m.talks).filter(([, t]: any) => t.stage !== 'none').length ? (
                <ul className="mk-pcs">{Object.entries(m.talks).filter(([, t]: any) => t.stage !== 'none').map(([name, t]: any) => (
                  <li key={name}><button type="button" onClick={() => setOpen(name)}><strong>{name}</strong><em>{({ enquired: 'Enquiry made', terms_agreed: 'Personal terms agreed', fee_agreed: 'Fee agreed', ready: 'Ready to sign', pre_contract: 'Pre-contract agreed', signed: 'Signed' } as any)[t.stage] || t.stage}{t.history?.[0] ? ` · ${t.history[0].text}` : ''}</em></button></li>
                ))}</ul>
              ) : <p className="mk-empty">No talks yet. Open a driver and make an enquiry.</p>}
              <p className="mk-sub">Agreed moves around the grid</p>
              {m.preContracts.filter((p: any) => p.toTeam !== appState.team.name).length ? (
                <ul className="mk-pcs">{m.preContracts.filter((p: any) => p.toTeam !== appState.team.name).map((p: any) => <li key={p.driver}><button type="button" onClick={() => setOpen(p.driver)}><strong>{p.driver}</strong><em>{p.fromTeam} → {p.toTeam}, season {p.effectiveYear}</em></button></li>)}</ul>
              ) : <p className="mk-empty">No rival pre-contracts yet. AI teams make them in the second half of the season.</p>}
            </div>
          )}
        </div>

        <aside className="mk-side">
          {showChief && <ChiefScout state={appState} onOpen={setOpen} onClose={() => setShowChief(false)} />}
          <section className="mk-feed" aria-labelledby="mk-feed-title">
            <h2 id="mk-feed-title"><Newspaper size={14} strokeWidth={1.5} />Market activity</h2>
            {m.news.length ? (
              <ul className="mk-news">
                <AnimatePresence initial={false}>
                  {m.news.slice(0, 20).map((n: any) => (
                    <motion.li key={n.id} initial={reduced ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`t-${n.type}`}>
                      <button type="button" onClick={() => n.driver && findDriver(appState, n.driver) && setOpen(n.driver)}><em>S{n.year} · day {n.day}</em>{n.text}</button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ) : <p className="mk-empty">Quiet so far. Signings, renewals, retirements, pre-contracts and scouting reports appear here as days pass.</p>}
          </section>
          <section className="mk-feed">
            <h2><Users size={14} strokeWidth={1.5} />Your lineup</h2>
            <ul className="mk-lineup">{myDrivers.map((d: any) => <li key={d.name}><button type="button" onClick={() => setOpen(d.name)}><Avatar driver={d} size={28} /><span><strong>{d.name}</strong><em>{appState.team.reserveDriver?.name === d.name ? 'Reserve' : 'Race seat'} · {d.contractYearsRemaining ?? '–'} season{d.contractYearsRemaining === 1 ? '' : 's'} left · {money(d.salary || 0)}</em></span></button></li>)}</ul>
          </section>
        </aside>
      </div>

      <DriverProfile state={appState} name={open} onClose={() => setOpen(null)} onChanged={() => changed()}
        onCompare={(n: string) => setCompare({ left: n, right: myDrivers[0]?.name })} shortlisted={!!open && m.shortlist.includes(open)} onToggleShortlist={() => open && star(open)} />
      {compare && <DriverRadarCompare leftName={compare.left} rightName={compare.right} onClose={() => setCompare(null)} />}
      {quickReserve && (
        <ContractBuilder driver={quickReserve} mode="market" onClose={() => setQuickReserve(null)}
          onSend={async (terms) => {
            if (appState.team.reserveDriver) return { accepted: false, headline: 'Reserve seat already filled.' };
            quickReserve.salary = terms.salary; quickReserve.contractYearsRemaining = terms.seasons;
            appState.team.signDriver(quickReserve, 'reserve');
            delete appState.transferMarket.pool[quickReserve.name];
            await changed();
            return { accepted: true, headline: `${quickReserve.name} signed as reserve.` };
          }} />
      )}
    </div>
  );
}

/** Our academy and loan drivers, as the market sees them: readiness for a step up into the team. */
function AcademyPipeline({ appState, onOpen }: { appState: any; onOpen: (n: string) => void }) {
  const ac = ensureAcademy(appState);
  const rows = [...ac.prospects.map((d: any) => ({ d, loan: false })), ...ac.loanedOut.map((d: any) => ({ d, loan: true }))]
    .sort((a, b) => acOvr(b.d) - acOvr(a.d));
  if (!rows.length) return <p className="mk-empty">No academy drivers yet. Sign prospects in the Academy.</p>;
  return (
    <div className="mk-short">
      <p className="mk-note">Your own juniors, ranked by overall. Promotions, loans and series moves are made in the Academy; a graduate in the reserve seat appears in your line-up here and on the Drivers screen.</p>
      <table className="mk-table">
        <thead><tr><th>Driver</th><th className="num">Age</th><th>Series</th><th className="num">Overall</th><th className="num">Potential</th><th>Trajectory</th><th>Super Licence</th><th>Next step</th></tr></thead>
        <tbody>
          {rows.map(({ d, loan }) => {
            const adv = promotionAdvice(appState, d); const sl = superLicence(d, appState);
            return (
              <tr key={d.name}>
                <td>{loan ? d.name : <button type="button" className="mk-link" onClick={() => onOpen(d.name)}>{d.name}</button>}{loan ? <em className="mk-muted"> · on loan, {d.loanStatus?.team}</em> : null}</td>
                <td className="num">{d.age}</td>
                <td>{AC_SERIES[d.series]?.label || '–'}</td>
                <td className="num">{acOvr(d)}</td>
                <td className="num">{acPot(d)}</td>
                <td>{trajectory(d).label}</td>
                <td>{sl.points}/{sl.required}{sl.eligible ? ' · eligible' : ''}</td>
                <td>{adv.ready ? `Ready for ${adv.target === 'reserve' ? 'the reserve seat' : AC_SERIES[adv.target]?.label}` : 'Not yet'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
