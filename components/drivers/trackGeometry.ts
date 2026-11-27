/*
 * Splits a circuit SVG path (data/realTrackLayouts.js) into parts the
 * background map can highlight. The layouts carry no timing-line data, so:
 *  - sectors are equal thirds of the lap distance, labelled as such
 *  - the DRS zone is the longest near-straight run of the path
 */

export type Pt = [number, number];
export interface TrackGeometry {
  d: string;
  length: number;
  bbox: { x: number; y: number; w: number; h: number };
  sectors: { id: string; label: string; d: string; mid: Pt }[];
  drs: { d: string; mid: Pt; share: number } | null;
  sample: (t: number) => Pt;
  pts: Pt[];
  drsRange: { start: number; len: number } | null;
}

const SAMPLES = 480;
const cache = new Map<string, TrackGeometry>();

const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');

export function buildTrackGeometry(d: string): TrackGeometry | null {
  if (cache.has(d)) return cache.get(d)!;
  if (typeof document === 'undefined') return null;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  let length = 0;
  try { length = path.getTotalLength(); } catch { return null; }
  if (!length) return null;

  const pts: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = path.getPointAtLength((i / SAMPLES) * length);
    pts.push([p.x, p.y]);
  }
  const xs = pts.map(p => p[0]); const ys = pts.map(p => p[1]);
  const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };

  const third = Math.round(SAMPLES / 3);
  const bounds = [0, third, third * 2, SAMPLES];
  const sectors = [0, 1, 2].map(i => {
    const seg = pts.slice(bounds[i], bounds[i + 1] + 1);
    return { id: `s${i + 1}`, label: `Sector ${i + 1}`, d: toD(seg), mid: seg[Math.floor(seg.length / 2)] };
  });

  // Longest run where the heading barely changes. Wraps around the lap.
  const heading = (i: number) => {
    const a = pts[i % SAMPLES]; const b = pts[(i + 1) % SAMPLES];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const turn = (i: number) => {
    let x = heading(i + 1) - heading(i);
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return Math.abs(x);
  };
  let best = { start: 0, len: 0 }; let runStart = 0; let run = 0; let drift = 0;
  for (let i = 0; i < SAMPLES * 2; i++) {
    const t = turn(i);
    drift += t;
    if (t < 0.05 && drift < 0.22) { run++; }
    else { run = 0; drift = 0; runStart = i + 1; }
    if (run > best.len && run < SAMPLES) best = { start: runStart, len: run };
  }
  let drs: TrackGeometry['drs'] = null;
  if (best.len > SAMPLES * 0.04) {
    const seg: Pt[] = [];
    for (let i = best.start; i <= best.start + best.len; i++) seg.push(pts[i % SAMPLES]);
    drs = { d: toD(seg), mid: seg[Math.floor(seg.length / 2)], share: best.len / SAMPLES };
  }

  const sample = (t: number): Pt => {
    const f = ((t % 1) + 1) % 1 * SAMPLES;
    const i = Math.floor(f); const k = f - i;
    const a = pts[i]; const b = pts[Math.min(SAMPLES, i + 1)];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };

  const geo = { d, length, bbox, sectors, drs, sample, pts, drsRange: best.len > SAMPLES * 0.04 ? { start: best.start % SAMPLES, len: best.len } : null };
  cache.set(d, geo);
  return geo;
}

export interface Corner { n: number; index: number; at: Pt; angle: number; speed: 'Slow' | 'Medium' | 'Fast'; braking: boolean; dir: 'left' | 'right' }
export interface BrakingZone { corner: number; d: string; at: Pt; straight: number }
export interface TrackAnalysis { corners: Corner[]; braking: BrakingZone[]; arrow: { at: Pt; angle: number } }

const anCache = new Map<string, TrackAnalysis>();

/**
 * Corners and braking zones estimated from the layout's curvature.
 * The layouts carry no corner positions, so we take the `count` sharpest
 * direction changes (count comes from the circuit library) and number them in
 * path order. Braking zones are the last stretch of a long straight before a
 * slow or medium corner.
 */
export function analyseTrack(geo: TrackGeometry & { pts?: Pt[] }, count: number | null): TrackAnalysis {
  const key = `${geo.d.length}:${geo.d.slice(0, 40)}:${count}`;
  if (anCache.has(key)) return anCache.get(key)!;
  const pts = geo.pts!;
  const N = pts.length - 1;
  const at = (i: number) => pts[((i % N) + N) % N];
  const head = (i: number) => { const a = at(i), b = at(i + 1); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const wrap = (x: number) => { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; };
  // signed heading change over a ±3 sample window
  const turn = Array.from({ length: N }, (_, i) => wrap(head(i + 3) - head(i - 3)));
  const mag = turn.map(Math.abs);
  const peaks: number[] = [];
  for (let i = 0; i < N; i++) {
    const m = mag[i];
    if (m < 0.18) continue;
    let isMax = true;
    for (let k = -5; k <= 5 && isMax; k++) if (k && mag[((i + k) % N + N) % N] > m) isMax = false;
    if (isMax) peaks.push(i);
  }
  const minGap = Math.max(4, Math.round(N * 0.012));
  const chosen: number[] = [];
  [...peaks].sort((a, b) => mag[b] - mag[a]).forEach(i => {
    if (count && chosen.length >= count) return;
    if (chosen.every(j => Math.min(Math.abs(i - j), N - Math.abs(i - j)) >= minGap)) chosen.push(i);
  });
  chosen.sort((a, b) => a - b);

  // straight length (in samples) leading into each sample
  const m = (j: number) => mag[((j % N) + N) % N];
  // step back out of the corner itself, then measure the near-straight run before it
  const straightBefore = (i: number) => {
    let j = i; let guard = 0;
    while (m(j) >= 0.09 && guard++ < 40) j--;
    let k = 0;
    while (k < N && m(j - k) < 0.09) k++;
    return k;
  };
  const corners: Corner[] = chosen.map((i, idx) => {
    // absolute turning, so a chicane's left and right don't cancel out
    let total = 0; let abs = 0;
    for (let k = -8; k <= 8; k++) { const t = wrap(head(i + k + 1) - head(i + k)); total += t; abs += Math.abs(t); }
    const angle = Math.round(abs * 180 / Math.PI);
    const speed = angle >= 100 ? 'Slow' : angle >= 50 ? 'Medium' : 'Fast';
    const sb = straightBefore(i);
    return { n: idx + 1, index: i, at: at(i), angle, speed, braking: speed !== 'Fast' && sb > N * 0.025, dir: total > 0 ? 'right' : 'left' } as Corner;
  });

  const braking: BrakingZone[] = corners
    .filter(c => c.braking)
    .map(c => {
      const sb = straightBefore(c.index);
      const len = Math.max(3, Math.round(Math.min(sb, N * 0.04) * 0.6));
      const seg: Pt[] = [];
      for (let k = c.index - 6 - len; k <= c.index - 5; k++) seg.push(at(k));
      return { corner: c.n, d: toD(seg), at: seg[Math.floor(seg.length / 2)], straight: sb };
    })
    .sort((a, b) => b.straight - a.straight)
    .slice(0, 6);

  const a0 = at(2), a1 = at(8);
  const res = { corners, braking, arrow: { at: a0, angle: Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) * 180 / Math.PI } };
  anCache.set(key, res);
  return res;
}
