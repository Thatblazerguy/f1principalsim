import React, { useState } from 'react';
import { state } from '../state.js';
import { ensureTeamState } from '../utils/teamState.js';
import { getDriverHeadshotUrl } from '../data/drivers.js';
import { mountLayout, HUB, glassCard, sectionLabel, pageTitle, pageSubtitle, statCell, statLabel, statValue, pill, btn, btnClass } from '../components/HubLayout.tsx';
import { FormChips, getPositionColor, getPositionTextColor } from '../components/FormChips.tsx';
import { getDriverSeasonStats, getTeamSeasonStats } from '../game/raceHistory.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, ChevronRight, ArrowLeft } from 'lucide-react';
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
      { id: 'timeline', label: 'Race timeline' },
      { id: 'race',     label: 'Race detail' },
      { id: 'driver',   label: 'Drivers' },
      { id: 'team',     label: 'Constructors' },
    ];

    const emptyState = (msg: string) => (
      <div style={{ ...glassCard({ padding: '64px' }), textAlign: 'center', border: `1px dashed ${HUB.borderMid}` }}>
        <Flag size={24} strokeWidth={1.5} color={HUB.textMuted} style={{ display: 'block', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 400, color: HUB.textPrimary, margin: '0 0 8px', fontFamily: HUB.fontBold }}>{msg}</h3>
        <p style={{ color: HUB.textMuted, fontSize: '13px', maxWidth: '360px', margin: '0 auto' }}>
          Complete race weekends to populate this section. Results will be recorded after each race.
        </p>
      </div>
    );

    // ── Tab: Race Timeline ────────────────────────────────────────────────────
    const renderTimeline = () => {
      if (!raceHistory.length) return emptyState('No race history yet');

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
                  transition: `border-color 150ms ${HUB.ease}`,
                }}
                whileHover={{ borderColor: HUB.borderMid } as any}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 200px 140px 100px', alignItems: 'center', padding: '16px 24px', gap: '24px' }}>
                  {/* Round Badge */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: HUB.textFaint, marginBottom: '2px' }}>Round</div>
                    <div style={{ fontSize: '22px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{race.round}</div>
                    <div style={{ fontSize: '11px', color: HUB.textFaint }}>S{race.season}</div>
                  </div>

                  {/* Race Info */}
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '0 0 4px' }}>{race.name}</h3>
                    <span style={{ fontSize: '12px', color: HUB.textMuted }}>{race.circuit}</span>
                  </div>

                  {/* Podium */}
                  <div>
                    <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Podium</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {podium.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '20px', fontSize: '11px', fontFamily: HUB.fontBold, color: HUB.textFaint, fontVariantNumeric: 'tabular-nums' }}>P{i+1}</span>
                          <span style={{ fontSize: '12px', color: HUB.textPrimary, fontFamily: HUB.fontBold }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Your Result */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '8px' }}>Your result</div>
                    {myBestResult ? (
                      <div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '40px', height: '32px', borderRadius: '6px',
                          background: getPositionColor(myBestResult.finishPos, myBestResult.retired),
                          marginBottom: '4px'
                        }}>
                          <span style={{ fontSize: '12px', fontFamily: HUB.fontBold, fontWeight: 400, color: getPositionTextColor(myBestResult.finishPos, myBestResult.retired) }}>
                            {myBestResult.retired ? 'DNF' : `P${myBestResult.finishPos}`}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: HUB.textMuted }}>{myBestResult.name}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: HUB.textMuted }}>—</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ChevronRight size={16} strokeWidth={1.5} color={HUB.textFaint} /></div>
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
            <p style={{ color: HUB.textMuted, fontSize: '14px' }}>Select a race from the race timeline to see its full result</p>
            <button onClick={() => setActiveTab('timeline')} className={btnClass('secondary')} style={btn('secondary', 'md', { marginTop: '16px' })}>Go to race timeline</button>
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
                <h2 style={{ fontSize: '24px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: '4px 0' }}>{race.name}</h2>
                <p style={{ fontSize: '12px', color: HUB.textMuted, margin: 0 }}>{race.circuit}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {race.replayData && (
                  <button onClick={() => setSelectedReplay(race)} className={btnClass('secondary')} style={btn('secondary', 'md')}>
                    Watch replay
                  </button>
                )}
                <button onClick={() => setActiveTab('timeline')} className={btnClass('ghost')} style={btn('ghost', 'md')}><ArrowLeft size={16} strokeWidth={1.5} /> Back to race timeline</button>
              </div>
            </div>

            {/* Podium */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {podium.map((p, i) => (
                <div key={i} style={{ ...glassCard(), textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '12px' }}>
                    {['Winner', '2nd place', '3rd place'][i]}
                  </div>
                  <img src={getDriverHeadshotUrl(p.name)} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}`, marginBottom: '8px' }} />
                  <div style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: HUB.textPrimary, marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: HUB.textMuted, marginBottom: '8px' }}>{p.team}</div>
                  <div style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.positive }}>+{p.points} pts</div>
                </div>
              ))}
            </div>

            {/* Fastest Lap + Standings Snapshot mini */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={glassCard()}>
                <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '12px' }}>Fastest lap</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={getDriverHeadshotUrl(race.fastestLap)} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `1px solid ${HUB.borderMid}` }} />
                  <span style={{ fontSize: '16px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{race.fastestLap || '—'}</span>
                </div>
              </div>
              <div style={glassCard()}>
                <div style={{ fontSize: '12px', color: HUB.textFaint, marginBottom: '12px' }}>Championship after this race</div>
                {Object.entries(race.standingsAfter?.teams || {})
                  .sort((a: any, b: any) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([team, pts]: any, i) => (
                    <div key={team} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: team === state.team?.name ? HUB.accentInk : HUB.textPrimary, fontFamily: HUB.fontBold }}>P{i+1} {team}</span>
                      <span style={{ fontSize: '12px', fontFamily: HUB.fontMono, color: HUB.textMuted }}>{pts} pts</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Full Classification */}
            <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Full classification</h3>
              </div>
              {race.driverResults?.map((r, i) => {
                const isYours = state.team?.drivers?.some(d => d.name === r.name) || state.team?.reserveDriver?.name === r.name;
                return (
                  <div key={r.name} style={{ display: 'grid', gridTemplateColumns: '50px 40px 1fr 150px 60px', alignItems: 'center', padding: '8px 24px', borderBottom: `1px solid ${HUB.border}`, background: isYours ? HUB.accentSoft : 'transparent' }}>
                    <div style={{ width: '32px', height: '24px', borderRadius: '4px', background: getPositionColor(r.finishPos, r.retired), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: HUB.fontBold, color: getPositionTextColor(r.finishPos, r.retired) }}>
                        {r.retired ? 'DNF' : `P${r.finishPos}`}
                      </span>
                    </div>
                    <img src={getDriverHeadshotUrl(r.name)} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{r.name}</span>
                    <span style={{ fontSize: '12px', color: HUB.textMuted }}>{r.team}</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.points > 0 ? HUB.positive : HUB.textMuted, textAlign: 'right' }}>
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
                <img src={getDriverHeadshotUrl(selectedDriverName)} alt="" style={{ width: '56px', height: '56px', borderRadius: '50%', border: `1px solid ${HUB.borderMid}`, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <select value={selectedDriverName} onChange={e => setSelectedDriverName(e.target.value)}
                    style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, fontSize: '16px', fontFamily: HUB.fontBold, padding: '8px 12px', outline: 'none', width: '100%' }}>
                    {allDriverNames.map(n => <option key={n} value={n} style={{ background: HUB.bg }}>{n}</option>)}
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
                { label: 'Avg finish', val: stats.avgFinish ? `P${stats.avgFinish}` : '—' },
                { label: 'Best finish',val: stats.bestFinish ? `P${stats.bestFinish}` : '—' },
              ].map((s, i) => (
                <div key={i} style={statCell({ textAlign: 'center' })}>
                  {statLabel(s.label)}
                  <span style={{ fontSize: '22px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Race-by-race table */}
            {driverRaces.length === 0 ? emptyState('No races found for this driver') : (
              <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Season results</h3>
                </div>
                {driverRaces.map((r: any, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 40px 60px', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${HUB.border}`, gap: '16px' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>R{r.round}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: HUB.textPrimary }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: HUB.textMuted }}>{r.circuit}</div>
                    </div>
                    <div style={{ width: '36px', height: '26px', borderRadius: '4px', background: getPositionColor(r.finishPos, r.retired), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '11px', fontFamily: HUB.fontBold, fontWeight: 400, color: getPositionTextColor(r.finishPos, r.retired) }}>
                        {r.retired ? 'DNF' : `P${r.finishPos}`}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: r.points > 0 ? HUB.positive : HUB.textMuted, textAlign: 'right' }}>
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
                style={{ background: HUB.raised, border: `1px solid ${HUB.border}`, borderRadius: '8px', color: HUB.textPrimary, fontSize: '16px', fontFamily: HUB.fontBold, padding: '8px 12px', outline: 'none', width: '100%' }}>
                {allTeams.map(t => <option key={t.name} value={t.name} style={{ background: HUB.bg }}>{t.name}</option>)}
              </select>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Races entered', val: stats.racesEntered || 0 },
                { label: 'Wins',          val: stats.wins },
                { label: 'Podiums',       val: stats.podiums },
                { label: 'Points',        val: stats.points },
              ].map((s, i) => (
                <div key={i} style={statCell({ textAlign: 'center' })}>
                  {statLabel(s.label)}
                  <span style={{ fontSize: '22px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{s.val}</span>
                </div>
              ))}
            </div>

            {/* Race-by-race standings progression */}
            {stats.standingsProgression?.length === 0 ? emptyState('No race data for this constructor') : (
              <div style={{ ...glassCard({ padding: 0 }), overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HUB.border}` }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 400, fontFamily: HUB.fontBold, color: HUB.textPrimary, margin: 0 }}>Championship position by race</h3>
                </div>
                {stats.standingsProgression?.map((r: any, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px 80px 120px', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${HUB.border}`, gap: '16px' }}>
                    <span style={{ fontSize: '11px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>R{r.round}</span>
                    <span style={{ fontSize: '13px', color: HUB.textPrimary }}>{r.name}</span>
                    <span style={{ fontSize: '13px', fontFamily: HUB.fontMono, color: HUB.textPrimary, fontWeight: 400 }}>
                      {r.pos ? `P${r.pos}` : '—'}
                    </span>
                    <span style={{ fontSize: '12px', color: r.points > 0 ? HUB.positive : HUB.textMuted, fontFamily: HUB.fontMono }}>
                      {r.points > 0 ? `+${r.points}` : '—'}
                    </span>
                    {/* Mini position bar */}
                    <div style={{ width: '100%', height: '6px', background: HUB.raised, borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(5, ((12 - (r.pos || 12)) / 11) * 100)}%`, background: 'rgba(237,237,237,0.5)', borderRadius: '3px', transition: `width 400ms ${HUB.ease}` }} />
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
            {pageTitle('History')}
            {pageSubtitle('Every completed race, driver form and how the championship moved.')}
          </div>
          <div style={statCell()}>
            {statLabel('Races completed')}
            {statValue(raceHistory.filter(r => r.season === currentSeason).length)}
          </div>
        </div>

        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `1px solid ${HUB.border}` }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{
              padding: '12px 24px', background: 'transparent',
              border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${HUB.accent}` : '2px solid transparent',
              color: activeTab === tab.id ? HUB.textPrimary : HUB.textMuted, fontSize: '13px', fontWeight: 400,
              fontFamily: HUB.fontBold, cursor: 'pointer'
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
