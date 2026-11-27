import React from 'react';
import { HUB, btn, tyreDot } from '../../components/HubLayout.tsx';
import { getTrackPath } from '../../data/realTrackLayouts.js';

const PREVIEW_ORDER = [
  { pos: 1, code: 'LEC', team: 'Ferrari', gap: 'Leader', tyre: 'medium', laps: 31, you: true },
  { pos: 2, code: 'NOR', team: 'McLaren', gap: '+1.854', tyre: 'hard', laps: 12 },
  { pos: 3, code: 'HAM', team: 'Ferrari', gap: '+4.210', tyre: 'medium', laps: 31, you: true },
  { pos: 4, code: 'VER', team: 'Red Bull', gap: '+6.032', tyre: 'hard', laps: 18 },
  { pos: 5, code: 'PIA', team: 'McLaren', gap: '+9.517', tyre: 'soft', laps: 4 },
];

/** The pit wall, as the game draws it: circuit, running order, tyres, the call to make. */
export function PitWallPreview() {
  const pathRef = React.useRef<SVGPathElement>(null);
  const [box, setBox] = React.useState('0 0 500 500');
  const [car, setCar] = React.useState<{ x: number; y: number }[]>([]);
  const d = getTrackPath('Monaco Grand Prix');
  React.useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const b = el.getBBox();
    const pad = Math.max(b.width, b.height) * 0.06;
    setBox(`${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
    const len = el.getTotalLength();
    setCar([0.62, 0.58, 0.51, 0.47, 0.4].map(f => { const p = el.getPointAtLength(len * f); return { x: p.x, y: p.y }; }));
  }, [d]);
  const r = parseFloat(box.split(' ')[2]) / 80;

  return (
    <div className="landing-preview" style={{ background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '48px', padding: '0 20px', borderBottom: `1px solid ${HUB.border}` }}>
        <span style={{ fontSize: '13px', color: HUB.textPrimary }}>Monaco Grand Prix</span>
        <span style={{ fontSize: '13px', color: HUB.textFaint, fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums' }}>Lap 31 / 78</span>
      </div>
      <div className="landing-preview-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr' }}>
        <div style={{ padding: '20px', borderRight: `1px solid ${HUB.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
          <svg viewBox={box} style={{ width: '100%', height: '240px' }} aria-hidden>
            <path d={d} fill="none" stroke="rgba(237,237,237,0.06)" strokeWidth={12} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path ref={pathRef} d={d} fill="none" stroke="rgba(237,237,237,0.65)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {car.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={r} fill={PREVIEW_ORDER[i].you ? HUB.accent : HUB.textPrimary} stroke={HUB.surface} strokeWidth={r * 0.5} />
            ))}
          </svg>
        </div>
        <div style={{ padding: '12px 8px' }}>
          {PREVIEW_ORDER.map(row => (
            <div key={row.code} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto 56px', alignItems: 'center', gap: '10px', height: '40px', padding: '0 12px', borderRadius: '8px', background: row.you ? HUB.raised : 'transparent', position: 'relative' }}>
              {row.you && <span style={{ position: 'absolute', left: 0, top: '11px', bottom: '11px', width: '2px', borderRadius: '2px', background: HUB.accent }} />}
              <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textFaint, fontVariantNumeric: 'tabular-nums' }}>{row.pos}</span>
              <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{row.code}<span style={{ fontFamily: HUB.fontRegular, color: HUB.textFaint, marginLeft: '8px' }}>{row.team}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: HUB.textMuted, fontVariantNumeric: 'tabular-nums' }}>{tyreDot(row.tyre, 10)}{row.laps}</span>
              <span style={{ fontSize: '12px', fontFamily: HUB.fontBold, color: HUB.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.gap}</span>
            </div>
          ))}
          <div style={{ margin: '12px 12px 8px', paddingTop: '12px', borderTop: `1px solid ${HUB.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: HUB.textMuted, lineHeight: 1.4 }}>Medium at 74% wear. Pit window open.</span>
            <span style={btn('primary', 'sm', { cursor: 'default' })}>Box LEC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

