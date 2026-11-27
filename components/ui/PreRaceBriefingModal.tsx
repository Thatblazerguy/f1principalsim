import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUB, glassCard, btn, btnClass } from '../HubLayout.tsx';
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
            width: '100%', maxWidth: '780px', maxHeight: 'calc(92*var(--vh))',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
          }}
        >
          {/* ── Header ── */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${HUB.border}`, background: HUB.sidebar }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: HUB.raised, borderRadius: '8px', padding: '8px', display: 'flex' }}>
                <Brain size={16} strokeWidth={1.5} color={HUB.textMuted} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary }}>
                  Race engineer briefing
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: HUB.textMuted }}>
                  {raceWeekend ? `${raceWeekend.grandPrix} • ${raceWeekend.circuit}` : 'Pre-race strategy briefing'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Row 1: Context cards */}
            {raceWeekend && (
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Team tier</div>
                  <div style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{raceWeekend.tier.label}</div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginTop: '4px' }}>Expectation score {raceWeekend.expectationScore}</div>
                </div>

                <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Conditions</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: HUB.textPrimary, fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold }}>
                    {raceWeekend.weather.isWet ? <CloudRain size={16} strokeWidth={1.5} color={HUB.textMuted} /> : <Sun size={16} strokeWidth={1.5} color={HUB.textMuted} />}
                    {raceWeekend.weather.isWet ? 'Wet race expected' : 'Dry conditions'} • {raceWeekend.weather.trackTemperature}°C
                  </div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginTop: '4px' }}>Rain probability {raceWeekend.weather.rainProbability}%</div>
                </div>

                <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Nearest rival</div>
                  <div style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{raceWeekend.standingsImpact.nearestRival || '—'}</div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginTop: '4px' }}>
                    Gap {Math.abs(raceWeekend.standingsImpact.gapToRival)} pts
                  </div>
                </div>

                <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Circuit type</div>
                  <div style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{raceWeekend.circuitType}</div>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginTop: '4px' }}>
                    {raceWeekend.circuitProfile?.type || 'Mixed'} layout
                    {circuitHistory?.sampleSize > 0 && ` • ${circuitHistory.sampleSize} race(s) of history`}
                  </div>
                </div>
              </div>
            )}

            {/* Row 2: Finish Distribution */}
            {finishDist && (
              <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />
                  <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>
                    Expected outcomes
                  </span>
                </div>
                <FinishDistributionBar finishDist={finishDist} />

                {circuitHistory?.sampleSize >= 2 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${HUB.border}`, display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: HUB.textFaint }}>Circuit history</div>
                      <div style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>
                        Avg finish P{circuitHistory.avgFinish ?? '—'} • Best P{circuitHistory.bestFinish ?? '—'}
                      </div>
                    </div>
                    {circuitHistory.safetyCarFrequency > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', color: HUB.textFaint }}>SC frequency</div>
                        <div style={{ fontSize: '13px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{circuitHistory.safetyCarFrequency}% of races</div>
                      </div>
                    )}
                    {circuitHistory.dnfRate > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', color: HUB.textFaint }}>DNF rate here</div>
                        <div style={{ fontSize: '13px', color: circuitHistory.dnfRate > 30 ? HUB.negative : HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{circuitHistory.dnfRate}%</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Objective Selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Flag size={16} strokeWidth={1.5} color={HUB.textMuted} />
                <h3 style={{ margin: 0, fontSize: '13px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary }}>
                  Race objective <span style={{ fontFamily: HUB.fontRegular, color: HUB.textFaint }}>{objectives.length} options</span>
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
                <p style={{ color: HUB.textMuted, fontSize: '13px' }}>No objectives available</p>
              )}
            </div>

            {/* Selected objective detail (if selected and has rationale) */}
            {selectedObj && (
              <motion.div
                key={selectedObj.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px' }}
              >
                <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>
                  Why this objective
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: HUB.textMuted, lineHeight: '1.5' }}>
                  {selectedObj.rationale}
                </p>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: HUB.textMuted }}>
                  <span>Expected <strong style={{ color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontMono }}>{selectedObj.expectedFinishRange}</strong></span>
                  <span>Success <strong style={{ fontWeight: 400, fontFamily: HUB.fontMono, color: selectedObj.successProbability >= 65 ? HUB.positive : selectedObj.successProbability >= 40 ? HUB.warning : HUB.negative }}>{selectedObj.successProbability}%</strong></span>
                  <span>Sponsor <strong style={{ color: HUB.positive, fontWeight: 400, fontFamily: HUB.fontMono }}>+${selectedObj.sponsorRewardM}M</strong></span>
                  <span>Points <strong style={{ color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontMono }}>{selectedObj.championshipImpact}</strong></span>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${HUB.border}`, background: HUB.sidebar, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: HUB.textMuted }}>
              {selectedObj ? selectedObj.label : 'Select an objective above'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} className={btnClass('secondary')} style={btn('secondary', 'md')}>
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedObjective}
                className={btnClass('primary')}
                style={btn('primary', 'md')}
              >
                {mode === 'quick_sim' ? 'Start quick sim' : 'Start race control'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
