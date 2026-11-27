import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { fmtLap, fmtGap, gapBetween, speedKmh, lastName, carCode } from '../../utils/raceControlModel.js';
import { TyreBadge, teamAbbr } from './RaceParts.tsx';

/*
 * Live telemetry for one car, from the engine's own state: lap
 * times, average speed, tyres, fuel, ERS, gaps. Charts use the per-lap
 * history the screen records as each car crosses the line.
 */

function LineChart({ title, series, unit, invert, fmt }: { title: string; series: { id: string; color: string; pts: { x: number; y: number }[]; dashed?: boolean }[]; unit: string; invert?: boolean; fmt: (v: number) => string }) {
  const W = 320; const H = 112; const L = 36; const R = 8; const T = 8; const B = 18;
  const all = series.flatMap(s => s.pts);
  if (all.length < 2) return <div className="rc-chart"><h4>{title}</h4><p className="rc-empty">Builds up as laps are completed</p></div>;
  const xs = all.map(p => p.x); const ys = all.map(p => p.y);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs, x0 + 1);
  let y0 = Math.min(...ys); let y1 = Math.max(...ys);
  if (y1 - y0 < 0.5) { y0 -= 0.25; y1 += 0.25; }
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => invert ? T + ((y - y0) / (y1 - y0)) * (H - T - B) : H - B - ((y - y0) / (y1 - y0)) * (H - T - B);
  const ticks = [y0, (y0 + y1) / 2, y1];
  return (
    <div className="rc-chart">
      <h4>{title}<em>{unit}</em></h4>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="rc-chart-grid" /><text x={L - 6} y={sy(t) + 3} textAnchor="end" className="rc-chart-tick">{fmt(t)}</text></g>)}
        <text x={L} y={H - 4} className="rc-chart-tick">L{x0}</text>
        <text x={W - R} y={H - 4} textAnchor="end" className="rc-chart-tick">L{x1}</text>
        {series.map(s => s.pts.length > 1 && (
          <motion.path key={s.id} d={s.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('')}
            fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.25 : 1.75} strokeDasharray={s.dashed ? '3 3' : undefined} strokeLinejoin="round"
            initial={false} animate={{ opacity: 1 }} />
        ))}
      </svg>
    </div>
  );
}

export function TelemetryPanel({ engine, rows, history, id, onSelect, onClose, lengthKm }: any) {
  const [compare, setCompare] = useState(true);
  const idx = rows.findIndex((r: any) => r.id === id);
  const row = rows[idx];
  if (!row) return null;
  const car = row.car;
  const mate = engine.cars.find((c: any) => c.team.name === car.team.name && c.id !== car.id);
  const mateRow = mate ? rows.find((r: any) => r.id === mate.id) : null;
  const leader = engine.cars[0];
  const toLeader = car === leader ? null : gapBetween(engine, leader, car);
  const toMate = mate && !mate.retired && !car.retired ? (engine.cars.indexOf(mate) < idx ? gapBetween(engine, mate, car) : gapBetween(engine, car, mate)) : null;
  const mateAhead = mate ? engine.cars.indexOf(mate) < idx : false;
  const delta = car.lastLapTime > 0 && car.bestLapTime < 900 ? car.lastLapTime - car.bestLapTime : null;
  const hist = history.cars[car.id] || []; const mHist = mate ? history.cars[mate.id] || [] : [];
  const lapPts = (h: any[]) => h.filter(p => p.lap > 1 && p.lapTime > 0 && p.lapTime < 300 && !p.pit).slice(-30).map(p => ({ x: p.lap, y: p.lapTime }));
  const gapPts = (h: any[]) => h.filter(p => p.gapLeader != null).slice(-30).map(p => ({ x: p.lap, y: p.gapLeader }));
  const wearPts = (h: any[]) => h.slice(-30).map(p => ({ x: p.lap, y: p.wear }));
  const showMate = compare && mate;
  const step = (d: number) => { const n = rows[(idx + d + rows.length) % rows.length]; if (n) onSelect(n.id); };

  return (
    <motion.section className="rc-tele" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`Telemetry: ${car.driver.name}`} style={{ ['--tc' as any]: row.color }}>
      <header className="rc-tele-head">
        <i className="rc-teambar" />
        <div className="rc-tele-id">
          <strong>P{row.pos} {car.driver.name}</strong>
          <em>{car.team.name}{row.state === 'out' ? ` · ${car.dnfReason || 'Retired'}` : row.state === 'pitting' ? ' · In the pit lane' : ''}</em>
        </div>
        {mate && (
          <button type="button" className={`rc-pill ${compare ? 'is-on' : ''}`} aria-pressed={compare} onClick={() => setCompare(c => !c)}>
            <Users size={12} strokeWidth={1.5} />Compare with {lastName(mate.driver.name)}
          </button>
        )}
        <div className="rc-tele-nav">
          <button type="button" className="rc-icon" onClick={() => step(-1)} aria-label="Car ahead"><ChevronLeft size={15} strokeWidth={1.5} /></button>
          <button type="button" className="rc-icon" onClick={() => step(1)} aria-label="Car behind"><ChevronRight size={15} strokeWidth={1.5} /></button>
          <button type="button" className="rc-icon" onClick={onClose} aria-label="Close telemetry"><X size={15} strokeWidth={1.5} /></button>
        </div>
      </header>

      <div className="rc-tele-body">
        <dl className="rc-tele-grid">
          <div><dt>Avg speed this lap</dt><dd className="rc-num">{speedKmh(car, lengthKm) || '–'}<small>km/h</small></dd></div>
          <div><dt>Last lap</dt><dd className="rc-num">{fmtLap(car.lastLapTime)}</dd></div>
          <div><dt>Best lap</dt><dd className={`rc-num ${row.fastest ? 'is-purple' : ''}`}>{fmtLap(car.bestLapTime)}</dd></div>
          <div><dt>Last vs best</dt><dd className={`rc-num ${delta != null && delta < 0.001 ? 'is-green' : ''}`}>{delta == null ? '–' : delta < 0.001 ? 'Best lap' : `+${delta.toFixed(3)}`}</dd></div>
          <div><dt>Tyres</dt><dd><TyreBadge compound={car.tireCompound} age={car.tyreAge} /><span className="rc-num">{Math.round(car.tireWear)}%</span></dd></div>
          <div><dt>Fuel</dt><dd className="rc-num">{car.fuel.toFixed(1)}<small>kg</small></dd></div>
          <div><dt>ERS</dt><dd className="rc-num">{Math.round(car.ers)}<small>% · {car.ersMode}</small></dd></div>
          <div><dt>Gap to leader</dt><dd className="rc-num">{car === leader ? 'Leader' : fmtGap(toLeader)}</dd></div>
          <div><dt>{mate ? `Gap to ${carCode(mate.driver.name)}` : 'Teammate'}</dt><dd className="rc-num">{!mate || !toMate ? '–' : `${fmtGap(toMate).replace('+', '')} ${mateAhead ? 'behind' : 'ahead'}`}</dd></div>
          <div><dt>Position</dt><dd className="rc-num">P{row.pos}<small>{row.change > 0 ? ` +${row.change}` : row.change < 0 ? ` ${row.change}` : ''} from P{row.grid}</small></dd></div>
        </dl>
        <div className="rc-tele-charts">
          <LineChart title="Lap time" unit="seconds, pit laps left out" fmt={v => v.toFixed(1)}
            series={[{ id: 'me', color: row.color, pts: lapPts(hist) }, ...(showMate ? [{ id: 'mate', color: 'rgba(var(--ink),0.45)', pts: lapPts(mHist), dashed: true }] : [])]} />
          <LineChart title="Gap to leader" unit="seconds" invert fmt={v => v.toFixed(0)}
            series={[{ id: 'me', color: row.color, pts: gapPts(hist) }, ...(showMate ? [{ id: 'mate', color: 'rgba(var(--ink),0.45)', pts: gapPts(mHist), dashed: true }] : [])]} />
          <LineChart title="Tyre wear" unit="% of this set" fmt={v => v.toFixed(0)}
            series={[{ id: 'me', color: row.color, pts: wearPts(hist) }, ...(showMate ? [{ id: 'mate', color: 'rgba(var(--ink),0.45)', pts: wearPts(mHist), dashed: true }] : [])]} />
        </div>
        {showMate && mateRow && <p className="rc-tele-key"><span><i style={{ background: row.color }} />{carCode(car.driver.name)}</span><span><i className="is-dash" />{carCode(mate.driver.name)} · {teamAbbr(mate.team.name)} · P{mateRow.pos}</span></p>}
      </div>
    </motion.section>
  );
}
