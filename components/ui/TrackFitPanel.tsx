import React, { useMemo } from 'react';
import { Brain, MapPin, TrendingUp } from 'lucide-react';
import { HUB, glassCard } from '../HubLayout.tsx';
import {
  getDevelopmentDirection, getTrackFitForecast, getLearnedCircuits, getModelInfo, getPracticeBudget,
} from '../../game/setup/setupLab.js';

const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}s`;
const label: React.CSSProperties = { fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' };
const heading = (icon: React.ReactNode, text: string) => (
  <h4 style={{ margin: '0 0 14px', fontSize: '12px', color: HUB.accentInk, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
    {icon} {text}
  </h4>
);

/** Engineering → Track Fit: what the setup model says about the car vs the calendar. */
export function TrackFitPanel({ s }: { s: any }) {
  const team = s.team;
  const calendar = s.season?.calendar || [];
  const round = s.season?.round || 1;
  const remaining = calendar.filter((r: any) => r.round >= round);

  const direction = useMemo(() => getDevelopmentDirection(s, team, remaining), [round, team?.specs?.aero, team?.specs?.chassis, team?.carPerformance]);
  const forecast = useMemo(() => getTrackFitForecast(s, team, remaining.slice(0, 8)), [round, team?.specs?.aero, team?.specs?.chassis, team?.carPerformance]);
  const learned = getLearnedCircuits(s);
  const info: any = getModelInfo();
  const budget = getPracticeBudget(s);
  const maxGain = Math.max(0.001, ...direction.map(d => Math.abs(d.avgGain)));
  const maxFit = Math.max(0.001, ...forecast.map((f: any) => Math.abs(f.delta)));

  if (!team) return null;

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
        {/* Development direction */}
        <div style={glassCard({ padding: '20px' })}>
          {heading(<TrendingUp size={14} />, 'Development direction')}
          <p style={{ fontSize: '12px', color: HUB.textSecondary, margin: '0 0 16px' }}>
            Lap time the model expects from +5 spec points in each area, averaged over the {remaining.length} remaining rounds.
          </p>
          {direction.map((d, i) => (
            <div key={d.key} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px' }}>
                <span style={{ color: '#fff', fontWeight: i === 0 ? 700 : 400 }}>{d.label}{i === 0 ? ' — best fit' : ''}</span>
                <span style={{ color: HUB.textSecondary, fontVariantNumeric: 'tabular-nums' }}>−{Math.max(0, d.avgGain).toFixed(3)}s / lap</span>
              </div>
              <div style={{ height: '6px', background: HUB.raised, borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(Math.max(0, d.avgGain) / maxGain) * 100}%`, height: '100%', background: i === 0 ? HUB.accent : HUB.textFaint }} />
              </div>
              <div style={{ fontSize: '11px', color: HUB.textFaint, marginTop: '4px' }}>Biggest gain at {d.bestCircuit} ({d.bestGain.toFixed(3)}s)</div>
            </div>
          ))}
        </div>

        {/* Upcoming track fit */}
        <div style={glassCard({ padding: '20px' })}>
          {heading(<MapPin size={14} />, 'Upcoming circuit fit')}
          <p style={{ fontSize: '12px', color: HUB.textSecondary, margin: '0 0 16px' }}>
            Your car vs an average car, both on their best setups. Negative is faster.
          </p>
          {forecast.map((f: any) => {
            const good = f.delta < 0;
            return (
              <div key={f.round} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 80px', alignItems: 'center', gap: '10px', marginBottom: '9px', fontSize: '12px' }}>
                <span style={{ color: HUB.textFaint, fontVariantNumeric: 'tabular-nums' }}>R{f.round}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ height: '4px', background: HUB.raised, borderRadius: '2px', marginTop: '4px' }}>
                    <div style={{ width: `${(Math.abs(f.delta) / maxFit) * 100}%`, height: '100%', borderRadius: '2px', background: good ? HUB.positive : HUB.negative }} />
                  </div>
                </div>
                <span style={{ textAlign: 'right', color: good ? HUB.positive : HUB.negative, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.delta)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model card */}
      <div style={glassCard({ padding: '20px' })}>
        {heading(<Brain size={14} />, 'Setup model')}
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div><div style={label}>Architecture</div><div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{info.members ?? 3}× MLP ensemble + Bayesian track correlation</div></div>
          <div><div style={label}>Holdout error</div><div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{info.holdoutMAE ?? '—'}s MAE on unseen circuits</div></div>
          <div><div style={label}>Setup loss</div><div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>{info.setupLoss?.modelBeforePractice ?? '—'}s → {info.setupLoss?.modelAfterPracticeRuns ?? '—'}s after {info.practiceRuns ?? 8} runs</div></div>
          <div><div style={label}>Simulator</div><div style={{ color: '#fff', fontSize: '13px', marginTop: '4px' }}>Level {budget.simulatorLevel}: {budget.runs} runs/weekend, ±{budget.noiseSd}s noise</div></div>
        </div>
        <div style={label}>Circuits learned from practice</div>
        {learned.length === 0 ? (
          <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '6px 0 0' }}>None yet. Test runs in the weekend Setup Lab teach the model each circuit's quirks, and that knowledge carries over to next season.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {learned.map(l => (
              <span key={l.circuitId} style={{ fontSize: '11px', color: '#ddd', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '999px', padding: '4px 10px' }}>
                {l.circuitId} · {l.runs} runs
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
