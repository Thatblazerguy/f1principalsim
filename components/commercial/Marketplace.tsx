import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Eye, GitCompare, Handshake, Check, X, PenLine, ArrowUpDown } from 'lucide-react';
import { btn, btnClass } from '../HubLayout.tsx';
import { assignSponsorToSlot } from '../../utils/sponsorDeals.js';
import {
  SLOT_BY_PLACEMENT, offerValue, negotiationOdds, runNegotiation, signWithTerms, slotLabel,
} from '../../utils/commercialModel.js';
import { Monogram, Modal, DialogHead, OddsMeter, money, EASE } from './commercialUi.tsx';

const SORTS = [
  { id: 'value', label: 'Best overall value', fn: (a: any, b: any) => offerValue(b) - offerValue(a) },
  { id: 'bonus', label: 'Highest signing bonus', fn: (a: any, b: any) => b.signingBonus - a.signingBonus },
  { id: 'income', label: 'Highest income', fn: (a: any, b: any) => b.monthlyIncome - a.monthlyIncome },
  { id: 'prestige', label: 'Highest prestige', fn: (a: any, b: any) => b.brandPrestige - a.brandPrestige },
  { id: 'short', label: 'Shortest contract', fn: (a: any, b: any) => a.contractLength - b.contractLength },
];
const PLACEMENTS = ['Title', 'Kit', 'Sidepod', 'Rear Wing', 'Halo'];
const tier = (o: any) => (o.slot === 'Title' ? 'Title partner' : o.brandPrestige >= 80 ? 'Premium partner' : o.brandPrestige >= 65 ? 'Official partner' : 'Supplier');

// ─── Negotiation ────────────────────────────────────────────────────────────
export function NegotiationPanel({ appState, offer, slotKey, mode, onDone, onCancel }: {
  appState: any; offer: any; slotKey: string; mode: 'new' | 'renegotiate'; onDone: (msg: string) => void; onCancel: () => void;
}) {
  const base = { bonus: offer.signingBonus ?? 0, income: offer.monthlyIncome ?? 0, length: offer.contractLength || 12 };
  const [terms, setTerms] = useState({ ...base });
  const [result, setResult] = useState<any>(null);
  const odds = negotiationOdds(appState, offer, terms, mode);
  const step = 0.1;
  const set = (k: 'bonus' | 'income' | 'length', v: number) => { setTerms(t => ({ ...t, [k]: k === 'length' ? Math.round(v) : Math.round(v * 10) / 10 })); setResult(null); };

  const propose = () => {
    const r = runNegotiation(appState, slotKey, offer, terms, mode);
    setResult(r);
    if (r.outcome === 'accepted') onDone(r.message);
  };
  const acceptCounter = () => {
    if (mode === 'new') {
      const { paid } = signWithTerms(appState, slotKey, offer, result.counter);
      onDone(`${offer.name} signed on their counter-offer: $${result.counter.income}M a race${paid ? `, $${result.counter.bonus}M bonus paid` : ''}.`);
    } else {
      const c = appState.team.sponsorSlots[slotKey];
      c.monthlyIncome = result.counter.income; c.contractLength = result.counter.length; c.expiresRound = (appState.season?.round || 1) + result.counter.length; c.negotiated = true;
      onDone(`${offer.name} counter-offer accepted: $${result.counter.income}M a race.`);
    }
  };

  const slider = (k: 'bonus' | 'income' | 'length', label: string, min: number, max: number) => (
    <div className="cm-neg-field">
      <div className="cm-neg-head"><label htmlFor={`cm-n-${k}`}>{label}</label><strong>{k === 'length' ? `${terms.length} rounds` : money(terms[k])}</strong></div>
      <input id={`cm-n-${k}`} type="range" min={min} max={max} step={k === 'length' ? 1 : step} value={terms[k]}
        onChange={e => set(k, Number(e.target.value))} disabled={odds.suspended} />
      <div className="cm-neg-ticks"><span>{k === 'length' ? min : money(min)}</span><span>Listed {k === 'length' ? base.length : money(base[k])}</span><span>{k === 'length' ? max : money(max)}</span></div>
    </div>
  );

  return (
    <div className="cm-neg">
      <p className="cm-pill-note"><PenLine size={14} strokeWidth={1.5} />Negotiation is a new F1P rule. The terms it agrees are written to the same contract the game pays from.</p>
      <div className="cm-neg-grid">
        <div>
          {mode === 'new' && slider('bonus', 'Signing bonus', Math.max(0, Math.round(base.bonus * 0.6 * 10) / 10), Math.round(base.bonus * 1.6 * 10) / 10)}
          {slider('income', 'Income per race', Math.round(base.income * 0.6 * 10) / 10, Math.round(base.income * 1.6 * 10) / 10)}
          {slider('length', 'Contract length', Math.max(4, base.length - 6), base.length + 6)}
          <p className="cm-muted">Sponsor expectations: {offer.contractLength} rounds at {money(base.income)} a race{mode === 'new' ? `, ${money(base.bonus)} up front` : ''}. Their performance clause pays {money(offer.performanceBonus ?? 0)} × relationship × 2 at season end.</p>
        </div>
        <div>
          <OddsMeter odds={odds.odds} />
          <ul className="cm-factors">
            {odds.factors.map((f: any, i: number) => <li key={i} className={`is-${f.effect}`}>{f.text}{f.value ? <em>{f.value > 0 ? '+' : ''}{f.value}</em> : null}</li>)}
          </ul>
          <p className="cm-muted">Odds start at 80, move with reputation against prestige, drop 3 points per 1% asked over the listing and 3 per round of length outside ±3. A near miss brings a counter-offer; two rejections suspend talks this round.</p>
        </div>
      </div>
      <AnimatePresence>
        {result && result.outcome !== 'accepted' && (
          <motion.div className={`cm-outcome is-${result.outcome}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} role="status">
            <strong>{result.outcome === 'counter' ? 'Counter-offer' : result.outcome === 'rejected' ? 'Offer rejected' : 'Negotiations suspended'}</strong>
            <span>{result.message}</span>
            {result.outcome === 'counter' && (
              <div className="cm-outcome-terms">
                {mode === 'new' && <span>Bonus <b>{money(result.counter.bonus)}</b></span>}
                <span>Per race <b>{money(result.counter.income)}</b></span><span>Length <b>{result.counter.length} rounds</b></span>
                <div className="cm-outcome-actions">
                  <button type="button" className={btnClass('primary')} style={btn('primary', 'sm')} onClick={acceptCounter}><Check size={14} strokeWidth={1.5} />Accept counter</button>
                  <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => { setTerms(result.counter); setResult(null); }}>Keep negotiating</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="cm-dialog-foot">
        <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={onCancel}>Back</button>
        <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={propose} disabled={odds.suspended || result?.outcome === 'counter'}>
          <Handshake size={16} strokeWidth={1.5} />Propose terms
        </button>
      </div>
    </div>
  );
}

// ─── Offer profile ──────────────────────────────────────────────────────────
function OfferDialog({ appState, offer, onClose, onPreview, previewing, onChanged }: any) {
  const [mode, setMode] = useState<'profile' | 'negotiate' | 'confirm'>('profile');
  if (!offer) return null;
  const slotKey = SLOT_BY_PLACEMENT[offer.slot];
  const current = appState.team.sponsorSlots?.[slotKey];
  const paidBefore = !!appState.signedSponsors?.[offer.id];
  const isCurrent = current?.id === offer.id;
  const close = () => { setMode('profile'); onClose(); };
  const signListed = () => {
    const { signingBonusPaid } = assignSponsorToSlot(appState.team, slotKey, offer.id, appState.sponsorOffers, appState);
    onChanged(`${offer.name} signed to the ${slotLabel(slotKey).toLowerCase()} placement${signingBonusPaid ? `, ${money(signingBonusPaid)} signing bonus paid` : ', bonus already paid before'}.`);
    close();
  };
  const rows: [string, string][] = [
    ['Placement', `${slotLabel(slotKey)}`], ['Industry', offer.industry], ['Tier', tier(offer)], ['Partner type', offer.partnerType],
    ['Signing bonus', paidBefore ? `${money(offer.signingBonus)} (already paid once)` : money(offer.signingBonus)],
    ['Income per race', money(offer.monthlyIncome, 2)], ['Contract length', `${offer.contractLength} rounds`],
    ['Brand prestige', String(offer.brandPrestige)], ['Performance clause', `${money(offer.performanceBonus)} × relationship × 2, season end`],
    ['Value over contract', money(offerValue(offer))],
  ];
  return (
    <Modal open={!!offer} onClose={close} labelId="cm-offer-title" wide>
      <DialogHead id="cm-offer-title" kicker={`${offer.slot} offer · ${tier(offer)}`} title={offer.name} onClose={close}><Monogram name={offer.name} size={44} /></DialogHead>
      {mode === 'negotiate' ? (
        <NegotiationPanel appState={appState} offer={offer} slotKey={slotKey} mode="new" onDone={(m) => { onChanged(m); close(); }} onCancel={() => setMode('profile')} />
      ) : mode === 'confirm' ? (
        <>
          <p className="cm-dialog-body">
            Sign {offer.name} to the {slotLabel(slotKey).toLowerCase()} placement at {money(offer.monthlyIncome, 2)} a race for {offer.contractLength} rounds.
            {current && !isCurrent ? ` This replaces ${current.name}, whose deal ends now with no penalty in the current rules.` : ''}
            {paidBefore ? ' The signing bonus was paid when you first signed this brand, so none is paid again.' : ` ${money(offer.signingBonus)} signing bonus goes to the budget now.`}
          </p>
          <div className="cm-dialog-foot">
            <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={() => setMode('profile')}>Back</button>
            <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={signListed}><Check size={16} strokeWidth={1.5} />Confirm signing</button>
          </div>
        </>
      ) : (
        <>
          <dl className="cm-details">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <p className="cm-muted" style={{ marginTop: 12 }}>Listed benefit: “{offer.perk}” This is flavour text; the race simulation doesn't apply sponsor perks.</p>
          {current && !isCurrent && <p className="cm-muted">Currently on this placement: <strong>{current.name}</strong> at {money(current.monthlyIncome, 2)} a race.</p>}
          <div className="cm-dialog-foot">
            <button type="button" className={btnClass('ghost')} style={btn('ghost', 'md')} onClick={() => onPreview(previewing ? null : offer)}><Eye size={16} strokeWidth={1.5} />{previewing ? 'Clear preview' : 'Preview on car'}</button>
            <span style={{ flex: 1 }} />
            <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} disabled={isCurrent} onClick={() => setMode('negotiate')}><Handshake size={16} strokeWidth={1.5} />Negotiate</button>
            <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} disabled={isCurrent} onClick={() => setMode('confirm')}>{isCurrent ? 'Already signed' : 'Sign at listed terms'}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Marketplace ────────────────────────────────────────────────────────────
export function Marketplace({ appState, placement, setPlacement, previewId, onPreview, onChanged, reduced }: any) {
  const offers: any[] = appState.sponsorOffers || [];
  const industries = useMemo(() => [...new Set(offers.map(o => o.industry))].sort(), [offers]);
  const benefits = useMemo(() => [...new Set(offers.map(o => o.strategicBenefit))].sort(), [offers]);
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('');
  const [benefit, setBenefit] = useState('');
  const [minIncome, setMinIncome] = useState(0);
  const [minBonus, setMinBonus] = useState(0);
  const [maxLen, setMaxLen] = useState(30);
  const [minPrestige, setMinPrestige] = useState(0);
  const [minValue, setMinValue] = useState(0);
  const [sort, setSort] = useState('value');
  const [compare, setCompare] = useState<string[]>([]);
  const [open, setOpen] = useState<any>(null);

  const list = offers
    .filter(o => !placement || o.slot === placement)
    .filter(o => !industry || o.industry === industry)
    .filter(o => !benefit || o.strategicBenefit === benefit)
    .filter(o => !q || `${o.name} ${o.industry} ${o.partnerType}`.toLowerCase().includes(q.toLowerCase()))
    .filter(o => o.monthlyIncome >= minIncome && o.signingBonus >= minBonus && o.contractLength <= maxLen && o.brandPrestige >= minPrestige && offerValue(o) >= minValue)
    .sort(SORTS.find(s => s.id === sort)!.fn);
  const compared = compare.map(id => offers.find(o => o.id === id)).filter(Boolean);
  const toggleCompare = (id: string) => setCompare(c => c.includes(id) ? c.filter(x => x !== id) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]);
  const maxIncome = Math.max(...offers.map(o => o.monthlyIncome), 1);
  const maxValue = Math.max(...offers.map(o => offerValue(o)), 1);

  return (
    <section className="cm-panel cm-market" aria-labelledby="cm-market-title">
      <div className="cm-panel-head">
        <h2 id="cm-market-title" className="cm-panel-title"><span className="cm-code">05</span>Sponsor marketplace</h2>
        <span className="cm-muted">{offers.length} offers this season · new offers arrive each offseason</span>
      </div>

      <div className="cm-filters">
        <div className="cm-search"><Search size={16} strokeWidth={1.5} /><input type="search" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search sponsors" /></div>
        <div className="cm-chips" role="group" aria-label="Placement">
          <button type="button" className={`cm-chip ${!placement ? 'is-on' : ''}`} aria-pressed={!placement} onClick={() => setPlacement('')}>All</button>
          {PLACEMENTS.map(p => <button key={p} type="button" className={`cm-chip ${placement === p ? 'is-on' : ''}`} aria-pressed={placement === p} onClick={() => setPlacement(p)}>{p}</button>)}
        </div>
        <select value={industry} onChange={e => setIndustry(e.target.value)} aria-label="Industry"><option value="">All industries</option>{industries.map(i => <option key={i}>{i}</option>)}</select>
        <select value={benefit} onChange={e => setBenefit(e.target.value)} aria-label="Listed benefit"><option value="">All listed benefits</option>{benefits.map(b => <option key={b}>{b}</option>)}</select>
        <label className="cm-sort"><ArrowUpDown size={14} strokeWidth={1.5} /><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      </div>
      <div className="cm-ranges">
        {[
          { l: 'Min income / race', v: minIncome, set: setMinIncome, max: Math.ceil(maxIncome), step: 0.1, f: (v: number) => money(v) },
          { l: 'Min signing bonus', v: minBonus, set: setMinBonus, max: Math.ceil(Math.max(...offers.map(o => o.signingBonus), 1)), step: 0.5, f: (v: number) => money(v) },
          { l: 'Min contract value', v: minValue, set: setMinValue, max: Math.ceil(maxValue), step: 1, f: (v: number) => money(v, 0) },
          { l: 'Max length', v: maxLen, set: setMaxLen, max: 30, step: 1, f: (v: number) => `${v} rounds` },
          { l: 'Min prestige', v: minPrestige, set: setMinPrestige, max: 99, step: 1, f: (v: number) => String(v) },
        ].map(r => (
          <label key={r.l} className="cm-range"><span>{r.l}<b>{r.f(r.v)}</b></span>
            <input type="range" min={0} max={r.max} step={r.step} value={r.v} onChange={e => r.set(Number(e.target.value))} /></label>
        ))}
      </div>

      <AnimatePresence>
        {compared.length > 0 && (
          <motion.div className="cm-compare" initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="cm-compare-head"><strong><GitCompare size={14} strokeWidth={1.5} />Comparing {compared.length}</strong><button type="button" className="cm-link" onClick={() => setCompare([])}>Clear</button></div>
            <table className="cm-table">
              <thead><tr><th /> {compared.map((o: any) => <th key={o.id}>{o.name}<button type="button" className="cm-x" onClick={() => toggleCompare(o.id)} aria-label={`Remove ${o.name}`}><X size={12} /></button></th>)}</tr></thead>
              <tbody>
                {[
                  ['Placement', (o: any) => o.slot, null],
                  ['Signing bonus', (o: any) => money(o.signingBonus), (o: any) => o.signingBonus],
                  ['Income per race', (o: any) => money(o.monthlyIncome, 2), (o: any) => o.monthlyIncome],
                  ['Length', (o: any) => `${o.contractLength} rounds`, null],
                  ['Prestige', (o: any) => o.brandPrestige, (o: any) => o.brandPrestige],
                  ['Value over contract', (o: any) => money(offerValue(o)), (o: any) => offerValue(o)],
                ].map(([label, fmt, score]: any) => {
                  const best = score ? Math.max(...compared.map(score)) : null;
                  return <tr key={label}><th>{label}</th>{compared.map((o: any) => <td key={o.id} className={score && score(o) === best && compared.length > 1 ? 'is-best' : ''}>{fmt(o)}</td>)}</tr>;
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="cm-cards" layout={!reduced}>
        <AnimatePresence initial={false}>
          {list.map(o => {
            const slotKey = SLOT_BY_PLACEMENT[o.slot];
            const signedHere = appState.team.sponsorSlots?.[slotKey]?.id === o.id;
            const v = offerValue(o);
            return (
              <motion.article key={o.id} layout={!reduced} className={`cm-card ${previewId === o.id ? 'is-preview' : ''} ${signedHere ? 'is-signed' : ''}`}
                initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.28, ease: EASE }}>
                <button type="button" className="cm-card-main" onClick={() => setOpen(o)} aria-label={`Open ${o.name} offer`}>
                  <span className="cm-card-top">
                    <Monogram name={o.name} />
                    <span className="cm-card-id"><strong>{o.name}</strong><em>{o.industry} · {tier(o)}</em></span>
                    <span className="cm-card-slot">{o.slot}</span>
                  </span>
                  <span className="cm-card-figs">
                    <span><em>Bonus</em><b>{money(o.signingBonus)}</b></span>
                    <span><em>Per race</em><b>{money(o.monthlyIncome, 2)}</b></span>
                    <span><em>Length</em><b>{o.contractLength}r</b></span>
                    <span><em>Prestige</em><b>{o.brandPrestige}</b></span>
                  </span>
                  <span className="cm-value"><span style={{ transform: `scaleX(${v / maxValue})` }} /></span>
                  <span className="cm-card-foot"><em>Value {money(v)} over contract</em><em>{o.strategicBenefit}</em></span>
                </button>
                <div className="cm-card-actions">
                  {signedHere ? <span className="cm-tag is-on"><Check size={12} strokeWidth={2} />Signed</span> : appState.signedSponsors?.[o.id] ? <span className="cm-tag">Bonus paid before</span> : <span />}
                  <label className="cm-check"><input type="checkbox" checked={compare.includes(o.id)} onChange={() => toggleCompare(o.id)} />Compare</label>
                  <button type="button" className={`cm-icon ${previewId === o.id ? 'is-on' : ''}`} onClick={() => onPreview(previewId === o.id ? null : o)} aria-pressed={previewId === o.id} aria-label={`Preview ${o.name} on the car`} title="Preview on car"><Eye size={14} strokeWidth={1.5} /></button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
        {!list.length && <p className="cm-empty">No offers match these filters.</p>}
      </motion.div>

      <OfferDialog appState={appState} offer={open} onClose={() => setOpen(null)} previewing={open && previewId === open.id}
        onPreview={(o: any) => onPreview(o)} onChanged={(m: string) => { setOpen(null); onChanged(m); }} />
    </section>
  );
}
