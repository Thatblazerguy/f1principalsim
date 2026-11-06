import React, { useState, useMemo, useRef } from 'react';
import {
  CalendarDays, Plus, X, ChevronUp, ChevronDown, AlertTriangle, CheckCircle,
  DollarSign, Globe, Zap, RotateCcw, Save, Flag, GripVertical, Sparkles,
  Sliders, ExternalLink, Trophy, ArrowRight, Eye, Check, RefreshCw
} from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
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
      padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)', marginBottom: 6,
      transition: 'all 0.15s ease'
    }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {circuit.name}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, marginTop: 2 }}>
          {circuit.country || lib?.country} · ${circuit.hostingFee || lib?.hostingFee || 40}M
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {circuit.points && (
          <button
            onClick={() => onDesign(circuit)}
            title="Open in Track Designer"
            style={{
              padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', cursor: 'pointer',
              fontSize: 10, display: 'flex', alignItems: 'center'
            }}
          >
            <Eye size={11} />
          </button>
        )}
        <button
          onClick={() => onAdd(circuit)}
          style={{
            padding: '5px 10px', borderRadius: 6, background: 'rgba(225,6,0,0.12)',
            border: '1px solid rgba(225,6,0,0.3)', color: FIA.accent, cursor: 'pointer',
            fontFamily: HUB.fontBold, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          <Plus size={12} /> Add
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
          ? 'rgba(225,6,0,0.08)'
          : isDragOver
          ? 'rgba(225,6,0,0.15)'
          : 'rgba(26,30,46,0.65)',
        border: isDragOver
          ? '2px dashed #E10600'
          : `1px solid ${!eligible ? 'rgba(245,158,11,0.3)' : race.sprint ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isDragOver ? '0 0 16px rgba(225,6,0,0.3)' : 'none',
        marginBottom: 8,
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab',
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
      }}
    >
      {/* Drag Handle */}
      <div
        title="Drag to reorder race calendar"
        style={{ color: HUB.textMuted, cursor: 'grab', display: 'flex', alignItems: 'center' }}
      >
        <GripVertical size={16} />
      </div>

      {/* Round Badge */}
      <div style={{
        fontFamily: HUB.fontBold, fontSize: 11,
        color: race.sprint ? '#F59E0B' : FIA.accent,
        background: race.sprint ? 'rgba(245,158,11,0.12)' : 'rgba(225,6,0,0.12)',
        border: `1px solid ${race.sprint ? 'rgba(245,158,11,0.3)' : 'rgba(225,6,0,0.25)'}`,
        padding: '4px 8px', borderRadius: 6, minWidth: 32, textAlign: 'center'
      }}>
        R{index + 1 < 10 ? `0${index + 1}` : index + 1}
      </div>

      {/* Circuit & Country Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {race.name}
          </span>
          {custom && (
            <span style={{ fontSize: 9, fontFamily: HUB.fontBold, background: 'rgba(59,130,246,0.15)', color: '#60A5FA', padding: '1px 6px', borderRadius: 4 }}>
              CUSTOM
            </span>
          )}
        </div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, display: 'flex', gap: 12, marginTop: 3 }}>
          <span>{race.country || 'International'}</span>
          <span>• {race.laps || lib?.laps || 55} Laps</span>
          <span>• ${race.hostingFee || lib?.hostingFee || 40}M Fee</span>
          {!eligible && (
            <span style={{ color: '#F59E0B', fontFamily: HUB.fontBold }}>⚠️ License Pending</span>
          )}
        </div>
      </div>

      {/* Design / Inspect Track Button */}
      {(custom?.points || lib) && (
        <button
          onClick={() => onDesignTrack(custom || lib)}
          title="Open in Track Designer Studio"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            borderRadius: 6, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1',
            cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 10,
          }}
        >
          <Sliders size={12} /> Design
        </button>
      )}

      {/* Sprint Weekend Toggle Button */}
      <button
        onClick={() => onToggleSprint(index)}
        title="Toggle Sprint Weekend Format"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6, fontFamily: HUB.fontBold, fontSize: 10,
          background: race.sprint ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${race.sprint ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: race.sprint ? '#F59E0B' : HUB.textMuted, cursor: 'pointer',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          transition: 'all 0.15s ease'
        }}
      >
        <Zap size={11} color={race.sprint ? '#F59E0B' : HUB.textMuted} />
        {race.sprint ? 'Sprint ✓' : 'Sprint'}
      </button>

      {/* Reorder Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          title="Move up"
          style={{
            background: 'none', border: 'none',
            color: index === 0 ? 'rgba(255,255,255,0.1)' : HUB.textMuted,
            cursor: index === 0 ? 'default' : 'pointer', padding: 2
          }}
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          title="Move down"
          style={{
            background: 'none', border: 'none',
            color: index === total - 1 ? 'rgba(255,255,255,0.1)' : HUB.textMuted,
            cursor: index === total - 1 ? 'default' : 'pointer', padding: 2
          }}
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(index)}
        title="Remove from calendar"
        style={{
          background: 'none', border: 'none', color: 'rgba(225,6,0,0.5)',
          cursor: 'pointer', padding: 6, borderRadius: 4, transition: 'all 0.15s'
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#E10600'; e.currentTarget.style.backgroundColor = 'rgba(225,6,0,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(225,6,0,0.5)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <X size={15} />
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
    showNotif('Calendar reordered.');
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
      showNotif('Circuit already present in calendar.');
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
    showNotif(`Added "${circuit.name}" to calendar.`);
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
    showNotif('Calendar draft successfully saved!');
  };

  // ── Direct Scene Ratification ──────────────────────────────────────────────
  const handleApproveSeason = () => {
    if (!validation.isValid) {
      showNotif('Cannot approve: please resolve validation errors first.');
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
        { id: `app-${Date.now()}`, message: `Championship Calendar for Season ${career.currentYear} officially ratified with ${draftCircuits.length} rounds.`, time: Date.now() },
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
    showNotif(`Season ${career.currentYear} calendar approved & ratified!`);
  };

  const handleReset = () => {
    setDraftCircuits(buildInitialDraft({ ...career, calendarDrafts: [] }));
    showNotif('Reset to standard 24-race championship.');
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
    showNotif(`"${blueprint.name}" synthesized, licensed & added to calendar!`);
  };

  // ── Open in Track Designer ─────────────────────────────────────────────────
  const handleOpenInDesigner = (circuitOrBlueprint: any) => {
    renderFIACircuitDesigner(appRoot, circuitOrBlueprint);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 400,
          background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.5)',
          padding: '12px 22px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green,
          backdropFilter: 'blur(8px)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>
          {notification}
        </div>
      )}

      {/* ── Left Column: Circuit Selector & Generator ────────────────────────── */}
      <aside style={{
        width: 310, flexShrink: 0, background: '#06080F',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto',
      }}>
        <div>
          <button
            onClick={() => renderFIADashboard(appRoot)}
            style={{
              background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer',
              fontFamily: HUB.fontBold, fontSize: 11, padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            ← BACK TO DASHBOARD
          </button>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            Circuit Selector
          </div>
          <h2 style={{ fontFamily: HUB.fontWide, fontSize: 17, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
            Add Venues
          </h2>
        </div>

        {/* Generate New Track CTA Button */}
        <button
          onClick={() => setShowGenerateModal(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(225,6,0,0.25), rgba(245,158,11,0.2))',
            border: '1px solid rgba(225,6,0,0.45)', color: '#fff',
            cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 12,
            boxShadow: '0 4px 16px rgba(225,6,0,0.2)', transition: 'all 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#E10600'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(225,6,0,0.45)'; }}
        >
          <Sparkles size={15} color="#F59E0B" />
          <span>Generate Track (Dubai...)</span>
        </button>

        {/* Circuit Search Box */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter venues & custom circuits..."
          style={{
            width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff',
            fontFamily: HUB.fontRegular, fontSize: 12, outline: 'none', boxSizing: 'border-box',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
              FIA Championship Calendar
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: 0, textTransform: 'uppercase' }}>
                Season {career.currentYear} Schedule
              </h1>
              {isAlreadyApproved ? (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                  color: FIA.green, fontFamily: HUB.fontBold, fontSize: 11
                }}>
                  <Check size={13} /> OFFICIAL RATIFIED
                </span>
              ) : (
                <span style={{
                  padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', fontFamily: HUB.fontBold, fontSize: 11
                }}>
                  DRAFT IN PROGRESS
                </span>
              )}
            </div>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginTop: 4 }}>
              Drag and drop rounds to reorder the schedule. Configure sprints, review logistics, and ratify directly on scene.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
                borderRadius: 6, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)', color: HUB.textMuted,
                cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              onClick={handleSaveDraft}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 6, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11
              }}
            >
              <Save size={13} /> Save Draft
            </button>
          </div>
        </div>

        {/* ── Direct Ratification & Approval Scene Banner ─────────────────────── */}
        <div style={{
          ...glassCard({ padding: '20px 24px' }),
          background: validation.isValid
            ? 'linear-gradient(135deg, rgba(225,6,0,0.15), rgba(16,185,129,0.06))'
            : 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(225,6,0,0.05))',
          border: validation.isValid ? '1px solid rgba(225,6,0,0.35)' : '1px solid rgba(245,158,11,0.3)',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: validation.isValid ? FIA.green : '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
              {validation.isValid ? 'Calendar Ratification Ready' : 'Calendar Validation Pending'}
            </div>
            <h3 style={{ fontFamily: HUB.fontWide, fontSize: 17, color: '#fff', margin: '0 0 4px' }}>
              {draftCircuits.length} Rounds · {draftCircuits.filter(r => r.sprint).length} Sprint Weekends
            </h3>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>
              {validation.isValid
                ? 'All technical and regulatory requirements met. One-click ratification enforces this calendar.'
                : 'Resolve highlighted calendar warnings or minimum round counts to approve.'}
            </p>
          </div>

          <button
            onClick={handleApproveSeason}
            disabled={!validation.isValid}
            style={{
              ...actionBtn({ padding: '14px 28px', fontSize: 12 }),
              background: validation.isValid
                ? 'linear-gradient(135deg, #E10600, #FF3B30)'
                : 'rgba(255,255,255,0.1)',
              opacity: validation.isValid ? 1 : 0.45,
              cursor: validation.isValid ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: validation.isValid ? '0 6px 20px rgba(225,6,0,0.35)' : 'none'
            }}
          >
            <Flag size={15} />
            <span>APPROVE &amp; RATIFY CALENDAR DIRECTLY</span>
          </button>
        </div>

        {/* Validation Errors / Warnings */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', marginBottom: 20,
            background: validation.errors.length > 0 ? 'rgba(225,6,0,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${validation.errors.length > 0 ? 'rgba(225,6,0,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: 10,
          }}>
            {validation.errors.map((e: any, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={13} color={FIA.accent} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{e.message}</span>
              </div>
            ))}
            {validation.warnings.map((w: any, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={13} color="#F59E0B" style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Drag and Drop Race List */}
        {draftCircuits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: HUB.textMuted }}>
            <CalendarDays size={42} color="rgba(255,255,255,0.1)" style={{ marginBottom: 12 }} />
            <p style={{ fontFamily: HUB.fontBold, fontSize: 15, color: '#fff' }}>No circuits in the calendar.</p>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, opacity: 0.7 }}>
              Select circuits from the left panel or click "Generate Track" to add venues.
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
        width: 270, flexShrink: 0, background: '#06080F',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 20px', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
          Calendar Scorecard
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: <Flag size={14} />, label: 'Total Grands Prix', value: scorecard.totalRaces, color: '#fff' },
            { icon: <Zap size={14} />, label: 'Sprint Weekends', value: scorecard.sprintWeekends, color: '#F59E0B' },
            { icon: <Globe size={14} />, label: 'Continents', value: scorecard.continentsRepresented, color: FIA.blue },
            { icon: <Globe size={14} />, label: 'Countries', value: scorecard.regionsRepresented, color: FIA.blue },
            { icon: <DollarSign size={14} />, label: 'Est. Promoter Revenue', value: `$${scorecard.estimatedRevenue}M`, color: FIA.green },
            { icon: <DollarSign size={14} />, label: 'Logistics Costs', value: `$${scorecard.estimatedLogisticsCost}M`, color: FIA.accent },
            { icon: <CheckCircle size={14} />, label: 'European Rounds', value: scorecard.europeanRaces, color: '#fff' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: item.color }}>{item.icon}</span>
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{item.label}</span>
              </div>
              <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Regional Breakdown */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
            Regional Density
          </div>
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
                <div key={region} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>{region}</span>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: '#fff' }}>{count}</span>
                </div>
              ));
          })()}
        </div>
      </aside>

      {/* ── Modal: Track Generator & Synthesizer (Downtown Dubai, etc.) ───────── */}
      {showGenerateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            ...glassCard({ padding: '32px' }), maxWidth: 840, width: '100%',
            background: '#090D1A', border: '1px solid rgba(255,255,255,0.15)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="#F59E0B" /> FIA Track Synthesizer &amp; Blueprint Engine
                </div>
                <h2 style={{ fontFamily: HUB.fontWide, fontSize: 22, color: '#fff', margin: '6px 0 0', textTransform: 'uppercase' }}>
                  Generate &amp; Design New Circuit
                </h2>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: 20 }}
              >
                ✕
              </button>
            </div>

            {/* Presets Bar */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Select Circuit Archetype / Preset
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
                      background: selectedPresetId === preset.id ? 'rgba(225,6,0,0.18)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedPresetId === preset.id ? FIA.accent : 'rgba(255,255,255,0.08)'}`,
                      color: selectedPresetId === preset.id ? '#fff' : HUB.textMuted,
                      fontFamily: HUB.fontBold, fontSize: 11, textAlign: 'left', cursor: 'pointer'
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: 12 }}>{preset.name}</div>
                    <div style={{ fontSize: 10, color: HUB.textMuted, marginTop: 2 }}>{preset.country} · {preset.type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Two-Column Preview: Left Blueprint SVG, Right Specs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, marginBottom: 24 }}>
              {/* SVG Blueprint Canvas */}
              <div style={{
                background: '#040711', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, textTransform: 'uppercase' }}>
                    Blueprint Telemetry View
                  </span>
                  <span style={{ fontFamily: HUB.fontMono, fontSize: 10, color: FIA.green }}>GRADE 1 FIA SPEC</span>
                </div>
                <svg width="360" height="260" viewBox="0 0 640 480" style={{ width: '100%', height: 'auto', background: 'radial-gradient(circle, #0F172A 0%, #060911 100%)', borderRadius: 8 }}>
                  <defs>
                    <pattern id="modalGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#modalGrid)" />
                  {previewBlueprint.svgPath && (
                    <>
                      <path d={previewBlueprint.svgPath} fill="none" stroke="rgba(225,6,0,0.3)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={previewBlueprint.svgPath} fill="none" stroke="#1E293B" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                      <path d={previewBlueprint.svgPath} fill="none" stroke="#E10600" strokeWidth="2" strokeDasharray="6 3" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  {previewBlueprint.points?.map((pt: any, i: number) => (
                    <circle key={i} cx={pt.x} cy={pt.y} r="4" fill={i === 0 ? '#10B981' : '#fff'} />
                  ))}
                </svg>
                <div style={{ fontSize: 10, color: HUB.textMuted, marginTop: 8 }}>
                  Green marker indicates Start/Finish line &amp; main pit straight.
                </div>
              </div>

              {/* Technical Specifications */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, textTransform: 'uppercase' }}>
                  Circuit Engineering Profile
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ ...glassCard({ padding: '10px 12px' }) }}>
                    <div style={{ fontSize: 10, color: HUB.textMuted }}>Length</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 15, color: '#fff' }}>{previewBlueprint.lengthKm} km</div>
                  </div>
                  <div style={{ ...glassCard({ padding: '10px 12px' }) }}>
                    <div style={{ fontSize: 10, color: HUB.textMuted }}>Corners</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 15, color: '#fff' }}>{previewBlueprint.corners} Turns</div>
                  </div>
                  <div style={{ ...glassCard({ padding: '10px 12px' }) }}>
                    <div style={{ fontSize: 10, color: HUB.textMuted }}>Target Laps</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 15, color: '#fff' }}>{previewBlueprint.laps} Laps</div>
                  </div>
                  <div style={{ ...glassCard({ padding: '10px 12px' }) }}>
                    <div style={{ fontSize: 10, color: HUB.textMuted }}>Hosting Fee</div>
                    <div style={{ fontFamily: HUB.fontBold, fontSize: 15, color: FIA.gold }}>${previewBlueprint.hostingFee}M</div>
                  </div>
                </div>

                <div style={{ ...glassCard({ padding: '12px 14px' }), marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: HUB.textMuted, marginBottom: 4 }}>Track Characteristic</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                    {previewBlueprint.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{ padding: '10px 18px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => handleOpenInDesigner(previewBlueprint)}
                  style={{
                    padding: '10px 18px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Sliders size={13} />
                  <span>Customize in Track Designer →</span>
                </button>

                <button
                  onClick={() => handleAddGeneratedToCalendar(previewBlueprint)}
                  style={{
                    ...actionBtn({ padding: '10px 22px', fontSize: 11 }),
                    background: 'linear-gradient(135deg, #E10600, #FF3B30)',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Plus size={14} />
                  <span>ADD DIRECTLY TO CALENDAR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Celebration of Official Calendar Ratification ─────────────── */}
      {showRatifiedModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }}>
          <div style={{
            ...glassCard({ padding: '36px' }), maxWidth: 540, width: '100%',
            background: 'linear-gradient(135deg, #0A0F1D, #060911)',
            border: '1px solid rgba(16,185,129,0.4)', textAlign: 'center'
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              border: '1px solid rgba(16,185,129,0.4)'
            }}>
              <Trophy size={28} color={FIA.green} />
            </div>

            <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: FIA.green, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
              FIA World Motor Sport Council
            </div>
            <h2 style={{ fontFamily: HUB.fontWide, fontSize: 24, color: '#fff', margin: '0 0 10px', textTransform: 'uppercase' }}>
              Season {career.currentYear} Calendar Ratified!
            </h2>
            <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, margin: '0 0 24px', lineHeight: 1.6 }}>
              The championship calendar has been officially approved. All constructors and promoters have been notified, and regulations for all {draftCircuits.length} rounds are now in effect.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: HUB.textMuted }}>Total Grands Prix</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: '#fff' }}>{draftCircuits.length}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: HUB.textMuted }}>Sprint Rounds</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: '#F59E0B' }}>{draftCircuits.filter(r => r.sprint).length}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: HUB.textMuted }}>Promoter Revenue</div>
                <div style={{ fontFamily: HUB.fontBold, fontSize: 18, color: FIA.green }}>${scorecard.estimatedRevenue}M</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowRatifiedModal(false)}
                style={{ padding: '10px 20px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}
              >
                Keep Viewing Calendar
              </button>
              <button
                onClick={() => renderFIADashboard(appRoot)}
                style={{ ...actionBtn({ padding: '10px 24px', fontSize: 11 }) }}
              >
                Return to FIA Hub →
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
