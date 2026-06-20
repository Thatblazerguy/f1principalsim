import React, { useReducer } from 'react';
import { 
  ChevronRight,
} from 'lucide-react';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';
import { state } from "../state.js";
import { calendar } from "../data/calendar.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { ensureSeasonTimeline, getRoundRaceDay, formatSeasonDate, simulateNextDay, canSimulateNextDay } from "../utils/seasonTimeline.js";
import { ensureTeamState, getActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";

import { renderWeekend } from "./weekend.js";
import { renderOffice } from "./office.tsx";
import { renderMyDrivers } from "./myDrivers.tsx";
import { renderTeams } from "./teams.tsx";
import { renderCalendar } from "./calendar.tsx";
import { renderLeaderboard } from "./leaderboard.tsx";
import { renderOffseason } from "./offseason.tsx";
import { renderMarket } from "./market.tsx";
import { renderSponsors } from "./sponsors.tsx";
import { renderFinance } from "./finance.tsx"; // We will create a premium finance screen next!
import { mountLayout } from "../components/HubLayout.tsx";



export function ChampionshipHub({ appRoot, rerenderFn }) {
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    ensureTeamState(state.team);
    ensureSeasonTimeline(state);
    
    const totalRounds = Math.min(state.season.totalRounds || 24, 24);
    const isSeasonOver = state.season.round > totalRounds || (state.weekendProgress?.raceComplete && state.season.round === totalRounds);
    const nextRound = isSeasonOver ? null : calendar.find(r => r.round === state.season.round);
    const currentDay = state.season.currentDay;
    const raceDay = nextRound ? getRoundRaceDay(nextRound.round) : null;
    const daysUntilRace = nextRound ? Math.max(0, raceDay - currentDay) : 0;
    const canAdvanceDay = canSimulateNextDay(state);

    const activeDrivers = getActiveDrivers(state.team).slice(0, 2);
    const teams = [state.team, ...(state.aiTeams || [])].filter(Boolean);
    const sortedTeams = teams.map(t => ({ name: t.name, points: state.standings.teams?.[t.name] || 0 }))
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    
    const myTeamIndex = sortedTeams.findIndex(t => t.name === state.team.name);
    const myTeamPosition = myTeamIndex + 1;
    const myTeamPoints = state.standings.teams?.[state.team.name] || 0;

    const navigate = (renderFn) => {
        renderFn(appRoot);
    };

    const handleSimulateDay = async () => {
        if (!canAdvanceDay) return;
        const result = simulateNextDay(state);
        if (!result.advanced) { forceUpdate(); return; }
        await syncGame();
        forceUpdate();
    };

    const handleEnterPitWall = () => navigate(isSeasonOver ? renderOffseason : renderWeekend);

    // Dynamic Team Color (Default to Racing Red or themed blue for custom feel)
    const teamThemeColor = '#E10600'; 

    return (
        <div style={{ position: 'relative' }}>
            {/* Grid & Telemetry Overlay backgrounds */}
            <div style={{ position: 'absolute', inset: -32, pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)', 
                    backgroundSize: '40px 40px',
                    opacity: 0.5
                }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Premium Snapshot Strip */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '16px',
                    marginBottom: '32px',
                    background: 'rgba(10,13,26,0.5)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    padding: '16px 24px'
                }}>
                    {[
                        { title: "CONSTRUCTOR RANK", value: `P${myTeamPosition}`, sub: `${sortedTeams.length - myTeamPosition} Teams Behind` },
                        { title: "DRIVER ROSTER", value: activeDrivers.map(d => d.name.split(' ').pop()?.toUpperCase()).join(' / '), sub: "Active Race Pair" },
                        { title: "BUDGET BALANCE", value: `$${state.team.budget.toFixed(1)}M`, isBudget: true, sub: "$140M COST CAP LIMIT" },
                        { title: "CAR R&D LEVEL", value: `Lv ${state.team.carLevel || 1}`, sub: `Perf: ${state.team.carPerformance.toFixed(1)}` },
                        { title: "SPONSOR HAPPINESS", value: "94%", sub: "4 Contracts Active" },
                        { title: "FACILITY RATING", value: `Lv ${state.team.level}`, sub: "Headquarters Status" }
                    ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '9px', color: '#94A3B8', fontFamily: "'Formula1-Bold', sans-serif", letterSpacing: '0.05em' }}>{item.title}</span>
                            <span style={{ fontSize: '18px', fontFamily: "'Formula1-Bold', sans-serif", color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>
                                {item.isBudget ? <span>$<AnimatedNumber value={state.team.budget} formatter={(v) => v.toFixed(1)} />M</span> : item.value}
                            </span>
                            <span style={{ fontSize: '9px', color: teamThemeColor }}>{item.sub}</span>
                        </div>
                    ))}
                </div>

                {/* Main Command Center Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '40px' }}>
                    
                    {/* Hero: Upcoming Grand Prix (Span 8) */}
                    <div style={{ gridColumn: 'span 8' }}>
                    <SlideUp delay={0.05}>
                    <div style={{
                        background: 'radial-gradient(ellipse at bottom left, rgba(225,6,0,0.15) 0%, rgba(10,13,26,0.95) 70%)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `4px solid ${teamThemeColor}`,
                        borderRadius: '8px',
                        padding: '40px',
                        minHeight: '340px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Visual decorative lines */}
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '250px', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.015))', pointerEvents: 'none' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: teamThemeColor, letterSpacing: '0.3em', textTransform: 'uppercase' }}>UPCOMING WEEKEND</span>
                                <h2 style={{ fontSize: '48px', fontFamily: "'Formula1-Wide', sans-serif", fontWeight: 900, color: 'white', margin: '12px 0 8px', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                    {isSeasonOver ? 'OFFSEASON PHASE' : nextRound.name.toUpperCase().replace(' GRAND PRIX', ' GP')}
                                </h2>
                                <p style={{ fontSize: '15px', color: '#94A3B8', margin: 0 }}>
                                    {isSeasonOver ? 'Prepare strategy & sign roster contracts' : `Round ${nextRound.round} of ${totalRounds} | ${nextRound.laps} Laps | Monaco Circuit`}
                                </p>
                            </div>
                            <span style={{ padding: '6px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', borderRadius: '4px', textTransform: 'uppercase' }}>
                                {isSeasonOver ? 'ACTIVE PLANNING' : 'ACTIVE ROUND'}
                            </span>
                        </div>

                        {/* Additional metadata: weather, objectives, implications */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', margin: '32px 0', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div>
                                <span style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.1em' }}>EXPECTED WEATHER</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>⛅ Light Drizzle / 18°C</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.1em' }}>PRIMARY OBJECTIVE</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>🎯 Double Points Finish (Top 10)</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '9px', color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.1em' }}>STANDINGS IMPACT</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>🔥 Defend P{myTeamPosition} from Alpine</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {!isSeasonOver ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                    <div>
                                        <span style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>TELEMETRY TIME REMAINING</span>
                                        <div style={{ display: 'flex', gap: '16px', fontFamily: "'Formula1-Bold', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', fontSize: '24px', color: 'white' }}>
                                            <span>{String(daysUntilRace).padStart(2,'0')}<span style={{ fontSize: '13px', color: '#94A3B8', marginLeft: '2px' }}>D</span></span>
                                            <span>00<span style={{ fontSize: '13px', color: '#94A3B8', marginLeft: '2px' }}>H</span></span>
                                            <span>00<span style={{ fontSize: '13px', color: '#94A3B8', marginLeft: '2px' }}>M</span></span>
                                        </div>
                                    </div>
                                    {daysUntilRace > 0 && (
                                        <button 
                                            onClick={handleSimulateDay} 
                                            disabled={!canAdvanceDay}
                                            style={{
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                padding: '10px 20px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                                cursor: canAdvanceDay ? 'pointer' : 'not-allowed',
                                                opacity: canAdvanceDay ? 1 : 0.5,
                                                transition: 'all 0.15s',
                                                fontFamily: "'Formula1-Bold', sans-serif"
                                            }}
                                            onMouseEnter={e => { if (canAdvanceDay) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                                            onMouseLeave={e => { if (canAdvanceDay) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                        >
                                            Simulate 1 Day
                                        </button>
                                    )}
                                </div>
                            ) : <div />}
                            <button onClick={handleEnterPitWall}
                                style={{
                                    backgroundColor: teamThemeColor, color: 'white', padding: '18px 48px', borderRadius: '4px',
                                    fontSize: '14px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', border: 'none',
                                    cursor: 'pointer', boxShadow: '0 8px 32px rgba(225,6,0,0.4)', transition: 'all 0.15s',
                                    fontFamily: "'Formula1-Bold', sans-serif"
                                }}>
                                {isSeasonOver ? 'ENTER OFFSEASON PLANNING' : 'LAUNCH PIT WALL MODULE'}
                            </button>
                        </div>
                    </div>
                    </SlideUp>
                    </div>

                    {/* Recent Activity Feed (Span 4) */}
                    <div style={{ gridColumn: 'span 4' }}>
                    <SlideUp delay={0.1}>
                    <div style={{
                        background: 'rgba(10,13,26,0.6)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '260px'
                    }}>
                        <div>
                            <h3 style={{ fontSize: '11px', fontFamily: "'Formula1-Bold', sans-serif", color: '#94A3B8', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px' }}>
                                REAL-TIME LOG FEED
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[
                                    { time: "DAY 4", text: "New front wing aerodynamic upgrade completed", type: "success" },
                                    { time: "DAY 3", text: "Driver Yuki Tsunoda confidence level up (+2)", type: "info" },
                                    { time: "DAY 2", text: "Sponsor wing placement offer rotated catalog", type: "warning" },
                                    { time: "DAY 1", text: "FIA Cost Cap allocation synchronized", type: "info" }
                                ].map((log, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '11px', lineHeight: '1.4' }}>
                                        <span style={{ fontFamily: "'Formula1-Bold', sans-serif", color: log.type === 'success' ? '#10b981' : log.type === 'warning' ? '#f59e0b' : '#3b82f6', width: '45px', flexShrink: 0 }}>
                                            {log.time}
                                        </span>
                                        <span style={{ color: '#fff' }}>{log.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => navigate(renderCalendar)} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: teamThemeColor, background: 'none', border: 'none', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer', padding: 0, marginTop: '16px' }}>
                            View full activity log <ChevronRight size={14}/>
                        </button>
                    </div>
                    </SlideUp>
                    </div>

                </div>

                {/* Championship Battle Visual Comparison Section */}
                <SlideUp delay={0.15}>
                <section style={{ marginBottom: '48px' }}>
                    <h3 style={{ fontSize: '11px', fontFamily: "'Formula1-Bold', sans-serif", color: '#94A3B8', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '20px' }}>
                        CONSTRUCTORS CHAMPIONSHIP DELTA
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(10,13,26,0.3)', padding: '24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        {sortedTeams.slice(0, 6).map((team, idx) => {
                            const isPlayer = team.name === state.team.name;
                            const ptsDelta = team.points - myTeamPoints;
                            const isAhead = ptsDelta > 0;
                            return (
                                <div key={team.name} style={{ display: 'grid', gridTemplateColumns: '40px 200px 1fr 140px', alignItems: 'center', gap: '16px', padding: '10px 16px', background: isPlayer ? 'rgba(225,6,0,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '4px', border: isPlayer ? `1px solid ${teamThemeColor}` : '1px solid transparent' }}>
                                    <span style={{ fontSize: '14px', fontFamily: "'Formula1-Bold', sans-serif", color: isPlayer ? teamThemeColor : '#94A3B8' }}>P{idx+1}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{team.name.toUpperCase()}</span>
                                    {/* Bar slider delta representation */}
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: isPlayer ? teamThemeColor : 'rgba(255,255,255,0.3)', width: `${Math.min(100, (team.points / (sortedTeams[0].points || 1)) * 100)}%` }} />
                                    </div>
                                    <span style={{ fontSize: '13px', fontFamily: "'Formula1-Bold', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', textAlign: 'right', color: isPlayer ? teamThemeColor : '#fff' }}>
                                        {isPlayer ? (
                                            <><AnimatedNumber value={team.points} /> PTS</>
                                        ) : (
                                            <><AnimatedNumber value={team.points} /> PTS <span style={{ color: '#94A3B8', marginLeft: '6px' }}>({isAhead ? `+${ptsDelta}` : ptsDelta})</span></>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
                </SlideUp>

                {/* Driver Dossiers Quick-look Section */}
                <SlideUp delay={0.2}>
                <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {activeDrivers.map((driver, idx) => (
                        <div key={driver.name} style={{
                            background: 'rgba(10,13,26,0.6)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <img alt={driver.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${teamThemeColor}` }} src={getDriverHeadshotUrl(driver)} />
                                <div>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: teamThemeColor, letterSpacing: '0.2em' }}>ACTIVE DRIVER 0{idx+1}</span>
                                    <h4 style={{ fontSize: '16px', fontFamily: "'Formula1-Bold', sans-serif", margin: '4px 0 0', color: 'white' }}>#{getDriverNumber(driver)} {driver.name.toUpperCase()}</h4>
                                </div>
                                <button onClick={() => navigate(renderMyDrivers)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '6px 16px', fontSize: '10px', fontWeight: 700, color: '#fff', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Dossier
                                </button>
                            </div>
                            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                {[
                                    { label: 'Pace', val: (driver.pace||0).toFixed(1) },
                                    { label: 'Quali', val: (driver.quali||0).toFixed(1) },
                                    { label: 'Racecraft', val: (driver.racecraft||0).toFixed(1) },
                                    { label: 'Consistency', val: (driver.consistency||0).toFixed(1) }
                                ].map(s => (
                                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '4px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '9px', color: '#94A3B8', display: 'block', marginBottom: '4px' }}>{s.label}</span>
                                        <span style={{ fontSize: '16px', fontFamily: "'Formula1-Bold', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', color: '#fff' }}>{s.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>
                </SlideUp>
            </div>
        </div>
    );
}

export function renderChampionshipHub(appRoot: HTMLElement) {
    mountLayout(
        appRoot,
        'dashboard',
        <ChampionshipHub appRoot={appRoot} />
    );
}
