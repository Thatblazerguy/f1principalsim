import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { state } from '../state.js';
import { ensureTeamState, getActiveDrivers } from '../utils/teamState.js';
import { drivers as DRIVER_POOL } from '../data/drivers.js';
import { mountLayout, pageTitle, pageSubtitle } from '../components/HubLayout.tsx';
import { buildChampionship, getRecordedSeasons, getTeamSummary } from '../utils/championshipModel.js';
import { DriverTable, ConstructorTable } from '../components/standings/StandingsTables.tsx';
import { ProgressionChart } from '../components/standings/ProgressionChart.tsx';
import { ChampionshipPodium } from '../components/standings/ChampionshipPodium.tsx';
import {
  SummaryKpis, MomentumPanel, RecentResults, PodiumLeaderboard, ConstructorPodiums, SeasonResults, MomentumTable,
} from '../components/standings/StandingsPanels.tsx';
import { DriverComparison } from '../components/standings/DriverComparison.tsx';
import { StandingsDetail, type Detail } from '../components/standings/StandingsDetail.tsx';
import '../components/standings/standings.css';

type View = 'overview' | 'drivers' | 'constructors' | 'podiums' | 'results' | 'analytics';
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'constructors', label: 'Constructors' },
  { id: 'podiums', label: 'Podiums' },
  { id: 'results', label: 'Race results' },
  { id: 'analytics', label: 'Analytics' },
];

// Kept across re-mounts (e.g. sim-day refreshes) so the screen doesn't jump back.
const memory: { view: View; season: number | null; team: string } = { view: 'overview', season: null, team: '' };

function findDriver(name: string) {
  const pools = [state.team, ...(state.aiTeams || [])].filter(Boolean)
    .flatMap((t: any) => [...(t.drivers || []), t.reserveDriver].filter(Boolean));
  return pools.find((d: any) => d.name === name) || DRIVER_POOL.find((d: any) => d.name === name) || null;
}

function StandingsScreen({ root }: { root: HTMLElement }) {
  const reduce = useReducedMotion();
  const seasons = getRecordedSeasons(state);
  const [view, setViewRaw] = useState<View>(memory.view);
  const [season, setSeasonRaw] = useState<number>(memory.season && seasons.includes(memory.season) ? memory.season : seasons[0]);
  const [teamFilter, setTeamFilterRaw] = useState<string>(memory.team);
  const [detail, setDetail] = useState<Detail>(null);

  const setView = (v: View) => { memory.view = v; setViewRaw(v); };
  const setSeason = (s: number) => { memory.season = s; setSeasonRaw(s); };
  const setTeamFilter = (t: string) => { memory.team = t; setTeamFilterRaw(t); };

  const champ = useMemo(() => buildChampionship(state, { season }), [season, state.raceHistory?.length, state.season?.round]);
  const playerTeam = state.team?.name;
  const summary = getTeamSummary(champ, playerTeam);
  const teamNames = champ.teams.map((t: any) => t.name);
  const filter = teamNames.includes(teamFilter) ? teamFilter : '';

  const openDriver = useCallback((name: string) => setDetail({ kind: 'driver', name }), []);
  const openTeam = useCallback((name: string) => setDetail({ kind: 'team', name }), []);
  const openRace = useCallback((race: any) => setDetail({ kind: 'race', race }), []);
  const openHistory = () => import('./history.tsx').then(m => m.renderHistory(root));

  const mine = champ.drivers.filter((d: any) => d.isPlayer).map((d: any) => d.name);
  const active = champ.isCurrent ? getActiveDrivers(state.team).map((d: any) => d.name) : [];
  const pairPool = [...new Set([...active.filter((n: string) => champ.drivers.some((d: any) => d.name === n)), ...mine, ...champ.drivers.map((d: any) => d.name)])];
  const defaultPair: [string, string] = [pairPool[0] || '', pairPool[1] || ''];

  const subtitle = champ.isCurrent
    ? `Season ${champ.season} · ${champ.completed ? `after round ${champ.progression.rounds[champ.progression.rounds.length - 1]?.round}` : 'before the first race'}`
    : `Season ${champ.season} · final standings`;

  const chart = (h = 280) => <ProgressionChart key={`chart-${season}`} champ={champ} height={h} />;
  const momentum = <MomentumPanel champ={champ} teamName={filter || playerTeam} onOpenTeam={openTeam} />;
  const drivers = (compact = false) => <DriverTable champ={champ} teamFilter={filter} onOpen={openDriver} compact={compact} />;
  const teams = <ConstructorTable champ={champ} teamFilter={filter} onOpen={openTeam} />;
  const recent = <RecentResults champ={champ} race={champ.latestRace} onOpenClassification={openRace} onOpenHistory={openHistory} onOpenDriver={openDriver} />;
  const podium = (limit = 8) => <PodiumLeaderboard champ={champ} teamFilter={filter} onOpenDriver={openDriver} limit={limit} />;
  const compare = <DriverComparison key={`cmp-${season}`} state={state} champ={champ} findDriver={findDriver} defaultPair={defaultPair} />;

  const body: Record<View, React.ReactNode> = {
    overview: (
      <>
        <div className="st-top">{chart()}{momentum}</div>
        <div className="st-main">
          <div className="st-main-col">{drivers()}{teams}</div>
          <aside className="st-side" aria-label="Latest results and podiums">{recent}{podium()}</aside>
        </div>
        {compare}
      </>
    ),
    drivers: (
      <>
        {drivers()}
        <div className="st-two">{podium(10)}{recent}</div>
        {compare}
      </>
    ),
    constructors: (
      <>
        {teams}
        <div className="st-two">{momentum}<ConstructorPodiums champ={champ} onOpenTeam={openTeam} /></div>
        <MomentumTable champ={champ} onOpenTeam={openTeam} />
      </>
    ),
    podiums: (
      <div className="st-two">{podium(30)}<ConstructorPodiums champ={champ} onOpenTeam={openTeam} /></div>
    ),
    results: (
      <>
        <div className="st-two">{recent}{podium()}</div>
        <SeasonResults champ={champ} onOpenClassification={openRace} />
      </>
    ),
    analytics: (
      <>
        {chart(340)}
        {compare}
        <MomentumTable champ={champ} onOpenTeam={openTeam} />
      </>
    ),
  };

  return (
    <div className="st-root">
      <div className="st-head">
        <div>
          {pageTitle('Standings')}
          {pageSubtitle(subtitle)}
        </div>
      </div>

      <ChampionshipPodium champ={champ} teamFilter={filter} onOpenDriver={openDriver} onOpenTeam={openTeam} />

      <div className="st-filter">
        <div className="st-tabs" role="tablist" aria-label="Standings views">
          {VIEWS.map(v => (
            <button key={v.id} type="button" role="tab" id={`st-tab-${v.id}`} aria-selected={view === v.id} aria-controls="st-panel"
              className="st-tab st-tab-ind-wrap" onClick={() => setView(v.id)}>
              {view === v.id && <motion.span layoutId="st-tab-ind" className="st-tab-ind" transition={{ duration: reduce ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }} />}
              <span className="st-tab-label">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="st-selects">
          <label className="st-select-label">Season
            <select className="st-select" value={season} onChange={e => setSeason(Number(e.target.value))} disabled={seasons.length < 2}>
              {seasons.map(s => <option key={s} value={s}>{s === (state.season?.year || 1) ? `Season ${s} (current)` : `Season ${s}`}</option>)}
            </select>
          </label>
          <label className="st-select-label">Constructor
            <select className="st-select" value={filter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="">All constructors</option>
              {teamNames.map((n: string) => <option key={n} value={n}>{n}{n === playerTeam ? ' (you)' : ''}</option>)}
            </select>
          </label>
        </div>
      </div>

      <SummaryKpis champ={champ} summary={summary} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${view}-${season}`} id="st-panel" role="tabpanel" aria-labelledby={`st-tab-${view}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
          {body[view]}
        </motion.div>
      </AnimatePresence>

      <StandingsDetail detail={detail} champ={champ} findDriver={findDriver} onClose={() => setDetail(null)} />
    </div>
  );
}

export function renderLeaderboard(root: HTMLElement) {
  ensureTeamState(state.team);
  mountLayout(root, 'standings', <StandingsScreen root={root} />, () => renderLeaderboard(root));
}
