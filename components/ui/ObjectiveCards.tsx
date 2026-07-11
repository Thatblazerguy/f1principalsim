import React from 'react';
import { motion } from 'framer-motion';
import { HUB, glassCard } from '../HubLayout.tsx';
import { Target, Zap, Shield, Trophy, Flag, TrendingUp, CloudRain, Wrench, Star } from 'lucide-react';

// ── Finish Distribution Bar ──────────────────────────────────────────────────
export const FinishDistributionBar = ({ finishDist, compact = false }) => {
  if (!finishDist) return null;
  const { win, podium, top5, top10, expectedFinish } = finishDist;
  const bars = [
    { label: 'Win', value: win, color: '#f59e0b' },
    { label: 'Podium', value: podium, color: '#10b981' },
    { label: 'Top 5', value: top5, color: '#3b82f6' },
    { label: 'Top 10', value: top10, color: '#8b5cf6' },
  ];

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {bars.map(bar => (
          <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: bar.color }} />
            <span style={{ fontSize: '10px', color: HUB.textMuted }}>{bar.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: bar.color, fontFamily: HUB.fontMono }}>{bar.value}%</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          AI Finish Distribution
        </span>
        <span style={{ fontSize: '11px', color: '#fff', fontFamily: HUB.fontMono }}>
          Expected: <strong style={{ color: HUB.accent }}>P{expectedFinish}</strong>
        </span>
      </div>
      {bars.map(bar => (
        <div key={bar.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: HUB.textMuted }}>{bar.label}</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: bar.color, fontFamily: HUB.fontMono }}>{bar.value}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bar.value}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              style={{ height: '100%', background: bar.color, borderRadius: '2px' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Objective Type Icon ──────────────────────────────────────────────────────
const ObjectiveIcon = ({ type, size = 14 }) => {
  const iconProps = { size, style: { flexShrink: 0 } };
  switch (type) {
    case 'primary': return <Trophy {...iconProps} color="#f59e0b" />;
    case 'championship': return <TrendingUp {...iconProps} color="#10b981" />;
    case 'rival': return <Target {...iconProps} color={HUB.accent} />;
    case 'track': return <Flag {...iconProps} color="#3b82f6" />;
    case 'opportunistic': return <Star {...iconProps} color="#a78bfa" />;
    case 'qualifying': return <Zap {...iconProps} color="#60a5fa" />;
    case 'weather': return <CloudRain {...iconProps} color="#60a5fa" />;
    case 'reliability': return <Wrench {...iconProps} color="#94a3b8" />;
    default: return <Target {...iconProps} color={HUB.textMuted} />;
  }
};

// ── Risk Badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ level }) => {
  const colors = { 'Low': '#10b981', 'Medium': '#f59e0b', 'High': '#f97316', 'Very High': '#ef4444', 'Critical': '#e11d48' };
  const color = colors[level] || HUB.textMuted;
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color, border: `1px solid ${color}22`, background: `${color}11`,
      padding: '2px 6px', borderRadius: '3px'
    }}>
      {level} Risk
    </span>
  );
};

// ── Board Impact Badge ───────────────────────────────────────────────────────
const BoardBadge = ({ impact }) => {
  const colors = { 'Critical': '#e11d48', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': HUB.textMuted };
  const color = colors[impact] || HUB.textMuted;
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, color, fontFamily: HUB.fontMono }}>
      Board: {impact}
    </span>
  );
};

// ── Single Objective Card ────────────────────────────────────────────────────
export const ObjectiveCard = ({
  objective,
  isSelected,
  isRecommended,
  onSelect,
  compact = false,
}) => {
  const { label, type, emoji, rationale, expectedFinishRange, successProbability,
    riskLevel, sponsorRewardM, boardImpact, championshipImpact } = objective;

  const selectedBorder = `1px solid ${HUB.accent}`;
  const defaultBorder = '1px solid rgba(255,255,255,0.06)';
  const selectedBg = 'rgba(225,6,0,0.07)';
  const hoverBg = 'rgba(255,255,255,0.03)';

  // Probability bar colour
  const probColor = successProbability >= 65 ? '#10b981' : successProbability >= 40 ? '#f59e0b' : '#ef4444';

  if (compact) {
    return (
      <motion.button
        onClick={() => onSelect && onSelect(objective.id)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        style={{
          width: '100%', textAlign: 'left', cursor: onSelect ? 'pointer' : 'default',
          padding: '12px 16px',
          background: isSelected ? selectedBg : hoverBg,
          border: isSelected ? selectedBorder : defaultBorder,
          borderRadius: '8px', transition: 'all 0.15s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <ObjectiveIcon type={type} size={14} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#fff' : 'rgba(255,255,255,0.85)' }}>
                {emoji} {label}
              </span>
              {isRecommended && <span style={{ fontSize: '8px', background: HUB.accent, color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>AI PICK</span>}
            </div>
            <span style={{ fontSize: '10px', color: HUB.textMuted }}>
              {expectedFinishRange} • {successProbability}% Success • <RiskBadge level={riskLevel} />
            </span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', fontFamily: HUB.fontMono }}>+${sponsorRewardM}M</div>
          <div style={{ fontSize: '9px', color: HUB.textMuted }}>Sponsor</div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={() => onSelect && onSelect(objective.id)}
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      style={{
        width: '100%', textAlign: 'left', cursor: onSelect ? 'pointer' : 'default',
        padding: '20px',
        background: isSelected ? selectedBg : 'rgba(0,0,0,0.15)',
        border: isSelected ? selectedBorder : defaultBorder,
        borderRadius: '10px', transition: 'all 0.15s ease',
        position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Recommended glow accent */}
      {isRecommended && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '7px', display: 'flex', alignItems: 'center' }}>
            <ObjectiveIcon type={type} size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontBold }}>
                {emoji} {label}
              </span>
              {isRecommended && (
                <span style={{
                  fontSize: '8px', background: '#f59e0b', color: '#000',
                  padding: '2px 6px', borderRadius: '3px', fontWeight: 800, letterSpacing: '0.05em'
                }}>AI PICK</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RiskBadge level={riskLevel} />
              <BoardBadge impact={boardImpact} />
            </div>
          </div>
        </div>

        {/* Success probability circle */}
        <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: '12px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            border: `2px solid ${probColor}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: `${probColor}15`
          }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: probColor, fontFamily: HUB.fontMono, lineHeight: 1 }}>{successProbability}%</span>
          </div>
          <div style={{ fontSize: '8px', color: HUB.textMuted, marginTop: '3px' }}>SUCCESS</div>
        </div>
      </div>

      {/* AI Rationale */}
      <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 14px', lineHeight: '1.5', fontStyle: 'italic' }}>
        "{rationale}"
      </p>

      {/* Success probability bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${successProbability}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', background: probColor, borderRadius: '2px' }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '3px' }}>Expected</div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>{expectedFinishRange}</div>
        </div>
        <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '3px' }}>Sponsor</div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', fontFamily: HUB.fontMono }}>+${sponsorRewardM}M</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '3px' }}>Pts Impact</div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>{championshipImpact}</div>
        </div>
      </div>
    </motion.button>
  );
};

// ── Full Objective Cards List ─────────────────────────────────────────────────
export const ObjectiveCardsList = ({
  objectives,
  recommendedObjective,
  selectedObjectiveId,
  onSelect,
  compact = false,
}) => {
  if (!objectives || objectives.length === 0) {
    return <div style={{ color: HUB.textMuted, fontSize: '13px' }}>No objectives generated.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '8px' : '12px' }}>
      {objectives.map((obj, i) => (
        <motion.div
          key={obj.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
        >
          <ObjectiveCard
            objective={obj}
            isSelected={selectedObjectiveId === obj.id}
            isRecommended={recommendedObjective?.id === obj.id}
            onSelect={onSelect}
            compact={compact}
          />
        </motion.div>
      ))}
    </div>
  );
};
