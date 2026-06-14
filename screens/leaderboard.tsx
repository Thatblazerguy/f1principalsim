import React from 'react';
import { state } from '../state.js';
import { ensureTeamState, getTeamRoster } from '../utils/teamState.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { mountLayout, unmountLayout, HUB, glassCard, statCell, pill, sectionLabel, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';

export function renderLeaderboard(root) {
  ensureTeamState(state.team);

  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);
  const knownDriverTeams = new Map();
  allTeams.forEach(team => {
    const roster = team === state.team ? getTeamRoster(team) : team.drivers;
    roster.forEach(d => { if (!knownDriverTeams.has(d.name)) knownDriverTeams.set(d.name, team.name); });
  });
  Object.keys(state.standings.drivers).forEach(n => { if (!knownDriverTeams.has(n)) knownDriverTeams.set(n, 'Guest'); });

  const playerTeamName = state.team.name;
  const driverRows = [...knownDriverTeams.entries()]
    .map(([name, teamName]) => ({ name, teamName, points: state.standings.drivers[name] ?? 0, isYours: teamName === playerTeamName }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const teamRows = allTeams
    .map(t => ({ name: t.name, points: state.standings.teams[t.name] ?? 0, isYours: t === state.team }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const tableHead = (cols) => (
    <div style={{ display:'grid', gridTemplateColumns:cols, padding:'8px 16px', marginBottom:'4px' }}>
      {['POS','NAME','TEAM','PTS'].map(h => (
        <span key={h} style={{ fontSize:'9px', fontWeight:700, color:'rgba(148,163,184,0.5)', letterSpacing:'0.18em', textTransform:'uppercase', fontFamily:HUB.fontBold }}>{h}</span>
      ))}
    </div>
  );

  const driverRow = (row, idx) => (
    <div key={row.name} style={{
      display:'grid', gridTemplateColumns:'48px 1fr 1fr 80px', alignItems:'center', padding:'12px 16px',
      borderLeft: row.isYours ? `2px solid ${HUB.accent}` : '2px solid transparent',
      backgroundColor: row.isYours ? 'rgba(225,6,0,0.06)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderBottom: `1px solid ${HUB.border}`,
    }}>
      <span style={{ fontSize:'13px', fontWeight:700, color: row.isYours ? HUB.accent : HUB.textMuted, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em' }}>P{idx+1}</span>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <img src={getDriverHeadshotUrl(row.name)} alt={row.name} style={{ width:'28px', height:'28px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}` }} loading="lazy" />
        <span style={{ fontSize:'13px', fontWeight: row.isYours ? 700 : 500, color:'#fff', fontFamily:HUB.fontBold }}>{row.name}</span>
        {row.isYours && <span style={{ fontSize:'9px', fontWeight:700, backgroundColor:HUB.accent, color:'#fff', padding:'2px 8px', borderRadius:'999px', letterSpacing:'0.1em', fontFamily:HUB.fontBold }}>YOU</span>}
      </div>
      <span style={{ fontSize:'12px', color:HUB.textMuted }}>{row.teamName}</span>
      <span style={{ fontSize:'13px', fontWeight:700, color: row.isYours ? HUB.accent : '#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', textAlign:'right' }}>{row.points}</span>
    </div>
  );

  const teamRow = (row, idx) => (
    <div key={row.name} style={{
      display:'grid', gridTemplateColumns:'48px 1fr 1fr 80px', alignItems:'center', padding:'12px 16px',
      borderLeft: row.isYours ? `2px solid ${HUB.accent}` : '2px solid transparent',
      backgroundColor: row.isYours ? 'rgba(225,6,0,0.06)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
      borderBottom: `1px solid ${HUB.border}`,
    }}>
      <span style={{ fontSize:'13px', fontWeight:700, color: row.isYours ? HUB.accent : HUB.textMuted, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em' }}>P{idx+1}</span>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'13px', fontWeight: row.isYours ? 700 : 500, color:'#fff', fontFamily:HUB.fontBold }}>{row.name}</span>
        {row.isYours && <span style={{ fontSize:'9px', fontWeight:700, backgroundColor:HUB.accent, color:'#fff', padding:'2px 8px', borderRadius:'999px', letterSpacing:'0.1em', fontFamily:HUB.fontBold }}>YOU</span>}
      </div>
      <span style={{ fontSize:'12px', color:HUB.textMuted }}>{row.isYours ? 'Player Team' : 'AI Team'}</span>
      <span style={{ fontSize:'13px', fontWeight:700, color: row.isYours ? HUB.accent : '#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', textAlign:'right' }}>{row.points}</span>
    </div>
  );

  const content = (
    <div>
      {/* Page header */}
      <div style={{ marginBottom:'32px' }}>
        {sectionLabel('Championships')}
        {pageTitle('Standings')}
        {pageSubtitle('Track both the Drivers and Constructors championships across the full grid.')}
      </div>

      {/* Stat overview */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'32px' }}>
        {[
          { label:'Your Team', val: state.team.name },
          { label:'Team Points', val: state.standings.teams[state.team.name] ?? 0 },
          { label:'Current Round', val: `R${state.season.round}` },
        ].map(s => (
          <div key={s.label} style={statCell()}>
            <p style={{ fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 6px' }}>{s.label}</p>
            <p style={{ fontSize:'20px', fontWeight:700, color:'#fff', margin:0, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em' }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Two tables */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
        {/* Drivers */}
        <div style={{ ...glassCard({ padding:0 }), overflow:'hidden' }}>
          <div style={{ padding:'20px 20px 12px', borderBottom:`1px solid ${HUB.border}` }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:HUB.accent, textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 2px' }}>Drivers</p>
            <h3 style={{ fontSize:'18px', fontWeight:800, color:'#fff', margin:0 }}>Drivers Championship</h3>
          </div>
          {tableHead('48px 1fr 1fr 80px')}
          <div>{driverRows.map((row, idx) => driverRow(row, idx))}</div>
        </div>

        {/* Teams */}
        <div style={{ ...glassCard({ padding:0 }), overflow:'hidden' }}>
          <div style={{ padding:'20px 20px 12px', borderBottom:`1px solid ${HUB.border}` }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:HUB.accent, textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 2px' }}>Constructors</p>
            <h3 style={{ fontSize:'18px', fontWeight:800, color:'#fff', margin:0 }}>Constructors Championship</h3>
          </div>
          {tableHead('48px 1fr 1fr 80px')}
          <div>{teamRows.map((row, idx) => teamRow(row, idx))}</div>
        </div>
      </div>
    </div>
  );

  mountLayout(root, 'standings', content, () => renderLeaderboard(root));
}
