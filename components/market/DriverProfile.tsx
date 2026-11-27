import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Star, Telescope, MessageCircle, Heart, FileSignature, Banknote, CheckCircle2, CalendarClock, GitCompare, GraduationCap, Eye } from 'lucide-react';
import { btn, btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { getDriverNationality } from '../../utils/driverProfileModel.js';
import { signProspect, signingFee, juniorSalary } from '../../game/academyEngine.js';
import {
  findDriver, assessInterest, sellingStance, availabilityLabel, scoutView, scoutLevel, marketValue, expectedSalary,
  bonusExpectation, preferredYears, personalDemands, enquire, expressInterest, offerPersonalTerms, bidTransferFee,
  completeSigning, dealBlockers, agreePreContract, preContractEligibility, assignScout, recallScout, signFreeDriver,
  openSeats, futureSeats, SCOUT_LEVELS, overall,
} from '../../game/transferMarket.js';

const EASE = [0.22, 1, 0.36, 1] as const;
export const money = (v: number) => `$${(v ?? 0).toFixed(1)}M`;
const fmtRange = (v: any) => (Array.isArray(v) ? `${v[0]}–${v[1]}` : v ?? '–');
const ATTR_LABELS: [string, string][] = [['pace', 'Pace'], ['quali', 'Qualifying'], ['racecraft', 'Racecraft'], ['consistency', 'Consistency'], ['tyre', 'Tyre management'], ['wet', 'Wet weather'], ['adaptability', 'Adaptability']];

export function Avatar({ driver, size = 44 }: { driver: any; size?: number }) {
  const url = getDriverHeadshotUrl(driver);
  const [ok, setOk] = useState(true);
  const initials = String(driver.name).split(' ').map((p: string) => p[0]).slice(0, 2).join('');
  return url && !url.startsWith('data:') && ok
    ? <img className="mk-avatar" src={url} alt="" width={size} height={size} onError={() => setOk(false)} style={{ width: size, height: size }} />
    : <span className="mk-avatar mk-avatar-i" style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">{initials}</span>;
}

/** Career numbers the game records: race history this save, wins/podiums/best finishes. */
function career(state: any, name: string) {
  const starts = (state.raceHistory || []).filter((r: any) => r.driverResults?.some((d: any) => d.name === name));
  const recent = starts.slice(-5).map((r: any) => { const d = r.driverResults.find((x: any) => x.name === name); return { round: r.round, season: r.season, pos: d.retired ? null : d.finishPos, team: d.team }; });
  const teams = [...new Set(starts.map((r: any) => r.driverResults.find((x: any) => x.name === name).team))];
  return { starts: starts.length, wins: state.driverWins?.[name] || 0, podiums: state.driverPodiums?.[name] || 0, best: state.bestFinishes?.[name] ?? null, recent, teams };
}

function TermsForm({ initial, roles, onSubmit, submitLabel, disabled, hint }: any) {
  const [t, setT] = useState(initial);
  const set = (k: string, v: any) => setT((x: any) => ({ ...x, [k]: v }));
  return (
    <form className="mk-terms" onSubmit={(e) => { e.preventDefault(); onSubmit(t); }}>
      <label><span>Salary / season</span><input type="number" step="0.5" min="0.5" value={t.salary} onChange={(e) => set('salary', Number(e.target.value))} /></label>
      <label><span>Signing bonus</span><input type="number" step="0.5" min="0" value={t.bonus} onChange={(e) => set('bonus', Number(e.target.value))} /></label>
      <label><span>Seasons</span><input type="number" step="1" min="1" max="5" value={t.years} onChange={(e) => set('years', Number(e.target.value))} /></label>
      <label><span>Role</span>
        <select value={t.role} onChange={(e) => set('role', e.target.value)}>{roles.map((r: string) => <option key={r} value={r}>{r === 'race' ? 'Race seat' : 'Reserve'}</option>)}</select>
      </label>
      {hint && <p className="mk-hint">{hint}</p>}
      <button type="submit" className={btnClass('primary')} style={btn('primary', 'sm')} disabled={disabled}>{submitLabel}</button>
    </form>
  );
}

export function DriverProfile({ state, name, onClose, onChanged, onCompare, shortlisted, onToggleShortlist }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<{ text: string; tone: string } | null>(null);
  const [, bump] = useState(0);
  useDialogFocus(!!name, ref, onClose);
  const l = name ? findDriver(state, name) : null;

  const act = (fn: () => any, tone = 'neutral') => {
    const r = fn();
    const text = [r?.text, r?.teamText].filter(Boolean).join(' ');
    const outcome = r?.outcome || r?.code || (r?.ok === false ? 'blocked' : r?.ok ? 'accepted' : '');
    setMsg({ text, tone: /accepted|signed|willing/.test(outcome) || r?.ok ? 'pos' : /counter|wait|salary|fee/.test(outcome) ? 'mid' : /rejected|suspended|blocked|not_interested|needs_seat/.test(outcome) ? 'neg' : tone });
    bump((x) => x + 1);
    onChanged?.(r?.ok || outcome === 'accepted' || outcome === 'signed');
  };

  const body = () => {
    if (!l) return null;
    const d = l.driver;
    const contracted = !!l.team && !l.isPlayer;
    const isFree = !l.team;
    const isF2 = isFree && d.category === 'F2';
    const own = l.isPlayer;
    const a = assessInterest(state, name);
    const st = sellingStance(state, name);
    const av = availabilityLabel(state, name, a, st);
    const sv = scoutView(state, name);
    const nat = getDriverNationality(d);
    const c = career(state, name);
    const talk = state.transferMarket.talks[name];
    const knowsDemands = (talk && talk.stage !== 'none') || sv.level >= 2;
    const dem = personalDemands(state, name);
    const seats = openSeats(state.team); const fut = futureSeats(state, state.team);
    const pc = preContractEligibility(state, name);
    const blockers = dealBlockers(state, name);
    const commitment = (contracted ? st.fee : 0) + bonusExpectation(d) + expectedSalary(d) * preferredYears(d);
    const difficulty = own ? '–' : isFree ? (a.score >= 60 ? 'Low' : 'Medium') : st.stance === 'refuse' ? 'Very high' : a.score >= 60 && st.stance === 'open' ? 'Medium' : a.score >= 40 ? 'High' : 'Very high';
    const roles = (seats.race ? ['race'] : []).concat(seats.reserve ? ['reserve'] : []);
    const futRoles = (fut.race ? ['race'] : []).concat(fut.reserve ? ['reserve'] : []);
    const init = { salary: knowsDemands ? dem.salary : Math.max(0.5, Math.round((d.salary || 1) * 2) / 2), bonus: knowsDemands ? dem.bonus : bonusExpectation(d), years: preferredYears(d), role: roles[0] || 'reserve' };
    const scoutCost = 0.3;

    return (
      <>
        <div className="mk-pro-head">
          <Avatar driver={d} size={64} />
          <div className="mk-pro-id">
            <p className="mk-kicker">{own ? 'Your driver' : contracted ? `${l.team.name} · ${l.role === 'race' ? 'race driver' : 'reserve'}` : isF2 ? 'F2 prospect' : 'Free agent'}</p>
            <h3 id="mk-pro-title">{d.name}</h3>
            <p className="mk-muted">{nat ? <>{nat.flag} {nat.country} · </> : null}Age {d.age ?? '–'} · {d.roleLabel || d.category}</p>
          </div>
          <span className={`mk-status is-${av.tone}`}>{av.label}</span>
          <button type="button" className={btnClass('ghost')} style={iconBtn('md')} onClick={onClose} aria-label="Close profile"><X size={16} strokeWidth={1.5} /></button>
        </div>

        <div className="mk-pro-figs">
          <div><span>Overall</span><strong>{fmtRange(sv.overall)}</strong></div>
          <div><span>Potential</span><strong>{fmtRange(sv.potential)}</strong></div>
          <div><span>Market value</span><strong>{money(marketValue(d))}</strong></div>
          <div><span>{contracted || own ? 'Salary' : 'Asking salary'}</span><strong>{money(d.salary || 0)}</strong></div>
          <div><span>Contract</span><strong>{l.team ? `${d.contractYearsRemaining ?? '–'} season${d.contractYearsRemaining === 1 ? '' : 's'}` : 'None'}</strong></div>
        </div>

        {msg && <motion.p key={msg.text} className={`mk-msg is-${msg.tone}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status">{msg.text}</motion.p>}

        <section className="mk-sec">
          <h4>Performance <em>{sv.label}</em></h4>
          <ul className="mk-attrs">
            {ATTR_LABELS.map(([k, label]) => {
              const v = sv.attrs[k];
              const lo = Array.isArray(v) ? v[0] : v; const hi = Array.isArray(v) ? v[1] : v;
              return (
                <li key={k}>
                  <span>{label}</span>
                  <span className="mk-attr-bar">{v == null ? <span className="mk-attr-unk" /> : <><span className="mk-attr-range" style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }} /><span className="mk-attr-val" style={{ width: `${lo}%` }} /></>}</span>
                  <b>{v == null ? '?' : fmtRange(v)}</b>
                </li>
              );
            })}
          </ul>
          {sv.level < 2 && !own && <p className="mk-hint">Attributes show once a scout files a partial assessment.</p>}
          {sv.hidden && <p className="mk-hint">Hidden traits: work ethic {sv.hidden.workEthic}, professionalism {sv.hidden.professionalism}, pressure resistance {sv.hidden.pressureResistance}{sv.personality?.feedback != null ? `, technical feedback ${sv.personality.feedback}` : ''}.</p>}
        </section>

        <section className="mk-sec mk-two">
          <div>
            <h4>Career</h4>
            <dl className="mk-dl">
              <div><dt>Race starts (this save)</dt><dd>{c.starts}</dd></div>
              <div><dt>Wins · podiums</dt><dd>{c.wins} · {c.podiums}</dd></div>
              <div><dt>Best finish</dt><dd>{c.best ? `P${c.best}` : '–'}</dd></div>
              <div><dt>Teams raced for</dt><dd>{c.teams.length ? c.teams.join(', ') : d.roleLabel || '–'}</dd></div>
            </dl>
            {c.recent.length > 0 && <div className="mk-form">{c.recent.map((r: any, i: number) => <span key={i} className={r.pos == null ? 'is-dnf' : r.pos <= 3 ? 'is-pod' : r.pos <= 10 ? 'is-pts' : ''} title={`S${r.season} R${r.round}`}>{r.pos ?? 'DNF'}</span>)}</div>}
          </div>
          <div>
            <h4>Contract expectations</h4>
            <dl className="mk-dl">
              <div><dt>Salary expectation</dt><dd>{sv.salaryExpectation != null ? money(sv.salaryExpectation) : knowsDemands ? money(dem.salary) : 'Scout or enquire'}</dd></div>
              <div><dt>Signing bonus</dt><dd>{knowsDemands ? money(dem.bonus) : '–'}</dd></div>
              <div><dt>Preferred length</dt><dd>{preferredYears(d)} season{preferredYears(d) === 1 ? '' : 's'}</dd></div>
              <div><dt>Role preference</dt><dd>{a.requiresRaceSeat ? 'Race seat only' : 'Race seat or reserve'}</dd></div>
            </dl>
          </div>
        </section>

        {!own && (
          <section className="mk-sec">
            <h4>Recruitment</h4>
            <div className="mk-recruit">
              <div><span>Interest in your team</span><strong className={`is-${a.band.tone}`}>{sv.interest ? `${a.score} · ${a.band.label}` : a.band.label}</strong></div>
              <div><span>Signing difficulty</span><strong>{difficulty}</strong></div>
              <div><span>Expected commitment</span><strong>{money(commitment)}</strong><em>{contracted ? 'fee + bonus + salary over preferred length' : 'bonus + salary over preferred length'}</em></div>
              {contracted && <div><span>{l.team.name}'s stance</span><strong className={st.stance === 'refuse' || st.stance === 'suspended' ? 'is-neg' : st.stance === 'open' ? 'is-pos' : 'is-mid'}>{st.stance === 'refuse' ? 'Not for sale' : st.stance === 'suspended' ? 'Talks suspended' : st.stance === 'open' ? `Open, about ${money(st.fee)}` : `Wants a fee, about ${money(st.fee)}`}</strong></div>}
            </div>
            {sv.interest ? (
              <div className="mk-why">
                <p className="mk-sub">Scouting report: why the interest is {a.score}</p>
                <ul className="mk-comp">
                  {[['contract', 'Contract situation'], ['teamCompetitiveness', 'Current team'], ['satisfaction', 'Unhappiness'], ['ambition', `Career fit (${a.stage.toLowerCase()})`], ['attractiveness', 'Your team’s pull'], ['salary', 'Pay opportunity']].map(([k, lab]) => (
                    <li key={k}><span>{lab}<em>{Math.round(a.weights[k] * 100)}%</em></span><span className="mk-bar"><span style={{ transform: `scaleX(${a.components[k] / 100})` }} /></span><b>{Math.round(a.components[k])}</b></li>
                  ))}
                </ul>
                <ul className="mk-reasons">{a.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}{contracted && st.reasons.map((r: string, i: number) => <li key={`s${i}`}>{l.team.name}: {r.toLowerCase()}</li>)}</ul>
              </div>
            ) : <p className="mk-hint">A detailed scouting assessment explains this driver's interest and satisfaction.</p>}
          </section>
        )}

        {!own && (
          <section className="mk-sec">
            <h4>Scouting <em>{sv.label}</em></h4>
            <div className="mk-scout">
              <span className="mk-scout-bar">{SCOUT_LEVELS.slice(1).map((s) => <span key={s.level} className={sv.level >= s.level ? 'is-on' : ''} title={s.label} />)}</span>
              <span className="mk-muted">{sv.level >= 4 ? 'Complete' : `${Math.round(sv.progress)} / ${sv.nextAt} points to ${SCOUT_LEVELS[Math.min(4, sv.level + 1)].label.toLowerCase()}`}</span>
              {state.transferMarket.scouting[name]?.active
                ? <button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm')} onClick={() => { recallScout(state, name); bump((x) => x + 1); onChanged?.(); }}>Recall scout</button>
                : sv.level < 4 && <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => act(() => assignScout(state, name))}><Telescope size={14} strokeWidth={1.5} />Request scouting report ({money(scoutCost)})</button>}
            </div>
          </section>
        )}

        {/* ── Actions ── */}
        {!own && (
          <section className="mk-sec mk-actions-sec">
            <h4>{contracted ? 'Approach driver' : isF2 ? 'Recruit prospect' : 'Make an offer'}</h4>
            <div className="mk-quick">
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={onToggleShortlist}><Star size={14} strokeWidth={1.5} fill={shortlisted ? 'currentColor' : 'none'} />{shortlisted ? 'On shortlist' : 'Add to shortlist'}</button>
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => onCompare(name)}><GitCompare size={14} strokeWidth={1.5} />Compare</button>
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => act(() => enquire(state, name))}><MessageCircle size={14} strokeWidth={1.5} />Informal enquiry</button>
              {contracted && <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => act(() => expressInterest(state, name))}><Heart size={14} strokeWidth={1.5} />Express interest</button>}
            </div>

            {contracted ? (
              <>
                <div className="mk-step">
                  <p className="mk-sub"><FileSignature size={14} strokeWidth={1.5} />1 · Personal terms with the driver {talk?.personal?.agreed && <em className="is-pos">Agreed: {money(talk.personal.salary)} × {talk.personal.years}, {talk.personal.role}</em>}</p>
                  <TermsForm key={`p${talk?.history?.length || 0}`} initial={talk?.personal || init} roles={roles.length ? roles : ['race', 'reserve']}
                    hint={knowsDemands ? `They expect about ${money(dem.salary)} a season and ${money(dem.bonus)} up front.` : 'Make an enquiry or scout them to learn what they expect.'}
                    submitLabel="Offer personal terms" onSubmit={(t: any) => act(() => offerPersonalTerms(state, name, t))} />
                </div>
                <div className="mk-step">
                  <p className="mk-sub"><Banknote size={14} strokeWidth={1.5} />2 · Transfer fee to {l.team.name} {talk?.fee?.agreed && <em className="is-pos">Agreed: {money(talk.fee.amount)}</em>}</p>
                  <FeeForm ask={st.fee} disabled={st.stance === 'refuse' || st.stance === 'suspended'} onBid={(fee: number) => act(() => bidTransferFee(state, name, fee))} />
                  <p className="mk-hint">Bids within 15% of their price get a counter; under 60% damages the relationship. Relationship with {l.team.name}: {state.transferMarket.relations[l.team.name] ?? 60}.</p>
                </div>
                <div className="mk-step">
                  <p className="mk-sub"><CheckCircle2 size={14} strokeWidth={1.5} />3 · Complete the transfer</p>
                  {blockers.length ? <ul className="mk-blockers">{blockers.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul> : <p className="mk-hint">Everything is agreed.</p>}
                  <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} disabled={blockers.length > 0} onClick={() => act(() => completeSigning(state, name))}>Sign {d.name.split(' ').pop()}</button>
                </div>
                <div className="mk-step">
                  <p className="mk-sub"><CalendarClock size={14} strokeWidth={1.5} />Pre-contract for next season</p>
                  {pc.ok ? (
                    <TermsForm initial={{ ...init, role: futRoles[0] || 'race' }} roles={futRoles.length ? futRoles : ['race']} disabled={!futRoles.length}
                      hint={futRoles.length ? 'No transfer fee. They join when their contract ends; the bonus is committed now and paid on arrival.' : 'You have no seat free next season. A seat frees when one of your drivers enters a final contract year.'}
                      submitLabel="Agree pre-contract" onSubmit={(t: any) => act(() => agreePreContract(state, name, t))} />
                  ) : <p className="mk-hint">{pc.reason}.</p>}
                </div>
              </>
            ) : (
              <>
                <TermsForm key={`f${talk?.history?.length || 0}`} initial={init} roles={roles.length ? roles : ['reserve']} disabled={!roles.length}
                  hint={!roles.length ? 'No seats free: release or move a driver first.' : knowsDemands ? `They expect about ${money(dem.salary)} a season and ${money(dem.bonus)} up front.` : 'Make an enquiry or scout them to learn what they expect.'}
                  submitLabel={isF2 ? 'Offer contract' : 'Offer contract'} onSubmit={(t: any) => act(() => signFreeDriver(state, name, t))} />
                {isF2 && (
                  <div className="mk-step">
                    <p className="mk-sub"><GraduationCap size={14} strokeWidth={1.5} />Development driver</p>
                    <p className="mk-hint">Joins your academy on a three-season deal: {money(signingFee(d))} signing fee and {money(juniorSalary(d))} a season, paid from the academy budget (you have {money(state.academy?.budget || 0)}). Academy drivers train, race in the junior championships and can be promoted later.</p>
                    <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => act(() => signProspect(state, name))}>Sign to academy</button>
                  </div>
                )}
              </>
            )}

            {talk?.history?.length > 0 && (
              <div className="mk-step">
                <p className="mk-sub"><Eye size={14} strokeWidth={1.5} />Talks log</p>
                <ul className="mk-log">{talk.history.map((h: any, i: number) => <li key={i}><em>S{h.year} · day {h.day}</em>{h.text}</li>)}</ul>
              </div>
            )}
          </section>
        )}
      </>
    );
  };

  return createPortal(
    <AnimatePresence>
      {name && (
        <motion.div className="mk-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.aside ref={ref} className="mk-drawer" role="dialog" aria-modal="true" aria-labelledby="mk-pro-title"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }}>
            {body()}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function FeeForm({ ask, disabled, onBid }: { ask: number; disabled: boolean; onBid: (fee: number) => void }) {
  const [fee, setFee] = useState(Math.round(ask * 0.8 * 2) / 2);
  return (
    <form className="mk-terms" onSubmit={(e) => { e.preventDefault(); onBid(fee); }}>
      <label><span>Fee offer</span><input type="number" step="0.5" min="0" value={fee} onChange={(e) => setFee(Number(e.target.value))} disabled={disabled} /></label>
      <button type="submit" className={btnClass('secondary')} style={btn('secondary', 'sm')} disabled={disabled}>Submit bid</button>
    </form>
  );
}
