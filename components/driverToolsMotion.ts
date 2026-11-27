import { useEffect, useRef, useState } from 'react';

/** Matches HUB.ease cubic-bezier(0.22, 1, 0.36, 1) closely (ease-out quint family). */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * Tweens a number (or array of numbers) toward `target`. Interruptible: a new
 * target starts from whatever value is currently on screen. Instant under
 * reduced motion.
 */
export function useTween<T extends number | number[]>(target: T, duration = 420): T {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState<T>(target);
  const current = useRef<T>(target);
  const raf = useRef<number | null>(null);
  const key = Array.isArray(target) ? target.join(',') : String(target);

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (reduced || duration <= 0) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    const lerp = (a: any, b: any, t: number): any =>
      Array.isArray(b)
        ? b.map((bv: number, i: number) => {
            const av = Array.isArray(a) && a[i] !== undefined ? a[i] : bv;
            return av + (bv - av) * t;
          })
        : (a as number) + ((b as number) - (a as number)) * t;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = lerp(from, target, easeOut(t)) as T;
      current.current = next;
      setValue(next);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced, duration]);

  return value;
}
