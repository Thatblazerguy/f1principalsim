import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUB, glassCard, actionBtn } from './HubLayout.tsx';
import { NegotiationSession } from '../game/driverNegotiation.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';

export const DriverNegotiationModal = ({
  driver,
  team,
  onComplete // (status) => void
}: {
  driver: any,
  team: any,
  onComplete: (status: string) => void
}) => {
  const [session, setSession] = useState<NegotiationSession | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSession(new NegotiationSession(driver, team));
  }, [driver, team]);

  if (!session) return null;

  const handleOptionClick = (optionId: string) => {
    if (optionId === 'finish') {
      onComplete(session.status);
    } else {
      session.selectOption(optionId);
      setTick(t => t + 1); // Force re-render
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{
          ...glassCard({ padding: 0 }),
          width: '800px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${HUB.borderMid}`
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: `1px solid ${HUB.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)'
        }}>
          <div style={{
            width: '80px', height: '80px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: HUB.sidebar,
            border: `2px solid ${HUB.accent}`
          }}>
            <img 
              src={getDriverHeadshotUrl(driver.name)} 
              alt={driver.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <div style={{ fontFamily: HUB.fontWide, fontSize: '12px', color: HUB.accent, letterSpacing: '1px' }}>
              CONTRACT NEGOTIATION
            </div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: '24px', color: HUB.textPrimary }}>
              {driver.name}
            </div>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: '14px', color: HUB.textMuted }}>
              Resistance: {Math.max(0, session.resistance)} | Morale: {driver.morale}
            </div>
          </div>
        </div>

        {/* Conversation Area */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '300px'
        }}>
          <AnimatePresence mode="popLayout">
            {session.history.map((line: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: line.speaker === 'You' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  alignSelf: line.speaker === 'You' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  background: line.speaker === 'You' ? 'rgba(225, 6, 0, 0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${line.speaker === 'You' ? 'rgba(225, 6, 0, 0.3)' : HUB.border}`,
                  borderRadius: '12px',
                  padding: '16px'
                }}
              >
                <div style={{ fontFamily: HUB.fontBold, fontSize: '12px', color: line.speaker === 'You' ? HUB.accent : HUB.textMuted, marginBottom: '8px' }}>
                  {line.speaker}
                </div>
                <div style={{ fontFamily: HUB.fontRegular, fontSize: '16px', color: HUB.textPrimary, lineHeight: 1.5 }}>
                  "{line.text}"
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Options Area */}
        <div style={{
          padding: '24px',
          borderTop: `1px solid ${HUB.border}`,
          background: HUB.sidebar,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {session.options.map((opt: any) => (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(opt.id)}
              style={{
                ...actionBtn({ 
                  width: '100%', 
                  textAlign: 'left', 
                  justifyContent: 'flex-start',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${HUB.border}`,
                  padding: '16px'
                }),
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = HUB.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = HUB.border;
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: HUB.accent }} />
                <span style={{ fontFamily: HUB.fontRegular, fontSize: '14px', color: HUB.textPrimary }}>
                  "{opt.text}"
                </span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
