import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const money = (v: number, dp = 1) => `$${(v ?? 0).toFixed(dp)}M`;

/** Brand wordmark tile. No real logos are used; initials on a quiet tile with a muted brand tint. */
export function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  const hash = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const hue = hash % 360;
  const initials = String(name).replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="cm-mono" style={{ width: size, height: size, fontSize: size * 0.36, ['--cm-hue' as any]: hue }} aria-hidden="true">{initials}</span>
  );
}

export function Modal({ open, onClose, labelId, wide = false, children }: { open: boolean; onClose: () => void; labelId: string; wide?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(open, ref, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="cm-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelId} className={`cm-dialog ${wide ? 'is-wide' : ''}`}
            initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.32, ease: EASE }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function DialogHead({ id, kicker, title, onClose, children }: { id: string; kicker: string; title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="cm-dialog-head">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
        {children}
        <div style={{ minWidth: 0 }}>
          <p className="cm-kicker">{kicker}</p>
          <h3 id={id} className="cm-dialog-title">{title}</h3>
        </div>
      </div>
      <button type="button" className={btnClass('ghost')} style={iconBtn('md')} onClick={onClose} aria-label="Close"><X size={16} strokeWidth={1.5} /></button>
    </div>
  );
}

export function OddsMeter({ odds }: { odds: number }) {
  const tone = odds >= 70 ? 'is-good' : odds >= 40 ? 'is-mid' : 'is-low';
  return (
    <div className={`cm-odds ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={odds} aria-label={`${odds}% chance they accept`}>
      <div className="cm-odds-top"><span>Chance they accept</span><strong>{odds}%</strong></div>
      <div className="cm-odds-bar"><span style={{ transform: `scaleX(${odds / 100})` }} /></div>
    </div>
  );
}
