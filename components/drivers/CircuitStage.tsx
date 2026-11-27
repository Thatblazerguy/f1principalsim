import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2 } from 'lucide-react';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import { HUB, btnClass, iconBtn } from '../HubLayout.tsx';
import { useDialogFocus } from '../useDialogFocus.ts';
import { buildTrackGeometry, type TrackGeometry } from './trackGeometry.ts';

/*
 * The next circuit as a living backdrop for My drivers. It tilts with the
 * cursor, sectors and the main straight light up on hover, a racing line and
 * two markers run laps, and a click opens the circuit in full.
 */

type Facts = {
  grandPrix: string; circuit: string; country?: string; laps: number | null; lengthKm: number | null;
  corners: number | null; longestStraightM: number | null; downforce: string | null; tyreSeverity: string | null;
  overtaking: number | null; description: string | null; sprint: boolean;
} | null;

type Part = { id: string; label: string; detail: string };

function partsFor(geo: TrackGeometry, facts: Facts): Part[] {
  const sectorKm = facts?.lengthKm ? (facts.lengthKm / 3).toFixed(2) : null;
  const out: Part[] = geo.sectors.map(s => ({
    id: s.id, label: s.label,
    detail: sectorKm ? `About ${sectorKm} km · a third of the lap` : 'A third of the lap',
  }));
  if (geo.drs) out.push({
    id: 'drs', label: 'DRS zone',
    detail: facts?.longestStraightM ? `Main straight · ${facts.longestStraightM} m` : 'Longest straight on the lap',
  });
  return out;
}

const pad = (b: TrackGeometry['bbox'], p = 40) => `${b.x - p} ${b.y - p} ${b.w + p * 2} ${b.h + p * 2}`;

export function CircuitStage({ facts, reduced, onOpen }: { facts: Facts; reduced: boolean; onOpen: () => void }) {
  const geo = useMemo(() => buildTrackGeometry(getTrackPath(facts?.grandPrix || 'British Grand Prix')), [facts?.grandPrix]);
  const planeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const decoRef = useRef<HTMLDivElement>(null);
  const m1 = useRef<SVGCircleElement>(null);
  const m2 = useRef<SVGCircleElement>(null);
  const [hover, setHover] = useState<{ part: Part; x: number; y: number } | null>(null);
  const parts = useMemo(() => (geo ? partsFor(geo, facts) : []), [geo, facts]);

  useEffect(() => {
    document.body.classList.add('dm-active');
    return () => document.body.classList.remove('dm-active');
  }, []);

  // Parallax + markers, one rAF loop. Static under reduced motion.
  useEffect(() => {
    if (!geo) return;
    const target = { x: 0, y: 0 }; const cur = { x: 0, y: 0 };
    let t1 = 0.08; let t2 = 0.02; let last = performance.now(); let raf = 0;
    const place = () => {
      const [ax, ay] = geo.sample(t1); const [bx, by] = geo.sample(t2);
      m1.current?.setAttribute('cx', String(ax)); m1.current?.setAttribute('cy', String(ay));
      m2.current?.setAttribute('cx', String(bx)); m2.current?.setAttribute('cy', String(by));
    };
    place();
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.hidden) return;
      cur.x += (target.x - cur.x) * 0.06; cur.y += (target.y - cur.y) * 0.06;
      if (planeRef.current) planeRef.current.style.transform =
        `rotateX(${22 - cur.y * 5}deg) rotateZ(-8deg) rotateY(${cur.x * 7}deg) translate3d(${cur.x * -18}px, ${cur.y * -12}px, 0)`;
      if (gridRef.current) gridRef.current.style.transform = `translate3d(${cur.x * -6}px, ${cur.y * -4}px, 0)`;
      if (decoRef.current) decoRef.current.style.transform = `translate3d(${cur.x * -10}px, ${cur.y * -8}px, 0)`;
      t1 += dt / 34; t2 += dt / 35.5;
      place();
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, [geo, reduced]);

  if (!geo) return null;
  const scaleKm = facts?.lengthKm ? facts.lengthKm / geo.length : null; // km per svg unit
  const barUnits = scaleKm ? 1 / scaleKm : 0; // svg units in 1 km

  const enter = (part: Part) => (e: React.PointerEvent) => setHover({ part, x: e.clientX, y: e.clientY });
  const move = (e: React.PointerEvent) => setHover(h => (h ? { ...h, x: e.clientX, y: e.clientY } : h));

  return createPortal(
    <div className={`dmc-stage ${hover ? 'is-hot' : ''}`} aria-hidden="true">
      <div className="dmc-grid" ref={gridRef} />
      <div className="dmc-deco" ref={decoRef}>
        <span className="dmc-tick dmc-tick-tl" /><span className="dmc-tick dmc-tick-tr" />
        <span className="dmc-tick dmc-tick-bl" /><span className="dmc-tick dmc-tick-br" />
        <span className="dmc-readout dmc-readout-a">{facts?.circuit || ''}</span>
        <span className="dmc-readout dmc-readout-b">
          {[facts?.lengthKm && `${facts.lengthKm} km`, facts?.corners && `${facts.corners} corners`, facts?.laps && `${facts.laps} laps`].filter(Boolean).join(' · ')}
        </span>
      </div>
      <div className="dmc-perspective">
        <div className="dmc-plane" ref={planeRef} style={reduced ? { transform: 'rotateX(22deg) rotateZ(-8deg)' } : undefined}>
          <svg viewBox={pad(geo.bbox, 60)} preserveAspectRatio="xMidYMid meet">
            <path d={geo.d} className="dmc-shadow" />
            <path d={geo.d} className="dmc-base" />
            {!reduced && <path d={geo.d} className="dmc-line" pathLength={1000} />}
            {geo.drs && <path d={geo.drs.d} className={`dmc-drs ${hover?.part.id === 'drs' ? 'is-on' : ''}`} />}
            {geo.sectors.map(s => (
              <path key={s.id} d={s.d} className={`dmc-sector ${hover?.part.id === s.id ? 'is-on' : ''}`} />
            ))}
            {geo.sectors.map(s => (
              <text key={`l${s.id}`} x={s.mid[0]} y={s.mid[1] - 16} className={`dmc-label ${hover?.part.id === s.id ? 'is-on' : ''}`} textAnchor="middle">{s.label.replace('Sector ', 'S')}</text>
            ))}
            {geo.drs && <text x={geo.drs.mid[0]} y={geo.drs.mid[1] + 24} className={`dmc-label ${hover?.part.id === 'drs' ? 'is-on' : ''}`} textAnchor="middle">DRS</text>}
            <circle ref={m2} r={4} className="dmc-marker dmc-marker-b" />
            <circle ref={m1} r={4.5} className="dmc-marker dmc-marker-a" />
            {/* hit areas: wide invisible strokes, drawn last so they sit on top */}
            {parts.map(p => {
              const d = p.id === 'drs' ? geo.drs!.d : geo.sectors.find(s => s.id === p.id)!.d;
              return (
                <path key={`h${p.id}`} d={d} className="dmc-hit"
                  onPointerEnter={enter(p)} onPointerMove={move} onPointerLeave={() => setHover(null)} onClick={onOpen} />
              );
            })}
            {barUnits > 0 && (
              <g className="dmc-scale" transform={`translate(${geo.bbox.x} ${geo.bbox.y + geo.bbox.h + 40})`}>
                <line x1={0} x2={barUnits} y1={0} y2={0} />
                <line x1={0} x2={0} y1={-4} y2={4} /><line x1={barUnits} x2={barUnits} y1={-4} y2={4} />
                <text x={barUnits / 2} y={16} textAnchor="middle">1 km</text>
              </g>
            )}
          </svg>
        </div>
      </div>
      {hover && (
        <div className="dmc-tip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.part.label}</strong>
          <span>{hover.part.detail}</span>
          <em>Click to open the circuit</em>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** Full circuit view: zoom, rotate, hover the sectors, read the circuit facts. */
export function CircuitExpanded({ open, facts, onClose, reduced }: { open: boolean; facts: Facts; onClose: () => void; reduced: boolean }) {
  const geo = useMemo(() => buildTrackGeometry(getTrackPath(facts?.grandPrix || 'British Grand Prix')), [facts?.grandPrix]);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [hot, setHot] = useState<string | null>(null);
  const drag = useRef<{ x: number; rot: number } | null>(null);
  useDialogFocus(open, ref, onClose, closeRef);
  useEffect(() => { if (open) { setZoom(1); setRot(0); } }, [open]);
  const parts = useMemo(() => (geo ? partsFor(geo, facts) : []), [geo, facts]);
  const clampZoom = (z: number) => Math.min(2.6, Math.max(0.7, Math.round(z * 100) / 100));

  const rows: [string, string | null][] = facts ? [
    ['Length', facts.lengthKm ? `${facts.lengthKm} km` : null],
    ['Laps', facts.laps ? String(facts.laps) : null],
    ['Race distance', facts.lengthKm && facts.laps ? `${(facts.lengthKm * facts.laps).toFixed(1)} km` : null],
    ['Corners', facts.corners ? String(facts.corners) : null],
    ['Longest straight', facts.longestStraightM ? `${facts.longestStraightM} m` : null],
    ['Downforce', facts.downforce],
    ['Tyre severity', facts.tyreSeverity],
    ['Overtaking difficulty', facts.overtaking != null ? `${facts.overtaking} / 100` : null],
    ['Format', facts.sprint ? 'Sprint weekend' : 'Standard weekend'],
  ] : [];

  return createPortal(
    <AnimatePresence>
      {open && geo && (
        <motion.div className="dmc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={ref} className="dmc-dialog" role="dialog" aria-modal="true" aria-labelledby="dmc-title"
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduced ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <div className="dmc-dialog-head">
              <div>
                <p className="dm-kicker">Next race · {facts?.country}</p>
                <h3 id="dmc-title" className="dmc-dialog-title">{facts?.grandPrix}</h3>
                <span className="dm-muted">{facts?.circuit}</span>
              </div>
              <button ref={closeRef} type="button" className={btnClass('ghost')} style={iconBtn('md')} onClick={onClose} aria-label="Close circuit view"><X size={16} strokeWidth={1.5} /></button>
            </div>
            <div className="dmc-dialog-body">
              <div className="dmc-canvas"
                onWheel={(e) => setZoom(z => clampZoom(z * (e.deltaY < 0 ? 1.08 : 0.93)))}
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, rot }; }}
                onPointerMove={(e) => { if (drag.current) setRot(drag.current.rot + (e.clientX - drag.current.x) * 0.4); }}
                onPointerUp={() => { drag.current = null; }}
                onPointerCancel={() => { drag.current = null; }}
                aria-label="Circuit map. Drag to rotate, scroll to zoom." role="img">
                <svg viewBox={pad(geo.bbox, 50)} style={{ transform: `rotate(${rot}deg) scale(${zoom})` }}>
                  <path d={geo.d} className="dmc-x-base" />
                  {geo.drs && <path d={geo.drs.d} className={`dmc-x-drs ${hot === 'drs' ? 'is-on' : ''}`} />}
                  {geo.sectors.map((s, i) => (
                    <path key={s.id} d={s.d} className={`dmc-x-sector dmc-x-s${i + 1} ${hot === s.id ? 'is-on' : ''} ${hot && hot !== s.id ? 'is-dim' : ''}`}
                      onPointerEnter={() => setHot(s.id)} onPointerLeave={() => setHot(null)} />
                  ))}
                  {geo.sectors.map(s => (
                    <text key={`t${s.id}`} x={s.mid[0]} y={s.mid[1] - 14} textAnchor="middle" className="dmc-x-label" style={{ transform: `rotate(${-rot}deg)`, transformBox: 'fill-box', transformOrigin: 'center' }}>{s.label}</text>
                  ))}
                </svg>
                <div className="dmc-controls">
                  <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setZoom(z => clampZoom(z * 1.2))} aria-label="Zoom in"><ZoomIn size={16} strokeWidth={1.5} /></button>
                  <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setZoom(z => clampZoom(z / 1.2))} aria-label="Zoom out"><ZoomOut size={16} strokeWidth={1.5} /></button>
                  <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setRot(r => r - 15)} aria-label="Rotate left"><RotateCcw size={16} strokeWidth={1.5} /></button>
                  <button type="button" className={btnClass('secondary')} style={iconBtn('sm')} onClick={() => setRot(r => r + 15)} aria-label="Rotate right"><RotateCw size={16} strokeWidth={1.5} /></button>
                  <button type="button" className={btnClass('ghost')} style={iconBtn('sm')} onClick={() => { setZoom(1); setRot(0); }} aria-label="Reset view"><Maximize2 size={16} strokeWidth={1.5} /></button>
                </div>
              </div>
              <div className="dmc-side">
                {facts?.description && <p className="dmc-desc">{facts.description}</p>}
                <dl className="dmc-facts">
                  {rows.filter(r => r[1]).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
                </dl>
                <p className="dm-kicker" style={{ marginTop: 20 }}>Track sections</p>
                <ul className="dmc-legend">
                  {parts.map((p, i) => (
                    <li key={p.id}>
                      <button type="button" className={`dmc-legend-btn ${hot === p.id ? 'is-on' : ''}`}
                        onPointerEnter={() => setHot(p.id)} onPointerLeave={() => setHot(null)} onFocus={() => setHot(p.id)} onBlur={() => setHot(null)}>
                        <span className={`dmc-swatch dmc-swatch-${p.id === 'drs' ? 'drs' : `s${i + 1}`}`} />
                        <span><strong>{p.label}</strong><em>{p.detail}</em></span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="dmc-note">The layouts carry no timing lines, so sectors are equal thirds of the lap and the DRS zone marks the longest straight.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
