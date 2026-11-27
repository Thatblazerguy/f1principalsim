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
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              backgroundColor: HUB.surface,
              border: `1px solid ${HUB.border}`,
              borderRadius: '8px',
              padding: '8px 12px',
              color: HUB.textPrimary,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            <div style={{ fontSize: '11px', color: HUB.textFaint, fontFamily: HUB.fontRegular }}>
              Lap {Math.floor(ev.time / 90) + 1}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontBold }}>
              {ev.msg}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
