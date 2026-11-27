import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { state } from '../state.js';
import { drivers as MARKET_POOL, getDriverHeadshotUrl } from '../data/drivers.js';
import { HUB, btnClass, iconBtn } from './HubLayout.tsx';
import { DriverToolsModal } from './DriverToolsModal.tsx';
import { useTween } from './driverToolsMotion.ts';
import { RADAR_AXES, driverOverall, getComparisonFacts, isDriverEmployed } from '../utils/contractOfferModel.js';

type Group = 'mine' | 'market' | 'academy';
type Entry = { id: string; group: Group; driver: any };

const GROUP_LABEL: Record<Group, string> = { mine: 'My drivers', market: 'Market', academy: 'Academy' };

/** Every driver the comparison can show, from live game state. */
export function getComparisonCandidates(): Entry[] {
  const s: any = state;
  const out: Entry[] = [];
  const seen = new Set<string>();
  const push = (group: Group, driver: any) => {
    if (!driver?.name || seen.has(driver.name)) return;
    seen.add(driver.name);
    out.push({ id: `${group}:${driver.name}`, group, driver });
  };
  (s.team?.drivers || []).forEach((d: any) => push('mine', d));
  if (s.team?.reserveDriver) push('mine', s.team.reserveDriver);
  (s.academy?.prospects || []).forEach((d: any) => push('academy', d));
  (MARKET_POOL as any[]).filter((d) => !isDriverEmployed(s, d.name)).forEach((d) => push('market', d));
  return out;
}

const isPlayers = (e?: Entry | null) => !!e && (e.group === 'mine' || e.group === 'academy');

// ─── Picker ───────────────────────────────────────────────────────────────
function DriverPicker({ label, entries, value, onChange }: { label: string; entries: Entry[]; value: Entry | null; onChange: (e: Entry) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => !q || e.driver.name.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, filtered.findIndex((e) => e.id === value?.id)));
    inputRef.current?.focus();
    const onDown = (ev: PointerEvent) => { if (!rootRef.current?.contains(ev.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, uid]);

  const choose = (e: Entry) => { onChange(e); setOpen(false); setQuery(''); btnRef.current?.focus(); };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (ev.key === 'Home') { ev.preventDefault(); setActive(0); }
    else if (ev.key === 'End') { ev.preventDefault(); setActive(filtered.length - 1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (filtered[active]) choose(filtered[active]); }
    else if (ev.key === 'Escape') { ev.preventDefault(); setOpen(false); setQuery(''); btnRef.current?.focus(); }
  };

  let idx = -1;
  const groups: Group[] = ['mine', 'market', 'academy'];

  return (
    <div className="drc-picker" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="drc-picker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value ? value.driver.name : 'none selected'}. Change driver`}
        onClick={() => setOpen((o) => !o)}
      >
        {value && <img className="drc-avatar" src={getDriverHeadshotUrl(value.driver)} alt="" loading="lazy" />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="drc-picker-name">{value ? value.driver.name : 'Choose a driver'}</span>
          <span className="drc-picker-sub">{value ? `${GROUP_LABEL[value.group]} · ${driverOverall(value.driver)} overall` : label}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.5} color={HUB.textMuted} />
      </button>
      {open && (
        <div className="drc-pop">
          <input
            ref={inputRef}
            className="drc-search"
            style={{ margin: 0, borderRadius: 0, border: "none", borderBottom: "1px solid rgba(237,237,237,0.1)", background: "#060607" }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={filtered[active] ? `${uid}-opt-${active}` : undefined}
            aria-label={`Search drivers for ${label.toLowerCase()}`}
            placeholder="Search drivers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul className="drc-list" id={listId} role="listbox" aria-label={label}>
            {filtered.length === 0 && <li className="drc-empty">No drivers match “{query}”</li>}
            {groups.map((g) => {
              const rows = filtered.filter((e) => e.group === g);
              if (!rows.length) return null;
              return (
                <li key={g} role="presentation">
                  <div className="drc-group-label" id={`${uid}-g-${g}`}>{GROUP_LABEL[g]}</div>
                  <ul role="group" aria-labelledby={`${uid}-g-${g}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {rows.map((e) => {
                      idx = filtered.indexOf(e);
                      const i = idx;
                      return (
                        <li
                          key={e.id}
                          id={`${uid}-opt-${i}`}
                          role="option"
                          aria-selected={e.id === value?.id}
                          className={`drc-option${i === active ? ' is-active' : ''}`}
                          onPointerEnter={() => setActive(i)}
                          onClick={() => choose(e)}
                        >
                          <span>{e.driver.name}</span>
                          <span className="drc-option-ovr">{driverOverall(e.driver)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Radar ────────────────────────────────────────────────────────────────
const SIZE = 360;
const C = SIZE / 2;
const R = 128;
const MIN = 40; // radial floor; real attributes sit roughly 45–99, so a 0 floor would hide differences
const MAX = 100;
const N = RADAR_AXES.length;
const angleOf = (i: number) => (-90 + (360 / N) * i) * (Math.PI / 180);
const pt = (i: number, v: number) => {
  const r = (Math.max(0, Math.min(MAX, v) - MIN) / (MAX - MIN)) * R;
  return [C + r * Math.cos(angleOf(i)), C + r * Math.sin(angleOf(i))];
};
const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
const valuesOf = (d: any) => RADAR_AXES.map((a) => Number(d?.[a.key]) || 0);

function Radar({ left, right, leftAccent, rightAccent }: { left: Entry | null; right: Entry | null; leftAccent: boolean; rightAccent: boolean }) {
  const lv = valuesOf(left?.driver);
  const rv = valuesOf(right?.driver);
  const tweened = useTween([...lv, ...rv], 480) as number[];
  const tl = tweened.slice(0, N);
  const tr = tweened.slice(N);
  const [axis, setAxis] = useState<number | null>(null);
  const hitRefs = useRef<(SVGGElement | null)[]>([]);

  const styleFor = (accent: boolean, primary: boolean) => accent
    ? { fill: 'rgba(225,6,0,0.2)', stroke: HUB.accent, dash: undefined as string | undefined }
    : primary
      ? { fill: 'rgba(237,237,237,0.06)', stroke: 'rgba(237,237,237,0.85)', dash: undefined }
      : { fill: 'none', stroke: 'rgba(237,237,237,0.7)', dash: '4 3' };
  // Player's driver is the accent; the other is a neutral outline.
  const ls = styleFor(leftAccent, !rightAccent);
  const rs = styleFor(rightAccent, false);

  const onAxisKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % N;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + N) % N;
    else return;
    e.preventDefault();
    hitRefs.current[next]?.focus();
  };

  const half = Math.PI / N;
  const wedge = (i: number) => {
    const a = angleOf(i);
    const rr = R + 40;
    return `${C},${C} ${C + rr * Math.cos(a - half)},${C + rr * Math.sin(a - half)} ${C + rr * Math.cos(a + half)},${C + rr * Math.sin(a + half)}`;
  };

  const readout = axis !== null ? (() => {
    const [x, y] = pt(axis, MAX + 2);
    const lx = ((C + (x - C) * 0.36) / SIZE) * 100;
    const ly = ((C + (y - C) * 0.36) / SIZE) * 100;
    const a = lv[axis]; const b = rv[axis];
    const delta = Math.round((a - b) * 10) / 10;
    return { lx, ly, a, b, delta };
  })() : null;

  return (
    <div>
      <div className="drc-radar-wrap" onPointerLeave={() => setAxis(null)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Attribute radar. Use Tab to reach an axis and arrow keys to move between axes.">
          {[55, 70, 85, 100].map((ring) => (
            <polygon key={ring} points={poly(Array(N).fill(ring))} fill="none" stroke="rgba(237,237,237,0.08)" strokeWidth={1} />
          ))}
          {[55, 70, 85].map((ring) => {
            // Ring values sit between the first two axes so they never collide with axis labels.
            const rr = ((ring - MIN) / (MAX - MIN)) * R * Math.cos(Math.PI / N);
            const a = angleOf(0) + Math.PI / N;
            return <text key={ring} x={C + rr * Math.cos(a)} y={C + rr * Math.sin(a)} fontSize={9} fill={HUB.textFaint} textAnchor="middle" dominantBaseline="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>{ring}</text>;
          })}
          {RADAR_AXES.map((_, i) => {
            const [x, y] = pt(i, MAX);
            return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={axis === i ? 'rgba(237,237,237,0.45)' : 'rgba(237,237,237,0.08)'} strokeWidth={1} style={{ transition: `stroke 150ms ${HUB.ease}` }} />;
          })}
          {right && <polygon points={poly(tr)} fill={rs.fill} stroke={rs.stroke} strokeWidth={1.5} strokeDasharray={rs.dash} strokeLinejoin="round" />}
          {left && <polygon points={poly(tl)} fill={ls.fill} stroke={ls.stroke} strokeWidth={1.75} strokeDasharray={ls.dash} strokeLinejoin="round" />}
          {axis !== null && (
            <g>
              {left && (() => { const [x, y] = pt(axis, tl[axis]); return <circle cx={x} cy={y} r={4} fill={HUB.bg} stroke={ls.stroke} strokeWidth={2} />; })()}
              {right && (() => { const [x, y] = pt(axis, tr[axis]); return <circle cx={x} cy={y} r={4} fill={HUB.bg} stroke={rs.stroke} strokeWidth={2} />; })()}
            </g>
          )}
          {RADAR_AXES.map((ax, i) => {
            const [x, y] = pt(i, MAX + 14);
            const anchor = Math.abs(x - C) < 4 ? 'middle' : x > C ? 'start' : 'end';
            const a = lv[i]; const b = rv[i];
            const d = Math.round((a - b) * 10) / 10;
            return (
              <g
                key={ax.key}
                ref={(el) => { hitRefs.current[i] = el; }}
                className="drc-axis-hit"
                tabIndex={0}
                role="img"
                aria-label={`${ax.label}: ${left?.driver.name || 'left'} ${a}, ${right?.driver.name || 'right'} ${b}, difference ${d > 0 ? '+' : ''}${d}`}
                onPointerEnter={() => setAxis(i)}
                onFocus={() => setAxis(i)}
                onBlur={() => setAxis((cur) => (cur === i ? null : cur))}
                onKeyDown={(e) => onAxisKey(e, i)}
              >
                <polygon points={wedge(i)} fill="transparent" />
                <circle className="drc-axis-focus" cx={pt(i, MAX)[0]} cy={pt(i, MAX)[1]} r={6} fill="none" stroke="transparent" strokeWidth={1.5} />
                <text className="drc-axis-label" x={x} y={y + 4} textAnchor={anchor} fontSize={11} fill={axis === i ? HUB.textPrimary : HUB.textMuted} style={{ fontFamily: HUB.fontBold, transition: `fill 150ms ${HUB.ease}` }}>{ax.label}</text>
              </g>
            );
          })}
        </svg>
        {readout && (
          <div className="drc-readout" style={{ left: `${readout.lx}%`, top: `${readout.ly}%` }} aria-hidden="true">
            <div style={{ fontFamily: HUB.fontBold, fontSize: 12, marginBottom: 6 }}>{RADAR_AXES[axis!].label}</div>
            <div className="drc-readout-row"><span style={{ color: HUB.textMuted }}><span className="drc-swatch" style={{ background: ls.stroke }} />{left?.driver.name.split(' ').pop()}</span><span style={{ fontFamily: HUB.fontBold }}>{readout.a}</span></div>
            <div className="drc-readout-row"><span style={{ color: HUB.textMuted }}><span className="drc-swatch" style={{ background: rs.stroke }} />{right?.driver.name.split(' ').pop()}</span><span style={{ fontFamily: HUB.fontBold }}>{readout.b}</span></div>
            <div className="drc-readout-row" style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${HUB.border}` }}>
              <span style={{ color: HUB.textMuted }}>Delta</span>
              <span style={{ fontFamily: HUB.fontBold, color: readout.delta > 0 ? HUB.positive : readout.delta < 0 ? HUB.negative : HUB.textPrimary }}>{readout.delta > 0 ? '+' : ''}{readout.delta}</span>
            </div>
          </div>
        )}
      </div>
      <div className="drc-legend">
        {left && <span><span className="drc-swatch" style={{ background: ls.stroke }} />{left.driver.name}</span>}
        {right && <span><span className="drc-swatch" style={{ background: 'transparent', border: `1.5px ${rs.dash ? 'dashed' : 'solid'} ${rs.stroke}` }} />{right.driver.name}</span>}
      </div>
    </div>
  );
}

// ─── Facts table ──────────────────────────────────────────────────────────
function Facts({ left, right }: { left: Entry | null; right: Entry | null }) {
  const a = getComparisonFacts(left?.driver);
  const b = getComparisonFacts(right?.driver);
  const fmt = (v: any, kind: string) => {
    if (v === null || v === undefined) return '–';
    if (kind === 'money') return `$${Number(v).toFixed(1).replace(/\.0$/, '')}M`;
    if (kind === 'merch') return `$${Number(v).toFixed(2)}M`;
    if (kind === 'seasons') return `${v} ${v === 1 ? 'season' : 'seasons'}`;
    return String(v);
  };
  const rows: [string, string, string][] = [
    ['Overall (6-attribute average)', 'overall', 'num'],
    ['Potential ceiling', 'potential', 'num'],
    ['Age', 'age', 'num'],
    ['Salary per season', 'salary', 'money'],
    ['Contract remaining', 'contract', 'seasons'],
    ['Market value', 'market', 'num'],
    ['Merchandise per race', 'merch', 'merch'],
    ['Popularity', 'popularity', 'num'],
  ];
  return (
    <div className="drc-facts">
      <table className="drc-facts-table">
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Side-by-side contract and commercial facts</caption>
        <thead>
          <tr>
            <td className="drc-l" style={{ color: HUB.textMuted, fontSize: 12, fontFamily: HUB.fontRegular }}>{left?.driver.name || '–'}</td>
            <th scope="col" style={{ width: '38%' }}></th>
            <td className="drc-r" style={{ color: HUB.textMuted, fontSize: 12, fontFamily: HUB.fontRegular }}>{right?.driver.name || '–'}</td>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key, kind]) => (
            <tr key={key}>
              <td className="drc-l">{fmt(a?.[key as keyof typeof a], kind)}</td>
              <th scope="row">{label}</th>
              <td className="drc-r">{fmt(b?.[key as keyof typeof b], kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="drc-facts-note">Merchandise and popularity come from the finance model (getDriverCommercialValue). Merchandise is earned each race weekend; salary is charged at 1/24 per race.</p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function DriverRadarCompare({ leftName, rightName, onClose }: { leftName?: string; rightName?: string; onClose: () => void }) {
  const entries = useMemo(() => getComparisonCandidates(), []);
  const find = (name?: string) => entries.find((e) => e.driver.name === name) || null;
  const [left, setLeft] = useState<Entry | null>(() => find(leftName) || entries.find((e) => e.group === 'mine') || entries[0] || null);
  const [right, setRight] = useState<Entry | null>(() => find(rightName) || entries.find((e) => e.id !== (find(leftName) || entries[0])?.id) || null);
  const titleId = useId();

  const leftAccent = isPlayers(left);
  const rightAccent = !leftAccent && isPlayers(right);

  return (
    <DriverToolsModal prefix="drc" labelledBy={titleId} onClose={onClose}>
      <div className="drc-head">
        <div>
          <p className="drc-kicker">Driver comparison</p>
          <h3 className="drc-title" id={titleId}>{left?.driver.name || '–'} vs {right?.driver.name || '–'}</h3>
        </div>
        <button type="button" onClick={onClose} className={btnClass('ghost')} style={iconBtn('md')} aria-label="Close comparison" data-autofocus>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className="drc-body">
        <div className="drc-side">
          <DriverPicker label="Left driver" entries={entries} value={left} onChange={setLeft} />
        </div>
        <Radar left={left} right={right} leftAccent={leftAccent} rightAccent={rightAccent} />
        <div className="drc-side">
          <DriverPicker label="Right driver" entries={entries} value={right} onChange={setRight} />
        </div>
      </div>
      <Facts left={left} right={right} />
    </DriverToolsModal>
  );
}
