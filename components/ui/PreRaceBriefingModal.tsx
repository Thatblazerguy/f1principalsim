import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUB, glassCard, actionBtn } from '../HubLayout.tsx';
import { Target, CloudRain, Sun, Activity, Flag, Brain, TrendingUp } from 'lucide-react';
import { FinishDistributionBar, ObjectiveCardsList } from './ObjectiveCards.tsx';

export const PreRaceBriefingModal = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
  selectedObjective,
  setSelectedObjective,
  briefingData,
  raceWeekend,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => onConfirm(selectedObjective);

  const objectives = raceWeekend?.objectives || [];
  const finishDist = raceWeekend?.finishDistribution;
  const circuitHistory = raceWeekend?.circuitHistory;
  const selectedObj = objectives.find(o => o.id === selectedObjective);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }}
      >
        <motion.div
          className="mobile-fullscreen-modal"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
          style={{
            ...glassCard({ padding: 0 }),
            width: '100%', maxWidth: '780px', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08) inset',
          }}
        >
          {/* ── Header ── */}
          <div style={{ padding: '22px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,6,6,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{ background: `${HUB.accent}20`, borderRadius: '8px', padding: '8px', display: 'flex' }}>
                <Brain size={18} color={HUB.accent} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '17px', fontFamily: HUB.fontWide, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI Race Engineer Briefing
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: HUB.textMuted }}>
                  {raceWeekend ? `${raceWeekend.grandPrix} • ${raceWeekend.circuit}` : 'Pre-Race Strategy Briefing'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Row 1: Context cards */}
            {raceWeekend && (
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Team Tier</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{raceWeekend.tier.label}</div>
                  <div style={{ fontSize: '10px', color: '#10b981', marginTop: '3px' }}>Expectation Score: {raceWeekend.expectationScore}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Weather & Conditions</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px', fontWeight: 800 }}>
                    {raceWeekend.weather.isWet ? <CloudRain size={16} color="#60a5fa" /> : <Sun size={16} color="#fbbf24" />}
                    {raceWeekend.weather.isWet ? 'Wet Race Expected' : 'Dry Conditions'} • {raceWeekend.weather.trackTemperature}°C
                  </div>
                  <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '3px' }}>Rain probability: {raceWeekend.weather.rainProbability}%</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Main Rival</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{raceWeekend.standingsImpact.nearestRival || '—'}</div>
                  <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '3px' }}>
                    Gap: {Math.abs(raceWeekend.standingsImpact.gapToRival)} pts
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Circuit Type</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{raceWeekend.circuitType}</div>
                  <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '3px' }}>
                    {raceWeekend.circuitProfile?.type || 'Mixed'} layout
                    {circuitHistory?.sampleSize > 0 && ` • ${circuitHistory.sampleSize} race(s) of history`}
                  </div>
                </div>
              </div>
            )}

            {/* Row 2: Finish Distribution */}
            {finishDist && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Activity size={13} color={HUB.accent} />
                  <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    AI Performance Model — Expected Outcomes
                  </span>
                </div>
                <FinishDistributionBar finishDist={finishDist} />

                {circuitHistory?.sampleSize >= 2 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: HUB.textMuted }}>CIRCUIT HISTORY</div>
                      <div style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>
                        Avg Finish: P{circuitHistory.avgFinish ?? '—'} • Best: P{circuitHistory.bestFinish ?? '—'}
                      </div>
                    </div>
                    {circuitHistory.safetyCarFrequency > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', color: HUB.textMuted }}>SC FREQUENCY</div>
                        <div style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>{circuitHistory.safetyCarFrequency}% of races</div>
                      </div>
                    )}
                    {circuitHistory.dnfRate > 0 && (
                      <div>
                        <div style={{ fontSize: '9px', color: HUB.textMuted }}>DNF RATE HERE</div>
                        <div style={{ fontSize: '11px', color: circuitHistory.dnfRate > 30 ? '#ef4444' : '#fff', fontWeight: 700 }}>{circuitHistory.dnfRate}%</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Objective Selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Flag size={13} color={HUB.accent} />
                <h3 style={{ margin: 0, fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Select Race Objective — {objectives.length} AI-Generated Options
                </h3>
              </div>

              {objectives.length > 0 ? (
                <ObjectiveCardsList
                  objectives={objectives}
                  recommendedObjective={raceWeekend?.recommendedObjective}
                  selectedObjectiveId={selectedObjective}
                  onSelect={setSelectedObjective}
                  compact={true}
                />
              ) : (
                <p style={{ color: HUB.textMuted, fontSize: '13px' }}>No objectives available.</p>
              )}
            </div>

            {/* Selected objective detail (if selected and has rationale) */}
            {selectedObj && (
              <motion.div
                key={selectedObj.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(225,6,0,0.06)', border: `1px solid ${HUB.accent}30`, borderRadius: '8px', padding: '14px' }}
              >
                <div style={{ fontSize: '9px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  Selected Objective — AI Rationale
                </div>
                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#ccc', lineHeight: '1.5', fontStyle: 'italic' }}>
                  "{selectedObj.rationale}"
                </p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', color: HUB.textMuted }}>
                  <span>Expected: <strong style={{ color: '#fff' }}>{selectedObj.expectedFinishRange}</strong></span>
                  <span>Success: <strong style={{ color: selectedObj.successProbability >= 65 ? '#10b981' : selectedObj.successProbability >= 40 ? '#f59e0b' : '#ef4444' }}>{selectedObj.successProbability}%</strong></span>
                  <span>Sponsor: <strong style={{ color: '#10b981' }}>+${selectedObj.sponsorRewardM}M</strong></span>
                  <span>Pts: <strong style={{ color: '#fff' }}>{selectedObj.championshipImpact}</strong></span>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,6,6,0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: HUB.textMuted }}>
              {selectedObj ? `▶ ${selectedObj.emoji} ${selectedObj.label}` : 'Select an objective above'}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} style={{ ...actionBtn({ padding: '10px 20px' }), background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedObjective}
                style={{ ...actionBtn({ padding: '10px 28px' }), background: selectedObjective ? HUB.accent : 'rgba(255,255,255,0.1)', color: '#fff', opacity: selectedObjective ? 1 : 0.5 }}
              >
                {mode === 'quick_sim' ? '⚡ Start Quick Sim' : '🏁 Start Race Control'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
