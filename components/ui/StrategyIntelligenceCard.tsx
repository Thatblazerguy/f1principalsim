import React, { useState, useEffect } from 'react';
import { HUB, actionBtn } from '../HubLayout.tsx';
import { Activity, AlertTriangle, CloudRain, ShieldAlert, Cpu } from 'lucide-react';

export function StrategyIntelligenceCard({ strategyEngine }) {
  const [analysis, setAnalysis] = useState(null);
  const [simOption, setSimOption] = useState("PIT_THIS_LAP");
  const [simResult, setSimResult] = useState(null);
  
  // Use a player car for the dashboard display
  const playerCarId = strategyEngine?.engine?.cars?.find(c => c.isPlayer)?.id;

  useEffect(() => {
    // 1 Hz refresh for strategy data so it doesn't thrash the UI
    const interval = setInterval(() => {
      if (strategyEngine) {
        strategyEngine.update();
        setAnalysis({ ...strategyEngine.analysis });
        
        if (playerCarId) {
          setSimResult(strategyEngine.simulateStrategy(playerCarId, simOption));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [strategyEngine, simOption, playerCarId]);

  if (!analysis || !analysis.drivers || !playerCarId || !analysis.drivers[playerCarId]) {
    return <div style={{ padding: '16px', color: HUB.textMuted }}>Initializing Strategy Intelligence...</div>;
  }

  const driverAnalysis = analysis.drivers[playerCarId];
  const { weather, safetyCar } = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      
      {/* Race Engineer Alert */}
      <div style={{ backgroundColor: 'rgba(225,6,0,0.15)', border: `1px solid ${HUB.accent}`, borderRadius: '8px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Cpu color={HUB.accent} size={20} style={{ marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '10px', color: HUB.accent, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Race Engineer</div>
          <div style={{ fontSize: '13px', color: '#fff', fontStyle: 'italic' }}>
            "{driverAnalysis.engineerMsgs[0]}"
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Recommended Strategy */}
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Recommended</span>
            <span style={{ color: '#10b981' }}>{driverAnalysis.recommendedStrategy.confidence}% Conf</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono, marginBottom: '4px', lineHeight: '1.2' }}>
            {driverAnalysis.recommendedStrategy.type.replace('->', '→')}
          </div>
          <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: 'auto' }}>
            Target: {driverAnalysis.recommendedStrategy.window}
          </div>
        </div>

        {/* Live Projections */}
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Live Projection</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
             <span style={{ fontSize: '10px', color: HUB.textMuted }}>Current</span>
             <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{driverAnalysis.currentRank}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '10px', color: HUB.textMuted }}>Alternative</span>
             <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#10b981' }}>{driverAnalysis.alternativeRank}</span>
          </div>
        </div>
      </div>

      {/* Pit Window & Tyre Analysis */}
      <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={12} color={HUB.accent} /> Pit Window Analysis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Status</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: driverAnalysis.pitWindow.status === 'OPEN' ? '#10b981' : '#fff' }}>{driverAnalysis.pitWindow.status}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Loss</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444' }}>{driverAnalysis.pitWindow.loss}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Undercut</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: driverAnalysis.pitWindow.undercutAvailable ? '#10b981' : '#fff' }}>
              {driverAnalysis.pitWindow.undercutAvailable ? 'AVAILABLE' : 'NONE'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Gain</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981' }}>{driverAnalysis.pitWindow.gain}</div>
          </div>
        </div>
        
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '12px 0' }}></div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Tyre</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{driverAnalysis.tyres.compound}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Wear</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: driverAnalysis.tyres.wear > 70 ? '#ef4444' : '#fff' }}>{driverAnalysis.tyres.wear}%</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Remaining</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{driverAnalysis.tyres.remaining} Laps</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Delta</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fb923c' }}>{driverAnalysis.tyres.paceDrop}</div>
          </div>
        </div>
      </div>

      {/* Safety Car & Weather */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px' }}>
           <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={12} color="#facc15" /> Safety Car Risk
           </div>
           <div style={{ fontSize: '20px', fontWeight: 'bold', color: safetyCar.probability > 30 ? '#ef4444' : '#fff', marginBottom: '4px' }}>
              {safetyCar.probability}%
           </div>
           <div style={{ fontSize: '10px', color: HUB.textMuted }}>VSC Probability: {safetyCar.vscProbability}%</div>
        </div>
        <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px' }}>
           <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CloudRain size={12} color="#3b82f6" /> Weather Intel
           </div>
           <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', marginBottom: '2px' }}>
              {weather.forecast}
           </div>
           <div style={{ fontSize: '10px', color: '#fb923c' }}>Rec: {weather.recommendation}</div>
        </div>
      </div>

      {/* Strategy Simulator */}
      <div style={{ backgroundColor: 'rgba(10,10,10,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
         <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '12px' }}>Strategy Simulator</div>
         
         <div style={{ display: 'flex', gap: '4px', backgroundColor: '#000', padding: '4px', borderRadius: '4px', marginBottom: '12px' }}>
            {[
              { id: "PIT_THIS_LAP", label: "PIT THIS LAP" },
              { id: "PIT_IN_2", label: "PIT IN 2 LAPS" },
              { id: "PIT_IN_5", label: "PIT IN 5 LAPS" }
            ].map(opt => (
              <button 
                key={opt.id}
                onClick={() => setSimOption(opt.id)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase',
                  background: simOption === opt.id ? HUB.accent : '#000',
                  color: simOption === opt.id ? '#fff' : HUB.textMuted,
                  border: simOption === opt.id ? `1px solid ${HUB.accent}` : '1px solid transparent',
                  borderRadius: '4px', cursor: 'pointer',
                  margin: '0', 
                  minWidth: '0',
                  textShadow: 'none',
                  boxShadow: 'none'
                }}
              >
                {opt.label}
              </button>
            ))}
         </div>

         {simResult && (
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
              <div>
                <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Projected Finish</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{simResult.projectedFinish}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Net Delta</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#10b981' }}>{simResult.timeGain} <span style={{ color: '#ef4444', marginLeft: '4px' }}>{simResult.timeLoss}</span></div>
              </div>
           </div>
         )}
      </div>

    </div>
  );
}
