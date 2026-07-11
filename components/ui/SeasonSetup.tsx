import React, { useState, useEffect } from 'react';
import { HUB, glassCard, actionBtn, sectionLabel, pageTitle, pageSubtitle, pill } from '../components/HubLayout.tsx';
import { Settings, ShieldAlert, Zap, CloudRain, Shield, AlertTriangle, ChevronRight, Activity, Map, MapPin } from "lucide-react";
import { calendar as ALL_CIRCUITS } from '../data/calendar.js';
import { getCircuitProfile } from '../utils/devProjects.js';
import { getCompetitivenessForecast } from '../utils/teamState.js';
import { state } from '../state.js';

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
        {pageTitle('Championship Format')}
        {pageSubtitle('Configure the rules and length of the upcoming season. Development timescales and costs will scale dynamically.')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Calendar Length</h3>
          <p style={{ margin: 0, fontSize: '13px', color: HUB.textMuted }}>Select the number of races. Shorter seasons have cheaper, faster development.</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {[6, 12, 24].map(rounds => (
              <button 
                key={rounds}
                onClick={() => setRules({...rules, totalRounds: rounds})}
                style={{
                  ...actionBtn({ backgroundColor: rules.totalRounds === rounds ? HUB.accent : 'rgba(255,255,255,0.05)', color: rules.totalRounds === rounds ? '#fff' : HUB.textMuted }),
                  flex: 1
                }}
              >
                {rounds} Races
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...glassCard({ padding: '24px' }), display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Sprint Weekends</h3>
          <p style={{ margin: 0, fontSize: '13px', color: HUB.textMuted }}>Enable or disable sprint races at selected venues.</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              onClick={() => setRules({...rules, sprints: true})}
              style={{ ...actionBtn({ backgroundColor: rules.sprints ? HUB.accent : 'rgba(255,255,255,0.05)', color: rules.sprints ? '#fff' : HUB.textMuted }), flex: 1 }}
            >Enabled</button>
            <button 
              onClick={() => setRules({...rules, sprints: false})}
              style={{ ...actionBtn({ backgroundColor: !rules.sprints ? HUB.accent : 'rgba(255,255,255,0.05)', color: !rules.sprints ? '#fff' : HUB.textMuted }), flex: 1 }}
            >Disabled</button>
          </div>
        </div>
      </div>

      <div style={{ ...glassCard({ padding: '24px' }) }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '16px', color: '#fff' }}>Simulation Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {/* Weather */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
            <CloudRain size={20} color={HUB.accent} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#fff' }}>Weather</h4>
            <select value={rules.weather ? 'dynamic' : 'dry'} onChange={(e) => setRules({...rules, weather: e.target.value === 'dynamic'})} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>
              <option value="dynamic">Dynamic</option>
              <option value="dry">Dry Only</option>
            </select>
          </div>
          {/* Safety Cars */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
            <ShieldAlert size={20} color={HUB.accent} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#fff' }}>Safety Cars</h4>
            <select value={rules.scFrequency} onChange={(e) => setRules({...rules, scFrequency: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          {/* Reliability */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
            <Zap size={20} color={HUB.accent} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#fff' }}>Failures</h4>
            <select value={rules.failures} onChange={(e) => setRules({...rules, failures: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          {/* AI Aggressiveness */}
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
            <AlertTriangle size={20} color={HUB.accent} style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#fff' }}>AI Aggression</h4>
            <select value={rules.aiAggressiveness} onChange={(e) => setRules({...rules, aiAggressiveness: e.target.value})} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button onClick={() => setStep(2)} style={actionBtn({ backgroundColor: HUB.accent })}>Next: Circuit Selection <ChevronRight size={16}/></button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          {sectionLabel('Step 2 of 3')}
          {pageTitle('Circuit Selection')}
          {pageSubtitle(`Select ${rules.totalRounds} circuits for the upcoming championship calendar.`)}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 800, color: selectedCircuits.length === rules.totalRounds ? '#10b981' : '#f59e0b' }}>
          {selectedCircuits.length} / {rules.totalRounds} Selected
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '16px' }}>
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
                border: isSelected ? `2px solid ${HUB.accent}` : `1px solid ${HUB.border}`,
                background: isSelected ? 'rgba(225, 6, 0, 0.05)' : 'rgba(0,0,0,0.4)',
                opacity: (!isSelected && selectedCircuits.length >= rules.totalRounds) ? 0.5 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#fff', fontWeight: 700 }}>{c.name}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: HUB.textMuted }}>{c.country}</p>
                </div>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${isSelected ? HUB.accent : '#555'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: HUB.accent }} />}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ ...pill(false), fontSize: '10px' }}>{profile.type}</span>
                <span style={{ ...pill(false), fontSize: '10px' }}>Diff: {c.difficulty}</span>
              </div>
              
              <div style={{ fontSize: '11px', color: HUB.textMuted }}>
                <strong>Key:</strong> {profile.strengths.map(s => s.split('.')[1]).join(', ') || 'Balanced'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={() => setStep(1)} style={actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.border}` })}>Back</button>
        <button 
          onClick={() => setStep(3)} 
          disabled={selectedCircuits.length !== rules.totalRounds}
          style={{ ...actionBtn({ backgroundColor: selectedCircuits.length === rules.totalRounds ? HUB.accent : 'rgba(255,255,255,0.1)' }), opacity: selectedCircuits.length === rules.totalRounds ? 1 : 0.5 }}
        >
          Next: Season Forecast <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        {sectionLabel('Step 3 of 3')}
        {pageTitle('Engineering Forecast')}
        {pageSubtitle('AI projection of your car\'s competitiveness across the selected calendar.')}
      </div>

      <div style={{ ...glassCard({ padding: '24px' }), overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${HUB.border}`, color: HUB.textMuted, fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px' }}>Rnd</th>
              <th style={{ padding: '12px' }}>Circuit</th>
              <th style={{ padding: '12px' }}>Track Type</th>
              <th style={{ padding: '12px' }}>Proj. Rank</th>
              <th style={{ padding: '12px' }}>Expected Finish</th>
            </tr>
          </thead>
          <tbody>
            {selectedCircuits.map((cName, idx) => {
              const c = ALL_CIRCUITS.find(circ => circ.name === cName);
              const profile = getCircuitProfile(c.circuit);
              const forecast = getCompetitivenessForecast(state, c.circuit);
              
              return (
                <tr key={cName} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                  <td style={{ padding: '12px', color: '#fff', fontFamily: HUB.fontMono }}>{idx + 1}</td>
                  <td style={{ padding: '12px', color: '#fff', fontWeight: 700 }}>{cName}</td>
                  <td style={{ padding: '12px', color: HUB.textMuted, fontSize: '13px' }}>{profile.type}</td>
                  <td style={{ padding: '12px', color: '#fff', fontFamily: HUB.fontMono, fontWeight: 700 }}>P{forecast.rank}</td>
                  <td style={{ padding: '12px', color: forecast.rank <= 3 ? '#10b981' : forecast.rank <= 6 ? '#3b82f6' : '#f59e0b', fontSize: '13px', fontWeight: 600 }}>{forecast.finish}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button onClick={() => setStep(2)} style={actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.border}` })}>Back</button>
        <button onClick={handleComplete} style={actionBtn({ backgroundColor: HUB.accent })}>Confirm Season Setup</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
