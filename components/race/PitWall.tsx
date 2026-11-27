import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Check, ChevronsRight, ChevronsLeft, Swords, AlertTriangle, Radio, Wrench, Minus, Plus, X } from 'lucide-react';
import {
  carCode, lastName, fmtGap, gapBetween, tyreOutlook, stintTimeline, DRIVE_MODES, PIT_LOSS_BASE, pairTrend,
} from '../../utils/raceControlModel.js';
import { ERS_DELTA } from '../../game/paceModel.js';
import { TyreBadge } from './RaceParts.tsx';

const PACE = ['Attack', 'Push', 'Balanced', 'Conserve', 'Defend'];
const FUEL = ['Rich', 'Standard', 'Lean'];
const ERS = ['Overtake', 'Deploy', 'Balanced', 'Harvest'];
const FUEL_FX: Record<string, string> = { Rich: '−0.10s a lap, burns 20% more', Standard: 'Baseline burn', Lean: '+0.15s a lap, burns 20% less' };
const ERS_FX: Record<string, string> = { Overtake: 'Drains 25% a lap', Deploy: 'Drains 15% a lap', Balanced: 'Battery neutral', Harvest: 'Recharges 15% a lap' };
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(2)}s`;
const paceFx = (m: string) => `${signed(DRIVE_MODES[m].delta)} a lap · tyre wear ×${DRIVE_MODES[m].wear}`;
const tyreKey = (c: string) => (c === 'Intermediate' ? 'inter' : String(c || '').toLowerCase());

function Segmented({ label, options, value, onPick, describe, disabled }: any) {
  return (
    <div className="rc-ctl">
      <div className="rc-ctl-head"><span>{label}</span><em>{describe(value)}</em></div>
      <div className="rc-seg is-fill" role="radiogroup" aria-label={label}>
        {options.map((o: string) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'is-on' : ''} onClick={() => onPick(o)} disabled={disabled} title={describe(o)}>
            {value === o && <motion.span layoutId={`rc-ctl-${label}`} className="rc-seg-on" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
            <span>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Meter({ label, value, max = 100, text, tone }: any) {
  return (
    <div className="rc-meter">
      <div className="rc-meter-head"><span>{label}</span><strong className="rc-num">{text}</strong></div>
      <div className="rc-meter-bar"><motion.span className={tone ? `is-${tone}` : ''} animate={{ scaleX: Math.max(0, Math.min(1, value / max)) }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} /></div>
    </div>
  );
}

const Trend = ({ v, goodWhenNeg }: { v: number | null; goodWhenNeg: boolean }) => {
  if (v == null || Math.abs(v) < 0.05) return <span className="rc-trend">steady</span>;
  const good = goodWhenNeg ? v < 0 : v > 0;
  return <span className={`rc-trend ${good ? 'is-up' : 'is-down'}`}>{v > 0 ? <ArrowUp size={10} strokeWidth={2} /> : <ArrowDown size={10} strokeWidth={2} />}{Math.abs(v).toFixed(2)}s/lap</span>;
};

function statusOf(car: any, total: number) {
  if (car.retired) return { id: 'out', label: car.dnfReason || 'Retired' };
  if (car.distance >= total) return { id: 'done', label: 'Finished' };
  if (car.pitStopStatus === 'Pitting') return { id: 'pit', label: 'In the pit lane' };
  if (car.pitStopStatus === 'InLap') return { id: 'box', label: `Boxing for ${car.nextTire || 'tyres'}` };
  if (car.pitStopStatus === 'OutLap') return { id: 'run', label: 'Out lap' };
  return { id: 'run', label: 'Racing' };
}

/** A stop or pit-window call that needs the player now. */
function pitAlert(car: any, b: any) {
  if (!b || car.retired || car.pitStopStatus !== 'None') return null;
  const call = b.calls?.find((c: any) => ['box', 'undercut', 'cover', 'model-box'].includes(c.id));
  if (call) return { title: call.title, detail: call.detail, compound: call.command?.value, urgent: true };
  if (b.pitPlan?.action === 'window' && b.pitPlan.inLaps <= 2) {
    return { title: `Pit window: box in ${b.pitPlan.inLaps} ${b.pitPlan.inLaps === 1 ? 'lap' : 'laps'}`, detail: `Plan is lap ${b.pitPlan.onLap} for ${b.pitPlan.compound}.`, compound: b.pitPlan.compound, urgent: false };
  }
  return null;
}

export function PitWall({ engine, engineer, rows, battles, history, focusId, setFocusId, onCommand, onSchedule, collapsed, onCollapse, onTelemetry }: any) {
  // Fixed order (team seat order), so the cards don't swap when our drivers swap places
  const ours = engine.cars.filter((c: any) => c.isPlayer).sort((a: any, b: any) => a.team.drivers.indexOf(a.driver) - b.team.drivers.indexOf(b.driver) || a.gridPos - b.gridPos);
  const [tab, setTab] = useState<'race' | 'strategy' | 'radio'>('race');
  const [sent, setSent] = useState<{ key: string; t: number } | null>(null);
  useEffect(() => { if (!sent) return; const id = setTimeout(() => setSent(null), 1400); return () => clearTimeout(id); }, [sent]);

  if (ours.length === 0) return <aside className="rc-wall"><p className="rc-empty">None of our cars are in this race</p></aside>;
  if (collapsed) {
    return (
      <aside className="rc-wall is-collapsed" aria-label="Pit wall (collapsed)">
        <button type="button" className="rc-icon" onClick={onCollapse} aria-label="Show pit wall" title="Show pit wall"><ChevronsLeft size={16} strokeWidth={1.5} /></button>
        {ours.map((c: any) => { const r = rows.find((x: any) => x.id === c.id); return <span key={c.id} className="rc-wall-mini" style={{ ['--tc' as any]: r?.color }}>{r?.code}<em>P{r?.pos}</em></span>; })}
      </aside>
    );
  }

  const car = ours.find((c: any) => c.id === focusId) || ours[0];
  const row = rows.find((r: any) => r.id === car.id);
  const b = engineer?.getBriefing(car.id);
  const ack = (key: string) => setSent({ key, t: Date.now() });
  const send = (cmd: string, val?: string) => { onCommand(car.id, cmd, val); ack(`${cmd}:${val ?? ''}`); };
  const active = !car.retired && car.distance < engine.totalLaps;
  const battle = battles.find((x: any) => x.cars.some((c: any) => c.id === car.id));
  const alert = pitAlert(car, b);

  return (
    <aside className="rc-wall" aria-label="Pit wall">
      <div className="rc-panel-head">
        <h2>Pit wall</h2>
        <button type="button" className="rc-icon" onClick={onCollapse} aria-label="Hide pit wall" title="Hide pit wall"><ChevronsRight size={16} strokeWidth={1.5} /></button>
      </div>

      <div className="rc-wall-drivers" role="tablist" aria-label="Our drivers">
        {ours.map((c: any) => {
          const r = rows.find((x: any) => x.id === c.id); const st = statusOf(c, engine.totalLaps);
          const inFight = battles.some((x: any) => x.cars.some((y: any) => y.id === c.id));
          const al = pitAlert(c, engineer?.getBriefing(c.id));
          return (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === car.id} className={`rc-dcard ${c.id === car.id ? 'is-on' : ''} is-${st.id}`} style={{ ['--tc' as any]: r?.color }} onClick={() => setFocusId(c.id)}>
              <span className="rc-dcard-top"><strong>{carCode(c.driver.name)}</strong><span className="rc-dcard-pos rc-num">P{r?.pos}</span></span>
              <span className="rc-dcard-name">{c.driver.name}</span>
              <span className="rc-dcard-meta">
                <TyreBadge compound={c.tireCompound} age={c.tyreAge} />
                <span className={`rc-num ${r?.change > 0 ? 'is-up' : r?.change < 0 ? 'is-down' : ''}`}>{r?.change > 0 ? `+${r.change}` : r?.change < 0 ? r.change : '±0'}</span>
                {inFight && <Swords size={12} strokeWidth={1.75} aria-label="In a battle" />}
                {al && <AlertTriangle size={12} strokeWidth={1.75} className="rc-warnic" aria-label="Pit call" />}
              </span>
              <span className={`rc-dcard-status is-${st.id}`}><i />{st.label}{c.autoEngineer ? ' · Auto' : ''}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {alert && active && (
          <motion.div className={`rc-alert ${alert.urgent ? 'is-urgent' : ''}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
            <div><strong>{alert.title}</strong><em>{alert.detail}</em></div>
            {alert.compound && <button type="button" className="rc-btn is-primary" onClick={() => send('PIT', alert.compound)}>Box this lap</button>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rc-tabs" role="tablist" aria-label="Pit wall sections">
        {[{ id: 'race', label: 'Race' }, { id: 'strategy', label: 'Pit strategy' }, { id: 'radio', label: 'Radio' }].map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id as any)}>
            {tab === t.id && <motion.span layoutId="rc-wall-tab" className="rc-tab-on" transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} />}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${car.id}-${tab}`} className="rc-wall-body" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
          {tab === 'race' && <RaceTab {...{ engine, engineer, car, row, b, battle, history, send, ack, sent, active, onTelemetry }} />}
          {tab === 'strategy' && <StrategyTab {...{ engine, car, b, send, sent, active, onSchedule }} />}
          {tab === 'radio' && <RadioTab engine={engine} car={car} />}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function RaceTab({ engine, engineer, car, row, b, battle, history, send, ack, sent, active, onTelemetry }: any) {
  const i = engine.cars.indexOf(car);
  const ahead = engine.cars.slice(0, i).reverse().find((c: any) => !c.retired);
  const behind = engine.cars.slice(i + 1).find((c: any) => !c.retired);
  const gA = ahead && !car.retired ? gapBetween(engine, ahead, car) : null;
  const gB = behind && !car.retired ? gapBetween(engine, car, behind) : null;
  const tA = ahead ? pairTrend(history, ahead.id, car.id) : null;
  const tB = behind ? pairTrend(history, car.id, behind.id) : null;
  const statusTone = b?.status === 'On target' ? 'pos' : b?.status === 'At risk' ? 'warn' : 'neg';
  const wear = Math.round(car.tireWear);
  const fuelMargin = b?.fuel?.marginKg;

  return (
    <>
      <div className="rc-pos-block">
        <div><span className="rc-big rc-num">P{row?.pos}</span><em>from P{car.gridPos + 1} on the grid</em></div>
        {b && !b.retired && <div className="rc-target"><span className={`rc-dot is-${statusTone}`} />{b.status}<em>Projected P{b.projected} · target P{b.target}</em></div>}
        <button type="button" className="rc-link" onClick={() => onTelemetry(car.id)}>Telemetry</button>
      </div>

      <div className="rc-gaps">
        <div><span>Ahead{ahead ? ` · ${carCode(ahead.driver.name)}` : ''}</span><strong className="rc-num">{ahead ? fmtGap(gA) : 'Leading'}</strong>{ahead && <Trend v={tA} goodWhenNeg />}</div>
        <div><span>Behind{behind ? ` · ${carCode(behind.driver.name)}` : ''}</span><strong className="rc-num">{behind ? fmtGap(gB) : '–'}</strong>{behind && <Trend v={tB} goodWhenNeg={false} />}</div>
      </div>

      {battle && active && (
        <div className="rc-fight">
          <Swords size={14} strokeWidth={1.5} />
          <div><strong>{battle.label}</strong><em>{battle.cars.map((c: any) => c.code).join(' · ')} · {battle.gap.toFixed(1)}s{battle.drs ? ' · DRS range' : ''}{battle.trend != null ? ` · ${battle.trend < 0 ? 'closing' : 'easing'} ${Math.abs(battle.trend).toFixed(2)}s/lap` : ''}</em></div>
        </div>
      )}

      <div className="rc-meters">
        <Meter label={<><TyreBadge compound={car.tireCompound} age={car.tyreAge} />Tyre wear</>} value={wear} text={`${wear}%`} tone={wear > 85 ? 'neg' : wear > 65 ? 'warn' : `t-${tyreKey(car.tireCompound)}`} />
        <Meter label="Fuel" value={car.fuel} max={110} text={`${car.fuel.toFixed(1)} kg${fuelMargin != null ? ` · ${fuelMargin >= 0 ? '+' : '−'}${Math.abs(fuelMargin).toFixed(1)} at flag` : ''}`} tone={fuelMargin != null && fuelMargin < 0.5 ? 'neg' : undefined} />
        <Meter label="ERS battery" value={car.ers} text={`${Math.round(car.ers)}%`} tone={car.ers < 15 ? 'warn' : 'ers'} />
        <Meter label="Engine temperature" value={car.engineTemp - 70} max={60} text={`${Math.round(car.engineTemp)}°C`} tone={car.engineTemp > 115 ? 'neg' : car.engineTemp > 108 ? 'warn' : undefined} />
      </div>

      {active ? (
        <div className="rc-ctls">
          <div className="rc-ctls-head">
            <span>Driver instructions{sent && <motion.em key={sent.t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rc-sent"><Check size={12} strokeWidth={2} />Sent to car</motion.em>}</span>
            <button type="button" role="switch" aria-checked={!!car.autoEngineer} className={`rc-switch ${car.autoEngineer ? 'is-on' : ''}`} onClick={() => engineer?.setAuto(car.id, !car.autoEngineer)}>
              Engineer auto<i><b /></i>
            </button>
          </div>
          <Segmented label="Pace" options={PACE} value={car.driverMode} onPick={(v: string) => send('MODE', v)} describe={paceFx} />
          <Segmented label="Fuel mix" options={FUEL} value={car.fuelMode} onPick={(v: string) => send('FUEL', v)} describe={(v: string) => FUEL_FX[v]} />
          <Segmented label="ERS" options={ERS} value={car.ersMode} onPick={(v: string) => send('ERS', v)} describe={(v: string) => `${signed(ERS_DELTA[v] || 0)} a lap · ${ERS_FX[v]}`} />
          <p className="rc-hint">Tyre management runs through pace: Conserve wears tyres at ×0.65, Attack at ×1.8. A manual change takes this car off engineer auto.</p>
        </div>
      ) : (
        <p className="rc-empty">{car.retired ? `${car.driver.name} is out of the race: ${car.dnfReason || 'retired'}.` : `${car.driver.name} has taken the flag in P${row?.pos}.`}</p>
      )}

      {active && b?.calls?.length > 0 && (
        <div className="rc-calls">
          <h3>Engineer calls</h3>
          {b.calls.slice(0, 3).map((c: any) => (
            <div key={c.id} className={`rc-call ${c.priority <= 1 ? 'is-hi' : ''}`}>
              <div><strong>{c.title}</strong><em>{c.detail}</em></div>
              {c.command && !car.autoEngineer && <button type="button" className={`rc-btn ${c.priority <= 1 ? 'is-primary' : ''}`} onClick={() => { engineer.apply(car.id, c); ack(c.id); }}>{c.actionLabel || 'Apply'}</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function StintBar({ tl }: { tl: any }) {
  const pct = (lap: number) => `${Math.max(0, Math.min(100, ((lap - 1) / tl.total) * 100))}%`;
  return (
    <div className="rc-stints">
      <div className="rc-stints-track">
        {tl.stints.map((s: any, i: number) => (
          <span key={i} className={`rc-stint is-${tyreKey(s.compound)} ${s.current ? 'is-cur' : ''}`} style={{ left: pct(s.start), width: `calc(${pct(s.end + 1)} - ${pct(s.start)})` }} title={`${s.compound}, laps ${s.start}–${s.end}`}>
            <b>{s.compound.charAt(0)}</b>
          </span>
        ))}
        {tl.next?.compound && (
          <span className={`rc-stint is-plan is-${tyreKey(tl.next.compound)}`} style={{ left: pct(tl.next.onLap + 1), right: 0 }} title={`${tl.next.confirmed ? 'Planned' : 'Recommended'}: ${tl.next.compound} from lap ${tl.next.onLap + 1}`}>
            <b>{tl.next.compound.charAt(0)}</b>
          </span>
        )}
        {tl.next && <i className={`rc-stints-box ${tl.next.confirmed ? 'is-set' : ''}`} style={{ left: pct(tl.next.onLap + 0.5) }} title={`Box on lap ${tl.next.onLap}`} />}
        <i className="rc-stints-now" style={{ left: pct(tl.done + 1) }} />
      </div>
      <div className="rc-stints-axis rc-num"><span>Lap 1</span><span>{Math.round(tl.total / 2)}</span><span>{tl.total}</span></div>
    </div>
  );
}

function StrategyTab({ engine, car, b, send, active, onSchedule }: any) {
  const allowed = engine.isWet ? ['Intermediate', 'Wet', 'Soft', 'Medium', 'Hard'] : ['Soft', 'Medium', 'Hard', 'Intermediate', 'Wet'];
  const recommended = b?.pitPlan?.compound || (engine.isWet ? 'Intermediate' : car.tireCompound === 'Hard' ? 'Medium' : 'Hard');
  const [compound, setCompound] = useState<string>(car.scheduledStop?.compound || recommended);
  const done = car.lapTimes.length;
  const [onLap, setOnLap] = useState<number>(car.scheduledStop?.lap || b?.pitPlan?.onLap || Math.min(engine.totalLaps - 1, done + 2));
  const tl = stintTimeline(car, engine.totalLaps, b);
  const out = tyreOutlook(car, engine.totalLaps);
  const plan = b?.pitPlan;
  const cur = car.stints[car.stints.length - 1];
  const sm = b?.strategyModel;
  const minLap = done + 1; const maxLap = engine.totalLaps - 1;

  const windowText = !plan ? '–' : plan.action === 'box' ? 'Box this lap' : plan.action === 'window' ? `Lap ${plan.onLap} · in ${plan.inLaps} ${plan.inLaps === 1 ? 'lap' : 'laps'}` : 'No stop needed';

  return (
    <>
      <StintBar tl={tl} />
      <dl className="rc-facts">
        <div><dt>Current stint</dt><dd><TyreBadge compound={car.tireCompound} />from lap {cur.startLap} · {Math.max(0, done - cur.startLap + 1)} laps</dd></div>
        <div><dt>Tyre wear</dt><dd className="rc-num">{Math.round(car.tireWear)}%</dd></div>
        <div><dt>Predicted life</dt><dd>{out.lapsToCliff > 0.5 ? `~${Math.ceil(out.lapsToCliff)} laps to the cliff at this pace` : 'Past the cliff'}</dd></div>
        <div><dt>Degradation</dt><dd>{b?.tyre?.lossVsNew > 0.05 ? `+${b.tyre.lossVsNew.toFixed(2)}s a lap vs a new set` : 'Tyres still fresh'}</dd></div>
        <div><dt>Pit window</dt><dd>{windowText}</dd></div>
        <div><dt>Next compound</dt><dd>{plan?.compound ? <><TyreBadge compound={plan.compound} />{plan.compound}{plan.mustStop ? ' · second compound still owed' : ''}</> : '–'}</dd></div>
        <div><dt>Stops made</dt><dd className="rc-num">{car.stops}</dd></div>
        <div><dt>Time lost in the pits</dt><dd className="rc-num">{PIT_LOSS_BASE.toFixed(1)}–{(PIT_LOSS_BASE + 1.5).toFixed(1)}s{b?.rejoin ? ` · rejoin ~P${b.rejoin.position}${b.rejoin.behindCar ? ` behind ${lastName(b.rejoin.behindCar)}` : ''}` : ''}</dd></div>
      </dl>

      {active && (
        <div className="rc-pitbox">
          <div className="rc-ctl-head"><span>Compound to fit</span><em>{compound === recommended ? 'Recommended' : `Engineer suggests ${recommended}`}</em></div>
          <div className="rc-seg is-fill" role="radiogroup" aria-label="Compound to fit">
            {allowed.map(c => (
              <button key={c} type="button" role="radio" aria-checked={compound === c} className={compound === c ? 'is-on' : ''} onClick={() => setCompound(c)} disabled={car.pitStopStatus === 'Pitting'}>
                <i className={`rc-tyre-dot is-${tyreKey(c)}`}>{c.charAt(0)}</i><span>{c === 'Intermediate' ? 'Inter' : c}</span>
              </button>
            ))}
          </div>

          {car.pitStopStatus === 'InLap' ? (
            <div className="rc-boxing">
              <span><Wrench size={15} strokeWidth={1.5} />Boxing this lap for {car.nextTire}</span>
              <button type="button" className="rc-btn" onClick={() => send('CANCEL_PIT')}><X size={14} strokeWidth={1.5} />Stay out</button>
            </div>
          ) : car.pitStopStatus === 'Pitting' ? (
            <div className="rc-boxing"><span><Wrench size={15} strokeWidth={1.5} />Stop in progress</span></div>
          ) : (
            <button type="button" className="rc-btn is-primary is-box" onClick={() => send('PIT', compound)}>Box this lap<span>{compound}</span></button>
          )}

          {car.pitStopStatus === 'None' && (
            <div className="rc-sched">
              {car.scheduledStop ? (
                <>
                  <span>Planned stop on lap <strong className="rc-num">{car.scheduledStop.lap}</strong> for {car.scheduledStop.compound}</span>
                  <button type="button" className="rc-btn" onClick={() => onSchedule(car.id, null)}>Cancel plan</button>
                </>
              ) : (
                <>
                  <span>Or plan the stop for lap</span>
                  <div className="rc-stepper">
                    <button type="button" className="rc-icon" onClick={() => setOnLap(l => Math.max(minLap, l - 1))} aria-label="Earlier lap"><Minus size={13} strokeWidth={1.5} /></button>
                    <strong className="rc-num">{Math.max(minLap, Math.min(maxLap, onLap))}</strong>
                    <button type="button" className="rc-icon" onClick={() => setOnLap(l => Math.min(maxLap, l + 1))} aria-label="Later lap"><Plus size={13} strokeWidth={1.5} /></button>
                  </div>
                  <button type="button" className="rc-btn" onClick={() => onSchedule(car.id, { lap: Math.max(minLap, Math.min(maxLap, onLap)), compound })} disabled={minLap > maxLap}>Set plan</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {sm && active && (
        <div className="rc-model">
          <h3>Strategy model<em>{sm.agreesWithPlanner ? 'Agrees with the planner' : `Beats the planner by ${sm.gainVsPlanner.toFixed(1)} places`}</em></h3>
          {sm.options.slice(0, 4).map((o: any, i: number) => (
            <div key={o.id} className={`rc-model-row ${i === 0 ? 'is-best' : ''}`}>
              <span>{o.label}{sm.plannerPick?.id === o.id && <em>planner</em>}</span>
              <strong className="rc-num" title={`±${o.uncertainty.toFixed(1)} places`}>P{o.expectedPos.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RadioTab({ engine, car }: any) {
  const name = car.driver.name; const last = lastName(name);
  const msgs = engine.comms.filter((m: any) => m.sender === name || String(m.msg).startsWith(last) || m.sender === 'Engineer' && !engine.cars.some((c: any) => c.isPlayer && c.id !== car.id && String(m.msg).startsWith(lastName(c.driver.name)))).slice(0, 40);
  return (
    <ol className="rc-radio">
      {msgs.length === 0 && <li className="rc-empty">Quiet on the radio</li>}
      {msgs.map((m: any, i: number) => (
        <li key={`${m.time}-${i}`} className={m.sender === 'Engineer' ? 'is-eng' : 'is-drv'}>
          <span className="rc-radio-who"><Radio size={11} strokeWidth={1.5} />{m.sender === 'Engineer' ? 'Engineer' : last}<em className="rc-num">{Math.floor(m.time / 60)}:{String(Math.floor(m.time % 60)).padStart(2, '0')}</em></span>
          <p>{m.msg}</p>
        </li>
      ))}
    </ol>
  );
}
