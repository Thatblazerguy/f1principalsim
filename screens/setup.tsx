import React, { useState } from 'react';
import { Team } from "../game/team.js";
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { assignReplacementReserve, fillEmptySeats } from "../data/teams.js";
import { state, resetAiTeams } from "../state.js";
import { renderDashboard } from "./dashboard.tsx";
import { syncGame } from "../lib/supabaseApi.js";
import { getRoundRaceDay } from "../utils/seasonTimeline.js";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { HUB, glassCard, actionBtn, pageTitle, pageSubtitle } from "../components/HubLayout.tsx";

const teamTiers = [
  {
    id: "tier1", name: "Tier 1", tagline: "The Frontrunners",
    why: "Championship contenders from day one. Fast everywhere, stable under pressure, and built to fight for wins immediately.",
    ovr: 94, specs: { aero: 95, chassis: 94, reliability: 93, ovr: 94 },
  },
  {
    id: "tier2", name: "Tier 2", tagline: "The Podium Hunters",
    why: "Strong enough to steal wins if the leaders wobble. Reliable, balanced, and always in the top-five conversation.",
    ovr: 90, specs: { aero: 90, chassis: 89, reliability: 90, ovr: 90 },
  },
  {
    id: "tier3", name: "Tier 3", tagline: "The Midfield Scrappers",
    why: "A proper points-fighting package. Driver quality and smart upgrades will decide whether you break into the upper midfield.",
    ovr: 86, specs: { aero: 84, chassis: 86, reliability: 87, ovr: 86 },
  },
  {
    id: "tier4", name: "Tier 4", tagline: "The Backmarkers & Project Teams",
    why: "A long-build project. You start with clear weaknesses and have to develop your way into the fight.",
    ovr: 80, specs: { aero: 78, chassis: 79, reliability: 82, ovr: 80 },
  },
];

const engineProviders = [
  { id: "mercedes", name: "Mercedes", perk: "+5% Reliability", price: 25, tradeoff: 'The "Safe" bet; fewer mechanical DNFs.', effects: { reliability: 5, performance: 1.2, retirementModifier: -0.003 } },
  { id: "ferrari", name: "Ferrari", perk: "+5% Aero/Drag", price: 28, tradeoff: 'The "Speed" bet; tighter car packaging.', effects: { aero: 5, performance: 1.5, qualifyingBoost: 0.5 } },
  { id: "rbpt", name: "RBPT-Ford", perk: "+3% Chassis Grip", price: 22, tradeoff: 'The "Agility" bet; better in low-speed corners.', effects: { chassis: 3, performance: 1.0, raceBoost: 0.35 } },
  { id: "audi", name: "Audi", perk: "+10% Energy Recovery", price: 20, tradeoff: 'The "Tech" bet; more battery power per lap.', effects: { performance: 0.9, qualifyingBoost: 0.25, raceBoost: 0.6 } },
  { id: "honda", name: "Honda", perk: "+5% Top Speed", price: 24, tradeoff: 'The "Power" bet; dominant on straights.', effects: { performance: 1.3, paceBoost: 0.45 } },
  { id: "custom", name: "Custom", perk: "-5% Reliability", price: 0, tradeoff: "High Risk: Zero cost, but high DNF chance.", effects: { reliability: -5, performance: -0.6, retirementModifier: 0.004 } },
];

export function renderSetup(root: HTMLElement) {
  const SetupPage = () => {
    const availableDrivers = drivers.filter(d => d.startupEligible).sort((a, b) => b.market - a.market || a.signingFee - b.signingFee);

    const [teamName, setTeamName] = useState('');
    const [budget, setBudget] = useState(300);
    const [seasonLength, setSeasonLength] = useState(24);
    const [selectedTier, setSelectedTier] = useState(teamTiers[2]);
    const [selectedEngine, setSelectedEngine] = useState(engineProviders[5]);
    const [selectedDriverNames, setSelectedDriverNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const toggleDriver = (name: string) => {
      setSelectedDriverNames(prev => {
        if (prev.includes(name)) return prev.filter(n => n !== name);
        if (prev.length >= 2) return prev;
        return [...prev, name];
      });
    };

    const selectedDrivers = selectedDriverNames.map(name => drivers.find(d => d.name === name)!).filter(Boolean);
    const totalSigningFees = selectedDrivers.reduce((sum, d) => sum + (d.signingFee ?? d.salary ?? 0), 0);
    const totalUpfrontCost = totalSigningFees + selectedEngine.price;
    const remainingBudget = budget - totalUpfrontCost;
    const canSubmit = teamName.trim() !== '' && selectedDriverNames.length === 2 && remainingBudget >= 0;

    const handleCreate = async () => {
      if (!canSubmit) return;
      setLoading(true);
      try {
        resetAiTeams();

        selectedDrivers.forEach(driver => {
          const sourceTeam = state.aiTeams.find(team => 
            team.reserveDriver?.name === driver.name || 
            team.drivers.some((d: any) => d.name === driver.name)
          );
          if (!sourceTeam) return;

          if (sourceTeam.reserveDriver?.name === driver.name) {
            sourceTeam.reserveDriver = null;
          } else {
            sourceTeam.drivers = sourceTeam.drivers.filter((d: any) => d.name !== driver.name);
          }

          fillEmptySeats(state.aiTeams, sourceTeam.name, selectedDriverNames);
        });

        const team = new Team(teamName.trim(), remainingBudget, selectedTier.ovr + (selectedEngine.effects.performance || 0));
        team.powerUnit = selectedEngine.name;
        team.specs = {
          ...selectedTier.specs,
          aero: selectedTier.specs.aero + (selectedEngine.effects.aero || 0),
          chassis: selectedTier.specs.chassis + (selectedEngine.effects.chassis || 0),
          reliability: selectedTier.specs.reliability + (selectedEngine.effects.reliability || 0),
          ovr: selectedTier.ovr + (selectedEngine.effects.performance || 0),
        };
        team.originTemplate = selectedTier.name;
        team.engineProfile = selectedEngine;
        team.pendingUpgrades = [];
        selectedDrivers.forEach(driver => team.signDriver(driver));

        state.team = team;
        state.season = { round: 1, year: 1, totalRounds: seasonLength, currentDay: getRoundRaceDay(1) };
        state.standings = { drivers: {}, teams: {} };
        state.bestFinishes = {};
        state.signedSponsors = {};
        state.notifications = [];

        await syncGame();
        renderDashboard(root);
      } catch (err: any) {
        setErrorMsg(err.message);
        setLoading(false);
      }
    };

    const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.borderMid}`, padding: '12px 16px', borderRadius: '8px', color: '#fff', outline: 'none', fontFamily: HUB.fontRegular, boxSizing: 'border-box' as const };
    const labelStyle = { fontSize: '10px', fontWeight: 700, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px', display: 'block' as const };

    return (
      <div style={{ backgroundColor: HUB.bg, color: HUB.textPrimary, minHeight: '100vh', fontFamily: HUB.fontRegular, position: 'relative', overflowY: 'auto', padding: '48px 24px' }}>
         <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: 700, color: HUB.accent, textTransform: 'uppercase', letterSpacing: '0.3em', margin: '0 0 8px' }}>Team Registration</p>
                {pageTitle('Create Your Team')}
                {pageSubtitle('Choose your identity, team tier, power unit strategy, and two launch drivers.')}
              </div>

              <div style={{ ...glassCard(), display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                 <div>
                   <label style={labelStyle}>Team Name</label>
                   <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Apex Racing" style={inputStyle} />
                 </div>
                 <div>
                   <label style={labelStyle}>Starting Budget</label>
                   <select value={budget} onChange={e => setBudget(Number(e.target.value))} style={inputStyle}>
                     <option value="150">Low ($150M)</option>
                     <option value="300">Medium ($300M)</option>
                     <option value="500">High ($500M)</option>
                     <option value="800">Billionaire ($800M)</option>
                   </select>
                 </div>
                 <div>
                   <label style={labelStyle}>Season Length</label>
                   <select value={seasonLength} onChange={e => setSeasonLength(Number(e.target.value))} style={inputStyle}>
                     <option value="6">Short (6 races)</option>
                     <option value="16">Standard (16 races)</option>
                     <option value="24">Full (24 races)</option>
                   </select>
                 </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Choose Team Tier</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {teamTiers.map(tier => (
                    <button key={tier.id} onClick={() => setSelectedTier(tier)} style={{ ...glassCard({ padding: '20px' }), background: selectedTier.id === tier.id ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedTier.id === tier.id ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                       <p style={{ fontSize: '10px', fontWeight: 700, color: selectedTier.id === tier.id ? HUB.accent : HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>2026 Baseline</p>
                       <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px', color: '#fff' }}>{tier.name}</h4>
                       <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 12px' }}>{tier.tagline}</p>
                       <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>OVR {tier.ovr}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Choose Engine Manufacturer</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {engineProviders.map(engine => (
                    <button key={engine.id} onClick={() => setSelectedEngine(engine)} style={{ ...glassCard({ padding: '16px' }), background: selectedEngine.id === engine.id ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedEngine.id === engine.id ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                       <p style={{ fontSize: '10px', fontWeight: 700, color: selectedEngine.id === engine.id ? HUB.accent : HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Provider</p>
                       <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>{engine.name}</h4>
                       <p style={{ fontSize: '11px', color: HUB.textMuted, margin: '0 0 12px' }}>{engine.perk}</p>
                       <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', fontSize: '11px', fontWeight: 700, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>{engine.price === 0 ? 'FREE' : `$${engine.price}M`}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Select Drivers ({selectedDriverNames.length}/2)</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '12px' }}>
                  {availableDrivers.map(d => {
                    const isSelected = selectedDriverNames.includes(d.name);
                    const isDisabled = !isSelected && selectedDriverNames.length >= 2;
                    return (
                      <button key={d.name} onClick={() => toggleDriver(d.name)} disabled={isDisabled} style={{ ...glassCard({ padding: '12px' }), display: 'flex', alignItems: 'center', gap: '12px', background: isSelected ? 'rgba(225,6,0,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1, transition: 'all 0.15s' }}>
                        <img src={getDriverHeadshotUrl(d)} alt={d.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.border}` }} loading="lazy" />
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>{d.name}</p>
                          <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>{d.roleLabel} • Fee ${d.signingFee}M</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

           </div>

           <div>
              <div style={{ position: 'sticky', top: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={glassCard()}>
                   <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px', color: '#fff', borderBottom: `1px solid ${HUB.border}`, paddingBottom: '12px' }}>Team Summary</h3>
                   
                   <div style={{ marginBottom: '16px' }}>
                     <p style={labelStyle}>Tier: {selectedTier.name}</p>
                     <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>{selectedTier.why}</p>
                   </div>
                   
                   <div style={{ marginBottom: '16px' }}>
                     <p style={labelStyle}>Engine: {selectedEngine.name}</p>
                     <p style={{ fontSize: '13px', color: HUB.textMuted, margin: 0, lineHeight: 1.5 }}>{selectedEngine.tradeoff}</p>
                   </div>
                   
                   <div style={{ borderTop: `1px solid ${HUB.border}`, paddingTop: '16px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontSize: '13px', color: HUB.textMuted }}>Starting Budget</span>
                         <span style={{ fontSize: '13px', color: '#fff', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>${budget}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontSize: '13px', color: '#f87171' }}>Engine Cost</span>
                         <span style={{ fontSize: '13px', color: '#f87171', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>-${selectedEngine.price}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                         <span style={{ fontSize: '13px', color: '#f87171' }}>Driver Fees</span>
                         <span style={{ fontSize: '13px', color: '#f87171', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>-${totalSigningFees}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${HUB.border}`, paddingTop: '12px' }}>
                         <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Remaining Budget</span>
                         <span style={{ fontSize: '16px', fontWeight: 700, color: remainingBudget >= 0 ? '#22c55e' : '#f87171', fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>${remainingBudget}M</span>
                      </div>
                   </div>

                   {errorMsg && <div style={{ padding: '12px', background: 'rgba(225,6,0,0.1)', border: `1px solid ${HUB.accent}`, borderRadius: '8px', color: '#fff', fontSize: '13px', marginBottom: '16px' }}>{errorMsg}</div>}

                   <button onClick={handleCreate} disabled={!canSubmit || loading} style={{ ...actionBtn({ width: '100%', opacity: (!canSubmit || loading) ? 0.5 : 1 }), cursor: (!canSubmit || loading) ? 'not-allowed' : 'pointer' }}>
                     {loading ? 'Creating Team...' : 'Finalize & Enter Paddock'}
                   </button>
                </div>
              </div>
           </div>

         </div>
      </div>
    );
  };

  renderToAppRoot(root, <SetupPage />);
}
