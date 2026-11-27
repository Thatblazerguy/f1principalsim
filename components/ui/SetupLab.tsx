import React, { useMemo, useState } from 'react';
import { Cpu, FlaskConical, Lock, Play, Radio, Sparkles } from 'lucide-react';
import { HUB, glassCard, actionBtn } from '../HubLayout.tsx';
import { SETUP_PARAMS } from '../../game/setup/carSetup.js';
import {
  ensureWeekendSetup, setWeekendSetup, getRecommendation, predictForSetup,
  getSuggestedTestSetup, runPracticeTest, getRunsRemaining, getPracticeBudget, getResidual,
} from '../../game/setup/setupLab.js';

type Props = {
  appState: any;
  track: any;
  drivers: any[];
  locked: boolean;
  onSetupChanged: (message?: string) => void;
};

const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}s`;

const smallBtn = (primary = false, disabled = false): React.CSSProperties => ({
  ...(actionBtn({ padding: '10px 14px' }) as any),
  fontSize: '11px',
  letterSpacing: '0.08em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: primary ? HUB.accent : 'rgba(255,255,255,0.05)',
  border: primary ? 'none' : `1px solid ${HUB.borderMid}`,
  opacity: disabled ? 0.45 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export function SetupLab({ appState, track, drivers, locked, onSetupChanged }: Props) {
  const team = appState.team;
  const weekend = ensureWeekendSetup(appState, team, track);
  const [setup, setSetup] = useState<Record<string, number>>({ ...weekend.setup });
  const [driverName, setDriverName] = useState<string>(drivers[0]?.name || '');
  const [version, setVersion] = useState(0); // bump after runs so derived values recompute

  const budget = getPracticeBudget(appState);
  const runsLeft = getRunsRemaining(appState);
  const residual = getResidual(appState, weekend.circuitId);
  const prediction = useMemo(() => predictForSetup(appState, team, track, setup), [setup, version]);
  const recommendation = useMemo(() => getRecommendation(appState, team, track), [version]);
  const isLocked = locked || weekend.locked;

  const commit = (next: Record<string, number>, source: string, message?: string) => {
    setSetup(next);
    if (setWeekendSetup(appState, next, source)) onSetupChanged(message);
  };

  const handleRun = () => {
    const driver = drivers.find(d => d.name === driverName) || drivers[0];
    const res = runPracticeTest(appState, team, track, driver);
    if (!res.ok || !res.run) { onSetupChanged(res.reason); return; }
    const run = res.run;
    setVersion(v => v + 1);
    onSetupChanged(`Test run ${run.n} complete: ${fmt(run.observed)} vs model ${fmt(run.predicted)}. Track correlation updated.`);
  };

  const label: React.CSSProperties = { fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' };

  return (
    <div style={{ ...glassCard({ padding: '20px' }), marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '12px', color: HUB.accentInk, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FlaskConical size={14} /> Setup Lab
          </h4>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: HUB.textSecondary, maxWidth: '520px' }}>
            The setup model learns this circuit from your test runs. Run sweeps around its best guess, then lock in before qualifying.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div><div style={label}>Model confidence</div><div style={{ fontFamily: HUB.fontBold, fontSize: '18px', color: '#fff' }}>{prediction.confidence}%</div></div>
          <div><div style={label}>Runs left</div><div style={{ fontFamily: HUB.fontBold, fontSize: '18px', color: '#fff' }}>{runsLeft}/{budget.runs}</div></div>
          <div><div style={label}>Data here</div><div style={{ fontFamily: HUB.fontBold, fontSize: '18px', color: '#fff' }}>{residual?.n || 0} runs</div></div>
        </div>
      </div>

      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '24px' }}>
        {/* Sliders */}
        <div>
          {SETUP_PARAMS.map(p => (
            <div key={p.key} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#fff' }}>{p.label}</span>
                <span style={{ color: HUB.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  {setup[p.key]}
                  <span style={{ color: HUB.textFaint }}> · AI {recommendation.setup[p.key]}</span>
                </span>
              </div>
              <input
                type="range" min={0} max={100} step={1}
                value={setup[p.key]}
                disabled={isLocked}
                aria-label={p.label}
                onChange={e => commit({ ...setup, [p.key]: Number(e.target.value) }, 'manual')}
                style={{ width: '100%', accentColor: HUB.accent, cursor: isLocked ? 'not-allowed' : 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: HUB.textFaint }}>
                <span>{p.low}</span><span>{p.high}</span>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button disabled={isLocked} style={smallBtn(false, isLocked)}
              onClick={() => commit({ ...recommendation.setup }, 'model', `Applied the model's best setup (predicted ${fmt(recommendation.predictedDelta)}).`)}>
              <Sparkles size={12} /> Apply AI setup
            </button>
            <button disabled={isLocked || runsLeft === 0} style={smallBtn(false, isLocked || runsLeft === 0)}
              onClick={() => commit(getSuggestedTestSetup(appState, team, track), 'test-plan', 'Loaded a test sweep — run it to teach the model about this circuit.')}>
              <Cpu size={12} /> Plan test sweep
            </button>
          </div>
        </div>

        {/* Run panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ background: HUB.raised, borderRadius: '10px', padding: '14px' }}>
            <div style={label}>Predicted lap delta (this setup)</div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: '22px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(prediction.predictedDelta)} <span style={{ fontSize: '12px', color: HUB.textMuted }}>± {prediction.std.toFixed(3)}</span>
            </div>
            <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>
              Model best: {fmt(recommendation.predictedDelta)}. Includes how well the car suits this circuit, so it can be below zero.
            </div>
          </div>

          {isLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: HUB.warning }}>
              <Lock size={14} /> Parc fermé — setup locked for qualifying and the race.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={driverName} onChange={e => setDriverName(e.target.value)} aria-label="Test driver"
                style={{ background: HUB.raised, color: '#fff', border: `1px solid ${HUB.borderMid}`, borderRadius: '8px', padding: '9px 10px', fontSize: '12px', flex: '1 1 140px', minWidth: 0 }}>
                {drivers.map(d => <option key={d.name} value={d.name}>{d.name} · feedback {d.feedback ?? '—'}</option>)}
              </select>
              <button disabled={runsLeft === 0} style={smallBtn(true, runsLeft === 0)} onClick={handleRun}>
                <Play size={12} /> Run test
              </button>
            </div>
          )}

          <div style={{ maxHeight: '230px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {weekend.runs.length === 0 && (
              <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>No test runs yet. The model's starting setup comes from simulator data only, so it doesn't know this circuit's quirks.</p>
            )}
            {weekend.runs.slice().reverse().map((run: any) => (
              <div key={run.n} style={{ borderLeft: `2px solid ${HUB.borderMid}`, paddingLeft: '10px' }}>
                <div style={{ fontSize: '11px', color: HUB.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  Run {run.n} · {run.driver} · {fmt(run.observed)} <span style={{ color: HUB.textFaint }}>(model said {fmt(run.predicted)})</span>
                </div>
                {run.feedback.map((f: any, i: number) => (
                  <div key={i} style={{ fontSize: '12px', color: '#ddd', display: 'flex', gap: '6px', marginTop: '3px' }}>
                    <Radio size={12} color={HUB.textMuted} style={{ flexShrink: 0, marginTop: '2px' }} /> “{f.text}”
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
