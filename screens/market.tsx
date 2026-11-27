import React, { useState } from 'react';
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, HUB, glassCard, statCell, pill, btn, btnClass, iconBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { ShieldCheck, Compass, Briefcase, Search, Award, Zap, Star, TrendingUp, UserPlus, DollarSign, Target, Clock, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';
import { getChiefScoutRecommendations } from '../utils/chiefScout.js';
import { ContractBuilder } from '../components/ContractBuilder.tsx';
import { DriverRadarCompare } from '../components/DriverRadarCompare.tsx';

function isDriverEmployed(name) {
  if (state.team.drivers.some(d => d.name === name)) return true;
  if (state.team.reserveDriver?.name === name) return true;
  if (state.aiTeams) {
    for (const aiTeam of state.aiTeams) {
      if (aiTeam.drivers.some(d => d.name === name)) return true;
      if (aiTeam.reserveDriver?.name === name) return true;
    }
  }
  return false;
}

function MarketScreen({ onRefresh }) {
  const [showScout, setShowScout] = useState(false);
  const [scoutRequest, setScoutRequest] = useState('');
  const [scoutResult, setScoutResult] = useState(null);
  const [offerDriver, setOfferDriver] = useState(null);
  const [compareName, setCompareName] = useState(null);

  // `terms` (optional, from the contract builder): { salary, seasons }.
  // Without terms the driver signs at their listed salary, as before.
  const handleSign = async (d, terms = null) => {
    if (isDriverEmployed(d.name)) return false;
    if (state.team.reserveDriver) return false;
    if (terms) {
      if (terms.salary < (d.salary || 0)) return false;
      d.salary = terms.salary;
      d.contractYearsRemaining = terms.seasons;
    }
    state.team.signDriver(d, "reserve");
    await syncGame();
    return true;
  };

  const quickActions = [
    // `label` is the request key used below; `text` is what the button shows.
    { label: 'Replacement', text: 'Replacement', icon: <UserPlus size={14} strokeWidth={1.5} /> },
    { label: 'Young Talent', text: 'Young talent', icon: <Star size={14} strokeWidth={1.5} /> },
    { label: 'Budget-Friendly', text: 'Budget-friendly', icon: <DollarSign size={14} strokeWidth={1.5} /> },
    { label: 'Long-Term', text: 'Long-term', icon: <TrendingUp size={14} strokeWidth={1.5} /> },
    { label: 'Qualifier', text: 'Qualifier', icon: <Zap size={14} strokeWidth={1.5} /> },
    { label: 'Racer', text: 'Racer', icon: <Clock size={14} strokeWidth={1.5} /> },
    { label: 'Tyre Manager', text: 'Tyre manager', icon: <Target size={14} strokeWidth={1.5} /> },
    { label: 'Best Value', text: 'Best value', icon: <Award size={14} strokeWidth={1.5} /> },
    { label: 'Reserve', text: 'Reserve', icon: <User size={14} strokeWidth={1.5} /> },
  ];

  const handleQuickAction = (action) => {
    let request = '';
    switch(action) {
      case 'Replacement':
        request = 'Find a replacement for our current drivers';
        break;
      case 'Young Talent':
        request = 'Find the best young talent with high potential';
        break;
      case 'Budget-Friendly':
        request = 'Find a driver under $20M';
        break;
      case 'Long-Term':
        request = 'Find a driver for the next 5 years';
        break;
      case 'Qualifier':
        request = 'Find the best qualifier';
        break;
      case 'Racer':
        request = 'Find the best race pace driver';
        break;
      case 'Tyre Manager':
        request = 'Find the best tyre manager';
        break;
      case 'Best Value':
        request = 'Find the best value signing';
        break;
      case 'Reserve':
        request = 'Find a reserve driver';
        break;
    }
    setScoutRequest(request);
    setScoutResult(getChiefScoutRecommendations(state, request));
  };

  const handleSubmitRequest = () => {
    if (scoutRequest.trim()) {
      setScoutResult(getChiefScoutRecommendations(state, scoutRequest));
    }
  };

  const renderScoutPanel = () => (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{
        position: 'fixed', right: 0, top: 0, height: '100vh', width: '450px',
        background: HUB.sidebar,
        borderLeft: `1px solid ${HUB.border}`,
        display: 'flex', flexDirection: 'column', zIndex: 1000,
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: HUB.textPrimary, fontFamily: HUB.fontBold, fontSize: '18px' }}>
            Chief scout
          </span>
        </div>
        <button onClick={() => setShowScout(false)} className={btnClass('ghost')} style={iconBtn('md')} aria-label="Close chief scout" title="Close chief scout">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Quick Actions */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: HUB.textPrimary, fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 12px' }}>Quick requests</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {quickActions.map((action, i) => (
              <button
                key={`quick-action-${i}`}
                onClick={() => handleQuickAction(action.label)}
                className={btnClass('secondary')}
                style={btn('secondary', 'sm', { justifyContent: 'flex-start' })}
              >
                <span style={{ color: HUB.textMuted, display: 'flex' }}>{action.icon}</span>
                {action.text}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Request */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: HUB.textPrimary, fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: '0 0 12px' }}>
            Custom request
          </h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={scoutRequest}
              onChange={(e) => setScoutRequest(e.target.value)}
              placeholder="Describe the driver you need"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitRequest()}
              style={{
                flex: 1, background: HUB.bg, border: `1px solid ${HUB.border}`,
                borderRadius: '8px', padding: '8px 12px',
                color: HUB.textPrimary, fontSize: '13px', outline: 'none', fontFamily: HUB.fontRegular
              }}
            />
            <button onClick={handleSubmitRequest} className={btnClass('primary')} style={btn('primary', 'md')}>
              Send request
            </button>
          </div>
        </div>

        {/* Results */}
        {scoutResult && scoutResult.recommendations && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: HUB.textPrimary, fontSize: '14px', fontWeight: 400, fontFamily: HUB.fontBold, margin: 0 }}>
              Scouting report
            </h4>
            {scoutResult.recommendations.map((rec, idx) => (
              <div key={`scout-rec-${idx}`} style={{ ...glassCard({ padding: '16px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={getDriverHeadshotUrl(rec.driver)}
                      alt={rec.driver.name}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', border: `1px solid ${HUB.border}`, objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontFamily: HUB.fontBold, color: HUB.textPrimary, fontSize: '14px' }}>
                        {rec.driver.name}
                      </span>
                      <span style={{ color: HUB.textMuted, fontSize: '11px' }}>
                        {rec.driver.category} · Age {rec.driver.age}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: HUB.fontMono, color: idx === 0 ? HUB.accentInk : HUB.textPrimary, fontSize: '18px', fontWeight: 400 }}>
                      {Math.round(rec.compatibility)}%
                    </span>
                    <div style={{ color: HUB.textMuted, fontSize: '11px' }}>
                      Compatibility
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: HUB.raised, padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '2px' }}>
                      Overall
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                      {rec.overall}
                    </div>
                  </div>
                  <div style={{ background: HUB.raised, padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '2px' }}>
                      Potential
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                      {Math.round(rec.potential)}
                    </div>
                  </div>
                  <div style={{ background: HUB.raised, padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '2px' }}>
                      Salary
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                      ${rec.salary}M
                    </div>
                  </div>
                </div>

                <p style={{ color: HUB.textPrimary, fontSize: '13px', lineHeight: '1.5', margin: '0 0 12px' }}>
                  {rec.report}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button onClick={() => setCompareName(rec.driver.name)} className={btnClass('secondary')} style={btn('secondary', 'md')}>
                    Compare
                  </button>
                  <button onClick={() => setOfferDriver(rec.driver)} disabled={!!state.team.reserveDriver || isDriverEmployed(rec.driver.name)} className={btnClass('primary')} style={btn('primary', 'md', { flex: 1 })}>
                    Offer reserve contract
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div style={{ display: 'flex' }}>
      {/* Main Market Content */}
      <div style={{ flex: 1 }}>
        <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            {pageTitle('Driver market')}
            {pageSubtitle('Browse unsigned grid drivers and F2 prospects to sign for your team.')}
          </div>
          <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
            <button onClick={() => setShowScout(true)} className={btnClass('secondary')} style={btn('secondary', 'md')}>
              <Search size={16} strokeWidth={1.5} />
              Ask chief scout
            </button>
            <div style={statCell({minWidth:'120px'})}>
              {statLabel('Operations budget')}
              <div style={{fontSize:'22px', fontWeight: 400, color:HUB.textPrimary, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>
                $<AnimatedNumber value={state.team.budget || 0} formatter={(v) => v.toFixed(1)} />M
              </div>
            </div>
            <div style={statCell({minWidth:'120px'})}>
              {statLabel('Race seats / reserve')}
              {statValue(`${state.team.drivers.length} / ${state.team.reserveDriver ? 1 : 0}`)}
            </div>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'24px'}}>
          {drivers.filter(d => !isDriverEmployed(d.name)).map((d, i) => {
            const potential = Math.min(99, Math.round(d.pace * 1.05 + 3));
            const isAcademy = d.driverRole === 'academy';

            return (
              <SlideUp key={`driver-${d.name}-${i}`} delay={i * 0.05}>
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                style={{...glassCard({padding:'0'}), display:'flex', flexDirection:'column', justifyContent:'space-between'}}
              >
                <div style={{padding:'20px', borderBottom:`1px solid ${HUB.border}`}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px'}}>
                    <div>
                      <span style={{fontSize: '12px', color:HUB.textFaint, display:'block', marginBottom:'4px' }}>{d.category}</span>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        <img src={getDriverHeadshotUrl(d)} alt={d.name} style={{width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}`}} loading="lazy"/>
                        <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, margin:0, color:HUB.textPrimary}}>{d.name}</h3>
                      </div>
                    </div>
                    {isAcademy ? <span style={pill()}>Academy</span> : <span style={pill()}>Market value {d.market}</span>}
                  </div>
                  <p style={{fontSize:'12px', color:HUB.textMuted, margin:0}}>Age {d.age} · Salary ${d.salary}M · Est. potential {potential} OVR</p>
                </div>

                <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', flex:1}}>
                   <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px', border:`1px solid ${HUB.border}`}}>
                     <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Pace</span>
                     <span style={{fontSize:'14px', fontWeight: 400, color:HUB.textPrimary, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{(d.pace||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px', border:`1px solid ${HUB.border}`}}>
                     <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Quali</span>
                     <span style={{fontSize:'14px', fontWeight: 400, color:HUB.textPrimary, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{(d.quali||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px', border:`1px solid ${HUB.border}`}}>
                     <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Racecraft</span>
                     <span style={{fontSize:'14px', fontWeight: 400, color:HUB.textPrimary, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{(d.racecraft||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:HUB.raised, padding:'8px 12px', borderRadius:'8px', border:`1px solid ${HUB.border}`}}>
                     <span style={{fontSize: '11px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Consistency</span>
                     <span style={{fontSize:'14px', fontWeight: 400, color:HUB.textPrimary, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{(d.consistency||0).toFixed(1)}</span>
                   </div>
                </div>

                <div style={{padding:'20px', borderTop:`1px solid ${HUB.border}`, display:'flex', gap:'8px'}}>
                  <button onClick={() => setCompareName(d.name)} className={btnClass('ghost')} style={btn('ghost', 'md')} aria-label={`Compare ${d.name}`}>
                    Compare
                  </button>
                  <button onClick={() => setOfferDriver(d)} disabled={!!state.team.reserveDriver} className={btnClass('secondary')} style={btn('secondary', 'md', { flex:1 })}>
                    {state.team.reserveDriver ? 'Reserve seat filled' : 'Offer reserve contract'}
                  </button>
                </div>
              </motion.div>
              </SlideUp>
            );
          })}
        </div>
      </div>

      {/* Scout Side Panel */}
      <AnimatePresence>
        {showScout && renderScoutPanel()}
      </AnimatePresence>

      {offerDriver && (
        <ContractBuilder
          driver={offerDriver}
          mode="market"
          onSend={async (terms) => {
            const ok = await handleSign(offerDriver, terms);
            const len = `${terms.seasons} ${terms.seasons === 1 ? 'season' : 'seasons'}`;
            return ok
              ? { accepted: true, headline: `${offerDriver.name} signed as your reserve driver: $${terms.salary.toFixed(1)}M a season for ${len}.` }
              : { accepted: false, headline: 'The offer could not be signed. The reserve seat may already be filled.' };
          }}
          onClose={() => setOfferDriver(null)}
          onDone={(r) => { setShowScout(false); if (r.accepted && onRefresh) onRefresh(); }}
        />
      )}

      {compareName && (
        <DriverRadarCompare
          leftName={state.team.drivers[0]?.name || state.team.reserveDriver?.name}
          rightName={compareName}
          onClose={() => setCompareName(null)}
        />
      )}
    </div>
  );
}

export function renderMarket(root) {
  if (!root) return;
  ensureTeamState(state.team);

  if (!state.team) {
     const content = (
       <div>
         <div style={{marginBottom:'32px'}}>
           {pageTitle('Driver market')}
           {pageSubtitle('Create a team before scouting drivers.')}
         </div>
       </div>
     );
     mountLayout(root, 'market', content);
     return;
  }

  const content = <MarketScreen onRefresh={() => renderMarket(root)} />;
  mountLayout(root, 'market', content, () => renderMarket(root));
}
