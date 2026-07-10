import React, { useState, useEffect } from "react";
import { calendar } from "../data/calendar.js";
import { strategies } from "../data/strategies.js";
import { getTrackStrategyProfile } from "../data/strategyProfiles.js";
import { simulatePractice } from "../game/practice.js";
import { simulateQualifying } from "../game/qualifying.js";
import { simulateRaceEvent } from "../game/raceSimulator.js";
import { RaceControl } from "./RaceControl.tsx";
import { updateStandings } from "../game/standings.js";
import { recordRaceHistory } from "../game/raceHistory.js";
import { state } from "../state.js";
import { ensureTeamState, gainTeamXP, gainTeamCarXP, getActiveDrivers } from "../utils/teamState.js";
import { applyRoundCarDevelopmentAll } from "../utils/carDevelopment.js";
import { ensureFinanceState, generateRaceBonusChallenges, processFacilityProjects, processRaceFinance } from "../utils/financeSystem.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import { getTrackWetProbability } from "../utils/raceBalance.js";
import { validateFinalClassification } from "../utils/classificationValidator.js";
import {
  ensureSeasonTimeline,
  getRoundRaceDay,
  getDaysUntilRound,
  formatSeasonDate,
  simulateNextDay,
  canSimulateNextDay,
  getPendingUpgradeForPart,
  getNextUpgradeAvailability
} from "../utils/seasonTimeline.js";
import { startWeekendProgress, generateWeekendContext } from "../utils/weekendForm.js";
import { ensureEngineeringState, getActiveComponent, COMPONENT_CATALOG, applyGridPenalties } from "../utils/engineeringSystem.js";
import { RACE_OBJECTIVES, generateUnifiedRaceWeekend } from "../utils/raceObjectives.js";
export { RACE_OBJECTIVES };

import { mountLayout, HUB, glassCard, statCell, statLabel, statValue, actionBtn, sectionLabel, pageTitle, pageSubtitle, pill } from '../components/HubLayout.tsx';
import { CloudRain, Sun, Wind, ChevronRight, Activity, Award, ShieldAlert, Cpu, CheckCircle, AlertTriangle, MessageSquare, Flag, ArrowUpRight, ArrowDownRight, Minus, Timer, Zap, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, PageTransition } from '../components/ui/motion.tsx';
import { PreRaceBriefingModal } from "../components/ui/PreRaceBriefingModal.tsx";
import { DetailedRaceReport } from "../components/ui/DetailedRaceReport.tsx";

function ensureWeekendProgress(round: number): any {
  if (!(state as any).weekendProgress || (state as any).weekendProgress.round !== round) {
    (state as any).weekendProgress = {
      round,
      qualifyingComplete: false,
      grid: null,
      raceComplete: false,
      selectedStrategies: {},
      weekendContext: null
    };
  } else {
    if ((state as any).weekendProgress.raceComplete === undefined) (state as any).weekendProgress.raceComplete = false;
    if (!(state as any).weekendProgress.selectedStrategies) (state as any).weekendProgress.selectedStrategies = {};
  }
  return (state as any).weekendProgress;
}

function updateBestFinishes(results: any[]) {
  const s = state as any;
  if (!s.driverWins) s.driverWins = {};
  if (!s.driverPodiums) s.driverPodiums = {};

  results.forEach((entry: any, idx: number) => {
    const finishPos = idx + 1;
    const name = entry.driver.name;

    const currentBest = s.bestFinishes[name];
    if (!currentBest || finishPos < currentBest) s.bestFinishes[name] = finishPos;

    if (entry.team.name !== s.team?.name) return;

    if (finishPos === 1) s.driverWins[name] = (s.driverWins[name] || 0) + 1;
    if (finishPos <= 3) s.driverPodiums[name] = (s.driverPodiums[name] || 0) + 1;
  });
}

// AI insights generator based on circuit and state
const generateTrackInsights = (circuit: string, isWet: boolean | null, trackProfile: any) => {
  const insights = [];
  const c = circuit.toLowerCase();
  
  if (c.includes("monaco") || c.includes("singapore") || c.includes("madrid") || c.includes("baku") || c.includes("jeddah") || c.includes("marina bay")) {
    insights.push("Overtaking is extremely difficult. Qualifying position is critical.");
    insights.push("High probability of Safety Car deployments. Strategic flexibility is advised.");
  } else if (c.includes("monza") || c.includes("spa") || c.includes("vegas")) {
    insights.push("Low downforce circuit. Top speed and drag efficiency will dictate pace.");
    insights.push("Slipstream and DRS effectiveness are very high.");
  } else {
    insights.push("Standard track evolution expected throughout the weekend.");
    insights.push("Tyre degradation is predicted to be within nominal limits.");
  }

  if (isWet) {
    insights.push("Heavy rain forecast. Expect high degradation on intermediate compounds if the track dries.");
  }

  if (trackProfile && trackProfile.baseDegradation > 1.2) {
    insights.push("High tyre degradation detected. Multi-stop strategies are highly favorable.");
  }
  
  return insights;
};

// Returns track type classification
const getTrackTypeString = (circuit: string) => {
  const c = circuit.toLowerCase();
  if (c.includes("monaco") || c.includes("singapore") || c.includes("marina bay") || c.includes("jeddah") || c.includes("vegas") || c.includes("madrid") || c.includes("baku")) return "Street Circuit";
  if (c.includes("monza") || c.includes("spa")) return "Low Downforce";
  if (c.includes("suzuka") || c.includes("silverstone")) return "High Downforce";
  return "Permanent Circuit";
};

// Generates fake dynamic engineer comms
const getEngineerNotes = (team: any, weekendProgress: any, isWet: boolean | null) => {
  const notes = [
    { time: '08:15', msg: "Garage setup completed successfully." },
    { time: '09:00', msg: "Telemetry link established with factory." }
  ];
  if (weekendProgress?.qualifyingComplete) {
    notes.push({ time: '14:30', msg: "Parc fermé conditions active. No further setup changes allowed." });
  }
  if (isWet === true) {
    notes.push({ time: '15:00', msg: "Weather radar confirms incoming rain. Preparing wet tyre blankets." });
  } else if (isWet === false) {
    notes.push({ time: '15:00', msg: "Track declared dry. Risk of precipitation dropping." });
  }
  if (team.carPerformance > 85) {
    notes.push({ time: '16:00', msg: "Simulations show high correlation with recent aero upgrades." });
  }
  return notes.reverse();
};

// RACE_OBJECTIVES is defined in utils/raceObjectives.js and re-exported above.

export const WeekendPage = ({ root, initialFlashMessage }: { root: HTMLElement, initialFlashMessage: string }) => {
  const s = state as any;
  ensureTeamState(s.team!);
  ensureSeasonTimeline(s);
  
  const totalRounds = Math.min(s.season.totalRounds || calendar.length, calendar.length);
  const round = s.season.round <= totalRounds ? calendar[s.season.round - 1] : null;
  const currentDay = s.season.currentDay;
  const raceDay = round ? getRoundRaceDay(round.round) : null;
  const raceDateLabel = round ? formatSeasonDate(s.season.year || 1, raceDay!) : "";
  const daysUntilRace = round ? getDaysUntilRound(round.round, currentDay) : 0;
  const raceWindowOpen = Boolean(round) && daysUntilRace === 0;
  const canAdvanceDay = canSimulateNextDay(s);
  const activeDrivers = getActiveDrivers(s.team!);
  const teams = [
    { ...s.team!, drivers: activeDrivers },
    ...s.aiTeams
  ];
  ensureFinanceState(s);
  const weekendProgress: any = round ? ensureWeekendProgress(round.round) : null;

  // Generate or retrieve unified race weekend state (single source of truth!)
  if (!s.raceWeekend || s.raceWeekend.round !== s.season.round) {
    s.raceWeekend = generateUnifiedRaceWeekend(s.team);
  }
  const raceWeekend = s.raceWeekend;
  
  if (round && weekendProgress && !weekendProgress.weekendContext && raceWindowOpen) {
    weekendProgress.weekendContext = generateWeekendContext(teams, round, s.raceHistory || [], s);
  }

  const raceNeedsQuali = Boolean(round && weekendProgress && !weekendProgress.qualifyingComplete);
  const raceAlreadyRun = Boolean(round && weekendProgress?.raceComplete);
  const raceLocked = !raceWindowOpen || raceAlreadyRun || !weekendProgress?.qualifyingComplete;

  const trackProfile = round ? getTrackStrategyProfile(round.circuit) : null;
  const roundStrats = trackProfile ? trackProfile.recommendedStrategies.map((strat: any, idx: number) => ({
    id: `ml_strat_${idx}`,
    label: strat.type,
    rank: idx + 1,
    confidence: strat.confidence,
    winModifier: (strat.confidence / 100) * 0.15,
    riskModifier: (1 - (strat.confidence / 100)) * 0.05
  })) : [];

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(initialFlashMessage);
  const [resultsData, setResultsData] = useState<{ metric: string, res: any[], grid: any[] | null, replayData?: any, objectiveId?: string } | null>(null);
  const [raceIsWet, setRaceIsWet] = useState<boolean | null>(
    weekendProgress?.isWet !== undefined ? weekendProgress.isWet : (raceWeekend?.weather.isWet ?? null)
  );
  const [liveRaceMode, setLiveRaceMode] = useState(false);
  const [showBriefingModal, setShowBriefingModal] = useState<'quick_sim' | 'race_control' | null>(null);
  const [briefingSelectedObjective, setBriefingSelectedObjective] = useState(
    weekendProgress?.selectedObjective || (raceWeekend?.recommendedObjective?.id) || RACE_OBJECTIVES[2].id
  );

  useEffect(() => {
    if (weekendProgress && weekendProgress.round === s.season.round && weekendProgress.raceComplete) {
      console.log("REPAIRING CORRUPTED STATE: Race is complete but round was not incremented.");
      s.season.round += 1;
      syncGame().then(() => {
        renderWeekend(root, "Successfully progressed to the next round.");
      });
    }
  }, [s.season.round, weekendProgress, root]);

  useEffect(() => {
    if (weekendProgress?.raceComplete && weekendProgress?.finalClassification) {
      setResultsData({
        metric: 'time',
        res: weekendProgress.finalClassification.results,
        grid: weekendProgress.grid
      });
    }
  }, [weekendProgress?.raceComplete, weekendProgress?.finalClassification]);

  const advanceDay = async () => {
    const tick = simulateNextDay(state);
    if (!tick.advanced) return;
    await syncGame();
    const completedText = tick.completedUpgrades.length
      ? ` Upgrade complete: ${tick.completedUpgrades.map((entry: any) => entry.part.toUpperCase()).join(", ")}.`
      : "";
    const completedFacilities = processFacilityProjects(state);
    const facilityText = completedFacilities.length
      ? ` Facility complete: ${completedFacilities.map((entry: any) => entry.name).join(", ")}.`
      : "";
    renderWeekend(root, `Advanced to Day ${s.season.currentDay}.${completedText}${facilityText}`);
  };

  const handlePractice = async () => {
    if (!raceWindowOpen) {
      setStatusMessage(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        gainTeamCarXP(s.team!, 5);
        setResultsData({ metric: 'bestLap', res: simulatePractice(teams, round!, weekendProgress?.weekendContext), grid: null });
        setStatusMessage(`Practice complete. Car XP increased to ${s.team!.carXP}/100.`);
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
        gainTeamCarXP(s.team!, 8);
        const { grid, isWet } = simulateQualifying(teams, round!, weekendProgress?.weekendContext);
        
        // Process penalties
        const finalGrid = applyGridPenalties(s, grid);

        setRaceIsWet(isWet);
        setResultsData({ metric: 'lap', res: finalGrid, grid: null });
        if (weekendProgress) {
          weekendProgress.qualifyingComplete = true;
          weekendProgress.grid = finalGrid.slice();
          weekendProgress.isWet = isWet;
        }
        setStatusMessage(
          weekendProgress?.raceComplete
            ? `Qualifying session updated. This Grand Prix race is already complete — advance to the next round for a new race. Car XP is ${s.team!.carXP}/100.`
            : `Qualifying complete. Car XP increased to ${s.team!.carXP}/100. Race is now unlocked.`
        );
        syncGame();
      } catch (error: any) {
        setStatusMessage(`Qualifying failed to simulate. ${error.message}`);
      }
      setLoading(false);
    }, 1000);
  };

  const openBriefingModal = (mode: 'quick_sim' | 'race_control') => {
    if (!raceWindowOpen) {
      setStatusMessage(`Race weekend opens on ${raceDateLabel}. Simulate ${daysUntilRace} more day${daysUntilRace === 1 ? "" : "s"} first.`);
      return;
    }
    if (weekendProgress?.raceComplete) {
      setStatusMessage("This Grand Prix race has already been completed. Simulate days to progress the calendar.");
      return;
    }
    if (!weekendProgress?.qualifyingComplete) {
      setStatusMessage("Qualifying must be completed before launching the Pre-Race Briefing.");
      return;
    }
    setShowBriefingModal(mode);
  };

  const startSimulationMode = async (objectiveId: string) => {
    const mode = showBriefingModal;
    setShowBriefingModal(null);
    if (weekendProgress) weekendProgress.selectedObjective = objectiveId;

    if (mode === 'quick_sim') {
      setLoading(true);
      setTimeout(async () => {
        try {
          const result: any = simulateRaceEvent(teams, round!, round!.laps, weekendProgress?.grid, weekendProgress?.selectedStrategies, weekendProgress?.weekendContext, objectiveId);
          const { finishers, replayData } = result;
          
          gainTeamXP(s.team!, 25);
          gainTeamCarXP(s.team!, 20);
          const standingsBefore = JSON.parse(JSON.stringify(s.standings));
          s.standings = updateStandings(finishers, s.standings);
          updateBestFinishes(finishers);
          recordRaceHistory(round!.round, round!.name, round!.circuit, finishers, s.standings, state, replayData, weekendProgress?.grid);

          if (weekendProgress) {
            weekendProgress.raceComplete = true;
            weekendProgress.finalClassification = { results: finishers };
          }
          applyRoundCarDevelopmentAll(state);
          s.season.round += 1;
          
          setResultsData({ metric: 'time', res: finishers, grid: weekendProgress?.grid || null, replayData, objectiveId });
          
          const historyRecord = s.raceHistory[s.raceHistory.length - 1];
          const financeReport = processRaceFinance(state, historyRecord, round);
          setStatusMessage(`${round!.name} Quick Sim complete. Net finance result: ${financeReport.netProfit >= 0 ? "+" : ""}$${financeReport.netProfit}M. Car XP is now ${s.team!.carXP}/100.`);
          await syncGame();
        } catch(e: any) {
           setStatusMessage(`Race failed to simulate. ${e.message}`);
        }
        setLoading(false);
      }, 500);
    } else if (mode === 'race_control') {
      setLiveRaceMode(true);
    }
  };

  const handleRaceComplete = async (finalClassification: any, replayData: any) => {
    setLiveRaceMode(false);
    setLoading(true);
    try {
      const res = finalClassification.results;
      gainTeamXP(s.team!, 25);
      gainTeamCarXP(s.team!, 20);

      const standingsBefore = JSON.parse(JSON.stringify(s.standings));

      s.standings = updateStandings(res, s.standings);
      updateBestFinishes(res);
      recordRaceHistory(round!.round, round!.name, round!.circuit, res, s.standings, state, replayData, weekendProgress?.grid);

      const historyRecord = s.raceHistory[s.raceHistory.length - 1];

      if (weekendProgress) {
        weekendProgress.raceComplete = true;
        weekendProgress.finalClassification = finalClassification;
      }
      const objId = weekendProgress?.selectedObjective || 'points';
      const financeReport = processRaceFinance(state, historyRecord, round);
      applyRoundCarDevelopmentAll(state);
      s.season.round += 1;
      
      setResultsData({ metric: 'time', res, grid: weekendProgress?.grid || null, replayData, objectiveId: objId });
      validateFinalClassification(finalClassification, standingsBefore, s.standings, historyRecord);

      setStatusMessage(`${round!.name} complete. Net finance result: ${financeReport.netProfit >= 0 ? "+" : ""}$${financeReport.netProfit}M. Car XP is now ${s.team!.carXP}/100. Day simulation is now unlocked.`);
      await syncGame();
    } catch (error: any) {
      setStatusMessage(`Race processing failed. ${error.message}`);
    }
    setLoading(false);
  };

  const renderResults = () => {
    if (!resultsData) return null;
    const { metric, res, grid, replayData, objectiveId } = resultsData;
    const title = metric === "bestLap" ? "Practice Results" : metric === "lap" ? "Qualifying Results" : "Race Results";
    const isRace = metric === "time";

    if (isRace) {
      return <DetailedRaceReport results={res} grid={grid} objectiveId={objectiveId || 'points'} state={state} track={round} replayData={replayData} />;
    }

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
                const isPlayerDriver = s.team && r.team && r.team.name === s.team.name;
                
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

  if (liveRaceMode && round && weekendProgress?.grid) {
    return (
      <RaceControl
        teams={teams}
        track={round}
        laps={round.laps}
        qualifyingGrid={weekendProgress.grid}
        selectedStrategies={weekendProgress.selectedStrategies}
        selectedObjective={weekendProgress.selectedObjective}
        weekendContext={weekendProgress.weekendContext}
        onRaceComplete={handleRaceComplete}
      />
    );
  }

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

  // Calculate Data for the New Dashboard Layout
  const reliability = s.team!.car?.reliability || 80;
  const healthScore = Math.min(100, Math.max(0, reliability + (Math.random() * 10 - 5)));
  
  // Standings
  const sortedTeams = Object.entries(s.standings.teams).sort((a: any, b: any) => b[1] - a[1]);
  const teamPos = sortedTeams.findIndex(t => t[0] === s.team!.name) + 1;
  const teamPts = s.standings.teams[s.team!.name] || 0;
  
  let gapAhead = 0, gapBehind = 0;
  if (teamPos > 1) gapAhead = (sortedTeams[teamPos - 2][1] as number) - teamPts;
  if (teamPos < sortedTeams.length) gapBehind = teamPts - (sortedTeams[teamPos][1] as number);

  const sortedDrivers = Object.entries(s.standings.drivers).sort((a: any, b: any) => b[1] - a[1]);
  const d1Pos = activeDrivers[0] ? sortedDrivers.findIndex(d => d[0] === activeDrivers[0].name) + 1 : '-';

  // Rival Watch
  const rivals = sortedTeams.filter((t: any) => t[0] !== s.team!.name).map((t: any) => {
    const aiTeam = s.aiTeams.find((a: any) => a.name === t[0]);
    return { name: t[0], points: t[1], carLevel: aiTeam?.carLevel || 1, perf: aiTeam?.carPerformance || 80 };
  }).slice(0, 3); // top 3 rivals

  const lastUpgrade = s.team!.upgradeHistory?.[s.team!.upgradeHistory.length - 1];
  const pendingUpg = s.team!.pendingUpgrades?.[0];

  const rainProb = Math.round(getTrackWetProbability(round.circuit) * 100);
  const raceBonusChallenges = generateRaceBonusChallenges(s, round);

  return (
    <div style={{ paddingBottom: '64px' }}>
      
      {/* Title Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {sectionLabel('Race Operations Hub')}
          {pageTitle(round!.name)}
          {pageSubtitle('Monitor track conditions, factory readiness, and rival developments before the race.')}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={statCell()}>{statLabel('Current Round')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', color:'#fff', fontWeight:700, fontSize:'16px'}}>{round.round} / {totalRounds}</span></div>
          <div style={statCell()}>{statLabel('Car Level')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', color:'#fff', fontWeight:700, fontSize:'16px'}}>Lv {s.team!.carLevel}</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '24px' }}>
        
        {/* Section 1: Weekend Overview (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={14} /> Weekend Overview</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Circuit</span><span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.circuit}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Circuit Type</span><span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.circuitType}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Weather Forecast</span><span style={{ fontSize: '12px', color: raceWeekend?.weather.isWet ? '#60a5fa' : '#fbbf24', fontWeight: 700 }}>{raceWeekend?.weather.isWet ? '🌧️ Wet Race' : '☀️ Dry Race'}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Rain Probability</span><span style={{ fontSize: '12px', color: raceWeekend?.weather.rainProbability > 30 ? '#ef4444' : raceWeekend?.weather.rainProbability > 10 ? '#f59e0b' : '#10b981', fontWeight: 700 }}>{raceWeekend?.weather.rainProbability}%</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Track Temp</span><span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.weather.trackTemperature}°C</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Race Status</span><span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.raceStatus}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '12px', color: HUB.textMuted }}>Countdown</span><span style={{ fontSize: '12px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.countdown}</span></div>
          </div>
        </div>

        {/* Section 2: Power Unit Status (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={14} /> Power Unit Status</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(() => {
              ensureEngineeringState(s);
              const driver = s.team!.drivers[0];
              if (!driver) return null;
              
              const keyComponents = ['ICE', 'TC', 'GB', 'ES'];
              return keyComponents.map(comp => {
                const active = getActiveComponent(s, driver.name, comp);
                if (!active) return null;
                const h = 100 - active.wear;
                return (
                  <div key={comp}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: HUB.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>
                      <span>{COMPONENT_CATALOG[comp].name}</span>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{h.toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                      <div style={{ width: `${h}%`, height: '100%', background: h > 85 ? '#10b981' : h > 60 ? '#f59e0b' : '#ef4444', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              });
            })()}
            <button onClick={() => import('./engineering.tsx').then(m => m.renderEngineering(root))} style={{...actionBtn({padding:'8px', fontSize:'11px', marginTop:'8px', backgroundColor:'rgba(255,255,255,0.05)'})}}>Manage Engineering Centre</button>
          </div>
        </div>

        {/* Section 3: Engineering Status (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={14} /> Engineering Status</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Latest Upgrade</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{lastUpgrade?.part || 'None'}</span>
                {lastUpgrade && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>+{lastUpgrade.expectedGain} OVR</span>}
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Manufacturing Queue</span>
              {pendingUpg ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{pendingUpg.part}</span>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>ETA Round {Math.floor((Math.max(1, pendingUpg.readyDay) - 1) / 14) + 1}</span>
                  </div>
                  <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                    <div style={{ width: '60%', height: '100%', background: '#3b82f6', borderRadius: '2px', animation: 'pulse 2s infinite' }} />
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: HUB.textMuted }}>No active development projects.</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Championship Snapshot (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Award size={14} /> Championship Snapshot</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
               <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Constructors</span>
               <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>P{raceWeekend?.standingsImpact.currentConstructorPosition}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
               <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Lead Driver</span>
               <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', fontFamily: HUB.fontMono }}>P{d1Pos}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>Nearest Rival:</span>
            <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>{raceWeekend?.standingsImpact.nearestRival}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', color: HUB.textMuted }}>Gap to Rival:</span>
            <span style={{ fontSize: '13px', color: raceWeekend?.standingsImpact.gapToRival > 0 ? '#ef4444' : raceWeekend?.standingsImpact.gapToRival < 0 ? '#10b981' : HUB.textMuted, fontWeight: 700, fontFamily: HUB.fontMono }}>
              {Math.abs(raceWeekend?.standingsImpact.gapToRival) > 0 ? `${raceWeekend?.standingsImpact.gapToRival > 0 ? '-' : '+'}${Math.abs(raceWeekend?.standingsImpact.gapToRival)} pts` : '—'}
            </span>
          </div>
        </div>

        {/* Section 5: Dynamic Objectives (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Flag size={14} /> Race Objectives</h4>
          <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase' }}>Team Tier</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{raceWeekend?.tier.label}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {raceWeekend?.objectives.map((obj, i) => (
               <div key={i} style={{ padding: '10px', background: obj.type === 'primary' ? 'rgba(225,6,0,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', border: obj.type === 'primary' ? `1px solid ${HUB.accent}` : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{obj.label}</span>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: obj.riskLevel === 'High' || obj.riskLevel === 'Very High' ? '#ef4444' : '#10b981' }}>{obj.riskLevel} Risk</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: HUB.textMuted }}>
                    <span>Expected: {obj.expectedFinish}</span>
                    <span>{obj.successProbability}% Success</span>
                  </div>
               </div>
            ))}
          </div>
        </div>

        {/* Section 6: Track Insights (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={14} /> AI Track Insights</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {generateTrackInsights(round.circuit, raceWeekend?.weather.isWet ?? null, trackProfile).map((msg, i) => (
               <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <ChevronRight size={14} color={HUB.accent} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#ccc', margin: 0, lineHeight: '1.4' }}>{msg}</p>
               </div>
            ))}
          </div>
        </div>

        {/* Section 6: Rival Watch (Span 4) */}
        <div style={{ ...glassCard({ padding: '20px' }), gridColumn: 'span 4' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><Timer size={14} /> Rival Watch</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rivals.map((rival, i) => (
              <div key={rival.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'block' }}>{rival.name}</span>
                  <span style={{ fontSize: '10px', color: HUB.textMuted }}>{rival.points} pts</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700, display: 'block' }}>Car Lv {rival.carLevel}</span>
                  <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                    Pace: {rival.perf}
                    {rival.perf > s.team!.carPerformance ? <ArrowUpRight size={10} color="#ef4444" /> : <ArrowDownRight size={10} color="#10b981" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...glassCard({ padding: '20px' }), marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><DollarSign size={14} /> Race Bonus Challenges</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {raceBonusChallenges.map((challenge) => (
            <div key={challenge.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${HUB.border}`, borderRadius: '8px' }}>
              <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Optional Objective</span>
              <h4 style={{ fontSize: '14px', color: '#fff', margin: '6px 0 12px', fontFamily: HUB.fontBold }}>{challenge.label}</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: HUB.textMuted }}>
                <span>Cash <strong style={{ color: '#10b981' }}>+${challenge.cash}M</strong></span>
                <span>Board <strong style={{ color: '#fff' }}>+{challenge.boardConfidence}</strong></span>
                <span>Rep <strong style={{ color: '#fff' }}>+{challenge.reputation}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 7: Engineer Notes Feed */}
      <div style={{ ...glassCard({ padding: '20px' }), marginBottom: '32px' }}>
         <h4 style={{ margin: '0 0 16px', fontSize: '12px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={14} /> Comms Feed</h4>
         <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
           {getEngineerNotes(s.team, weekendProgress, raceIsWet).map((note, i) => (
             <div key={i} style={{ minWidth: '250px', borderLeft: `2px solid ${i === 0 ? HUB.accent : 'rgba(255,255,255,0.1)'}`, paddingLeft: '12px' }}>
               <span style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontMono, display: 'block', marginBottom: '4px' }}>{note.time}</span>
               <p style={{ fontSize: '13px', color: i === 0 ? '#fff' : '#ccc', margin: 0 }}>{note.msg}</p>
             </div>
           ))}
         </div>
      </div>

      {/* Advance Day Bar (if not open) */}
      {!raceWindowOpen && (
        <div style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderLeft: `4px solid ${HUB.accent}` }}>
          <div>
            <p style={{ fontSize: '14px', color: '#fff', fontWeight: 700, margin: '0 0 4px' }}>Race Weekend Closed</p>
            <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>Simulate {daysUntilRace} more day{daysUntilRace === 1 ? "" : "s"} until {raceDateLabel} to unlock track sessions.</p>
          </div>
          <button onClick={advanceDay} disabled={!canAdvanceDay || loading} style={{ ...actionBtn({ padding: '12px 32px' }), opacity: (!canAdvanceDay || loading) ? 0.5 : 1 }}>
            Simulate 1 Day
          </button>
        </div>
      )}

      {/* Bottom Actions Console */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <button 
          onClick={handlePractice} 
          style={{ ...actionBtn({ padding: '24px' }) as any, height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: weekendProgress?.qualifyingComplete || weekendProgress?.raceComplete ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: weekendProgress?.qualifyingComplete || weekendProgress?.raceComplete ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)' }}
        >
          {weekendProgress?.qualifyingComplete || weekendProgress?.raceComplete ? <CheckCircle size={20} color="#10b981" style={{ marginBottom: '8px' }} /> : <Activity size={20} color="#fff" style={{ marginBottom: '8px' }} />}
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: weekendProgress?.qualifyingComplete || weekendProgress?.raceComplete ? '#10b981' : '#fff' }}>RUN PRACTICE</span>
        </button>
        
        <button 
          onClick={handleQuali} 
          style={{ ...actionBtn({ padding: '24px' }) as any, height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: weekendProgress?.qualifyingComplete ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: weekendProgress?.qualifyingComplete ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)' }}
        >
          {weekendProgress?.qualifyingComplete ? <CheckCircle size={20} color="#10b981" style={{ marginBottom: '8px' }} /> : <Timer size={20} color="#fff" style={{ marginBottom: '8px' }} />}
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: weekendProgress?.qualifyingComplete ? '#10b981' : '#fff' }}>RUN QUALIFYING</span>
        </button>

        <button 
          onClick={() => openBriefingModal('quick_sim')} 
          style={{ ...actionBtn({ padding: '24px' }) as any, height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Zap size={20} color="#fff" style={{ marginBottom: '8px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>QUICK SIM</span>
        </button>

        <button 
          onClick={() => openBriefingModal('race_control')} 
          style={{ ...actionBtn({ padding: '24px' }) as any, height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: HUB.accent, border: 'none' }}
        >
          <Flag size={20} color="#fff" style={{ marginBottom: '8px' }} />
          <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: '#fff' }}>RACE CONTROL</span>
        </button>
      </div>

      {statusMessage && (
        <div style={{ ...glassCard({ padding: '16px' }), borderLeft: `4px solid ${HUB.accent}`, marginTop: '24px' }}>
          <p style={{ fontSize: '14px', color: '#fff', margin: 0 }}>{statusMessage}</p>
        </div>
      )}

      {resultsData && <div key={resultsData.metric}>{renderResults()}</div>}

      {/* Pre-Race Briefing Modal Overlay */}
        <PreRaceBriefingModal
          isOpen={showBriefingModal !== null}
          mode={showBriefingModal}
          onClose={() => setShowBriefingModal(null)}
          onConfirm={startSimulationMode}
          selectedObjective={briefingSelectedObjective}
          setSelectedObjective={setBriefingSelectedObjective}
          raceWeekend={raceWeekend}
          briefingData={{
            expectedFinish: 'P' + (roundStrats.length > 0 && roundStrats[0].rank ? roundStrats[0].rank + 4 : 8),
            confidence: roundStrats.length > 0 ? roundStrats[0].confidence : 75,
            rivalTeam: rivals[0]?.name || 'Rivals',
            isWet: raceIsWet,
            strategyType: roundStrats.length > 0 ? roundStrats[0].label : 'Balanced',
            startTyre: 'Medium'
          }}
        />

    </div>
  );
};

export function renderWeekend(root: HTMLElement, flashMessage = "") {
  mountLayout(root, 'weekend', <WeekendPage root={root} initialFlashMessage={flashMessage} />, () => renderWeekend(root, flashMessage));
}
