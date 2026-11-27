import React, { useMemo, useState } from 'react';
import { HUB, glassCard, statCell } from '../HubLayout.tsx';
import { Activity, Layers, TrendingUp, Users } from 'lucide-react';
import { getDriverHeadshotUrl } from '../../data/drivers.js';
import { buildRaceTrace, buildLapPositions, formatLapTime, formatDelta } from '../../utils/racePace.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const h3 = (icon: React.ReactNode, text: string, sub?: string, right?: React.ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
    {icon}
    <div>
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{text}</h3>
      {sub && <p style={{ margin: '4px 0 0', fontSize: '12px', color: HUB.textFaint }}>{sub}</p>}
    </div>
    {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
  </div>
);

const toggleBtn = (active: boolean): React.CSSProperties => ({
  height: '28px',
  padding: '0 12px',
  fontSize: '12px',
  background: active ? HUB.accentSoft : HUB.raised,
  border: `1px solid ${active ? 'rgba(225,6,0,0.4)' : HUB.border}`,
  borderRadius: '8px',
  color: active ? HUB.textPrimary : HUB.textMuted,
  cursor: 'pointer',
  fontFamily: HUB.fontRegular,
});

const tooltipStyle = {
  backgroundColor: HUB.sidebar,
  borderColor: HUB.borderMid,
  borderWidth: 1,
  titleColor: HUB.textPrimary,
  bodyColor: HUB.textMuted,
  padding: 10,
};

// ─── Per-driver stint breakdown ──────────────────────────────────────────────
const DriverStintCard = ({ d, analysis }: any) => {
  const a = d.analysis;
  const conv = d.paceRank && !d.retired ? d.paceRank - d.finishPos : null;
  const halfDelta = a.firstHalfMedian != null && a.secondHalfMedian != null ? a.secondHalfMedian - a.firstHalfMedian : null;
  const stats = [
    { label: 'Pace rank', val: d.paceRank ? `P${d.paceRank}` : '–', sub: d.retired ? 'Retired' : `Finished P${d.finishPos}`, color: conv == null ? HUB.textPrimary : conv > 0 ? HUB.positive : conv < 0 ? HUB.negative : HUB.textPrimary },
    { label: 'Median lap', val: formatLapTime(a.median), sub: d.gapToFastest == null ? 'Not ranked' : d.gapToFastest < 0.0005 ? 'Fastest on track' : `+${d.gapToFastest.toFixed(3)}s to fastest` },
    { label: 'Best clean lap', val: formatLapTime(a.best), sub: analysis.fastestLap ? `Race best ${formatLapTime(analysis.fastestLap.time)}` : '' },
    d.rankable
      ? { label: 'Consistency', val: `${a.consistency}`, sub: `±${a.residualSd.toFixed(3)}s scatter`, color: a.consistency >= 75 ? HUB.positive : a.consistency >= 50 ? HUB.warning : HUB.negative }
      : { label: 'Consistency', val: '–', sub: 'Too few clean laps' },
    { label: 'Tyre drop-off', val: a.trend == null ? '–' : `${formatDelta(a.trend)}s`, sub: 'Per lap, within a stint' },
    { label: '2nd half vs 1st', val: halfDelta == null ? '–' : `${formatDelta(halfDelta)}s`, sub: halfDelta == null ? 'Not enough laps' : halfDelta < 0 ? 'Quicker late on' : 'Slower late on' },
  ];
  const totalLaps = Math.max(analysis.raceLaps, a.lapsCompleted);

  return (
    <div style={{ padding: '16px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <img src={getDriverHeadshotUrl(d.name)} alt={d.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <div style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{d.name}</div>
          <div style={{ fontSize: '12px', color: HUB.textMuted }}>{a.cleanLapCount} clean of {a.lapsCompleted} laps · {a.stints.length} {a.stints.length === 1 ? 'stint' : 'stints'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={statCell({ padding: '10px 12px' })}>
            <span style={{ display: 'block', fontSize: '11px', color: HUB.textFaint, marginBottom: '4px' }}>{s.label}</span>
            <span style={{ display: 'block', fontSize: '16px', fontFamily: HUB.fontMono, color: (s as any).color || HUB.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{s.val}</span>
            <span style={{ display: 'block', fontSize: '11px', color: HUB.textMuted, marginTop: '2px' }}>{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Stint strip across the race distance */}
      <div style={{ display: 'flex', height: '10px', borderRadius: '4px', overflow: 'hidden', background: HUB.bg, marginBottom: '12px' }}>
        {a.stints.map((st: any, i: number) => (
          <div
            key={st.index}
            title={`Stint ${st.index}: laps ${st.startLap}–${st.endLap}`}
            style={{
              width: `${(st.laps / totalLaps) * 100}%`,
              background: i % 2 === 0 ? 'rgba(237,237,237,0.45)' : 'rgba(237,237,237,0.2)',
              borderRight: i < a.stints.length - 1 ? `2px solid ${HUB.accent}` : 'none',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '48px 70px 1fr 1fr 1.4fr 1fr', gap: '8px', fontSize: '11px', color: HUB.textFaint, padding: '0 4px 6px' }}>
        <div>Stint</div><div>Laps</div><div>Median</div><div>Best</div><div>Open → close</div><div>Drop-off</div>
      </div>
      {a.stints.map((st: any) => (
        <div key={st.index} style={{ display: 'grid', gridTemplateColumns: '48px 70px 1fr 1fr 1.4fr 1fr', gap: '8px', fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary, padding: '6px 4px', borderTop: `1px solid ${HUB.border}` }}>
          <div style={{ color: HUB.textMuted }}>{st.index}</div>
          <div style={{ color: HUB.textMuted }}>L{st.startLap}–{st.endLap}</div>
          <div>{st.median == null ? '–' : formatLapTime(st.median)}</div>
          <div>{st.best == null ? '–' : formatLapTime(st.best)}</div>
          <div style={{ color: HUB.textMuted }}>
            {st.opening != null && st.closing != null ? `${formatLapTime(st.opening)} → ${formatLapTime(st.closing)}` : '–'}
          </div>
          <div style={{ color: st.trend == null ? HUB.textFaint : st.trend > 0.08 ? HUB.negative : st.trend < 0.02 ? HUB.positive : HUB.warning }}>
            {st.trend == null ? '–' : `${formatDelta(st.trend)}s`}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main deep-dive ──────────────────────────────────────────────────────────
export const RacePaceDeepDive = ({ results, analysis, playerNames, activeDrivers, colorFor, replayData }: any) => {
  const [traceMode, setTraceMode] = useState<'gap' | 'position'>('gap');

  const trace = useMemo(() => buildRaceTrace(results), [results]);
  const positions = useMemo(() => buildLapPositions(results), [results]);

  const playerDrivers = analysis.drivers.filter((d: any) => playerNames.includes(d.name) && d.analysis);
  const shown = new Set<string>([...activeDrivers, ...playerNames]);
  const maxLaps = analysis.raceLaps;
  const labels = Array.from({ length: maxLaps }, (_, i) => `L${i + 1}`);

  // Race trace / positions
  const traceDatasets = trace.traces
    .filter((t: any) => shown.has(t.name))
    .map((t: any) => {
      const isPlayer = playerNames.includes(t.name);
      const data = traceMode === 'gap' ? t.gaps : (positions.get(t.name) || []);
      return {
        label: t.name,
        data: Array.from({ length: maxLaps }, (_, i) => (i < data.length ? data[i] : null)),
        borderColor: colorFor(t.name),
        backgroundColor: colorFor(t.name),
        borderWidth: isPlayer ? 2.5 : 1.25,
        borderDash: playerNames.indexOf(t.name) === 1 ? [6, 4] : [],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: traceMode === 'gap' ? 0.2 : 0,
        stepped: traceMode === 'position' ? ('middle' as const) : false,
        order: isPlayer ? 0 : 1,
      };
    });

  const traceOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
    plugins: {
      legend: { position: 'bottom', labels: { color: HUB.textMuted, boxWidth: 10, font: { size: 11 } } },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          title: (items: any) => `Lap ${items[0].dataIndex + 1}`,
          label: (c: any) => c.parsed.y == null ? null : traceMode === 'gap'
            ? `${c.dataset.label}: ${c.parsed.y >= 0 ? '+' : ''}${c.parsed.y.toFixed(1)}s`
            : `${c.dataset.label}: P${c.parsed.y}`,
        },
      },
    },
    scales: {
      y: traceMode === 'gap'
        ? { reverse: true, grid: { color: HUB.border }, ticks: { color: HUB.textFaint, callback: (v: any) => `${v > 0 ? '+' : ''}${Number(v).toFixed(0)}s` }, title: { display: true, text: "Gap to winner's average pace", color: HUB.textFaint, font: { size: 11 } } }
        : { reverse: true, min: 1, max: results.length, grid: { color: HUB.border }, ticks: { color: HUB.textFaint, stepSize: 1, callback: (v: any) => `P${v}` } },
      x: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint, maxTicksLimit: 20 } },
    },
  };

  // Teammate lap-by-lap delta (player's two cars)
  let mateDelta: { labels: string[]; data: (number | null)[]; a: string; b: string; aheadA: number; aheadB: number; median: number } | null = null;
  if (playerDrivers.length >= 2) {
    const [A, B] = playerDrivers;
    const cleanA = new Map(A.analysis.laps.filter((l: any) => l.type === 'clean').map((l: any) => [l.lap, l.time]));
    const cleanB = new Map(B.analysis.laps.filter((l: any) => l.type === 'clean').map((l: any) => [l.lap, l.time]));
    const data = labels.map((_, i) => {
      const ta = cleanA.get(i + 1) as number | undefined;
      const tb = cleanB.get(i + 1) as number | undefined;
      return ta != null && tb != null ? ta - tb : null;
    });
    const valid = data.filter((v): v is number => v != null);
    if (valid.length >= 3) {
      const sorted = [...valid].sort((x, y) => x - y);
      mateDelta = {
        labels, data, a: A.name, b: B.name,
        aheadA: valid.filter(v => v < 0).length,
        aheadB: valid.filter(v => v > 0).length,
        median: sorted[Math.floor(sorted.length / 2)],
      };
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Stint analysis for the player's drivers */}
      {playerDrivers.length > 0 && (
        <div style={glassCard()}>
          {h3(<Layers size={16} strokeWidth={1.5} color={HUB.textMuted} />, 'Stint analysis', 'Clean-lap pace per stint · drop-off is the lap-time trend per lap (fuel burn included)')}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(420px, 1fr))`, gap: '16px' }}>
            {playerDrivers.map((d: any) => <DriverStintCard key={d.name} d={d} analysis={analysis} />)}
          </div>
        </div>
      )}

      {/* Race trace */}
      {trace.traces.length > 0 && (
        <div style={glassCard()}>
          {h3(
            <TrendingUp size={16} strokeWidth={1.5} color={HUB.textMuted} />,
            traceMode === 'gap' ? 'Race trace' : 'Position by lap',
            traceMode === 'gap'
              ? `Cumulative gap to a car lapping at the winner's average (${formatLapTime(trace.refLap)}). Higher is better: a falling line is losing time, sharp drops are pit stops.`
              : 'Running order at the end of every lap',
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="hub-btn" style={toggleBtn(traceMode === 'gap')} aria-pressed={traceMode === 'gap'} onClick={() => setTraceMode('gap')}>Gap</button>
              <button className="hub-btn" style={toggleBtn(traceMode === 'position')} aria-pressed={traceMode === 'position'} onClick={() => setTraceMode('position')}>Positions</button>
            </div>
          )}
          <div style={{ height: '360px' }}>
            <Line data={{ labels, datasets: traceDatasets as any }} options={traceOptions} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '11px', color: HUB.textFaint }}>Shows the drivers selected in the lap-time filter above, plus your drivers.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: mateDelta ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* Teammate lap delta */}
        {mateDelta && (
          <div style={glassCard()}>
            {h3(<Users size={16} strokeWidth={1.5} color={HUB.textMuted} />, 'Teammate lap delta', `${mateDelta.a} minus ${mateDelta.b}, clean laps only. Below zero = ${mateDelta.a.split(' ').pop()} quicker.`)}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '12px', fontSize: '12px', color: HUB.textMuted }}>
              <span>{mateDelta.a.split(' ').pop()} quicker <strong style={{ fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>{mateDelta.aheadA}</strong> laps</span>
              <span>{mateDelta.b.split(' ').pop()} quicker <strong style={{ fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>{mateDelta.aheadB}</strong> laps</span>
              <span>Median <strong style={{ fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>{formatDelta(mateDelta.median)}s</strong></span>
            </div>
            <div style={{ height: '240px' }}>
              <Bar
                data={{
                  labels: mateDelta.labels,
                  datasets: [{
                    label: 'Delta',
                    data: mateDelta.data,
                    backgroundColor: mateDelta.data.map(v => (v ?? 0) < 0 ? HUB.accent : 'rgba(237,237,237,0.45)'),
                    borderRadius: 2,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { title: (i: any) => `Lap ${i[0].dataIndex + 1}`, label: (c: any) => `${formatDelta(c.parsed.y)}s` } } },
                  scales: {
                    y: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint, callback: (v: any) => `${Number(v).toFixed(1)}s` } },
                    x: { grid: { display: false }, ticks: { color: HUB.textFaint, maxTicksLimit: 12 } },
                  },
                } as any}
              />
            </div>
          </div>
        )}

        {/* Constructor race pace */}
        {analysis.teams.length > 0 && (
          <div style={{ ...glassCard(), padding: 0 }}>
            <div style={{ padding: '16px 16px 0' }}>
              {h3(<Activity size={16} strokeWidth={1.5} color={HUB.textMuted} />, 'Constructor race pace', "Each team's quicker car, median clean lap")}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(110px, 1.4fr) minmax(110px, 1fr) 56px 64px 64px', gap: '8px', padding: '8px 16px', fontSize: '11px', color: HUB.textFaint, background: HUB.bg }}>
              <div>#</div><div>Team</div><div>Gap</div><div>%</div><div>Car gap</div><div>Drop-off</div>
            </div>
            {analysis.teams.map((t: any) => {
              const isMe = t.drivers.some((n: string) => playerNames.includes(n));
              const maxGap = analysis.teams[analysis.teams.length - 1].gapToFastest || 1;
              return (
                <div key={t.team} style={{ display: 'grid', gridTemplateColumns: '28px minmax(110px, 1.4fr) minmax(110px, 1fr) 56px 64px 64px', gap: '8px', padding: '8px 16px', fontSize: '12px', alignItems: 'center', borderBottom: `1px solid ${HUB.border}`, background: isMe ? HUB.accentSoft : 'transparent', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>
                  <div style={{ color: HUB.textMuted }}>{t.paceRank}</div>
                  <div style={{ fontFamily: HUB.fontBold, color: isMe ? HUB.accentInk : HUB.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.team}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '4px', background: HUB.raised, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(t.gapToFastest / maxGap) * 100}%`, height: '100%', background: isMe ? HUB.accent : 'rgba(237,237,237,0.5)' }} />
                    </div>
                    <span style={{ minWidth: '48px', textAlign: 'right', color: HUB.textMuted }}>{t.gapToFastest < 0.0005 ? '—' : `+${t.gapToFastest.toFixed(3)}`}</span>
                  </div>
                  <div style={{ color: HUB.textMuted }}>{t.gapPct < 0.0005 ? '—' : `${t.gapPct.toFixed(2)}%`}</div>
                  <div style={{ color: HUB.textMuted }}>{t.intraGap == null ? '–' : `${t.intraGap.toFixed(2)}s`}</div>
                  <div style={{ color: HUB.textMuted }}>{t.trend == null ? '–' : formatDelta(t.trend, 2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
