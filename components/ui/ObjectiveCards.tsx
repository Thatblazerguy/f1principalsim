import React from 'react';
import { motion } from 'framer-motion';
import { HUB, glassCard, pill } from '../HubLayout.tsx';
import { Target, Zap, Shield, Trophy, Flag, TrendingUp, CloudRain, Wrench, Star } from 'lucide-react';

// ── Finish Distribution Bar ──────────────────────────────────────────────────
export const FinishDistributionBar = ({ finishDist, compact = false }) => {
  if (!finishDist) return null;
  const { win, podium, top5, top10, expectedFinish } = finishDist;
  const bars = [
    { label: 'Win', value: win, color: 'rgba(237,237,237,0.5)' },
    { label: 'Podium', value: podium, color: 'rgba(237,237,237,0.5)' },
    { label: 'Top 5', value: top5, color: 'rgba(237,237,237,0.5)' },
    { label: 'Top 10', value: top10, color: 'rgba(237,237,237,0.5)' },
  ];

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {bars.map(bar => (
          <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>{bar.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{bar.value}%</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: HUB.textMuted }}>
          Finish distribution
        </span>
        <span style={{ fontSize: '12px', color: HUB.textMuted, fontFamily: HUB.fontRegular }}>
          Expected <strong style={{ color: HUB.textPrimary, fontFamily: HUB.fontMono, fontWeight: 400 }}>P{expectedFinish}</strong>
        </span>
      </div>
      {bars.map(bar => (
        <div key={bar.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>{bar.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{bar.value}%</span>
          </div>
          <div style={{ height: '4px', background: HUB.raised, borderRadius: '2px', overflow: 'hidden' }}>
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
  const iconProps = { size, strokeWidth: 1.5, color: HUB.textMuted, style: { flexShrink: 0 } };
  switch (type) {
    case 'primary': return <Trophy {...iconProps} />;
    case 'championship': return <TrendingUp {...iconProps} />;
    case 'rival': return <Target {...iconProps} />;
    case 'track': return <Flag {...iconProps} />;
    case 'opportunistic': return <Star {...iconProps} />;
    case 'qualifying': return <Zap {...iconProps} />;
    case 'weather': return <CloudRain {...iconProps} />;
    case 'reliability': return <Wrench {...iconProps} />;
    default: return <Target {...iconProps} />;
  }
};

// ── Risk Badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ level }) => {
  const colors = { 'Low': HUB.textMuted, 'Medium': HUB.textMuted, 'High': HUB.warning, 'Very High': HUB.negative, 'Critical': HUB.negative };
  const color = colors[level] || HUB.textMuted;
  const text = String(level || '');
  return (
    <span style={{ fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color }}>
      {text.charAt(0)}{text.slice(1).toLowerCase()} risk
    </span>
  );
};

// ── Board Impact Badge ───────────────────────────────────────────────────────
const BoardBadge = ({ impact }) => {
  const colors = { 'Critical': HUB.negative, 'High': HUB.warning, 'Medium': HUB.textMuted, 'Low': HUB.textMuted };
  const color = colors[impact] || HUB.textMuted;
  return (
    <span style={{ fontSize: '12px', fontWeight: 400, color, fontFamily: HUB.fontRegular }}>
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
  const defaultBorder = `1px solid ${HUB.border}`;
  const selectedBg = HUB.accentSoft;
  const hoverBg = HUB.raised;

  // Probability bar colour
  const probColor = successProbability >= 65 ? HUB.positive : successProbability >= 40 ? HUB.warning : HUB.negative;

  if (compact) {
    return (
      <motion.button
        onClick={() => onSelect && onSelect(objective.id)}
        style={{
          width: '100%', textAlign: 'left', cursor: onSelect ? 'pointer' : 'default',
          padding: '12px 16px',
          background: isSelected ? selectedBg : hoverBg,
          border: isSelected ? selectedBorder : defaultBorder,
          borderRadius: '8px', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <ObjectiveIcon type={type} size={16} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>
                {label}
              </span>
              {isRecommended && <span style={{ ...pill(false), padding: '0 6px', fontSize: '11px' }}>Recommended</span>}
            </div>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>
              {expectedFinishRange} • {successProbability}% success • <RiskBadge level={riskLevel} />
            </span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 400, color: HUB.positive, fontFamily: HUB.fontMono }}>+${sponsorRewardM}M</div>
          <div style={{ fontSize: '11px', color: HUB.textFaint }}>Sponsor</div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={() => onSelect && onSelect(objective.id)}
      style={{
        width: '100%', textAlign: 'left', cursor: onSelect ? 'pointer' : 'default',
        padding: '16px',
        background: isSelected ? selectedBg : HUB.raised,
        border: isSelected ? selectedBorder : defaultBorder,
        borderRadius: '8px', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`,
        position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div style={{ background: HUB.surface, borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center' }}>
            <ObjectiveIcon type={type} size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontBold }}>
                {label}
              </span>
              {isRecommended && (
                <span style={{ ...pill(false), padding: '2px 6px', fontSize: '11px' }}>Recommended</span>
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
            border: `2px solid ${HUB.borderMid}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 400, color: probColor, fontFamily: HUB.fontMono, lineHeight: 1 }}>{successProbability}%</span>
          </div>
          <div style={{ fontSize: '11px', color: HUB.textFaint, marginTop: '4px' }}>Success</div>
        </div>
      </div>

      {/* Rationale */}
      <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '0 0 16px', lineHeight: '1.5' }}>
        {rationale}
      </p>

      {/* Success probability bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ height: '4px', background: HUB.surface, borderRadius: '2px', overflow: 'hidden' }}>
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
        <div style={{ background: HUB.surface, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '4px' }}>Expected</div>
          <div style={{ fontSize: '13px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{expectedFinishRange}</div>
        </div>
        <div style={{ background: HUB.surface, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '4px' }}>Sponsor</div>
          <div style={{ fontSize: '13px', fontWeight: 400, color: HUB.positive, fontFamily: HUB.fontMono }}>+${sponsorRewardM}M</div>
        </div>
        <div style={{ background: HUB.surface, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '4px' }}>Points impact</div>
          <div style={{ fontSize: '12px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{championshipImpact}</div>
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
    return <div style={{ color: HUB.textMuted, fontSize: '13px' }}>No objectives generated</div>;
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
