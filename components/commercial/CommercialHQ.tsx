import React, { Suspense, lazy, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wallet, LayoutGrid, Coins, Star, FileSignature, Handshake, ChevronRight, Plus, Shirt, Eye, Target, BarChart3, AlertTriangle, Check, Rotate3d, ZoomIn, ZoomOut } from 'lucide-react';
import { HUB, btn, btnClass, iconBtn, pageTitle, pageSubtitle } from '../HubLayout.tsx';
import { AnimatedNumber } from '../ui/motion.tsx';
import { usePrefersReducedMotion } from '../driverToolsMotion.ts';
import { assignSponsorToSlot } from '../../utils/sponsorDeals.js';
import {
  getPortfolio, getCommercialOverview, getRevenueAnalytics, getSponsorObjectives, getMilestones,
  SLOT_ZONES, ZONE_SLOT, ZONE_LABELS, PLACEMENT_BY_SLOT, slotLabel,
} from '../../utils/commercialModel.js';
import { Monogram, Modal, DialogHead, money, EASE } from './commercialUi.tsx';
import { Marketplace, NegotiationPanel } from './Marketplace.tsx';
import { VIEWS, type CamView } from './studioViews.ts';
import './commercial.css';

const LiveryStudio = lazy(() => import('./LiveryStudio.tsx'));
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

// ─── KPIs ───────────────────────────────────────────────────────────────────
function Kpis({ ov, an, port, open, setOpen }: any) {
  const items = [
    { id: 'cash', icon: Wallet, label: 'Cash reserve', value: ov.cash, fmt: (v: number) => money(v), trend: ov.cashTrend, trendLabel: 'net last race' },
    { id: 'slots', icon: LayoutGrid, label: 'Placements filled', value: ov.filled, fmt: (v: number) => `${Math.round(v)}/${ov.slots}` },
    { id: 'income', icon: Coins, label: 'Income per race', value: ov.perRace, fmt: (v: number) => money(v, 2), trend: ov.incomeTrend, trendLabel: 'vs previous race' },
    { id: 'rep', icon: Star, label: 'Commercial reputation', value: ov.reputation, fmt: (v: number) => String(Math.round(v)) },
    { id: 'value', icon: FileSignature, label: 'Remaining contract value', value: ov.contractValue, fmt: (v: number) => money(v) },
    { id: 'deals', icon: Handshake, label: 'Active agreements', value: ov.filled, fmt: (v: number) => String(Math.round(v)) },
  ];
  const detail: Record<string, React.ReactNode> = {
    cash: <p>Budget the team can spend now. Sponsor income, prize money and merchandise are added after each race; salaries and running costs come out. {ov.cashTrend != null ? `Last race net: ${ov.cashTrend >= 0 ? '+' : ''}${money(ov.cashTrend)}.` : 'No race finances yet this season.'}</p>,
    slots: <p>{port.map((p: any) => `${p.label}: ${p.contract ? p.contract.name : 'vacant'}`).join(' · ')}</p>,
    income: <p>Each signed placement pays its income every race weekend. {port.filter((p: any) => p.contract).map((p: any) => `${p.label} ${money(p.contract.monthlyIncome, 2)}`).join(' · ') || 'Nothing signed.'} The game labels this monthly income.</p>,
    rep: <p>Moves after each race: +3 for a podium, +1 for any points. Relationship (sponsor happiness) is {ov.happiness}%: it rises with bonus challenges and falls with missed sponsor objectives. Offers are drawn at random each offseason, so reputation doesn't change which brands appear yet.</p>,
    value: <p>Income per race × rounds left on each deal, {money(ov.contractValue)} in total. Season-end performance payouts add {money(ov.seasonEndPayout)} on top at current relationship levels.</p>,
    deals: <p>{ov.filled} signed partners, {an.signedCount} brands signed in total, {money(an.bonuses)} received in signing bonuses.</p>,
  };
  return (
    <div className="cm-kpis-wrap">
      <div className="cm-kpis" role="tablist" aria-label="Commercial overview">
        {items.map(k => {
          const on = open === k.id; const Icon = k.icon;
          return (
            <button key={k.id} type="button" role="tab" aria-selected={on} aria-controls="cm-kpi-detail" className={`cm-kpi ${on ? 'is-on' : ''}`} onClick={() => setOpen(on ? null : k.id)}>
              <span className="cm-kpi-k"><Icon size={14} strokeWidth={1.5} />{k.label}</span>
              <strong><AnimatedNumber value={k.value} formatter={k.fmt} /></strong>
              {k.trend != null && <em className={k.trend > 0 ? 'is-up' : k.trend < 0 ? 'is-down' : ''}>{k.trend > 0 ? '▲' : k.trend < 0 ? '▼' : '–'} {money(Math.abs(k.trend))} {k.trendLabel}</em>}
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="cm-kpi-detail" className="cm-kpi-detail" key={open} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <div>{detail[open]}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Portfolio ──────────────────────────────────────────────────────────────
function Portfolio({ port, selected, onSelect }: any) {
  return (
    <section className="cm-panel cm-portfolio" aria-labelledby="cm-port-title">
      <div className="cm-panel-head"><h2 id="cm-port-title" className="cm-panel-title"><span className="cm-code">01</span>Portfolio</h2></div>
      <ul className="cm-slots">
        {port.map((p: any) => {
          const c = p.contract; const on = selected === p.key;
          return (
            <li key={p.key}>
              <button type="button" className={`cm-slot ${c ? '' : 'is-vacant'} ${on ? 'is-on' : ''}`} onClick={() => onSelect(p.key)} aria-pressed={on}>
                <span className="cm-slot-top"><span className="cm-slot-name">{p.label}</span>{c ? <span className={`cm-status is-${p.status === 'Active' ? 'ok' : 'warn'}`}>{p.status}</span> : <span className="cm-status">Vacant</span>}</span>
                {c ? (
                  <>
                    <span className="cm-slot-sponsor"><Monogram name={c.name} size={32} /><span><strong>{c.name}</strong><em>{money(c.monthlyIncome, 2)} a race · {p.roundsLeft} rounds left{c.negotiated ? ' · negotiated' : ''}</em></span></span>
                    <span className="cm-rel" title={`Relationship ${c.relationshipLevel}%`}><span style={{ transform: `scaleX(${(c.relationshipLevel || 0) / 100})` }} /></span>
                  </>
                ) : (
                  <span className="cm-slot-empty"><Plus size={14} strokeWidth={1.5} />Find a {p.label.toLowerCase()} partner</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Placement drawer ───────────────────────────────────────────────────────
function PlacementDialog({ appState, slotKey, onClose, onChanged, onFind }: any) {
  const [mode, setMode] = useState<'view' | 'renegotiate' | 'terminate'>('view');
  const p = getPortfolio(appState).find((x: any) => x.key === slotKey);
  if (!p) return null;
  const c = p.contract;
  const close = () => { setMode('view'); onClose(); };
  const terminate = () => {
    assignSponsorToSlot(appState.team, slotKey, null, appState.sponsorOffers, appState);
    onChanged(`${c.name} released from the ${p.label.toLowerCase()} placement.`);
    close();
  };
  const round = appState.season?.round || 1;
  return (
    <Modal open={!!slotKey} onClose={close} labelId="cm-pl-title" wide>
      <DialogHead id="cm-pl-title" kicker={`${p.label} placement · ${SLOT_ZONES[slotKey].map((z: string) => ZONE_LABELS[z]).join(', ') || 'team kit'}`} title={c ? c.name : 'Vacant placement'} onClose={close}>
        {c && <Monogram name={c.name} size={44} />}
      </DialogHead>
      {!c ? (
        <>
          <p className="cm-dialog-body">No partner on this placement. It earns nothing until a sponsor is signed. {appState.sponsorOffers.filter((o: any) => o.slot === PLACEMENT_BY_SLOT[slotKey]).length} offers for it are in the marketplace.</p>
          <div className="cm-dialog-foot"><button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={() => { close(); onFind(PLACEMENT_BY_SLOT[slotKey]); }}>Browse {p.label.toLowerCase()} offers</button></div>
        </>
      ) : mode === 'renegotiate' ? (
        <NegotiationPanel appState={appState} offer={c} slotKey={slotKey} mode="renegotiate" onDone={(m) => { onChanged(m); close(); }} onCancel={() => setMode('view')} />
      ) : mode === 'terminate' ? (
        <>
          <p className="cm-dialog-body">Release {c.name}? Their {money(c.monthlyIncome, 2)} a race stops from the next race and their open objectives are dropped. The current rules charge no termination fee. Signing them again later pays no second signing bonus.</p>
          <div className="cm-dialog-foot">
            <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={() => setMode('view')}>Back</button>
            <button type="button" className={btnClass('danger')} style={btn('danger', 'md')} onClick={terminate}>Release sponsor</button>
          </div>
        </>
      ) : (
        <>
          <dl className="cm-details">
            {[
              ['Income per race', money(c.monthlyIncome, 2)], ['Signing bonus', money(c.signingBonus)], ['Signed', `Round ${c.signedRound}`],
              ['Term', `${c.contractLength} rounds, to round ${c.expiresRound}`], ['Status', `${p.status} · ${p.roundsLeft} rounds left`],
              ['Relationship', `${c.relationshipLevel}%`], ['Brand prestige', String(c.brandPrestige)],
              ['Season-end payout', `${money(p.payout)} (income × 5 + ${money(c.performanceBonus)} × relationship × 2)`],
            ].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="cm-muted" style={{ marginTop: 10 }}>Renewal: the game doesn't end deals at their term. They carry on until you release them, and the offseason asks whether to keep sponsors into the next season.</p>
          <p className="cm-kicker" style={{ marginTop: 16 }}>Sponsor objectives</p>
          <ul className="cm-objs">
            {(c.objectives || []).map((o: any, i: number) => {
              const st = o.complete ? 'Achieved' : o.lastResult === 'Missed' || round > o.deadline ? 'Missed' : 'Open';
              return <li key={i} className={`is-${st.toLowerCase()}`}><strong>{o.label}</strong><span>By round {o.deadline} · {o.difficulty}</span><em>+{money(o.reward)} / −{money(o.penalty)}</em><b>{st}</b></li>;
            })}
          </ul>
          <div className="cm-dialog-foot">
            <button type="button" className={btnClass('danger')} style={btn('danger', 'md')} onClick={() => setMode('terminate')}>Terminate</button>
            <span style={{ flex: 1 }} />
            <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={() => { close(); onFind(PLACEMENT_BY_SLOT[slotKey]); }}>Change sponsor</button>
            <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={() => setMode('renegotiate')}><Handshake size={16} strokeWidth={1.5} />Renegotiate</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Studio frame ───────────────────────────────────────────────────────────
function Studio({ appState, port, preview, onClearPreview, onSelectSlot, reduced }: any) {
  const [view, setView] = useState<CamView>('three');
  const [zone, setZone] = useState<string | null>(null);
  const [webgl] = useState(hasWebGL);
  const mobile = useMemo(() => window.matchMedia('(max-width: 768px)').matches, []);
  const contracts = Object.fromEntries(port.map((p: any) => [p.key, p.contract]));
  const kit = contracts.kit;
  const selectZone = (z: string | null) => { setZone(z); if (z && ZONE_SLOT[z]) onSelectSlot(ZONE_SLOT[z]); };
  return (
    <section className="cm-panel cm-studio" aria-labelledby="cm-studio-title">
      <div className="cm-studio-head">
        <h2 id="cm-studio-title" className="cm-panel-title"><span className="cm-code">02</span>Livery studio</h2>
        <div className="cm-views" role="group" aria-label="Camera">
          {(Object.keys(VIEWS) as CamView[]).map(v => <button key={v} type="button" className={`cm-view ${view === v ? 'is-on' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{VIEWS[v].label}</button>)}
        </div>
      </div>
      <div className="cm-stage">
        {webgl ? (
          <Suspense fallback={<div className="cm-stage-msg">Loading car</div>}>
            <LiveryStudio contracts={contracts} preview={preview ? { slotKey: preview.slotKey, name: preview.name } : null} selectedZone={zone} onSelectZone={selectZone} view={view} reduced={reduced} mobile={mobile} />
          </Suspense>
        ) : <div className="cm-stage-msg">The 3D car needs WebGL. Placements are listed in the portfolio.</div>}
        <div className="cm-stage-hint"><Rotate3d size={14} strokeWidth={1.5} />Drag to rotate · scroll to zoom · click a zone</div>
        {preview && (
          <div className="cm-preview-banner" role="status">
            <Eye size={14} strokeWidth={1.5} /><span>Previewing <strong>{preview.name}</strong> on the {slotLabel(preview.slotKey).toLowerCase()} placement. Not signed.</span>
            <button type="button" className="cm-link" onClick={onClearPreview}>Clear</button>
          </div>
        )}
        <div className="cm-kit" title="Kit sponsors appear on team apparel, not the car">
          <Shirt size={16} strokeWidth={1.5} />
          <span><em>Team kit</em><strong>{preview?.slotKey === 'kit' ? `${preview.name} (preview)` : kit ? kit.name : 'Vacant'}</strong></span>
        </div>
        <ul className="cm-legend">
          {port.filter((p: any) => p.key !== 'kit').map((p: any) => (
            <li key={p.key}><button type="button" onClick={() => onSelectSlot(p.key)}><span className={`cm-dot ${p.contract ? 'is-on' : ''}`} />{p.label}<em>{SLOT_ZONES[p.key].map((z: string) => ZONE_LABELS[z]).join(' · ')}</em></button></li>
          ))}
          <li className="cm-legend-off"><span className="cm-dot is-off" />Front wing<em>not a contract slot</em></li>
        </ul>
      </div>
    </section>
  );
}

// ─── Reputation ─────────────────────────────────────────────────────────────
function Reputation({ ov, milestones }: any) {
  const r = 46; const c = 2 * Math.PI * r;
  const rings = [
    { v: ov.reputation, label: 'Reputation', color: '#E10600' },
    { v: ov.happiness, label: 'Relationship', color: '#ededed' },
  ];
  return (
    <section className="cm-panel cm-rep" aria-labelledby="cm-rep-title">
      <div className="cm-panel-head"><h2 id="cm-rep-title" className="cm-panel-title"><span className="cm-code">03</span>Commercial standing</h2></div>
      <div className="cm-rep-top">
        <svg viewBox="0 0 120 120" className="cm-ring" role="img" aria-label={`Reputation ${ov.reputation}, relationship ${ov.happiness}%`}>
          <circle cx="60" cy="60" r={r} className="cm-ring-track" />
          <circle cx="60" cy="60" r={r} stroke="#E10600" className="cm-ring-val" strokeDasharray={c} strokeDashoffset={c * (1 - ov.reputation / 100)} />
          <circle cx="60" cy="60" r={r - 10} className="cm-ring-track" />
          <circle cx="60" cy="60" r={r - 10} stroke="#ededed" className="cm-ring-val" strokeDasharray={2 * Math.PI * (r - 10)} strokeDashoffset={2 * Math.PI * (r - 10) * (1 - ov.happiness / 100)} />
          <text x="60" y="58" textAnchor="middle" className="cm-ring-num">{ov.reputation}</text>
          <text x="60" y="74" textAnchor="middle" className="cm-ring-lbl">reputation</text>
        </svg>
        <dl className="cm-rep-stats">
          {rings.map(x => <div key={x.label}><dt><span style={{ background: x.color }} />{x.label}</dt><dd>{x.v}{x.label === 'Relationship' ? '%' : ''}</dd></div>)}
          <div><dt>Partner relationship avg</dt><dd>{ov.relAvg != null ? `${ov.relAvg}%` : '–'}</dd></div>
          <div><dt>Average brand prestige</dt><dd>{ov.prestigeAvg ?? '–'}</dd></div>
        </dl>
      </div>
      <p className="cm-muted">Relationship sets each new contract's starting relationship, which scales its season-end performance payout. Missed sponsor objectives cost 6 relationship on that contract; achieved ones add 5.</p>
      <p className="cm-kicker" style={{ marginTop: 14 }}>Portfolio milestones</p>
      <ul className="cm-miles">
        {milestones.map((m: any) => (
          <li key={m.id} className={m.done ? 'is-done' : ''}>
            <span className="cm-mile-top"><strong>{m.label}</strong>{m.done ? <Check size={14} strokeWidth={2} /> : <em>{Math.round(m.progress * 100)}%</em>}</span>
            <span className="cm-mile-bar"><span style={{ transform: `scaleX(${m.progress})` }} /></span>
            <em>{m.detail}</em>
          </li>
        ))}
      </ul>
      <p className="cm-muted">Milestones track progress only; the game pays nothing for them.</p>
    </section>
  );
}

// ─── Objectives board ───────────────────────────────────────────────────────
function ObjectivesBoard({ objectives }: any) {
  return (
    <section className="cm-panel cm-objectives" aria-labelledby="cm-obj-title">
      <div className="cm-panel-head"><h2 id="cm-obj-title" className="cm-panel-title"><span className="cm-code">04</span>Sponsor objectives</h2><span className="cm-muted">Judged after each race · reward paid when achieved, penalty when the deadline passes</span></div>
      {objectives.length ? (
        <div className="cm-missions">
          {objectives.map((o: any, i: number) => (
            <article key={i} className={`cm-mission is-${o.state.toLowerCase()}`}>
              <span className="cm-mission-top"><em>{o.sponsor} · {o.slot}</em><b>{o.state}</b></span>
              <strong>{o.label}</strong>
              <span className="cm-mission-figs">
                <span><em>Reward</em><b className="is-pos">+{money(o.reward)}</b></span>
                <span><em>Penalty</em><b className="is-neg">−{money(o.penalty)}</b></span>
                <span><em>Deadline</em><b>R{o.deadline}</b></span>
                <span><em>Difficulty</em><b>{o.difficulty}</b></span>
              </span>
              <span className="cm-mission-bar"><span style={{ transform: `scaleX(${o.state === 'Open' ? Math.max(0.05, 1 - o.roundsLeft / 3) : 1})` }} /></span>
              <em className="cm-mission-foot">{o.state === 'Open' ? (o.roundsLeft ? `${o.roundsLeft} round${o.roundsLeft === 1 ? '' : 's'} to deadline` : 'Due this round') : o.state === 'Achieved' ? 'Reward paid, +5 relationship' : 'Penalty charged, −6 relationship'}</em>
            </article>
          ))}
        </div>
      ) : <p className="cm-empty">No sponsor objectives yet. Each signed sponsor sets two when the deal starts.</p>}
    </section>
  );
}

// ─── Analytics ──────────────────────────────────────────────────────────────
function Analytics({ an, ov }: any) {
  const maxT = Math.max(1, ...an.timeline.map((t: any) => t.sponsor + t.other));
  const maxP = Math.max(1, ...an.byPlacement.map((p: any) => p.perRace));
  const share = an.seasonAll ? an.seasonSponsor / an.seasonAll : null;
  return (
    <section className="cm-panel cm-analytics" aria-labelledby="cm-an-title">
      <div className="cm-panel-head"><h2 id="cm-an-title" className="cm-panel-title"><span className="cm-code">06</span>Financial performance</h2></div>
      <div className="cm-an-grid">
        <div className="cm-an-figs">
          <div><span>Sponsor income this season</span><strong><AnimatedNumber value={an.seasonSponsor} formatter={(v) => money(v)} /></strong></div>
          <div><span>Signing bonuses received</span><strong><AnimatedNumber value={an.bonuses} formatter={(v) => money(v)} /></strong><em>{an.signedCount} brands</em></div>
          <div><span>Share of race income</span><strong>{share != null ? `${Math.round(share * 100)}%` : '–'}</strong><em>{share != null ? 'sponsors vs prize, merch, bonuses' : 'after the first race'}</em></div>
          <div><span>Season-end payout due</span><strong>{money(ov.seasonEndPayout)}</strong><em>at current relationship</em></div>
        </div>
        <div className="cm-an-chart">
          <p className="cm-kicker">Income by race</p>
          {an.timeline.length ? (
            <div className="cm-bars" role="img" aria-label={`Sponsor income by race: ${an.timeline.map((t: any) => `round ${t.round} ${t.sponsor}`).join(', ')}`}>
              {an.timeline.map((t: any) => (
                <span key={t.round} className="cm-bar" title={`Round ${t.round} · sponsors ${money(t.sponsor)} · other ${money(t.other)}`}>
                  <span className="cm-bar-other" style={{ height: `${(t.other / maxT) * 100}%` }} />
                  <span className="cm-bar-sp" style={{ height: `${(t.sponsor / maxT) * 100}%` }} />
                  <em>R{t.round}</em>
                </span>
              ))}
            </div>
          ) : <p className="cm-empty">Race income appears here after the first race of the season.</p>}
          <p className="cm-legend-row"><span className="k-sp" />Sponsor income<span className="k-ot" />Prize, merchandise and bonuses</p>
        </div>
        <div>
          <p className="cm-kicker">Revenue by placement</p>
          {an.byPlacement.length ? (
            <ul className="cm-hbars">
              {an.byPlacement.map((p: any) => (
                <li key={p.key}><span>{p.label}<em>{p.name}</em></span><span className="cm-hbar"><span style={{ transform: `scaleX(${p.perRace / maxP})` }} /></span><b>{money(p.perRace, 2)}</b></li>
              ))}
            </ul>
          ) : <p className="cm-empty">No placements signed.</p>}
          <p className="cm-kicker" style={{ marginTop: 14 }}>Contracts ending</p>
          {an.expiring.length ? (
            <ul className="cm-expiring">{an.expiring.map((p: any) => <li key={p.key}><AlertTriangle size={14} strokeWidth={1.5} />{p.contract.name} · {p.label}<b>{p.roundsLeft ? `${p.roundsLeft} rounds` : 'past term'}</b></li>)}</ul>
          ) : <p className="cm-empty">No deal reaches its term in the next six rounds.</p>}
        </div>
      </div>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function CommercialHQ({ appState, initialMessage, onPersist }: { appState: any; initialMessage: string; onPersist: () => Promise<void> }) {
  const reduced = usePrefersReducedMotion();
  const [, bump] = useState(0);
  const [msg, setMsg] = useState(initialMessage);
  const [kpi, setKpi] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [placement, setPlacement] = useState('');
  const [preview, setPreview] = useState<any>(null);

  const port = getPortfolio(appState);
  const ov = getCommercialOverview(appState);
  const an = getRevenueAnalytics(appState);
  const objectives = getSponsorObjectives(appState);
  const milestones = getMilestones(appState);

  const changed = async (m: string) => { setMsg(m); setPreview(null); bump(x => x + 1); await onPersist(); };
  const findFor = (pl: string) => { setPlacement(pl); requestAnimationFrame(() => document.getElementById('cm-market-title')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })); };
  const onPreview = (o: any) => {
    if (!o) { setPreview(null); return; }
    const slotKey = Object.entries(PLACEMENT_BY_SLOT).find(([, pl]) => pl === o.slot)?.[0];
    setPreview({ id: o.id, name: o.name, slotKey });
    requestAnimationFrame(() => document.getElementById('cm-studio-title')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }));
  };
  const partners = port.filter((p: any) => p.contract).map((p: any) => p.contract.name);

  return (
    <div className="cm-root">
      <div className="cm-head">
        <div>{pageTitle('Sponsors')}{pageSubtitle('Commercial partners, where they run on the car and what they pay')}</div>
        {partners.length > 0 && (
          <div className="cm-marquee" aria-label={`Partners: ${partners.join(', ')}`}>
            <div className={`cm-marquee-track ${reduced ? 'is-still' : ''}`}>{[...partners, ...partners].map((n, i) => <span key={i}>{n}</span>)}</div>
          </div>
        )}
      </div>
      {msg && <div className="cm-flash" role="status">{msg}</div>}

      <Kpis ov={ov} an={an} port={port} open={kpi} setOpen={setKpi} />

      <div className="cm-main">
        <Portfolio port={port} selected={slot} onSelect={setSlot} />
        <Studio appState={appState} port={port} preview={preview} onClearPreview={() => setPreview(null)} onSelectSlot={setSlot} reduced={reduced} />
        <Reputation ov={ov} milestones={milestones} />
      </div>

      <ObjectivesBoard objectives={objectives} />
      <Marketplace appState={appState} placement={placement} setPlacement={setPlacement} previewId={preview?.id} onPreview={onPreview} onChanged={changed} reduced={reduced} />
      <Analytics an={an} ov={ov} />

      <PlacementDialog appState={appState} slotKey={slot} onClose={() => setSlot(null)} onChanged={changed} onFind={findFor} />
    </div>
  );
}
