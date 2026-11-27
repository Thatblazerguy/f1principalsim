import React from 'react';
import { state } from "../state.js";
import { ensureSeasonTimeline, getRoundRaceDay, formatSeasonDate } from "../utils/seasonTimeline.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';

export function renderCalendar(root) {
  ensureSeasonTimeline(state);
  const activeCalendar = state.season.calendar || [];
  const totalRounds = activeCalendar.length;
  const currentDay = state.season.currentDay;

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {pageTitle('Calendar')}
          {pageSubtitle('Follow every round and see exactly where your season currently stands.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Current day')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{statValue(currentDay)}</span></div>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Total rounds')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums' }}>{statValue(totalRounds)}</span></div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px'}}>
        {activeCalendar.map(r => {
          const raceDay = getRoundRaceDay(r.round);
          const isCompleted = currentDay > raceDay;
          const isToday = currentDay === raceDay;
          const daysAway = raceDay - currentDay;

          return (
            <div key={r.round} style={{...glassCard(), position:'relative', borderColor: isToday ? 'rgba(225,6,0,0.4)' : HUB.border, backgroundColor: isToday ? HUB.accentSoft : HUB.surface}}>
              <p style={{fontSize: '11px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color:HUB.textMuted, margin:'0 0 8px'}}>Round {r.round}</p>
              <h3 style={{fontSize:'18px', fontWeight: 400, fontFamily: "'Formula1-Bold', sans-serif", color:HUB.textPrimary, margin:'0 0 12px'}}>{r.name}</h3>
              
              <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px'}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={HUB.textMuted} strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>{formatSeasonDate(state.season.year || 1, raceDay)}</span>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>· {r.laps} laps</span>
              </div>

              <div style={{display:'flex'}}>
                <span style={{...pill(isToday), display:'inline-flex', alignItems:'center', gap:'6px'}}>
                  {isCompleted && <span aria-hidden style={{width:6, height:6, borderRadius:'50%', backgroundColor:HUB.positive}} />}
                  {isCompleted ? "Completed" : isToday ? "Race day" : `In ${daysAway} days`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  mountLayout(root, 'calendar', content, () => renderCalendar(root));
}
