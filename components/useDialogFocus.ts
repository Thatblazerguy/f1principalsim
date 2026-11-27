import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus handling: remembers the opener, focuses `initial` (or the first
 * focusable) on open, keeps Tab inside `container`, closes on Escape, and
 * returns focus to the opener on close.
 */
export function useDialogFocus(open: boolean, container: React.RefObject<HTMLElement | null>, onClose: () => void, initial?: React.RefObject<HTMLElement | null>) {
  const opener = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const target = initial?.current || container.current?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !container.current) return;
      const items = Array.from(container.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const inside = container.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      const el = opener.current;
      if (el && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [open]);
}
