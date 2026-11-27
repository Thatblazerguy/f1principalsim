import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Tag } from 'lucide-react';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import { buildTrackGeometry, analyseTrack, type Pt } from '../drivers/trackGeometry.ts';
import { speedKmh } from '../../utils/raceControlModel.js';

/*
 * Live race map. Every marker sits where the engine says the car is:
 * engine.cars[].distance (laps, fractional) mapped onto the real layout.
 * The rAF loop only eases each marker toward that distance so it glides
 * between frames; it never moves a car the engine hasn't moved.
 * Pitting cars are drawn along a pit lane beside the start line, using the
 * engine's own pit timer for progress.
 */

const PIT_SPAN = 0.045; // pit lane drawn over this share of the lap either side of the line

export function LiveCircuit({ engineRef, round, intel, rows, selectedId, onSelect, battles, lengthKm, broadcast, recentPass }: any) {
  const geo = useMemo(() => buildTrackGeometry(getTrackPath(round.name)), [round.name]);
  const an = useMemo(() => (geo ? analyseTrack(geo as any, intel?.corners ?? null) : null), [geo, intel?.corners]);
  const wrap = useRef<HTMLDivElement>(null);
  const markers = useRef<Record<string, SVGGElement | null>>({});
  const tipRef = useRef<SVGGElement>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0, focus: 'full' as string });
  const [labels, setLabels] = useState<'key' | 'all'>('key');
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const hoverRef = useRef<string | null>(null); hoverRef.current = hover;

  // Pit lane: a parallel offset of the track around the start line, on the infield side
  const pit = useMemo(() => {
    if (!geo) return null;
    const c: Pt = [geo.bbox.x + geo.bbox.w / 2, geo.bbox.y + geo.bbox.h / 2];
    const a = geo.sample(0); const b = geo.sample(0.004);
    let nx = -(b[1] - a[1]); let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if ((c[0] - a[0]) * nx + (c[1] - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
    const off = Math.max(9, Math.min(geo.bbox.w, geo.bbox.h) * 0.03);
    const at = (t: number): Pt => {
      const p = geo.sample(t); const q = geo.sample(t + 0.002);
      let mx = -(q[1] - p[1]); let my = q[0] - p[0]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      if (mx * nx + my * ny < 0) { mx = -mx; my = -my; }
      const k = Math.min(1, Math.min(t + PIT_SPAN, PIT_SPAN - t) / (PIT_SPAN * 0.35)); // ramp in/out
      return [p[0] + mx * off * Math.max(0, k), p[1] + my * off * Math.max(0, k)];
    };
    const pts: Pt[] = []; for (let i = 0; i <= 40; i++) pts.push(at(-PIT_SPAN + (i / 40) * PIT_SPAN * 2));
    return { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(''), at, entry: pts[0], exit: pts[pts.length - 1] };
  }, [geo]);

  // Sector bounds for the focused view
  const sectorBox = (s: number) => {
    const N = geo!.pts.length - 1; const third = Math.round(N / 3);
    const seg = geo!.pts.slice(s * third, s === 2 ? N + 1 : (s + 1) * third + 1);
    const xs = seg.map(p => p[0]); const ys = seg.map(p => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const pad = 40;
  const full = geo ? { w: geo.bbox.w + pad * 2, h: geo.bbox.h + pad * 2 } : { w: 1, h: 1 };

  const focusSector = (f: string) => {
    if (!geo || f === 'full') { setView({ zoom: 1, x: 0, y: 0, focus: 'full' }); return; }
    const b = sectorBox(Number(f.slice(1)) - 1);
    const z = Math.min(3.2, Math.max(1.2, Math.min(full.w / (b.w + pad * 2), full.h / (b.h + pad * 2))));
    setView({ zoom: z, x: b.x + b.w / 2 - (geo.bbox.x + geo.bbox.w / 2), y: b.y + b.h / 2 - (geo.bbox.y + geo.bbox.h / 2), focus: f });
  };

  // Marker motion: ease visual distance toward the engine's distance every frame
  useEffect(() => {
    if (!geo || !pit) return;
    const vis = new Map<string, { d: number; pitTotal: number | null }>();
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dtf = Math.min(0.1, (now - last) / 1000); last = now;
      const e = engineRef.current; if (!e) return;
      const k = 1 - Math.exp(-dtf * 14);
      const scale = 1 / Math.sqrt(viewRef.current.zoom);
      for (const car of e.cars) {
        let v = vis.get(car.id);
        if (!v) { v = { d: car.distance, pitTotal: null }; vis.set(car.id, v); }
        const diff = car.distance - v.d;
        v.d = Math.abs(diff) > 0.35 ? car.distance : v.d + diff * k;
        let p: Pt;
        if (car.pitStopStatus === 'Pitting') {
          if (v.pitTotal == null) v.pitTotal = Math.max(car.pitTimer, 1);
          const prog = Math.min(1, Math.max(0, 1 - car.pitTimer / v.pitTotal));
          p = pit.at(-PIT_SPAN * 0.7 + prog * PIT_SPAN * 1.4);
        } else {
          v.pitTotal = null;
          p = geo.sample(Math.max(0, v.d));
        }
        const g = markers.current[car.id];
        if (g) g.setAttribute('transform', `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) scale(${scale.toFixed(3)})`);
        if (hoverRef.current === car.id && tipRef.current) tipRef.current.setAttribute('transform', `translate(${p[0].toFixed(2)} ${p[1].toFixed(2)}) scale(${scale.toFixed(3)})`);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [geo, pit]);
  const viewRef = useRef(view); viewRef.current = view;

  if (!geo || !an || !pit) return <div className="rc-map rc-map-empty">No layout for this circuit</div>;

  const vbW = full.w / view.zoom; const vbH = full.h / view.zoom;
  const cx = geo.bbox.x + geo.bbox.w / 2 + view.x; const cy = geo.bbox.y + geo.bbox.h / 2 + view.y;
  const viewBox = `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`;
  const unitsPerPx = () => { const r = wrap.current?.getBoundingClientRect(); return r ? Math.max(vbW / r.width, vbH / r.height) : 1; };
  const setZoom = (z: number) => { const nz = Math.min(5, Math.max(1, Math.round(z * 100) / 100)); setView(v => nz === 1 ? { zoom: 1, x: 0, y: 0, focus: 'full' } : { ...v, zoom: nz, focus: 'custom' }); };

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('.rc-map-ctrl, .rc-mk')) return;
    drag.current = { x: e.clientX, y: e.clientY, px: view.x, py: view.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved && view.zoom > 1) { const u = unitsPerPx(); setView(v => ({ ...v, x: d.px - dx * u, y: d.py - dy * u, focus: 'custom' })); }
  };
  const onUp = () => { drag.current = null; };

  const e = engineRef.current;
  const centre: Pt = [geo.bbox.x + geo.bbox.w / 2, geo.bbox.y + geo.bbox.h / 2];
  const N = geo.pts.length - 1;
  const selCar = selectedId ? e?.cars.find((c: any) => c.id === selectedId) : null;
  const selSector = selCar && !selCar.retired && selCar.pitStopStatus !== 'Pitting' ? Math.min(2, Math.floor((((selCar.distance % 1) + 1) % 1) * 3)) : null;
  const battleIds = new Map<string, any>();
  battles.forEach((b: any) => b.cars.slice(1).forEach((c: any) => battleIds.set(c.id, b)));
  const showLabel = (r: any) => labels === 'all' || r.isPlayer || r.pos <= 3 || r.id === selectedId || r.id === hover
    || (battleIds.has(r.id) && (battleIds.get(r.id).pos <= 3 || battleIds.get(r.id).involvesPlayer));
  const hovered = hover ? rows.find((r: any) => r.id === hover) : null;
  const ordered = [...rows].reverse(); // leader drawn last, on top
  const outward = (p: Pt, dist: number): Pt => { const dx = p[0] - centre[0]; const dy = p[1] - centre[1]; const l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * dist, p[1] + dy / l * dist]; };
  const sectorTick = (t: number, label: string) => {
    const p = geo.sample(t); const o = outward(p, 16);
    return <g key={label} className="rc-m-sec-tick"><circle cx={p[0]} cy={p[1]} r={2.6} /><text x={o[0]} y={o[1]}>{label}</text></g>;
  };
  const start = geo.sample(0); const a1 = geo.sample(0.006);
  const startAng = Math.atan2(a1[1] - start[1], a1[0] - start[0]) * 180 / Math.PI;

  return (
    <div className={`rc-map ${broadcast ? 'is-broadcast' : ''}`} ref={wrap} data-zoomed={view.zoom > 1}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onWheel={(ev) => setZoom(view.zoom * (ev.deltaY < 0 ? 1.12 : 0.9))}>
      <div className="rc-map-grid" aria-hidden="true" />
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Live map of ${round.circuit} with ${rows.length} cars`}>
        <path d={geo.d} className="rc-m-edge" />
        <path d={geo.d} className="rc-m-base" />
        {geo.sectors.map((s, i) => <path key={s.id} d={s.d} className={`rc-m-sector is-s${i + 1} ${selSector === i ? 'is-cur' : ''} ${view.focus === `s${i + 1}` ? 'is-focus' : ''}`} />)}
        {geo.drs && <path d={geo.drs.d} className="rc-m-drs" />}
        {geo.drs && (() => { const o = outward(geo.drs.mid, 18); return <text x={o[0]} y={o[1]} className="rc-m-drs-label">DRS</text>; })()}
        <path d={pit.d} className="rc-m-pit" />
        {(() => { const o1 = outward(pit.entry, -12); const o2 = outward(pit.exit, -12); return (<>
          <text x={o1[0]} y={o1[1]} className="rc-m-pitlabel">Pit in</text>
          <text x={o2[0]} y={o2[1]} className="rc-m-pitlabel">Pit out</text>
        </>); })()}
        {an.corners.map(c => { const o = outward(c.at, 13); return (
          <g key={c.n} className="rc-m-corner"><circle cx={o[0]} cy={o[1]} r={6} /><text x={o[0]} y={o[1]}>{c.n}</text></g>
        ); })}
        {sectorTick(1 / 3, 'S2')}{sectorTick(2 / 3, 'S3')}
        <g className="rc-m-start" transform={`translate(${start[0]} ${start[1]}) rotate(${startAng})`}>
          <rect x={-1.5} y={-10} width={3} height={20} />
          <path d="M8 -4 L15 0 L8 4" />
        </g>

        {ordered.map((r: any) => {
          const b = battleIds.get(r.id);
          return (
            <g key={r.id} ref={el => { markers.current[r.id] = el; }}
              className={['rc-mk', r.isPlayer && 'is-ours', r.state === 'out' && 'is-out', r.state === 'pitting' && 'is-pitting', r.id === selectedId && 'is-sel', b && 'is-battle', recentPass?.has(r.id) && 'is-pass', r.pos === 1 && 'is-leader'].filter(Boolean).join(' ')}
              style={{ ['--tc' as any]: r.color }}
              onPointerEnter={() => setHover(r.id)} onPointerLeave={() => setHover(h => (h === r.id ? null : h))}
              onClick={() => onSelect(r.id)} role="button" tabIndex={-1} aria-label={`P${r.pos} ${r.name}`}>
              <circle className="rc-mk-hit" r={11} />
              {b && <circle className="rc-mk-ring" r={10} />}
              <circle className="rc-mk-pass" r={7} />
              <circle className="rc-mk-dot" r={r.isPlayer ? 6 : 5} />
              {r.isPlayer && <circle className="rc-mk-core" r={2} />}
              {showLabel(r) && (
                <g className="rc-mk-label" transform="translate(9 -9)">
                  <rect x={-2} y={-8} width={r.isPlayer || r.id === selectedId ? 44 : 34} height={12} rx={2} />
                  <text x={2} y={1}><tspan className="rc-mk-pos">{r.pos}</tspan> {r.code}</text>
                </g>
              )}
              {b && (r.isPlayer || b.pos <= 3) && <text className="rc-mk-gap" x={-9} y={-11} textAnchor="end">{b.cars.find((c: any) => c.id === r.id)?.interval?.sec?.toFixed(1)}s</text>}
            </g>
          );
        })}

        {hovered && (
          <g ref={tipRef} className="rc-m-tip" pointerEvents="none">
            <g transform="translate(12 10)">
              <rect width={128} height={44} rx={4} />
              <rect width={3} height={44} rx={1} style={{ fill: hovered.color }} />
              <text x={9} y={14} className="rc-m-tip-title">P{hovered.pos} {hovered.name}</text>
              <text x={9} y={27}>{hovered.state === 'pitting' ? 'In the pit lane' : hovered.state === 'out' ? 'Retired' : `${speedKmh(hovered.car, lengthKm) || '–'} km/h avg this lap`}</text>
              <text x={9} y={39}>{hovered.compound} · {Math.floor(hovered.tyreAge)} laps · {Math.round(hovered.wear)}% worn</text>
            </g>
          </g>
        )}
      </svg>

      <div className="rc-map-ctrl">
        <div className="rc-seg is-small" role="radiogroup" aria-label="Map view">
          {['full', 's1', 's2', 's3'].map(f => (
            <button key={f} type="button" role="radio" aria-checked={view.focus === f} className={view.focus === f ? 'is-on' : ''} onClick={() => focusSector(f)}>{f === 'full' ? 'Full lap' : f.toUpperCase()}</button>
          ))}
        </div>
        <button type="button" className={`rc-icon ${labels === 'all' ? 'is-on' : ''}`} onClick={() => setLabels(l => (l === 'all' ? 'key' : 'all'))} aria-pressed={labels === 'all'} aria-label="Label every car" title={labels === 'all' ? 'Label key cars only' : 'Label every car'}><Tag size={15} strokeWidth={1.5} /></button>
        <button type="button" className="rc-icon" onClick={() => setZoom(view.zoom * 1.3)} aria-label="Zoom in"><ZoomIn size={15} strokeWidth={1.5} /></button>
        <button type="button" className="rc-icon" onClick={() => setZoom(view.zoom / 1.3)} aria-label="Zoom out" disabled={view.zoom <= 1}><ZoomOut size={15} strokeWidth={1.5} /></button>
        <button type="button" className="rc-icon" onClick={() => focusSector('full')} aria-label="Reset view" disabled={view.zoom === 1}><Maximize2 size={15} strokeWidth={1.5} /></button>
      </div>
      <p className="rc-map-legend" aria-hidden="true">
        <span><i className="is-ours" />Our cars</span><span><i className="is-battle" />Within 1s</span><span><i className="is-drs" />DRS straight</span>
        {selCar && selSector != null && <span><i className="is-cur" />{selCar.driver.name.split(' ').pop()} in sector {selSector + 1}</span>}
      </p>
    </div>
  );
}
