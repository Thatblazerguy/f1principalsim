import React, { useState } from 'react';
import { drivers, getDriverHeadshotUrl } from "../data/drivers.js";
import { state } from "../state.js";
import { ensureTeamState } from "../utils/teamState.js";
import { syncGame } from "../lib/supabaseApi.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';
import { ShieldCheck, Compass, Briefcase, Search, Award, Zap, Star, TrendingUp, UserPlus, DollarSign, Target, Clock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';
import { getChiefScoutRecommendations } from '../utils/chiefScout.js';

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

  const handleSign = async (d) => {
    if (isDriverEmployed(d.name)) return;
    if (state.team.reserveDriver) return;
    state.team.signDriver(d, "reserve");
    await syncGame();
    if (onRefresh) onRefresh();
  };

  const quickActions = [
    { label: 'Replacement', icon: <UserPlus size={14} /> },
    { label: 'Young Talent', icon: <Star size={14} /> },
    { label: 'Budget-Friendly', icon: <DollarSign size={14} /> },
    { label: 'Long-Term', icon: <TrendingUp size={14} /> },
    { label: 'Qualifier', icon: <Zap size={14} /> },
    { label: 'Racer', icon: <Clock size={14} /> },
    { label: 'Tyre Manager', icon: <Target size={14} /> },
    { label: 'Best Value', icon: <Award size={14} /> },
    { label: 'Reserve', icon: <User size={14} /> },
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
        background: 'linear-gradient(180deg, rgba(10,10,10,0.98) 0%, rgba(5,5,5,0.98) 100%)', 
        borderLeft: `1px solid ${HUB.border}`, 
        backdropFilter: 'blur(10px)', 
        display: 'flex', flexDirection: 'column', zIndex: 1000, 
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
      }}
    >
      <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: HUB.textMuted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Chief Scout
          </span>
          <span style={{ color: '#fff', fontFamily: HUB.fontBold, fontSize: '20px', textTransform: 'uppercase' }}>
            Talent Advisor
          </span>
        </div>
        <button onClick={() => setShowScout(false)} style={{ 
          background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontSize: '28px', padding: '0 8px' 
        }}>
          &times;
        </button>
      </div>

      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Quick Actions */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>Quick Actions</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {quickActions.map((action, i) => (
              <button
                key={`quick-action-${i}`}
                onClick={() => handleQuickAction(action.label)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${HUB.border}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: HUB.fontBold,
                  fontSize: '11px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.borderColor = HUB.accent}
                onMouseLeave={(e) => e.target.style.borderColor = HUB.border}
              >
                <span style={{ color: HUB.accent }}>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Request */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginBottom: '12px' }}>
            Custom Request
          </h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              value={scoutRequest}
              onChange={(e) => setScoutRequest(e.target.value)}
              placeholder="Ask anything..."
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitRequest()}
              style={{
                flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${HUB.border}`, 
                borderRadius: '6px', padding: '10px 12px', 
                color: '#fff', fontSize: '13px', outline: 'none'
              }}
            />
            <button onClick={handleSubmitRequest} style={{ ...actionBtn({ padding: '10px 16px' }) }}>
              Send
            </button>
          </div>
        </div>

        {/* Results */}
        {scoutResult && scoutResult.recommendations && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
              Scouting Report
            </h4>
            {scoutResult.recommendations.map((rec, idx) => (
              <div key={`scout-rec-${idx}`} style={{ ...glassCard({ padding: '16px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src={getDriverHeadshotUrl(rec.driver)} 
                      alt={rec.driver.name} 
                      style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${idx === 0 ? HUB.accent : HUB.border}` }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontFamily: HUB.fontBold, color: '#fff', fontSize: '14px' }}>
                        {rec.driver.name}
                      </span>
                      <span style={{ color: HUB.textMuted, fontSize: '11px' }}>
                        {rec.driver.category} · Age {rec.driver.age}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: HUB.fontMono, color: idx === 0 ? HUB.accent : '#fff', fontSize: '18px', fontWeight: 'bold' }}>
                      {Math.round(rec.compatibility)}%
                    </span>
                    <div style={{ color: HUB.textMuted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Compatibility
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      Overall
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff', fontWeight: 'bold' }}>
                      {rec.overall}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      Potential
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff', fontWeight: 'bold' }}>
                      {Math.round(rec.potential)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                      Salary
                    </div>
                    <div style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: '#fff', fontWeight: 'bold' }}>
                      ${rec.salary}M
                    </div>
                  </div>
                </div>

                <p style={{ color: '#ddd', fontSize: '12px', lineHeight: '1.5', marginBottom: '12px' }}>
                  {rec.report}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button onClick={() => {
                    handleSign(rec.driver);
                    setShowScout(false);
                  }} style={{ ...actionBtn({ flex: 1, padding: '10px 14px', fontSize: '12px' }) }}>
                    Offer Contract
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
            {sectionLabel('Talent Scouting')}
            {pageTitle('Driver Recruitment')}
            {pageSubtitle('Filter through active grid drivers and F2 prospects to recruit for your team.')}
          </div>
          <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
            <button onClick={() => setShowScout(true)} style={{ 
              ...actionBtn({ padding: '12px 20px', display: 'flex', gap: '10px', alignItems: 'center' }) 
            }}>
              <Search size={18} />
              Ask Chief Scout
            </button>
            <div style={statCell({minWidth:'120px'})}>
              {statLabel('Operations budget')}
              <div style={{fontSize:'16px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>
                $<AnimatedNumber value={state.team.budget || 0} formatter={(v) => v.toFixed(1)} />M
              </div>
            </div>
            <div style={statCell({minWidth:'120px'})}>
              {statLabel('Driver Cap status')}
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
                style={{...glassCard({padding:'0'}), display:'flex', flexDirection:'column', justifyContent:'space-between', borderLeft:`3px solid ${d.market >= 85 ? HUB.accent : 'rgba(255,255,255,0.05)'}`}}
              >
                <div style={{padding:'20px', borderBottom:`1px solid ${HUB.border}`}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px'}}>
                    <div>
                      <span style={{fontSize:'8px', color:HUB.textMuted, display:'block', marginBottom:'4px', letterSpacing:'0.1em'}}>{d.category} CLASS</span>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        <img src={getDriverHeadshotUrl(d)} alt={d.name} style={{width:'44px', height:'44px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}`}} loading="lazy"/>
                        <h3 style={{fontSize:'16px', fontFamily:HUB.fontBold, margin:0, color:'#fff'}}>{d.name.toUpperCase()}</h3>
                      </div>
                    </div>
                    {isAcademy ? <span style={pill(true)}>ACADEMY</span> : <span style={pill(false)}>MARKET: {d.market}</span>}
                  </div>
                  <p style={{fontSize:'12px', color:HUB.textMuted, margin:0}}>Age {d.age} · Salary ${d.salary}M · Est. Potential {potential} OVR</p>
                </div>

                <div style={{padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', flex:1}}>
                   <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                     <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Pace</span>
                     <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.pace||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                     <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Quali</span>
                     <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.quali||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                     <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Racecraft</span>
                     <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.racecraft||0).toFixed(1)}</span>
                   </div>
                   <div style={{background:'rgba(255,255,255,0.01)', padding:'8px 12px', borderRadius:'4px', border:'1px solid rgba(255,255,255,0.02)'}}>
                     <span style={{fontSize:'9px', color:HUB.textMuted, display:'block', marginBottom:'2px'}}>Consistency</span>
                     <span style={{fontSize:'14px', fontWeight:700, color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{(d.consistency||0).toFixed(1)}</span>
                   </div>
                </div>

                <div style={{padding:'20px', borderTop:`1px solid ${HUB.border}`, background:'rgba(0,0,0,0.1)'}}>
                  <button onClick={() => handleSign(d)} disabled={!!state.team.reserveDriver} style={{...actionBtn({width:'100%', borderRadius:'4px'}), opacity: state.team.reserveDriver ? 0.5 : 1}}>
                    {state.team.reserveDriver ? 'SYSTEM AT CAPACITY' : 'OFFER RESERVE CONTRACT'}
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
           {sectionLabel('Talent Scouting')}
           {pageTitle('Driver Market')}
           {pageSubtitle('Establish constructor setup registry before scouting prospective candidates.')}
         </div>
       </div>
     );
     mountLayout(root, 'market', content);
     return;
  }

  const content = <MarketScreen onRefresh={() => renderMarket(root)} />;
  mountLayout(root, 'market', content, () => renderMarket(root));
}
