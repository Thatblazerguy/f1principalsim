import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle } from '../../components/HubLayout.tsx';
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
    showNotif(`Decision resolved · approval ${newApproval > career.approvalRating ? '+' : ''}${newApproval - career.approvalRating}% vs before`);
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
    <div style={{ minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 900, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}><ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard</button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        {pageTitle('FIA decisions')}
        <button onClick={handleAddEvent} className={btnClass('secondary')} style={btn('secondary', 'md')}>Generate decision</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4, background: HUB.surface, border: `1px solid ${HUB.border}`, borderRadius: 10, width: 'fit-content' }}>
        {(['pending', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            height: 32, padding: '0 20px', borderRadius: 8, fontFamily: HUB.fontBold, fontSize: 12,
            background: tab === t ? HUB.raised : 'transparent',
            border: '1px solid transparent',
            color: tab === t ? HUB.textPrimary : HUB.textMuted, cursor: 'pointer',
            transition: `background-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
          }}>
            {t === 'pending' ? `Pending (${decisions.length})` : `Resolved (${resolved.length})`}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {decisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: HUB.textMuted }}>
              <CheckCircle size={36} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 12 }} />
              <p style={{ fontFamily: HUB.fontRegular, fontSize: 14 }}>No pending decisions</p>
            </div>
          ) : decisions.map(event => (
            <div key={event.instanceId} style={{ ...glassCard({ padding: '24px' }) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} strokeWidth={1.5} color={HUB.warning} />
                <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Decision required</span>
              </div>
              <h3 style={{ fontFamily: HUB.fontBold, fontSize: 18, color: HUB.textPrimary, margin: '0 0 8px' }}>{event.title}</h3>
              <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, lineHeight: 1.6, margin: '0 0 20px' }}>{event.description}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {event.choices.map(choice => (
                  <button
                    key={choice.id}
                    onClick={() => handleResolve(event.instanceId, choice.id)}
                    className={btnClass('secondary')}
                    style={btn('secondary', 'md', { width: '100%', justifyContent: 'space-between' })}
                    title={choice.label}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{choice.label}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: choice.approvalDelta >= 0 ? HUB.positive : HUB.negative }}>
                        {choice.approvalDelta >= 0 ? '+' : ''}{choice.approvalDelta}% approval
                      </span>
                      {choice.budgetDelta !== 0 && (
                        <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: choice.budgetDelta >= 0 ? HUB.positive : HUB.negative }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {resolved.length === 0 ? (
            <p style={{ textAlign: 'center', color: HUB.textMuted, padding: '60px 0', fontFamily: HUB.fontRegular, fontSize: 14 }}>No resolved decisions yet</p>
          ) : [...resolved].reverse().map((event: any, i) => {
            const choice = event.choices?.find(c => c.id === event.resolvedChoice);
            return (
              <div key={i} style={{ ...glassCard({ padding: '16px' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary, margin: '0 0 4px' }}>{event.title}</h4>
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>{choice?.label || 'Choice resolved'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {choice?.approvalDelta !== undefined && (
                      <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: choice.approvalDelta >= 0 ? HUB.positive : HUB.negative }}>
                        {choice.approvalDelta >= 0 ? '+' : ''}{choice.approvalDelta}% approval
                      </span>
                    )}
                    <CheckCircle size={16} strokeWidth={1.5} color={HUB.textFaint} />
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
