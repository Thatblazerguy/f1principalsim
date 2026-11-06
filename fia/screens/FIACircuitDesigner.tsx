import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Undo2, Trash2, Download, Upload, Play, CheckCircle, AlertTriangle, Move, Crosshair, GitBranch, RotateCcw, Save, Sparkles, Layers } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
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
const TRACK_COLOR = '#E10600';
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
        background: '#0A0F1F',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        cursor: tool === 'draw' ? 'crosshair' : tool === 'delete' ? 'not-allowed' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid */}
      <defs>
        <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
          <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Track path */}
      {trackPath && (
        <>
          {/* Shadow/glow */}
          <path d={trackPath} fill="none" stroke={`${TRACK_COLOR}30`} strokeWidth={TRACK_WIDTH_PX + 10} strokeLinecap="round" strokeLinejoin="round" />
          {/* Track body */}
          <path d={trackPath} fill="none" stroke="#2A2A3A" strokeWidth={TRACK_WIDTH_PX} strokeLinecap="round" strokeLinejoin="round" />
          {/* Center line */}
          <path d={trackPath} fill="none" stroke={TRACK_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 4" />
          {/* Edge lines */}
          <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
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
              fill={isStart ? '#F59E0B' : isHovered ? TRACK_COLOR : 'rgba(255,255,255,0.8)'}
              stroke={isStart ? '#F59E0B' : TRACK_COLOR}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
            />
            {isStart && (
              <>
                <line x1={pt.x - 6} y1={pt.y} x2={pt.x + 6} y2={pt.y} stroke="#000" strokeWidth="2" />
                <line x1={pt.x} y1={pt.y - 6} x2={pt.x} y2={pt.y + 6} stroke="#000" strokeWidth="2" />
              </>
            )}
            <text x={pt.x + 12} y={pt.y + 4} fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="monospace">{i + 1}</text>
          </g>
        );
      })}

      {/* Closing line hint */}
      {points.length > 2 && (
        <line
          x1={points[points.length - 1].x} y1={points[points.length - 1].y}
          x2={points[0].x} y2={points[0].y}
          stroke="rgba(225,6,0,0.2)" strokeWidth="1" strokeDasharray="4 4"
        />
      )}

      {/* Empty hint */}
      {points.length === 0 && (
        <text x="50%" y="50%" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="13" fontFamily="sans-serif">
          Click to place track points
        </text>
      )}
    </svg>
  );
}

function StatBar({ label, value, color = '#fff' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{label}</span>
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
    showNotif('Circuit saved!');
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
    { id: 'draw', icon: <GitBranch size={15} />, label: 'Draw' },
    { id: 'move', icon: <Move size={15} />, label: 'Move' },
    { id: 'delete', icon: <Trash2 size={15} />, label: 'Delete' },
    { id: 'start', icon: <Crosshair size={15} />, label: 'Start/Finish' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 200,
          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
          padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green,
        }}>
          {notification}
        </div>
      )}

      {/* Left panel - Tools & Properties */}
      <aside style={{
        width: 260, flexShrink: 0, background: '#06080F',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto',
      }}>
        <div>
          <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 11, padding: 0, marginBottom: 12 }}>
            ← Dashboard
          </button>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
            Circuit Designer
          </div>
          <h2 style={{ fontFamily: HUB.fontWide, fontSize: 16, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Design Studio</h2>
        </div>

        {/* Circuit Name */}
        <div>
          <label style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Circuit Name</label>
          <input
            value={circuit.name}
            onChange={e => setCircuit(c => ({ ...c, name: e.target.value }))}
            style={{
              width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff',
              fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Country & Type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Country</label>
            <input
              value={circuit.country}
              onChange={e => setCircuit(c => ({ ...c, country: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Type</label>
            <select
              value={circuit.type}
              onChange={e => setCircuit(c => ({ ...c, type: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="permanent">Permanent</option>
              <option value="street">Street</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>
        </div>

        {/* Track Width */}
        <div>
          <label style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
            Track Width: {circuit.trackWidth}m
          </label>
          <input type="range" min="8" max="20" value={circuit.trackWidth}
            onChange={e => setCircuit(c => ({ ...c, trackWidth: +e.target.value }))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Tools */}
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Tool</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {tools.map(t => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
                  borderRadius: 6, border: tool === t.id ? `1px solid ${FIA.accent}` : '1px solid rgba(255,255,255,0.08)',
                  background: tool === t.id ? 'rgba(225,6,0,0.12)' : 'rgba(255,255,255,0.03)',
                  color: tool === t.id ? '#fff' : HUB.textMuted,
                  cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, transition: 'all 0.15s',
                }}
              >
                <span style={{ color: tool === t.id ? FIA.accent : HUB.textMuted }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, lineHeight: 1.5 }}>
            {tool === 'draw' && 'Click on canvas to place control points. Points snap to grid.'}
            {tool === 'move' && 'Drag existing points to reposition them.'}
            {tool === 'delete' && 'Click a point to remove it from the track.'}
            {tool === 'start' && 'Click a point to set it as the start/finish line.'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={undo} disabled={histIdx <= 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: histIdx <= 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: histIdx <= 0 ? 'default' : 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}
          >
            <Undo2 size={13} /> Undo
          </button>
          <button onClick={handleClear}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.15)', color: FIA.accent, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}
          >
            <RotateCcw size={13} /> Clear Track
          </button>
        </div>
      </aside>

      {/* Canvas area */}
      <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: HUB.fontBold, fontSize: 16, color: '#fff' }}>{circuit.name}</span>
            <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{points.length} control points</span>
            {circuit.country && (
              <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', fontSize: 10, fontFamily: HUB.fontBold, color: '#CBD5E1' }}>
                {circuit.country}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowPresetsModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6,
                background: 'linear-gradient(135deg, rgba(225,6,0,0.18), rgba(245,158,11,0.15))',
                border: '1px solid rgba(225,6,0,0.4)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11,
              }}
            >
              <Sparkles size={13} color="#F59E0B" /> Generate Blueprint (Dubai...)
            </button>
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}>
              <Download size={13} /> Export
            </button>
            <button onClick={handleSave} style={{ ...actionBtn({ padding: '8px 18px', fontSize: 11 }), display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={13} /> {saved ? '✓ Saved' : 'Save Circuit'}
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
          <div style={{ flex: 1, ...glassCard({ padding: '12px 16px' }) }}>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Pit Entry Point</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={pitLane.entry ?? ''}
                onChange={e => setPitLane(p => ({ ...p, entry: e.target.value ? +e.target.value : null }))}
                style={{ flex: 1, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none' }}
              >
                <option value="">Select point...</option>
                {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}
              </select>
            </div>
          </div>
          <div style={{ flex: 1, ...glassCard({ padding: '12px 16px' }) }}>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Pit Exit Point</div>
            <select
              value={pitLane.exit ?? ''}
              onChange={e => setPitLane(p => ({ ...p, exit: e.target.value ? +e.target.value : null }))}
              style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none' }}
            >
              <option value="">Select point...</option>
              {points.map((_, i) => <option key={i} value={i}>Point {i + 1}</option>)}
            </select>
          </div>
        </div>
      </main>

      {/* Right panel - Stats & Validation */}
      <aside style={{
        width: 280, flexShrink: 0, background: '#06080F',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        padding: '28px 20px', overflowY: 'auto',
      }}>
        {/* Stats */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Circuit Statistics
          </div>
          {stats ? (
            <div>
              <StatBar label="Length" value={`${stats.lengthKm.toFixed(2)} km`} color={FIA.green} />
              <StatBar label="Corners" value={stats.cornerCount} />
              <StatBar label="Longest Straight" value={`${stats.longestStraightM}m`} />
              <StatBar label="Full Throttle" value={`${stats.fullThrottlePct}%`} color={FIA.gold} />
              <StatBar label="Overtaking Difficulty" value={`${stats.overtakingDifficulty}%`} />
              <StatBar label="Tyre Severity" value={stats.tyreSeverity} />
              <StatBar label="Downforce" value={stats.downforceDemand} />
              <StatBar label="Est. Lap Time" value={`${Math.floor(stats.estimatedLapTime / 60)}:${String(stats.estimatedLapTime % 60).padStart(2, '0')}`} color={FIA.accent} />
              <StatBar label="Est. Race Laps" value={stats.estimatedLaps} />
            </div>
          ) : (
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
              Place at least 3 points to see statistics.
            </p>
          )}
        </div>

        {/* Validation */}
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Validation
          </div>
          {validation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Status banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: validation.isValid ? 'rgba(16,185,129,0.08)' : 'rgba(225,6,0,0.08)',
                border: `1px solid ${validation.isValid ? 'rgba(16,185,129,0.25)' : 'rgba(225,6,0,0.25)'}`,
                borderRadius: 8,
              }}>
                {validation.isValid
                  ? <CheckCircle size={14} color={FIA.green} />
                  : <AlertTriangle size={14} color={FIA.accent} />
                }
                <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: validation.isValid ? FIA.green : FIA.accent }}>
                  {validation.isValid ? 'Circuit Valid' : `${validation.errors.length} Error(s)`}
                </span>
              </div>

              {validation.errors.map((e: any, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.15)', borderRadius: 6 }}>
                  <AlertTriangle size={12} color={FIA.accent} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>{e.message}</span>
                </div>
              ))}
              {validation.warnings.map((w: any, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6 }}>
                  <AlertTriangle size={12} color={FIA.gold} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: '#fff', lineHeight: 1.4 }}>{w.message}</span>
                </div>
              ))}

              {validation.isValid && (
                <button
                  onClick={handleSave}
                  style={{ ...actionBtn({ padding: '10px', fontSize: 11 }), width: '100%', marginTop: 8 }}
                >
                  Submit for Licensing →
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
          position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            ...glassCard({ padding: '28px' }), maxWidth: 640, width: '100%',
            background: '#0B0F1E', border: '1px solid rgba(255,255,255,0.12)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Track Blueprint Synthesizer
                </div>
                <h3 style={{ fontFamily: HUB.fontWide, fontSize: 20, color: '#fff', margin: '4px 0 0' }}>
                  Select or Generate Circuit
                </h3>
              </div>
              <button
                onClick={() => setShowPresetsModal(false)}
                style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 360, overflowY: 'auto', marginBottom: 20 }}>
              {TRACK_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)'
                  }}
                >
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {preset.name}
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(225,6,0,0.15)', color: FIA.accent, textTransform: 'uppercase' }}>
                        {preset.type}
                      </span>
                    </div>
                    <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 4 }}>
                      {preset.country} · {preset.points.length} Corners · ${preset.hostingFee}M Fee
                    </div>
                    <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
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
                      showNotif(`Loaded "${preset.name}" into Circuit Designer!`);
                    }}
                    style={{ ...actionBtn({ padding: '8px 16px', fontSize: 11 }), whiteSpace: 'nowrap' }}
                  >
                    Load Track →
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowPresetsModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}
              >
                Close
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
