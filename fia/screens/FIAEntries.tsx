import React, { useState } from 'react';
import { Users, CheckCircle, X, Plus, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle, sectionLabel } from '../../components/HubLayout.tsx';
import { fiaCareer, saveFIACareer, setFIACareer } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';
import { aiTeams } from '../../data/teams.js';

const ENTRY_APPLICATIONS = [
  { id: 'andretti', name: 'Andretti Global', country: 'USA', powerUnit: 'GM/Cadillac', budget: 120, status: 'pending', description: 'American manufacturer backed by General Motors. Strong brand recognition.' },
  { id: 'hitech', name: 'Hitech Grand Prix', country: 'UK', powerUnit: 'Mercedes', budget: 95, status: 'pending', description: 'British outfit with F2/F3 experience applying for a full F1 entry.' },
];

function TeamCard({ team, isPlayer = false }) {
  return (
    <div style={{ ...glassCard({ padding: '16px' }), display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: isPlayer ? HUB.accentSoft : HUB.raised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Users size={16} strokeWidth={1.5} color={isPlayer ? HUB.accentInk : HUB.textMuted} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: HUB.textPrimary }}>{team.name}</div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>{team.powerUnit || 'Power unit TBC'}</div>
      </div>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: HUB.positive }} />Active</span>
    </div>
  );
}

function ApplicationCard({ app, onApprove, onReject }) {
  return (
    <div style={{ ...glassCard({ padding: '24px' }) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h4 style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, margin: '0 0 4px' }}>{app.name}</h4>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>{app.country} · {app.powerUnit} · Budget: ${app.budget}M</p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: HUB.warning }} />Pending</span>
      </div>
      <p style={{ fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textMuted, marginBottom: 16, lineHeight: 1.5 }}>{app.description}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onApprove(app.id)} className={btnClass('secondary')} style={btn('secondary', 'sm')}>
          <CheckCircle size={14} strokeWidth={1.5} />Approve entry
        </button>
        <button onClick={() => onReject(app.id)} className={btnClass('danger')} style={btn('danger', 'sm')}>
          <X size={14} strokeWidth={1.5} />Reject entry
        </button>
      </div>
    </div>
  );
}

function FIAEntriesScreen({ appRoot }) {
  const career = fiaCareer!;
  const [applications, setApplications] = useState<any[]>(career.entryApplications?.length ? career.entryApplications : ENTRY_APPLICATIONS);
  const [notification, setNotification] = useState('');

  const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 2500); };

  const maxGrid = career.regulations?.sporting?.maxGridSize?.value || 22;
  const currentTeams = aiTeams;

  const handleApprove = (id: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    const updated = { ...career, entryApplications: applications.map(a => a.id === id ? { ...a, status: 'approved' } : a) };
    setFIACareer(updated); saveFIACareer();
    showNotif('Team entry approved for next season');
  };

  const handleReject = (id: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    const updated = { ...career, entryApplications: applications.map(a => a.id === id ? { ...a, status: 'rejected' } : a) };
    setFIACareer(updated); saveFIACareer();
    showNotif('Team entry rejected');
  };

  return (
    <div style={{ minHeight: '100vh', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 1000, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}><ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        {pageTitle('Team entries')}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: HUB.textPrimary }}>{currentTeams.length * 2} / {maxGrid}</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint }}>Grid cars · max {maxGrid}</div>
        </div>
      </div>

      {/* Grid Usage Bar */}
      <div style={{ ...glassCard({ padding: '24px' }), marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted }}>Grid utilization</span>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{currentTeams.length} teams · {currentTeams.length * 2} cars</span>
        </div>
        <div style={{ height: 8, background: HUB.raised, borderRadius: 4 }}>
          <div style={{ height: '100%', width: `${Math.min(100, (currentTeams.length * 2 / maxGrid) * 100)}%`, background: HUB.textMuted, borderRadius: 4, transition: `width 400ms ${HUB.ease}` }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Current Teams */}
        <div>
          <div style={{ marginBottom: 8 }}>{sectionLabel(`Active teams (${currentTeams.length})`)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentTeams.map((team: any, i) => (
              <TeamCard key={team.name} team={team} />
            ))}
          </div>
        </div>

        {/* Applications */}
        <div>
          <div style={{ marginBottom: 8 }}>{sectionLabel(`Entry applications (${applications.filter(a => a.status === 'pending').length})`)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.filter(a => a.status === 'pending').map(app => (
              <ApplicationCard key={app.id} app={app} onApprove={handleApprove} onReject={handleReject} />
            ))}
            {applications.filter(a => a.status !== 'pending').map(app => (
              <div key={app.id} style={{ ...glassCard({ padding: '16px' }) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 13, color: HUB.textMuted }}>{app.name}</span>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: app.status === 'approved' ? HUB.positive : HUB.negative, textTransform: 'capitalize' }}>{app.status}</span>
                </div>
              </div>
            ))}
            {applications.filter(a => a.status === 'pending').length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: HUB.textMuted }}>
                <Plus size={28} strokeWidth={1.5} color={HUB.textFaint} style={{ marginBottom: 8 }} />
                <p style={{ fontFamily: HUB.fontRegular, fontSize: 13 }}>No pending applications</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderFIAEntries(root: HTMLElement) {
  renderToAppRoot(root, <FIAEntriesScreen appRoot={root} />);
}
