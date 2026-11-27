import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from './driverToolsMotion.ts';
import './driverTools.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Shared shell for the comparison and contract-builder dialogs: portal to
 * <body>, fade + short rise, Escape closes, focus trapped and restored.
 */
export function DriverToolsModal({
  prefix,
  labelledBy,
  onClose,
  children,
}: {
  prefix: 'drc' | 'ctb';
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') || node;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((el) => el.offsetParent !== null || el.getAttribute('tabindex') === '0');
      if (!focusables.length) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <motion.div
      className={`${prefix}-overlay`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: EASE }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={dialogRef}
        className={`${prefix}-dialog`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.38, ease: EASE }}
        style={{ outline: 'none' }}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
