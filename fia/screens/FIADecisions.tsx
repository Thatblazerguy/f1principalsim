import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import { fiaCareer, saveFIACareer, setFIACareer, FIA_EVENT_TEMPLATES, generateRandomEvent } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';

function FIADecisionsScreen({ appRoot }) {
  const career = fiaCareer!;
  const [decisions, setDecisions] = useState(career.pendingDecisions || []);
  const [resolved, setResolved] = useState(career.resolvedDecisions || []);
  const [notification, setNotification] = useState('');
  const [tab, setTab] = useState<'pending' | 'resolved'>('pending');

  const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 2500); };

  const handleResolve = (eventId: string, choiceId: string) => {
    const event = decisions.find(e => e.instanceId === eventId);
    if (!event) return;
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return;

    const newApproval = Math.max(0, Math.min(100, career.approvalRating + (choice.approvalDelta || 0)));
    const newBudget = career.finances.budget + (choice.budgetDelta || 0);

    const newPending = decisions.filter(e => e.instanceId !== eventId);
    const newResolved = [...resolved, { ...event, resolvedChoice: choiceId, resolvedAt: Date.now() }];

    const updated = {
      ...career,
      approvalRating: newApproval,
      finances: { ...career.finances, budget: newBudget },
      pendingDecisions: newPending,
      resolvedDecisions: newResolved,
    };

    setFIACareer(updated);
    saveFIACareer();
    setDecisions(newPending);
    setResolved(newResolved);
    showNotif(`Decision resolved. Approval: ${newApproval > career.approvalRating ? '+' : ''}${newApproval - career.approvalRating}%`);
  };

  const handleAddEvent = () => {
    const event = generateRandomEvent(career);
    const newPending = [...decisions, event];
    setDecisions(newPending);
    const updated = { ...career, pendingDecisions: newPending };
    setFIACareer(updated);
    saveFIACareer();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 900, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 12, padding: 0 }}>← FIA Dashboard</button>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>FIA Governance</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: 0, textTransform: 'uppercase' }}>FIA Decisions</h1>
        <button onClick={handleAddEvent} style={{ ...actionBtn({ padding: '10px 20px', fontSize: 11 }) }}>+ Generate Decision</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 10, width: 'fit-content' }}>
        {(['pending', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, fontFamily: HUB.fontBold, fontSize: 12,
            background: tab === t ? 'rgba(225,6,0,0.12)' : 'transparent',
            border: tab === t ? '1px solid rgba(225,6,0,0.3)' : '1px solid transparent',
            color: tab === t ? '#fff' : HUB.textMuted, cursor: 'pointer',
          }}>
            {t === 'pending' ? `Pending (${decisions.length})` : `Resolved (${resolved.length})`}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {decisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: HUB.textMuted }}>
              <CheckCircle size={36} color="rgba(16,185,129,0.3)" style={{ marginBottom: 12 }} />
              <p style={{ fontFamily: HUB.fontRegular, fontSize: 14 }}>No pending decisions — the FIA is running smoothly.</p>
            </div>
          ) : decisions.map(event => (
            <div key={event.instanceId} style={{ ...glassCard({ padding: '24px' }), border: '1px solid rgba(225,6,0,0.15)', background: 'rgba(225,6,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={14} color={FIA.accent} />
                <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Decision Required</span>
              </div>
              <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: '#fff', margin: '0 0 10px' }}>{event.title}</h3>
              <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, lineHeight: 1.6, margin: '0 0 20px' }}>{event.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {event.choices.map(choice => (
                  <button
                    key={choice.id}
                    onClick={() => handleResolve(event.instanceId, choice.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 8, textAlign: 'left',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff', cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 13,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    <span>{choice.label}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: choice.approvalDelta >= 0 ? FIA.green : FIA.accent }}>
                        {choice.approvalDelta >= 0 ? '+' : ''}{choice.approvalDelta}% approval
                      </span>
                      {choice.budgetDelta !== 0 && (
                        <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: choice.budgetDelta >= 0 ? FIA.green : FIA.accent }}>
                          {choice.budgetDelta >= 0 ? '+' : ''}${choice.budgetDelta}M
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'resolved' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resolved.length === 0 ? (
            <p style={{ textAlign: 'center', color: HUB.textMuted, padding: '60px 0', fontFamily: HUB.fontRegular, fontSize: 14 }}>No resolved decisions yet.</p>
          ) : [...resolved].reverse().map((event: any, i) => {
            const choice = event.choices?.find(c => c.id === event.resolvedChoice);
            return (
              <div key={i} style={{ ...glassCard({ padding: '16px 20px' }), opacity: 0.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff', margin: '0 0 4px' }}>{event.title}</h4>
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, margin: 0 }}>{choice?.label || 'Choice resolved'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {choice?.approvalDelta !== undefined && (
                      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: choice.approvalDelta >= 0 ? FIA.green : FIA.accent }}>
                        {choice.approvalDelta >= 0 ? '+' : ''}{choice.approvalDelta}% approval
                      </span>
                    )}
                    <CheckCircle size={14} color={FIA.green} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function renderFIADecisions(root: HTMLElement) {
  renderToAppRoot(root, <FIADecisionsScreen appRoot={root} />);
}
