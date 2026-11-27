import React, { useState } from 'react';
import { Team } from "../game/team.js";
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { assignReplacementReserve, fillEmptySeats, reconcileRosters } from "../data/teams.js";
import { state, resetAiTeams } from "../state.js";
import { renderDashboard } from "./dashboard.tsx";
import { syncGame } from "../lib/supabaseApi.js";
import { getRoundRaceDay } from "../utils/seasonTimeline.js";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { HUB, glassCard, btn, btnClass, pageTitle, pageSubtitle } from "../components/HubLayout.tsx";
import { SeasonSetup } from "../components/ui/SeasonSetup.tsx";

const teamTiers = [
  {
    id: "tier1", name: "Tier 1", tagline: "Frontrunners",
    why: "Championship contenders from day one. Fast everywhere, stable under pressure, and built to fight for wins immediately.",
    ovr: 94, specs: { aero: 95, chassis: 94, reliability: 93, ovr: 94 },
  },
  {
    id: "tier2", name: "Tier 2", tagline: "Podium hunters",
    why: "Strong enough to steal wins if the leaders wobble. Reliable, balanced, and always in the top-five conversation.",
    ovr: 90, specs: { aero: 90, chassis: 89, reliability: 90, ovr: 90 },
  },
  {
    id: "tier3", name: "Tier 3", tagline: "Midfield scrappers",
    why: "A proper points-fighting package. Driver quality and smart upgrades will decide whether you break into the upper midfield.",
    ovr: 86, specs: { aero: 84, chassis: 86, reliability: 87, ovr: 86 },
  },
  {
    id: "tier4", name: "Tier 4", tagline: "Backmarkers and project teams",
    why: "A long-build project. You start with clear weaknesses and have to develop your way into the fight.",
    ovr: 80, specs: { aero: 78, chassis: 79, reliability: 82, ovr: 80 },
  },
];

const engineProviders = [
  { id: "mercedes", name: "Mercedes", perk: "+5% reliability", price: 25, tradeoff: 'The "Safe" bet; fewer mechanical DNFs.', effects: { reliability: 5, performance: 1.2, retirementModifier: -0.003 } },
  { id: "ferrari", name: "Ferrari", perk: "+5% aero/drag", price: 28, tradeoff: 'The "Speed" bet; tighter car packaging.', effects: { aero: 5, performance: 1.5, qualifyingBoost: 0.5 } },
  { id: "rbpt", name: "RBPT-Ford", perk: "+3% chassis grip", price: 22, tradeoff: 'The "Agility" bet; better in low-speed corners.', effects: { chassis: 3, performance: 1.0, raceBoost: 0.35 } },
  { id: "audi", name: "Audi", perk: "+10% energy recovery", price: 20, tradeoff: 'The "Tech" bet; more battery power per lap.', effects: { performance: 0.9, qualifyingBoost: 0.25, raceBoost: 0.6 } },
  { id: "honda", name: "Honda", perk: "+5% top speed", price: 24, tradeoff: 'The "Power" bet; dominant on straights.', effects: { performance: 1.3, paceBoost: 0.45 } },
  { id: "custom", name: "Custom", perk: "-5% reliability", price: 0, tradeoff: "High risk: zero cost, but high DNF chance.", effects: { reliability: -5, performance: -0.6, retirementModifier: 0.004 } },
];

export function renderSetup(root: HTMLElement) {
  const SetupPage = () => {
    const availableDrivers = drivers.filter(d => d.startupEligible).sort((a, b) => b.market - a.market || a.signingFee - b.signingFee);

    const [teamName, setTeamName] = useState('');
    const [budget, setBudget] = useState(300);
    const [selectedTier, setSelectedTier] = useState(teamTiers[2]);
    const [selectedEngine, setSelectedEngine] = useState(engineProviders[5]);
    const [selectedDriverNames, setSelectedDriverNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [setupStep, setSetupStep] = useState<'team' | 'season'>('team');

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

    const handleNext = () => {
      if (canSubmit) setSetupStep('season');
    };

    const handleCreate = async (rules: any, newCalendar: any) => {
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
        reconcileRosters(state.team, state.aiTeams);
        state.season = { 
          round: 1, 
          year: 1, 
          totalRounds: rules.totalRounds, 
          currentDay: getRoundRaceDay(1),
          rules: { ...rules },
          calendar: newCalendar
        };
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

    const inputStyle = { width: '100%', height: '40px', background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '0 12px', borderRadius: '8px', color: HUB.textPrimary, outline: 'none', fontFamily: HUB.fontRegular, boxSizing: 'border-box' as const };
    const labelStyle = { fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color: HUB.textMuted, margin: '0 0 8px', display: 'block' as const };

    if (setupStep === 'season') {
      return (
        <div style={{ backgroundColor: HUB.bg, color: HUB.textPrimary, minHeight: '100vh', fontFamily: HUB.fontRegular, position: 'relative', overflowY: 'auto' }}>
           <SeasonSetup 
              onComplete={handleCreate}
           />
        </div>
      );
    }

    return (
      <div style={{ backgroundColor: HUB.bg, color: HUB.textPrimary, minHeight: '100vh', fontFamily: HUB.fontRegular, position: 'relative', overflowY: 'auto', padding: '48px 24px' }}>
         <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
           
           <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                {pageTitle('Create your team')}
                {pageSubtitle('Choose your identity, team tier, power unit strategy, and two launch drivers.')}
              </div>

              <div style={{ ...glassCard(), display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                 <div>
                   <label style={labelStyle}>Team name</label>
                   <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Apex Racing" style={inputStyle} />
                 </div>
                 <div>
                   <label style={labelStyle}>Starting budget</label>
                   <select value={budget} onChange={e => setBudget(Number(e.target.value))} style={inputStyle}>
                     <option value="150">Low ($150M)</option>
                     <option value="300">Medium ($300M)</option>
                     <option value="500">High ($500M)</option>
                     <option value="800">Billionaire ($800M)</option>
                   </select>
                 </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, margin: 0 }}>Team tier</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {teamTiers.map(tier => (
                    <button key={tier.id} onClick={() => setSelectedTier(tier)} style={{ ...glassCard({ padding: '24px' }), background: selectedTier.id === tier.id ? HUB.accentSoft : HUB.surface, border: `1px solid ${selectedTier.id === tier.id ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: 'pointer', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}` }}>
                       <p style={{ fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color: HUB.textFaint, margin: '0 0 4px' }}>2026 baseline</p>
                       <h4 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 8px', color: HUB.textPrimary }}>{tier.name}</h4>
                       <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 12px' }}>{tier.tagline}</p>
                       <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '6px', background: HUB.raised, border: `1px solid ${HUB.border}`, fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>OVR {tier.ovr}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, margin: 0 }}>Power unit supplier</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  {engineProviders.map(engine => (
                    <button key={engine.id} onClick={() => setSelectedEngine(engine)} style={{ ...glassCard({ padding: '16px' }), background: selectedEngine.id === engine.id ? HUB.accentSoft : HUB.surface, border: `1px solid ${selectedEngine.id === engine.id ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: 'pointer', transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}` }}>
                       <p style={{ fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontRegular, color: HUB.textFaint, margin: '0 0 4px' }}>Supplier</p>
                       <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 4px', color: HUB.textPrimary }}>{engine.name}</h4>
                       <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 12px' }}>{engine.perk}</p>
                       <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '6px', background: HUB.raised, border: `1px solid ${HUB.border}`, fontSize: '12px', fontWeight: 400, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>{engine.price === 0 ? 'Free' : `$${engine.price}M`}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, margin: 0 }}>Drivers ({selectedDriverNames.length}/2)</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '12px' }}>
                  {availableDrivers.map(d => {
                    const isSelected = selectedDriverNames.includes(d.name);
                    const isDisabled = !isSelected && selectedDriverNames.length >= 2;
                    return (
                      <button key={d.name} onClick={() => toggleDriver(d.name)} disabled={isDisabled} style={{ ...glassCard({ padding: '12px' }), display: 'flex', alignItems: 'center', gap: '12px', background: isSelected ? HUB.accentSoft : HUB.surface, border: `1px solid ${isSelected ? HUB.accent : HUB.border}`, textAlign: 'left', cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1, transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}` }}>
                        <img src={getDriverHeadshotUrl(d)} alt={d.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.border}` }} loading="lazy" />
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 4px', color: HUB.textPrimary }}>{d.name}</p>
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
                   <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 16px', color: HUB.textPrimary, borderBottom: `1px solid ${HUB.border}`, paddingBottom: '12px' }}>Team summary</h3>
                   
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
                         <span style={{ fontSize: '13px', color: HUB.textMuted }}>Starting budget</span>
                         <span style={{ fontSize: '13px', color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>${budget}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                         <span style={{ fontSize: '13px', color: HUB.textMuted }}>Engine cost</span>
                         <span style={{ fontSize: '13px', color: HUB.negative, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>-${selectedEngine.price}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                         <span style={{ fontSize: '13px', color: HUB.textMuted }}>Driver fees</span>
                         <span style={{ fontSize: '13px', color: HUB.negative, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>-${totalSigningFees}M</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${HUB.border}`, paddingTop: '12px' }}>
                         <span style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Remaining budget</span>
                         <span style={{ fontSize: '16px', fontWeight: 400, color: remainingBudget >= 0 ? HUB.positive : HUB.negative, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>${remainingBudget}M</span>
                      </div>
                   </div>

                   {errorMsg && <div style={{ padding: '12px', background: HUB.raised, border: '1px solid rgba(229,72,77,0.4)', borderRadius: '8px', color: HUB.textPrimary, fontSize: '13px', marginBottom: '16px' }}>{errorMsg}</div>}

                   <button onClick={handleNext} disabled={!canSubmit || loading} className={btnClass('primary')} style={btn('primary', 'lg', { width: '100%' })}>
                     {loading ? 'Processing…' : 'Next: season setup'}
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
