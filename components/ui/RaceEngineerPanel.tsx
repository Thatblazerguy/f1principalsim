import React from 'react';
import { HUB, btn, btnClass, tyreDot } from '../HubLayout.tsx';
import { ArrowDown, ArrowUp } from 'lucide-react';

// Live pit-wall view of the AI race engineer (game/RaceEngineer.js).
// Re-renders with the race frame; reads the engineer's latest briefing per car.

const label = { fontSize: '11px', color: HUB.textFaint, fontFamily: HUB.fontRegular } as const;
const mono = { fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' as const };
const dotKey = (c: string) => (c === 'Intermediate' ? 'inter' : c);
const code = (n: string) => String(n || '').split(' ').pop()!.slice(0, 3).toUpperCase();

function Trend({ value, goodWhenNegative }: { value: number | null; goodWhenNegative: boolean }) {
  if (value == null || Math.abs(value) < 0.05) return null;
  const good = goodWhenNegative ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  return (
    <span title={`${value > 0 ? '+' : ''}${value.toFixed(2)}s per lap`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '11px', color: good ? HUB.positive : HUB.negative, ...mono }}>
      <Icon size={10} strokeWidth={2} />{Math.abs(value).toFixed(1)}
    </span>
  );
}

function AutoSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      title={on ? 'Engineer is running this car' : 'Let the engineer run strategy and modes'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: on ? HUB.textPrimary : HUB.textMuted, fontSize: '11px', fontFamily: HUB.fontRegular }}
    >
      Auto
      <span style={{ width: '26px', height: '14px', borderRadius: '7px', background: on ? HUB.accent : HUB.raised, border: `1px solid ${on ? HUB.accent : HUB.borderMid}`, position: 'relative', transition: `background-color 150ms ${HUB.ease}` }}>
        <span style={{ position: 'absolute', top: '1px', left: on ? '13px' : '1px', width: '10px', height: '10px', borderRadius: '50%', background: HUB.textPrimary, transition: `left 150ms ${HUB.ease}` }} />
      </span>
    </button>
  );
}

function DriverBrief({ b, engineer, onChange }: { b: any; engineer: any; onChange?: () => void }) {
  if (b.retired) {
    return (
      <div style={{ background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px', opacity: 0.6 }}>
        <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{code(b.driver)}</span>
        <span style={{ fontSize: '12px', color: HUB.negative, marginLeft: '8px' }}>Retired</span>
      </div>
    );
  }
  const statusColor = b.status === 'On target' ? HUB.positive : b.status === 'At risk' ? HUB.warning : HUB.negative;
  const wear = Math.round(b.tyre.wearPct);
  const calls = b.calls.slice(0, 3);

  return (
    <div style={{ background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      {/* Position vs projection vs target */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${HUB.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{code(b.driver)}</span>
          <span style={{ fontSize: '13px', color: HUB.textPrimary, ...mono }}>P{b.position}</span>
          <span style={{ fontSize: '11px', color: HUB.textFaint }}>proj</span>
          <span style={{ fontSize: '13px', color: HUB.textPrimary, ...mono }}>P{b.projected}</span>
        </div>
        <AutoSwitch on={b.auto} onToggle={() => { engineer.setAuto(b.carId, !b.auto); onChange?.(); }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderBottom: `1px solid ${HUB.border}`, fontSize: '11px', color: HUB.textMuted }}>
        <span aria-hidden style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} />
        {b.status} · target P{b.target}
      </div>

      {/* Gaps */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${HUB.border}` }}>
        {[
          { k: 'Ahead', d: b.ahead, good: true },
          { k: 'Behind', d: b.behind, good: false },
        ].map(({ k, d, good }, i) => (
          <div key={k} style={{ padding: '8px 12px', borderLeft: i ? `1px solid ${HUB.border}` : 'none' }}>
            <div style={label}>{k}{d ? ` · ${code(d.name)}` : ''}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '13px', color: HUB.textPrimary, ...mono }}>{d ? `${d.gap.toFixed(1)}s` : '–'}</span>
              {d && <Trend value={d.trend} goodWhenNegative={good} />}
              {d && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: HUB.textFaint, ...mono }}>{tyreDot(dotKey(d.compound), 6)}{Math.floor(d.tyreAge)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Tyres */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${HUB.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          {tyreDot(dotKey(b.tyre.compound))}
          <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontBold }}>{b.tyre.compound}</span>
          <span style={{ fontSize: '11px', color: HUB.textMuted, ...mono }}>{Math.floor(b.tyre.age)} laps</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: wear > 85 ? HUB.negative : HUB.textMuted, ...mono }}>{wear}%</span>
        </div>
        <div style={{ height: '4px', background: HUB.raised, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${wear}%`, height: '100%', background: wear > 85 ? HUB.negative : wear > 65 ? HUB.warning : 'rgba(237,237,237,0.6)', transition: `width 400ms ${HUB.ease}` }} />
        </div>
        <div style={{ fontSize: '11px', color: HUB.textFaint, marginTop: '6px' }}>
          {b.tyre.lapsToCliff > 0 ? `~${Math.ceil(b.tyre.lapsToCliff)} laps to the cliff` : 'Past the cliff'} · {b.tyre.lossVsNew > 0.05 ? `+${b.tyre.lossVsNew.toFixed(1)}s/lap vs new` : 'fresh'}
        </div>
      </div>

      {/* Calls */}
      <div style={{ padding: '4px 0' }}>
        {calls.length === 0 && <div style={{ padding: '8px 12px', fontSize: '12px', color: HUB.textMuted }}>All good. Keep it steady.</div>}
        {calls.map((c: any) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: c.priority <= 1 ? HUB.fontBold : HUB.fontRegular }}>{c.title}</div>
              <div style={{ fontSize: '11px', color: HUB.textMuted, lineHeight: 1.4 }}>{c.detail}</div>
            </div>
            {c.command && !b.auto && (
              <button
                onClick={() => { engineer.apply(b.carId, c); onChange?.(); }}
                className={btnClass(c.priority <= 1 ? 'primary' : 'secondary')}
                style={btn(c.priority <= 1 ? 'primary' : 'secondary', 'sm', { flexShrink: 0 })}
              >
                {c.actionLabel || 'Apply'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RaceEngineerPanel({ engineer, engine, onChange }: { engineer: any; engine: any; onChange?: () => void }) {
  const playerCars = engine?.cars?.filter((c: any) => c.isPlayer) || [];
  const briefs = playerCars.map((c: any) => engineer?.getBriefing(c.id)).filter(Boolean);

  if (!engineer || playerCars.length === 0) {
    return <div style={{ padding: '12px', fontSize: '12px', color: HUB.textMuted }}>No cars of ours in this race</div>;
  }
  if (briefs.length === 0) {
    return <div style={{ padding: '12px', fontSize: '12px', color: HUB.textMuted }}>Lights out. First read after turn 1…</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {playerCars.map((car: any) => {
        const b = engineer.getBriefing(car.id);
        if (!b) return null;
        if (!car.retired && car.distance >= engine.totalLaps) {
          const pos = engine.cars.indexOf(car) + 1;
          const target = b.target;
          return (
            <div key={car.id} style={{ background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{code(car.driver.name)}</span>
              <span style={{ fontSize: '13px', color: HUB.textPrimary, ...mono }}>Finished P{pos}</span>
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: pos <= target ? HUB.positive : HUB.negative }}>{pos <= target ? 'Target met' : `Target was P${target}`}</span>
            </div>
          );
        }
        return <DriverBrief key={car.id} b={b} engineer={engineer} onChange={onChange} />;
      })}
    </div>
  );
}
