import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUB, glassCard, actionBtn, pill } from '../HubLayout.tsx';
import { Target, AlertTriangle, Settings, CloudRain, Sun, Activity, Flag } from 'lucide-react';

export const PreRaceBriefingModal = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
  selectedObjective,
  setSelectedObjective,
  briefingData,
  raceWeekend // New unified raceWeekend prop!
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedObjective);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          style={{
            ...glassCard({ padding: 0 }),
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset'
          }}
        >
          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(10,10,10,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Target size={20} color={HUB.accent} />
              <h2 style={{ margin: 0, fontSize: '18px', fontFamily: HUB.fontWide, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Race Engineer Briefing
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: HUB.textMuted }}>
              {raceWeekend ? `${raceWeekend.grandPrix} • ${raceWeekend.circuit}` : 'Review pre‑race analysis and set strategic objective'}
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Briefing Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              
              {raceWeekend && (
                <>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Team Tier</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono }}>{raceWeekend.tier.label}</div>
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Expectation Score: {raceWeekend.expectationScore}</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Main Rival</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{raceWeekend.standingsImpact.nearestRival || 'Rivals'}</div>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>Gap: {Math.abs(raceWeekend.standingsImpact.gapToRival)} pts</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Weather & Conditions</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                      {raceWeekend.weather.isWet ? <CloudRain size={16} color="#60a5fa" /> : <Sun size={16} color="#fbbf24" />}
                      {raceWeekend.weather.isWet ? 'Wet Race Expected' : 'Dry Race'} • {raceWeekend.weather.trackTemperature}°C
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Recommended Objective</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{raceWeekend.recommendedObjective?.label || 'Balanced'}</div>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>Success: {raceWeekend.recommendedObjective?.successProbability}%</div>
                  </div>
                </>
              )}

              {!raceWeekend && (
                <>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Expected Finish</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono }}>{briefingData.expectedFinish}</div>
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>{briefingData.confidence}% Confidence</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Main Rival</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{briefingData.rivalTeam}</div>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>Nearest constructor threat</div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Weather & Conditions</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                      {briefingData.isWet ? <CloudRain size={16} color="#60a5fa" /> : <Sun size={16} color="#fbbf24" />}
                      {briefingData.isWet ? 'Wet Race Expected' : 'Dry Race'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Recommended Strategy</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{briefingData.strategyType}</div>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>Start on {briefingData.startTyre}</div>
                  </div>
                </>
              )}

            </div>

            {/* Objective Selection */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Flag size={14} color={HUB.accent} />
                <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Select Race Objective</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {raceWeekend ? raceWeekend.objectives.map((obj) => {
                  const isSelected = selectedObjective === obj.id;
                  return (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjective(obj.id)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: isSelected ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? HUB.accent : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                          {obj.label}
                        </div>
                        <div style={{ fontSize: '11px', color: HUB.textMuted }}>
                          Expected: {obj.expectedFinish} • Success: {obj.successProbability}% • {obj.sponsorBonus ? `Sponsor Bonus: +${obj.sponsorBonus}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Risk</span>
                        <span style={{ ...pill(isSelected), backgroundColor: isSelected ? HUB.accent : 'transparent', color: isSelected ? '#fff' : obj.riskLevel === 'High' || obj.riskLevel === 'Very High' ? '#ef4444' : HUB.textMuted, padding: '2px 8px' }}>
                          {obj.riskLevel}
                        </span>
                      </div>
                    </button>
                  );
                }) : RACE_OBJECTIVES.map((obj) => {
                  const isSelected = selectedObjective === obj.id;
                  return (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjective(obj.id)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: isSelected ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? HUB.accent : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                          {obj.label}
                        </div>
                        <div style={{ fontSize: '11px', color: HUB.textMuted }}>
                          AI behaviour modifier applied to both simulation models.
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Risk</span>
                        <span style={{ ...pill(isSelected), backgroundColor: isSelected ? HUB.accent : 'transparent', color: isSelected ? '#fff' : HUB.textMuted, padding: '2px 8px' }}>
                          {obj.risk}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer actions */}
          <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(10,10,10,0.5)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={onClose} style={actionBtn({ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' })}>
              Cancel
            </button>
            <button onClick={handleConfirm} style={actionBtn({ padding: '10px 24px', backgroundColor: HUB.accent, color: '#fff' })}>
              {mode === 'quick_sim' ? 'Start Quick Sim' : 'Start Race Control'}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Add RACE_OBJECTIVES for backward compatibility
const RACE_OBJECTIVES = [
  { id: 'win',          label: '🏆 Push For Win',         risk: 'High'    },
  { id: 'podium',       label: '🥈 Fight For Podium',      risk: 'Medium'  },
  { id: 'points',       label: '🎯 Finish In Points',       risk: 'Low'     },
  { id: 'conservative', label: '💰 Conservative Points',   risk: 'Minimal' },
  { id: 'gamble',       label: '🌧 Strategy Gamble',        risk: 'Extreme' },
];
