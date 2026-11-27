import React, { useState, useMemo } from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers, setTeamActiveDrivers } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { calendar as ALL_CIRCUITS } from '../data/calendar.js';
import { getCircuitProfile } from '../utils/devProjects.js';
import { mountLayout, HUB, glassCard, statCell, btn, btnClass, iconBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { AnimatedNumber, AnimatedBar } from '../components/ui/motion.tsx';
import { RadarChart } from '../components/driverComparison.tsx';
import { DriverNegotiationModal } from '../components/DriverNegotiationModal.tsx';
import { ContractBuilder } from '../components/ContractBuilder.tsx';
import { DriverRadarCompare } from '../components/DriverRadarCompare.tsx';
import { runReserveOffer, runRenewalOffer, areContractTalksClosed } from '../utils/contractOfferModel.js';
import { getDriverSeasonSummary, getDriverChampionshipPosition, getTeamChampionshipPosition, getCurrentRound, getCircuitFacts, getRoundWeather } from '../utils/driverProfileModel.js';
import { DriverLineup, WeekendPanel, DriverHero, DriverStats, ContractPanel, ConfirmDialog, ContractDetails, type ConfirmSpec } from '../components/drivers/DriverDeck.tsx';
import { CircuitStage, CircuitExpanded } from '../components/drivers/CircuitStage.tsx';
import { usePrefersReducedMotion } from '../components/driverToolsMotion.ts';
import { getDriverSeasonPace, formatLapTime, formatDelta } from '../utils/racePace.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, Tooltip, Legend, Filler);

const ResponsiveAccordionSection = ({ title, children, gridColumn, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ ...glassCard({ padding: 0 }), gridColumn, display: 'flex', flexDirection: 'column' }}>
      <div className="section-header-desktop" style={{ padding: '24px 24px 0', borderBottom: 'none' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontBold, margin: 0 }}>{title}</h3>
      </div>
      <button 
        className="section-header-mobile"
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', padding: '20px 24px', background: 'transparent', border: 'none', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: HUB.textPrimary, fontSize: '16px', fontFamily: HUB.fontBold }}
      >
        {title}
        <span style={{ fontSize: '16px', color: HUB.textMuted }}>{isOpen ? '−' : '+'}</span>
      </button>
      <div className={`section-content ${isOpen ? 'is-open' : ''}`} style={{ padding: '24px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
};


// --- Helpers for Analytics ---
const computeDriverAnalytics = (driverName: string, teamName: string, raceHistory: any[], currentYear: number) => {
  if (!raceHistory || raceHistory.length === 0) return null;
  
  let starts = 0;
  let finishes = 0;
  let wins = 0;
  let podiums = 0;
  let pointsFinishes = 0;
  let dnfs = 0;
  let totalFinishPos = 0;
  let totalGridPos = 0;
  let totalPoints = 0;
  let bestFinish = 99;
  let worstFinish = 0;
  let fastestLaps = 0;
  let gridCount = 0;
  
  const historyData: any[] = [];

  raceHistory.forEach((race: any) => {
    if (race.season !== currentYear) return;
    const dr = race.driverResults?.find((d: any) => d.name === driverName);
    if (!dr) return;
    
    starts++;
    if (race.fastestLap === driverName) fastestLaps++;
    
    if (dr.retired) {
      dnfs++;
    } else {
      finishes++;
      totalFinishPos += dr.finishPos;
      if (dr.finishPos < bestFinish) bestFinish = dr.finishPos;
      if (dr.finishPos > worstFinish) worstFinish = dr.finishPos;
      if (dr.finishPos === 1) wins++;
      if (dr.finishPos <= 3) podiums++;
      if (dr.finishPos <= 10) pointsFinishes++;
    }
    
    totalPoints += (dr.points || 0);
    
    let gPos = dr.gridPos;
    if (gPos) {
      gridCount++;
      totalGridPos += gPos;
    }
    
    historyData.push({
      round: race.round,
      name: race.name,
      finishPos: dr.retired ? 20 : dr.finishPos,
      gridPos: gPos,
      points: dr.points || 0,
      retired: dr.retired
    });
  });

  const avgFinish = finishes > 0 ? totalFinishPos / finishes : 0;
  const avgGrid = gridCount > 0 ? totalGridPos / gridCount : 0;
  
  let positionsGainedAvg = 0;
  if (avgGrid > 0 && avgFinish > 0) {
     positionsGainedAvg = avgGrid - avgFinish;
  }

  return {
    starts, finishes, wins, podiums, pointsFinishes, dnfs,
    bestFinish: bestFinish === 99 ? '-' : bestFinish,
    worstFinish: worstFinish === 0 ? '-' : worstFinish,
    totalPoints, fastestLaps, avgFinish, avgGrid, positionsGainedAvg,
    historyData
  };
};

const getTeamCarRank = (teamName: string) => {
  const allTeams = [(state as any).team, ...((state as any).aiTeams || [])].filter(Boolean);
  allTeams.sort((a, b) => (b.carPerformance || 80) - (a.carPerformance || 80));
  const rank = allTeams.findIndex(t => t.name === teamName) + 1;
  return rank > 0 ? rank : 5; // fallback
};

const generateAIReport = (driver: any, stats: any, extractionDelta: number, pace?: any) => {
  if (!stats || stats.starts === 0) return "Not enough races yet to write a performance report";
  
  const sentences = [];
  
  if (extractionDelta > 2) {
    sentences.push(`${driver.name} is consistently extracting more performance than the car's expected pace.`);
  } else if (extractionDelta < -2) {
    sentences.push(`The driver is currently struggling to extract the maximum potential from the machinery.`);
  } else {
    sentences.push(`${driver.name} is delivering exactly what is expected from the car's performance baseline.`);
  }
  
  if (stats.avgGrid > 0 && stats.positionsGainedAvg > 1.5) {
    sentences.push("Excellent racecraft and tyre management has produced stronger race pace than qualifying pace.");
  } else if (stats.avgGrid > 0 && stats.positionsGainedAvg < -1.5) {
    sentences.push("The driver is losing significant time during the race compared to their starting position.");
  }
  
  if (stats.dnfs >= 3) {
    sentences.push("High incidence of retirements is severely compromising their championship campaign.");
  } else if (stats.starts > 5 && stats.dnfs === 0) {
    sentences.push("Exceptional consistency and mechanical sympathy – zero retirements so far this season.");
  }

  if (driver.quali > driver.pace + 2) {
     sentences.push("Qualifying is a distinct strength, frequently placing the car higher than its true race pace allows.");
  } else if (driver.pace > driver.quali + 2) {
     sentences.push("A Sunday specialist, making up for lackluster qualifying performances with relentless race pace.");
  }

  if (pace) {
    if (pace.avgPaceRank <= 3) sentences.push(`Long-run pace is front-running, averaging P${pace.avgPaceRank.toFixed(1)} on clean laps.`);
    else sentences.push(`On clean laps the car-and-driver package averages P${pace.avgPaceRank.toFixed(1)}, ${pace.avgGapS.toFixed(2)}s a lap off the quickest.`);
    if (pace.conversion != null && pace.conversion > 1) sentences.push("Results are running ahead of raw pace, so strategy and racecraft are adding points.");
    else if (pace.conversion != null && pace.conversion < -1) sentences.push("Results are trailing raw pace; points are being lost to strategy, traffic or incidents.");
    if (pace.teammateRaces >= 2 && pace.teammateMedianDelta != null) {
      const d = pace.teammateMedianDelta;
      sentences.push(d < 0 ? `Quicker than the teammate in ${pace.teammateAhead} of ${pace.teammateRaces} races, by ${Math.abs(d).toFixed(2)}s a lap on median.` : `Slower than the teammate in ${pace.teammateRaces - pace.teammateAhead} of ${pace.teammateRaces} races, by ${d.toFixed(2)}s a lap on median.`);
    }
  }

  return sentences.join(" ");
};

const getDriverForecast = (driver: any, circuitName: string) => {
  const profile = getCircuitProfile(circuitName);
  let score = 0;
  
  if (profile.type === 'Power') score += driver.pace * 0.6 + driver.quali * 0.4;
  else if (profile.type === 'Highspeed') score += driver.pace * 0.5 + driver.consistency * 0.5;
  else if (profile.type === 'Street') score += driver.quali * 0.5 + driver.racecraft * 0.5;
  else if (profile.type === 'Technical') score += driver.pace * 0.4 + driver.consistency * 0.3 + driver.quali * 0.3;
  else score += driver.pace * 0.3 + driver.quali * 0.3 + driver.racecraft * 0.2 + driver.consistency * 0.2;
  
  if (score >= 88) return { label: 'Exceptional', color: HUB.positive };
  if (score >= 80) return { label: 'Strong', color: HUB.textPrimary };
  if (score >= 70) return { label: 'Average', color: HUB.warning };
  return { label: 'Weak', color: HUB.negative };
};

// --- Race pace (from recorded lap times) ---
const ordinalRank = (v: number | null | undefined) => (v == null ? '–' : `P${v}`);

const DriverRacePaceSection = ({ driver, pace, teammate, teammatePace }: any) => {
  const summary = pace?.summary;
  if (!summary) {
    return (
      <ResponsiveAccordionSection title="Race pace" gridColumn="span 12" defaultOpen={true}>
        <div style={{ color: HUB.textMuted, fontSize: '13px' }}>
          No lap-time data yet. Race pace appears after a race where {driver.name} completes enough clean laps.
        </div>
      </ResponsiveAccordionSection>
    );
  }

  const conv = summary.conversion;
  const trendTxt = summary.avgTrend == null ? '–' : `${formatDelta(summary.avgTrend, 3)}s`;
  const kpis = [
    { label: 'Avg pace rank', val: `P${summary.avgPaceRank.toFixed(1)}`, sub: `Best P${summary.bestPaceRank} · fastest ${summary.fastestPaceCount}×` },
    { label: 'Gap to fastest', val: `+${summary.avgGapS.toFixed(3)}s`, sub: `${summary.avgGapPct.toFixed(2)}% per lap` },
    {
      label: 'Pace to result',
      val: conv == null ? '–' : `${conv > 0 ? '+' : ''}${conv.toFixed(1)}`,
      sub: conv == null ? 'No finishes yet' : conv > 0.5 ? 'Finishing above pace' : conv < -0.5 ? 'Finishing below pace' : 'Results match pace',
      color: conv == null ? HUB.textPrimary : conv > 0.5 ? HUB.positive : conv < -0.5 ? HUB.negative : HUB.textPrimary,
    },
    { label: 'Consistency', val: `${summary.avgConsistency}`, sub: 'Lap scatter score / 100' },
    { label: 'Tyre drop-off', val: trendTxt, sub: 'Avg lap-time trend per stint lap' },
    {
      label: 'vs teammate',
      val: summary.teammateRaces ? `${summary.teammateAhead}–${summary.teammateRaces - summary.teammateAhead}` : '–',
      sub: summary.teammateMedianDelta == null ? 'No teammate data' : `${formatDelta(summary.teammateMedianDelta)}s/lap median`,
      color: summary.teammateRaces ? (summary.teammateAhead * 2 > summary.teammateRaces ? HUB.positive : summary.teammateAhead * 2 < summary.teammateRaces ? HUB.negative : HUB.textPrimary) : HUB.textPrimary,
    },
  ];

  const rounds = pace.races.filter((r: any) => r.rankable);
  const mateByRound = new Map((teammatePace?.races || []).filter((r: any) => r.rankable).map((r: any) => [r.round, r]));
  const chartData = {
    labels: rounds.map((r: any) => `R${r.round}`),
    datasets: [
      {
        label: driver.name,
        data: rounds.map((r: any) => r.gapToFastest),
        borderColor: HUB.accent,
        backgroundColor: HUB.accent,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.25,
      },
      ...(teammate ? [{
        label: teammate.name,
        data: rounds.map((r: any) => (mateByRound.get(r.round) as any)?.gapToFastest ?? null),
        borderColor: 'rgba(237,237,237,0.5)',
        backgroundColor: 'rgba(237,237,237,0.5)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
        spanGaps: true,
      }] : []),
    ],
  };
  const maxGap = Math.max(0, ...chartData.datasets.flatMap((d: any) => d.data.filter((v: any) => v != null)));
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, grid: { color: HUB.border }, ticks: { color: HUB.textFaint, callback: (v: any) => `+${Number(v).toFixed(maxGap < 1 ? 2 : 1)}s` }, title: { display: true, text: 'Gap to fastest race pace (s/lap)', color: HUB.textFaint, font: { size: 11 } } },
      x: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint } },
    },
    plugins: {
      legend: { position: 'top', labels: { color: HUB.textMuted } },
      tooltip: { mode: 'index', intersect: false, callbacks: { label: (c: any) => c.parsed.y == null ? null : `${c.dataset.label}: +${c.parsed.y.toFixed(3)}s/lap` } },
    },
  };

  const cols = '48px minmax(150px, 1.6fr) 64px 56px 84px 84px 84px 84px 48px';
  return (
    <ResponsiveAccordionSection title="Race pace" gridColumn="span 12" defaultOpen={true}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {kpis.map(k => (
          <div key={k.label} style={statCell({ padding: '16px' })}>
            <span style={{ display: 'block', fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>{k.label}</span>
            <span style={{ display: 'block', fontSize: '20px', color: k.color || HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>{k.val}</span>
            <span style={{ display: 'block', fontSize: '11px', color: HUB.textMuted, marginTop: '4px' }}>{k.sub}</span>
          </div>
        ))}
      </div>

      <div style={{ height: '260px', marginBottom: '24px' }}>
        <Line data={chartData as any} options={chartOptions} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '760px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '12px', padding: '8px 12px', fontSize: '12px', color: HUB.textFaint, background: HUB.bg, borderRadius: '8px 8px 0 0' }}>
            <div>Round</div><div>Race</div><div>Pace</div><div>Finish</div><div>Median lap</div><div>Gap/lap</div><div>vs mate</div><div>Drop-off</div><div>Cons.</div>
          </div>
          {[...pace.races].reverse().map((r: any) => {
            const conv = r.paceRank && r.finishPos ? r.paceRank - r.finishPos : null;
            return (
              <div key={r.round} style={{ display: 'grid', gridTemplateColumns: cols, gap: '12px', padding: '10px 12px', fontSize: '12px', alignItems: 'center', borderBottom: `1px solid ${HUB.border}`, fontFamily: HUB.fontMono, color: HUB.textPrimary }}>
                <div style={{ color: HUB.textMuted }}>R{r.round}</div>
                <div style={{ fontFamily: HUB.fontRegular, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.name}>{r.name}</div>
                <div>{r.rankable ? <>{ordinalRank(r.paceRank)}<span style={{ color: HUB.textFaint }}>/{r.fieldSize}</span></> : <span style={{ color: HUB.textFaint }}>–</span>}</div>
                <div style={{ color: r.retired ? HUB.negative : conv == null ? HUB.textPrimary : conv > 0 ? HUB.positive : conv < 0 ? HUB.negative : HUB.textPrimary }}>{r.retired ? 'DNF' : ordinalRank(r.finishPos)}</div>
                <div>{formatLapTime(r.median)}</div>
                <div style={{ color: HUB.textMuted }}>{r.rankable ? (r.gapToFastest < 0.0005 ? 'Fastest' : `+${r.gapToFastest.toFixed(3)}s`) : '–'}</div>
                <div style={{ color: r.teammate ? (r.teammate.delta < 0 ? HUB.positive : HUB.negative) : HUB.textFaint }}>{r.teammate ? `${formatDelta(r.teammate.delta)}s` : '–'}</div>
                <div style={{ color: HUB.textMuted }}>{r.trend == null ? '–' : `${formatDelta(r.trend)}s`}</div>
                <div style={{ color: r.consistency >= 75 ? HUB.positive : r.consistency >= 50 ? HUB.warning : HUB.negative }}>{r.consistency}</div>
              </div>
            );
          })}
        </div>
      </div>
      <span style={{ display: 'block', marginTop: '12px', fontSize: '11px', color: HUB.textFaint }}>
        Race pace is the median of clean laps: lap 1, in- and out-laps, safety car laps and laps over 107% are removed. Drop-off is the lap-time trend within each stint (seconds per lap).
      </span>
    </ResponsiveAccordionSection>
  );
};

export const MyDriversPage = ({ root, initialFlashMessage }: { root: HTMLElement, initialFlashMessage: string }) => {
  ensureTeamState((state as any).team);
  
  const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
  const [selectedTab, setSelectedTab] = useState(0); // 0 = Driver 1, 1 = Driver 2, 2 = Reserve
  const [promotionModalOpen, setPromotionModalOpen] = useState(false);
  const [negotiatingDriver, setNegotiatingDriver] = useState<any>(null);
  const [contractDriver, setContractDriver] = useState<any>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [talkMode, setTalkMode] = useState<'renew' | 'salary' | null>(null);
  const [, bump] = useState(0);
  const reduced = usePrefersReducedMotion();

  // --- Handlers ---
  const handleAction = async (action: string, driverName: string) => {
    if (action === 'release') {
      {
        if ((state as any).team.reserveDriver?.name === driverName) {
          (state as any).team.reserveDriver = null;
          setSelectedTab(0);
        } else {
          (state as any).team.drivers = (state as any).team.drivers.filter((d: any) => d.name !== driverName);
          setSelectedTab(0);
        }
        setTeamActiveDrivers((state as any).team, (state as any).team.drivers.map((d: any) => d.name));
        await syncGame();
        setFlashMessage(`Released ${driverName} from their contract`);
      }
    } else if (action === 'demote') {
       if (!(state as any).team.reserveDriver) {
           const driverIndex = (state as any).team.drivers.findIndex((d: any) => d.name === driverName);
           if (driverIndex !== -1) {
               const driver = (state as any).team.drivers[driverIndex];
               (state as any).team.drivers.splice(driverIndex, 1);
               driver.contractType = 'reserve';
               driver.driverRole = 'reserve';
               driver.roleLabel = 'Reserve Driver';
               (state as any).team.reserveDriver = driver;
               setSelectedTab(2);
               setTeamActiveDrivers((state as any).team, (state as any).team.drivers.map((d: any) => d.name));
               await syncGame();
               setFlashMessage(`Demoted ${driverName} to reserve driver`);
           }
       }
    } else if (action === 'promote') {
       if ((state as any).team.reserveDriver?.name === driverName) {
           if ((state as any).team.drivers.length < 2) {
               (state as any).team.promoteReserveToSeat(null, state);
               const reserve = (state as any).team.reserveDriver;
               (state as any).team.reserveDriver = null;
               reserve.contractType = 'race';
               reserve.driverRole = (state as any).team.drivers.length === 0 ? 'lead' : 'second';
               reserve.roleLabel = 'Race Driver';
               (state as any).team.drivers.push(reserve);
               setSelectedTab((state as any).team.drivers.length - 1);
               setTeamActiveDrivers((state as any).team, (state as any).team.drivers.map((d: any) => d.name));
               await syncGame();
               setFlashMessage(`Promoted ${driverName} to a race seat`);
           } else {
               setPromotionModalOpen(true);
           }
       }
    }
  };

  const startNegotiation = (replaceDriverName: string) => {
    const d = (state as any).team.drivers.find((dr: any) => dr.name === replaceDriverName);
    if (d) {
      // Opens the contract builder; "Talk it through instead" falls back to the dialogue negotiation.
      setContractDriver(d);
      setPromotionModalOpen(false);
    }
  };

  // Applies a finished NegotiationSession outcome. `terms` (optional, from the
  // contract builder) replaces the default +20% salary bump with the offered terms.
  const applyNegotiationOutcome = async (driver: any, status: string, terms?: { salary: number; seasons: number }) => {
    if (status === 'CANCELLED') return null;
    const replaceDriverName = driver.name;
    const reserve = (state as any).team.reserveDriver;
    if (!(state as any).team.promoteReserveToSeat(replaceDriverName, state)) return null;
    let message;
    if (status === 'ACCEPTED_RESERVE' || status === 'ACCEPTED_RESERVE_MONEY') {
        driver.contractType = 'reserve';
        driver.driverRole = 'reserve';
        driver.roleLabel = 'Reserve Driver';
        if (terms) {
          driver.salary = terms.salary;
          driver.contractYearsRemaining = terms.seasons;
        } else if (status === 'ACCEPTED_RESERVE_MONEY') {
          driver.salary = Math.round(driver.salary * 1.2);
        }
        (state as any).team.reserveDriver = driver;
        message = `Promoted ${reserve.name} and moved ${replaceDriverName} to reserve`;
    } else {
        message = `Promoted ${reserve.name}. ${replaceDriverName} has left the team`;
    }
    setTeamActiveDrivers((state as any).team, (state as any).team.drivers.map((d: any) => d.name));
    await syncGame();
    return message;
  };

  const handleNegotiationComplete = async (status: string) => {
    if (status === 'CANCELLED') {
      setNegotiatingDriver(null);
      return;
    }
    const message = await applyNegotiationOutcome(negotiatingDriver, status);
    if (message) {
        setFlashMessage(message);
        setNegotiatingDriver(null);
        setSelectedTab(0);
    }
  };

  const sendReserveOffer = async (driver: any, terms: { salary: number; seasons: number }) => {
    const session = runReserveOffer(driver, (state as any).team, terms);
    const accepted = session.status === 'ACCEPTED_RESERVE' || session.status === 'ACCEPTED_RESERVE_MONEY';
    const message = await applyNegotiationOutcome(driver, session.status, terms);
    if (message) setFlashMessage(message);
    return {
      accepted,
      headline: accepted ? `${driver.name} accepted the reserve role.` : `${driver.name} refused and left the team.`,
      reply: session.currentDialogue,
    };
  };

  const sendRenewal = async (driver: any, terms: { salary: number; seasons: number }, kind: 'renew' | 'salary') => {
    const result = runRenewalOffer(state as any, driver, terms, kind);
    await syncGame();
    setFlashMessage(result.headline);
    bump(x => x + 1);
    return result;
  };

  const openGarage = async () => {
    const { renderEngineering } = await import('./engineering.tsx');
    renderEngineering(root);
  };

  // --- Data aggregation ---
  const allDrivers = [
    ...(state as any).team.drivers,
    ...((state as any).team.reserveDriver ? [(state as any).team.reserveDriver] : [])
  ];

  const currentDriver = allDrivers[selectedTab];
  
  const stats = useMemo(() => {
    if (!currentDriver) return null;
    return computeDriverAnalytics(currentDriver.name, (state as any).team.name, (state as any).raceHistory || [], (state as any).season?.year || 1);
  }, [currentDriver, (state as any).raceHistory]);

  const teammate = useMemo(() => {
    if (!currentDriver || currentDriver.driverRole === 'reserve') return null;
    return (state as any).team.drivers.find((d: any) => d.name !== currentDriver.name);
  }, [currentDriver, (state as any).team.drivers]);

  const teammateStats = useMemo(() => {
    if (!teammate) return null;
    return computeDriverAnalytics(teammate.name, (state as any).team.name, (state as any).raceHistory || [], (state as any).season?.year || 1);
  }, [teammate, (state as any).raceHistory]);

  const seasonYear = (state as any).season?.year || 1;
  const driverPace = useMemo(() => currentDriver ? getDriverSeasonPace(currentDriver.name, (state as any).raceHistory || [], seasonYear) : null, [currentDriver, (state as any).raceHistory, seasonYear]);
  const teammatePace = useMemo(() => teammate ? getDriverSeasonPace(teammate.name, (state as any).raceHistory || [], seasonYear) : null, [teammate, (state as any).raceHistory, seasonYear]);

  if (!currentDriver) {
    return (
      <div>
        <div style={{ marginBottom: '32px' }}>
          {pageTitle('My drivers')}
        </div>
        <div style={{...glassCard({padding: '48px'}), textAlign: 'center'}}>
          <h3 style={{color: HUB.textPrimary, fontFamily: HUB.fontBold, fontWeight: 400, fontSize: '18px', margin: 0}}>No drivers on the roster</h3>
        </div>
      </div>
    );
  }

  const roundInfo = getCurrentRound(state as any);
  const circuitFacts = getCircuitFacts(roundInfo.round);
  const isReserve = (state as any).team.reserveDriver?.name === currentDriver.name;
  const surname = currentDriver.name.split(' ').pop();

  // Derived metrics
  const carRank = getTeamCarRank((state as any).team.name);
  const expectedFinish = carRank * 2 - 1; // e.g. Rank 1 = P1/P2 (avg 1.5). Rank 5 = P9/P10 (avg 9.5)
  const extractionDelta = stats ? (expectedFinish - stats.avgFinish) : 0; 
  // Positive delta = outperforming (e.g. expected 9.5, actual 5.0 -> +4.5)

  let extractionStatus = "Average";
  let extractionColor = HUB.warning;
  if (extractionDelta > 1.5) { extractionStatus = "Overperforming"; extractionColor = HUB.positive; }
  else if (extractionDelta < -1.5) { extractionStatus = "Underperforming"; extractionColor = HUB.negative; }

  const aiReport = generateAIReport(currentDriver, stats, extractionDelta, driverPace?.summary);

  // Chart data
  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { 
      y: { reverse: true, min: 1, max: 20, grid: { color: HUB.border }, ticks: { color: HUB.textFaint } },
      x: { grid: { color: HUB.border }, ticks: { color: HUB.textFaint } }
    },
    plugins: { 
      legend: { position: 'top', labels: { color: HUB.textMuted } },
      tooltip: { mode: 'index', intersect: false }
    }
  };

  const activeCalendar: any[] = (state as any).season?.calendar || ALL_CIRCUITS;
  const currentRound = (state as any).season?.round || 1;
  const upcomingRaces = activeCalendar.slice(currentRound - 1, currentRound + 2); // Next 3 races

  const chartData = stats && stats.historyData.length > 0 ? {
    labels: stats.historyData.map(d => `R${d.round}`),
    datasets: [
      {
        label: 'Race finish',
        data: stats.historyData.map(d => d.finishPos),
        borderColor: HUB.accent,
        backgroundColor: HUB.accent,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
      },
      {
        label: 'Grid position',
        data: stats.historyData.map(d => d.gridPos || null),
        borderColor: 'rgba(237,237,237,0.5)',
        backgroundColor: 'rgba(237,237,237,0.5)',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 3,
        tension: 0,
        fill: false,
      }
    ]
  } : null;

  return (
    <div style={{ paddingBottom: '80px', width: '100%' }}>
      
      <div className="dm-head">
        <div>
          {pageTitle('My drivers')}
          {pageSubtitle('Your lineup, how each driver is performing and where their contracts stand')}
        </div>
      </div>

      {flashMessage && <div className="dm-flash" role="status">{flashMessage}</div>}

      <CircuitStage facts={circuitFacts} reduced={reduced} onOpen={() => setCircuitOpen(true)} />

      <div className="dm-root">
        <div className="dm-left">
          <DriverLineup drivers={allDrivers} selected={selectedTab} onSelect={setSelectedTab} />
          <WeekendPanel facts={circuitFacts} roundNo={roundInfo.roundNo} total={roundInfo.total} completed={roundInfo.completed}
            weather={getRoundWeather(state as any, roundInfo.roundNo)} team={(state as any).team}
            teamPos={getTeamChampionshipPosition(state as any, (state as any).team.name)}
            activeProjects={((state as any).engineering?.projects || []).filter((p: any) => p.status === 'active').length}
            onOpenCircuit={() => setCircuitOpen(true)} onGarage={openGarage} />
        </div>

        <DriverHero driver={currentDriver} team={(state as any).team} champPos={getDriverChampionshipPosition(state as any, currentDriver.name)} reduced={reduced} />

        <div className="dm-right">
          <DriverStats driver={currentDriver} teammate={teammate}
            summary={getDriverSeasonSummary(state as any, currentDriver.name)}
            mateSummary={teammate ? getDriverSeasonSummary(state as any, teammate.name) : null} />
          <ContractPanel
            driver={currentDriver}
            isReserve={isReserve}
            reserveTaken={!!(state as any).team.reserveDriver}
            talksClosed={areContractTalksClosed(state as any, currentDriver)}
            onRenew={() => setTalkMode('renew')}
            onSalary={() => setTalkMode('salary')}
            onDetails={() => setDetailsOpen(true)}
            onCompare={() => setCompareOpen(true)}
            onRelease={() => setConfirmSpec({
              title: `Release ${currentDriver.name}?`,
              body: `${currentDriver.name} leaves the team straight away and their $${currentDriver.salary ?? 0}M salary stops. This can't be undone.`,
              confirm: 'Release driver', danger: true,
              run: () => handleAction('release', currentDriver.name),
            })}
            onDemote={() => setConfirmSpec({
              title: `Move ${surname} to reserve?`,
              body: `${currentDriver.name} gives up their race seat and becomes your reserve driver on the same salary. You'll need to fill the empty seat before the next race.`,
              confirm: 'Demote to reserve',
              run: () => handleAction('demote', currentDriver.name),
            })}
            onPromote={() => (state as any).team.drivers.length < 2
              ? setConfirmSpec({
                  title: `Promote ${surname} to a race seat?`,
                  body: `${currentDriver.name} takes the empty race seat.`,
                  confirm: 'Promote',
                  run: () => handleAction('promote', currentDriver.name),
                })
              : handleAction('promote', currentDriver.name)}
          />
        </div>
      </div>

      <div className="dm-below">
      <h3 className="dm-below-title">Detailed analysis</h3>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentDriver.name}
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
      {stats ? (
        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
          
          {/* --- SECTION 3: CAR EXTRACTION INDEX --- */}
          <ResponsiveAccordionSection title="Car extraction" gridColumn="span 4" defaultOpen={true}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', borderRadius: '50%', border: `8px solid ${HUB.raised}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `8px solid ${extractionColor}`, clipPath: `polygon(0 0, 100% 0, 100% ${Math.max(0, 100 - ((extractionDelta + 5) / 10) * 100)}%, 0 ${Math.max(0, 100 - ((extractionDelta + 5) / 10) * 100)}%)`, transition: `border-color 400ms ${HUB.ease}, clip-path 400ms ${HUB.ease}` }}></div>
                 <div style={{ textAlign: 'center', zIndex: 2 }}>
                   <span style={{ display: 'block', fontSize: '32px', color: extractionColor, fontFamily: HUB.fontMono, fontWeight: 400 }}>{extractionDelta > 0 ? '+' : ''}{extractionDelta.toFixed(1)}</span>
                   <span style={{ fontSize: '12px', color: HUB.textMuted }}>positions vs car</span>
                 </div>
              </div>
              
              <div style={{ marginTop: '24px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${HUB.border}` }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Car's expected finish</span>
                  <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>P{expectedFinish.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${HUB.border}` }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Driver avg finish</span>
                  <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>P{stats.avgFinish.toFixed(1)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: HUB.textMuted }}>Status</span>
                  <span style={{ fontSize: '12px', color: extractionColor, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>{extractionStatus}</span>
                </div>
              </div>
            </div>
          </ResponsiveAccordionSection>

          {/* --- SECTION 2: SEASON PERFORMANCE --- */}
          <ResponsiveAccordionSection title="Season performance" gridColumn="span 8" defaultOpen={true}>
             <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
               {[
                 { label: 'Championship pts', val: stats.totalPoints },
                 { label: 'Avg finish', val: `P${stats.avgFinish.toFixed(1)}` },
                 { label: 'Avg grid', val: stats.avgGrid > 0 ? `P${stats.avgGrid.toFixed(1)}` : 'N/A' },
                 { label: 'Places gained / lost', val: stats.avgGrid > 0 ? (stats.positionsGainedAvg > 0 ? `+${stats.positionsGainedAvg.toFixed(1)}` : stats.positionsGainedAvg.toFixed(1)) : 'N/A' },
                 { label: 'Best finish', val: `P${stats.bestFinish}` },
                 { label: 'Podiums', val: stats.podiums },
                 { label: 'Wins', val: stats.wins },
                 { label: 'Fastest laps', val: stats.fastestLaps },
                 { label: 'Points finishes', val: stats.pointsFinishes },
                 { label: 'DNFs', val: stats.dnfs }
               ].map((item, i) => (
                 <div key={i} style={statCell({ padding: '16px' })}>
                   <span style={{ display: 'block', fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>{item.label}</span>
                   <span style={{ fontSize: '22px', color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>{item.val}</span>
                 </div>
               ))}
             </div>
             {stats.avgGrid === 0 && <span style={{display: 'block', marginTop: '16px', fontSize: '11px', color: HUB.textFaint}}>Grid positions aren't recorded for older simulated races</span>}
          </ResponsiveAccordionSection>

          <DriverRacePaceSection driver={currentDriver} pace={driverPace} teammate={teammate} teammatePace={teammatePace} />

          {/* --- SECTION 8: AI PERFORMANCE REPORT --- */}
          <ResponsiveAccordionSection title="Performance report" gridColumn="span 12" defaultOpen={true}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', background: HUB.raised, padding: '16px', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
               <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.textMuted, flexShrink: 0 }}>
                 <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </div>
               <div>
                 <h4 style={{ fontSize: '12px', fontWeight: 400, color: HUB.textFaint, margin: '0 0 8px' }}>Performance department summary</h4>
                 <p style={{ margin: 0, fontSize: '14px', color: HUB.textPrimary, lineHeight: 1.6 }}>{aiReport}</p>
               </div>
            </div>
          </ResponsiveAccordionSection>

          {/* --- SECTION 5: PERFORMANCE TIMELINE --- */}
          <ResponsiveAccordionSection title="Grid and finish by round" gridColumn="span 12">
            <div style={{ height: '300px' }}>
              {chartData ? <Line data={chartData} options={chartOptions} /> : <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: HUB.textMuted}}>No race data yet</div>}
            </div>
          </ResponsiveAccordionSection>

          {/* --- SECTION 7: HEAD TO HEAD --- */}
          <ResponsiveAccordionSection title="Teammate comparison" gridColumn="span 8">
            {teammate && teammateStats ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${HUB.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={getDriverHeadshotUrl(currentDriver)} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    <span style={{ color: HUB.textPrimary, fontSize: '16px', fontFamily: HUB.fontBold }}>{currentDriver.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: HUB.textPrimary, fontSize: '16px', fontFamily: HUB.fontBold }}>{teammate.name}</span>
                    <img src={getDriverHeadshotUrl(teammate)} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Championship points', v1: stats.totalPoints, v2: teammateStats.totalPoints, inv: false },
                    { label: 'Average finish', v1: stats.avgFinish.toFixed(1), v2: teammateStats.avgFinish.toFixed(1), inv: true },
                    { label: 'Race wins', v1: stats.wins, v2: teammateStats.wins, inv: false },
                    { label: 'Podiums', v1: stats.podiums, v2: teammateStats.podiums, inv: false },
                    { label: 'Average grid', v1: stats.avgGrid.toFixed(1), v2: teammateStats.avgGrid.toFixed(1), inv: true },
                    { label: 'DNFs', v1: stats.dnfs, v2: teammateStats.dnfs, inv: true }
                  ].map(stat => {
                     let winner = 0;
                     if (stat.v1 !== stat.v2) {
                       if (stat.inv) { winner = Number(stat.v1) < Number(stat.v2) ? 1 : 2; }
                       else { winner = Number(stat.v1) > Number(stat.v2) ? 1 : 2; }
                     }
                     
                     return (
                       <div key={stat.label} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px', gap: '16px', alignItems: 'center' }}>
                         <span style={{ fontSize: '16px', fontFamily: HUB.fontMono, color: winner === 1 ? HUB.textPrimary : HUB.textMuted, textAlign: 'right' }}>{stat.v1}</span>
                         <span style={{ fontSize: '12px', color: HUB.textFaint, textAlign: 'center' }}>{stat.label}</span>
                         <span style={{ fontSize: '16px', fontFamily: HUB.fontMono, color: winner === 2 ? HUB.textPrimary : HUB.textMuted, textAlign: 'left' }}>{stat.v2}</span>
                       </div>
                     );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: HUB.textMuted }}>No teammate to compare with</div>
            )}
          </ResponsiveAccordionSection>

          {/* --- SECTION 10: UPCOMING RACES FORECAST --- */}
          <ResponsiveAccordionSection title="Upcoming races" gridColumn="span 12">
            {upcomingRaces.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${upcomingRaces.length}, 1fr)`, gap: '16px' }}>
                {upcomingRaces.map((entry: any, i: number) => {
                  // calendar entries are always full objects {name, circuit, country, ...}
                  const raceObj = typeof entry === 'string'
                    ? ALL_CIRCUITS.find(circ => circ.name === entry)
                    : entry;
                  const profile = getCircuitProfile(raceObj?.circuit);
                  const forecast = getDriverForecast(currentDriver, raceObj?.circuit || '');
                  
                  return (
                    <div key={i} style={statCell({ padding: '16px' })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontMono }}>Round {currentRound + i}</span>
                        <span style={{ fontSize: '11px', color: HUB.textMuted }}>{raceObj?.country}</span>
                      </div>
                      <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", margin: '0 0 8px', color: HUB.textPrimary }}>{raceObj?.name}</h4>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <span style={pill(false)}>{profile.type}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${HUB.border}`, paddingTop: '12px' }}>
                        <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '4px' }}>Driver suitability</div>
                        <div style={{ fontSize: '16px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color: forecast.color }}>
                          {forecast.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ color: HUB.textMuted }}>No upcoming races</div>}
          </ResponsiveAccordionSection>

          {/* --- SECTION 11: SEASON HEATMAP --- */}
          <ResponsiveAccordionSection title="Season results" gridColumn="span 12">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
               {stats.historyData.length > 0 ? stats.historyData.map((d, i) => {
                 let bg = HUB.raised; // outside the points
                 if (d.retired) bg = 'rgba(229,72,77,0.22)'; // DNF
                 else if (d.finishPos <= 3) bg = 'rgba(76,195,138,0.28)'; // podium
                 else if (d.finishPos <= 10) bg = 'rgba(237,237,237,0.14)'; // points
                 
                 return (
                   <div key={i} title={`${d.name}: ${d.retired ? 'DNF' : 'P' + d.finishPos}`} style={{
                     width: '40px', height: '40px', borderRadius: '8px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     border: `1px solid ${HUB.border}`
                   }}>
                     <span style={{ fontSize: '11px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{d.retired ? 'DNF' : d.finishPos}</span>
                   </div>
                 );
               }) : <div style={{ color: HUB.textMuted }}>No race data yet</div>}
            </div>
          </ResponsiveAccordionSection>

        </div>
      ) : (
        <div style={{...glassCard({padding: '48px'}), textAlign: 'center', color: HUB.textMuted}}>
          Complete at least one race to see driver analytics
        </div>
      )}
        </motion.div>
      </AnimatePresence>
      </div>

      <CircuitExpanded open={circuitOpen} facts={circuitFacts} reduced={reduced} onClose={() => setCircuitOpen(false)} />
      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
      <ContractDetails driver={detailsOpen ? currentDriver : null} open={detailsOpen} onClose={() => setDetailsOpen(false)} appState={state} />
      {talkMode && (
        <ContractBuilder
          driver={currentDriver}
          mode={talkMode}
          onSend={(terms) => sendRenewal(currentDriver, terms, talkMode)}
          onClose={() => setTalkMode(null)}
        />
      )}

      {/* Promotion Modal */}
      {promotionModalOpen && (state as any).team.reserveDriver && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div style={{ ...glassCard({ padding: '0', maxWidth: '600px', width: '100%' }), overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Replace a race driver</h3>
              </div>
              <button onClick={() => setPromotionModalOpen(false)} className={btnClass('ghost')} style={iconBtn('md')} aria-label="Close" title="Close"><X size={16} strokeWidth={1.5} /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: HUB.textMuted, margin: '0 0 16px', fontSize: '13px' }}>Select which race driver to replace with <strong style={{ color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{(state as any).team.reserveDriver.name}</strong>. The replaced driver will be released.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(state as any).team.drivers.map((d: any) => (
                  <div key={d.name} style={{ ...glassCard({ padding: '16px' }), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '14px', color: HUB.textPrimary, fontFamily: HUB.fontBold }}>{d.name}</span>
                    </div>
                    <button onClick={() => startNegotiation(d.name)} className={btnClass('secondary')} style={btn('secondary', 'sm')}>Replace driver</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Negotiation Modal */}
      {negotiatingDriver && (
        <DriverNegotiationModal 
          driver={negotiatingDriver} 
          team={(state as any).team} 
          onComplete={handleNegotiationComplete}
        />
      )}

      {/* Contract builder for the reserve-role offer */}
      {contractDriver && (
        <ContractBuilder
          driver={contractDriver}
          mode="reserve"
          onSend={(terms) => sendReserveOffer(contractDriver, terms)}
          onClose={() => setContractDriver(null)}
          onDone={() => setSelectedTab(0)}
          onTalk={() => { setNegotiatingDriver(contractDriver); setContractDriver(null); }}
        />
      )}

      {compareOpen && (
        <DriverRadarCompare
          leftName={currentDriver.name}
          rightName={teammate?.name || (state as any).team.reserveDriver?.name}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
};

export function renderMyDrivers(root: HTMLElement, initialFlashMessage = "") {
  mountLayout(root, 'drivers', <MyDriversPage root={root} initialFlashMessage={initialFlashMessage} />, () => renderMyDrivers(root, initialFlashMessage));
}
