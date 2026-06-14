import React from 'react';
import { state } from "../state.js";
import { ensureTeamState, getTeamRoster, getActiveDrivers } from "../utils/teamState.js";
import { getDriverHeadshotUrl, getDriverNumber } from "../data/drivers.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';

export function renderTeams(root) {
  ensureTeamState(state.team);
  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);

  const buildDriverRow = (driver, role, highlight) => {
    const number = getDriverNumber(driver);
    return (
      <div key={driver.name} style={{
        display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px',
        borderBottom:`1px solid ${HUB.border}`, background: highlight ? 'rgba(225,6,0,0.06)' : 'transparent',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
          <span style={{fontSize:'13px', fontWeight:700, color:HUB.textMuted, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em', minWidth:'24px'}}>#{number}</span>
          <img src={getDriverHeadshotUrl(driver)} alt={driver.name} style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover', border:`1px solid ${HUB.border}`}} loading="lazy"/>
          <div>
            <p style={{fontSize:'14px', fontWeight:700, color:'#fff', margin:'0 0 2px'}}>{driver.name}</p>
            <p style={{fontSize:'10px', color:HUB.textMuted, textTransform:'uppercase', margin:0}}>{role}</p>
          </div>
        </div>
        <span style={pill()}>Mkt {driver.market}</span>
      </div>
    );
  };

  const buildTeamCard = (team, isPlayer) => {
    const raceDrivers = isPlayer ? getActiveDrivers(team) : team.drivers;
    const reserve = team.reserveDriver;
    return (
      <div key={team.name} style={{...glassCard({padding:0}), overflow:'hidden'}}>
        <div style={{padding:'24px', borderBottom:`1px solid ${HUB.border}`, background: isPlayer ? 'rgba(225,6,0,0.04)' : 'transparent'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
            <div>
              <p style={{fontSize:'10px', fontWeight:700, color: isPlayer ? HUB.accent : HUB.textMuted, letterSpacing:'0.15em', textTransform:'uppercase', margin:'0 0 4px'}}>{isPlayer ? "Your Team" : "Competitor"}</p>
              <h3 style={{fontSize:'20px', fontWeight:800, color:'#fff', margin:0}}>{team.name}</h3>
            </div>
            <div style={{display:'flex', gap:'8px'}}>
              <span style={pill()}>{raceDrivers.length} Main</span>
              <span style={pill()}>{reserve ? 1 : 0} Res</span>
            </div>
          </div>
          <div style={{display:'flex', gap:'16px'}}>
             <span style={{fontSize:'12px', color:HUB.textMuted}}>Car Perf: <strong style={{color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{team.carPerformance}</strong></span>
             <span style={{fontSize:'12px', color:HUB.textMuted}}>Budget: <strong style={{color:'#fff', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>${team.budget}M</strong></span>
          </div>
        </div>

        <div>
          <div style={{padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderBottom:`1px solid ${HUB.border}`}}>
            <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em'}}>Race Lineup</span>
          </div>
          {raceDrivers.length ? raceDrivers.map(d => buildDriverRow(d, "Race Driver", isPlayer)) : <div style={{padding:'16px', color:HUB.textMuted, fontSize:'12px'}}>No drivers assigned.</div>}
          
          <div style={{padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderBottom:`1px solid ${HUB.border}`}}>
            <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em'}}>Reserve</span>
          </div>
          {reserve ? buildDriverRow(reserve, "Reserve Driver", isPlayer) : <div style={{padding:'16px', color:HUB.textMuted, fontSize:'12px'}}>No reserve driver.</div>}
        </div>
      </div>
    );
  };

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('Competition View')}
          {pageTitle('Teams')}
          {pageSubtitle('Review every team in the championship, including their current race lineup.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Total Teams')}{statValue(allTeams.length)}</div>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Season Year')}{statValue(state.season.year || 1)}</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(400px, 1fr))', gap:'24px'}}>
        {allTeams.map((t, idx) => buildTeamCard(t, idx === 0))}
      </div>
    </div>
  );

  mountLayout(root, 'teams', content, () => renderTeams(root));
}
