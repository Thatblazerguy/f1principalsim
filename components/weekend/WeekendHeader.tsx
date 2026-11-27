import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Timer, Zap, Flag, Check, Lock, CalendarClock, CloudRain, Sun, LayoutGrid, SlidersHorizontal, ListOrdered } from 'lucide-react';
import { btn, btnClass } from '../HubLayout.tsx';
import { CircuitThumb } from './CircuitMap.tsx';

export type WeekendView = 'overview' | 'prep' | 'results';

const STEP_ICON: Record<string, any> = { practice: Activity, qualifying: Timer, sprint: Zap, race: Flag };

export function WeekendHeader({
  round, intel, year, totalRounds, raceDateLabel, daysUntilRace, weather, session, view, setView, hasResults,
  loading, canAdvanceDay, onPractice, onQuali, onSprint, onQuickSim, onRaceControl, onAdvanceDay, statusMessage,
}: any) {
  const next = session.raceDone ? null : !session.live ? 'advance' : !session.qualiDone ? 'qualifying' : !session.sprintDone ? 'sprint' : 'race_control';
  const variant = (id: string) => (next === id ? 'primary' : 'secondary') as 'primary' | 'secondary';
  const views: { id: WeekendView; label: string; icon: any; hidden?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'prep', label: 'Setup and strategy', icon: SlidersHorizontal, hidden: session.raceDone },
    { id: 'results', label: 'Results', icon: ListOrdered, hidden: !hasResults },
  ];

  return (
    <header className="wk-head" aria-label="Race weekend">
      <div className="wk-head-main">
        <div className="wk-head-id">
          <CircuitThumb grandPrix={round.name} corners={intel?.corners ?? null} className="wk-head-thumb" />
          <div className="wk-head-copy">
            <p className="wk-kicker">
              <span className="wk-roundtag">R{String(round.round).padStart(2, '0')}</span>
              Round {round.round} of {totalRounds} · Season {year}{round.sprint ? ' · Sprint weekend' : ''}
            </p>
            <h1 className="wk-title">{round.name}</h1>
            <p className="wk-sub">{round.circuit} · {intel?.country || round.country}{intel?.region ? `, ${intel.region}` : ''}</p>
          </div>
        </div>

        <dl className="wk-head-facts">
          <div>
            <dt><CalendarClock size={14} strokeWidth={1.5} />Race</dt>
            <dd>{session.raceDone ? 'Complete' : daysUntilRace > 0 ? `In ${daysUntilRace} day${daysUntilRace === 1 ? '' : 's'}` : 'Today'}<em>{raceDateLabel}</em></dd>
          </div>
          <div>
            <dt>{weather?.isWet ? <CloudRain size={14} strokeWidth={1.5} /> : <Sun size={14} strokeWidth={1.5} />}Forecast</dt>
            <dd>{weather ? `${weather.isWet ? 'Wet' : 'Dry'} · ${weather.trackTemperature}°C` : '–'}<em>{weather ? `${weather.rainProbability}% chance of rain` : ''}</em></dd>
          </div>
          <div>
            <dt><span className={`wk-light ${session.live ? 'is-live' : session.raceDone ? 'is-done' : ''}`} />Session</dt>
            <dd>{session.current}<em>{session.next}</em></dd>
          </div>
        </dl>
      </div>

      <div className="wk-head-bar">
        <nav className="wk-views" aria-label="Weekend views">
          {views.filter(v => !v.hidden).map(v => {
            const Icon = v.icon; const on = view === v.id;
            return (
              <button key={v.id} type="button" className={`wk-view ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => setView(v.id)}>
                {on && <motion.span layoutId="wk-view-active" className="wk-view-active" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
                <Icon size={16} strokeWidth={1.5} /><span>{v.label}</span>
              </button>
            );
          })}
        </nav>

        <ol className="wk-rail" aria-label="Sessions">
          {session.steps.map((st: any, i: number) => {
            const Icon = STEP_ICON[st.id];
            return (
              <li key={st.id} className={`wk-step is-${st.status}`}>
                <span className="wk-step-dot">{st.status === 'done' ? <Check size={12} strokeWidth={2} /> : st.status === 'locked' ? <Lock size={11} strokeWidth={1.75} /> : <Icon size={12} strokeWidth={1.75} />}</span>
                <span>{st.label}</span>
                {i < session.steps.length - 1 && <span className="wk-step-link" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <div className="wk-actions">
          {!session.live && !session.raceDone ? (
            <button type="button" className={btnClass('primary')} style={btn('primary', 'md')} onClick={onAdvanceDay} disabled={!canAdvanceDay || loading}>
              <CalendarClock size={16} strokeWidth={1.5} />Simulate 1 day
            </button>
          ) : session.raceDone ? null : (
            <>
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={onPractice} disabled={loading || session.practiceDone} title={session.practiceDone ? 'Practice is over for this weekend' : undefined}>
                <Activity size={16} strokeWidth={1.5} />Run practice
              </button>
              <button type="button" className={btnClass(variant('qualifying'))} style={btn(variant('qualifying'), 'md')} onClick={onQuali} disabled={loading || session.qualiDone} title={session.qualiDone ? 'Grid is set' : undefined}>
                {session.qualiDone ? <Check size={16} strokeWidth={1.5} /> : <Timer size={16} strokeWidth={1.5} />}Run qualifying
              </button>
              {session.sprintWeekend && (
                <button type="button" className={btnClass(variant('sprint'))} style={btn(variant('sprint'), 'md')} onClick={onSprint} disabled={loading || !session.qualiDone || session.sprintDone} title={!session.qualiDone ? 'Run qualifying first' : session.sprintDone ? 'Sprint complete' : undefined}>
                  {session.sprintDone ? <Check size={16} strokeWidth={1.5} /> : <Zap size={16} strokeWidth={1.5} />}Run sprint
                </button>
              )}
              <span className="wk-actions-sep" aria-hidden="true" />
              <button type="button" className={btnClass('secondary')} style={btn('secondary', 'md')} onClick={onQuickSim} disabled={loading || !session.qualiDone || !session.sprintDone} title={!session.qualiDone ? 'Run qualifying first' : !session.sprintDone ? 'Run the sprint first' : undefined}>
                <Zap size={16} strokeWidth={1.5} />Quick sim
              </button>
              <button type="button" className={btnClass(variant('race_control'))} style={btn(variant('race_control'), 'md')} onClick={onRaceControl} disabled={loading || !session.qualiDone || !session.sprintDone} title={!session.qualiDone ? 'Run qualifying first' : !session.sprintDone ? 'Run the sprint first' : undefined}>
                <Flag size={16} strokeWidth={1.5} />Race control
              </button>
            </>
          )}
        </div>
      </div>

      {(statusMessage || loading) && (
        <p className="wk-status" role="status">{loading ? <span className="wk-spinner" aria-hidden="true" /> : null}{loading ? 'Running session…' : statusMessage}</p>
      )}
    </header>
  );
}
