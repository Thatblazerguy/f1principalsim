import React from 'react';
import { state } from '../state.js';
import { ensureTeamState, getTeamRoster, getActiveDrivers } from '../utils/teamState.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { mountLayout, HUB, glassCard, sectionLabel, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';
import { FormChips } from '../components/FormChips.tsx';
import { getDriverForm, getTeamForm, getMomentumScore, getDriverSeasonStats, getTeamSeasonStats } from '../game/raceHistory.js';
import { motion } from 'framer-motion';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';

let selectedDriver1: string | null = null;
let selectedDriver2: string | null = null;

export function renderLeaderboard(root) {
  ensureTeamState(state.team);

  const allTeams = [state.team, ...state.aiTeams].filter(Boolean);
  const knownDriverTeams = new Map();
  allTeams.forEach(team => {
    // Only include active race drivers (not reserves) so reserves never appear in standings
    const racers = team === state.team
      ? (getActiveDrivers(team).length > 0 ? getActiveDrivers(team) : team.drivers)
      : team.drivers;
    racers.forEach(d => { if (!knownDriverTeams.has(d.name)) knownDriverTeams.set(d.name, team.name); });
  });
  Object.keys(state.standings.drivers).forEach(n => { if (!knownDriverTeams.has(n)) knownDriverTeams.set(n, 'Guest'); });

  // Build a set of driver names who have actually started at least one race
  const raceStarters = new Set<string>();
  (state.raceHistory || []).forEach(race => {
    race.driverResults?.forEach(r => raceStarters.add(r.name));
  });

  const raceHistory = state.raceHistory || [];
  const currentSeason = state.season?.year || 1;
  const playerTeamName = state.team.name;

  const driverRows = [...knownDriverTeams.entries()]
    .map(([name, teamName]) => ({ name, teamName, points: state.standings.drivers[name] ?? 0, isYours: teamName === playerTeamName }))
    // Only show drivers who have started at least one race; always show the player's own active drivers
    .filter(row => raceStarters.has(row.name) || (row.isYours && raceStarters.size === 0))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const teamRows = allTeams
    .map(t => ({ name: t.name, points: state.standings.teams[t.name] ?? 0, isYours: t === state.team }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const myTeamIndex   = teamRows.findIndex(t => t.isYours);
  const myTeamPoints  = teamRows[myTeamIndex]?.points || 0;
  const leaderPoints  = teamRows[0]?.points || 0;
  const p4Points      = teamRows[3]?.points || 0;
  const gapToLeader   = leaderPoints - myTeamPoints;
  const gapToP4       = myTeamIndex > 3 ? p4Points - myTeamPoints : myTeamIndex < 3 ? myTeamPoints - p4Points : 0;
  const gapToP4Label  = myTeamIndex > 3 ? `-${gapToP4} pts` : myTeamIndex < 3 ? `+${gapToP4} pts` : '0 pts';

  const activeDrivers = getActiveDrivers(state.team);
  const allDriverNames = driverRows.map(d => d.name);
  if (!selectedDriver1 || !allDriverNames.includes(selectedDriver1)) selectedDriver1 = activeDrivers[0]?.name || allDriverNames[0] || '';
  if (!selectedDriver2 || !allDriverNames.includes(selectedDriver2)) selectedDriver2 = activeDrivers[1]?.name || allDriverNames[1] || '';

  // Real stats for comparison panel
  const s1 = getDriverSeasonStats(selectedDriver1!, raceHistory, currentSeason);
  const s2 = getDriverSeasonStats(selectedDriver2!, raceHistory, currentSeason);
  const v1_pts = selectedDriver1 ? (state.standings.drivers[selectedDriver1] || 0) : 0;
  const v2_pts = selectedDriver2 ? (state.standings.drivers[selectedDriver2] || 0) : 0;

  // Team momentum
  const myTeamForm = getTeamForm(playerTeamName, raceHistory, 5);
  const myMomentum = getMomentumScore(myTeamForm.map(f => ({ ...f, finishPos: f.bestPos ?? 1, retired: false })));
  const last5Pts   = myTeamForm.reduce((sum, r) => sum + r.points, 0);

  const selectStyle = {
    background: HUB.raised, border: `1px solid ${HUB.border}`,
    borderRadius: '8px', color: HUB.textPrimary, fontSize: '12px', fontFamily: HUB.fontBold,
    padding: '8px 12px', cursor: 'pointer', outline: 'none', width: '180px',
    textAlign: 'left' as const, appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px',
    paddingRight: '32px', textOverflow: 'ellipsis', transition: `border-color 150ms ${HUB.ease}, background-color 150ms ${HUB.ease}`,
  };

  const tableHead = (cols, headers) => (
    <div style={{ display:'grid', gridTemplateColumns:cols, padding:'12px 24px', borderBottom: `1px solid ${HUB.border}` }}>
      {headers.map((h, i) => (
        <span key={i} style={{ fontSize: '12px', fontWeight: 400, color:HUB.textFaint, fontFamily:HUB.fontRegular, textAlign: h.align || 'left' }}>
          {h.label}
        </span>
      ))}
    </div>
  );

  const comparisonMetrics = [
    { label: 'Pts',     v1: v1_pts,        v2: v2_pts,        better: 'higher' },
    { label: 'Wins',    v1: s1.wins,       v2: s2.wins,       better: 'higher' },
    { label: 'Podiums', v1: s1.podiums,    v2: s2.podiums,    better: 'higher' },
    { label: 'Avg finish', v1: s1.avgFinish ?? '—', v2: s2.avgFinish ?? '—', better: 'lower' },
    { label: 'Momentum',v1: getMomentumScore(getDriverForm(selectedDriver1!, raceHistory, 5).map(f => ({ finishPos: f.finishPos, retired: f.retired }))),
                        v2: getMomentumScore(getDriverForm(selectedDriver2!, raceHistory, 5).map(f => ({ finishPos: f.finishPos, retired: f.retired }))), better: 'higher' },
  ];

  const content = (
    <div>
      <div style={{marginBottom:'32px'}}>
        {pageTitle('Standings')}
        {pageSubtitle('Constructor and driver championships after every round.')}
      </div>

      {/* 1. Overview Hero */}
      <SlideUp delay={0.05}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: HUB.border, border: `1px solid ${HUB.border}`, borderRadius: HUB.radius, overflow: 'hidden', marginBottom: '32px' }}>
        {[
          { label: 'Constructors position', val: `P${myTeamIndex + 1}`, color: HUB.accentInk },
          { label: 'Constructors points',   val: myTeamPoints, isNumber: true },
          { label: 'Gap to P4 target',      val: gapToP4Label },
          { label: 'Gap to leader',         val: `-${gapToLeader} pts` },
          { label: 'Current round',         val: `R${state.season.round} / 24` },
        ].map((stat, i) => (
          <div key={i} style={{ background: HUB.surface, padding: '24px' }}>
            <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'block', marginBottom: '8px' }}>{stat.label}</span>
            <span style={{ fontSize: '28px', fontFamily: HUB.fontMono, fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: stat.color || HUB.textPrimary }}>
              {stat.isNumber ? <AnimatedNumber value={stat.val} /> : stat.val}
            </span>
          </div>
        ))}
      </div>
      </SlideUp>

      {/* 2. Progress bars */}
      <SlideUp delay={0.1}>
      <div style={{ ...glassCard(), marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 24px' }}>Championship progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {teamRows.slice(0, 6).map((t, idx) => (
            <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '32px 160px 1fr 60px', alignItems: 'center', gap: '24px' }}>
              <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: t.isYours ? HUB.accentInk : HUB.textMuted }}>P{idx+1}</span>
              <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{t.name}</span>
              <div style={{ width: '100%', height: '8px', background: HUB.raised, borderRadius: '4px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, (t.points / (leaderPoints || 1)) * 100)}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 1, delay: 0.2 }}
                  style={{ height: '100%', background: t.isYours ? HUB.accent : 'rgba(237,237,237,0.5)' }}
                />
              </div>
              <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><AnimatedNumber value={t.points}/></span>
            </div>
          ))}
        </div>
      </div>
      </SlideUp>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '32px', marginBottom: '32px' }}>
        {/* 3. Driver Battle */}
        <SlideUp delay={0.15}>
        <div style={{ ...glassCard({ padding: '24px' }), gridColumn: 'span 7', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 24px' }}>Driver comparison</h3>
          {selectedDriver1 && selectedDriver2 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '16px', alignItems: 'center', flexGrow: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', justifyContent: 'center' }}>
                <select value={selectedDriver1} onChange={e => { selectedDriver1 = e.target.value; renderLeaderboard(root); }} style={selectStyle}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = HUB.borderMid; e.currentTarget.style.backgroundColor = HUB.raised; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = HUB.border; e.currentTarget.style.backgroundColor = HUB.raised; }}>
                  {driverRows.map(d => <option key={d.name} value={d.name} style={{ background: HUB.bg, color: HUB.textPrimary }}>{d.name}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>{knownDriverTeams.get(selectedDriver1) || 'Free agent'}</span>
                  <img src={getDriverHeadshotUrl(selectedDriver1)} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.border}` }}/>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
                {comparisonMetrics.map(m => {
                  const isV1Better = typeof m.v1 === 'number' && typeof m.v2 === 'number'
                    ? (m.better === 'higher' ? m.v1 > m.v2 : m.v1 < m.v2) : false;
                  const isV2Better = typeof m.v1 === 'number' && typeof m.v2 === 'number'
                    ? (m.better === 'higher' ? m.v2 > m.v1 : m.v2 < m.v1) : false;
                  const c1 = isV1Better ? HUB.positive : (m.v1 === m.v2 ? HUB.textPrimary : HUB.textMuted);
                  const c2 = isV2Better ? HUB.positive : (m.v1 === m.v2 ? HUB.textPrimary : HUB.textMuted);
                  return (
                    <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 1fr', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: c1, fontWeight: 400, textAlign: 'right' }}>
                        {m.label === 'Avg finish' && typeof m.v1 === 'number' ? `P${m.v1}` : m.v1 ?? '—'}
                      </span>
                      <span style={{ fontSize: '11px', color: HUB.textFaint }}>{m.label}</span>
                      <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: c2, fontWeight: 400, textAlign: 'left' }}>
                        {m.label === 'Avg finish' && typeof m.v2 === 'number' ? `P${m.v2}` : m.v2 ?? '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '12px', justifyContent: 'center' }}>
                <select value={selectedDriver2} onChange={e => { selectedDriver2 = e.target.value; renderLeaderboard(root); }} style={selectStyle}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = HUB.borderMid; e.currentTarget.style.backgroundColor = HUB.raised; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = HUB.border; e.currentTarget.style.backgroundColor = HUB.raised; }}>
                  {driverRows.map(d => <option key={d.name} value={d.name} style={{ background: HUB.bg, color: HUB.textPrimary }}>{d.name}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={getDriverHeadshotUrl(selectedDriver2)} alt="" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.border}` }}/>
                  <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>{knownDriverTeams.get(selectedDriver2) || 'Free agent'}</span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: HUB.textMuted, textAlign: 'center' }}>Not enough drivers to compare yet</p>
          )}
        </div>
        </SlideUp>

        {/* 4. Team Momentum */}
        <SlideUp delay={0.2}>
        <div style={{ ...glassCard({ padding: '24px' }), gridColumn: 'span 5', height: '100%' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 24px' }}>Team momentum</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '8px' }}>Last 5 races</span>
              <FormChips results={myTeamForm.map(f => ({ ...f, finishPos: f.bestPos ?? 1, retired: false }))} isTeam />
            </div>
            <div style={{ height: '1px', background: HUB.border }} />
            <div>
              <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '8px' }}>Points, last 5 races</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                  {last5Pts > 0 ? `+${last5Pts}` : '—'}
                </span>
              </div>
            </div>
            <div style={{ height: '1px', background: HUB.border }} />
            <div>
              <span style={{ fontSize: '11px', color: HUB.textMuted, display: 'block', marginBottom: '8px' }}>Momentum score</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                  <AnimatedNumber value={myMomentum} />
                </span>
                <span style={{ fontSize: '11px', color: myMomentum >= 65 ? HUB.positive : myMomentum >= 40 ? HUB.warning : HUB.negative }}>
                  {myMomentum >= 65 ? 'Strong' : myMomentum >= 40 ? 'Average' : 'Poor'}
                </span>
              </div>
            </div>
          </div>
        </div>
        </SlideUp>
      </div>

      {/* 5. Constructors Table */}
      <SlideUp delay={0.25}>
      <div style={{ ...glassCard({ padding: 0 }), marginBottom: '32px', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}` }}>
          <h2 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Constructors' championship</h2>
        </div>

        {tableHead('60px 220px 160px 80px 80px 100px 100px 1fr', [
          { label: 'Pos' }, { label: 'Team' }, { label: 'Form, last 5' }, { label: 'Wins', align: 'center' }, { label: 'Podiums', align: 'center' }, { label: 'Momentum', align: 'center' }, { label: 'Last GP', align: 'center' }, { label: 'Pts', align: 'right' }
        ])}

        <div>
          {teamRows.map((row, idx) => {
            const form     = getTeamForm(row.name, raceHistory, 5);
            const stats    = getTeamSeasonStats(row.name, raceHistory, currentSeason);
            const momentum = getMomentumScore(form.map(f => ({ finishPos: f.bestPos ?? 1, retired: false })));
            const lastRace = form[form.length - 1];
            const isYours  = row.isYours;
            return (
              <motion.div
                key={row.name}
                whileHover={{ backgroundColor: isYours ? 'rgba(225,6,0,0.16)' : HUB.raised }}
                style={{ display: 'grid', gridTemplateColumns: '60px 220px 160px 80px 80px 100px 100px 1fr', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${HUB.border}`, backgroundColor: isYours ? HUB.accentSoft : 'transparent' }}
              >
                <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: isYours ? HUB.accentInk : HUB.textMuted }}>P{idx+1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{row.name}</span>
                  {isYours && <span style={{ fontSize: '11px', color: HUB.textFaint }}>Target P4 · projected P{idx+1}</span>}
                </div>
                <FormChips results={form.map(f => ({ ...f, finishPos: f.bestPos ?? 1, retired: false }))} isTeam />
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textMuted, textAlign: 'center' }}>{stats.wins}</span>
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textMuted, textAlign: 'center' }}>{stats.podiums}</span>
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: momentum >= 65 ? HUB.positive : momentum >= 40 ? HUB.warning : HUB.negative, textAlign: 'center' }}>{momentum}</span>
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'center' }}>{lastRace ? `P${lastRace.bestPos}` : '—'}</span>
                <span style={{ fontSize: '16px', fontFamily: HUB.fontMono, fontWeight: 400, color: HUB.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <AnimatedNumber value={row.points}/>
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
      </SlideUp>

      {/* 6. Drivers Table */}
      <SlideUp delay={0.3}>
      <div style={{ ...glassCard({ padding: 0 }), marginBottom: '32px', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${HUB.border}` }}>
          <h2 style={{ fontSize: '18px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Drivers' championship</h2>
        </div>

        {tableHead('60px 220px 150px 170px 80px 80px 80px 1fr', [
          { label: 'Pos' }, { label: 'Driver' }, { label: 'Team' }, { label: 'Form, last 5' }, { label: 'Wins', align: 'center' }, { label: 'Podiums', align: 'center' }, { label: 'Best finish', align: 'center' }, { label: 'Pts', align: 'right' }
        ])}

        <div>
          {driverRows.map((row, idx) => {
            const form     = getDriverForm(row.name, raceHistory, 5);
            const wins     = state.driverWins?.[row.name] || 0;
            const podiums  = state.driverPodiums?.[row.name] || 0;
            const bestPos  = state.bestFinishes?.[row.name];
            const isYours  = row.isYours;
            return (
              <motion.div
                key={row.name}
                whileHover={{ backgroundColor: isYours ? 'rgba(225,6,0,0.16)' : HUB.raised }}
                style={{ display: 'grid', gridTemplateColumns: '60px 220px 150px 170px 80px 80px 80px 1fr', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${HUB.border}`, backgroundColor: isYours ? HUB.accentSoft : 'transparent' }}
              >
                <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: isYours ? HUB.accentInk : HUB.textMuted }}>P{idx+1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={getDriverHeadshotUrl(row.name)} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.border}` }}/>
                  <span style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{row.name}</span>
                </div>
                <span style={{ fontSize: '12px', color: HUB.textMuted }}>{row.teamName}</span>
                <FormChips results={form} />
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textMuted, textAlign: 'center' }}>{wins}</span>
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textMuted, textAlign: 'center' }}>{podiums}</span>
                <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, textAlign: 'center' }}>{bestPos ? `P${bestPos}` : '—'}</span>
                <span style={{ fontSize: '14px', fontFamily: HUB.fontMono, fontWeight: 400, color: HUB.textPrimary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  <AnimatedNumber value={row.points}/>
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
      </SlideUp>

    </div>
  );

  mountLayout(root, 'standings', content, () => renderLeaderboard(root));
}
