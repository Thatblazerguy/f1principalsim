import React, { useState, useMemo, useRef } from 'react';
import {
  CalendarDays, Plus, X, ChevronUp, ChevronDown, AlertTriangle, CheckCircle,
  DollarSign, Globe, Zap, RotateCcw, Save, Flag, GripVertical, Sparkles,
  Sliders, ExternalLink, Trophy, ArrowRight, Eye, Check, RefreshCw, ArrowLeft
} from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, iconBtn, statCell, pill, pageTitle, sectionLabel } from '../../components/HubLayout.tsx';
import { CIRCUIT_LIBRARY } from '../circuitLibrary.js';
import {
  fiaCareer, saveFIACareer, setFIACareer,
  validateCalendar, calculateCalendarScorecard, isCircuitEligible, LICENSE_STATUS,
  setCircuitLicense
} from '../fiaState.js';
import { generateTrackBlueprint, TRACK_PRESETS } from '../circuitDesigner.js';
import { calendar as defaultCalendar } from '../../data/calendar.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';
import { renderFIACircuitDesigner } from './FIACircuitDesigner.tsx';
import { state } from '../../state.js';

// Build initial draft calendar from career or default
function buildInitialDraft(career: any) {
  if (career.calendarDrafts?.length > 0) {
    return career.calendarDrafts[career.calendarDrafts.length - 1].circuits || [];
  }
  return defaultCalendar.map(race => {
    const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === race.circuit);
    return {
      circuitId: race.circuit,
      name: race.name,
      circuit: race.circuit,
      country: lib?.country || race.country || '',
      sprint: race.sprint || false,
      laps: race.laps || 55,
      baseTime: race.baseTime || 95,
      tyreWear: race.tyreWear || 1.3,
      hostingFee: lib?.hostingFee || 40,
    };
  });
}

// ── Left Sidebar Picker Row ──────────────────────────────────────────────────
function CircuitPickerRow({ circuit, onAdd, onDesign, career }: any) {
  const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === circuit.circuitId);
  const eligible = isCircuitEligible(career, circuit.circuitId);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 12px', borderRadius: 8, background: HUB.raised,
      border: `1px solid ${HUB.border}`, marginBottom: 6,
      transition: `border-color 150ms ${HUB.ease}`
    }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {circuit.name}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, marginTop: 2 }}>
          {circuit.country || lib?.country} · ${circuit.hostingFee || lib?.hostingFee || 40}M
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {circuit.points && (
          <button
            onClick={() => onDesign(circuit)}
            title="Open in circuit designer"
            aria-label="Open in circuit designer"
            className={btnClass('ghost')}
            style={iconBtn('sm')}
          >
            <Eye size={14} strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={() => onAdd(circuit)}
          className={btnClass('secondary')}
          style={btn('secondary', 'sm')}
        >
          <Plus size={14} strokeWidth={1.5} />Add race
        </button>
      </div>
    </div>
  );
}

// ── Draggable Calendar Race Card ─────────────────────────────────────────────
function DraggableCalendarRaceRow({
  race, index, total, isDragging, isDragOver, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onRemove, onMove, onToggleSprint, onDesignTrack, career
}: any) {
  const eligible = isCircuitEligible(career, race.circuitId || race.circuit);
  const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === (race.circuitId || race.circuit));
  const custom = career?.customCircuits?.find((c: any) => c.circuitId === (race.circuitId || race.circuit) || c.name === race.name);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 10,
        background: isDragging
          ? HUB.raised
          : isDragOver
          ? HUB.accentSoft
          : HUB.surface,
        border: isDragOver
          ? `1px dashed ${HUB.accent}`
          : `1px solid ${HUB.border}`,
        marginBottom: 8,
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab',
        transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`
      }}
    >
      {/* Drag Handle */}
      <div
        title="Drag to reorder"
        style={{ color: HUB.textMuted, cursor: 'grab', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </div>

      {/* Round Badge */}
      <div style={{
        fontFamily: HUB.fontBold, fontSize: 12,
        color: HUB.textMuted,
        background: HUB.raised,
        padding: '4px 8px', borderRadius: 6, minWidth: 32, textAlign: 'center',
        fontVariantNumeric: 'tabular-nums'
      }}>
        R{index + 1 < 10 ? `0${index + 1}` : index + 1}
      </div>

      {/* Circuit & Country Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {race.name}
          </span>
          {custom && (
            <span style={{ ...pill(), padding: '2px 6px', fontSize: 11 }}>
              Custom
            </span>
          )}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span>{race.country || 'International'}</span>
          <span>· {race.laps || lib?.laps || 55} laps</span>
          <span>· ${race.hostingFee || lib?.hostingFee || 40}M fee</span>
          {!eligible && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: HUB.warning }}><AlertTriangle size={12} strokeWidth={1.5} /> License pending</span>
          )}
        </div>
      </div>

      {/* Design / Inspect Track Button */}
      {(custom?.points || lib) && (
        <button
          onClick={() => onDesignTrack(custom || lib)}
          title="Open in circuit designer"
          className={btnClass('secondary')}
          style={btn('secondary', 'sm')}
        >
          <Sliders size={14} strokeWidth={1.5} />Design track
        </button>
      )}

      {/* Sprint Weekend Toggle Button */}
      <button
        onClick={() => onToggleSprint(index)}
        title="Toggle sprint weekend"
        aria-pressed={!!race.sprint}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 28, padding: '0 10px', borderRadius: 8, fontFamily: HUB.fontBold, fontSize: 12,
          background: race.sprint ? HUB.accentSoft : HUB.raised,
          border: `1px solid ${race.sprint ? 'rgba(225,6,0,0.4)' : HUB.border}`,
          color: race.sprint ? HUB.textPrimary : HUB.textMuted, cursor: 'pointer',
          transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
        }}
      >
        {race.sprint ? <Check size={14} strokeWidth={1.5} /> : <Zap size={14} strokeWidth={1.5} />}
        Sprint
      </button>

      {/* Reorder Buttons */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          title="Move up"
          aria-label="Move up"
          className={btnClass('ghost')}
          style={iconBtn('sm')}
        >
          <ChevronUp size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          title="Move down"
          aria-label="Move down"
          className={btnClass('ghost')}
          style={iconBtn('sm')}
        >
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(index)}
        title="Remove from calendar"
        aria-label="Remove from calendar"
        className={btnClass('ghost')}
        style={iconBtn('sm')}
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── Main FIACalendarBoard Component ──────────────────────────────────────────
function FIACalendarBoard({ appRoot }: any) {
  const career = fiaCareer!;
  const [draftCircuits, setDraftCircuits] = useState<any[]>(() => buildInitialDraft(career));
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRatifiedModal, setShowRatifiedModal] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('downtown_dubai');

  // Generator form state
  const [customTrackName, setCustomTrackName] = useState('Downtown Dubai Street Circuit');
  const [customCountry, setCustomCountry] = useState('United Arab Emirates');
  const [customCorners, setCustomCorners] = useState(18);

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2800);
  };

  const validation = useMemo(() => validateCalendar(draftCircuits, career), [draftCircuits, career]);
  const scorecard = useMemo(() => calculateCalendarScorecard(draftCircuits, career), [draftCircuits, career]);

  const isAlreadyApproved = useMemo(() => {
    return career.approvedCalendars?.some((c: any) => c.year === career.currentYear);
  }, [career.approvedCalendars, career.currentYear]);

  // Combined library: official + custom circuits
  const allAvailableCircuits = useMemo(() => {
    const customList = (career.customCircuits || []).map((c: any) => ({
      circuitId: c.circuitId || c.id || c.name,
      name: c.name,
      country: c.country,
      region: c.region || 'International',
      hostingFee: c.hostingFee || 50,
      points: c.points,
      isCustom: true
    }));

    const fullList = [...customList, ...CIRCUIT_LIBRARY];
    const q = search.toLowerCase();
    return fullList.filter(c =>
      c.name.toLowerCase().includes(q) || (c.country || '').toLowerCase().includes(q)
    );
  }, [search, career.customCircuits]);

  // Active Blueprint for Preview in the Generator Modal
  const previewBlueprint = useMemo(() => {
    return generateTrackBlueprint({
      name: customTrackName,
      country: customCountry,
      presetId: selectedPresetId === 'custom_procedural' ? null : selectedPresetId,
      targetCorners: customCorners
    });
  }, [customTrackName, customCountry, selectedPresetId, customCorners]);

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Left target slot
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setDraftCircuits(prev => {
      const arr = [...prev];
      const [draggedItem] = arr.splice(draggedIndex, 1);
      arr.splice(targetIndex, 0, draggedItem);
      return arr;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    showNotif('Calendar reordered');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ── List Actions ───────────────────────────────────────────────────────────
  const handleAdd = (circuit: any) => {
    const id = circuit.circuitId || circuit.circuit;
    const exists = draftCircuits.some(c => (c.circuitId || c.circuit) === id);
    if (exists) {
      showNotif('Circuit is already in the calendar');
      return;
    }
    const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === id);
    setDraftCircuits(prev => [...prev, {
      circuitId: id,
      circuit: id,
      name: lib?.grandPrix || circuit.name,
      country: circuit.country || lib?.country || '',
      sprint: false,
      laps: circuit.laps || lib?.laps || 55,
      baseTime: circuit.baseTime || lib?.baseTime || 95,
      tyreWear: circuit.tyreWear || 1.3,
      hostingFee: circuit.hostingFee || lib?.hostingFee || 40,
    }]);
    showNotif(`Added ${circuit.name} to calendar`);
  };

  const handleRemove = (idx: number) => {
    setDraftCircuits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMove = (idx: number, dir: number) => {
    setDraftCircuits(prev => {
      const arr = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleToggleSprint = (idx: number) => {
    setDraftCircuits(prev => prev.map((r, i) => i === idx ? { ...r, sprint: !r.sprint } : r));
  };

  const handleSaveDraft = () => {
    const updated = {
      ...career,
      calendarDrafts: [...(career.calendarDrafts || []), {
        id: `draft-${Date.now()}`,
        circuits: draftCircuits,
        savedAt: Date.now(),
      }],
    };
    setFIACareer(updated);
    saveFIACareer();
    showNotif('Calendar draft saved');
  };

  // ── Direct Scene Ratification ──────────────────────────────────────────────
  const handleApproveSeason = () => {
    if (!validation.isValid) {
      showNotif('Resolve validation errors before approving');
      return;
    }

    const updated = {
      ...career,
      approvalRating: Math.min(100, career.approvalRating + 5),
      approvedCalendars: [
        ...(career.approvedCalendars?.filter((c: any) => c.year !== career.currentYear) || []),
        {
          id: `approved-${Date.now()}`,
          year: career.currentYear,
          circuits: draftCircuits,
          approvedAt: Date.now(),
        }
      ],
      notifications: [
        { id: `app-${Date.now()}`, message: `Season ${career.currentYear} calendar approved with ${draftCircuits.length} rounds`, time: Date.now() },
        ...(career.notifications || [])
      ]
    };

    // Synchronize to the Team Principal simulator engine so the race weekend operates on this calendar
    if (state?.season) {
      state.season.calendar = draftCircuits.map((r, i) => ({
        round: i + 1,
        name: r.name,
        circuit: r.circuitId || r.circuit,
        baseTime: r.baseTime || 95,
        tyreWear: r.tyreWear || 1.3,
        country: r.country || 'International',
        difficulty: 'Medium',
        sprint: !!r.sprint,
        laps: r.laps || 55,
      }));
      state.season.totalRounds = draftCircuits.length;
    }

    setFIACareer(updated);
    saveFIACareer();
    setShowRatifiedModal(true);
    showNotif(`Season ${career.currentYear} calendar approved`);
  };

  const handleReset = () => {
    setDraftCircuits(buildInitialDraft({ ...career, calendarDrafts: [] }));
    showNotif('Reset to the standard 24-race calendar');
  };

  // ── Track Generator: Add Directly to Calendar ──────────────────────────────
  const handleAddGeneratedToCalendar = (blueprint: any) => {
    // 1. Save to custom circuits in FIA career
    const customs = [...(career.customCircuits || [])];
    if (!customs.some(c => c.name === blueprint.name)) {
      customs.push(blueprint);
    }

    // 2. Grant Grade 1 License & hosting contract
    setCircuitLicense(career, blueprint.circuitId, LICENSE_STATUS.LICENSED, 'FIA Grade 1 Certified Circuit');
    career.hostingContracts = career.hostingContracts || {};
    career.hostingContracts[blueprint.circuitId] = {
      circuitId: blueprint.circuitId,
      hostingFee: blueprint.hostingFee || 60,
      active: true,
      yearsRemaining: 3
    };

    const updated = {
      ...career,
      customCircuits: customs,
    };
    setFIACareer(updated);
    saveFIACareer();

    // 3. Append to calendar draft
    handleAdd({
      circuitId: blueprint.circuitId,
      circuit: blueprint.circuitId,
      name: `${blueprint.name} GP`,
      country: blueprint.country,
      sprint: false,
      laps: blueprint.laps || 58,
      baseTime: blueprint.baseTime || 92,
      tyreWear: blueprint.tyreWear || 1.3,
      hostingFee: blueprint.hostingFee || 60,
    });

    setShowGenerateModal(false);
    showNotif(`${blueprint.name} created, licensed and added to calendar`);
  };

  // ── Open in Track Designer ─────────────────────────────────────────────────
  const handleOpenInDesigner = (circuitOrBlueprint: any) => {
    renderFIACircuitDesigner(appRoot, circuitOrBlueprint);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 400,
          background: HUB.raised, border: `1px solid ${HUB.borderMid}`,
          padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary, boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          {notification}
        </div>
      )}

      {/* ── Left Column: Circuit Selector & Generator ────────────────────────── */}
      <aside style={{
        width: 310, flexShrink: 0, background: HUB.sidebar,
        borderRight: `1px solid ${HUB.border}`,
        padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto'
      }}>
        <div>
          <button
            onClick={() => renderFIADashboard(appRoot)}
            className={btnClass('ghost')}
            style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard
          </button>
          <h2 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: 0 }}>
            Add circuits
          </h2>
        </div>

        {/* Generate New Track CTA Button */}
        <button
          onClick={() => setShowGenerateModal(true)}
          className={btnClass('secondary')}
          style={btn('secondary', 'md')}
        >
          <Plus size={16} strokeWidth={1.5} />
          <span>Generate track</span>
        </button>

        {/* Circuit Search Box */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter circuits"
          style={{
            width: '100%', height: 36, padding: '0 12px', background: HUB.raised,
            border: `1px solid ${HUB.border}`, borderRadius: 8, color: HUB.textPrimary,
            fontFamily: HUB.fontRegular, fontSize: 13, outline: 'none', boxSizing: 'border-box'
          }}
        />

        {/* Circuit List */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 2 }}>
          {allAvailableCircuits.map(c => (
            <CircuitPickerRow
              key={c.circuitId}
              circuit={c}
              onAdd={handleAdd}
              onDesign={handleOpenInDesigner}
              career={career}
            />
          ))}
        </div>
      </aside>

      {/* ── Center Main Column: Calendar Order & Direct Approval ─────────────── */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {pageTitle(`Season ${career.currentYear} calendar`)}
              {isAlreadyApproved ? (
                <span style={{ ...pill(), display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: HUB.positive }} /> Approved
                </span>
              ) : (
                <span style={{ ...pill(), marginBottom: 8 }}>
                  Draft
                </span>
              )}
            </div>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 14, color: HUB.textMuted, margin: 0 }}>
              Drag rounds to reorder. Set sprint weekends, check logistics and approve the calendar here.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleReset}
              className={btnClass('danger')}
              style={btn('danger', 'sm')}
            >
              <RotateCcw size={14} strokeWidth={1.5} />Reset calendar
            </button>
            <button
              onClick={handleSaveDraft}
              className={btnClass('secondary')}
              style={btn('secondary', 'sm')}
            >
              <Save size={14} strokeWidth={1.5} />Save draft
            </button>
          </div>
        </div>

        {/* ── Direct Ratification & Approval Scene Banner ─────────────────────── */}
        <div style={{
          ...glassCard({ padding: '24px' }),
          marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
        }}>
          <div>
            {sectionLabel(validation.isValid ? 'Ready to approve' : 'Validation pending')}
            <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: '0 0 4px' }}>
              {draftCircuits.length} rounds · {draftCircuits.filter(r => r.sprint).length} sprint weekends
            </h3>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, margin: 0 }}>
              {validation.isValid
                ? 'All requirements met. Approving makes this the season calendar.'
                : 'Resolve the calendar errors or minimum round count to approve.'}
            </p>
          </div>

          <button
            onClick={handleApproveSeason}
            disabled={!validation.isValid}
            className={btnClass('primary')}
            style={btn('primary', 'md')}
          >
            <Flag size={16} strokeWidth={1.5} />
            <span>Approve calendar</span>
          </button>
        </div>

        {/* Validation Errors / Warnings */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 16px', marginBottom: 20,
            background: HUB.surface,
            border: `1px solid ${HUB.border}`,
            borderRadius: 10
          }}>
            {validation.errors.map((e: any, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} strokeWidth={1.5} color={HUB.negative} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>{e.message}</span>
              </div>
            ))}
            {validation.warnings.map((w: any, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} strokeWidth={1.5} color={HUB.warning} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted }}>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Drag and Drop Race List */}
        {draftCircuits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: HUB.textMuted }}>
            <CalendarDays size={40} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>No circuits in the calendar</p>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textFaint }}>
              Add circuits from the left panel or generate a new track.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {draftCircuits.map((race, i) => (
              <DraggableCalendarRaceRow
                key={`${race.circuitId || race.circuit}-${i}`}
                race={race}
                index={i}
                total={draftCircuits.length}
                isDragging={draggedIndex === i}
                isDragOver={dragOverIndex === i}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onRemove={handleRemove}
                onMove={handleMove}
                onToggleSprint={handleToggleSprint}
                onDesignTrack={handleOpenInDesigner}
                career={career}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Right Column: Scorecard & Regional Stats ─────────────────────────── */}
      <aside style={{
        width: 270, flexShrink: 0, background: HUB.sidebar,
        borderLeft: `1px solid ${HUB.border}`,
        padding: '28px 20px', overflowY: 'auto'
      }}>
        <div style={{ marginBottom: 12 }}>{sectionLabel('Calendar scorecard')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: <Flag size={14} strokeWidth={1.5} />, label: 'Grands Prix', value: scorecard.totalRaces, color: HUB.textPrimary },
            { icon: <Zap size={14} strokeWidth={1.5} />, label: 'Sprint weekends', value: scorecard.sprintWeekends, color: HUB.textPrimary },
            { icon: <Globe size={14} strokeWidth={1.5} />, label: 'Continents', value: scorecard.continentsRepresented, color: HUB.textPrimary },
            { icon: <Globe size={14} strokeWidth={1.5} />, label: 'Countries', value: scorecard.regionsRepresented, color: HUB.textPrimary },
            { icon: <DollarSign size={14} strokeWidth={1.5} />, label: 'Est. promoter revenue', value: `$${scorecard.estimatedRevenue}M`, color: HUB.textPrimary },
            { icon: <DollarSign size={14} strokeWidth={1.5} />, label: 'Logistics costs', value: `$${scorecard.estimatedLogisticsCost}M`, color: HUB.textPrimary },
            { icon: <CheckCircle size={14} strokeWidth={1.5} />, label: 'European rounds', value: scorecard.europeanRaces, color: HUB.textPrimary },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: HUB.raised, borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', color: HUB.textFaint }}>{item.icon}</span>
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{item.label}</span>
              </div>
              <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Regional Breakdown */}
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 8 }}>{sectionLabel('Regional density')}</div>
          {(() => {
            const counts: Record<string, number> = {};
            draftCircuits.forEach(r => {
              const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === (r.circuitId || r.circuit));
              const region = lib?.region || r.country || 'Unknown';
              counts[region] = (counts[region] || 0) + 1;
            });
            return Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .map(([region, count]) => (
                <div key={region} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${HUB.border}` }}>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{region}</span>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{count}</span>
                </div>
              ));
          })()}
        </div>
      </aside>

      {/* ── Modal: Track Generator & Synthesizer (Downtown Dubai, etc.) ───────── */}
      {showGenerateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            ...glassCard({ padding: '24px' }), maxWidth: 840, width: '100%',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                {sectionLabel('Track generator')}
                <h2 style={{ fontFamily: HUB.fontBold, fontSize: 20, color: HUB.textPrimary, margin: 0 }}>
                  Generate a new circuit
                </h2>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                aria-label="Close"
                title="Close"
                className={btnClass('ghost')}
                style={iconBtn('sm')}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Presets Bar */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, display: 'block', marginBottom: 8 }}>
                Preset
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {TRACK_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setCustomTrackName(preset.name);
                      setCustomCountry(preset.country);
                      setCustomCorners(preset.points.length);
                    }}
                    style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: selectedPresetId === preset.id ? HUB.accentSoft : HUB.raised,
                      border: `1px solid ${selectedPresetId === preset.id ? 'rgba(225,6,0,0.4)' : HUB.border}`,
                      color: selectedPresetId === preset.id ? HUB.textPrimary : HUB.textMuted,
                      fontFamily: HUB.fontBold, fontSize: 12, textAlign: 'left', cursor: 'pointer',
                      transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`
                    }}
                  >
                    <div style={{ color: HUB.textPrimary, fontSize: 13 }}>{preset.name}</div>
                    <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginTop: 2 }}>{preset.country} · {preset.type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Two-Column Preview: Left Blueprint SVG, Right Specs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 24 }}>
              {/* SVG Blueprint Canvas */}
              <div style={{
                background: HUB.sidebar, borderRadius: 14, border: `1px solid ${HUB.border}`,
                padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>
                    Blueprint preview
                  </span>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>FIA Grade 1</span>
                </div>
                <svg width="360" height="260" viewBox="0 0 640 480" style={{ width: '100%', height: 'auto', background: HUB.bg, borderRadius: 8 }}>
                  <defs>
                    <pattern id="modalGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(237,237,237,0.04)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#modalGrid)" />
                  {previewBlueprint.svgPath && (
                    <>
                      <path d={previewBlueprint.svgPath} fill="none" stroke={HUB.raised} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={previewBlueprint.svgPath} fill="none" stroke={HUB.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  {previewBlueprint.points?.map((pt: any, i: number) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r={i === 0 ? 7 : 3} fill={i === 0 ? HUB.accent : HUB.textFaint} />
                  ))}
                </svg>
                <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 8 }}>
                  Red marker: start/finish line and main straight
                </div>
              </div>

              {/* Technical Specifications */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sectionLabel('Circuit profile')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={statCell()}>
                    <div style={{ fontSize: 12, color: HUB.textFaint }}>Length</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>{previewBlueprint.lengthKm} km</div>
                  </div>
                  <div style={statCell()}>
                    <div style={{ fontSize: 12, color: HUB.textFaint }}>Corners</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>{previewBlueprint.corners} turns</div>
                  </div>
                  <div style={statCell()}>
                    <div style={{ fontSize: 12, color: HUB.textFaint }}>Target laps</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>{previewBlueprint.laps} laps</div>
                  </div>
                  <div style={statCell()}>
                    <div style={{ fontSize: 12, color: HUB.textFaint }}>Hosting fee</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary }}>${previewBlueprint.hostingFee}M</div>
                  </div>
                </div>

                <div style={statCell()}>
                  <div style={{ fontSize: 12, color: HUB.textFaint, marginBottom: 4 }}>Track character</div>
                  <div style={{ fontSize: 13, color: HUB.textPrimary, lineHeight: 1.5 }}>
                    {previewBlueprint.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${HUB.border}`, paddingTop: 16 }}>
              <button
                onClick={() => setShowGenerateModal(false)}
                className={btnClass('secondary')}
                style={btn('secondary', 'md')}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleOpenInDesigner(previewBlueprint)}
                  className={btnClass('secondary')}
                  style={btn('secondary', 'md')}
                >
                  <Sliders size={16} strokeWidth={1.5} />
                  <span>Edit in circuit designer</span>
                </button>

                <button
                  onClick={() => handleAddGeneratedToCalendar(previewBlueprint)}
                  className={btnClass('primary')}
                  style={btn('primary', 'md')}
                >
                  <Plus size={16} strokeWidth={1.5} />
                  <span>Add to calendar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Celebration of Official Calendar Ratification ─────────────── */}
      {showRatifiedModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            ...glassCard({ padding: '32px' }), maxWidth: 540, width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: HUB.raised,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              border: `1px solid ${HUB.border}`
            }}>
              <Trophy size={24} strokeWidth={1.5} color={HUB.textPrimary} />
            </div>

            {sectionLabel('FIA World Motor Sport Council')}
            <h2 style={{ fontFamily: HUB.fontBold, fontSize: 22, color: HUB.textPrimary, margin: '0 0 8px' }}>
              Season {career.currentYear} calendar approved
            </h2>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 14, color: HUB.textMuted, margin: '0 0 24px', lineHeight: 1.6 }}>
              Constructors and promoters have been notified, and regulations for all {draftCircuits.length} rounds are now in effect.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ background: HUB.raised, padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: HUB.textFaint }}>Grands Prix</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary }}>{draftCircuits.length}</div>
              </div>
              <div style={{ background: HUB.raised, padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: HUB.textFaint }}>Sprint rounds</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary }}>{draftCircuits.filter(r => r.sprint).length}</div>
              </div>
              <div style={{ background: HUB.raised, padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: HUB.textFaint }}>Promoter revenue</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary }}>${scorecard.estimatedRevenue}M</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowRatifiedModal(false)}
                className={btnClass('secondary')}
                style={btn('secondary', 'md')}
              >
                Keep viewing calendar
              </button>
              <button
                onClick={() => renderFIADashboard(appRoot)}
                className={btnClass('primary')}
                style={btn('primary', 'md')}
              >
                Back to FIA dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function renderFIACalendarBoard(root: HTMLElement) {
  renderToAppRoot(root, <FIACalendarBoard appRoot={root} />);
}
