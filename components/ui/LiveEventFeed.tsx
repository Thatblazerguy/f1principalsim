import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HUB } from '../HubLayout.tsx';

export function LiveEventFeed({ events }) {
  // Only show the 5 most recent events
  const recentEvents = [...events].reverse().slice(0, 5);

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '416px',
      width: '280px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 40,
      pointerEvents: 'none'
    }}>
      <AnimatePresence>
        {recentEvents.map((ev, index) => (
          <motion.div
            key={ev.time + ev.msg} // unique enough for events
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              backgroundColor: 'rgba(15, 15, 20, 0.85)',
              backdropFilter: 'blur(12px)',
              borderLeft: `3px solid ${ev.msg.includes('Overtake') ? '#10b981' : ev.msg.includes('Pit') ? '#3b82f6' : HUB.accent}`,
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>
              LAP {Math.floor(ev.time / 90) + 1}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {ev.msg}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
