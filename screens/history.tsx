import React, { useState } from 'react';
import { state } from '../state.js';
import { ensureTeamState } from '../utils/teamState.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { mountLayout, HUB, glassCard, sectionLabel, pageTitle, pageSubtitle, statCell, statLabel, statValue, pill, actionBtn } from '../components/HubLayout.tsx';
import { FormChips, getPositionColor, getPositionTextColor } from '../components/FormChips.tsx';
import { getDriverSeasonStats, getTeamSeasonStats } from '../game/raceHistory.js';
import { motion, AnimatePresence } from 'framer-motion';
import { SlideUp, AnimatedNumber } from '../components/ui/motion.tsx';
import { RaceReplay } from './RaceReplay.tsx';

export function renderHistory(root) {
  ensureTeamState(state.team);

  const HistoryPage = () => {
    const [activeTab, setActiveTab] = useState<'timeline'|'race'|'driver'|'team'>('timeline');
    const [selectedRace, setSelectedRace] = useState<any>(null);
    const [selectedReplay, setSelectedReplay] = useState<any>(null);
    const [selectedDriverName, setSelectedDriverName] = useState<string>(
      state.team?.drivers?.[0]?.name || ''
    );
    const [selectedTeamName, setSelectedTeamName] = useState<string>(
      state.team?.name || ''
    );

    const raceHistory = state.raceHistory || [];
    const currentSeason = state.season?.year || 1;
    const allTeams = [state.team, ...(state.aiTeams || [])].filter(Boolean);

    // All unique drivers seen across history
    const allDriverNames = [...new Set(
      raceHistory.flatMap(r => r.driverResults?.map(d => d.name) || [])
    )].sort();

    const tabs = [
      { id: 'timeline', label: 'Race Timeline' },
      { id: 'race',     label: 'Race Detail' },
      { id: 'driver',   label: 'Driver Deep Dive' },
      { id: 'team',     label: 'Constructor Deep Dive' },
    ];

    const emptyState = (msg: string) => (
      <div style={{ ...glassCard({ padding: '64px' }), textAlign: 'center', border: `1px dashed ${HUB.borderMid}` }}>
        <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>🏎</span>
        <h3 style={{ fontSize: '18px', color: '#fff', marginBottom: '8px', fontFamily: HUB.fontBold }}>{msg}</h3>
        <p style={{ color: HUB.textMuted, fontSize: '13px', maxWidth: '360px', margin: '0 auto' }}>
          Complete race weekends to populate this section. Results will be recorded after each race.
        </p>
      </div>
    );

    // ── Tab: Race Timeline ────────────────────────────────────────────────────
    const renderTimeline = () => {
      if (!raceHistory.length) return emptyState('No Race History Yet');

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...raceHistory].reverse().map((race, idx) => {
            const podium = race.driverResults?.slice(0, 3) || [];
            const myDrivers = race.driverResults?.filter(d =>
              state.team?.drivers?.some(td => td.name === d.name) ||
              state.team?.reserveDriver?.name === d.name
            ) || [];
            const myBestResult = myDrivers.sort((a, b) => a.finishPos - b.finishPos)[0];

            return (
              <motion.div
                key={race.round}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => { setSelectedRace(race); setActiveTab('race'); }}
                style={{
                  ...glassCard({ padding: '0' }),
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                  borderLeft: `4px solid ${myBestResult?.finishPos === 1 ? '#FFD700' : myBestResult?.finishPos <= 3 ? '#10b981' : HUB.border}`,
                }}
                whileHover={{ borderColor: HUB.accent } as any}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 200px 140px 100px', alignItems: 'center', padding: '16px 24px', gap: '24px' }}>
                  {/* Round Badge */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Round</div>
                    <div style={{ fontSize: '22px', fontFamily: HUB.fontWide, color: HUB.accent, fontWeight: 700 }}>{race.round}</div>
                    <div style={{ fontSize: '9px', color: HUB.textMuted }}>S{race.season}</div>
                  </div>

                  {/* Race Info */}
                  <div>
                    <h3 style={{ fontSize: '15px', fontFamily: HUB.fontBold, color: '#fff', margin: '0 0 4px', textTransform: 'uppercase' }}>{race.name}</h3>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>{race.circuit}</span>
                  </div>

                  {/* Podium */}
                  <div>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Podium</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {podium.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '16px', height: '16px', borderRadius: '3px', background: getPositionColor(i+1, false), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontFamily: HUB.fontBold, color: getPositionTextColor(i+1, false) }}>P{i+1}</span>
                          <span style={{ fontSize: '11px', color: '#fff', fontFamily: HUB.fontBold }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Your Result */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Your Result</div>
                    {myBestResult ? (
                      <div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '40px', height: '32px', borderRadius: '6px',
                          background: getPositionColor(myBestResult.finishPos, myBestResult.retired),
                          marginBottom: '4px',
                        }}>
                          <span style={{ fontSize: '12px', fontFamily: HUB.fontBold, fontWeight: 700, color: getPositionTextColor(myBestResult.finishPos, myBestResult.retired) }}>
                            {myBestResult.retired ? 'DNF' : `P${myBestResult.finishPos}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '10px', color: HUB.textMuted }}>{myBestResult.name}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: HUB.textMuted }}>—</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{ textAlign: 'right', color: HUB.textMuted, fontSize: '18px' }}>›</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    };

    // ── Tab: Race Detail ──────────────────────────────────────────────────────
    const renderRaceDetail = () => {
      if (!selectedRace) {
        return (
          <div style={{ ...glassCard({ padding: '48px' }), textAlign: 'center' }}>
            <p style={{ color: HUB.textMuted, fontSize: '14px' }}>Select a race from the Race Timeline tab to view full details.</p>
            <button onClick={() => setActiveTab('timeline')} style={{ ...actionBtn({ marginTop: '16px', padding: '10px 24px' }) }}>Go to Race Timeline</button>
          </div>
        );
      }

      const race = selectedRace;
      const podium = race.driverResults?.slice(0, 3) || [];

      return (
        <SlideUp>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ ...glassCard(), display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {sectionLabel(`Round ${race.round} · Season ${race.season}`)}
                <h2 style={{ fontSize: '24px', fontFamily: HUB.fontWide, color: '#fff', margin: '4px 0 4px', textTransform: 'uppercase' }}>{race.name}</h2>
                <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>{race.circuit}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {race.replayData && (
                  <button onClick={() => setSelectedReplay(race)} style={{ ...actionBtn({ backgroundColor: HUB.accent, color: '#fff', border: 'none' }) }}>
                    Watch Replay
                  </button>
                )}
                <button onClick={() => setActiveTab('timeline')} style={{ ...actionBtn({ backgroundColor: 'transparent', border: `1px solid ${HUB.borderMid}`, color: '#fff', boxShadow: 'none' }) }}>← Back</button>
              </div>
            </div>

            {/* Podium */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {podium.map((p, i) => (
                <div key={i} style={{ ...glassCard(), textAlign: 'center', borderTop: `3px solid ${getPositionColor(i+1, false)}` }}>
                  <div style={{ fontSize: '9px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '12px' }}>
                    {['Winner', '2nd Place', '3rd Place'][i]}
                  </div>
                  <img src={getDriverHeadshotUrl(p.name)} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${getPositionColor(i+1, false)}`, marginBottom: '8px' }} />
                  <div style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', marginBottom: '2px' }}>{p.name.toUpperCase()}</div>
                  <div style={{ fontSize: '11px', color: HUB.textMuted, marginBottom: '8px' }}>{p.team}</div>
                  <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: '#10b981' }}>+{p.points} pts</div>
                </div>
              ))}
            </div>

            {/* Fastest Lap + Standings Snapshot mini */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={glassCard()}>
                <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Fastest Lap</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={getDriverHeadshotUrl(race.fastestLap)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
                  <span style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: '#a78bfa' }}>{race.fastestLap || '—'}</span>
                  <span style={{ fontSize: '10px', color: HUB.textMuted }}>🟣 Fastest</span>
                </div>
              </div>
              <div style={glassCard()}>
                <div style={{ fontSize: '10px', color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>Championship After Race</div>
                {Object.entries(race.standingsAfter?.teams || {})
                  .sort((a: any, b: any) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([team, pts]: any, i) => (
                    <div key={team} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: team === state.team?.name ? HUB.accent : '#fff', fontFamily: HUB.fontBold }}>P{i+1} {team}</span>
                      <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textMuted }}>{pts} pts</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Full Classification */}
            <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Full Classification</h3>
              </div>
              {race.driverResults?.map((r, i) => {
                const isYours = state.team?.drivers?.some(d => d.name === r.name) || state.team?.reserveDriver?.name === r.name;
                return (
                  <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '50px 40px 1fr 150px 60px', alignItems: 'center', padding: '10px 24px', borderBottom: `1px solid ${HUB.border}`, background: isYours ? 'rgba(225,6,0,0.06)' : 'transparent', borderLeft: isYours ? `3px solid ${HUB.accent}` : '3px solid transparent' }}>
                    <div style={{ width: '32px', height: '24px', borderRadius: '4px', background: getPositionColor(r.finishPos, r.retired), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '9px', fontFamily: HUB.fontBold, color: getPositionTextColor(r.finishPos, r.retired) }}>
                        {r.retired ? 'DNF' : `P${r.finishPos}`}
                      </span>
                    </div>
                    <img src={getDriverHeadshotUrl(r.name)} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: '#fff' }}>{r.name}</span>
                    <span style={{ fontSize: '11px', color: HUB.textMuted }}>{r.team}</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.points > 0 ? '#10b981' : HUB.textMuted, textAlign: 'right' }}>
                      {r.points > 0 ? `+${r.points}` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </SlideUp>
      );
    };

    // ── Tab: Driver Deep Dive ─────────────────────────────────────────────────
    const renderDriverDive = () => {
      const driverRaces = (state.raceHistory || [])
        .filter(r => r.season === currentSeason)
        .map(race => {
          const r = race.driverResults?.find(d => d.name === selectedDriverName);
          if (!r) return null;
          return { round: race.round, name: race.name, circuit: race.circuit, finishPos: r.finishPos, points: r.points, retired: r.retired };
        })
        .filter(Boolean);

      const stats = getDriverSeasonStats(selectedDriverName, state.raceHistory || [], currentSeason);

      return (
        <SlideUp>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Driver Selector */}
            <div style={glassCard()}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <img src={getDriverHeadshotUrl(selectedDriverName)} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', border: `2px solid ${HUB.accent}`, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <select value={selectedDriverName} onChange={e => setSelectedDriverName(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.borderMid}`, borderRadius: '6px', color: '#fff', fontSize: '16px', fontFamily: HUB.fontBold, padding: '8px 12px', outline: 'none', width: '100%' }}>
                    {allDriverNames.map(n => <option key={n} value={n} style={{ background: '#0B0F19' }}>{n.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
              {[
                { label: 'Races',      val: stats.racesEntered || 0 },
                { label: 'Wins',       val: stats.wins },
                { label: 'Podiums',    val: stats.podiums },
                { label: 'Points',     val: stats.points },
                { label: 'Avg Finish', val: stats.avgFinish ? `P${stats.avgFinish}` : '—' },
                { label: 'Best Finish',val: stats.bestFinish ? `P${stats.bestFinish}` : '—' },
              ].map((s, i) => (
                <div key={i} style={statCell({ textAlign: 'center' })}>
                  {statLabel(s.label)}
                  <span style={{ fontSize: '18px', fontFamily: HUB.fontMono, color: '#fff', fontWeight: 700 }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Race-by-race table */}
            {driverRaces.length === 0 ? emptyState('No races found for this driver') : (
              <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                  <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Season Race Results</h3>
                </div>
                {driverRaces.map((r: any, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 60px', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${HUB.border}`, gap: '16px' }}>
                    <span style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>R{r.round}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: '#fff' }}>{r.name}</div>
                      <div style={{ fontSize: '10px', color: HUB.textMuted }}>{r.circuit}</div>
                    </div>
                    <div style={{ width: '36px', height: '26px', borderRadius: '4px', background: getPositionColor(r.finishPos, r.retired), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '9px', fontFamily: HUB.fontBold, fontWeight: 700, color: getPositionTextColor(r.finishPos, r.retired) }}>
                        {r.retired ? 'DNF' : `P${r.finishPos}`}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.points > 0 ? '#10b981' : HUB.textMuted, textAlign: 'right' }}>
                      {r.points > 0 ? `+${r.points}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SlideUp>
      );
    };

    // ── Tab: Team Deep Dive ───────────────────────────────────────────────────
    const renderTeamDive = () => {
      const stats = getTeamSeasonStats(selectedTeamName, state.raceHistory || [], currentSeason);

      return (
        <SlideUp>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Team Selector */}
            <div style={glassCard()}>
              <select value={selectedTeamName} onChange={e => setSelectedTeamName(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${HUB.borderMid}`, borderRadius: '6px', color: '#fff', fontSize: '16px', fontFamily: HUB.fontBold, padding: '10px 16px', outline: 'none', width: '100%' }}>
                {allTeams.map(t => <option key={t.name} value={t.name} style={{ background: '#0B0F19' }}>{t.name.toUpperCase()}</option>)}
              </select>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Races Entered', val: stats.racesEntered || 0 },
                { label: 'Wins',          val: stats.wins },
                { label: 'Podiums',       val: stats.podiums },
                { label: 'Points',        val: stats.points },
              ].map((s, i) => (
                <div key={i} style={statCell({ textAlign: 'center' })}>
                  {statLabel(s.label)}
                  <span style={{ fontSize: '22px', fontFamily: HUB.fontMono, color: '#fff', fontWeight: 700 }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Race-by-race standings progression */}
            {stats.standingsProgression?.length === 0 ? emptyState('No race data for this constructor') : (
              <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                  <h3 style={{ fontSize: '14px', fontFamily: HUB.fontBold, color: '#fff', margin: 0, textTransform: 'uppercase' }}>Championship Position By Race</h3>
                </div>
                {stats.standingsProgression?.map((r: any, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px 80px 120px', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${HUB.border}`, gap: '16px' }}>
                    <span style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>R{r.round}</span>
                    <span style={{ fontSize: '13px', color: '#fff' }}>{r.name}</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.pos === 1 ? '#FFD700' : r.pos <= 3 ? '#10b981' : '#fff', fontWeight: 700 }}>
                      {r.pos ? `P${r.pos}` : '—'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#10b981', fontFamily: HUB.fontMono }}>
                      {r.points > 0 ? `+${r.points}` : '—'}
                    </span>
                    {/* Mini position bar */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(5, ((12 - (r.pos || 12)) / 11) * 100)}%`, background: r.pos <= 3 ? '#10b981' : HUB.accent, borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SlideUp>
      );
    };

    if (selectedReplay) {
      return <RaceReplay race={selectedReplay} onClose={() => setSelectedReplay(null)} />;
    }

    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {sectionLabel('Archive')}
            {pageTitle('Season History')}
            {pageSubtitle('Browse every completed race, track driver form, and analyse championship progression.')}
          </div>
          <div style={statCell()}>
            {statLabel('Races Completed')}
            {statValue(raceHistory.filter(r => r.season === currentSeason).length)}
          </div>
        </div>

        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${HUB.border}` }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
              padding: '12px 24px', background: activeTab === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${HUB.accent}` : '2px solid transparent',
              color: activeTab === tab.id ? '#fff' : HUB.textMuted, fontSize: '12px', fontWeight: 700,
              fontFamily: HUB.fontBold, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'timeline' && renderTimeline()}
            {activeTab === 'race'     && renderRaceDetail()}
            {activeTab === 'driver'   && renderDriverDive()}
            {activeTab === 'team'     && renderTeamDive()}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  mountLayout(root, 'history', <HistoryPage />, () => renderHistory(root));
}
