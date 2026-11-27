import React, { useState } from 'react';
import { HUB } from './HubLayout.tsx';

// ─── Colour helpers ───────────────────────────────────────────────────────────
export function getPositionColor(pos: number | null, retired: boolean): string {
  // Win = accent, points = raised, outside points / DNF = quiet
  if (retired)  return HUB.raised;
  if (!pos)     return HUB.raised;
  if (pos === 1) return HUB.accent;
  if (pos <= 10) return HUB.raised;
  return 'transparent';
}

export function getPositionTextColor(pos: number | null, retired: boolean): string {
  if (retired)   return HUB.negative;
  if (!pos)      return HUB.textMuted;
  if (pos === 1) return '#fff';
  if (pos <= 10) return HUB.textPrimary;
  return HUB.textFaint;
}

// ─── FormChip ─────────────────────────────────────────────────────────────────
interface FormEntry {
  round:     number;
  name:      string;      // race name
  circuit?:  string;
  season?:   number;
  finishPos: number;
  points:    number;
  retired:   boolean;
  // team form uses bestPos instead of finishPos
  bestPos?:  number;
}

interface FormChipsProps {
  results: FormEntry[];
  /** If true, uses bestPos (team form) instead of finishPos */
  isTeam?: boolean;
}

export function FormChips({ results, isTeam = false }: FormChipsProps) {
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null);

  if (!results || results.length === 0) {
    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            width: '28px', height: '22px',
            borderRadius: '4px',
            background: HUB.raised,
            border: `1px solid ${HUB.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '11px', color: HUB.textFaint }}>—</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', position: 'relative' }}>
      {results.map((r, i) => {
        const pos     = isTeam ? (r.bestPos ?? r.finishPos) : r.finishPos;
        const bg      = getPositionColor(pos, r.retired);
        const txtCol  = getPositionTextColor(pos, r.retired);
        const label   = r.retired ? 'DNF' : `P${pos}`;
        const isOpen  = tooltip?.idx === i;

        return (
          <div
            key={i}
            style={{ position: 'relative' }}
            onMouseEnter={() => setTooltip({ idx: i })}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Chip */}
            <div style={{
              width: '32px', height: '22px',
              borderRadius: '4px',
              background: bg,
              border: `1px solid ${pos === 1 && !r.retired ? HUB.accent : HUB.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
              transition: `transform 120ms ${HUB.ease}`,
              transform: isOpen ? 'translateY(-2px)' : 'none'
            }}>
              <span style={{
                fontSize: '11px',
                fontFamily: HUB.fontBold,
                fontWeight: 400,
                color: txtCol
              }}>{label}</span>
            </div>

            {/* Tooltip */}
            {isOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                zIndex: 200,
                background: HUB.raised,
                border: `1px solid ${HUB.borderMid}`,
                borderRadius: '8px',
                padding: '12px 16px',
                minWidth: '180px',
                pointerEvents: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
              }}>
                {/* Arrow */}
                <div style={{
                  position: 'absolute',
                  bottom: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '8px', height: '8px',
                  background: HUB.raised,
                  border: `1px solid ${HUB.borderMid}`,
                  borderTop: 'none', borderLeft: 'none'
                }} />

                <div style={{ fontSize: '11px', color: HUB.textFaint, fontFamily: HUB.fontRegular, marginBottom: '4px' }}>
                  Round {r.round}{r.season ? ` · S${r.season}` : ''}
                </div>
                <div style={{ fontSize: '13px', color: HUB.textPrimary, fontFamily: HUB.fontBold, marginBottom: '2px', lineHeight: 1.3 }}>
                  {r.name}
                </div>
                {r.circuit && (
                  <div style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontRegular, marginBottom: '8px' }}>
                    {r.circuit}
                  </div>
                )}
                <div style={{ height: '1px', background: HUB.border, marginBottom: '8px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontRegular }}>
                    {r.retired ? 'Result' : 'Finished'}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontFamily: HUB.fontBold,
                    color: r.retired ? HUB.negative : HUB.textPrimary,
                    fontWeight: 400
                  }}>
                    {r.retired ? 'DNF' : `P${pos}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontRegular }}>Points</span>
                  <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: r.points > 0 ? HUB.positive : HUB.textMuted }}>
                    {r.points > 0 ? `+${r.points}` : '0'}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
