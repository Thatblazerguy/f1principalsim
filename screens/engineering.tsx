import React, { useState } from 'react';
import { state } from "../state.js";
import { syncGame } from "../lib/supabaseApi.js";
import { ensureTeamState, getTeamRoster } from "../utils/teamState.js";
import { COMPONENT_CATALOG, ensureEngineeringState, getActiveComponent, fitNewComponent, swapComponent, getEngineeringAdvisorNotes } from "../utils/engineeringSystem.js";
import { mountLayout, HUB, glassCard, statCell, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue, pill } from '../components/HubLayout.tsx';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { AlertTriangle, Wrench, RefreshCw, Zap, TrendingDown, Clock, ShieldAlert } from 'lucide-react';

function getHealthColor(wear: number) {
  if (wear < 30) return '#10b981';
  if (wear < 60) return '#eab308';
  if (wear < 80) return '#f97316';
  return '#ef4444';
}

function ComponentCard({ appState, driverName, compKey, catalog, onSwap, onFit }: any) {
  const pool = appState.engineering.driverPools[driverName][compKey];
  const active = pool.find((c: any) => c.active) || pool[0];
  const healthColor = getHealthColor(active.wear);

  return (
    <div style={{ ...glassCard({ padding: '16px' }), display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '12px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>{catalog.name}</span>
          <h4 style={{ fontSize: '18px', color: '#fff', margin: '2px 0 0', fontFamily: HUB.fontMono }}>{active.id}</h4>
        </div>
        <span style={{ fontSize: '12px', color: HUB.textMuted }}>{pool.length}/{catalog.allocation}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Condition</span>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(0, 100 - active.wear)}%`, background: healthColor }} />
          </div>
          <span style={{ fontSize: '12px', color: healthColor, fontFamily: HUB.fontMono, display: 'block', marginTop: '4px' }}>{Math.max(0, 100 - active.wear).toFixed(0)}%</span>
        </div>
        <div>
          <span style={{ fontSize: '10px', color: HUB.textMuted, display: 'block', marginBottom: '4px' }}>Performance</span>
          <span style={{ fontSize: '14px', color: '#fff', fontFamily: HUB.fontMono }}>{active.performance.toFixed(1)}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {pool.length > 1 && (
          <button onClick={onSwap} style={{ ...actionBtn({ padding: '6px 10px', fontSize: '11px', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.border}` }) }}>
            <RefreshCw size={12} style={{ marginRight: '4px' }} /> Swap
          </button>
        )}
        <button onClick={onFit} style={{ ...actionBtn({ padding: '6px 10px', fontSize: '11px', flex: 1, backgroundColor: pool.length >= catalog.allocation ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }) }}>
          <Zap size={12} style={{ marginRight: '4px' }} /> Fit New
        </button>
      </div>
    </div>
  );
}

function EngineeringDashboard({ root }: { root: HTMLElement }) {
  ensureTeamState(state.team!);
  ensureEngineeringState(state);
  
  const [selectedDriver, setSelectedDriver] = useState<string>(state.team!.drivers[0]?.name || "");
  const [flashMessage, setFlashMessage] = useState("");
  const roster = [...state.team!.drivers, ...(state.team!.reserveDriver ? [state.team!.reserveDriver] : [])];
  
  const handleSwap = async (compKey: string) => {
    const pool = state.engineering.driverPools[selectedDriver][compKey];
    const activeIndex = pool.findIndex((c: any) => c.active);
    const nextIndex = (activeIndex + 1) % pool.length;
    
    if (swapComponent(state, selectedDriver, compKey, nextIndex)) {
      setFlashMessage(`Swapped to ${compKey}-${nextIndex + 1} for ${selectedDriver}.`);
      await syncGame();
    }
  };

  const handleFit = async (compKey: string) => {
    if (confirm(`Are you sure you want to fit a new ${compKey}? Exceeding allocation incurs grid penalties.`)) {
      const res = fitNewComponent(state, selectedDriver, compKey);
      if (res && res.ok) {
        setFlashMessage(`Fitted new ${res.newId} for ${selectedDriver}. ${res.penalty > 0 ? `PENALTY: +${res.penalty} Grid Places applied.` : ''}`);
        await syncGame();
      }
    }
  };

  const driverNotes = getEngineeringAdvisorNotes(state, selectedDriver);
  const pendingPenalty = state.engineering.pendingPenalties[selectedDriver] || 0;

  return (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'24px'}}>
        <div>
          {sectionLabel('Engineering')}
          {pageTitle('Power Unit & Reliability')}
          {pageSubtitle('Manage individual components, monitor wear, and navigate FIA allocations and grid penalties.')}
        </div>
        <div style={{display:'flex', gap:'16px', flexWrap:'wrap', justifyContent:'flex-end'}}>
           <div style={statCell({minWidth:'120px'})}>{statLabel('Pending Penalty')}{statValue(`+${pendingPenalty} Grid`, pendingPenalty > 0 ? '#ef4444' : '#10b981')}</div>
        </div>
      </div>

      {flashMessage && (
        <div style={{padding:'14px 16px', background:'rgba(255,255,255,0.05)', border:`1px solid ${HUB.accent}`, borderRadius:'8px', color:'#fff', fontSize:'13px', marginBottom:'24px'}}>
          {flashMessage}
        </div>
      )}

      {/* Driver Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {roster.map(driver => (
          <button 
            key={driver.name}
            onClick={() => setSelectedDriver(driver.name)}
            style={{
              padding: '12px 20px',
              background: selectedDriver === driver.name ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)',
              border: `1px solid ${selectedDriver === driver.name ? HUB.accent : HUB.border}`,
              borderRadius: '8px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontFamily: HUB.fontBold
            }}
          >
            <img src={getDriverHeadshotUrl(driver)} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
            {driver.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* Component Grid */}
        <div style={{ gridColumn: 'span 8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {Object.entries(COMPONENT_CATALOG).map(([key, catalog]) => (
            <ComponentCard 
              key={key} 
              appState={state} 
              driverName={selectedDriver} 
              compKey={key} 
              catalog={catalog} 
              onSwap={() => handleSwap(key)}
              onFit={() => handleFit(key)}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ ...glassCard(), padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18}/> Chief Engineer Notes
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {driverNotes.map((note: string, idx: number) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: note.includes('CRITICAL') ? '#ef4444' : note.includes('Warning') ? '#eab308' : HUB.accent, marginTop: '7px', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#ddd', margin: 0, lineHeight: 1.45 }}>{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...glassCard(), padding: '20px' }}>
             <h3 style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={18}/> FIA Regulations
            </h3>
            <p style={{ fontSize: '13px', color: HUB.textMuted, lineHeight: 1.5, margin: 0 }}>
              Each driver is allocated a restricted number of power unit elements per season. Exceeding these allocations results in a <strong>10-place grid penalty</strong> for the first additional element, and a <strong>5-place drop</strong> for subsequent elements of the same type.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

export function renderEngineering(root: HTMLElement) {
  ensureTeamState(state.team!);
  mountLayout(root, 'engineering', <EngineeringDashboard root={root} />, () => renderEngineering(root));
}
