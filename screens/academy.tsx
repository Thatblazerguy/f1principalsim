import React, { useState } from 'react';
import { state } from "../state.js";
import { ensureTeamState, ensureAcademyState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { 
  getAcademyXPRequired, 
  getMaxAcademySize, 
  getFacilityUpgradeCost,
  calculateAcademyReputation,
  REGIONS,
  SCOUTING_TIERS,
  LOAN_DESTINATIONS
} from "../game/academy.js";
import { createScoutingAssignment } from "../game/scouting.js";
import { getDriverHeadshotUrl } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, btn, btnClass, sectionLabel, pageTitle, pageSubtitle, statCell, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { RadarChart, DriverComparison } from '../components/driverComparison.tsx';
import { DriverRadarCompare } from '../components/DriverRadarCompare.tsx';
import { AnimatedNumber, AnimatedBar, SlideUp } from '../components/ui/motion.tsx';
import { motion, AnimatePresence } from 'framer-motion';


export function renderAcademy(root, initialFlashMessage = "") {
  ensureTeamState(state.team);
  ensureAcademyState(state);

  const AcademyPage = () => {
    const [flashMessage, setFlashMessage] = useState(initialFlashMessage);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'prospects', 'scouting', 'loans'
    
    // Scouting state
    const [selectedRegion, setSelectedRegion] = useState('europe');
    const [selectedTier, setSelectedTier] = useState('basic');

    // Modals
    const [allocateBudgetModal, setAllocateBudgetModal] = useState(false);
    const [allocationAmount, setAllocationAmount] = useState(5);
    const [promotingProspect, setPromotingProspect] = useState(null); // driver object
    const [comparingProspect, setComparingProspect] = useState(null);

    const academy = state.academy;
    const team = state.team;

    const handleAllocateBudget = async () => {
      if (team.budget >= allocationAmount) {
        team.budget -= allocationAmount;
        academy.budget += allocationAmount;
        await syncGame();
        setFlashMessage(`Allocated $${allocationAmount}M to the academy budget`);
        setAllocateBudgetModal(false);
      }
    };

    const handleUpgradeFacility = async (facility) => {
      const currentLevel = academy.facilities[facility];
      if (currentLevel >= 5) return;
      
      const cost = getFacilityUpgradeCost(currentLevel);
      if (academy.budget >= cost) {
        academy.budget -= cost;
        academy.facilities[facility]++;
        academy.reputation = calculateAcademyReputation(academy);
        await syncGame();
        const facilityName = facility.replace(/([A-Z])/g, ' $1').toLowerCase();
        setFlashMessage(`${facilityName.charAt(0).toUpperCase() + facilityName.slice(1)} upgraded to level ${currentLevel + 1}`);
      } else {
        setFlashMessage(`Not enough academy budget. Need $${cost}M`);
      }
    };

    const handleStartScouting = async () => {
      const result = createScoutingAssignment(selectedRegion, selectedTier, state.season.currentDay, academy.level, academy.budget);
      if (result.ok) {
        academy.budget -= result.cost;
        academy.scouts.push(result.assignment);
        await syncGame();
        setFlashMessage(`Scout sent to ${REGIONS[selectedRegion].label}`);
        setActiveTab('overview'); // Force re-render of scouting list
        setTimeout(() => setActiveTab('scouting'), 10);
      } else {
        setFlashMessage(`Scouting failed: ${result.reason}`);
      }
    };

    const handleSignProspect = async (scoutIndex) => {
      const scout = academy.scouts[scoutIndex];
      if (academy.prospects.length >= getMaxAcademySize(academy.level)) {
        setFlashMessage("Academy is at full capacity");
        return;
      }
      scout.signed = true;
      academy.prospects.push(scout.prospect);
      await syncGame();
      setFlashMessage(`${scout.prospect.name} signed to the academy`);
    };

    const handleDismissScout = async (scoutIndex) => {
      academy.scouts[scoutIndex].dismissed = true;
      await syncGame();
    };

    const handleReleaseProspect = async (prospectIndex) => {
      const prospect = academy.prospects[prospectIndex];
      if (confirm(`Are you sure you want to release ${prospect.name}?`)) {
        team.releaseAcademyDriver(prospect, state);
        await syncGame();
        setFlashMessage(`${prospect.name} released`);
      }
    };

    const handleLoanOut = async (prospectIndex, destinationId) => {
      const prospect = academy.prospects[prospectIndex];
      const dest = LOAN_DESTINATIONS.find(d => d.id === destinationId);
      if (team.loanOutAcademyDriver(prospect, dest, state)) {
         await syncGame();
         setFlashMessage(`${prospect.name} sent on loan to ${dest.label}`);
         setActiveTab('loans');
      }
    };

    const handleRecallLoan = async (loanIndex) => {
      const prospect = academy.loanedOut[loanIndex];
      if (confirm(`Recall ${prospect.name} from loan early? They may be unhappy.`)) {
         academy.loanedOut.splice(loanIndex, 1);
         prospect.loanStatus = null;
         prospect.driverRole = 'academy';
         prospect.roleLabel = 'Academy Prospect';
         prospect.morale = Math.max(0, prospect.morale - 15);
         if (!prospect.careerTimeline) prospect.careerTimeline = [];
         prospect.careerTimeline.unshift({ seasonYear: state.season.year || 1, event: 'Loan Recalled', detail: 'Recalled early by parent team.' });
         academy.prospects.push(prospect);
         await syncGame();
         setFlashMessage(`${prospect.name} recalled from loan`);
      }
    };

    const handleConfirmPromotion = async () => {
      if (promotingProspect) {
        if (team.promoteAcademyToReserve(promotingProspect, state)) {
           await syncGame();
           setFlashMessage(`${promotingProspect.name} promoted to reserve driver`);
           setPromotingProspect(null);
        } else {
           setFlashMessage("You already have a reserve driver. Demote or release them first");
        }
      }
    };

    // Tabs definition
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'prospects', label: 'Prospects' },
      { id: 'scouting', label: 'Scouting' },
      { id: 'loans', label: 'Loans' },
    ];

    const maxCapacity = getMaxAcademySize(academy.level);

    return (
      <div>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {pageTitle('Academy')}
            {pageSubtitle('Scout, sign and develop young drivers for your team.')}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={statCell({ minWidth: '120px' })}>
               {statLabel('Academy budget')}
               <div style={{ fontSize: '22px', fontWeight: 400, color: HUB.textPrimary, fontFamily: HUB.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                 $<AnimatedNumber value={academy.budget || 0} formatter={(v) => v.toFixed(1)} />M
               </div>
            </div>
            <div style={statCell({ minWidth: '120px' })}>
               {statLabel('Squad')}
               {statValue(`${academy.prospects.length} / ${maxCapacity}`)}
            </div>
          </div>
        </div>

        {flashMessage && (
          <div style={{ padding: '12px 16px', background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, fontSize: '13px', marginBottom: '24px' }}>
            {flashMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${HUB.border}` }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${HUB.accent}` : '2px solid transparent',
                color: activeTab === tab.id ? HUB.textPrimary : HUB.textMuted,
                fontSize: '13px',
                fontWeight: 400,
                fontFamily: HUB.fontBold,
                cursor: 'pointer' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <SlideUp>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Left col: Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div style={{ ...glassCard(), display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '96px', height: '96px', borderRadius: '50%', background: HUB.raised, border: `1px solid ${HUB.borderMid}` }}>
                       <span style={{ fontSize: '11px', color: HUB.textFaint }}>Level</span>
                       <span style={{ fontSize: '28px', fontFamily: HUB.fontBold, color: HUB.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{academy.level}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                       <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 8px' }}>Academy rating</h3>
                       <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }} aria-label={`${academy.reputation} of 5`}>
                          {[1,2,3,4,5].map(star => (
                             <span key={star} style={{ color: star <= academy.reputation ? HUB.textPrimary : HUB.borderMid, fontSize: '16px' }}>★</span>
                          ))}
                       </div>
                       <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                             <span style={{ fontSize: '12px', color: HUB.textMuted }}>Level progress</span>
                             <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{team.xp} / {getAcademyXPRequired(academy.level)} XP</span>
                          </div>
                          <AnimatedBar progress={(team.xp / getAcademyXPRequired(academy.level)) * 100} color={HUB.accent} />
                       </div>
                    </div>
                 </div>

                 <div style={glassCard()}>
                    <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Budget</h3>
                    <p style={{ fontSize: '13px', color: HUB.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>
                       The academy operates on a separate budget from the main constructor team. Allocate funds to upgrade facilities and deploy scouts.
                    </p>
                    <button onClick={() => setAllocateBudgetModal(true)} className={btnClass('secondary')} style={btn('secondary', 'md', { width: '100%' })}>Allocate from team budget</button>
                 </div>
              </div>

              {/* Right col: Facilities */}
              <div style={glassCard()}>
                 <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Facilities</h3>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {[
                      { id: 'simulator', label: 'Simulator', desc: 'Develops qualifying and pace' },
                      { id: 'fitness', label: 'Human performance', desc: 'Develops consistency and fitness' },
                      { id: 'coaching', label: 'Driver coaching', desc: 'Develops racecraft and tyre management' },
                      { id: 'sportsPsychology', label: 'Sports psychology', desc: 'Develops mentality and morale' },
                    ].map(fac => {
                       const level = academy.facilities[fac.id];
                       const cost = getFacilityUpgradeCost(level);
                       const canAfford = academy.budget >= cost;
                       return (
                         <div key={fac.id} style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <h4 style={{ fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>{fac.label}</h4>
                                  <span style={pill(false)}>Level {level}</span>
                               </div>
                               <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>{fac.desc}</p>
                            </div>
                            {level < 5 ? (
                               <button 
                                 onClick={() => handleUpgradeFacility(fac.id)}
                                 disabled={!canAfford}
                                 className={btnClass('secondary')}
                                 style={btn('secondary', 'sm')}
                               >
                                 Upgrade for ${cost}M
                               </button>
                            ) : (
                               <span style={{ fontSize: '12px', color: HUB.textMuted, fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif" }}>Max level</span>
                            )}
                         </div>
                       )
                    })}
                 </div>
              </div>
            </div>
          </SlideUp>
        )}

        {/* PROSPECTS TAB */}
        {activeTab === 'prospects' && (
          <SlideUp>
            {academy.prospects.length === 0 ? (
              <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center' }}>
                 <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 8px' }}>No prospects yet</h3>
                 <p style={{ color: HUB.textMuted, fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>Send scouts from the Scouting tab to find young drivers for your academy</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {academy.prospects.map((prospect, idx) => (
                   <div key={idx} style={{ ...glassCard({ padding: 0 }), overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', gap: '16px', alignItems: 'center' }}>
                         <img src={getDriverHeadshotUrl(prospect)} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
                         <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 4px' }}>{prospect.name}</h4>
                            <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>Age {prospect.age} · {prospect.nationality}</p>
                         </div>
                      </div>
                      
                      <div style={{ display: 'flex', padding: '16px 24px', gap: '20px', alignItems: 'center' }}>
                         <RadarChart pace={prospect.pace} quali={prospect.quali} racecraft={prospect.racecraft} consistency={prospect.consistency} />
                         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>OVR</span>
                                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{prospect.currentRating()}</span>
                               </div>
                               <AnimatedBar progress={prospect.currentRating()} color={HUB.textPrimary} height="2px" />
                            </div>
                            <div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>Potential</span>
                                  <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{prospect.potentialCeiling}</span>
                               </div>
                               <AnimatedBar progress={prospect.potentialCeiling} color="rgba(237,237,237,0.5)" height="2px" />
                            </div>
                         </div>
                      </div>

                      <div style={{ padding: '16px 24px', background: HUB.bg, borderTop: `1px solid ${HUB.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                         <span style={{ fontSize: '11px', color: HUB.textMuted }}>Style: <span style={{ color: HUB.textPrimary }}>{prospect.preferredStyle}</span></span>
                         <span style={{ fontSize: '11px', color: HUB.textMuted }}>Trait: <span style={{ color: HUB.textPrimary }}>{prospect.personality}</span></span>
                         <span style={{ fontSize: '11px', color: HUB.textMuted }}>Morale: <span style={{ color: HUB.textPrimary }}>{prospect.morale}%</span></span>
                         <span style={{ fontSize: '11px', color: HUB.textMuted }}>Contract: <span style={{ color: HUB.textPrimary }}>{prospect.contractYearsRemaining} yrs</span></span>
                      </div>

                      <div style={{ padding: '16px 24px', borderTop: `1px solid ${HUB.border}`, display: 'flex', gap: '8px' }}>
                         <button onClick={() => setPromotingProspect(prospect)} className={btnClass('secondary')} style={btn('secondary', 'sm', { flex: 1 })}>Promote</button>
                         <button onClick={() => setComparingProspect(prospect)} className={btnClass('ghost')} style={btn('ghost', 'sm')} aria-label={`Compare ${prospect.name}`}>Compare</button>
                         <select 
                           onChange={(e) => {
                             if(e.target.value) {
                               handleLoanOut(idx, e.target.value);
                               e.target.value = "";
                             }
                           }}
                           style={{ flex: 1, background: HUB.raised, color: HUB.textPrimary, border: `1px solid ${HUB.border}`, borderRadius: '8px', fontSize: '12px', fontFamily: HUB.fontBold, outline: 'none', padding: '0 8px' }}
                         >
                            <option value="">Loan to…</option>
                            {LOAN_DESTINATIONS.map(dest => <option key={dest.id} value={dest.id}>{dest.label}</option>)}
                         </select>
                         <button onClick={() => handleReleaseProspect(idx)} className={btnClass('danger')} style={btn('danger', 'sm', { flex: 0.5 })}>Release</button>
                      </div>
                   </div>
                ))}
              </div>
            )}
          </SlideUp>
        )}

        {/* SCOUTING TAB */}
        {activeTab === 'scouting' && (
          <SlideUp>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div>
                   <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Send a scout</h3>
                   <div style={{ ...glassCard(), marginBottom: '24px' }}>
                      <div style={{ marginBottom: '16px' }}>
                         <label style={{ display: 'block', fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Region</label>
                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            {Object.entries(REGIONS).map(([key, reg]) => (
                               <button 
                                 key={key} 
                                 onClick={() => setSelectedRegion(key)}
                                 style={{ height: '32px', padding: '0 12px', justifyContent: 'center', background: selectedRegion === key ? HUB.accentSoft : HUB.raised, border: `1px solid ${selectedRegion === key ? 'rgba(225,6,0,0.4)' : HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                               >
                                  <span style={{ fontSize: '12px', fontFamily: HUB.fontBold }}>{reg.label}</span>
                               </button>
                            ))}
                         </div>
                      </div>
                      
                      <div style={{ marginBottom: '24px' }}>
                         <label style={{ display: 'block', fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>Tier</label>
                         <div style={{ display: 'flex', gap: '8px' }}>
                            {Object.entries(SCOUTING_TIERS).map(([key, tier]) => (
                               <button
                                 key={key}
                                 onClick={() => setSelectedTier(key)}
                                 style={{ flex: 1, padding: '10px', background: selectedTier === key ? HUB.accentSoft : HUB.raised, border: `1px solid ${selectedTier === key ? 'rgba(225,6,0,0.4)' : HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, cursor: 'pointer', textAlign: 'center' }}
                               >
                                  <span style={{ display: 'block', fontSize: '12px', fontFamily: HUB.fontBold, marginBottom: '4px' }}>{tier.label}</span>
                                  <span style={{ display: 'block', fontSize: '11px', color: HUB.textMuted }}>${tier.cost}M</span>
                               </button>
                            ))}
                         </div>
                      </div>

                      <button onClick={handleStartScouting} className={btnClass('primary')} style={btn('primary', 'md', { width: '100%' })}>Send scout</button>
                   </div>
                </div>

                <div>
                   <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Scouting reports</h3>
                   {academy.scouts.filter(s => !s.dismissed && !s.signed).length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', border: `1px dashed ${HUB.borderMid}`, borderRadius: '8px' }}>
                         <span style={{ color: HUB.textMuted, fontSize: '13px' }}>No scouting reports yet</span>
                      </div>
                   ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                         {academy.scouts.filter(s => !s.dismissed && !s.signed).reverse().map((scout, idx) => {
                            const p = scout.prospect;
                            const r = p.scoutRevealLevel;
                            const isComplete = scout.complete;
                            const progress = isComplete ? 100 : Math.min(100, Math.max(0, ((state.season.currentDay - scout.startDay) / scout.totalDuration) * 100));

                            return (
                               <div key={scout.id} style={glassCard({ padding: '16px' })}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                     <div>
                                        <span style={{ fontSize: '12px', color: HUB.textMuted, display: 'block' }}>{scout.regionLabel} · {scout.tierLabel} tier</span>
                                        <h4 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '4px 0 0' }}>{r >= 1 ? p.name : "Unknown prospect"}</h4>
                                     </div>
                                     {!isComplete && (
                                        <div style={{ textAlign: 'right' }}>
                                           <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{Math.round(progress)}%</span>
                                        </div>
                                     )}
                                  </div>

                                  {!isComplete && <AnimatedBar progress={progress} color="rgba(237,237,237,0.5)" height="2px" style={{ marginBottom: '16px' }} />}

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', background: HUB.bg, padding: '12px', borderRadius: '8px' }}>
                                     <span style={{ fontSize: '11px', color: HUB.textMuted }}>Age: <span style={{ color: HUB.textPrimary }}>{r >= 1 ? p.age : '???'}</span></span>
                                     <span style={{ fontSize: '11px', color: HUB.textMuted }}>Pace: <span style={{ color: HUB.textPrimary }}>{r >= 3 ? p.pace : r >= 2 ? `${Math.max(1, p.pace - 8)}-${Math.min(99, p.pace + 8)}` : '???'}</span></span>
                                     <span style={{ fontSize: '11px', color: HUB.textMuted }}>Style: <span style={{ color: HUB.textPrimary }}>{r >= 1 ? p.preferredStyle : '???'}</span></span>
                                     <span style={{ fontSize: '11px', color: HUB.textMuted }}>Pot. OVR: <span style={{ color: HUB.textPrimary }}>{r >= 5 ? p.potentialCeiling : r >= 4 ? `${Math.max(1, p.potentialCeiling - 6)}-${Math.min(99, p.potentialCeiling + 6)}` : '???'}</span></span>
                                  </div>

                                  {isComplete ? (
                                     <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleSignProspect(academy.scouts.indexOf(scout))} className={btnClass('secondary')} style={btn('secondary', 'sm', { flex: 1 })}>Sign prospect</button>
                                        <button onClick={() => handleDismissScout(academy.scouts.indexOf(scout))} className={btnClass('danger')} style={btn('danger', 'sm', { flex: 0.5 })}>Dismiss</button>
                                     </div>
                                  ) : (
                                     <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0, textAlign: 'center' }}>Scouting in progress…</p>
                                  )}
                               </div>
                            )
                         })}
                      </div>
                   )}
                </div>
             </div>
          </SlideUp>
        )}

        {/* LOANS TAB */}
        {activeTab === 'loans' && (
          <SlideUp>
             {academy.loanedOut.length === 0 ? (
               <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 8px' }}>No drivers on loan</h3>
                  <p style={{ color: HUB.textMuted, fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>Send prospects on loan from the Prospects tab to gain experience in other series</p>
               </div>
             ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {academy.loanedOut.map((prospect, idx) => (
                    <div key={idx} style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <img src={getDriverHeadshotUrl(prospect)} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
                          <div>
                             <h4 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 4px' }}>{prospect.name}</h4>
                             <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>On loan: <strong style={{ color: HUB.textPrimary, fontWeight: 400 }}>{prospect.loanStatus.series}</strong></p>
                          </div>
                       </div>
                       
                       <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                          <div style={{ textAlign: 'center' }}>
                             <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>OVR</span>
                             <span style={{ fontSize: '16px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{prospect.currentRating()}</span>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                             <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Potential</span>
                             <span style={{ fontSize: '16px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>{prospect.potentialCeiling}</span>
                          </div>
                          <div style={{ width: '1px', height: '32px', background: HUB.borderMid }}></div>
                          <button onClick={() => handleRecallLoan(idx)} className={btnClass('secondary')} style={btn('secondary', 'sm')}>Recall early</button>
                       </div>
                    </div>
                 ))}
               </div>
             )}
          </SlideUp>
        )}

        {/* MODALS */}
        {allocateBudgetModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ ...glassCard({ padding: '32px', width: '400px' }) }}>
                <h3 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 16px' }}>Allocate funds</h3>
                <p style={{ fontSize: '12px', color: HUB.textMuted, margin: '0 0 24px' }}>Team budget: ${(team.budget || 0).toFixed(1)}M</p>
                
                <input 
                  type="range" 
                  min="1" max={Math.max(1, Math.floor(team.budget))} 
                  value={allocationAmount} 
                  onChange={(e) => setAllocationAmount(Number(e.target.value))}
                  style={{ width: '100%', marginBottom: '16px', accentColor: HUB.accent }}
                />
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                   <span style={{ fontSize: '24px', fontFamily: HUB.fontMono, color: HUB.textPrimary }}>${allocationAmount}M</span>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                   <button onClick={() => setAllocateBudgetModal(false)} className={btnClass('secondary')} style={btn('secondary', 'md', { flex: 1 })}>Cancel</button>
                   <button onClick={handleAllocateBudget} disabled={team.budget < allocationAmount} className={btnClass('primary')} style={btn('primary', 'md', { flex: 1 })}>Transfer ${allocationAmount}M</button>
                </div>
             </div>
          </div>
        )}

        {promotingProspect && (
          <DriverComparison 
            d1={team.reserveDriver || { name: 'Empty seat', currentRating: () => 0, pace: 0, quali: 0, racecraft: 0, consistency: 0, salary: 0, market: 0 }}
            d2={promotingProspect}
            onClose={() => setPromotingProspect(null)}
            onConfirm={handleConfirmPromotion}
            confirmText="Promote to reserve"
            isPromotion={true}
          />
        )}

        {comparingProspect && (
          <DriverRadarCompare
            leftName={comparingProspect.name}
            rightName={team.reserveDriver?.name || team.drivers[0]?.name}
            onClose={() => setComparingProspect(null)}
          />
        )}
      </div>
    );
  };

  mountLayout(root, 'academy', <AcademyPage />, () => renderAcademy(root, initialFlashMessage));
}
