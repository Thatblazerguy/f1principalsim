import React, { useReducer, useRef, useState, useLayoutEffect } from 'react';
import { getConstructorOrder } from "../utils/championshipModel.js";
import { ChevronRight, CloudRain, Sun } from 'lucide-react';
import { HUB, btn, btnClass } from '../components/HubLayout.tsx';
import { getTrackPath } from '../data/realTrackLayouts.js';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';
import { state } from "../state.js";
import { ensureSeasonTimeline, getRoundRaceDay, formatSeasonDate, simulateNextDay, canSimulateNextDay } from "../utils/seasonTimeline.js";
import { ensureTeamState, getActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { generateUnifiedRaceWeekend } from "../utils/raceObjectives.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { getChampionshipSeries, getBudgetSeries, getTeamProfile } from "../utils/dashboardModel.js";
import { ChampionshipChart } from "../components/dashboard/ChampionshipChart.tsx";
import { BudgetChart } from "../components/dashboard/BudgetChart.tsx";
import { RivalDrawer } from "../components/dashboard/RivalDrawer.tsx";

import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.tsx";
import { renderMyDrivers } from "./myDrivers.tsx";
import { renderTeams } from "./teams.tsx";
import { renderCalendar } from "./calendar.tsx";
import { renderLeaderboard } from "./leaderboard.tsx";
import { renderOffseason } from "./offseason.tsx";
import { renderMarket } from "./market.tsx";
import { renderSponsors } from "./sponsors.tsx";
import { renderFinance } from "./finance.tsx";





export function ChampionshipHub({ appRoot, rerenderFn }) {
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    const [rivalName, setRivalName] = useState<string | null>(null);

    ensureTeamState(state.team);
    ensureSeasonTimeline(state);
    
    const totalRounds = Math.min(state.season.totalRounds || (state.season.calendar || []).length || 24, 24);
    const isSeasonOver = state.season.round > totalRounds || (state.weekendProgress?.raceComplete && state.season.round === totalRounds);
    const nextRound = isSeasonOver ? null : (state.season.calendar || []).find(r => r.round === state.season.round);
    const currentDay = state.season.currentDay;
    const raceDay = nextRound ? getRoundRaceDay(nextRound.round) : null;
    const daysUntilRace = nextRound ? Math.max(0, raceDay - currentDay) : 0;
    const canAdvanceDay = canSimulateNextDay(state);

    
    if (!state.raceWeekend || state.raceWeekend.round !== state.season.round) {
        state.raceWeekend = generateUnifiedRaceWeekend(state.team);
    }
    const raceWeekend = state.raceWeekend;

    const activeDrivers = getActiveDrivers(state.team).slice(0, 2);
    const teams = [state.team, ...(state.aiTeams || [])].filter(Boolean);
    const sortedTeams = getConstructorOrder(state).map(t => ({ name: t.name, points: t.points }));
    
    const myTeamIndex = sortedTeams.findIndex(t => t.name === state.team.name);
    const myTeamPosition = myTeamIndex + 1;
    const myTeamPoints = state.standings.teams?.[state.team.name] || 0;

    const navigate = (renderFn) => {
        renderFn(appRoot);
    };

    // Opens the season clock (HubLayout) — the same advance-time flow as the bottom bar
    const openSeasonClock = () => window.dispatchEvent(new CustomEvent('f1p:advance-time'));

    const handleEnterPitWall = () => navigate(isSeasonOver ? renderOffseason : renderWeekend);

    const notifications = (state.notifications || []).slice(0, 5);
    const leaderPoints = sortedTeams[0]?.points || 0;
    const teamAhead = myTeamIndex > 0 ? sortedTeams[myTeamIndex - 1] : null;
    const gapAhead = teamAhead ? teamAhead.points - myTeamPoints : 0;
    const weather = raceWeekend?.weather;
    const rivalLine = raceWeekend?.standingsImpact?.nearestRival
        ? `${raceWeekend.standingsImpact.gapToNearest >= 0 ? 'Defend' : 'Attack'} P${myTeamPosition} against ${raceWeekend.standingsImpact.nearestRival}`
        : 'Open fight for the title';

    const championship = getChampionshipSeries(state, 4);
    const budget = getBudgetSeries(state);
    const rivalTeam = rivalName ? teams.find(t => t.name === rivalName) : null;
    const youProfile = rivalTeam ? getTeamProfile(state, state.team, activeDrivers) : null;
    const rivalProfile = rivalTeam ? getTeamProfile(state, rivalTeam, rivalTeam.drivers) : null;

    const card = { background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: '14px' } as React.CSSProperties;
    const label = { fontSize: '12px', color: HUB.textFaint, fontFamily: HUB.fontRegular, display: 'block' } as React.CSSProperties;
    const figure = { fontSize: '24px', color: HUB.textPrimary, fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 } as React.CSSProperties;

    const stats = [
        { title: 'Constructors', value: `P${myTeamPosition}`, sub: teamAhead ? `${gapAhead} pts to P${myTeamPosition - 1}` : `of ${sortedTeams.length} teams` },
        { title: 'Points', value: String(myTeamPoints), sub: myTeamIndex === 0 ? 'Leading' : `${leaderPoints - myTeamPoints} behind the leader` },
        { title: 'Budget', value: null, sub: 'Available to spend' },
        { title: 'Car performance', value: (state.team.carPerformance || 0).toFixed(1), sub: `R&D level ${state.team.carLevel || 1}` },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Key figures */}
            <div className="top-metrics-carousel responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {stats.map(item => (
                    <div key={item.title} style={{ ...card, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={label}>{item.title}</span>
                        <span style={figure}>
                            {item.value ?? <span>$<AnimatedNumber value={state.team.budget} formatter={(v) => v.toFixed(1)} />M</span>}
                        </span>
                        <span style={{ fontSize: '12px', color: HUB.textMuted }}>{item.sub}</span>
                    </div>
                ))}
            </div>

            <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '24px' }}>
                {/* Next Grand Prix — the moment of this screen */}
                <SlideUp delay={0.05}>
                <div style={{ ...card, position: 'relative', overflow: 'hidden', minHeight: '360px', display: 'flex' }}>
                    {!isSeasonOver && <CircuitOutline name={nextRound.name} />}
                    <div className="gp-copy" style={{ position: 'relative', padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '32px', boxSizing: 'border-box' }}>
                        <div>
                            <span style={label}>{isSeasonOver ? 'Season complete' : `Next race · Round ${nextRound.round} of ${totalRounds}${nextRound.sprint ? ' · Sprint weekend' : ''}`}</span>
                            <h2 style={{ fontSize: '28px', fontFamily: HUB.fontWide, fontWeight: 400, color: HUB.textPrimary, margin: '12px 0 8px', textTransform: 'uppercase', lineHeight: 1.1 }}>
                                {isSeasonOver ? 'Offseason' : nextRound.name.replace(' Grand Prix', '')}
                                {!isSeasonOver && <span style={{ display: 'block', fontSize: '16px', color: HUB.textMuted, marginTop: '4px' }}>Grand Prix</span>}
                            </h2>
                            <p style={{ fontSize: '14px', color: HUB.textMuted, margin: 0 }}>
                                {isSeasonOver ? 'Sign drivers and plan next season' : `${nextRound.circuit} · ${nextRound.laps} laps · ${nextRound.country}`}
                            </p>
                        </div>

                        {!isSeasonOver && (
                            <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px' }}>
                                <div>
                                    <span style={{ ...label, marginBottom: '6px' }}>Forecast</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: HUB.textPrimary }}>
                                        {weather?.isWet ? <CloudRain size={16} strokeWidth={1.5} color={HUB.textMuted} /> : <Sun size={16} strokeWidth={1.5} color={HUB.textMuted} />}
                                        {weather?.isWet ? 'Wet' : 'Dry'}{weather?.airTemperature != null ? `, ${weather.airTemperature}°C` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ ...label, marginBottom: '6px' }}>Objective</span>
                                    <span style={{ fontSize: '14px', color: HUB.textPrimary }}>{stripEmoji(raceWeekend?.recommendedObjective?.label) || 'Balanced race'}</span>
                                </div>
                                <div>
                                    <span style={{ ...label, marginBottom: '6px' }}>Championship</span>
                                    <span style={{ fontSize: '14px', color: HUB.textPrimary }}>{rivalLine}</span>
                                </div>
                            </div>
                        )}

                        <div className="mobile-stack" style={{ display: 'flex', alignItems: 'flex-end', gap: '24px' }}>
                            {!isSeasonOver && (
                                <div style={{ marginRight: 'auto' }}>
                                    <span style={{ ...label, marginBottom: '4px' }}>Lights out in</span>
                                    <span style={{ ...figure, fontSize: '28px' }}>{daysUntilRace}<span style={{ fontSize: '14px', color: HUB.textMuted, marginLeft: '6px', fontFamily: HUB.fontRegular }}>{daysUntilRace === 1 ? 'day' : 'days'}</span></span>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {!isSeasonOver && daysUntilRace > 0 && (
                                    <button className={btnClass('secondary', 'full-width-btn')} onClick={openSeasonClock} disabled={!canAdvanceDay}
                                        style={btn('secondary', 'md')} aria-haspopup="dialog">
                                        Advance time
                                    </button>
                                )}
                                <button className={btnClass('primary', 'full-width-btn')} onClick={handleEnterPitWall} style={btn('primary', 'md')}>
                                    {isSeasonOver ? 'Plan offseason' : 'Go to race weekend'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                </SlideUp>

                {/* Activity */}
                <SlideUp delay={0.1}>
                <div style={{ ...card, padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                    <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary, margin: '0 0 16px' }}>Activity</h3>
                    {notifications.length === 0 ? (
                        <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>Nothing yet. Advance time to start the season clock.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {notifications.map((n: any, idx: number) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '12px', padding: '10px 0', borderTop: idx ? `1px solid ${HUB.border}` : 'none', fontSize: '13px', lineHeight: 1.45 }}>
                                    <span style={{ color: HUB.textFaint, fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>Day {n.day}</span>
                                    <span style={{ color: HUB.textMuted }}>{stripEmoji(n.message)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={() => navigate(renderCalendar)} className={btnClass('ghost')} style={btn('ghost', 'sm', { alignSelf: 'flex-start', marginTop: 'auto', marginLeft: '-12px', position: 'relative', top: '8px' })}>
                        Open calendar <ChevronRight size={14} strokeWidth={1.5} />
                    </button>
                </div>
                </SlideUp>
            </div>

            {/* Season so far: championship fight + money */}
            <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '24px' }}>
                <SlideUp delay={0.12}>
                <section style={{ ...card, padding: '24px', height: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary, margin: 0 }}>Championship fight</h3>
                        <span style={{ fontSize: '12px', color: HUB.textFaint }}>Constructors' points by round</span>
                    </div>
                    <ChampionshipChart rounds={championship.rounds} series={championship.series} totalRounds={totalRounds} />
                </section>
                </SlideUp>
                <SlideUp delay={0.14}>
                <section style={{ ...card, padding: '24px', height: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary, margin: 0 }}>Budget</h3>
                        <span style={{ fontSize: '12px', color: HUB.textFaint }}>After each race</span>
                    </div>
                    <BudgetChart points={budget.points} startBalance={budget.startBalance} />
                </section>
                </SlideUp>
            </div>

            {/* Constructors */}
            <SlideUp delay={0.15}>
            <section style={{ ...card, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, fontWeight: 400, color: HUB.textPrimary, margin: 0 }}>Constructors championship</h3>
                    <span style={{ fontSize: '12px', color: HUB.textFaint }}>Top 6 · select a rival to compare</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {sortedTeams.slice(0, 6).map((team, idx) => {
                        const isPlayer = team.name === state.team.name;
                        const ptsDelta = team.points - myTeamPoints;
                        const RowTag: any = isPlayer ? 'div' : 'button';
                        const rowProps = isPlayer ? {} : { type: 'button', onClick: () => setRivalName(team.name), 'aria-haspopup': 'dialog', 'aria-label': `Compare with ${team.name}` };
                        return (
                            <RowTag key={team.name} {...rowProps} className={`mobile-stack${isPlayer ? '' : ' dbx-team-row'}`} style={{ display: 'grid', gridTemplateColumns: '32px minmax(120px, 220px) 1fr 120px 16px', alignItems: 'center', gap: '16px', height: '40px', padding: '0 12px', background: isPlayer ? HUB.raised : 'transparent', borderRadius: '8px', position: 'relative', boxSizing: 'border-box' }}>
                                {isPlayer && <span style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '2px', borderRadius: '2px', background: HUB.accent }} />}
                                <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: isPlayer ? HUB.textPrimary : HUB.textFaint, fontVariantNumeric: 'tabular-nums' }}>P{idx + 1}</span>
                                <span style={{ fontSize: '14px', color: HUB.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
                                <div style={{ height: '4px', background: 'rgba(237,237,237,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: isPlayer ? HUB.accent : 'rgba(237,237,237,0.28)', width: `${Math.min(100, (team.points / (leaderPoints || 1)) * 100)}%` }} />
                                </div>
                                <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: HUB.textPrimary }}>
                                    <AnimatedNumber value={team.points} /> pts
                                    {!isPlayer && <span style={{ color: HUB.textFaint, marginLeft: '8px', fontFamily: HUB.fontRegular }}>{ptsDelta > 0 ? `+${ptsDelta}` : ptsDelta}</span>}
                                </span>
                                {isPlayer ? <span /> : <ChevronRight className="dbx-row-cue" size={16} strokeWidth={1.5} color={HUB.textFaint} aria-hidden />}
                            </RowTag>
                        );
                    })}
                </div>
            </section>
            </SlideUp>

            {/* Drivers */}
            <SlideUp delay={0.2}>
            <section className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {activeDrivers.map((driver) => (
                    <div key={driver.name} style={{ ...card, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${HUB.border}` }}>
                            <img alt={driver.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', background: HUB.raised }} src={getDriverHeadshotUrl(driver)} />
                            <div>
                                <span style={{ ...label, fontVariantNumeric: 'tabular-nums' }}>#{getDriverNumber(driver)}</span>
                                <h4 style={{ fontSize: '16px', fontFamily: HUB.fontBold, fontWeight: 400, margin: '2px 0 0', color: HUB.textPrimary }}>{driver.name}</h4>
                            </div>
                            <button onClick={() => navigate(renderMyDrivers)} className={btnClass('secondary')} style={btn('secondary', 'sm', { marginLeft: 'auto' })}>
                                Profile
                            </button>
                        </div>
                        <div className="responsive-grid" style={{ padding: '16px 24px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            {[
                                { label: 'Pace', val: driver.pace },
                                { label: 'Qualifying', val: driver.quali },
                                { label: 'Racecraft', val: driver.racecraft },
                                { label: 'Consistency', val: driver.consistency }
                            ].map(s => (
                                <div key={s.label}>
                                    <span style={{ ...label, marginBottom: '4px' }}>{s.label}</span>
                                    <span style={{ fontSize: '18px', fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', color: HUB.textPrimary }}>{(s.val || 0).toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
            </SlideUp>

            <RivalDrawer you={youProfile} rival={rivalProfile} onClose={() => setRivalName(null)} />
        </div>
    );
}

const stripEmoji = (text?: string) => text ? text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/!+$/, '').trim() : text;

/** The real circuit drawn as a timing-screen line, start/finish in the accent. */
function CircuitOutline({ name }: { name: string }) {
    const pathRef = useRef<SVGPathElement>(null);
    const [box, setBox] = useState('0 0 500 500');
    const [start, setStart] = useState<{ x: number; y: number } | null>(null);
    const d = getTrackPath(name);
    useLayoutEffect(() => {
        const el = pathRef.current;
        if (!el) return;
        const b = el.getBBox();
        const pad = Math.max(b.width, b.height) * 0.08;
        setBox(`${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
        const p = el.getPointAtLength(0);
        setStart({ x: p.x, y: p.y });
    }, [d]);
    return (
        <svg className="hide-on-mobile" aria-hidden viewBox={box} preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', right: '32px', top: '32px', width: '38%', height: 'calc(100% - 64px)', pointerEvents: 'none' }}>
            <path d={d} fill="none" stroke="rgba(237,237,237,0.06)" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path ref={pathRef} d={d} fill="none" stroke="rgba(237,237,237,0.7)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {start && <circle cx={start.x} cy={start.y} r={Math.max(4, parseFloat(box.split(' ')[2]) / 90)} fill={HUB.accent} />}
        </svg>
    );
}
