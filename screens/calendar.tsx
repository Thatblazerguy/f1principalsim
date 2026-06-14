import React from 'react';
import { calendar } from "../data/calendar.js";
import { state } from "../state.js";
import { ensureSeasonTimeline, getRoundRaceDay, formatSeasonDate } from "../utils/seasonTimeline.js";
import { mountLayout, HUB, glassCard, statCell, pill, actionBtn, sectionLabel, pageTitle, pageSubtitle, statLabel, statValue } from '../components/HubLayout.tsx';

export function renderCalendar(root) {
  ensureSeasonTimeline(state);
  const totalRounds = Math.min(state.season.totalRounds || calendar.length, calendar.length);
  const currentDay = state.season.currentDay;

  const content = (
    <div>
      <div style={{marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          {sectionLabel('Season Map')}
          {pageTitle('Calendar')}
          {pageSubtitle('Follow every round and see exactly where your season currently stands.')}
        </div>
        <div style={{display:'flex', gap:'16px'}}>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Current Day')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(currentDay)}</span></div>
          <div style={statCell({minWidth:'100px'})}>{statLabel('Total Rounds')}<span style={{fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>{statValue(totalRounds)}</span></div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'20px'}}>
        {calendar.slice(0, totalRounds).map(r => {
          const raceDay = getRoundRaceDay(r.round);
          const isCompleted = currentDay > raceDay;
          const isToday = currentDay === raceDay;
          const daysAway = raceDay - currentDay;

          return (
            <div key={r.round} style={{...glassCard({padding:'20px'}), position:'relative', borderLeft: isToday ? `4px solid ${HUB.accent}` : isCompleted ? `4px solid #10b981` : `1px solid ${HUB.border}`}}>
              <p style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, letterSpacing:'0.15em', textTransform:'uppercase', margin:'0 0 6px'}}>Round {r.round}</p>
              <h3 style={{fontSize:'18px', fontWeight:800, color:'#fff', margin:'0 0 12px'}}>{r.name}</h3>
              
              <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={HUB.textMuted} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>{formatSeasonDate(state.season.year || 1, raceDay)}</span>
                <span style={{fontSize:'12px', color:HUB.textMuted}}>• {r.laps} Laps</span>
              </div>

              <div style={{display:'flex'}}>
                <span style={{...pill(isToday), backgroundColor: isCompleted ? '#10b981' : isToday ? HUB.accent : 'rgba(255,255,255,0.05)', borderColor: isCompleted ? '#10b981' : isToday ? HUB.accent : HUB.border, color: isCompleted || isToday ? '#fff' : HUB.textMuted}}>
                  {isCompleted ? "Completed" : isToday ? "Race Day" : `Upcoming in ${daysAway}d`}
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
