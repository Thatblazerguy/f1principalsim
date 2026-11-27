import React, { useState, useEffect } from 'react';
import { HUB, glassCard, btn, btnClass, sectionLabel, pageTitle, pageSubtitle, pill } from '../HubLayout.tsx';
import { Settings, ShieldAlert, Zap, CloudRain, Shield, AlertTriangle, ChevronRight, ArrowLeft, Activity, Map, MapPin } from "lucide-react";
import { calendar as ALL_CIRCUITS } from '../../data/calendar.js';
import { getCircuitProfile } from '../../utils/devProjects.js';
import { getCompetitivenessForecast } from '../../utils/teamState.js';
import { state } from '../../state.js';

export function SeasonSetup({ onComplete, initialRules = null }) {
  const [step, setStep] = useState(1);
  const [rules, setRules] = useState(initialRules || {
    totalRounds: 24,
    sprints: true,
    weather: true,
    scFrequency: 'normal',
    failures: 'normal',
    aiAggressiveness: 'normal'
  });
  
  const [selectedCircuits, setSelectedCircuits] = useState(() => {
    // default select first 'totalRounds' if custom, otherwise all
    return ALL_CIRCUITS.slice(0, rules.totalRounds).map(c => c.name);
  });
  
  useEffect(() => {
    if (rules.totalRounds === 24) {
      setSelectedCircuits(ALL_CIRCUITS.map(c => c.name));
    } else {
      // Trim if over
      if (selectedCircuits.length > rules.totalRounds) {
        setSelectedCircuits(selectedCircuits.slice(0, rules.totalRounds));
      }
    }
  }, [rules.totalRounds]);

  const handleCircuitToggle = (name) => {
    if (selectedCircuits.includes(name)) {
      if (selectedCircuits.length > 1) { // prevent 0 circuits
        setSelectedCircuits(selectedCircuits.filter(c => c !== name));
      }
    } else {
      if (selectedCircuits.length < rules.totalRounds) {
        setSelectedCircuits([...selectedCircuits, name]);
      }
    }
  };

  const handleComplete = () => {
    // Generate actual calendar array in original order
    const newCalendar = ALL_CIRCUITS.filter(c => selectedCircuits.includes(c.name))
      .map((c, i) => ({ ...c, round: i + 1 }));
      
    onComplete(rules, newCalendar);
  };
  


  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        {sectionLabel('Step 1 of 3')}
        {pageTitle('Championship format')}
        {pageSubtitle('Configure the rules and length of the upcoming season. Development timescales and costs scale with season length.')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Calendar length</h3>
          <p style={{ margin: 0, fontSize: '13px', color: HUB.textMuted }}>Select the number of races. Shorter seasons have cheaper, faster development.</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {[6, 12, 24].map(rounds => (
              <button 
                key={rounds}
                onClick={() => setRules({...rules, totalRounds: rounds})}
                aria-pressed={rules.totalRounds === rounds}
                className="hub-btn"
                style={{
                  ...btn('secondary', 'sm', rules.totalRounds === rounds ? { backgroundColor: HUB.accentSoft, borderColor: 'rgba(225,6,0,0.4)' } : { color: HUB.textMuted }),
                  flex: 1
                }}
              >
                {rounds} races
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Sprint weekends</h3>
          <p style={{ margin: 0, fontSize: '13px', color: HUB.textMuted }}>Enable or disable sprint races at selected venues.</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              onClick={() => setRules({...rules, sprints: true})}
              aria-pressed={rules.sprints}
              className="hub-btn"
              style={{ ...btn('secondary', 'sm', rules.sprints ? { backgroundColor: HUB.accentSoft, borderColor: 'rgba(225,6,0,0.4)' } : { color: HUB.textMuted }), flex: 1 }}
            >Enabled</button>
            <button 
              onClick={() => setRules({...rules, sprints: false})}
              aria-pressed={!rules.sprints}
              className="hub-btn"
              style={{ ...btn('secondary', 'sm', !rules.sprints ? { backgroundColor: HUB.accentSoft, borderColor: 'rgba(225,6,0,0.4)' } : { color: HUB.textMuted }), flex: 1 }}
            >Disabled</button>
          </div>
        </div>
      </div>

      <div style={{ ...glassCard({ padding: '24px' }) }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '16px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Simulation parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {/* Weather */}
          <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, padding: '16px', borderRadius: '8px' }}>
            <CloudRain size={16} strokeWidth={1.5} color={HUB.textMuted} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Weather</h4>
            <select value={rules.weather ? 'dynamic' : 'dry'} onChange={(e) => setRules({...rules, weather: e.target.value === 'dynamic'})} style={{ width: '100%', height: '36px', background: HUB.raised, border: `1px solid ${HUB.borderMid}`, color: HUB.textPrimary, padding: '0 8px', borderRadius: '8px', cursor: 'pointer', fontFamily: HUB.fontRegular }}>
              <option value="dynamic">Dynamic</option>
              <option value="dry">Dry only</option>
            </select>
          </div>
          {/* Safety Cars */}
          <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, padding: '16px', borderRadius: '8px' }}>
            <ShieldAlert size={16} strokeWidth={1.5} color={HUB.textMuted} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Safety cars</h4>
            <select value={rules.scFrequency} onChange={(e) => setRules({...rules, scFrequency: e.target.value})} style={{ width: '100%', height: '36px', background: HUB.raised, border: `1px solid ${HUB.borderMid}`, color: HUB.textPrimary, padding: '0 8px', borderRadius: '8px', cursor: 'pointer', fontFamily: HUB.fontRegular }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          {/* Reliability */}
          <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, padding: '16px', borderRadius: '8px' }}>
            <Zap size={16} strokeWidth={1.5} color={HUB.textMuted} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>Failures</h4>
            <select value={rules.failures} onChange={(e) => setRules({...rules, failures: e.target.value})} style={{ width: '100%', height: '36px', background: HUB.raised, border: `1px solid ${HUB.borderMid}`, color: HUB.textPrimary, padding: '0 8px', borderRadius: '8px', cursor: 'pointer', fontFamily: HUB.fontRegular }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          {/* AI Aggressiveness */}
          <div style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, padding: '16px', borderRadius: '8px' }}>
            <AlertTriangle size={16} strokeWidth={1.5} color={HUB.textMuted} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>AI aggression</h4>
            <select value={rules.aiAggressiveness} onChange={(e) => setRules({...rules, aiAggressiveness: e.target.value})} style={{ width: '100%', height: '36px', background: HUB.raised, border: `1px solid ${HUB.borderMid}`, color: HUB.textPrimary, padding: '0 8px', borderRadius: '8px', cursor: 'pointer', fontFamily: HUB.fontRegular }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button onClick={() => setStep(2)} className={btnClass('primary')} style={btn('primary', 'md')}>Next: circuits <ChevronRight size={16} strokeWidth={1.5}/></button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          {sectionLabel('Step 2 of 3')}
          {pageTitle('Circuits')}
          {pageSubtitle(`Select ${rules.totalRounds} circuits for the upcoming championship calendar.`)}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: selectedCircuits.length === rules.totalRounds ? HUB.textPrimary : HUB.warning }}>
          {selectedCircuits.length} / {rules.totalRounds} selected
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', maxHeight: 'calc(60*var(--vh))', overflowY: 'auto', paddingRight: '16px' }}>
        {ALL_CIRCUITS.map(c => {
          const isSelected = selectedCircuits.includes(c.name);
          const profile = getCircuitProfile(c.circuit);
          return (
            <div 
              key={c.name}
              onClick={() => handleCircuitToggle(c.name)}
              style={{
                ...glassCard({ padding: '16px' }), 
                cursor: 'pointer',
                border: `1px solid ${isSelected ? 'rgba(225,6,0,0.4)' : HUB.border}`,
                background: isSelected ? HUB.accentSoft : HUB.surface,
                transition: `background-color 150ms ${HUB.ease}, border-color 150ms ${HUB.ease}`,
                opacity: (!isSelected && selectedCircuits.length >= rules.totalRounds) ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{c.name}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: HUB.textMuted }}>{c.country}</p>
                </div>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isSelected ? HUB.accent : HUB.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: HUB.accent }} />}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ ...pill(false), fontSize: '11px' }}>{profile.type}</span>
                <span style={{ ...pill(false), fontSize: '11px' }}>Difficulty {c.difficulty}</span>
              </div>
              
              <div style={{ fontSize: '12px', color: HUB.textMuted }}>
                <span style={{ color: HUB.textFaint }}>Key</span> {profile.strengths.map(s => s.split('.')[1]).join(', ') || 'Balanced'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={() => setStep(1)} className={btnClass('secondary')} style={btn('secondary', 'md')}><ArrowLeft size={16} strokeWidth={1.5} /> Back to format</button>
        <button 
          onClick={() => setStep(3)} 
          disabled={selectedCircuits.length !== rules.totalRounds}
          className={btnClass('primary')}
          style={btn('primary', 'md')}
        >
          Next: forecast <ChevronRight size={16} strokeWidth={1.5}/>
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        {sectionLabel('Step 3 of 3')}
        {pageTitle('Season forecast')}
        {pageSubtitle('Projected competitiveness of your car at each circuit on the calendar.')}
      </div>

      <div style={{ ...glassCard({ padding: '24px' }), overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${HUB.border}`, color: HUB.textMuted, fontSize: '12px' }}>
              <th style={{ padding: '12px', fontWeight: 400 }}>Round</th>
              <th style={{ padding: '12px', fontWeight: 400 }}>Circuit</th>
              <th style={{ padding: '12px', fontWeight: 400 }}>Track type</th>
              <th style={{ padding: '12px', fontWeight: 400 }}>Projected rank</th>
              <th style={{ padding: '12px', fontWeight: 400 }}>Expected finish</th>
            </tr>
          </thead>
          <tbody>
            {selectedCircuits.map((cName, idx) => {
              const c = ALL_CIRCUITS.find(circ => circ.name === cName);
              const profile = getCircuitProfile(c.circuit);
              const forecast = getCompetitivenessForecast(state, c.circuit);
              
              return (
                <tr key={cName} style={{ borderBottom: `1px solid ${HUB.border}` }}>
                  <td style={{ padding: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono }}>{idx + 1}</td>
                  <td style={{ padding: '12px', color: HUB.textPrimary, fontWeight: 400, fontFamily: HUB.fontBold }}>{cName}</td>
                  <td style={{ padding: '12px', color: HUB.textMuted, fontSize: '13px' }}>{profile.type}</td>
                  <td style={{ padding: '12px', color: HUB.textPrimary, fontFamily: HUB.fontMono, fontWeight: 400 }}>P{forecast.rank}</td>
                  <td style={{ padding: '12px', color: forecast.rank <= 3 ? HUB.positive : HUB.textPrimary, fontSize: '13px', fontWeight: 400, fontFamily: HUB.fontBold }}>{forecast.finish}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={() => setStep(2)} className={btnClass('secondary')} style={btn('secondary', 'md')}><ArrowLeft size={16} strokeWidth={1.5} /> Back to circuits</button>
        <button onClick={handleComplete} className={btnClass('primary')} style={btn('primary', 'md')}>Confirm season setup</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
