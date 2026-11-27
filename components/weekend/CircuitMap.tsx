import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, CloudRain, Sun } from 'lucide-react';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import { btnClass, iconBtn } from '../HubLayout.tsx';
import { buildTrackGeometry, analyseTrack, type Corner } from '../drivers/trackGeometry.ts';

/*
 * The preparation screen's centrepiece: the round's real layout
 * (data/realTrackLayouts.js), with sectors, estimated corners and braking
 * zones, the main straight as the DRS zone, start line, direction and an
 * animated racing line. Drag to pan, scroll or use the buttons to zoom,
 * click a sector to select it.
 */

type Layer = 'sectors' | 'corners' | 'braking' | 'drs' | 'line';
const LAYERS: { id: Layer; label: string }[] = [
  { id: 'sectors', label: 'Sectors' }, { id: 'corners', label: 'Corners' }, { id: 'braking', label: 'Braking' },
  { id: 'drs', label: 'DRS' }, { id: 'line', label: 'Racing line' },
];

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

export function CircuitMap({ intel, weather, selectedSector, onSelectSector, reduced }: {
  intel: any; weather: any; selectedSector: number | null; onSelectSector: (s: number | null) => void; reduced: boolean;
}) {
  const geo = useMemo(() => buildTrackGeometry(getTrackPath(intel?.grandPrix || 'British Grand Prix')), [intel?.grandPrix]);
  const an = useMemo(() => (geo ? analyseTrack(geo as any, intel?.corners ?? null) : null), [geo, intel?.corners]);
  const wrap = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tip, setTip] = useState<Tip>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ sectors: true, corners: true, braking: true, drs: true, line: true });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  // Subtle tilt toward the pointer
  useEffect(() => {
    if (reduced) return;
    const el = wrap.current; if (!el) return;
    let raf = 0; const cur = { x: 0, y: 0 }; const goal = { x: 0, y: 0 };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      goal.x = ((e.clientX - r.left) / r.width) * 2 - 1; goal.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const leave = () => { goal.x = 0; goal.y = 0; };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (drag.current) return;
      cur.x += (goal.x - cur.x) * 0.08; cur.y += (goal.y - cur.y) * 0.08;
      if (tilt.current) tilt.current.style.transform = `rotateX(${(-cur.y * 3).toFixed(2)}deg) rotateY(${(cur.x * 4).toFixed(2)}deg)`;
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [reduced]);

  if (!geo || !an) return <div className="wk-map wk-map-empty">No layout for this circuit</div>;

  const N = geo.pts.length - 1;
  const pad = 46;
  const vbW = (geo.bbox.w + pad * 2) / zoom; const vbH = (geo.bbox.h + pad * 2) / zoom;
  const cx = geo.bbox.x + geo.bbox.w / 2 + pan.x; const cy = geo.bbox.y + geo.bbox.h / 2 + pan.y;
  const viewBox = `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`;
  const unitsPerPx = () => { const r = wrap.current?.getBoundingClientRect(); return r ? Math.max(vbW / r.width, vbH / r.height) : 1; };

  const sectorOf = (index: number) => Math.min(2, Math.floor((index / N) * 3));
  const sectorCorners = (s: number) => an.corners.filter(c => sectorOf(c.index) === s);
  const km = intel?.lengthKm ? (intel.lengthKm / 3).toFixed(2) : null;

  const showTip = (e: React.PointerEvent, title: string, lines: string[]) => {
    const r = wrap.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, title, lines });
  };
  const cornerTip = (c: Corner) => [
    `${c.speed} ${c.dir}-hander · about ${c.angle}° of turn`,
    c.braking ? 'Heavy braking from the straight before it' : c.speed === 'Fast' ? 'Taken with little or no braking' : 'Short approach, moderate braking',
    `Sector ${sectorOf(c.index) + 1}`,
  ];

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('.wk-map-ctrl')) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved && zoom > 1) { const u = unitsPerPx(); setPan({ x: d.px - dx * u, y: d.py - dy * u }); setTip(null); }
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };
  const clampZoom = (z: number) => Math.min(4, Math.max(1, Math.round(z * 100) / 100));
  const setZ = (z: number) => { const nz = clampZoom(z); setZoom(nz); if (nz === 1) setPan({ x: 0, y: 0 }); };
  const clickSector = (s: number) => { if (drag.current?.moved) return; onSelectSector(selectedSector === s ? null : s); };

  const sectorLabel = (s: number) => {
    const cs = sectorCorners(s);
    return [cs.length ? `Turns ${cs[0].n}–${cs[cs.length - 1].n}` : 'No major corners', km ? `About ${km} km, a third of the lap` : 'A third of the lap', 'Click to select'];
  };

  return (
    <div className="wk-map" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onWheel={(e) => { setZ(zoom * (e.deltaY < 0 ? 1.12 : 0.9)); }} data-zoomed={zoom > 1}>
      <div className="wk-map-grid" aria-hidden="true" />
      <div className="wk-map-tilt" ref={tilt}>
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img"
          aria-label={`${intel?.circuit} layout: ${intel?.corners ?? an.corners.length} corners, ${intel?.lengthKm ?? '–'} km. Sectors can be selected below.`}>
          <path d={geo.d} className="wk-m-shadow" />
          <path d={geo.d} className="wk-m-base" />
          {layers.sectors && geo.sectors.map((s, i) => (
            <path key={s.id} d={s.d}
              className={`wk-m-sector wk-m-s${i + 1} ${selectedSector === i ? 'is-sel' : ''} ${hot === s.id ? 'is-hot' : ''} ${selectedSector != null && selectedSector !== i ? 'is-dim' : ''}`} />
          ))}
          {layers.drs && geo.drs && <path d={geo.drs.d} className={`wk-m-drs ${hot === 'drs' ? 'is-hot' : ''}`} />}
          {layers.braking && an.braking.map(b => <path key={`b${b.corner}`} d={b.d} className={`wk-m-brake ${hot === `b${b.corner}` ? 'is-hot' : ''}`} />)}
          {layers.line && !reduced && <path d={geo.d} pathLength={1000} className="wk-m-line" />}

          {/* start line + direction */}
          {(() => {
            const a = geo.pts[0]; const ang = an.arrow.angle;
            return (
              <g className="wk-m-start" transform={`translate(${a[0]} ${a[1]}) rotate(${ang})`}>
                <line x1={0} y1={-11} x2={0} y2={11} />
                <path d="M14 -5 L24 0 L14 5" className="wk-m-arrow" />
              </g>
            );
          })()}

          {/* hit areas */}
          {layers.sectors && geo.sectors.map((s, i) => (
            <path key={`h${s.id}`} d={s.d} className="wk-m-hit"
              onPointerEnter={(e) => { setHot(s.id); showTip(e, s.label, sectorLabel(i)); }}
              onPointerMove={(e) => showTip(e, s.label, sectorLabel(i))}
              onPointerLeave={() => { setHot(null); setTip(null); }}
              onClick={() => clickSector(i)} />
          ))}
          {layers.drs && geo.drs && (
            <path d={geo.drs.d} className="wk-m-hit"
              onPointerEnter={(e) => { setHot('drs'); showTip(e, 'DRS zone', [intel?.longestStraightM ? `Main straight · ${intel.longestStraightM} m` : 'Longest straight on the lap', 'Marked on the main straight; the game does not model DRS zones']); }}
              onPointerLeave={() => { setHot(null); setTip(null); }} />
          )}
          {layers.braking && an.braking.map(b => (
            <path key={`hb${b.corner}`} d={b.d} className="wk-m-hit"
              onPointerEnter={(e) => { setHot(`b${b.corner}`); showTip(e, `Braking zone · Turn ${b.corner}`, ['End of a long straight into a slow or medium corner']); }}
              onPointerLeave={() => { setHot(null); setTip(null); }} />
          ))}
          {layers.corners && an.corners.map(c => {
            const inSel = selectedSector != null && sectorOf(c.index) === selectedSector;
            const showNum = zoom >= 1.5 || inSel || hot === `c${c.n}`;
            return (
              <g key={`c${c.n}`} className={`wk-m-corner ${hot === `c${c.n}` ? 'is-hot' : ''} ${inSel ? 'is-sel' : ''}`}
                transform={`translate(${c.at[0]} ${c.at[1]})`}
                onPointerEnter={(e) => { setHot(`c${c.n}`); showTip(e, `Turn ${c.n}`, cornerTip(c)); }}
                onPointerLeave={() => { setHot(null); setTip(null); }}>
                <circle r={11} className="wk-m-corner-hit" />
                <circle r={4.5} className="wk-m-corner-dot" />
                {showNum && <text y={-9} textAnchor="middle">{c.n}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* floating telemetry */}
      <div className="wk-map-tl" aria-hidden="true">
        <span className="wk-k">{intel?.circuit}</span>
        <span className="wk-v">{[intel?.lengthKm && `${intel.lengthKm} km`, intel?.corners && `${intel.corners} corners`, intel?.laps && `${intel.laps} laps`].filter(Boolean).join(' · ')}</span>
      </div>
      {weather && (
        <div className="wk-map-tr" aria-label={`Track ${weather.trackTemperature}°C, air ${weather.airTemperature}°C, ${weather.rainProbability}% chance of rain`}>
          <span className={`wk-wx ${weather.isWet ? 'is-wet' : 'is-dry'}`} aria-hidden="true">
            {weather.isWet ? <CloudRain size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
          </span>
          <span className="wk-v">Track {weather.trackTemperature}° · Air {weather.airTemperature}°</span>
          <span className="wk-k">Rain {weather.rainProbability}%</span>
        </div>
      )}
      <div className="wk-map-sectors wk-map-ctrl" role="group" aria-label="Select a sector">
        {[0, 1, 2].map(i => (
          <button key={i} type="button" className={`wk-chip ${selectedSector === i ? 'is-on' : ''}`} aria-pressed={selectedSector === i}
            onClick={() => onSelectSector(selectedSector === i ? null : i)}>
            S{i + 1}<em>{sectorCorners(i).length} turns</em>
          </button>
        ))}
      </div>
      <div className="wk-map-layers wk-map-ctrl" role="group" aria-label="Map layers">
        {LAYERS.map(l => (
          <button key={l.id} type="button" className={`wk-toggle ${layers[l.id] ? 'is-on' : ''}`} aria-pressed={layers[l.id]}
            onClick={() => setLayers(v => ({ ...v, [l.id]: !v[l.id] }))}>
            <span className={`wk-swatch wk-swatch-${l.id}`} />{l.label}
          </button>
        ))}
      </div>
      <div className="wk-map-zoom wk-map-ctrl">
        <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setZ(zoom * 1.25)} aria-label="Zoom in"><ZoomIn size={16} strokeWidth={1.5} /></button>
        <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setZ(zoom / 1.25)} aria-label="Zoom out"><ZoomOut size={16} strokeWidth={1.5} /></button>
        <button type="button" className={btnClass('ghost')} style={iconBtn('sm')} onClick={() => setZ(1)} aria-label="Reset view"><Maximize2 size={16} strokeWidth={1.5} /></button>
      </div>

      {tip && (
        <div className="wk-tip" style={{ left: tip.x, top: tip.y }}>
          <strong>{tip.title}</strong>
          {tip.lines.map((l, i) => <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

/** Small static version for the overview's track intelligence panel. */
export function CircuitThumb({ grandPrix, corners, className = '' }: { grandPrix: string; corners: number | null; className?: string }) {
  const geo = useMemo(() => buildTrackGeometry(getTrackPath(grandPrix)), [grandPrix]);
  const an = useMemo(() => (geo ? analyseTrack(geo as any, corners) : null), [geo, corners]);
  if (!geo || !an) return null;
  const p = 30;
  return (
    <svg className={`wk-thumb ${className}`} viewBox={`${geo.bbox.x - p} ${geo.bbox.y - p} ${geo.bbox.w + p * 2} ${geo.bbox.h + p * 2}`} aria-hidden="true">
      <path d={geo.d} className="wk-m-base" />
      {geo.sectors.map((s, i) => <path key={s.id} d={s.d} className={`wk-m-sector wk-m-s${i + 1}`} />)}
      {geo.drs && <path d={geo.drs.d} className="wk-m-drs" />}
      {an.braking.map(b => <path key={b.corner} d={b.d} className="wk-m-brake" />)}
      {an.corners.map(c => <circle key={c.n} cx={c.at[0]} cy={c.at[1]} r={3} className="wk-m-corner-dot" />)}
    </svg>
  );
}
