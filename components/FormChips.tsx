import React, { useState } from 'react';
import { HUB } from './HubLayout.tsx';

// ─── Colour helpers ───────────────────────────────────────────────────────────
export function getPositionColor(pos: number | null, retired: boolean): string {
  if (retired)  return '#ef4444';
  if (!pos)     return 'rgba(255,255,255,0.15)';
  if (pos === 1) return '#FFD700';
  if (pos === 2) return '#C0C0C0';
  if (pos === 3) return '#CD7F32';
  if (pos <= 10) return 'rgba(225,6,0,0.85)';
  return 'rgba(255,255,255,0.2)';
}

export function getPositionTextColor(pos: number | null, retired: boolean): string {
  if (retired)   return '#fff';
  if (!pos)      return HUB.textMuted;
  if (pos <= 3)  return '#0B0F19';   // dark text on bright medal chips
  if (pos <= 10) return '#fff';
  return HUB.textMuted;
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
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}>—</span>
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
              border: `1px solid ${r.retired ? '#ef4444' : (pos && pos <= 3 ? 'transparent' : 'rgba(255,255,255,0.08)')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'default',
              transition: 'transform 0.1s',
              transform: isOpen ? 'translateY(-2px)' : 'none',
            }}>
              <span style={{
                fontSize: '8px',
                fontFamily: HUB.fontBold,
                fontWeight: 700,
                color: txtCol,
                letterSpacing: '0.03em',
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
                background: 'rgba(8,11,18,0.98)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${HUB.borderMid}`,
                borderRadius: '8px',
                padding: '12px 14px',
                minWidth: '180px',
                pointerEvents: 'none',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}>
                {/* Arrow */}
                <div style={{
                  position: 'absolute',
                  bottom: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '8px', height: '8px',
                  background: 'rgba(8,11,18,0.98)',
                  border: `1px solid ${HUB.borderMid}`,
                  borderTop: 'none', borderLeft: 'none',
                }} />

                <div style={{ fontSize: '10px', color: HUB.accent, fontFamily: HUB.fontBold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Round {r.round}{r.season ? ` · S${r.season}` : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#fff', fontFamily: HUB.fontBold, marginBottom: '2px', lineHeight: 1.3 }}>
                  {r.name}
                </div>
                {r.circuit && (
                  <div style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontRegular, marginBottom: '8px' }}>
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
                    color: r.retired ? '#ef4444' : (pos && pos <= 3 ? bg : '#fff'),
                    fontWeight: 700,
                  }}>
                    {r.retired ? 'DNF' : `P${pos}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontRegular }}>Points</span>
                  <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: r.points > 0 ? '#10b981' : HUB.textMuted }}>
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
