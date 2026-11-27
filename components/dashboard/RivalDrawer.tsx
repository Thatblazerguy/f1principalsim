import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { HUB, btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { EASE, Tween } from './chartKit.tsx';

type Profile = any; // shape: utils/dashboardModel.js getTeamProfile()

/** Side drawer: player vs one rival, real tracked fields only. */
export function RivalDrawer({ you, rival, onClose }: { you: Profile | null; rival: Profile | null; onClose: () => void }) {
  const open = Boolean(you && rival);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useDialogFocus(open, panelRef, onClose, closeRef);

  return createPortal(
    <AnimatePresence>
      {open && you && rival && (
        <div className="dbx-drawer-root" key="rival">
          <motion.div className="dbx-overlay" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25, ease: EASE }} />
          <motion.div ref={panelRef} className="dbx-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32 }}
            transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}>
            <header className="dbx-drawer-head">
              <div style={{ minWidth: 0 }}>
                <span className="dbx-k">Head to head</span>
                <h2 id={titleId} className="dbx-drawer-title">
                  <span style={{ color: HUB.textPrimary }}>{you.name}</span>
                  <span className="dbx-vs">vs</span>
                  <span>{rival.name}</span>
                </h2>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close head to head" className={btnClass('ghost')} style={iconBtn('sm')}>
                <X size={16} strokeWidth={1.5} />
              </button>
            </header>

            <div className="dbx-drawer-body">
              <Stagger i={0}>
                <Section title="Championship">
                  <CompareRow label="Position" a={you.position} b={rival.position} lowerIsBetter format={v => `P${Math.round(v)}`} />
                  <CompareRow label="Points" a={you.points} b={rival.points} />
                  <CompareRow label="Wins" a={you.wins} b={rival.wins} />
                  <CompareRow label="Podiums" a={you.podiums} b={rival.podiums} />
                  <p className="dbx-note">Wins and podiums count every car's result this season ({you.races} race{you.races === 1 ? '' : 's'}).</p>
                </Section>
              </Stagger>

              <Stagger i={1}>
                <Section title="Car">
                  <CompareRow label="Overall" a={you.car.overall} b={rival.car.overall} bar />
                  <CompareRow label="Aero" a={you.car.aero} b={rival.car.aero} bar />
                  <CompareRow label="Chassis" a={you.car.chassis} b={rival.car.chassis} bar />
                  <CompareRow label="Reliability" a={you.car.reliability} b={rival.car.reliability} bar />
                  {(you.powerUnit || rival.powerUnit) && (
                    <div className="dbx-cmp dbx-cmp-text">
                      <span>{you.powerUnit || '—'}</span><span className="dbx-cmp-label">Power unit</span><span>{rival.powerUnit || '—'}</span>
                    </div>
                  )}
                </Section>
              </Stagger>

              <Stagger i={2}>
                <Section title="Driver pairing">
                  <div className="dbx-pair">
                    {[you, rival].map((p, side) => (
                      <div key={p.name} className={`dbx-pair-col${side === 0 ? ' is-you' : ''}`}>
                        <span className="dbx-pair-team">{p.name}</span>
                        {p.drivers.length === 0 && <p className="dbx-note">No race drivers</p>}
                        {p.drivers.map((d: any) => (
                          <div key={d.name} className="dbx-driver">
                            <span className="dbx-driver-name">{d.name}</span>
                            <span className="dbx-driver-meta">
                              <span title="Average of pace, qualifying, racecraft and consistency">{d.rating} rating</span>
                              <span>{d.points} pts</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Section>
              </Stagger>

              <Stagger i={3}>
                <Section title="Recent form">
                  {you.form.length === 0 && rival.form.length === 0
                    ? <p className="dbx-note">Form appears after the first race.</p>
                    : [you, rival].map((p, side) => (
                      <div key={p.name} className="dbx-form-row">
                        <span className="dbx-form-name" style={{ color: side === 0 ? HUB.textPrimary : HUB.textMuted }}>{p.name}</span>
                        <div className="dbx-form-chips">
                          {p.form.map((f: any) => (
                            <span key={f.round} className={`dbx-chip${f.bestPos <= 3 ? ' is-podium' : ''}${side === 0 ? ' is-you' : ''}`}
                              title={`Round ${f.round} · ${f.name}: best finish P${f.bestPos}, ${f.points} pts`}>
                              P{f.bestPos}
                              <small>{f.points}</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  <p className="dbx-note">Best finisher per race, last five rounds, with team points scored.</p>
                </Section>
              </Stagger>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Stagger({ i, children }: { i: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: 0.12 + i * 0.05 }}>
      {children}
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dbx-section">
      <h3 className="dbx-section-title">{title}</h3>
      {children}
    </section>
  );
}

function CompareRow({ label, a, b, lowerIsBetter = false, bar = false, format }: { label: string; a: number; b: number; lowerIsBetter?: boolean; bar?: boolean; format?: (v: number) => string }) {
  const aWins = lowerIsBetter ? a < b : a > b;
  const bWins = lowerIsBetter ? b < a : b > a;
  const max = Math.max(a, b, 1);
  return (
    <div className="dbx-cmp">
      <span className={`dbx-cmp-val${aWins ? ' is-ahead' : ''}`}><Tween value={a} from={lowerIsBetter ? undefined : 0} format={format} /></span>
      <span className="dbx-cmp-label">
        {label}
        {bar && (
          <span className="dbx-cmp-bars" aria-hidden>
            <span className="dbx-cmp-bar is-you"><i style={{ width: `${(a / max) * 100}%` }} /></span>
            <span className="dbx-cmp-bar"><i style={{ width: `${(b / max) * 100}%` }} /></span>
          </span>
        )}
      </span>
      <span className={`dbx-cmp-val${bWins ? ' is-ahead' : ''}`}><Tween value={b} from={lowerIsBetter ? undefined : 0} format={format} /></span>
    </div>
  );
}
