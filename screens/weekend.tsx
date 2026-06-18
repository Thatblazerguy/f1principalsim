import React, { useState, useEffect } from "react";
import { calendar } from "../data/calendar.js";
import { strategies } from "../data/strategies.js";
import { simulatePractice } from "../game/practice.js";
import { simulateQualifying } from "../game/qualifying.js";
import { simulateRaceEvent } from "../game/raceSimulator.js";
import { updateStandings } from "../game/standings.js";
import { state } from "../state.js";
import { ensureTeamState, gainTeamXP, gainTeamCarXP, getActiveDrivers } from "../utils/teamState.js";
import { getTotalSponsorRaceBonus } from "../utils/sponsorDeals.js";
import { applyRoundCarDevelopmentAll } from "../utils/carDevelopment.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import {
  ensureSeasonTimeline,
  getRoundRaceDay,
  getDaysUntilRound,
  formatSeasonDate,
  simulateNextDay,
  canSimulateNextDay,
} from "../utils/seasonTimeline.js";

import { mountLayout, HUB, glassCard, statCell, statLabel, statValue, actionBtn, sectionLabel, pageTitle, pageSubtitle, pill } from '../components/HubLayout.tsx';
import { AnimatedTabs } from "../components/ui/animated-tabs.tsx";
import { CloudRain, Sun, Wind, ChevronRight, Activity, Award } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, PageTransition } from '../components/ui/motion.tsx';

function ensureWeekendProgress(round: number) {
  if (!state.weekendProgress || state.weekendProgress.round !== round) {
    state.weekendProgress = {
      round,
      qualifyingComplete: false,
      grid: null,
      raceComplete: false,
      selectedStrategies: {}
    };
  } else {
    if (state.weekendProgress.raceComplete === undefined) {
      state.weekendProgress.raceComplete = false;
    }
    if (!state.weekendProgress.selectedStrategies) {
      state.weekendProgress.selectedStrategies = {};
    }
  }
  return state.weekendProgress;
}

function updateBestFinishes(results: any[]) {
  if (!state.driverWins) state.driverWins = {};
  if (!state.driverPodiums) state.driverPodiums = {};

  results.forEach((entry, idx) => {
    const finishPos = idx + 1;
    const name = entry.driver.name;

    // Best finish tracking (all drivers)
    const currentBest = state.bestFinishes[name];
    if (!currentBest || finishPos < currentBest) {
      state.bestFinishes[name] = finishPos;
    }

    // Only count for your own team's drivers
    if (entry.team.name !== state.team?.name) return;

    if (finishPos === 1) {
      state.driverWins[name] = (state.driverWins[name] || 0) + 1;
    }
    if (finishPos <= 3) {
      state.driverPodiums[name] = (state.driverPodiums[name] || 0) + 1;
    }
  });
}

export function renderWeekend(root: HTMLElement, flashMessage = "") {
  ensureTeamState(state.team!);
  ensureSeasonTimeline(state);
  
  const totalRounds = Math.min(state.season.totalRounds || calendar.length, calendar.length);
  const round = state.season.round <= totalRounds ? calendar[state.season.round - 1] : null;
  const currentDay = state.season.currentDay;
  const raceDay = round ? getRoundRaceDay(round.round) : null;
  const raceDateLabel = round ? formatSeasonDate(state.season.year || 1, raceDay!) : "";
  const daysUntilRace = round ? getDaysUntilRound(round.round, currentDay) : 0;
  const raceWindowOpen = Boolean(round) && daysUntilRace === 0;
  const canAdvanceDay = canSimulateNextDay(state);
  const activeDrivers = getActiveDrivers(state.team!);
  const teams = [
    { ...state.team!, drivers: activeDrivers },
    ...state.aiTeams
  ];
  const sponsorRaceBonus = getTotalSponsorRaceBonus(state.team!);
  const weekendProgress = round ? ensureWeekendProgress(round.round) : null;
  const raceNeedsQuali = Boolean(round && weekendProgress && !weekendProgress.qualifyingComplete);
  const raceAlreadyRun = Boolean(round && weekendProgress?.raceComplete);
  const raceLocked = !raceWindowOpen || raceAlreadyRun || !weekendProgress?.qualifyingComplete;

  const roundStrats = round && strategies[round.round] ? strategies[round.round] : [];

  let strategiesValid = false;
  if (round && weekendProgress) {
    const d1 = activeDrivers[0];
    const d2 = activeDrivers[1];
    if (!weekendProgress.selectedStrategies) weekendProgress.selectedStrategies = {};
    const d1Strat = weekendProgress.selectedStrategies[d1?.name] || "";
    const d2Strat = d2 ? (weekendProgress.selectedStrategies[d2.name] || "") : "N/A";
    
    if (roundStrats.length === 0) {
      strategiesValid = true; 
    } else {
      strategiesValid = Boolean(d1Strat && (d2 ? d2Strat : true));
    }
  } else {
     strategiesValid = true;
  }

  const WeekendPage = () => {
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(flashMessage);
    const [resultsData, setResultsData] = useState<{ metric: string, res: any[], grid: any[] | null } | null>(null);

    const advanceDay = async () => {
      const tick = simulateNextDay(state);
      if (!tick.advanced) return;
      await syncGame();
      const completedText = tick.completedUpgrades.length
        ? ` Upgrade complete: ${tick.completedUpgrades.map(entry => entry.part.toUpperCase()).join(", ")}.`
        : "";
      renderWeekend(root, `Advanced to Day ${state.season.currentDay}.${completedText}`);
    };

    const handlePractice = async () => {
      if (!raceWindowOpen) {
        setStatusMessage(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
        return;
      }
      setLoading(true);
      setTimeout(() => {
        try {
          gainTeamCarXP(state.team!, 5);
          setResultsData({ metric: 'bestLap', res: simulatePractice(teams, round!), grid: null });
          setStatusMessage(`Practice complete. Car XP increased to ${state.team!.carXP}/100.`);
          syncGame();
        } catch (error: any) {
          setStatusMessage(`Practice failed to simulate. ${error.message}`);
        }
        setLoading(false);
      }, 1000);
    };

    const handleQuali = async () => {
      if (!raceWindowOpen) {
        setStatusMessage(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
        return;
      }
      setLoading(true);
      setTimeout(() => {
        try {
          gainTeamCarXP(state.team!, 8);
          const { grid } = simulateQualifying(teams, round!);
          setResultsData({ metric: 'lap', res: grid, grid: null });
          if (weekendProgress) {
            weekendProgress.qualifyingComplete = true;
            weekendProgress.grid = grid.slice();
          }
          setStatusMessage(
            weekendProgress?.raceComplete
              ? `Qualifying session updated. This Grand Prix race is already complete — advance to the next round for a new race. Car XP is ${state.team!.carXP}/100.`
              : `Qualifying complete. Car XP increased to ${state.team!.carXP}/100. Race is now unlocked.`
          );
          syncGame();
        } catch (error: any) {
          setStatusMessage(`Qualifying failed to simulate. ${error.message}`);
        }
        setLoading(false);
      }, 1000);
    };

    const handleRace = async () => {
      if (!raceWindowOpen) {
        setStatusMessage(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
        return;
      }
      if (weekendProgress?.raceComplete) {
        setStatusMessage("This Grand Prix race has already been completed. Simulate days to progress the calendar.");
        return;
      }
      if (!weekendProgress?.qualifyingComplete) {
        setStatusMessage("Run qualifying first — the race stays locked until the grid is set.");
        return;
      }
      if (roundStrats.length > 0 && !strategiesValid) {
        setStatusMessage("Assign a race strategy for your active drivers on the pit wall before starting the race.");
        return;
      }

      setLoading(true);
      setTimeout(async () => {
        try {
          const res = simulateRaceEvent(teams, round!, round!.laps, weekendProgress.grid!, weekendProgress.selectedStrategies!);
          gainTeamXP(state.team!, 25);
          gainTeamCarXP(state.team!, 20);
          state.standings = updateStandings(res, state.standings);
          updateBestFinishes(res);

          let earnings = 0;
          if (sponsorRaceBonus > 0) {
            earnings += sponsorRaceBonus;
            state.team!.budget += earnings;
          }

          weekendProgress.raceComplete = true;
          applyRoundCarDevelopmentAll(state);
          state.season.round += 1;
          
          setResultsData({ metric: 'time', res, grid: weekendProgress.grid });
          setStatusMessage(`${round!.name} complete. ${earnings ? `Sponsor payout: $${earnings}M.` : "No sponsor payout earned."} Car XP is now ${state.team!.carXP}/100. Day simulation is now unlocked.`);
          await syncGame();
        } catch (error: any) {
          setStatusMessage(`Race failed to simulate. ${error.message}`);
        }
        setLoading(false);
      }, 1500);
    };

    const renderResults = () => {
      if (!resultsData) return null;
      const { metric, res, grid } = resultsData;
      const title = metric === "bestLap" ? "Practice Results" : metric === "lap" ? "Qualifying Results" : "Race Results";
      const isRace = metric === "time";

      return (
        <SlideUp>
          <motion.div 
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ type: "spring", bounce: 0, duration: 0.3 }}
             style={{ ...glassCard({ padding: '24px' }), marginTop: '24px' }}>
             <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, margin: '0 0 16px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {res.map((r, i) => {
                  const metricValue = metric && Number.isFinite(r[metric]) ? `${r[metric].toFixed(3)}s` : "";
                  const status = r.retired ? "DNF" : metricValue;
                  const isPlayerDriver = state.team && r.team && r.team.name === state.team.name;
                  
                  let deltaHtml = null;
                  if (isRace && grid?.length) {
                    const qIdx = grid.findIndex((e: any) => e.driver.name === r.driver.name);
                    if (qIdx >= 0) {
                      const qualiPos = qIdx + 1;
                      const finishPos = i + 1;
                      const delta = qualiPos - finishPos;
                      deltaHtml = (
                        <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', color: delta > 0 ? '#10b981' : delta < 0 ? '#ef4444' : HUB.textMuted, marginRight: '16px' }}>
                           Q{qualiPos} {delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : '(±0)'}
                        </span>
                      );
                    }
                  }

                  return (
                    <motion.div 
                       initial={{ opacity: 0, y: 5 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.2, delay: i * 0.02 }}
                       key={r.driver.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isPlayerDriver ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isPlayerDriver ? HUB.accent : 'transparent'}`, borderRadius: '8px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', width: '30px' }}>P{i + 1}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <img src={getDriverHeadshotUrl(r.driver)} alt={r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                             <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{r.driver.name}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: HUB.textMuted }}>{r.team.name}</span>
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center' }}>
                          {deltaHtml}
                          <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', color: '#fff' }}>{status}</span>
                       </div>
                    </motion.div>
                  );
                })}
             </div>
          </motion.div>
        </SlideUp>
      );
    };

    if (!round) {
      return (
        <div>
          <div style={{ marginBottom: '32px' }}>
            {sectionLabel('End of Calendar')}
            {pageTitle('Season Complete')}
            {pageSubtitle('The championship is over. Head into the offseason to review results and confirm your lineup.')}
          </div>
          <button onClick={() => { import('./offseason.tsx').then(m => m.renderOffseason(root)) }} style={actionBtn({ padding: '12px 24px' })}>Open Offseason</button>
        </div>
      );
    }

    const driverTabs = activeDrivers.map(driver => {
      const currentStratId = weekendProgress?.selectedStrategies?.[driver.name] || "";
      return {
        id: `driver-${driver.name}`,
        label: driver.name,
        content: (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
            {roundStrats.map((strat: any) => {
              const isSelected = currentStratId === strat.id;
              const isDisabled = weekendProgress?.raceComplete;
              return (
                <button key={strat.id} onClick={() => {
                  if (isDisabled) return;
                  if (weekendProgress && weekendProgress.selectedStrategies) {
                    weekendProgress.selectedStrategies[driver.name] = strat.id;
                    syncGame();
                    renderWeekend(root);
                  }
                }} style={{ ...glassCard({ padding: '16px' }), textAlign: 'left', background: isSelected ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? HUB.accent : HUB.border}`, opacity: isDisabled ? 0.6 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>{strat.label}</span>
                    {isSelected && <span style={{ ...pill(true), padding: '2px 8px', fontSize: '10px' }}>Selected</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div>
                      <p style={{ fontSize: '10px', color: HUB.textMuted, margin: '0 0 4px', textTransform: 'uppercase' }}>Rank</p>
                      <p style={{ fontSize: '12px', color: '#fff', margin: 0, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{strat.rank}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: HUB.textMuted, margin: '0 0 4px', textTransform: 'uppercase' }}>Win Bonus</p>
                      <p style={{ fontSize: '12px', color: '#10b981', margin: 0, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>+{(strat.winModifier * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '10px', color: HUB.textMuted, margin: '0 0 4px', textTransform: 'uppercase' }}>Risk Level</p>
                      <p style={{ fontSize: '12px', color: '#ef4444', margin: 0, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{(strat.riskModifier * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      };
    });

    return (
      <div style={{ paddingBottom: '64px' }}>
        
        {/* Pit Wall Title Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {sectionLabel('Live Pit Wall Ops')}
            {pageTitle(round.name)}
            {pageSubtitle('Direct your strategy options and monitor track metrics from the secure operations console.')}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={statCell()}>{statLabel('Current Round')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(round.round)}</span></div>
            <div style={statCell()}>{statLabel('Sponsor Bonus')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(`$${sponsorRaceBonus}M`)}</span></div>
            <div style={statCell()}>{statLabel('Car Level')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(`Lv ${state.team!.carLevel}`)}</span></div>
          </div>
        </div>

        {/* progression timeline: Practice -> Qualifying -> Race */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '32px'
        }}>
          {[
            { phase: "Practice", desc: "Gain +5 Car XP", action: handlePractice, active: true, done: weekendProgress?.qualifyingComplete || weekendProgress?.raceComplete },
            { phase: "Qualifying", desc: "Set Grid Position & Gain +8 Car XP", action: handleQuali, active: raceWindowOpen, done: weekendProgress?.qualifyingComplete },
            { phase: "Race", desc: "Execute strategy & win points", action: handleRace, active: !raceLocked, done: weekendProgress?.raceComplete }
          ].map((item, idx) => (
            <div key={idx} style={{
              ...glassCard({ padding: '20px' }),
              borderLeft: item.done ? '3px solid #10b981' : item.active ? `3px solid ${HUB.accent}` : '3px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '120px'
            }}>
              <div>
                <span style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Phase 0{idx+1}</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '4px 0' }}>{item.phase}</h4>
                <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{item.desc}</p>
              </div>
              <button 
                onClick={item.action} 
                disabled={loading || !item.active || item.done}
                style={{
                  ...actionBtn({ padding: '8px 16px', fontSize: '10px', marginTop: '16px', width: '100%' }),
                  backgroundColor: item.done ? 'rgba(16,185,129,0.1)' : item.active ? HUB.accent : 'rgba(255,255,255,0.02)',
                  color: item.done ? '#10b981' : '#fff',
                  border: item.done ? '1px solid #10b981' : 'none',
                  cursor: (item.done || !item.active) ? 'default' : 'pointer',
                  opacity: item.active ? 1 : 0.5
                }}
              >
                {item.done ? "COMPLETED" : `RUN ${item.phase.toUpperCase()}`}
              </button>
            </div>
          ))}
        </div>

        {/* Live track environment metrics split panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '32px' }}>
          
          {/* Track Conditions & Evolution (Span 4) */}
          <div style={{ ...glassCard(), gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '11px', fontFamily: HUB.fontBold, color: HUB.accent, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Track Evolution</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: HUB.textMuted }}>WEATHER FORECAST</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>⛅ Sunny / Light Drizzle</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: HUB.textMuted }}>TRACK GRIP LEVEL</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>78% (Green Track)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: HUB.textMuted }}>RISK OF RAIN</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>15%</span>
              </div>
            </div>
          </div>

          {/* Pit Strategy Simulations (Span 8) */}
          <div style={{ ...glassCard(), gridColumn: 'span 8' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 16px' }}>Pit Wall Strategy</p>
            {roundStrats.length > 0 && activeDrivers.length > 0 ? (
              <AnimatedTabs tabs={driverTabs} className="max-w-full" />
            ) : (
              <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>No custom strategies for this GP.</p>
            )}
          </div>

        </div>

        {/* Advance Day bar */}
        <div style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!raceWindowOpen && <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>Race weekend is not open yet. Simulate days until {raceDateLabel}.</p>}
            {raceWindowOpen && raceNeedsQuali && <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0 }}>Complete qualifying to unlock the race simulation.</p>}
            {raceWindowOpen && raceAlreadyRun && <p style={{ fontSize: '13px', color: '#10b981', margin: 0 }}>This Grand Prix has been run. Advance to the next round.</p>}
          </div>
          <button onClick={advanceDay} disabled={!canAdvanceDay || loading} style={{ ...actionBtn({ padding: '12px 32px' }), opacity: (!canAdvanceDay || loading) ? 0.5 : 1 }}>
            Simulate 1 Day
          </button>
        </div>

        {statusMessage && (
          <div style={{ ...glassCard({ padding: '16px' }), borderLeft: `4px solid ${HUB.accent}`, marginTop: '24px' }}>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0 }}>{statusMessage}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {resultsData && <div key={resultsData.metric}>{renderResults()}</div>}
        </AnimatePresence>

      </div>
    );
  };

  mountLayout(root, 'weekend', <WeekendPage />, () => renderWeekend(root, flashMessage));
}
