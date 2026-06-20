import React, { useState, useEffect, useRef } from 'react';
import { HUB, actionBtn } from '../HubLayout.tsx';
import { Target, MessageSquare, ArrowRight, Activity } from 'lucide-react';

export function RaceEngineerPanel({ strategyEngine, engine }) {
  const [analysis, setAnalysis] = useState(null);
  const [chatFeed, setChatFeed] = useState([]);
  const [simOption, setSimOption] = useState("PIT_THIS_LAP");
  const chatEndRef = useRef(null);

  const playerCarId = strategyEngine?.engine?.cars?.find(c => c.isPlayer)?.id;

  useEffect(() => {
    const interval = setInterval(() => {
      if (strategyEngine) {
        setAnalysis({ ...strategyEngine.analysis });
        setChatFeed([...strategyEngine.chatFeed]);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [strategyEngine]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatFeed]);

  if (!analysis || !analysis.drivers || !playerCarId || !analysis.drivers[playerCarId]) {
    return <div style={{ padding: '16px', color: HUB.textMuted }}>Connecting to Pit Wall...</div>;
  }

  const driverAnalysis = analysis.drivers[playerCarId];
  const { objective, recommendedAction, engineerMsgs } = driverAnalysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      {/* Objective Dashboard (30%) */}
      <div style={{ backgroundColor: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Target size={14} color={HUB.accent} />
          <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Race Engineer</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
           <div>
             <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Current Objective</div>
             <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
               {objective.id.toUpperCase().replace(/_/g, ' ')}
             </div>
           </div>
           <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
             <div style={{ fontSize: '12px', fontWeight: 'bold', color: objective.status === "ON TARGET" ? '#10b981' : objective.status === "AT RISK" ? '#f59e0b' : '#ef4444' }}>
               {objective.status}
             </div>
           </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '4px' }}>
           <div>
             <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Projected Finish</div>
             <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', fontFamily: HUB.fontMono }}>{objective.projectedFinish}</div>
           </div>
           <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase' }}>Confidence</div>
             <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981', fontFamily: HUB.fontMono }}>{objective.confidence}%</div>
           </div>
        </div>
      </div>

      {/* Engineer Chat Feed (70%) */}
      <div style={{ flex: 1, backgroundColor: 'rgba(10,10,10,0.85)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <MessageSquare size={14} color={HUB.textMuted} />
           <span style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Comms</span>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {chatFeed.map((msg, idx) => {
            const isEngineer = msg.sender === 'Engineer';
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isEngineer ? 'flex-start' : 'flex-end' }}>
                <span style={{ fontSize: '9px', color: HUB.textMuted, marginBottom: '4px', padding: '0 4px' }}>{msg.sender}</span>
                <div style={{ 
                  backgroundColor: isEngineer ? 'rgba(255,255,255,0.05)' : 'rgba(225,6,0,0.15)', 
                  border: `1px solid ${isEngineer ? 'rgba(255,255,255,0.1)' : 'rgba(225,6,0,0.3)'}`,
                  padding: '8px 12px', 
                  borderRadius: isEngineer ? '2px 8px 8px 8px' : '8px 2px 8px 8px',
                  maxWidth: '85%'
                }}>
                  <span style={{ fontSize: '12px', color: '#fff', lineHeight: '1.4' }}>{msg.message}</span>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Recommended Action Pinned to Bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
           <div style={{ fontSize: '10px', color: HUB.accent, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.1em' }}>Recommended Action</div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div>
               <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{recommendedAction.type}</div>
               <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '2px' }}>Expected Gain: {recommendedAction.gain}</div>
             </div>
             <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#10b981' }}>{recommendedAction.confidence}%</div>
               <div style={{ fontSize: '10px', color: HUB.textMuted, marginTop: '2px' }}>Confidence</div>
             </div>
           </div>
        </div>
      </div>

    </div>
  );
}
