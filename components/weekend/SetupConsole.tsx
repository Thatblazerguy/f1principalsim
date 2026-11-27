import React, { useMemo, useState } from 'react';
import { Lock, Play, Radio, Sparkles, FlaskConical, Check, CornerDownLeft } from 'lucide-react';
import { HUB, btn, btnClass } from '../HubLayout.tsx';
import { SETUP_PARAMS } from '../../game/setup/carSetup.js';
import {
  ensureWeekendSetup, setWeekendSetup, getRecommendation, predictForSetup,
  getSuggestedTestSetup, runPracticeTest, getRunsRemaining, getPracticeBudget, getResidual,
} from '../../game/setup/setupLab.js';

/*
 * Car setup as engineering controls. Sliders edit a draft; "Apply setup"
 * writes it to the weekend setup sheet (setupLab.setWeekendSetup), which is
 * what practice runs, qualifying and the race use. The target band is the
 * setup model's best guess ± its own uncertainty, so it narrows as test runs
 * teach the model this circuit. The true ideal stays hidden, as in the game.
 */

const EFFECT: Record<string, [string, string]> = {
  frontWing: ['Less front grip, more stable rear', 'Sharper turn-in, nervous rear on entry'],
  rearWing: ['Faster on straights, loose in fast corners', 'Planted in fast corners, slower on straights'],
  rideHeight: ['More floor downforce, risk of bottoming', 'Rides bumps and kerbs, floor works less'],
  suspension: ['Rides kerbs, rolls in quick changes', 'Sharp response, skips over kerbs'],
  brakeBias: ['Rear locking under heavy braking', 'Front locking, stable on entry'],
  differential: ['Gentle on tyres, weaker traction', 'Strong traction, pushes on entry and eats rears'],
};

const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}s`;
const sentence = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

export function SetupConsole({ appState, track, drivers, locked, onSetupChanged }: {
  appState: any; track: any; drivers: any[]; locked: boolean; onSetupChanged: (message?: string) => void;
}) {
  const team = appState.team;
  const weekend = ensureWeekendSetup(appState, team, track);
  const [draft, setDraft] = useState<Record<string, number>>({ ...weekend.setup });
  const [driverName, setDriverName] = useState<string>(drivers[0]?.name || '');
  const [version, setVersion] = useState(0);
  const isLocked = locked || weekend.locked;

  const budget = getPracticeBudget(appState);
  const runsLeft = getRunsRemaining(appState);
  const residual = getResidual(appState, weekend.circuitId);
  const rec = useMemo(() => getRecommendation(appState, team, track), [version]);
  const pred = useMemo(() => predictForSetup(appState, team, track, draft), [draft, version]);
  const applied = useMemo(() => predictForSetup(appState, team, track, weekend.setup), [weekend.setup, version]);
  const dirty = SETUP_PARAMS.some(p => draft[p.key] !== weekend.setup[p.key]);
  const band = Math.round(Math.min(18, Math.max(4, 4 + rec.std * 70)));

  const apply = (next: Record<string, number>, source: string, message?: string) => {
    if (setWeekendSetup(appState, next, source)) { setDraft({ ...next }); setVersion(v => v + 1); onSetupChanged(message); }
  };
  const runTest = () => {
    if (dirty) apply(draft, 'manual');
    const driver = drivers.find(d => d.name === driverName) || drivers[0];
    const res = runPracticeTest(appState, team, track, driver);
    if (!res.ok || !res.run) { onSetupChanged(res.reason); return; }
    setVersion(v => v + 1);
    onSetupChanged(`Test run ${res.run.n} complete: ${fmt(res.run.observed)} against a predicted ${fmt(res.run.predicted)}. Track correlation updated.`);
  };

  return (
    <section className="wk-col wk-setup" aria-labelledby="wk-setup-title">
      <div className="wk-col-head">
        <h2 id="wk-setup-title" className="wk-panel-title"><span className="wk-code">01</span>Car setup</h2>
        {isLocked
          ? <span className="wk-state is-warn"><Lock size={12} strokeWidth={1.75} />Parc fermé</span>
          : dirty ? <span className="wk-state is-warn">Unapplied changes</span> : <span className="wk-state is-ok"><Check size={12} strokeWidth={2} />Applied</span>}
      </div>

      <div className="wk-setup-kpis">
        <div><span>Predicted lap delta</span><strong>{fmt(pred.predictedDelta)}</strong><em>± {pred.std.toFixed(3)}s{dirty ? ` · applied ${fmt(applied.predictedDelta)}` : ''}</em></div>
        <div><span>Model confidence</span><strong>{pred.confidence}%</strong><em>{residual?.n || 0} runs here</em></div>
        <div><span>Test runs</span><strong>{runsLeft}/{budget.runs}</strong><em>left this weekend</em></div>
      </div>

      <ul className="wk-params">
        {SETUP_PARAMS.map(p => {
          const v = draft[p.key]; const t = rec.setup[p.key];
          const lo = Math.max(0, t - band); const hi = Math.min(100, t + band);
          const inRange = v >= lo && v <= hi;
          const diff = v - weekend.setup[p.key];
          const off = v - t;
          return (
            <li key={p.key} className={`wk-param ${inRange ? 'is-in' : 'is-out'}`}>
              <div className="wk-param-head">
                <label htmlFor={`wk-p-${p.key}`}>{sentence(p.label)}</label>
                <span className={`wk-param-flag ${inRange ? 'is-in' : 'is-out'}`}>{inRange ? 'In window' : off > 0 ? `${off} above` : `${-off} below`}</span>
                <strong>{v}</strong>
                {diff !== 0 && <em className="wk-param-diff">{diff > 0 ? '+' : ''}{diff}</em>}
              </div>
              <div className="wk-range">
                <span className="wk-range-band" style={{ left: `${lo}%`, width: `${hi - lo}%` }} aria-hidden="true" />
                <span className="wk-range-target" style={{ left: `${t}%` }} aria-hidden="true" />
                <span className="wk-range-applied" style={{ left: `${weekend.setup[p.key]}%` }} aria-hidden="true" />
                <input id={`wk-p-${p.key}`} type="range" min={0} max={100} step={1} value={v} disabled={isLocked}
                  aria-valuetext={`${v}, model window ${lo} to ${hi}`}
                  onChange={e => setDraft({ ...draft, [p.key]: Number(e.target.value) })} />
              </div>
              <div className="wk-param-foot">
                <span>0 · {p.low}</span>
                <span className="wk-param-effect">{v < t - band ? EFFECT[p.key][0] : v > t + band ? EFFECT[p.key][1] : `Model target ${t}`}</span>
                <span>{p.high} · 100</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="wk-setup-actions">
        <button type="button" className={btnClass('primary')} style={btn('primary', 'md', { flex: 1 })} disabled={isLocked || !dirty}
          onClick={() => apply(draft, 'manual', `Setup applied. Predicted lap delta ${fmt(pred.predictedDelta)}.`)}>
          <CornerDownLeft size={16} strokeWidth={1.5} />Apply setup
        </button>
        <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md', { flex: 1 })} disabled={isLocked || runsLeft === 0}
          onClick={() => apply(getSuggestedTestSetup(appState, team, track), 'test-plan', 'Test sweep loaded and applied. Run it to teach the model about this circuit.')}>
          <FlaskConical size={16} strokeWidth={1.5} />Plan test sweep
        </button>
      </div>
      <button type="button" className={btnClass('ghost')} style={btn('ghost', 'sm', { width: '100%' })} disabled={isLocked}
        onClick={() => setDraft({ ...rec.setup })}>
        <Sparkles size={14} strokeWidth={1.5} />Load the model's best setup ({fmt(rec.predictedDelta)})
      </button>

      {!isLocked && (
        <div className="wk-testrun">
          <select value={driverName} onChange={e => setDriverName(e.target.value)} aria-label="Test driver">
            {drivers.map(d => <option key={d.name} value={d.name}>{d.name} · feedback {d.feedback ?? '–'}</option>)}
          </select>
          <button type="button" className={btnClass('secondary')} style={btn('secondary', 'sm')} disabled={runsLeft === 0} onClick={runTest}>
            <Play size={14} strokeWidth={1.5} />Run test{dirty ? ' (applies first)' : ''}
          </button>
        </div>
      )}

      <div className="wk-runs" aria-label="Test runs">
        {weekend.runs.length === 0 && <p className="wk-empty">No test runs yet. The model's starting setup comes from simulator data, so it doesn't know this circuit's quirks.</p>}
        {weekend.runs.slice().reverse().map((run: any) => (
          <div key={run.n} className="wk-run">
            <span className="wk-run-head">Run {run.n} · {run.driver.split(' ').pop()} · <strong>{fmt(run.observed)}</strong> <em>model {fmt(run.predicted)}</em></span>
            {run.feedback.map((f: any, i: number) => <span key={i} className="wk-run-radio"><Radio size={12} strokeWidth={1.5} />“{f.text}”</span>)}
          </div>
        ))}
      </div>
      <p className="wk-note">The shaded band is the model's target ± its uncertainty. It narrows as test runs teach it this circuit.</p>
    </section>
  );
}
