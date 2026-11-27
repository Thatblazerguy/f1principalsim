import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import './dashboard-interactive.css';

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Width of an element, kept in sync with ResizeObserver (so SVG draws at real pixels). */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

/** Number that tweens to its value (instant under reduced motion). */
export function Tween({ value, format = (v: number) => String(Math.round(v)), from }: { value: number; format?: (v: number) => string; from?: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(from ?? value);
  const [shown, setShown] = useState(reduce ? value : prev.current);
  useEffect(() => {
    if (reduce) { setShown(value); prev.current = value; return; }
    const controls = animate(prev.current, value, { duration: 0.6, ease: EASE, onUpdate: setShown });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <>{format(shown)}</>;
}

/** A "nice" axis maximum and its ticks (1/2/5 steps). */
export function niceScale(min: number, max: number, count = 4) {
  const span = Math.max(1e-6, max - min);
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks };
}

export const money = (v: number, sign = false) => `${sign && v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toFixed(1)}M`;

/**
 * Shared scrub behaviour: pointer (mouse/touch/pen) and keyboard both drive the
 * same index. Pointer snaps to the nearest x; arrows/Home/End step.
 */
export function useScrub(xs: number[], defaultIndex: number) {
  const [active, setActive] = useState<number | null>(null);
  const dragging = useRef(false);
  const nearest = (px: number) => {
    let best = 0, dist = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(x - px); if (d < dist) { dist = d; best = i; } });
    return best;
  };
  const local = (e: React.PointerEvent<Element>) => e.clientX - (e.currentTarget as Element).getBoundingClientRect().left;
  const handlers = {
    onPointerMove: (e: React.PointerEvent<SVGElement>) => {
      if (!xs.length) return;
      if (e.pointerType !== 'mouse' && !dragging.current) return;
      setActive(nearest(local(e)));
    },
    onPointerDown: (e: React.PointerEvent<SVGElement>) => {
      if (!xs.length) return;
      if (e.pointerType !== 'mouse') { dragging.current = true; }
      setActive(nearest(local(e)));
    },
    onPointerUp: () => { dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; setActive(null); },
    onPointerLeave: (e: React.PointerEvent<SVGElement>) => { if (e.pointerType === 'mouse') setActive(null); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!xs.length) return;
      const cur = active ?? defaultIndex;
      let next = cur;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, cur - 1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(xs.length - 1, cur + 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = xs.length - 1;
      else if (e.key === 'Escape') { setActive(null); return; }
      else return;
      e.preventDefault();
      setActive(next);
    },
    onFocus: () => { if (xs.length) setActive(a => a ?? defaultIndex); },
    onBlur: () => setActive(null),
  };
  const index = xs.length ? Math.min(active ?? defaultIndex, xs.length - 1) : null;
  return { index, scrubbing: active !== null, handlers };
}
