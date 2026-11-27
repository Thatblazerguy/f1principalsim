// Shared, mutable scroll state for the landing experience.
// DOM (GSAP ScrollTrigger) writes it, the 3D scene reads it every frame.
// Kept outside React so scrolling never triggers re-renders.

export const SECTIONS = ['hero', 'engineering', 'team', 'strategy', 'race', 'legacy'] as const;
export type SectionId = typeof SECTIONS[number];

export const story = {
  /** Continuous story position: section index + progress through it (0..SECTIONS.length) */
  t: 0,
  /** Pointer position, -1..1 */
  mouse: { x: 0, y: 0 },
  reduced: false,
  mobile: false,
};

/** Progress (0..1) through section `i` for the current story position. */
export const local = (i: number) => Math.min(1, Math.max(0, story.t - i));

/** 0 outside [a, b], ramps to 1 inside with soft edges of width `edge`. */
export const window01 = (x: number, a: number, b: number, edge = 0.06) => {
  if (x <= a - edge || x >= b + edge) return 0;
  if (x < a) return smooth((x - (a - edge)) / edge);
  if (x > b) return 1 - smooth((x - b) / edge);
  return 1;
};

export const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Tyre compound colours (match HUB.tyre in components/HubLayout.tsx)
export const TYRE = { soft: '#e5484d', medium: '#e8c547', hard: '#ededed' };
export const ACCENT = '#E10600';

/** Car model slot: drop a licensed .glb in /public/models and set its path here to replace the procedural car. */
export const CAR_MODEL_URL: string | null = null;
