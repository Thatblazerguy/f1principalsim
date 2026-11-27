import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, GitCompare, FileSearch, GraduationCap, Plane, ArrowUpCircle, Dumbbell, RefreshCw, LogOut, Flag } from 'lucide-react';
import { useDialogFocus } from '../useDialogFocus.ts';
import {
  knownDriver, estimate, ovr, potential, scoutStatus, interestIn, difficultyOf, juniorValue, juniorSalary, signingFee, SERIES,
  PROFILE_ATTRS, ATTRIBUTE_LABELS, PROGRAMMES, WORKLOADS, programmeEffectiveness, knowledgeOf, superLicence, promotionAdvice,
  championshipPosition, nextSeries, LADDER, loanProgress, trajectory,
} from '../../game/academyEngine.js';
import { Avatar, Badge, EstBar, Spark, Traj, Morale, money, nationalityText, EASE } from './parts.tsx';

/*
 * Driver profile drawer. What it shows depends on what the academy knows:
 * our own drivers are known exactly; everyone else is seen through the
 * scouting department's estimates (ranges narrow as knowledge grows).
 */

const HIDDEN_WORDS = (v: number) => (v >= 80 ? 'Outstanding' : v >= 65 ? 'Strong' : v >= 50 ? 'Average' : 'A concern');

export function ProfileDrawer({ state, name, onClose, act, onCompare, onScout, shortlisted, onShortlist, ask }: any) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(!!name, ref, onClose);
  const d = name ? knownDriver(state, name) : null;
  return createPortal(
    <AnimatePresence>
      {d && (
        <div className="ac-layer">
          <motion.div className="ac-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside ref={ref} className="ac-drawer" role="dialog" aria-modal="true" aria-label={`Profile: ${d.name}`}
            initial={{ x: 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 48, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <Body {...{ state, d, onClose, act, onCompare, onScout, shortlisted, onShortlist, ask }} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Body({ state, d, onClose, act, onCompare, onScout, shortlisted, onShortlist, ask }: any) {
  const ac = state.academy;
  const ours = ac.prospects.some((x: any) => x.name === d.name);
  const loaned = ac.loanedOut.some((x: any) => x.name === d.name);
  const mine = ours || loaned;
  const st = mine ? { id: 'ours', label: loaned ? `On loan · ${d.loanStatus?.team}` : 'Academy driver' } : scoutStatus(state, d);
  const kn = mine ? { k: 100, acc: 100 } : knowledgeOf(state, d.name);
  const o = estimate(state, d, 'overall', ovr(d)); const p = estimate(state, d, 'potential', potential(d));
  const series = SERIES[d.series];
  const interest = interestIn(state, d);
  const attrs = PROFILE_ATTRS.map((k) => ({ k, est: estimate(state, d, k, d[k] ?? 60) }));
  const knownAttrs = attrs.filter((a) => a.est.known);
  const sorted = [...knownAttrs].sort((a, b) => (b.est.mid ?? 0) - (a.est.mid ?? 0));
  const strongest = sorted.slice(0, 2); const weakest = sorted.slice(-2).reverse();
  const opportunities = weakest.map((w) => Object.entries(PROGRAMMES).find(([, pr]: any) => w.k in pr.targets)).filter(Boolean) as any[];
  const sl = superLicence(d, state);
  const pos = d.juniorStats?.year === (state.season?.year || 1) ? championshipPosition(state, d) : null;
  const value = juniorValue(d); const fee = signingFee(d); const salary = juniorSalary(d);
  const seat = series?.seatCost || 0;

  return (
    <>
      <header className="ac-drawer-head">
        <Avatar d={d} size={64} />
        <div>
          <h2>{d.name}</h2>
          <p>{d.age} · {nationalityText(d)} · {series?.label || 'Junior racing'}{d.loanStatus?.team ? ` · ${d.loanStatus.team}` : d.aiTeam ? ` · ${d.aiTeam} junior programme` : d.juniorTeam ? ` · ${d.juniorTeam}` : ''}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge id={st.id} label={st.label} />
            {!mine && <span className="ac-badge" title="How well the scouting department knows this driver">Scouting knowledge {Math.round(kn.k)}%</span>}
          </div>
        </div>
        <button type="button" className="ac-icon" onClick={onClose} aria-label="Close profile"><X size={16} strokeWidth={1.5} /></button>
      </header>

      <div className="ac-drawer-body">
        <section className="ac-sec">
          <h3>Driver<em>{d.discoveredBy ? `Discovered by ${d.discoveredBy}` : d.poolDriver ? 'Known F2 driver' : ''}</em></h3>
          <dl className="ac-facts">
            <div><dt>Age</dt><dd className="ac-num">{d.age}</dd></div>
            <div><dt>Nationality</dt><dd>{nationalityText(d)}</dd></div>
            <div><dt>Current series</dt><dd>{series?.label || '–'}</dd></div>
            <div><dt>Team</dt><dd>{d.loanStatus?.team || d.juniorTeam || '–'}</dd></div>
            <div><dt>Personality</dt><dd>{kn.k >= 15 ? d.personality || '–' : 'Unknown'}</dd></div>
            <div><dt>Driving style</dt><dd>{kn.k >= 15 ? d.preferredStyle || '–' : 'Unknown'}</dd></div>
          </dl>
        </section>

        <section className="ac-sec">
          <h3>Current season<em>{series?.label}</em></h3>
          {d.juniorStats?.year === (state.season?.year || 1) && d.juniorStats.series === d.series ? (
            <dl className="ac-facts">
              <div><dt>Starts</dt><dd className="ac-num">{d.juniorStats.starts}</dd></div>
              <div><dt>Wins · podiums</dt><dd className="ac-num">{d.juniorStats.wins} · {d.juniorStats.podiums}</dd></div>
              <div><dt>Points · position</dt><dd className="ac-num">{d.juniorStats.points} · {pos ? `P${pos}` : '–'}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>Recent results</dt><dd className="ac-num">{d.juniorStats.results.slice(-10).map((r: any) => (r === 'DNF' ? 'DNF' : `P${r}`)).join('  ') || '–'}</dd></div>
            </dl>
          ) : <p className="ac-note">No junior races yet this season. Junior rounds run on alternate F1 race weekends.</p>}
          {(d.juniorHistory || []).length > 0 && (
            <ul className="ac-list" style={{ marginTop: 12 }}>
              {d.juniorHistory.slice(0, 5).map((h: any) => <li key={`${h.year}${h.series}`}><span>Season {h.year} · {SERIES[h.series]?.label}{h.team ? ` · ${h.team}` : ''}</span><b>P{h.pos} · {h.points} pts · {h.wins} wins</b></li>)}
            </ul>
          )}
        </section>

        <section className="ac-sec">
          <h3>Performance attributes<em>{mine ? 'Exact' : kn.k >= 100 ? 'Full report' : 'Scouting estimates'}</em></h3>
          {knownAttrs.length ? (
            <div className="ac-arows">
              {attrs.map(({ k, est }) => (
                <div key={k} className="ac-arow"><span>{ATTRIBUTE_LABELS[k]}</span><EstBar est={est} tone={k === strongest[0]?.k ? 'is-pos' : ''} /><b>{est.text}</b></div>
              ))}
            </div>
          ) : <p className="ac-note">Unscouted. Assign a scout to monitor or evaluate this driver to learn their abilities.</p>}
          {kn.k >= 60 && !mine && d.hiddenTraits && (
            <p className="ac-note" style={{ marginTop: 10 }}>Scout's read on character: work ethic {HIDDEN_WORDS(d.hiddenTraits.workEthic).toLowerCase()}, professionalism {HIDDEN_WORDS(d.hiddenTraits.professionalism).toLowerCase()}, pressure {HIDDEN_WORDS(d.hiddenTraits.pressureResistance).toLowerCase()}.</p>
          )}
          {mine && d.hiddenTraits && <p className="ac-note" style={{ marginTop: 10 }}>Work ethic {HIDDEN_WORDS(d.hiddenTraits.workEthic).toLowerCase()} · professionalism {HIDDEN_WORDS(d.hiddenTraits.professionalism).toLowerCase()} · under pressure {HIDDEN_WORDS(d.hiddenTraits.pressureResistance).toLowerCase()}.</p>}
        </section>

        <section className="ac-sec">
          <h3>Development potential<em><Traj d={d} /></em></h3>
          <div className="ac-two-mini">
            <div className="ac-ovpot"><span>Overall<b>{o.text}</b></span><EstBar est={o} /></div>
            <div className="ac-ovpot"><span>Potential<b>{p.text}</b></span><EstBar est={p} tone="is-red" /></div>
          </div>
          {(mine || kn.k >= 40) && <div style={{ marginTop: 12 }}><Spark history={d.ratingHistory} /></div>}
          {knownAttrs.length > 0 && (
            <div className="ac-two-mini" style={{ marginTop: 12 }}>
              <div><p className="ac-muted">Strongest</p><ul className="ac-list">{strongest.map((a) => <li key={a.k}><span>{ATTRIBUTE_LABELS[a.k]}</span><b>{a.est.text}</b></li>)}</ul></div>
              <div><p className="ac-muted">Weakest</p><ul className="ac-list">{weakest.map((a) => <li key={a.k}><span>{ATTRIBUTE_LABELS[a.k]}</span><b>{a.est.text}</b></li>)}</ul></div>
            </div>
          )}
          {opportunities.length > 0 && <p className="ac-note" style={{ marginTop: 10 }}>Development opportunities: {opportunities.map(([, pr]: any) => pr.label.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(' and ')} would target the weakest areas.</p>}
        </section>

        {mine ? <OurActions {...{ state, d, ours, loaned, act, ask, sl, pos }} /> : (
          <section className="ac-sec">
            <h3>Recruitment<em>{d.aiTeam ? 'Under contract' : kn.k >= 30 ? `${difficultyOf(interest)} to sign` : 'Interest unknown'}</em></h3>
            <dl className="ac-facts">
              <div><dt>Contract</dt><dd>{d.aiTeam ? `${d.aiTeam} junior programme` : d.poolDriver ? 'Free: F2 driver without a team' : 'No academy contract'}</dd></div>
              <div><dt>Market value</dt><dd className="ac-num">{money(value)}</dd></div>
              <div><dt>Signing bonus</dt><dd className="ac-num">{money(fee)}</dd></div>
              <div><dt>Salary expectation</dt><dd className="ac-num">{money(salary)}<small className="ac-muted"> a season</small></dd></div>
              <div><dt>Junior seat</dt><dd className="ac-num">{money(seat)}<small className="ac-muted"> a season</small></dd></div>
              <div><dt>First-season cost</dt><dd className="ac-num">{money(fee + salary + seat)}</dd></div>
              <div><dt>Interest in us</dt><dd>{kn.k >= 30 ? `${interest}/100` : 'Scout to learn'}</dd></div>
              <div><dt>Difficulty</dt><dd>{kn.k >= 30 ? difficultyOf(interest) : '–'}</dd></div>
              <div><dt>Super Licence</dt><dd className="ac-num">{sl.points}/{sl.required}</dd></div>
            </dl>
            <p className="ac-note" style={{ marginTop: 10 }}>Interest depends on the academy's reputation and level, the driver's series and their own ambitions. Below 30, they won't sign.</p>
          </section>
        )}

        <CareerTimeline d={d} />
      </div>

      <footer className="ac-drawer-foot">
        {!mine && (
          <>
            <button type="button" className="ac-btn is-primary" disabled={!!d.aiTeam}
              onClick={() => ask({ title: `Sign ${d.name}?`, confirmLabel: `Sign for ${money(fee)}`, body: <>Signing bonus {money(fee)} now from the academy budget ({money(ac.budget)}), then {money(salary)} salary and {money(seat)} for the {series?.label} seat each season. Three-season academy contract. If they turn you down, nothing is charged.</>, onConfirm: () => act(`sign:${d.name}`) })}>
              <GraduationCap size={14} strokeWidth={1.5} />Sign prospect
            </button>
            <button type="button" className="ac-btn" onClick={() => onScout(d.name)}><FileSearch size={14} strokeWidth={1.5} />Request scouting report</button>
          </>
        )}
        <button type="button" className={`ac-btn ${shortlisted ? '' : 'is-ghost'}`} onClick={() => onShortlist(d.name)} aria-pressed={shortlisted}><Star size={14} strokeWidth={1.5} fill={shortlisted ? 'currentColor' : 'none'} />{shortlisted ? 'Shortlisted' : 'Add to shortlist'}</button>
        <button type="button" className="ac-btn is-ghost" onClick={() => onCompare(d.name)}><GitCompare size={14} strokeWidth={1.5} />Compare</button>
      </footer>
    </>
  );
}

function OurActions({ state, d, ours, loaned, act, ask, sl, pos }: any) {
  const ac = state.academy;
  const [prog, setProg] = useState('qualifying');
  const [load, setLoad] = useState('normal');
  const [replace, setReplace] = useState(state.team.drivers?.[0]?.name || '');
  const adv = promotionAdvice(state, d);
  const eff = ours ? programmeEffectiveness(state, d, prog, load) : 0;
  const cost = PROGRAMMES[prog].cost * WORKLOADS[load].costMult;
  const nx = nextSeries(d);
  const lp = loaned ? loanProgress(state, d) : null;
  return (
    <>
      <section className="ac-sec">
        <h3>Academy contract<em>{d.contractYearsRemaining} season{d.contractYearsRemaining === 1 ? '' : 's'} left</em></h3>
        <dl className="ac-facts">
          <div><dt>Salary</dt><dd className="ac-num">{money(juniorSalary(d))}<small className="ac-muted"> a season</small></dd></div>
          <div><dt>Morale</dt><dd><Morale v={d.morale} /></dd></div>
          <div><dt>Junior races</dt><dd className="ac-num">{d.raceExp || 0}</dd></div>
          <div><dt>Market value</dt><dd className="ac-num">{money(juniorValue(d))}</dd></div>
          <div><dt>Super Licence</dt><dd className="ac-num">{sl.points}/{sl.required}{sl.eligible ? ' · eligible' : ''}</dd></div>
          <div><dt>Since</dt><dd>{d.academySince ? `Season ${d.academySince.year}` : '–'}</dd></div>
        </dl>
        {d.contractYearsRemaining <= 1 && (
          <div className="ac-acts" style={{ marginTop: 10 }}>
            <button type="button" className="ac-btn is-sm" onClick={() => ask({ title: `Renew ${d.name}?`, confirmLabel: 'Renew for two seasons', body: <>Two more seasons for a {money(signingFee(d) * 0.6)} bonus from the academy budget.</>, onConfirm: () => act(`renew:${d.name}`) })}><RefreshCw size={13} strokeWidth={1.5} />Renew contract</button>
          </div>
        )}
      </section>

      {loaned && lp && (
        <section className="ac-sec">
          <h3>On loan<em>{d.loanStatus.team} · {d.loanStatus.series}</em></h3>
          <ul className="ac-checks">{lp.objectives.map((o: any) => <li key={o.label} className={o.met ? 'is-met' : ''}><i>{o.met ? '✓' : ''}</i>{o.label}<em>{o.now}</em></li>)}</ul>
          <p className="ac-note" style={{ marginTop: 8 }}>Overall {lp.devGain >= 0 ? '+' : ''}{lp.devGain} since the loan began. Manage the loan from the Loans tab.</p>
        </section>
      )}

      {ours && (
        <section className="ac-sec">
          <h3>Development programme<em>{d.programme ? `${Math.round((d.programme.progress / d.programme.days) * 100)}% done` : 'None running'}</em></h3>
          {d.programme ? (
            <div className="ac-prog">
              <div className="ac-prog-head"><strong>{PROGRAMMES[d.programme.id].label}</strong><em>{WORKLOADS[d.programme.workload].label} workload · {Math.max(0, Math.ceil(d.programme.days - d.programme.progress))} days left</em></div>
              <div className="ac-bar"><motion.span className="is-red" animate={{ width: `${(d.programme.progress / d.programme.days) * 100}%` }} transition={{ duration: 0.5 }} /></div>
              <button type="button" className="ac-link" onClick={() => act(`stopprog:${d.name}`)}>Stop programme</button>
            </div>
          ) : (
            <div className="ac-actbox">
              <div className="ac-actbox-row">
                <label className="ac-field">Programme<select value={prog} onChange={(e) => setProg(e.target.value)}>{Object.entries(PROGRAMMES).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}</select></label>
                <label className="ac-field">Workload<select value={load} onChange={(e) => setLoad(e.target.value)}>{Object.entries(WORKLOADS).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}</select></label>
              </div>
              <p className="ac-note">{PROGRAMMES[prog].days} days · {money(cost)} · effectiveness {Math.round(eff * 100)}%. {PROGRAMMES[prog].tradeoff}.</p>
              <button type="button" className="ac-btn is-sm" onClick={() => ask({ title: `Start ${PROGRAMMES[prog].label.toLowerCase()}?`, confirmLabel: `Start for ${money(cost)}`, body: <>{d.name}, {PROGRAMMES[prog].days} days on a {WORKLOADS[load].label.toLowerCase()} workload, {money(cost)} from the academy budget.</>, onConfirm: () => act(`prog:${d.name}:${prog}:${load}`) })}><Dumbbell size={13} strokeWidth={1.5} />Assign programme</button>
            </div>
          )}
        </section>
      )}

      {ours && (
        <section className="ac-sec">
          <h3>Career pathway<em>{adv.ready ? 'Recommended' : 'Not yet recommended'}</em></h3>
          <ul className="ac-checks">{adv.reasons.map((r: string) => <li key={r}><i />{r}</li>)}</ul>
          <div className="ac-actbox" style={{ marginTop: 10 }}>
            <div className="ac-acts">
              {LADDER.filter((s) => s !== d.series).map((s) => (
                <button key={s} type="button" className={`ac-btn is-sm ${s === nx ? '' : 'is-ghost'}`} onClick={() => ask({ title: `Move ${d.name} to ${SERIES[s].label}?`, confirmLabel: 'Confirm move', body: <>Seat cost {money(SERIES[s].seatCost)} a season (now {money(SERIES[d.series]?.seatCost || 0)}). Points this season don't carry over. {SERIES[s].tier > (SERIES[d.series]?.tier ?? 0) && ovr(d) < SERIES[s].field - 4 ? 'They look under-prepared for this level: expect tough results and a morale hit.' : ''}</>, onConfirm: () => act(`series:${d.name}:${s}`) })}>
                  <Flag size={13} strokeWidth={1.5} />{SERIES[s].label}
                </button>
              ))}
            </div>
            <div className="ac-acts">
              <button type="button" className="ac-btn is-sm" onClick={() => act(`tab:loans:${d.name}`)}><Plane size={13} strokeWidth={1.5} />Loan options</button>
              <button type="button" className="ac-btn is-sm" disabled={!!state.team.reserveDriver} title={state.team.reserveDriver ? `${state.team.reserveDriver.name} holds the reserve seat` : undefined}
                onClick={() => ask({ title: `Promote ${d.name} to reserve driver?`, confirmLabel: 'Promote', body: <>They leave the academy for the team's reserve seat, on the team's reserve contract terms (paid from the team budget).</>, onConfirm: () => act(`reserve:${d.name}`) })}>
                <ArrowUpCircle size={13} strokeWidth={1.5} />Promote to reserve
              </button>
            </div>
            <div className="ac-actbox-row">
              <label className="ac-field">Race seat: replace<select value={replace} onChange={(e) => setReplace(e.target.value)}>{(state.team.drivers || []).map((x: any) => <option key={x.name}>{x.name}</option>)}</select></label>
              <button type="button" className="ac-btn is-sm" disabled={!sl.eligible || !!state.team.reserveDriver} onClick={() => ask({ title: `Promote ${d.name} to a race seat now?`, confirmLabel: 'Promote now', body: <>{replace} is released to make room.</>, danger: true, onConfirm: () => act(`seat:${d.name}:${replace}`) })}>Promote now</button>
              <button type="button" className="ac-btn is-sm is-ghost" onClick={() => act(`plan:${d.name}:${replace}`)}>Agree for next season</button>
            </div>
            <p className="ac-note">A race seat needs a Super Licence: {sl.required} points over the last three seasons from junior championship finishes, and age 18. {sl.eligible ? `${d.name} qualifies.` : `${d.name} has ${sl.points}.`}</p>
          </div>
        </section>
      )}

      {ours && (
        <div className="ac-acts">
          <button type="button" className="ac-btn is-sm is-ghost" onClick={() => ask({ title: `Release ${d.name}?`, confirmLabel: 'Release', danger: true, body: <>They leave the academy and return to the junior market. Academy reputation drops slightly.</>, onConfirm: () => act(`release:${d.name}`) })}><LogOut size={13} strokeWidth={1.5} />Release from academy</button>
        </div>
      )}
    </>
  );
}

function CareerTimeline({ d }: { d: any }) {
  const t = (d.careerTimeline || []).slice(0, 10);
  if (!t.length) return null;
  return (
    <section className="ac-sec">
      <h3>Career history</h3>
      <ol className="ac-timeline">{t.map((e: any, i: number) => <li key={i}><span>Season {e.seasonYear}</span><div><strong>{e.event}</strong><em>{e.detail}</em></div></li>)}</ol>
    </section>
  );
}
