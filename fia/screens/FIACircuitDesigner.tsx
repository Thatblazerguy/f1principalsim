import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Undo2, Trash2, Download, Upload, Play, CheckCircle, AlertTriangle, Move, Crosshair, GitBranch, RotateCcw, Save, Layers, X, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, iconBtn, sectionLabel, pill } from '../../components/HubLayout.tsx';
import {
  calculateCircuitStats, validateCircuitDesign, generateSVGPath, createNewCircuit, pixelsToKm,
  generateTrackBlueprint, TRACK_PRESETS
} from '../circuitDesigner.js';
import { fiaCareer, saveFIACareer, setFIACareer, LICENSE_STATUS } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

const CANVAS_W = 640;
const CANVAS_H = 480;
const POINT_RADIUS = 8;
const TRACK_COLOR = HUB.textPrimary; // track line; accent is reserved for start/finish
const TRACK_WIDTH_PX = 14;
const GRID_SIZE = 20;

type Point = { x: number; y: number };

function CircuitCanvas({ points, setPoints, startFinishIndex, setStartFinishIndex, pitLane, setPitLane, tool }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const getSVGPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE;
    return { x: Math.max(0, Math.min(CANVAS_W, x)), y: Math.max(0, Math.min(CANVAS_H, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'draw') {
      const pt = getSVGPoint(e);
      setPoints(prev => [...prev, pt]);
    }
  };

  const handlePointMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (tool === 'move') {
      setDragging(idx);
    } else if (tool === 'delete') {
      setPoints(prev => prev.filter((_, i) => i !== idx));
      if (startFinishIndex === idx) setStartFinishIndex(null);
    } else if (tool === 'start') {
      setStartFinishIndex(idx);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging !== null && tool === 'move') {
      const pt = getSVGPoint(e);
      setPoints(prev => prev.map((p, i) => i === dragging ? pt : p));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const trackPath = generateSVGPath(points);

  return (
    <svg
      ref={svgRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        background: HUB.sidebar,
        border: `1px solid ${HUB.border}`,
        borderRadius: 14,
        cursor: tool === 'draw' ? 'crosshair' : tool === 'delete' ? 'not-allowed' : 'default',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid */}
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(237,237,237,0.04)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Track path */}
      {trackPath && (
        <>
          {/* Track body */}
          <path d={trackPath} fill="none" stroke={HUB.raised} strokeWidth={TRACK_WIDTH_PX} strokeLinecap="round" strokeLinejoin="round" />
          {/* Track line */}
          <path d={trackPath} fill="none" stroke={TRACK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Control points */}
      {points.map((pt, i) => {
        const isStart = i === startFinishIndex;
        const isHovered = i === hovered;
        return (
          <g key={i} onMouseDown={e => handlePointMouseDown(e, i)} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <circle
              cx={pt.x} cy={pt.y} r={isStart ? POINT_RADIUS + 4 : POINT_RADIUS}
              fill={isStart ? HUB.accent : isHovered ? HUB.textPrimary : HUB.raised}
              stroke={isStart ? HUB.accent : TRACK_COLOR}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
            />
            {isStart && (
              <>
                <line x1={pt.x - 6} y1={pt.y} x2={pt.x + 6} y2={pt.y} stroke={HUB.textPrimary} strokeWidth="2" />
                <line x1={pt.x} y1={pt.y - 6} x2={pt.x} y2={pt.y + 6} stroke={HUB.textPrimary} strokeWidth="2" />
              </>
            )}
            <text x={pt.x + 12} y={pt.y + 4} fontSize="11" fill={HUB.textFaint} fontFamily={HUB.fontRegular}>{i + 1}</text>
          </g>
        );
      })}

      {/* Closing line hint */}
      {points.length > 2 && (
        <line
          x1={points[points.length - 1].x} y1={points[points.length - 1].y}
          x2={points[0].x} y2={points[0].y}
          stroke="rgba(237,237,237,0.2)" strokeWidth="1" strokeDasharray="4 4"
        />
      )}

      {/* Empty hint */}
      {points.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle" fill={HUB.textFaint} fontSize="13" fontFamily={HUB.fontRegular}>
          Click to place track points
        </text>
      )}
    </svg>
  );
}

function StatBar({ label, value, color = HUB.textPrimary }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${HUB.border}` }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{label}</span>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color }}>{value}</span>
    </div>
  );
}

function FIACircuitDesignerScreen({ appRoot, initialCircuit }: { appRoot: HTMLElement; initialCircuit?: any }) {
  const career = fiaCareer;
  const [circuit, setCircuit] = useState(() => {
    if (initialCircuit) return { ...initialCircuit };
    const draft = career?.customCircuits?.find(c => c.status === 'draft');
    return draft ? { ...draft } : createNewCircuit();
  });
  const [points, setPoints] = useState<Point[]>(initialCircuit?.points || circuit.points || []);
  const [startFinishIndex, setStartFinishIndex] = useState<number | null>(initialCircuit?.startFinishIndex ?? circuit.startFinishIndex ?? (points.length ? 0 : null));
  const [pitLane, setPitLane] = useState(initialCircuit?.pitLane || circuit.pitLane || { entry: points.length ? points.length - 1 : null, exit: 1 });
  const [tool, setTool] = useState<'draw' | 'move' | 'delete' | 'start'>('draw');
  const [history, setHistory] = useState<Point[][]>([points]);
  const [histIdx, setHistIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [notification, setNotification] = useState('');
  const [showPresetsModal, setShowPresetsModal] = useState(false);

  const stats = points.length >= 3 ? calculateCircuitStats(points, circuit.scale || 60) : null;
  const circuitForValidation = { ...circuit, points, startFinishIndex, pitLane };
  const validation = points.length >= 3 ? validateCircuitDesign(circuitForValidation) : null;

  const pushHistory = (pts: Point[]) => {
    const newHist = history.slice(0, histIdx + 1).concat([pts]);
    setHistory(newHist);
    setHistIdx(newHist.length - 1);
  };

  const handleSetPoints = (updater) => {
    setPoints(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pushHistory(next);
      return next;
    });
  };

  const undo = () => {
    if (histIdx > 0) {
      const newIdx = histIdx - 1;
      setHistIdx(newIdx);
      setPoints(history[newIdx]);
    }
  };

  const handleClear = () => {
    handleSetPoints([]);
    setStartFinishIndex(null);
  };

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleSave = () => {
    if (!career) return;
    const updated = {
      ...circuit,
      points,
      startFinishIndex,
      pitLane,
      updatedAt: Date.now(),
      status: validation?.isValid ? 'validated' : 'draft',
    };
    const existing = career.customCircuits.findIndex(c => c.id === updated.id);
    const customs = [...career.customCircuits];
    if (existing >= 0) customs[existing] = updated;
    else customs.push(updated);

    setFIACareer({ ...career, customCircuits: customs });
    saveFIACareer();
    setSaved(true);
    setCircuit(updated);
    showNotif('Circuit saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const data = JSON.stringify({ ...circuit, points, startFinishIndex, pitLane, stats }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${circuit.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tools = [
    { id: 'draw', icon: <GitBranch size={16} strokeWidth={1.5} />, label: 'Draw' },
    { id: 'move', icon: <Move size={16} strokeWidth={1.5} />, label: 'Move' },
    { id: 'delete', icon: <Trash2 size={16} strokeWidth={1.5} />, label: 'Delete' },
    { id: 'start', icon: <Crosshair size={16} strokeWidth={1.5} />, label: 'Start/finish' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          background: HUB.raised, border: `1px solid ${HUB.borderMid}`,
          padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary
        }}>
          {notification}
        </div>
      )}

      {/* Left panel - Tools & Properties */}
      <aside style={{
        width: 260, flexShrink: 0, background: HUB.sidebar,
        borderRight: `1px solid ${HUB.border}`,
        padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto'
      }}>
        <div>
          <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}>
            <ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard
          </button>
          <h2 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: 0 }}>Circuit designer</h2>
        </div>

        {/* Circuit Name */}
        <div>
          <label style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, display: 'block', marginBottom: 6 }}>Circuit name</label>
          <input
            value={circuit.name}
            onChange={e => setCircuit(c => ({ ...c, name: e.target.value }))}
            style={{
              width: '100%', height: 32, padding: '0 12px', background: HUB.raised,
              border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary,
              fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Country & Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, display: 'block', marginBottom: 6 }}>Country</label>
            <input
              value={circuit.country}
              onChange={e => setCircuit(c => ({ ...c, country: e.target.value }))}
              style={{ width: '100%', height: 32, padding: '0 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, display: 'block', marginBottom: 6 }}>Type</label>
            <select
              value={circuit.type}
              onChange={e => setCircuit(c => ({ ...c, type: e.target.value }))}
              style={{ width: '100%', height: 32, padding: '0 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="permanent">Permanent</option>
              <option value="street">Street</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </div>

        {/* Track Width */}
        <div>
          <label style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, display: 'block', marginBottom: 6 }}>
            Track width: {circuit.trackWidth}m
          </label>
          <input type="range" min="8" max="20" value={circuit.trackWidth}
            onChange={e => setCircuit(c => ({ ...c, trackWidth: +e.target.value }))}
            style={{ width: '100%', accentColor: HUB.accent }}
          />
        </div>

        {/* Tools */}
        <div>
          {sectionLabel('Tool')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 4 }}>
            {tools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px',
                  borderRadius: 8, border: tool === t.id ? '1px solid rgba(225,6,0,0.4)' : `1px solid ${HUB.border}`,
                  background: tool === t.id ? HUB.accentSoft : HUB.raised,
                  color: tool === t.id ? HUB.textPrimary : HUB.textMuted,
                  cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 12, transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
                }}
              >
                <span style={{ display: 'flex', color: tool === t.id ? HUB.accentInk : HUB.textMuted }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, padding: '8px 10px', background: HUB.raised, borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, lineHeight: 1.5 }}>
            {tool === 'draw' && 'Click on canvas to place control points. Points snap to grid.'}
            {tool === 'move' && 'Drag existing points to reposition them.'}
            {tool === 'delete' && 'Click a point to remove it from the track.'}
            {tool === 'start' && 'Click a point to set it as the start/finish line.'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={undo} disabled={histIdx <= 0}
            className={btnClass('secondary')}
            style={btn('secondary', 'sm')}
          >
            <Undo2 size={14} strokeWidth={1.5} />Undo
          </button>
          <button onClick={handleClear}
            className={btnClass('danger')}
            style={btn('danger', 'sm')}
          >
            <RotateCcw size={14} strokeWidth={1.5} />Clear track
          </button>
        </div>
      </aside>

      {/* Canvas area */}
      <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>{circuit.name}</span>
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{points.length} control points</span>
            {circuit.country && (
              <span style={{ ...pill() }}>
                {circuit.country}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowPresetsModal(true)}
              className={btnClass('secondary')}
              style={btn('secondary', 'sm')}
            >
              <Layers size={14} strokeWidth={1.5} />Load blueprint
            </button>
            <button onClick={handleExport} className={btnClass('secondary')} style={btn('secondary', 'sm')}>
              <Download size={14} strokeWidth={1.5} />Export circuit
            </button>
            <button onClick={handleSave} className={btnClass('secondary')} style={btn('secondary', 'sm')}>
              <Save size={14} strokeWidth={1.5} />{saved ? 'Saved' : 'Save circuit'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <CircuitCanvas
          points={points}
          setPoints={handleSetPoints}
          startFinishIndex={startFinishIndex}
          setStartFinishIndex={setStartFinishIndex}
          pitLane={pitLane}
          setPitLane={setPitLane}
          tool={tool}
        />

        {/* Pit lane config */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, ...glassCard({ padding: '16px' }) }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginBottom: 6 }}>Pit entry point</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={pitLane.entry ?? ''}
                onChange={e => setPitLane(p => ({ ...p, entry: e.target.value ? +e.target.value : null }))}
                style={{ flex: 1, height: 32, padding: '0 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none' }}
              >
                <option value="">Select point</option>
                {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}
              </select>
            </div>
          </div>
          <div style={{ flex: 1, ...glassCard({ padding: '16px' }) }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginBottom: 6 }}>Pit exit point</div>
            <select
              value={pitLane.exit ?? ''}
              onChange={e => setPitLane(p => ({ ...p, exit: e.target.value ? +e.target.value : null }))}
              style={{ width: '100%', height: 32, padding: '0 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary, fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none' }}
            >
              <option value="">Select point</option>
              {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}
            </select>
          </div>
        </div>
      </main>

      {/* Right panel - Stats & Validation */}
      <aside style={{
        width: 280, flexShrink: 0, background: HUB.sidebar,
        borderLeft: `1px solid ${HUB.border}`,
        padding: '28px 20px', overflowY: 'auto'
      }}>
        {/* Stats */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>{sectionLabel('Circuit statistics')}</div>
          {stats ? (
            <div>
              <StatBar label="Length" value={`${stats.lengthKm.toFixed(2)} km`} />
              <StatBar label="Corners" value={stats.cornerCount} />
              <StatBar label="Longest straight" value={`${stats.longestStraightM}m`} />
              <StatBar label="Full throttle" value={`${stats.fullThrottlePct}%`} />
              <StatBar label="Overtaking difficulty" value={`${stats.overtakingDifficulty}%`} />
              <StatBar label="Tyre severity" value={stats.tyreSeverity} />
              <StatBar label="Downforce" value={stats.downforceDemand} />
              <StatBar label="Est. lap time" value={`${Math.floor(stats.estimatedLapTime / 60)}:${String(stats.estimatedLapTime % 60).padStart(2, '0')}`} />
              <StatBar label="Est. race laps" value={stats.estimatedLaps} />
            </div>
          ) : (
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
              Place at least 3 points to see statistics.
            </p>
          )}
        </div>

        {/* Validation */}
        <div>
          <div style={{ marginBottom: 8 }}>{sectionLabel('Validation')}</div>
          {validation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Status banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: HUB.raised,
                border: `1px solid ${HUB.border}`,
                borderRadius: 8
              }}>
                {validation.isValid
                  ? <CheckCircle size={16} strokeWidth={1.5} color={HUB.positive} />
                  : <AlertTriangle size={16} strokeWidth={1.5} color={HUB.negative} />
                }
                <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary }}>
                  {validation.isValid ? 'Circuit valid' : `${validation.errors.length} error(s)`}
                </span>
              </div>

              {validation.errors.map((e: any, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8 }}>
                  <AlertTriangle size={14} strokeWidth={1.5} color={HUB.negative} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textPrimary, lineHeight: 1.4 }}>{e.message}</span>
                </div>
              ))}
              {validation.warnings.map((w: any, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: 8 }}>
                  <AlertTriangle size={14} strokeWidth={1.5} color={HUB.warning} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textPrimary, lineHeight: 1.4 }}>{w.message}</span>
                </div>
              ))}

              {validation.isValid && (
                <button
                  onClick={handleSave}
                  className={btnClass('primary')}
                  style={btn('primary', 'md', { width: '100%', marginTop: 8 })}
                >
                  Submit for licensing
                </button>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
              Draw a track to validate.
            </p>
          )}
        </div>
      </aside>

      {/* Presets Modal */}
      {showPresetsModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            ...glassCard({ padding: '24px' }), maxWidth: 640, width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                {sectionLabel('Track blueprints')}
                <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: 0 }}>
                  Choose a blueprint
                </h3>
              </div>
              <button
                onClick={() => setShowPresetsModal(false)}
                aria-label="Close"
                title="Close"
                className={btnClass('ghost')}
                style={iconBtn('sm')}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', marginBottom: 20 }}>
              {TRACK_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 8, background: HUB.raised,
                    border: `1px solid ${HUB.border}`
                  }}
                >
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {preset.name}
                      <span style={{ ...pill(), padding: '2px 6px', fontSize: 11, textTransform: 'capitalize' }}>
                        {preset.type}
                      </span>
                    </div>
                    <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginTop: 4 }}>
                      {preset.country} · {preset.points.length} points · ${preset.hostingFee}M fee
                    </div>
                    <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginTop: 4 }}>
                      {preset.description}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const bp = generateTrackBlueprint({ presetId: preset.id });
                      setCircuit(bp);
                      setPoints(bp.points);
                      setStartFinishIndex(bp.startFinishIndex);
                      setPitLane(bp.pitLane);
                      pushHistory(bp.points);
                      setShowPresetsModal(false);
                      showNotif(`Loaded ${preset.name}`);
                    }}
                    className={btnClass('secondary')}
                    style={btn('secondary', 'sm')}
                  >
                    Load track
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowPresetsModal(false)}
                className={btnClass('secondary')}
                style={btn('secondary', 'md')}
              >
                Close blueprints
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function renderFIACircuitDesigner(root: HTMLElement, initialCircuit?: any) {
  renderToAppRoot(root, <FIACircuitDesignerScreen appRoot={root} initialCircuit={initialCircuit} />);
}
