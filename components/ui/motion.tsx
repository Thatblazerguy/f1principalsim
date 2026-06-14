import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';

// ----------------------------------------------------------------------
// STANDARD TRANSITIONS (Emil Kowalski style)
// ----------------------------------------------------------------------

// 1. Fast, precise, zero-bounce spring. Ideal for layout animations and snappy interactions.
export const springTransition = { 
  type: "spring", 
  bounce: 0, 
  duration: 0.3 
};

// 2. Smooth ease-out. Ideal for simple fades and subtle entrances.
export const easeTransition = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] // Custom ease-out curve
};

// 3. Ultra-fast transition for micro-interactions (e.g., hover states)
export const microTransition = {
  duration: 0.15,
  ease: "easeOut"
};

// ----------------------------------------------------------------------
// REUSABLE MOTION COMPONENTS
// ----------------------------------------------------------------------

/**
 * PageTransition wrapper for main screen changes.
 * Extremely subtle fade and blur in, NO slide to avoid feeling bouncy.
 */
export const PageTransition = ({ children, id }: { children: React.ReactNode, id: string }) => {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  );
};

/**
 * SlideUp for staggering elements within a page (e.g. Dashboard cards).
 * Very subtle 8px Y offset so it doesn't feel dramatic.
 */
export const SlideUp = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay }}
    >
      {children}
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// ANIMATED COUNTERS & DATA
// ----------------------------------------------------------------------

/**
 * Animates a number value changing. Good for budget, points, etc.
 */
export const AnimatedNumber = ({ value, formatter = (v: number) => Math.round(v).toString(), className = "", style = {} }: { value: number, formatter?: (v: number) => string, className?: string, style?: React.CSSProperties }) => {
  const [display, setDisplay] = useState(formatter(value));
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { bounce: 0, duration: 600 });
  
  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplay(formatter(latest));
    });
  }, [springValue, formatter]);

  return <span className={className} style={style}>{display}</span>;
};

/**
 * Animates a progress bar width
 */
export const AnimatedBar = ({ progress, color, height = "4px", style = {} }: { progress: number, color: string, height?: string, style?: React.CSSProperties }) => {
  return (
    <div style={{ width: '100%', height, background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', ...style }}>
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={springTransition}
        style={{ height: '100%', background: color }}
      />
    </div>
  );
};
