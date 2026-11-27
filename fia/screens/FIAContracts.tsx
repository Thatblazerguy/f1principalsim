import React, { useState } from 'react';
import { DollarSign, RefreshCw, X, CheckCircle, ArrowLeft } from 'lucide-react';
import { renderToAppRoot } from '../../utils/reactRoot.tsx';
import { HUB, glassCard, btn, btnClass, pageTitle } from '../../components/HubLayout.tsx';
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
  const statusColor = contract.status === 'active' ? HUB.positive : contract.status === 'expired' ? HUB.negative : HUB.warning;
  const profit = contract.annualRevenue - contract.hostingFee;

  return (
    <div style={{ ...glassCard({ padding: '24px' }) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h4 style={{ fontFamily: HUB.fontBold, fontSize: 16, color: HUB.textPrimary, margin: '0 0 4px' }}>{contract.name}</h4>
          <p style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, margin: 0 }}>
            {contract.yearsRemaining} year{contract.yearsRemaining !== 1 ? 's' : ''} remaining
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, textTransform: 'capitalize' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          {contract.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Hosting fee', value: `$${contract.hostingFee}M`, color: HUB.textPrimary },
          { label: 'Revenue', value: `$${contract.annualRevenue}M`, color: HUB.textPrimary },
          { label: 'Net profit', value: `${profit >= 0 ? '+' : ''}$${profit}M`, color: profit >= 0 ? HUB.positive : HUB.negative },
        ].map((s, i) => (
          <div key={i} style={{ background: HUB.raised, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textFaint }}>{s.label}</div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 14, color: s.color, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Promoter Relation bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: HUB.fontRegular, fontSize: 11, color: HUB.textMuted }}>Promoter relationship</span>
          <span style={{ fontFamily: HUB.fontBold, fontSize: 12, color: HUB.textPrimary }}>{contract.promoterRelation}%</span>
        </div>
        <div style={{ height: 4, background: HUB.raised, borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${contract.promoterRelation}%`, background: contract.promoterRelation >= 70 ? HUB.positive : HUB.warning, borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onRenew(contract.circuitId)} className={btnClass('secondary')} style={btn('secondary', 'sm', { flex: 1 })}>
          <RefreshCw size={14} strokeWidth={1.5} />Renew contract
        </button>
        <button onClick={() => onTerminate(contract.circuitId)} className={btnClass('danger')} style={btn('danger', 'sm', { flex: 1 })}>
          <X size={14} strokeWidth={1.5} />Terminate contract
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
    showNotif('Contract renewed for 3 more years');
  };

  const handleTerminate = (circuitId: string) => {
    const updated = { ...contracts, [circuitId]: { ...contracts[circuitId], status: 'terminated', yearsRemaining: 0 } };
    setContracts(updated);
    const updatedCareer = { ...career, hostingContracts: updated };
    setFIACareer(updatedCareer); saveFIACareer();
    showNotif('Contract terminated');
  };

  const totalRevenue = Object.values(contracts).reduce((sum: number, c: any) => sum + (c.status === 'active' ? c.annualRevenue : 0), 0);
  const totalFees = Object.values(contracts).reduce((sum: number, c: any) => sum + (c.status === 'active' ? c.hostingFee : 0), 0);

  return (
    <div style={{ minHeight: 'calc(100*var(--vh))', background: HUB.bg, color: HUB.textPrimary, fontFamily: HUB.fontRegular, padding: '40px 64px' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 200, background: HUB.raised, border: `1px solid ${HUB.borderMid}`, padding: '12px 20px', borderRadius: 8, fontFamily: HUB.fontRegular, fontSize: 13, color: HUB.textPrimary }}>
          {notification}
        </div>
      )}

      <button onClick={() => renderFIADashboard(appRoot)} className={btnClass('ghost')} style={btn('ghost', 'sm', { marginBottom: 12, marginLeft: -12 })}><ArrowLeft size={14} strokeWidth={1.5} />Back to FIA dashboard</button>
      <div style={{ marginBottom: 24 }}>{pageTitle('Hosting contracts')}</div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total revenue', value: `$${totalRevenue}M`, color: HUB.textPrimary },
          { label: 'Total fees', value: `$${totalFees}M`, color: HUB.textPrimary },
          { label: 'Net result', value: `${totalRevenue - totalFees >= 0 ? '+' : ''}$${totalRevenue - totalFees}M`, color: totalRevenue - totalFees >= 0 ? HUB.positive : HUB.negative },
        ].map((s, i) => (
          <div key={i} style={{ ...glassCard({ padding: '24px' }) }}>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textMuted, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: HUB.fontBold, fontSize: 28, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: HUB.fontRegular, fontSize: 12, color: HUB.textFaint, marginTop: 4 }}>Annual estimate</div>
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
