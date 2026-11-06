import React, { useState } from 'react';
import { Users, CheckCircle, X, Plus } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
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
      <div style={{ width: 36, height: 36, borderRadius: 8, background: isPlayer ? 'rgba(225,6,0,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Users size={16} color={isPlayer ? FIA.accent : HUB.textMuted} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: HUB.fontBold, fontSize: 13, color: '#fff' }}>{team.name}</div>
        <div style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>{team.powerUnit || 'Power Unit TBC'}</div>
      </div>
      <span style={{ fontFamily: HUB.fontBold, fontSize: 9, color: FIA.green, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</span>
    </div>
  );
}

function ApplicationCard({ app, onApprove, onReject }) {
  return (
    <div style={{ ...glassCard({ padding: '20px' }), border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h4 style={{ fontFamily: HUB.fontBold, fontSize: 15, color: '#fff', margin: '0 0 4px' }}>{app.name}</h4>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted, margin: 0 }}>{app.country} · {app.powerUnit} · Budget: ${app.budget}M</p>
        </div>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 9, color: '#F59E0B', padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', textTransform: 'uppercase' }}>Pending</span>
      </div>
      <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginBottom: 16, lineHeight: 1.5 }}>{app.description}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onApprove(app.id)} style={{ ...actionBtn({ padding: '8px 18px', fontSize: 11 }), display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={13} /> Approve
        </button>
        <button onClick={() => onReject(app.id)} style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(225,6,0,0.08)', border: '1px solid rgba(225,6,0,0.2)', color: FIA.accent, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <X size={13} /> Reject
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
    showNotif('Team entry approved for next season.');
  };

  const handleReject = (id: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    const updated = { ...career, entryApplications: applications.map(a => a.id === id ? { ...a, status: 'rejected' } : a) };
    setFIACareer(updated); saveFIACareer();
    showNotif('Team entry rejected.');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular, padding: '40px 64px', maxWidth: 1000, margin: '0 auto' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 12, padding: 0 }}>← FIA Dashboard</button>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Grid Management</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Team Entries</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 24, color: '#fff' }}>{currentTeams.length * 2} / {maxGrid}</div>
          <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>Grid cars · Max {maxGrid}</div>
        </div>
      </div>

      {/* Grid Usage Bar */}
      <div style={{ ...glassCard({ padding: '20px' }), marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Grid Utilization</span>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{currentTeams.length} teams · {currentTeams.length * 2} cars</span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${Math.min(100, (currentTeams.length * 2 / maxGrid) * 100)}%`, background: FIA.accent, borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Current Teams */}
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Active Teams ({currentTeams.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentTeams.map((team: any, i) => (
              <TeamCard key={team.name} team={team} />
            ))}
          </div>
        </div>

        {/* Applications */}
        <div>
          <div style={{ fontFamily: HUB.fontBold, fontSize: 11, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Entry Applications ({applications.filter(a => a.status === 'pending').length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {applications.filter(a => a.status === 'pending').map(app => (
              <ApplicationCard key={app.id} app={app} onApprove={handleApprove} onReject={handleReject} />
            ))}
            {applications.filter(a => a.status !== 'pending').map(app => (
              <div key={app.id} style={{ ...glassCard({ padding: '14px' }), opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: '#fff' }}>{app.name}</span>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: app.status === 'approved' ? FIA.green : FIA.accent, textTransform: 'uppercase' }}>{app.status}</span>
                </div>
              </div>
            ))}
            {applications.filter(a => a.status === 'pending').length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: HUB.textMuted }}>
                <Plus size={28} color="rgba(255,255,255,0.1)" style={{ marginBottom: 8 }} />
                <p style={{ fontFamily: HUB.fontRegular, fontSize: 12 }}>No pending applications.</p>
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
