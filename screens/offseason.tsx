import React, { useState } from 'react';
import { state } from "../state.js";
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { renderDashboard } from "./dashboard.tsx";
import { getTeamRoster, getActiveDrivers, setTeamActiveDrivers, ensureTeamState } from "../utils/teamState.js";
import { rotateSponsorOffers } from "../utils/sponsorDeals.js";
import { syncGame } from "../lib/supabaseApi.js";
import { getRoundRaceDay } from "../utils/seasonTimeline.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';

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
  return drivers
    .filter(driver => (driver.category === "FREE" || driver.category === "F2") && !assigned.has(driver.name) && !excludedNames.has(driver.name));
}

function getWeightedRandomReplacement(excludedNames = new Set()) {
  const pool = getFreeTalentPool(excludedNames);
  if (!pool.length) return null;

  const weightedPool = pool.flatMap(driver => Array.from({ length: Math.max(1, Math.round(driver.market / 8)) }, () => driver));
  return weightedPool[Math.floor(Math.random() * weightedPool.length)];
}

function fillAiSeat(team: any) {
  if (team.drivers.length >= 2) return;
  const replacement = getWeightedRandomReplacement();
  if (replacement) {
    addDriverToTeam(team, replacement);
  }
}

function getPoachCost(driver: any, oldTeam: any) {
  const baseCost = Math.round(driver.salary * 1.8 + driver.market * 0.18);
  const teamPremium = oldTeam ? Math.max(4, Math.round(oldTeam.carPerformance / 18)) : 0;
  return baseCost + teamPremium;
}

function getPoachChance(driver: any, oldTeam: any) {
  const carDelta = oldTeam ? (state.team!.carPerformance - oldTeam.carPerformance) / 40 : 0;
  const levelBoost = (state.team!.level || 1) * 0.03;
  const marketResistance = driver.market / 180;
  const ageFactor = driver.age >= 32 ? 0.12 : driver.age <= 23 ? -0.05 : 0;
  const chance = 0.42 + carDelta + levelBoost + ageFactor - marketResistance;
  return Math.max(0.18, Math.min(0.82, chance));
}

function getOffseasonCandidates() {
  const playerDrivers = new Set(getTeamRoster(state.team!).map((driver: any) => driver.name));
  const aiDrivers = state.aiTeams.flatMap((team: any) => team.drivers);
  
  const allAvailableDrivers = drivers.filter(driver => !playerDrivers.has(driver.name));

  return [...aiDrivers, ...allAvailableDrivers]
    .filter((driver, index, array) => array.findIndex(entry => entry.name === driver.name) === index)
    .sort((a, b) => b.market - a.market || b.pace - a.pace);
}

async function startNextSeason(root: HTMLElement, keepSponsors: boolean, setFlashMessage: (msg: string) => void) {
  ensureTeamState(state.team!);
  const roster = getTeamRoster(state.team!);
  if (roster.length < 2) {
    setFlashMessage("You need at least two contracted drivers before starting the next season.");
    return;
  }

  const active = getActiveDrivers(state.team!);
  if (active.length < 2) {
    setTeamActiveDrivers(state.team!, roster.slice(0, 2).map((driver: any) => driver.name));
  }

  if (!keepSponsors) {
    state.team!.sponsorSlots = {}; 
    state.team!.sponsor = null;
  }
  
  rotateSponsorOffers(state);

  const driverStandings = Object.entries(state.standings.drivers || {})
    .sort(([, a]: any, [, b]: any) => b - a);
  
  const totalDrivers = driverStandings.length;
  const allTeams = [state.team!, ...(state.aiTeams || [])];
  
  allTeams.forEach(t => {
    if (t !== state.team) {
      const aiGrowth = 3 + Math.random() * 3;
      t.carPerformance = parseFloat((t.carPerformance + aiGrowth).toFixed(1));
      const parts = ["aero", "engine", "chassis", "reliability"];
      parts.forEach(p => {
        if (t.car && t.car[p]) t.car[p] += Math.floor(Math.random() * 2);
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
      stats.forEach(s => {
        if (typeof d[s] === "number") {
          d[s] = parseFloat(Math.min(99, Math.max(40, d[s] + ratingChange)).toFixed(1));
        }
      });
      
      if (typeof d.market === "number") {
        d.market = parseFloat(Math.min(99, Math.max(10, d.market + ratingChange * 2)).toFixed(1));
      }
    });
  });

  state.season = {
    round: 1,
    year: (state.season.year || 1) + 1,
    totalRounds: state.season.totalRounds || 24,
    currentDay: getRoundRaceDay(1),
  };
  state.notifications = [];
  state.team!.pendingUpgrades = [];
  state.weekendProgress = null;
  state.standings = { drivers: {}, teams: {} };
  state.bestFinishes = {};

  const allDriversInPool = [...drivers];
  const getOvr = (d: any) => Math.round((d.pace + d.quali + d.racecraft + d.consistency) / 4);

  if (state.aiTeams) {
    state.aiTeams.forEach((aiTeam: any) => {
      ensureTeamState(aiTeam);
      const isEmployed = (name: string) => getAllAssignedDriverNames().has(name);
      const available85Plus = allDriversInPool.filter(d => 
        getOvr(d) >= 85 && !isEmployed(d.name)
      ).sort((a, b) => getOvr(b) - getOvr(a));

      if (available85Plus.length > 0) {
        const teamDrivers = [...aiTeam.drivers];
        teamDrivers.sort((a, b) => getOvr(a) - getOvr(b));
        const weakest = teamDrivers[0];

        if (weakest && getOvr(available85Plus[0]) > getOvr(weakest) + 2) {
          aiTeam.drivers = aiTeam.drivers.filter((d: any) => d.name !== weakest.name);
          aiTeam.drivers.push(available85Plus[0]);
        }
      }
    });
  }

  if (state.aiTeams && state.aiTeams.length > 1) {
    state.aiTeams.forEach((aiTeam: any, idx: number) => {
      if (Math.random() < 0.15) { 
        const otherTeamIdx = (idx + Math.floor(Math.random() * (state.aiTeams.length - 1)) + 1) % state.aiTeams.length;
        const otherTeam = state.aiTeams[otherTeamIdx];
        
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
  
  import('../game/development.js').then(({ processSeasonDevelopment }) => {
     processSeasonDevelopment(state);
  }).catch(err => console.error("Failed to process academy development", err));

  await syncGame();
  renderDashboard(root);
}

export function renderOffseason(root: HTMLElement, initialFlashMessage = "") {
  ensureTeamState(state.team!);

  const OffseasonPage = () => {
    const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
    const [keepSponsors, setKeepSponsors] = useState(true);
    
    // For re-renders
    const [rosterTick, setRosterTick] = useState(0);

    const roster = getTeamRoster(state.team!);
    const active = getActiveDrivers(state.team!);
    const candidates = getOffseasonCandidates();

    const handleRelease = async (driverName: string) => {
      removeDriverFromTeam(state.team!, driverName);
      setTeamActiveDrivers(state.team!, getTeamRoster(state.team!).slice(0, 2).map((driver: any) => driver.name));
      await syncGame();
      setFlashMessage(`${driverName} has been released from the squad.`);
      setRosterTick(t => t + 1);
    };

    const handleSign = async (driver: any) => {
      if (getTeamRoster(state.team!).length >= 3) {
        setFlashMessage("Your roster is already full.");
        return;
      }

      const oldTeam = findAiTeamByDriver(driver.name);
      const moveCost = oldTeam ? getPoachCost(driver, oldTeam) : driver.salary;
      if (state.team!.budget < moveCost) {
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

      state.team!.budget = parseFloat((state.team!.budget - moveCost).toFixed(1));
      addDriverToTeam(state.team!, driver);
      setTeamActiveDrivers(state.team!, getTeamRoster(state.team!).slice(0, 2).map((entry: any) => entry.name));
      await syncGame();
      setFlashMessage(oldTeam
        ? `${driver.name} has joined from ${oldTeam.name} for $${moveCost}M. Their former team signed a replacement from the talent pool.`
        : `${driver.name} has joined your team for $${moveCost}M.`);
      setRosterTick(t => t + 1);
    };

    return (
      <div>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {sectionLabel('Season Transition')}
            {pageTitle('Offseason Decisions')}
            {pageSubtitle(`Decide whether to keep your current squad or reshape the team before starting season ${(state.season.year || 1) + 1}.`)}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={statCell()}>{statLabel('Current Squad')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(`${roster.length}/3`)}</span></div>
            <div style={statCell()}>{statLabel('Active Pair')}{statValue(active.map(driver => driver.name).join(" / ") || "--")}</div>
            <div style={statCell()}>{statLabel('Budget')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(`$${(state.team!.budget || 0).toFixed(1)}M`)}</span></div>
          </div>
        </div>

        {flashMessage && (
          <div style={{ ...glassCard({ padding: '16px' }), borderLeft: `4px solid ${HUB.accent}`, marginBottom: '24px' }}>
            <p style={{ fontSize: '14px', color: '#fff', margin: 0 }}>{flashMessage}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={glassCard({ padding: '24px' })}>
             <p style={{ fontSize: '10px', fontWeight: 700, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 8px' }}>Next Step</p>
             <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Sponsor Commitment</h3>
             <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>Would you like to continue with your current sponsors for the next season, or clear your roster to sign new ones?</p>
             <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setKeepSponsors(true)} style={{ ...actionBtn({ padding: '10px 16px' }), backgroundColor: keepSponsors ? HUB.accent : 'rgba(255,255,255,0.05)', border: `1px solid ${keepSponsors ? HUB.accent : HUB.borderMid}` }}>Keep Current</button>
                <button onClick={() => setKeepSponsors(false)} style={{ ...actionBtn({ padding: '10px 16px' }), backgroundColor: !keepSponsors ? HUB.accent : 'rgba(255,255,255,0.05)', border: `1px solid ${!keepSponsors ? HUB.accent : HUB.borderMid}` }}>Clear & New</button>
             </div>
          </div>

          <div style={glassCard({ padding: '24px' })}>
             <p style={{ fontSize: '10px', fontWeight: 700, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 8px' }}>Finalize</p>
             <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Continue Or Reshape</h3>
             <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>You can keep the current lineup, release drivers, sign replacements, and then start the next season when ready.</p>
             <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => startNextSeason(root, keepSponsors, setFlashMessage)} style={actionBtn({ padding: '10px 24px', width: '100%' })}>Start Next Season</button>
             </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
           <div>
             <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>Your Squad</h3>
             {roster.length === 0 && <p style={{ fontSize: '13px', color: HUB.textMuted }}>No drivers contracted.</p>}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {roster.map((driver: any) => (
                 <div key={driver.name} style={glassCard({ padding: '20px' })}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                         <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{driver.name}</h4>
                            <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>Age {driver.age} • Salary ${driver.salary}M</p>
                         </div>
                      </div>
                      <button onClick={() => handleRelease(driver.name)} style={{ ...actionBtn({ padding: '6px 12px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.borderMid}` }) }}>Release</button>
                   </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Pace</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.pace}</span></div>
                      <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Quali</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.quali}</span></div>
                      <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Racecraft</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.racecraft}</span></div>
                      <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Consistency</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.consistency}</span></div>
                    </div>
                 </div>
               ))}
             </div>
           </div>

           <div>
             <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '0 0 16px' }}>Market Candidates</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {candidates.map((driver: any) => {
                 const currentTeam = findAiTeamByDriver(driver.name);
                 const rosterFull = roster.length >= 3;
                 const poachCost = currentTeam ? getPoachCost(driver, currentTeam) : driver.salary;
                 const canAfford = state.team!.budget >= poachCost;

                 return (
                   <div key={driver.name} style={glassCard({ padding: '20px' })}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} loading="lazy" />
                           <div>
                              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{driver.name}</h4>
                              <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>{currentTeam ? `At ${currentTeam.name}` : "Free Agent"} • Cost ${poachCost}M</p>
                           </div>
                        </div>
                        <button onClick={() => handleSign(driver)} disabled={rosterFull || !canAfford} style={{ ...actionBtn({ padding: '6px 12px', fontSize: '11px', backgroundColor: (rosterFull || !canAfford) ? 'rgba(255,255,255,0.05)' : HUB.accent }), opacity: (rosterFull || !canAfford) ? 0.5 : 1, cursor: (rosterFull || !canAfford) ? 'not-allowed' : 'pointer' }}>
                          {rosterFull ? 'Roster Full' : !canAfford ? 'Insufficient Funds' : 'Sign'}
                        </button>
                     </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Pace</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.pace}</span></div>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Quali</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.quali}</span></div>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Racecraft</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.racecraft}</span></div>
                        <div><span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block' }}>Consistency</span><span style={{ fontSize: '14px', color: '#fff', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{driver.consistency}</span></div>
                      </div>
                   </div>
                 );
               })}
             </div>
           </div>
        </div>
      </div>
    );
  };

  mountLayout(root, 'offseason', <OffseasonPage />, () => renderOffseason(root, initialFlashMessage));
}
