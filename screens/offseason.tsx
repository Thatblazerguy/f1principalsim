import React, { useState, useEffect } from 'react';
import { state } from "../state.js";
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { renderDashboard } from "./dashboard.tsx";
import { getTeamRoster, getActiveDrivers, setTeamActiveDrivers, ensureTeamState } from "../utils/teamState.js";
import { rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getRoundRaceDay } from "../utils/seasonTimeline.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { ShieldCheck, TrendingUp, Users, DollarSign, Activity, AlertCircle, ChevronRight, Target, CheckCircle, Zap, Star } from "lucide-react";
import { motion } from 'framer-motion';
import { SlideUp } from '../components/ui/motion.tsx';

function removeDriverFromTeam(team: any, driverName: string) {
  ensureTeamState(team);
  team.drivers = team.drivers.filter((driver: any) => driver.name !== driverName);
  if (team.reserveDriver?.name === driverName) {
    team.reserveDriver = null;
  }
}

function addDriverToTeam(team: any, driver: any) {
  ensureTeamState(team);
  if (team.drivers.length < 2) {
    team.drivers.push(driver);
    return "main";
  }
  if (!team.reserveDriver) {
    team.reserveDriver = driver;
    return "reserve";
  }
  return null;
}

function getAllAssignedDriverNames() {
  const names = new Set();
  if (state.team) {
    getTeamRoster(state.team).forEach((driver: any) => names.add(driver.name));
  }
  state.aiTeams.forEach((team: any) => {
    ensureTeamState(team);
    team.drivers.forEach((driver: any) => names.add(driver.name));
  });
  return names;
}

function findAiTeamByDriver(driverName: string) {
  return state.aiTeams.find((team: any) => team.drivers.some((driver: any) => driver.name === driverName));
}

function getFreeTalentPool(excludedNames = new Set()) {
  const assigned = getAllAssignedDriverNames();
  return drivers.filter((driver: any) => (driver.category === "FREE" || driver.category === "F2") && !assigned.has(driver.name) && !excludedNames.has(driver.name));
}

function getWeightedRandomReplacement(excludedNames = new Set()) {
  const pool = getFreeTalentPool(excludedNames);
  if (!pool.length) return null;
  const weightedPool = pool.flatMap((driver: any) => Array.from({ length: Math.max(1, Math.round(driver.market / 8)) }, () => driver));
  return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

// Keep track of used names when filling multiple seats to avoid duplicates
const globalFillExclusions = new Set();

function fillAiSeat(team: any) {
  if (team.drivers.length >= 2) return;
  const replacement = getWeightedRandomReplacement(globalFillExclusions);
  if (replacement) {
    addDriverToTeam(team, replacement);
    globalFillExclusions.add(replacement.name);
    // Clear the global exclusions after a short delay in case it's needed again
    setTimeout(() => globalFillExclusions.delete(replacement.name), 1000);
  }
}

function getPoachCost(driver: any, oldTeam: any) {
  const baseCost = Math.round(driver.salary * 1.8 + driver.market * 0.18);
  const teamPremium = oldTeam ? Math.max(4, Math.round(oldTeam.carPerformance / 18)) : 0;
  return baseCost + teamPremium;
}

function getPoachChance(driver: any, oldTeam: any) {
  const s = state as any;
  const carDelta = oldTeam ? (s.team!.carPerformance - oldTeam.carPerformance) / 40 : 0;
  const levelBoost = (s.team!.level || 1) * 0.03;
  const marketResistance = driver.market / 180;
  const ageFactor = driver.age >= 32 ? 0.12 : driver.age <= 23 ? -0.05 : 0;
  const chance = 0.42 + carDelta + levelBoost + ageFactor - marketResistance;
  return Math.max(0.18, Math.min(0.82, chance));
}

function getOffseasonCandidates() {
  const playerDrivers = new Set(getTeamRoster(state.team!).map((driver: any) => driver.name));
  const aiDrivers = state.aiTeams.flatMap((team: any) => team.drivers);
  const allAvailableDrivers = drivers.filter((driver: any) => !playerDrivers.has(driver.name));

  return [...aiDrivers, ...allAvailableDrivers]
    .filter((driver: any, index, array) => array.findIndex((entry: any) => entry.name === driver.name) === index)
    .sort((a: any, b: any) => b.market - a.market || b.pace - a.pace);
}

async function startNextSeason(root: HTMLElement, keepSponsors: boolean, setFlashMessage: (msg: string) => void) {
  const s = state as any;
  ensureTeamState(s.team!);
  const roster = getTeamRoster(s.team!);
  if (roster.length < 2) {
    setFlashMessage("You need at least two contracted drivers before starting the next season.");
    return;
  }

  const active = getActiveDrivers(s.team!);
  if (active.length < 2) {
    setTeamActiveDrivers(s.team!, roster.slice(0, 2).map((driver: any) => driver.name));
  }

  if (!keepSponsors) {
    s.team!.sponsorSlots = {}; 
    s.team!.sponsor = null;
  }
  
  rotateSponsorOffers(s);

  const driverStandings = Object.entries(s.standings.drivers || {})
    .sort(([, a]: any, [, b]: any) => b - a);
  
  const totalDrivers = driverStandings.length;
  const allTeams = [s.team!, ...(s.aiTeams || [])];
  
  allTeams.forEach(t => {
    const atrMultiplier = t.atrMultiplier ?? 1.0;
    if (t !== s.team) {
      const aiGrowth = (3 + Math.random() * 3) * atrMultiplier;
      t.carPerformance = parseFloat((t.carPerformance + aiGrowth).toFixed(1));
      const parts = ["aero", "engine", "chassis", "reliability"];
      parts.forEach(p => {
        if (t.car && t.car[p]) {
          const partGrowth = Math.floor(Math.random() * 2) + (atrMultiplier > 1.05 ? 1 : 0);
          t.car[p] += partGrowth;
        }
      });
    }

    const teamDrivers = [...t.drivers, ...(t.reserveDriver ? [t.reserveDriver] : [])];
    teamDrivers.forEach((d: any) => {
      if (typeof d.age === "number") d.age += 1;

      const rankIndex = driverStandings.findIndex(([name]) => name === d.name);
      let ratingChange = 0;

      if (rankIndex !== -1) {
        const percentile = (totalDrivers - rankIndex) / totalDrivers;
        if (percentile > 0.8) ratingChange = 1 + Math.random(); 
        else if (percentile > 0.5) ratingChange = 0.5 + Math.random() * 0.5; 
        else if (percentile < 0.2) ratingChange = -1 - Math.random(); 
        else ratingChange = Math.random() * 0.5 - 0.25; 
      } else {
        ratingChange = -0.5 + Math.random() * 0.5;
      }

      const stats = ["pace", "quali", "racecraft", "tyre", "wet", "consistency"];
      stats.forEach(st => {
        if (typeof d[st] === "number") {
          d[st] = parseFloat(Math.min(99, Math.max(40, d[st] + ratingChange)).toFixed(1));
        }
      });
      
      if (typeof d.market === "number") {
        d.market = parseFloat(Math.min(99, Math.max(10, d.market + ratingChange * 2)).toFixed(1));
      }
    });
  });

  s.season = {
    round: 1,
    year: (s.season.year || 1) + 1,
    totalRounds: s.season.totalRounds || 24,
    currentDay: getRoundRaceDay(1),
  };
  s.notifications = [];
  s.team!.pendingUpgrades = [];
  s.weekendProgress = null;
  s.standings = { drivers: {}, teams: {} };
  s.bestFinishes = {};
  s.driverWins = {};
  s.driverPodiums = {};

  const allDriversInPool = [...drivers];
  const getOvr = (d: any) => Math.round((d.pace + d.quali + d.racecraft + d.consistency) / 4);
  const usedDriverNames = getAllAssignedDriverNames();

  if (s.aiTeams) {
    // First, check and fix any AI teams that have duplicate drivers or drivers on player team
    s.aiTeams.forEach((aiTeam: any) => {
      ensureTeamState(aiTeam);
      // Filter out any drivers already on player team or other AI teams
      aiTeam.drivers = aiTeam.drivers.filter((d: any) => {
        if (usedDriverNames.has(d.name) && !s.team?.drivers.some(pd => pd.name === d.name) && !s.aiTeams.some(at => at !== aiTeam && at.drivers.some(td => td.name === d.name))) {
          // Keep if only in this team
          return true;
        }
        if (!usedDriverNames.has(d.name)) {
          // Add to used and keep
          usedDriverNames.add(d.name);
          return true;
        }
        // Remove if already used elsewhere
        return false;
      });
      // Check reserve driver too
      if (aiTeam.reserveDriver) {
        if (usedDriverNames.has(aiTeam.reserveDriver.name)) {
          aiTeam.reserveDriver = null;
        } else {
          usedDriverNames.add(aiTeam.reserveDriver.name);
        }
      }
    });

    // Now, fill any empty seats with available drivers
    s.aiTeams.forEach((aiTeam: any) => {
      ensureTeamState(aiTeam);
      const availableDrivers = allDriversInPool.filter((d: any) => 
        !usedDriverNames.has(d.name) && (d.category === "FREE" || d.category === "F2")
      ).sort((a: any, b: any) => getOvr(b) - getOvr(a));

      // Fill main seats first
      while (aiTeam.drivers.length < 2 && availableDrivers.length > 0) {
        const newDriver = availableDrivers.shift();
        aiTeam.drivers.push(newDriver);
        usedDriverNames.add(newDriver.name);
      }

      // Fill reserve seat
      if (!aiTeam.reserveDriver && availableDrivers.length > 0) {
        const newReserve = availableDrivers.shift();
        aiTeam.reserveDriver = newReserve;
        usedDriverNames.add(newReserve.name);
      }

      // Optional: Try to upgrade drivers if we have better available
      const available85Plus = availableDrivers.filter(d => getOvr(d) >= 85);
      if (available85Plus.length > 0) {
        const teamDrivers = [...aiTeam.drivers];
        teamDrivers.sort((a, b) => getOvr(a) - getOvr(b));
        const weakest = teamDrivers[0];
        if (weakest && getOvr(available85Plus[0]) > getOvr(weakest) + 2) {
          // Replace weakest driver with better available one
          aiTeam.drivers = aiTeam.drivers.filter(d => d.name !== weakest.name);
          usedDriverNames.delete(weakest.name);
          aiTeam.drivers.push(available85Plus[0]);
          usedDriverNames.add(available85Plus[0].name);
        }
      }
    });
  }

  // AI driver swaps (disabled for now to prevent duplicates, can re-enable with proper checks later)
  /*
  if (s.aiTeams && s.aiTeams.length > 1) {
    s.aiTeams.forEach((aiTeam: any, idx: number) => {
      if (Math.random() < 0.15) { 
        const otherTeamIdx = (idx + Math.floor(Math.random() * (s.aiTeams.length - 1)) + 1) % s.aiTeams.length;
        const otherTeam = s.aiTeams[otherTeamIdx];
        
        if (otherTeam && otherTeam.drivers && aiTeam.drivers) {
          const myDriver = aiTeam.drivers[Math.floor(Math.random() * aiTeam.drivers.length)];
          const theirDriver = otherTeam.drivers[Math.floor(Math.random() * otherTeam.drivers.length)];

          if (myDriver && theirDriver && Math.abs(getOvr(myDriver) - getOvr(theirDriver)) < 5) {
            aiTeam.drivers = aiTeam.drivers.map((d: any) => d.name === myDriver.name ? theirDriver : d);
            otherTeam.drivers = otherTeam.drivers.map((d: any) => d.name === theirDriver.name ? myDriver : d);
          }
        }
      }
    });
  }
  */
  
  import('../game/development.js').then(({ processSeasonDevelopment }) => {
     processSeasonDevelopment(s);
  }).catch(err => console.error("Failed to process academy development", err));

  await syncGame();
  renderDashboard(root);
}

const PRIZE_MONEY = [68.0, 58.0, 50.0, 43.0, 37.0, 31.0, 25.0, 20.0, 15.0, 10.0];
const TV_RIGHTS_SHARE = [33.0, 28.6, 26.4, 24.2, 22.0, 19.8, 17.6, 15.4, 13.2, 11.0];
const ATR_MULTIPLIERS = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15];

export function processEndofSeasonFinancials(s: any) {
  const teamList = [s.team!, ...(s.aiTeams || [])];
  const points = (tName: string) => s.standings.teams?.[tName] ?? 0;
  teamList.sort((a, b) => points(b.name) - points(a.name));

  let playerReport = null;
  const alreadyProcessed = s.season.reportProcessed === s.season.year;

  teamList.forEach((team, index) => {
    const pos = index + 1;
    const prize = PRIZE_MONEY[index] ?? 10.0;
    const tvRights = TV_RIGHTS_SHARE[index] ?? 11.0;
    const atrMultiplier = ATR_MULTIPLIERS[index] ?? 1.0;

    team.atrMultiplier = atrMultiplier;

    if (!alreadyProcessed) {
      team.budget = parseFloat((team.budget + prize + tvRights).toFixed(1));
    }

    if (team.name === s.team!.name) {
      let sponsorTotal = 0;
      const sponsorDetails: any[] = [];
      const SPONSOR_SLOTS = [
        { key: "title", label: "Title Sponsor" },
        { key: "kit", label: "Kit Sponsor" },
        { key: "sidepod", label: "Sidepod Sponsor" },
        { key: "rearWing", label: "Rear Wing Sponsor" },
        { key: "halo", label: "Halo Sponsor" }
      ];
      SPONSOR_SLOTS.forEach(slot => {
        const sponsor = s.team!.sponsorSlots?.[slot.key];
        if (sponsor) {
          const payout = parseFloat(((sponsor.monthlyIncome || 0) * 5 + (sponsor.performanceBonus || 0) * ((sponsor.relationshipLevel || 100) / 100) * 2).toFixed(1));
          sponsorTotal += payout;
          sponsorDetails.push({ name: sponsor.name, slot: slot.label, payout });
          if (!alreadyProcessed) {
            s.team!.budget = parseFloat((s.team!.budget + payout).toFixed(1));
          }
        }
      });

      // Calculate performance evaluation
      const sortedByCar = [...teamList].sort((a, b) => b.carPerformance - a.carPerformance);
      const carRank = sortedByCar.findIndex(t => t.name === s.team!.name) + 1;
      let performanceEvaluation = "Met Expectations";
      if (pos < carRank) {
        performanceEvaluation = "Overperformed Projected";
      } else if (pos > carRank) {
        performanceEvaluation = "Underperformed Projected";
      }

      playerReport = {
        position: pos,
        carRank,
        performanceEvaluation,
        prize,
        tvRights,
        atrMultiplier,
        sponsorTotal,
        sponsorDetails
      };
    }
  });

  if (!alreadyProcessed) {
    s.season.reportProcessed = s.season.year;
    syncGame();
  }

  return playerReport;
}

// UI Components
export function renderOffseason(root: HTMLElement, initialFlashMessage = "") {
  ensureTeamState(state.team!);

  const OffseasonPage = () => {
    const s = state as any;
    const [view, setView] = useState<'report' | 'headquarters'>('report');
    const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
    const [keepSponsors, setKeepSponsors] = useState<boolean | null>(null);
    const [rosterTick, setRosterTick] = useState(0);

    const roster = getTeamRoster(s.team!);
    const active = getActiveDrivers(s.team!);
    const candidates = getOffseasonCandidates();

    const getOvr = (d: any) => Math.round((d.pace + d.quali + d.racecraft + d.consistency) / 4);

    // AI Scout Reports Generator
    const getScoutReport = (d: any) => {
       const notes = [];
       if (d.quali > 85) notes.push("Exceptional single-lap qualifying pace.");
       if (d.wet > 85) notes.push("Masterful wet-weather driving ability.");
       if (d.racecraft > 85) notes.push("Outstanding racecraft and overtaking capability.");
       if (d.age > 33) notes.push("Late career decline expected soon.");
       else if (d.age < 24 && getOvr(d) > 80) notes.push("Future World Champion prospect.");
       if (d.tyre < 70) notes.push("Struggles with tyre management on long stints.");
       return notes.length > 0 ? notes : ["Solid, reliable midfielder."];
    };

    // Scouting Recommendation Stars
    const getScoutStars = (d: any) => {
       const ovr = getOvr(d);
       if (ovr >= 88) return 5;
       if (ovr >= 82) return 4;
       if (ovr >= 75) return 3;
       if (ovr >= 65) return 2;
       return 1;
    };

    // Derived Season Review Stats
    const sortedTeams = Object.entries(s.standings.teams || {}).sort((a: any, b: any) => b[1] - a[1]);
    const constPos = sortedTeams.findIndex(t => t[0] === s.team!.name) + 1;
    const teamPts = s.standings.teams[s.team!.name] || 0;
    
    // Sort AI teams by car level to determine expected finish
    const sortedAiByCar = [...s.aiTeams].sort((a, b) => b.carPerformance - a.carPerformance);
    const myCarRank = sortedAiByCar.filter(a => a.carPerformance > s.team!.carPerformance).length + 1;
    
    let seasonGrade = "C";
    if (constPos === 0) { seasonGrade = "N/A"; }
    else if (constPos < myCarRank) seasonGrade = "A+";
    else if (constPos === myCarRank) seasonGrade = constPos <= 3 ? "A" : "B";
    else if (constPos - myCarRank === 1) seasonGrade = "C";
    else seasonGrade = "D";

    // Engineer Review
    const upgradeCount = s.team!.upgradeHistory?.length || 0;
    const upgradeEfficiency = upgradeCount > 5 ? "Excellent" : upgradeCount > 2 ? "Average" : "Poor";
    const aeroReadiness = s.team!.car?.aero > 70 ? "Strong" : "Requires Focus";

    // AI Advisor Notes
    const advisorNotes = [];
    if (roster.length < 2) advisorNotes.push("URGENT: We must sign a second driver to comply with regulations.");
    if (s.team!.budget > 50) advisorNotes.push("Finances are extremely healthy. We can afford a blockbuster signing.");
    else if (s.team!.budget < 10) advisorNotes.push("Budget is dangerously low. R&D next season will be severely restricted.");
    
    const teamPaceAvg = roster.reduce((acc: number, d: any) => acc + d.pace, 0) / (roster.length || 1);
    const teamTyreAvg = roster.reduce((acc: number, d: any) => acc + d.tyre, 0) / (roster.length || 1);
    if (teamTyreAvg < 75) advisorNotes.push("Our driver lineup's biggest weakness remains tyre degradation.");
    if (teamPaceAvg > 85) advisorNotes.push("We possess one of the strongest driver pairings on the grid.");

    const handleRelease = async (driverName: string) => {
      removeDriverFromTeam(s.team!, driverName);
      setTeamActiveDrivers(s.team!, getTeamRoster(s.team!).slice(0, 2).map((driver: any) => driver.name));
      await syncGame();
      setFlashMessage(`${driverName} has been released from the squad.`);
      setRosterTick(t => t + 1);
    };

    const handleSign = async (driver: any) => {
      if (getTeamRoster(s.team!).length >= 3) {
        setFlashMessage("Your roster is already full.");
        return;
      }
      const oldTeam = findAiTeamByDriver(driver.name);
      const moveCost = oldTeam ? getPoachCost(driver, oldTeam) : driver.salary;
      if (s.team!.budget < moveCost) {
        setFlashMessage(`You need $${moveCost}M to sign ${driver.name}.`);
        return;
      }

      if (oldTeam) {
        const poachChance = getPoachChance(driver, oldTeam);
        if (Math.random() > poachChance) {
          setFlashMessage(`${driver.name} rejected the approach and chose to stay at ${oldTeam.name}.`);
          return;
        }
        removeDriverFromTeam(oldTeam, driver.name);
        fillAiSeat(oldTeam);
      }

      s.team!.budget = parseFloat((s.team!.budget - moveCost).toFixed(1));
      addDriverToTeam(s.team!, driver);
      setTeamActiveDrivers(s.team!, getTeamRoster(s.team!).slice(0, 2).map((entry: any) => entry.name));
      await syncGame();
      setFlashMessage(oldTeam
        ? `${driver.name} has joined from ${oldTeam.name} for $${moveCost}M. Their former team signed a replacement from the talent pool.`
        : `${driver.name} has joined your team for $${moveCost}M.`);
      setRosterTick(t => t + 1);
    };

    const isChecklistComplete = roster.length >= 2 && keepSponsors !== null;

    if (view === 'report') {
      const report = processEndofSeasonFinancials(s);
      if (!report) return <div style={{ color: '#fff', padding: '40px', fontFamily: HUB.fontSans }}>Generating end-of-season audit...</div>;

      const totalPayout = report.prize + report.tvRights + report.sponsorTotal;

      return (
        <div style={{ paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '40px' }}>
            {sectionLabel('Season Overview')}
            {pageTitle(`Season ${s.season.year || 1} Financial & Performance Report`)}
            {pageSubtitle('Detailed audit of constructors standings, team performance, F1 TV shares, and sponsor payouts.')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Card 1: Performance Evaluation */}
            <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={16} color={HUB.accent} /> Car Performance Audit
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: HUB.textMuted }}>Constructor Finish</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>P{report.position}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: HUB.textMuted }}>Expected Performance Rank</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>P{report.carRank}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: HUB.textMuted }}>Overall Assessment</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: report.performanceEvaluation.includes('Overperformed') ? '#10b981' : 
                           report.performanceEvaluation.includes('Underperformed') ? '#ef4444' : '#f59e0b'
                  }}>
                    {report.performanceEvaluation}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: ATR Handicap */}
            <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#3b82f6" /> Aerodynamic Testing Handicap (ATR)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: HUB.textMuted }}>Wind Tunnel & CFD Allocation</span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>{Math.round(report.atrMultiplier * 100)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: HUB.textMuted }}>R&D Development Rate Modifier</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: report.atrMultiplier > 1.0 ? '#10b981' : report.atrMultiplier < 1.0 ? '#ef4444' : '#fff'
                  }}>
                    {report.atrMultiplier >= 1.0 ? `+${Math.round((report.atrMultiplier - 1.0) * 100)}%` : `-${Math.round((1.0 - report.atrMultiplier) * 100)}%`}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0, lineHeight: 1.4 }}>
                  *Note: Under FIA regulations, lower-placed teams receive higher testing allocations to enable field convergence.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Financial summary */}
          <div style={{ ...glassCard({ padding: '32px' }), marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="#10b981" /> Financial Credits Summary (Season payouts credited to all teams)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', display: 'block' }}>F1 TV Rights Share</span>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>Distribution based on team presence and standings (All Teams)</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: HUB.fontMono, color: '#10b981' }}>+${report.tvRights.toFixed(1)}M</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', display: 'block' }}>Constructor Prize Money</span>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>Based on final Constructor standing (P{report.position}) (All Teams)</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: HUB.fontMono, color: '#10b981' }}>+${report.prize.toFixed(1)}M</span>
              </div>

              {report.sponsorDetails.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', display: 'block' }}>Sponsor Renewal Payouts</span>
                      <span style={{ fontSize: '11px', color: HUB.textMuted }}>Loyalty bonuses and target payouts based on contract satisfaction</span>
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: HUB.fontMono, color: '#10b981' }}>+${report.sponsorTotal.toFixed(1)}M</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                    {report.sponsorDetails.map((sp: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: HUB.textMuted }}>{sp.slot}: {sp.name}</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>+${sp.payout.toFixed(1)}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>Total Seasonal Payout Credits</span>
                <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: HUB.fontMono, color: '#10b981' }}>+${totalPayout.toFixed(1)}M</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setView('headquarters')}
            style={{ ...actionBtn({ width: '100%', padding: '20px 32px', fontSize: '16px' }) }}
          >
            PROCEED TO OFF-SEASON HEADQUARTERS
          </button>
        </div>
      );
    }

    return (
      <div style={{ paddingBottom: '80px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {sectionLabel('Season Transition')}
            {pageTitle('Off-Season Headquarters')}
            {pageSubtitle(`Review your performance and rebuild the team for Season ${(s.season.year || 1) + 1}.`)}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={statCell()}>{statLabel('Available Budget')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', color: s.team!.budget > 20 ? '#10b981' : '#f59e0b', fontSize:'18px', fontWeight:800}}>{statValue(`$${(s.team!.budget || 0).toFixed(1)}M`)}</span></div>
          </div>
        </div>

        {flashMessage && (
          <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 1000, maxWidth: '400px' }}>
            <SlideUp>
              <div style={{ ...glassCard({ padding: '16px' }), borderLeft: `4px solid ${HUB.accent}`, display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                <AlertCircle size={18} color={HUB.accent} style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '14px', color: '#fff', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{flashMessage}</p>
              </div>
            </SlideUp>
          </div>
        )}

        {/* --- SECTION 1: SEASON REVIEW & AI ADVISOR --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '40px' }}>
           
           {/* Season Review Hero */}
           <div style={{ ...glassCard({ padding: '32px' }), background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.5) 100%)', position: 'relative', overflow: 'hidden' }}>
             <h3 style={{ fontSize: '12px', fontWeight: 800, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={16} /> Season {(s.season.year || 1)} Review</h3>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
               <div>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Season Grade</span>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: seasonGrade.includes('A') ? '#10b981' : seasonGrade === 'B' ? '#3b82f6' : '#ef4444' }}>{seasonGrade}</span>
               </div>
               <div>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Constructors</span>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono }}>{constPos > 0 ? `P${constPos}` : '-'}</span>
               </div>
               <div>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Total Points</span>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono }}>{teamPts}</span>
               </div>
               <div>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, textTransform: 'uppercase', display: 'block' }}>Car Dev Rank</span>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono }}>{myCarRank}</span>
               </div>
             </div>

             <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05, pointerEvents: 'none' }}>
                <Target size={200} />
             </div>
           </div>

           {/* AI Advisor Panel */}
           <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column' }}>
             <h3 style={{ fontSize: '12px', fontWeight: 800, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} /> AI Board Advisor</h3>
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {advisorNotes.map((note, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <ChevronRight size={14} color={HUB.accent} style={{ marginTop: '3px', flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', color: '#e5e7eb', margin: 0, lineHeight: 1.4 }}>{note}</p>
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* --- SECTION 2: TEAM SUMMARY & ENGINEERING --- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', marginBottom: '40px' }}>
          
          <div style={{ gridColumn: 'span 8' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={20} /> Driver Roster</h3>
            {roster.length === 0 && <p style={{ fontSize: '14px', color: HUB.textMuted }}>No drivers currently contracted.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {roster.map((driver: any) => {
                const ovr = getOvr(driver);
                return (
                  <div key={driver.name} style={{ ...glassCard({ padding: '20px' }), display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '24px', alignItems: 'center' }}>
                    <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${HUB.border}` }} loading="lazy" />
                    
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>{driver.name}</h4>
                        <span style={{ ...pill(true), padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.1)' }}>Age {driver.age}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase' }}>Salary</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>$${driver.salary}M</span></div>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase' }}>Market Value</span><span style={{ fontSize: '14px', color: '#10b981', fontWeight: 700, fontFamily: HUB.fontMono }}>$${driver.market}M</span></div>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase' }}>Role</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700 }}>{active.find(d => d.name === driver.name) ? 'Active' : 'Reserve'}</span></div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'center' }}>
                         <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>OVR</span>
                         <span style={{ fontSize: '28px', color: '#fff', fontWeight: 900, fontFamily: HUB.fontMono }}>{ovr}</span>
                      </div>
                      <button onClick={() => handleRelease(driver.name)} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }) }}>Release</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ ...glassCard({ padding: '24px' }) }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} /> Engineering Review</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Car Performance Rating</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>{s.team!.carPerformance}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Season Upgrades Applied</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>{upgradeCount}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>R&D Efficiency</span><span style={{ fontSize: '13px', color: upgradeEfficiency === 'Excellent' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{upgradeEfficiency}</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Aero Platform</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>{aeroReadiness}</span></div>
              </div>
            </div>

            <div style={{ ...glassCard({ padding: '24px' }) }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><DollarSign size={16} /> Financial Overview</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Current Budget</span><span style={{ fontSize: '13px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono }}>$${s.team!.budget.toFixed(1)}M</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Driver Salary Drain</span><span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 700, fontFamily: HUB.fontMono }}>-$${roster.reduce((sum: number, d: any) => sum + d.salary, 0)}M</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', color: HUB.textMuted }}>Sponsor Income Projection</span><span style={{ fontSize: '13px', color: '#10b981', fontWeight: 700 }}>High</span></div>
              </div>
            </div>
          </div>

        </div>

        {/* --- SECTION 3: TRANSFER MARKET SCOUTING --- */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={20} /> Global Scouting Network</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
            {candidates.map((driver: any) => {
              const currentTeam = findAiTeamByDriver(driver.name);
              const rosterFull = roster.length >= 3;
              const poachCost = currentTeam ? getPoachCost(driver, currentTeam) : driver.salary;
              const canAfford = s.team!.budget >= poachCost;
              const ovr = getOvr(driver);
              const stars = getScoutStars(driver);
              const reportNotes = getScoutReport(driver);

              return (
                <div key={driver.name} style={{ ...glassCard({ padding: '20px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                     <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                        <div>
                           <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#fff', margin: '0 0 2px' }}>{driver.name}</h4>
                           <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{currentTeam ? `At ${currentTeam.name}` : "Free Agent"} • Age {driver.age}</p>
                        </div>
                     </div>
                     <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900, color: '#fff', fontFamily: HUB.fontMono, display: 'block' }}>{ovr}</span>
                        <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                          {Array.from({length: 5}).map((_, i) => (
                             <Star key={i} size={10} color={i < stars ? '#f59e0b' : 'rgba(255,255,255,0.1)'} fill={i < stars ? '#f59e0b' : 'transparent'} />
                          ))}
                        </div>
                     </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px' }}>
                     <p style={{ fontSize: '10px', color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px', fontWeight: 700 }}>Scout Report</p>
                     <ul style={{ margin: 0, paddingLeft: '16px', color: '#e5e7eb', fontSize: '12px', lineHeight: 1.4 }}>
                       {reportNotes.map((note, i) => <li key={i} style={{ marginBottom: '4px' }}>{note}</li>)}
                     </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                     <div>
                        <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', textTransform: 'uppercase' }}>Transfer Fee</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: canAfford ? '#fff' : '#ef4444', fontFamily: HUB.fontMono }}>$${poachCost}M</span>
                     </div>
                     <button onClick={() => handleSign(driver)} disabled={rosterFull || !canAfford} style={{ ...actionBtn({ padding: '8px 16px', fontSize: '12px', backgroundColor: (rosterFull || !canAfford) ? 'rgba(255,255,255,0.05)' : HUB.accent }), opacity: (rosterFull || !canAfford) ? 0.5 : 1, cursor: (rosterFull || !canAfford) ? 'not-allowed' : 'pointer' }}>
                       {rosterFull ? 'Roster Full' : !canAfford ? 'Cannot Afford' : 'Sign Driver'}
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- SECTION 4: PRE-SEASON CHECKLIST & LAUNCH --- */}
        <div style={{ ...glassCard({ padding: '32px' }), background: 'rgba(255,255,255,0.02)' }}>
           <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={20} /> Pre-Season Checklist</h3>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
             
             {/* Checklist Item: Drivers */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: roster.length >= 2 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${roster.length >= 2 ? '#10b981' : '#ef4444'}`, borderRadius: '8px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 {roster.length >= 2 ? <CheckCircle size={20} color="#10b981" /> : <AlertCircle size={20} color="#ef4444" />}
                 <div>
                   <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Driver Lineup Completed</h4>
                   <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>You must have at least 2 drivers contracted to race.</p>
                 </div>
               </div>
               <span style={{ fontSize: '14px', fontWeight: 700, color: roster.length >= 2 ? '#10b981' : '#ef4444' }}>{roster.length}/2</span>
             </div>

             {/* Checklist Item: Sponsors */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: keepSponsors !== null ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${keepSponsors !== null ? '#10b981' : HUB.border}`, borderRadius: '8px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 {keepSponsors !== null ? <CheckCircle size={20} color="#10b981" /> : <AlertCircle size={20} color={HUB.textMuted} />}
                 <div>
                   <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Sponsor Obligations</h4>
                   <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>Decide to keep current sponsors or seek new partners.</p>
                 </div>
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button onClick={() => setKeepSponsors(true)} style={{ ...actionBtn({ padding: '6px 12px', fontSize: '12px', backgroundColor: keepSponsors === true ? HUB.accent : 'rgba(255,255,255,0.05)', border: keepSponsors === true ? `1px solid ${HUB.accent}` : '1px solid transparent' }) }}>Keep Current</button>
                 <button onClick={() => setKeepSponsors(false)} style={{ ...actionBtn({ padding: '6px 12px', fontSize: '12px', backgroundColor: keepSponsors === false ? HUB.accent : 'rgba(255,255,255,0.05)', border: keepSponsors === false ? `1px solid ${HUB.accent}` : '1px solid transparent' }) }}>Seek New</button>
               </div>
             </div>

             {/* Checklist Item: Budget */}
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: s.team!.budget >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${s.team!.budget >= 0 ? '#10b981' : '#ef4444'}`, borderRadius: '8px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 {s.team!.budget >= 0 ? <CheckCircle size={20} color="#10b981" /> : <AlertCircle size={20} color="#ef4444" />}
                 <div>
                   <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Budget Approval</h4>
                   <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>Ensure the team is not in debt before the season starts.</p>
                 </div>
               </div>
               <span style={{ fontSize: '14px', fontWeight: 700, color: s.team!.budget >= 0 ? '#10b981' : '#ef4444', fontFamily: HUB.fontMono }}>$${s.team!.budget.toFixed(1)}M</span>
             </div>

           </div>

           <button 
             onClick={() => startNextSeason(root, keepSponsors!, setFlashMessage)} 
             disabled={!isChecklistComplete || s.team!.budget < 0}
             style={{ 
               ...actionBtn({ padding: '20px 32px', fontSize: '16px', width: '100%', backgroundColor: (isChecklistComplete && s.team!.budget >= 0) ? HUB.accent : 'rgba(255,255,255,0.05)' }), 
               opacity: (isChecklistComplete && s.team!.budget >= 0) ? 1 : 0.5,
               cursor: (isChecklistComplete && s.team!.budget >= 0) ? 'pointer' : 'not-allowed'
             }}>
             BEGIN NEXT SEASON
           </button>
        </div>
      </div>
    );
  };

  mountLayout(root, 'offseason', <OffseasonPage />, () => renderOffseason(root, initialFlashMessage));
}
