import React, { useState } from 'react';
import { DollarSign, RefreshCw, X, CheckCircle } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, actionBtn } from '../../components/HubLayout.tsx';
import { CIRCUIT_LIBRARY } from '../circuitLibrary.js';
import { fiaCareer, saveFIACareer, setFIACareer } from '../fiaState.js';
import { FIA } from '../FIADashboard.tsx';
import { renderFIADashboard } from '../FIADashboard.tsx';
import { calendar } from '../../data/calendar.js';

function buildDefaultContracts(career) {
  const contracts: Record<string, any> = { ...(career.hostingContracts || {}) };
  calendar.forEach(race => {
    if (!contracts[race.circuit]) {
      const lib = CIRCUIT_LIBRARY.find(c => c.circuitId === race.circuit);
      contracts[race.circuit] = {
        circuitId: race.circuit,
        name: race.name,
        hostingFee: lib?.hostingFee || 40,
        duration: 3,
        yearsRemaining: 2 + Math.floor(Math.random() * 4),
        status: 'active',
        promoterRelation: 70 + Math.floor(Math.random() * 25),
        annualRevenue: lib?.annualRevenue || 50,
      };
    }
  });
  return contracts;
}

function ContractCard({ contract, onRenew, onTerminate }) {
  const statusColor = contract.status === 'active' ? '#10B981' : contract.status === 'expired' ? '#EF4444' : '#F59E0B';
  const profit = contract.annualRevenue - contract.hostingFee;

  return (
    <div style={{ ...glassCard({ padding: '20px' }), border: `1px solid ${statusColor}22` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h4 style={{ fontFamily: HUB.fontBold, fontSize: 14, color: '#fff', margin: '0 0 4px' }}>{contract.name}</h4>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted, margin: 0 }}>
            {contract.yearsRemaining} year{contract.yearsRemaining !== 1 ? 's' : ''} remaining
          </p>
        </div>
        <span style={{ fontFamily: HUB.fontBold, fontSize: 9, color: statusColor, padding: '2px 8px', borderRadius: 4, background: `${statusColor}15`, textTransform: 'uppercase' }}>
          {contract.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Hosting Fee', value: `$${contract.hostingFee}M`, color: FIA.accent },
          { label: 'Revenue', value: `$${contract.annualRevenue}M`, color: FIA.green },
          { label: 'Net Profit', value: `${profit >= 0 ? '+' : ''}$${profit}M`, color: profit >= 0 ? FIA.green : FIA.accent },
        ].map((s, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 9, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: s.color, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Promoter Relation bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: HUB.fontRegular, fontSize: 10, color: HUB.textMuted }}>Promoter Relationship</span>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 10, color: '#fff' }}>{contract.promoterRelation}%</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${contract.promoterRelation}%`, background: contract.promoterRelation >= 70 ? FIA.green : '#F59E0B', borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onRenew(contract.circuitId)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: FIA.green, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}>
          <RefreshCw size={12} /> Renew
        </button>
        <button onClick={() => onTerminate(contract.circuitId)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, background: 'rgba(225,6,0,0.06)', border: '1px solid rgba(225,6,0,0.15)', color: FIA.accent, cursor: 'pointer', fontFamily: HUB.fontBold, fontSize: 11 }}>
          <X size={12} /> Terminate
        </button>
      </div>
    </div>
  );
}

function FIAContractsScreen({ appRoot }) {
  const career = fiaCareer!;
  const [contracts, setContracts] = useState<Record<string, any>>(() => buildDefaultContracts(career));
  const [notification, setNotification] = useState('');

  const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(''), 2500); };

  const handleRenew = (circuitId: string) => {
    const updated = { ...contracts, [circuitId]: { ...contracts[circuitId], yearsRemaining: 3, status: 'active', promoterRelation: Math.min(100, contracts[circuitId].promoterRelation + 10) } };
    setContracts(updated);
    const updatedCareer = { ...career, hostingContracts: updated };
    setFIACareer(updatedCareer); saveFIACareer();
    showNotif('Contract renewed for 3 more years.');
  };

  const handleTerminate = (circuitId: string) => {
    const updated = { ...contracts, [circuitId]: { ...contracts[circuitId], status: 'terminated', yearsRemaining: 0 } };
    setContracts(updated);
    const updatedCareer = { ...career, hostingContracts: updated };
    setFIACareer(updatedCareer); saveFIACareer();
    showNotif('Contract terminated.');
  };

  const totalRevenue = Object.values(contracts).reduce((sum: number, c: any) => sum + (c.status === 'active' ? c.annualRevenue : 0), 0);
  const totalFees = Object.values(contracts).reduce((sum: number, c: any) => sum + (c.status === 'active' ? c.hostingFee : 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#060911', color: '#fff', fontFamily: HUB.fontRegular, padding: '40px 64px' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', padding: '12px 20px', borderRadius: 10, fontFamily: HUB.fontBold, fontSize: 12, color: FIA.green }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} style={{ background: 'none', border: 'none', color: HUB.textMuted, cursor: 'pointer', fontFamily: HUB.fontRegular, fontSize: 12, marginBottom: 12, padding: 0 }}>← FIA Dashboard</button>
      <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: FIA.accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Venue Agreements</div>
      <h1 style={{ fontFamily: HUB.fontWide, fontSize: 26, color: '#fff', margin: '0 0 24px', textTransform: 'uppercase' }}>Hosting Contracts</h1>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Revenue', value: `$${totalRevenue}M`, color: FIA.green },
          { label: 'Total Fees', value: `$${totalFees}M`, color: FIA.accent },
          { label: 'Net Result', value: `${totalRevenue - totalFees >= 0 ? '+' : ''}$${totalRevenue - totalFees}M`, color: totalRevenue - totalFees >= 0 ? FIA.green : FIA.accent },
        ].map((s, i) => (
          <div key={i} style={{ ...glassCard({ padding: '20px' }) }}>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 10, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 28, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>Annual estimate</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {Object.values(contracts).map((contract: any) => (
          <ContractCard key={contract.circuitId} contract={contract} onRenew={handleRenew} onTerminate={handleTerminate} />
        ))}
      </div>
    </div>
  );
}

export function renderFIAContracts(root: HTMLElement) {
  renderToAppRoot(root, <FIAContractsScreen appRoot={root} />);
}
