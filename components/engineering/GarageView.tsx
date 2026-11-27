import React, { Suspense, lazy, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Rotate3d, X, ChevronRight } from 'lucide-react';
import { HUB, btn, btnClass, iconBtn } from '../HubLayout.tsx';
import { AnimatedNumber } from '../ui/motion.tsx';
import { DEVELOPMENT_CATALOG, startProject, getSeasonScaleFactor, getManufacturingCost, estimateLapGain } from '../../utils/devProjects.js';
import { getActiveComponent, COMPONENT_CATALOG } from '../../utils/engineeringSystem.js';
import { getActiveDrivers } from '../../utils/teamState.js';
import { syncGame } from '../../lib/supabaseApi.js';
import { GARAGE_PARTS, SPEC_LABELS, UPGRADED_STATUSES } from './garageParts';
import type { CarPart } from '../../screens/landing/Car';
import './garage.css';

const Garage3D = lazy(() => import('./Garage3D'));

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const money = (v: number) => `$${v.toFixed(1)}M`;
const OUTCOME_LABEL: Record<string, string> = { success: 'Introduced', overperform: 'Beat target', underperform: 'Below target', fail: 'Failed' };

/** Garage tab: the team's car in 3D, each part opens its ratings, development and upgrades. */
export function GarageView({ s, onFlash }: { s: any; onFlash: (msg: string) => void }) {
  const [selected, setSelected] = useState<CarPart | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [, bump] = useState(0);
  const [webgl] = useState(hasWebGL);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const mobile = useMemo(() => window.matchMedia('(max-width: 768px)').matches, []);

  const eng = s.engineering || {};
  const projects: any[] = eng.projects || [];
  const specs: Record<string, number> = eng.carSpecs || {};

  // Which parts show the upgraded spec, and which have work in progress
  const { upgraded, active } = useMemo(() => {
    const up: Partial<Record<CarPart, boolean>> = {};
    const act: Partial<Record<CarPart, number>> = {};
    GARAGE_PARTS.forEach(part => {
      const mine = projects.filter(p => part.items.some(([c, i]) => p.categoryId === c && p.itemId === i));
      if (mine.some(p => UPGRADED_STATUSES.includes(p.status))) up[part.id] = true;
      const n = mine.filter(p => p.status === 'active').length;
      if (n) act[part.id] = n;
    });
    return { upgraded: up, active: act };
  }, [projects, projects.length, projects.map(p => p.status).join()]);

  const part = GARAGE_PARTS.find(p => p.id === selected) || null;
  const scale = getSeasonScaleFactor(s);
  const round = s.season?.round || 1;
  const budget = s.team?.budget || 0;
  const drivers = getActiveDrivers(s.team).slice(0, 2);

  const start = async (cat: string, item: string) => {
    const r = startProject(s, cat, item);
    setConfirming(null);
    if (r.ok) {
      onFlash(`${r.project.label} started, arrives in round ${r.project.completionRound}`);
      bump(x => x + 1);
      await syncGame();
    } else {
      onFlash(r.reason);
    }
  };

  return (
    <div className="gx">
      <div className="gx-stage">
        {webgl ? (
          <Suspense fallback={<div className="gx-loading">Loading car</div>}>
            <Garage3D selected={selected} onSelect={setSelected} upgraded={upgraded} active={active} reduced={reduced} mobile={mobile} />
          </Suspense>
        ) : (
          <div className="gx-loading">3D view needs WebGL. Pick a part from the list.</div>
        )}
        <div className="gx-stage-hint">
          <Rotate3d size={16} strokeWidth={1.5} /> Drag to orbit · select a part
        </div>
        <div className="gx-parts" role="list" aria-label="Car parts">
          {GARAGE_PARTS.map(p => (
            <button key={p.id} role="listitem" className={`gx-chip ${selected === p.id ? 'is-on' : ''}`} onClick={() => setSelected(selected === p.id ? null : p.id)} aria-pressed={selected === p.id}>
              <span className="gx-chip-dot" data-upgraded={upgraded[p.id] ? 'true' : 'false'} data-active={active[p.id] ? 'true' : 'false'} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.aside
          key={selected || 'overview'}
          className="gx-panel"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6, transition: { duration: 0.15 } }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          aria-live="polite"
        >
          {!part ? (
            <>
              <p className="gx-kicker">Garage · Round {round}</p>
              <h3 className="gx-title">Your car</h3>
              <p className="gx-sub">Select a part to see what it does, how it rates and what the factory can bring next. Upgraded parts wear the red-tinted spec.</p>
              <div className="gx-specs">
                {['downforce', 'cornering', 'topSpeed', 'mechanicalGrip', 'reliability'].map(k => (
                  <SpecRow key={k} label={SPEC_LABELS[k]} value={specs[k]} />
                ))}
              </div>
              <div className="gx-summary">
                <div><span>In development</span><strong>{projects.filter(p => p.status === 'active').length}</strong></div>
                <div><span>Introduced</span><strong>{projects.filter(p => UPGRADED_STATUSES.includes(p.status)).length}</strong></div>
                <div><span>Budget</span><strong>{money(budget)}</strong></div>
              </div>
            </>
          ) : (
            <>
              <div className="gx-head">
                <div>
                  <p className="gx-kicker">{upgraded[part.id] ? 'Upgraded spec' : 'Launch spec'}{active[part.id] ? ' · upgrade in development' : ''}</p>
                  <h3 className="gx-title">{part.label}</h3>
                </div>
                <button className={btnClass('ghost')} style={iconBtn('sm')} onClick={() => setSelected(null)} aria-label="Back to the whole car" title="Back to the whole car"><X size={16} strokeWidth={1.5} /></button>
              </div>
              <p className="gx-sub">{part.summary}</p>

              <div className="gx-specs">
                {part.specs.map(k => <SpecRow key={k} label={SPEC_LABELS[k] || k} value={specs[k]} />)}
              </div>

              {part.id === 'powerUnit' && drivers.length > 0 && (
                <div className="gx-block">
                  <p className="gx-label">Component wear</p>
                  {drivers.map((d: any) => (
                    <div key={d.name} className="gx-wear">
                      <span className="gx-wear-name">{d.name.split(' ').pop()}</span>
                      {['ICE', 'TC', 'MGUK', 'GB'].map(c => {
                        const comp = getActiveComponent(s, d.name, c);
                        const wear = Math.round(comp?.wear || 0);
                        return (
                          <span key={c} className="gx-wear-cell" title={`${COMPONENT_CATALOG[c]?.name}: ${wear}% worn`}>
                            <span className="gx-wear-k">{c}</span>
                            <span className="gx-wear-bar"><span style={{ width: `${Math.min(100, wear)}%`, background: wear > 70 ? HUB.negative : wear > 45 ? HUB.warning : HUB.textMuted }} /></span>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              <PartHistory projects={projects.filter(p => part.items.some(([c, i]) => p.categoryId === c && p.itemId === i))} round={round} />

              <div className="gx-block">
                <p className="gx-label">Upgrades</p>
                <div className="gx-upgrades">
                  {part.items.map(([catId, itemId]) => {
                    const item = DEVELOPMENT_CATALOG[catId]?.items?.[itemId];
                    if (!item) return null;
                    const key = `${catId}.${itemId}`;
                    const dev = item.baseCost * scale;
                    const total = dev + getManufacturingCost(item.baseCost, s);
                    const running = projects.some(p => p.categoryId === catId && p.itemId === itemId && p.status === 'active');
                    const afford = budget >= total;
                    return (
                      <div key={key} className="gx-up">
                        <div className="gx-up-head">
                          <strong>{item.label}</strong>
                          <span>{money(total)}</span>
                        </div>
                        <p>{item.description}</p>
                        <div className="gx-up-meta">
                          <span>≈ {estimateLapGain(item.statBonuses)}s per lap</span>
                          <span>{Math.max(1, Math.round(item.baseRaces * scale))} races</span>
                          <span>{item.baseConfidence}% base confidence</span>
                          <span className={item.risk === 'High' ? 'is-risk' : ''}>{item.risk} risk</span>
                        </div>
                        {running ? (
                          <button className={btnClass('secondary')} style={btn('secondary', 'sm', { width: '100%' })} disabled>In development</button>
                        ) : confirming === key ? (
                          <div className="gx-confirm">
                            <button className={btnClass('primary')} style={btn('primary', 'sm', { flex: 1 })} onClick={() => start(catId, itemId)} disabled={!afford}>Spend {money(total)}</button>
                            <button className={btnClass('secondary')} style={btn('secondary', 'sm')} onClick={() => setConfirming(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button className={btnClass('secondary')} style={btn('secondary', 'sm', { width: '100%' })} onClick={() => setConfirming(key)} disabled={!afford}>
                            {afford ? <>Start upgrade <ChevronRight size={14} strokeWidth={1.5} /></> : `Needs ${money(total)}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value?: number }) {
  const v = typeof value === 'number' ? value : 0;
  return (
    <div className="gx-spec">
      <span>{label}</span>
      <span className="gx-spec-bar"><span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></span>
      <strong><AnimatedNumber value={v} /></strong>
    </div>
  );
}

function PartHistory({ projects, round }: { projects: any[]; round: number }) {
  if (!projects.length) return null;
  return (
    <div className="gx-block">
      <p className="gx-label">On this part</p>
      {projects.slice(-4).reverse().map(p => {
        const done = p.status !== 'active';
        const total = Math.max(1, (p.completionRound || round) - (p.startRound || round));
        const progress = done ? 1 : Math.min(1, Math.max(0, (round - (p.startRound || round)) / total));
        return (
          <div key={p.id} className="gx-hist">
            <div className="gx-hist-head">
              <span>{p.label}</span>
              <span className={p.status === 'fail' ? 'is-risk' : ''}>{done ? OUTCOME_LABEL[p.status] || p.status : `Round ${p.completionRound}`}</span>
            </div>
            {!done && <span className="gx-hist-bar"><span style={{ transform: `scaleX(${progress})` }} /></span>}
          </div>
        );
      })}
    </div>
  );
}
