import React, { useState, useEffect } from "react";
import { constructorEntries } from "../utils/championshipModel.js";
import { strategies } from "../data/strategies.js";
import { getTrackStrategyProfile } from "../data/strategyProfiles.js";
import { simulatePractice } from "../game/practice.js";
import { simulateQualifying } from "../game/qualifying.js";
import { newRaceSeed } from "../game/raceEvents.js";
import { simulateRaceEvent } from "../game/raceSimulator.js";
import { RaceControl, liveRaceRound } from "./RaceControl.tsx";
import { updateStandings } from "../game/standings.js";
import { recordRaceHistory, recordSprintHistory, SPRINT_POINTS } from "../game/raceHistory.js";
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
import { generateWeekendContext, refreshPlayerSetupInContext } from "../utils/weekendForm.js";
import { lockWeekendSetup } from "../game/setup/setupLab.js";
import { SetupLab } from "../components/ui/SetupLab.tsx";
import { StrategyBuilder } from "../components/ui/StrategyBuilder.tsx";
import { ensureEngineeringState, getActiveComponent, COMPONENT_CATALOG, applyGridPenalties } from "../utils/engineeringSystem.js";
import { RACE_OBJECTIVES, generateUnifiedRaceWeekend, refreshRaceWeekendAfterQualifying, evaluateObjective } from "../utils/raceObjectives.js";
export { RACE_OBJECTIVES };
import { ObjectiveCardsList, FinishDistributionBar } from '../components/ui/ObjectiveCards.tsx';

import { mountLayout, HUB, glassCard, statCell, statLabel, statValue, btn, btnClass, sectionLabel, pageTitle, pageSubtitle, pill } from '../components/HubLayout.tsx';
import { CloudRain, Sun, Wind, ChevronRight, Activity, Award, ShieldAlert, Cpu, CheckCircle, AlertTriangle, MessageSquare, Flag, ArrowUpRight, ArrowDownRight, Minus, Timer, Zap, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, PageTransition } from '../components/ui/motion.tsx';
import { PreRaceBriefingModal } from "../components/ui/PreRaceBriefingModal.tsx";
import { DetailedRaceReport } from "../components/ui/DetailedRaceReport.tsx";
import { WeekendHeader, type WeekendView } from "../components/weekend/WeekendHeader.tsx";
import { OverviewBoard } from "../components/weekend/OverviewBoard.tsx";
import { SetupConsole } from "../components/weekend/SetupConsole.tsx";
import { CircuitMap } from "../components/weekend/CircuitMap.tsx";
import { CircuitStage } from "../components/drivers/CircuitStage.tsx";
import { buildTrackGeometry, analyseTrack } from "../components/drivers/trackGeometry.ts";
import { getTrackPath } from "../data/realTrackLayouts.js";
import { usePrefersReducedMotion } from "../components/driverToolsMotion.ts";
import { getSessionState, getCircuitIntel } from "../utils/weekendModel.js";
import { getCircuitFacts } from "../utils/driverProfileModel.js";
import { ensureSetupLab } from "../game/setup/setupLab.js";
import "../components/weekend/weekend.css";

function ensureWeekendProgress(round: number): any {
  if (!(state as any).weekendProgress || (state as any).weekendProgress.round !== round) {
    (state as any).weekendProgress = {
      round,
      practiceComplete: false,
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

    if (entry.retired) return;
    const currentBest = s.bestFinishes[name];
    if (!currentBest || finishPos < currentBest) s.bestFinishes[name] = finishPos;

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

// RACE_OBJECTIVES is defined in utils/raceObjectives.js and re-exported above.

export const WeekendPage = ({ root, initialFlashMessage }: { root: HTMLElement, initialFlashMessage: string }) => {
  const s = state as any;
  ensureTeamState(s.team!);
  ensureSeasonTimeline(s);
  
  const activeCalendar = s.season.calendar || [];
  const totalRounds = activeCalendar.length;
  const round = s.season.round <= totalRounds ? activeCalendar[s.season.round - 1] : null;
  const currentDay = s.season.currentDay;
  const raceDay = round ? getRoundRaceDay(round.round) : null;
  const raceDateLabel = round ? formatSeasonDate(s.season.year || 1, raceDay!) : "";
  const daysUntilRace = round ? getDaysUntilRound(round.round, currentDay) : 0;
  const raceWindowOpen = Boolean(round) && daysUntilRace === 0;
  const canAdvanceDay = canSimulateNextDay(s);
  const activeDrivers = getActiveDrivers(s.team!);
  const teams = [
    // Flagged so the sim applies the player's engineering upgrades to this copy of the team.
    { ...s.team!, drivers: activeDrivers, isPlayerTeam: true },
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
  // Seeds for the weekend's sessions: the same seed replays the same qualifying / race
  if (weekendProgress && weekendProgress.qualiSeed == null) weekendProgress.qualiSeed = newRaceSeed();
  if (weekendProgress?.weekendContext && weekendProgress.weekendContext.raceSeed == null) {
    weekendProgress.weekendContext.raceSeed = newRaceSeed();
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
  const [resultsData, setResultsData] = useState<{ metric: string, res: any[], grid: any[] | null, replayData?: any, objectiveId?: string, track?: any } | null>(null);
  const [raceIsWet, setRaceIsWet] = useState<boolean | null>(
    weekendProgress?.isWet !== undefined ? weekendProgress.isWet : (raceWeekend?.weather.isWet ?? null)
  );
  // A race still running (e.g. after a theme switch remounts this screen) reopens in race control
  const [liveRaceMode, setLiveRaceMode] = useState(() => !!round && !raceAlreadyRun && liveRaceRound() === round.round);
  const [showBriefingModal, setShowBriefingModal] = useState<'quick_sim' | 'race_control' | null>(null);
  const [briefingSelectedObjective, setBriefingSelectedObjective] = useState(
    weekendProgress?.selectedObjective || (raceWeekend?.recommendedObjective?.id) || RACE_OBJECTIVES[1].id
  );
  const [view, setView] = useState<WeekendView>(() => (weekendProgress?.raceComplete ? 'results' : raceWindowOpen ? 'prep' : 'overview'));
  const [practiceRun, setPracticeRun] = useState<boolean>(() => Boolean(weekendProgress?.practiceComplete));
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();

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
      ? ` Upgrade complete: ${tick.completedUpgrades.map((entry: any) => entry.part).join(", ")}.`
      : "";
    const completedFacilities = tick.completedFacilities || [];
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
    // One practice session per weekend: re-running it would farm car XP.
    if (weekendProgress?.practiceComplete || weekendProgress?.qualifyingComplete) {
      setStatusMessage("Practice is over for this weekend.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        gainTeamCarXP(s.team!, 5);
        refreshPlayerSetupInContext(weekendProgress?.weekendContext, round, s);
        setResultsData({ metric: 'bestLap', res: simulatePractice(teams, round!, weekendProgress?.weekendContext), grid: null });
        if (weekendProgress) weekendProgress.practiceComplete = true;
        setPracticeRun(true);
        setView('results');
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
    // One qualifying session per weekend: re-rolling the grid until pole is an exploit.
    if (weekendProgress?.qualifyingComplete) {
      setStatusMessage("Qualifying is complete. The grid is set for this Grand Prix.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      try {
        gainTeamCarXP(s.team!, 8);
        // Parc fermé: the setup sheet is final from qualifying onwards.
        refreshPlayerSetupInContext(weekendProgress?.weekendContext, round, s);
        lockWeekendSetup(s);
        const { grid, isWet } = simulateQualifying(teams, round!, weekendProgress?.weekendContext, { seed: weekendProgress?.qualiSeed });
        
        // Process penalties
        const finalGrid = applyGridPenalties(s, grid);

        setRaceIsWet(isWet);
        setResultsData({ metric: 'lap', res: finalGrid, grid: null });
        setView('results');
        if (weekendProgress) {
          weekendProgress.qualifyingComplete = true;
          weekendProgress.grid = finalGrid.slice();
          weekendProgress.isWet = isWet;
          // One weather for the whole weekend: the race runs in qualifying's conditions.
          if (weekendProgress.weekendContext) weekendProgress.weekendContext.isWet = isWet;
        }
        // Objectives re-forecast from the real grid and weather.
        refreshRaceWeekendAfterQualifying(s, { grid: finalGrid, teams, weekendContext: weekendProgress?.weekendContext });
        setStatusMessage(`Qualifying complete. Car XP increased to ${s.team!.carXP}/100. Race is now unlocked.`);
        syncGame();
      } catch (error: any) {
        setStatusMessage(`Qualifying failed to simulate. ${error.message}`);
      }
      setLoading(false);
    }, 1000);
  };

  // Sprint weekends (calendar flag + the season's sprint setting)
  const sprintWeekend = Boolean(round?.sprint) && s.season.rules?.sprints !== false;
  const sprintLaps = round ? Math.max(8, Math.round(round.laps / 3)) : 0;

  const handleSprint = () => {
    if (!weekendProgress?.qualifyingComplete) {
      setStatusMessage("Qualifying sets the sprint grid. Run qualifying first.");
      return;
    }
    if (weekendProgress.sprintComplete) {
      setStatusMessage("The sprint has already been run this weekend.");
      return;
    }
    setLoading(true);
    setTimeout(async () => {
      try {
        const seed = ((weekendProgress.weekendContext?.raceSeed ?? 0) + 1) >>> 0;
        const { finishers, replayData } = simulateRaceEvent(teams, round!, sprintLaps, weekendProgress.grid, {}, weekendProgress.weekendContext, 'points', { seed, sprint: true });
        s.standings = updateStandings(finishers, s.standings, SPRINT_POINTS);
        recordSprintHistory(round!.round, round!.name, round!.circuit, finishers, s, weekendProgress.grid, replayData.seed);
        weekendProgress.sprintComplete = true;
        const leader = finishers[0]?.time || 0;
        setResultsData({ metric: 'gap', res: finishers.map((f: any) => ({ ...f, gap: f.retired ? NaN : f.time - leader })), grid: weekendProgress.grid });
        setView('results');
        const ours = finishers.map((f: any, i: number) => ({ f, pos: i + 1 })).filter(({ f }: any) => f.team.name === s.team!.name);
        const pts = ours.reduce((a: number, { f, pos }: any) => a + (f.retired && !f.classified ? 0 : (SPRINT_POINTS[pos - 1] || 0)), 0);
        setStatusMessage(`Sprint complete (${sprintLaps} laps). ${ours.map(({ f, pos }: any) => `${f.driver.name.split(' ').pop()} P${pos}`).join(', ')}: ${pts} point${pts === 1 ? '' : 's'}. The Grand Prix is next.`);
        await syncGame();
      } catch (error: any) {
        setStatusMessage(`Sprint failed to simulate. ${error.message}`);
      }
      setLoading(false);
    }, 800);
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
      setStatusMessage("Qualifying must be completed before opening the pre-race briefing.");
      return;
    }
    if (sprintWeekend && !weekendProgress.sprintComplete) {
      setStatusMessage("It's a sprint weekend: run the sprint before the Grand Prix.");
      return;
    }
    setShowBriefingModal(mode);
  };

  const startSimulationMode = async (objectiveId: string) => {
    const mode = showBriefingModal;
    setShowBriefingModal(null);
    if (weekendProgress) {
      weekendProgress.selectedObjective = objectiveId;
      // Store full objective object + finish distribution for post-race evaluation
      const objDef = raceWeekend?.objectives?.find((o: any) => o.id === objectiveId);
      if (objDef) {
        weekendProgress.selectedObjectiveData = { ...objDef, finishDistribution: raceWeekend?.finishDistribution };
      }
    }

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
          
          setResultsData({ metric: 'time', res: finishers, grid: weekendProgress?.grid || null, replayData, objectiveId, track: round });
          setView('results');
          
          const historyRecord = s.raceHistory[s.raceHistory.length - 1];
          const financeReport = processRaceFinance(state, historyRecord, round);
          setStatusMessage(`${round!.name} Quick sim complete. Net finance result: ${financeReport.netProfit >= 0 ? "+" : ""}$${financeReport.netProfit}M. Car XP is now ${s.team!.carXP}/100.`);
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
      
      setResultsData({ metric: 'time', res, grid: weekendProgress?.grid || null, replayData, objectiveId: objId, track: round });
      setView('results');
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
    const { metric, res, grid, replayData, objectiveId, track: resultTrack } = resultsData;
    const title = metric === "bestLap" ? "Practice results" : metric === "lap" ? "Qualifying results" : metric === "gap" ? "Sprint results" : "Race results";
    const isRace = metric === "time";

    if (isRace) {
      return <DetailedRaceReport results={res} grid={grid} objectiveId={objectiveId || 'points'} state={state} track={resultTrack || round} replayData={replayData} />;
    }

    return (
      <SlideUp>
        <motion.div 
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ type: "spring", bounce: 0, duration: 0.3 }}
           style={{ ...glassCard({ padding: '24px' }) }}>
           <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, margin: '0 0 16px', color: HUB.textPrimary }}>{title}</h3>

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
                      <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', color: delta > 0 ? HUB.positive : delta < 0 ? HUB.negative : HUB.textMuted, marginRight: '16px' }}>
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
                     key={r.driver.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isPlayerDriver ? HUB.accentSoft : HUB.raised, border: `1px solid ${isPlayerDriver ? 'rgba(225,6,0,0.4)' : HUB.border}`, borderRadius: '8px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, width: '30px' }}>P{i + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <img src={getDriverHeadshotUrl(r.driver)} alt={r.driver.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                           <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{r.driver.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: HUB.textMuted }}>{r.team.name}</span>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                        {deltaHtml}
                        <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', color: HUB.textPrimary }}>{status}</span>
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
          {sectionLabel('End of calendar')}
          {pageTitle('Season Complete')}
          {pageSubtitle('The championship is over. Head into the offseason to review results and confirm your lineup.')}
        </div>
        <button onClick={() => { import('./offseason.tsx').then(m => m.renderOffseason(root)) }} className={btnClass('primary')} style={btn('primary', 'md')}>Open offseason</button>
      </div>
    );
  }

  // Rival for the pre-race briefing (unchanged)
  const sortedTeams = constructorEntries(s);
  const rivals = sortedTeams.filter((t: any) => t[0] !== s.team!.name).map((t: any) => ({ name: t[0], points: t[1] })).slice(0, 3);

  const rainProb = Math.round(getTrackWetProbability(`${round.name || ""} ${round.circuit || ""}`) * 100);
  const raceBonusChallenges = generateRaceBonusChallenges(s, round);
  const intel = getCircuitIntel(round);
  const geo = buildTrackGeometry(getTrackPath(round.name));
  const brakingCount = geo ? analyseTrack(geo as any, intel?.corners ?? null).braking.length : null;
  const setupRuns = ensureSetupLab(s).weekend?.runs || [];
  const session = getSessionState({ raceWindowOpen, daysUntilRace, weekendProgress, practiceRun, sprintWeekend });
  const hasResults = Boolean(resultsData);
  const activeView: WeekendView = view === 'results' && !hasResults ? 'overview' : view === 'prep' && raceAlreadyRun ? 'overview' : view;

  const onNavigate = async (screen: string, tab?: string) => {
    if (screen === 'prep') { setView('prep'); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    if (screen === 'engineering') { const m = await import('./engineering.tsx'); m.renderEngineering(root, tab); return; }
    if (screen === 'academy') { const m = await import('./academy.tsx'); m.renderAcademy(root); return; }
    if (screen === 'finance') { const m = await import('./finance.tsx'); m.renderFinance(root); return; }
    if (screen === 'drivers') { const m = await import('./myDrivers.tsx'); m.renderMyDrivers(root); return; }
  };

  const setupChanged = (message?: string) => {
    refreshPlayerSetupInContext(weekendProgress?.weekendContext, round, s);
    if (message) {
      setStatusMessage(message);
      syncGame();
    }
  };

  return (
    <div className="wk-root">
      {activeView === 'overview' && <CircuitStage facts={getCircuitFacts(round)} reduced={reduced} onOpen={() => onNavigate('prep')} />}

      <WeekendHeader
        round={round} intel={intel} year={s.season.year || 1} totalRounds={totalRounds}
        raceDateLabel={raceDateLabel} daysUntilRace={daysUntilRace} weather={raceWeekend?.weather}
        session={session} view={activeView} setView={setView} hasResults={hasResults}
        loading={loading} canAdvanceDay={canAdvanceDay}
        onPractice={handlePractice} onQuali={handleQuali} onSprint={handleSprint}
        onQuickSim={() => openBriefingModal('quick_sim')} onRaceControl={() => openBriefingModal('race_control')}
        onAdvanceDay={advanceDay} statusMessage={statusMessage}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeView}
          className="wk-viewwrap"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeView === 'overview' && (
            <OverviewBoard
              s={s} raceWeekend={raceWeekend} weekendProgress={weekendProgress} drivers={activeDrivers}
              session={session} daysUntilRace={daysUntilRace} raceWindowOpen={raceWindowOpen}
              selectedObjective={briefingSelectedObjective} onSelectObjective={setBriefingSelectedObjective}
              intel={intel} trackProfile={trackProfile} insights={generateTrackInsights(round.circuit, raceWeekend?.weather.isWet ?? null, trackProfile)}
              brakingCount={brakingCount} challenges={raceBonusChallenges} setupRuns={setupRuns} raceDay={raceDay}
              onNavigate={onNavigate} reduced={reduced}
            />
          )}

          {activeView === 'prep' && (
            <div className="wk-ws">
              {raceWindowOpen ? (
                <SetupConsole appState={s} track={round} drivers={activeDrivers} locked={Boolean(weekendProgress?.qualifyingComplete)} onSetupChanged={setupChanged} />
              ) : (
                <section className="wk-col wk-setup" aria-labelledby="wk-setup-title">
                  <div className="wk-col-head"><h2 id="wk-setup-title" className="wk-panel-title"><span className="wk-code">01</span>Car setup</h2></div>
                  <p className="wk-empty">The car reaches the circuit on {raceDateLabel}. Setup work and test runs open then, {daysUntilRace} day{daysUntilRace === 1 ? '' : 's'} from now. Strategy can be planned now.</p>
                </section>
              )}

              <section className="wk-col wk-mapcol" aria-label="Circuit map">
                <CircuitMap intel={intel} weather={raceWeekend?.weather} selectedSector={selectedSector} onSelectSector={setSelectedSector} reduced={reduced} />
                <div className="wk-map-foot">
                  <div><span>Length</span><strong>{intel?.lengthKm ? `${intel.lengthKm} km` : '–'}</strong></div>
                  <div><span>Corners</span><strong>{intel?.corners ?? '–'}</strong></div>
                  <div><span>Race distance</span><strong>{intel?.lengthKm && round.laps ? `${(intel.lengthKm * round.laps).toFixed(1)} km` : '–'}</strong></div>
                  <div><span>Overtaking</span><strong>{intel?.overtaking != null ? `${intel.overtaking}/100` : '–'}</strong></div>
                  <p className="wk-map-foot-note">Corner positions and braking zones are estimated from the layout's shape; the start line marks where the layout begins.</p>
                </div>
              </section>

              {weekendProgress && activeDrivers.length > 0 ? (
                <StrategyBuilder
                  key={round.round}
                  variant="workstation"
                  appState={s}
                  track={round}
                  totalLaps={round.laps}
                  playerTeam={teams[0]}
                  drivers={activeDrivers}
                  teams={teams}
                  grid={weekendProgress.grid}
                  weekendContext={weekendProgress.weekendContext}
                  selectedStrategies={weekendProgress.selectedStrategies}
                  rainProbability={rainProb}
                  onLock={(labels: Record<string, string>) => {
                    Object.assign(weekendProgress.selectedStrategies, labels);
                    setStatusMessage(`Strategy locked: ${Object.entries(labels).map(([n, l]) => `${String(n).split(' ').pop()} ${String(l).replace(/\s*->\s*/g, '–').replace('(Custom: pit ', '(pit ')}`).join(' · ')}.`);
                    syncGame();
                  }}
                />
              ) : (
                <section className="wk-col"><p className="wk-empty">Sign two race drivers to plan a strategy.</p></section>
              )}
            </div>
          )}

          {activeView === 'results' && resultsData && (
            <div className="wk-results" key={resultsData.metric}>{renderResults()}</div>
          )}
        </motion.div>
      </AnimatePresence>

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
