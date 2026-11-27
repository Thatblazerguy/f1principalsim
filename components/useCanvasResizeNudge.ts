import { useEffect } from 'react';

/**
 * Under the site-wide 80% zoom (style.css), react-three-fiber's first size
 * measurement can come back empty and the canvas stays at its 300×150 default.
 * Its measure hook re-reads on window resize, so nudge it a few times after mount.
 */
export function useCanvasResizeNudge() {
  useEffect(() => {
    const timers = [0, 150, 500, 1200].map(ms => setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
}
