import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, Flag, Wrench, Users, Activity,
  Bell, FastForward, LogOut, ShoppingCart, Star,
  Trophy, CalendarDays, DollarSign, GraduationCap
} from 'lucide-react';
import { state } from '../state.js';
import { canSimulateNextDay, simulateNextDay } from '../utils/seasonTimeline.js';
import { syncGame, logoutUser } from '../lib/supabaseApi.js';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, AnimatedNumber, microTransition } from './ui/motion.tsx';

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const HUB = {
  bg:           '#0B0F19',
  sidebar:      '#080B12',
  surface:      'rgba(26,30,46,0.6)',
  accent:       '#E10600',
  textPrimary:  '#FFFFFF',
  textMuted:    '#94A3B8',
  border:       'rgba(255,255,255,0.05)',
  borderMid:    'rgba(255,255,255,0.08)',
  radius:       '16px',
  fontWide:     "'Formula1-Wide', sans-serif",
  fontBold:     "'Formula1-Bold', sans-serif",
  fontRegular:  "'Formula1-Regular', sans-serif",
  fontMono:     "'Formula1-Bold', sans-serif",
  fontSans:     "'Formula1-Regular', sans-serif",
};

// ─── Shared card / section styles ─────────────────────────────────────────────
export const glassCard = (extra = {}) => ({
  background:     HUB.surface,
  backdropFilter: 'blur(12px)',
  border:         `1px solid ${HUB.border}`,
  borderRadius:   HUB.radius,
  padding:        '24px',
  fontFamily:     HUB.fontRegular,
  ...extra,
});

export const statCell = (extra = {}) => ({
  background:   'rgba(255,255,255,0.05)',
  border:       `1px solid ${HUB.border}`,
  borderRadius: '8px',
  padding:      '14px 16px',
  ...extra,
});

export const pill = (active = false) => ({
  padding:         '4px 14px',
  borderRadius:    '999px',
  fontSize:        '10px',
  fontWeight:      700,
  letterSpacing:   '0.08em',
  textTransform:   'uppercase',
  border:          `1px solid ${active ? HUB.accent : 'rgba(255,255,255,0.12)'}`,
  backgroundColor: active ? HUB.accent : 'rgba(255,255,255,0.04)',
  color:           active ? '#fff' : HUB.textMuted,
  fontFamily:      HUB.fontBold,
  cursor:          'default',
});

export const actionBtn = (extra = {}) => ({
  backgroundColor: HUB.accent,
  color:           '#fff',
  border:          'none',
  borderRadius:    '8px',
  padding:         '10px 20px',
  fontSize:        '12px',
  fontWeight:      700,
  letterSpacing:   '0.08em',
  textTransform:   'uppercase',
  cursor:          'pointer',
  boxShadow:       '0 4px 16px rgba(225,6,0,0.25)',
  transition:      'all 0.15s ease',
  fontFamily:      HUB.fontBold,
  ...extra,
});

export const sectionLabel = (text: string) => (
  <p style={{
    fontSize:'10px', fontWeight:700, color:HUB.accent,
    letterSpacing:'0.3em', textTransform:'uppercase',
    margin:'0 0 4px', fontFamily:HUB.fontBold,
  }}>{text}</p>
);

export const pageTitle = (text: string) => (
  <h2 style={{
    fontSize:'28px', fontWeight:900, color:'#fff',
    letterSpacing:'-0.02em', margin:'0 0 8px',
    fontFamily:HUB.fontWide, lineHeight:1.1,
    textTransform:'uppercase',
  }}>{text}</h2>
);

export const pageSubtitle = (text: string) => (
  <p style={{fontSize:'13px', color:HUB.textMuted, margin:'0', lineHeight:1.6, fontFamily:HUB.fontRegular}}>{text}</p>
);

export const statLabel = (text: string) => (
  <p style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 6px', fontFamily:HUB.fontRegular}}>{text}</p>
);

export const statValue = (text: string | number, color = '#fff') => (
  <p style={{
    fontSize:'22px', fontWeight:700, color, margin:0,
    fontFamily:HUB.fontMono,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.03em',
  }}>{text}</p>
);

// ─── HubLayout Component ───────────────────────────────────────────────────────
interface HubLayoutProps {
  activeScreen: string;
  appRoot: HTMLElement;
  children: React.ReactNode;
  onSimulate?: () => void;
}

export function HubLayout({ activeScreen, appRoot, children, onSimulate }: HubLayoutProps) {
  const canAdvance = canSimulateNextDay(state);
  const totalRounds = Math.min(state.season.totalRounds || 24, 24);

  // Navigate between game screens without tearing down the layout.
  // We simply call the screen's render function — mountLayout() handles
  // re-rendering in place if the hub-layout-root node already exists.
  const navigate = (renderFn: (r: HTMLElement) => void) => {
    renderFn(appRoot);
  };

  const handleSimulate = async () => {
    if (!canAdvance) return;
    const result = simulateNextDay(state);
    if (!result.advanced) return;
    await syncGame();
    onSimulate?.();
  };

  // Lazy-import nav targets to avoid circular deps — screens import each other
  const navItems = [
    { id: 'dashboard',    icon: <LayoutDashboard size={18}/>, label: 'Dashboard',     group: null },
    { id: 'weekend',      icon: <Flag size={18}/>,            label: 'Race Weekend',  group: null },
    null, // divider
    { id: 'engineering',  icon: <Wrench size={18}/>,          label: 'Engineering R&D', group: 'Team Ops' },
    { id: 'drivers',      icon: <Users size={18}/>,           label: 'Driver Dossiers',  group: 'Team Ops' },
    { id: 'academy',      icon: <GraduationCap size={18}/>,   label: 'Driver Academy',   group: 'Team Ops' },
    { id: 'market',       icon: <ShoppingCart size={18}/>,    label: 'Driver Market',   group: 'Team Ops' },
    { id: 'sponsors',     icon: <Star size={18}/>,            label: 'Commercial (Sponsors)', group: 'Team Ops' },
    { id: 'finance',      icon: <DollarSign size={18}/>,      label: 'Finance Control', group: 'Team Ops' },
    null, // divider
    { id: 'teams',        icon: <Trophy size={18}/>,          label: 'F1 Paddock (Teams)', group: 'Championship' },
    { id: 'standings',    icon: <Activity size={18}/>,        label: 'FIA Timing Center', group: 'Championship' },
    { id: 'calendar',     icon: <CalendarDays size={18}/>,    label: 'Season Planner',  group: 'Championship' },
  ];

  const handleNav = async (id: string) => {
    if (id === activeScreen) return;
    // Lazy imports to avoid circular deps at module load
    const { renderDashboard }  = await import('../screens/dashboard.tsx');
    const { renderWeekend }    = await import('../screens/weekend.tsx');
    const { renderOffice }     = await import('../screens/office.tsx');
    const { renderMyDrivers }  = await import('../screens/myDrivers.tsx');
    const { renderAcademy }    = await import('../screens/academy.tsx');
    const { renderMarket }     = await import('../screens/market.tsx');
    const { renderSponsors }   = await import('../screens/sponsors.tsx');
    const { renderTeams }      = await import('../screens/teams.tsx');
    const { renderLeaderboard }= await import('../screens/leaderboard.tsx');
    const { renderCalendar }   = await import('../screens/calendar.tsx');
    const { renderOffseason }  = await import('../screens/offseason.tsx');
    const { renderFinance }    = await import('../screens/finance.tsx');

    const isSeasonOver = state.season.round > totalRounds ||
      (state.weekendProgress?.raceComplete && state.season.round === totalRounds);

    const map: Record<string, () => void> = {
      dashboard:   () => navigate(renderDashboard),
      weekend:     () => navigate(isSeasonOver ? renderOffseason : renderWeekend),
      engineering: () => navigate(renderOffice),
      drivers:     () => navigate(renderMyDrivers),
      academy:     () => navigate(renderAcademy),
      market:      () => navigate(renderMarket),
      sponsors:    () => navigate(renderSponsors),
      finance:     () => navigate(renderFinance),
      teams:       () => navigate(renderTeams),
      standings:   () => navigate(renderLeaderboard),
      calendar:    () => navigate(renderCalendar),
    };
    map[id]?.();
  };

  let prevGroup: string | null = 'NONE';

  return (
    <div style={{fontFamily:HUB.fontSans, backgroundColor:HUB.bg, color:'#fff', minHeight:'100vh'}}>

      {/* ── Sidebar ── */}
      <aside style={{
        position:'fixed', left:0, top:0, height:'100vh', width:'256px', zIndex:50,
        backgroundColor:HUB.sidebar, borderRight:`1px solid ${HUB.border}`,
        display:'flex', flexDirection:'column', padding:'28px 0',
      }}>
        <div style={{padding:'0 28px', marginBottom:'40px'}}>
          <h1 style={{
            fontSize: `${Math.max(10, Math.min(18, 200 / Math.max(1, state.team.name.length * 1.15)))}px`, 
            fontWeight: 800, 
            letterSpacing: '-0.04em', 
            color: '#fff', 
            margin: 0, 
            fontFamily: HUB.fontWide,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {state.team.name.toUpperCase()}
          </h1>
          <p style={{fontSize:'10px', fontWeight:700, color:HUB.accent, letterSpacing:'0.3em', textTransform:'uppercase', marginTop:'4px', marginBottom:0, fontFamily:HUB.fontRegular}}>
            Command Hub
          </p>
        </div>

        <nav style={{flex:1, padding:'0 12px', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto', scrollbarWidth:'none'}}>
          {navItems.map((item, i) => {
            if (!item) {
              return <div key={`div-${i}`} style={{height:'1px', background:'rgba(255,255,255,0.06)', margin:'8px 4px'}} />;
            }
            const showGroupLabel = item.group && item.group !== prevGroup;
            prevGroup = item.group;
            const isActive = item.id === activeScreen;
            return (
              <React.Fragment key={item.id}>
                {showGroupLabel && (
                  <p style={{fontSize:'9px', fontWeight:700, color:'rgba(148,163,184,0.4)', letterSpacing:'0.2em', textTransform:'uppercase', padding:'0 14px', margin:'6px 0 2px', fontFamily:HUB.fontRegular}}>
                    {item.group}
                  </p>
                )}
                <button onClick={() => handleNav(item.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'12px',
                    padding:'10px 14px', borderRadius:'8px',
                    color: isActive ? '#fff' : HUB.textMuted,
                    border:'none',
                    cursor: isActive ? 'default' : 'pointer',
                    fontSize:'13px', fontWeight:600, letterSpacing:'0.04em',
                    width:'100%', textAlign:'left', boxSizing:'border-box',
                    fontFamily:HUB.fontBold,
                    position: 'relative',
                    background: 'transparent'
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color='white'; }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color=HUB.textMuted; }}}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(225,6,0,0.12)',
                        borderLeft: `2px solid ${HUB.accent}`,
                        borderRadius: '8px',
                        zIndex: -1
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {item.icon} {item.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div style={{padding:'0 16px', marginTop:'auto', display:'flex', flexDirection:'column', gap:'10px'}}>
          <button
            onClick={async () => {
              try {
                await logoutUser();
              } catch (err) {
                console.error("Error signing out:", err);
              }
              unmountLayout();
              window.location.reload();
            }}
            style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', color:HUB.textMuted, background:'none', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700, padding:'8px', transition:'color 0.15s', fontFamily:HUB.fontBold}}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#f87171'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color=HUB.textMuted}
          >
            <LogOut size={15}/> LOGOUT
          </button>
          <motion.button 
            onClick={handleSimulate} disabled={!canAdvance}
            whileTap={{ scale: canAdvance ? 0.98 : 1 }}
            transition={microTransition}
            style={{
              width:'100%', backgroundColor:HUB.accent, color:'#fff', fontSize:'11px', fontWeight:700,
              padding:'14px', borderRadius:'999px', letterSpacing:'0.1em', textTransform:'uppercase',
              border:'none', cursor: canAdvance ? 'pointer' : 'not-allowed', opacity: canAdvance ? 1 : 0.45,
              boxShadow:'0 4px 20px rgba(225,6,0,0.2)', fontFamily:HUB.fontBold,
            }}
          >SIMULATE 1 DAY</motion.button>
        </div>
      </aside>

      {/* ── Top Header ── */}
      <header style={{
        position:'fixed', top:0, left:'256px', right:0, height:'64px', zIndex:40,
        background:'rgba(26,30,46,0.6)', backdropFilter:'blur(12px)',
        borderBottom:`1px solid ${HUB.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <div style={{width:'7px', height:'7px', borderRadius:'50%', backgroundColor:'#22c55e'}}></div>
            <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:HUB.fontRegular}}>System Online</span>
          </div>
          <div style={{width:'1px', height:'16px', background:'rgba(255,255,255,0.1)'}}></div>
          <span style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>v4.0.2 telemetry</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'14px'}}>
          <button onClick={() => handleNav('standings')} style={{background:'none', border:'none', cursor:'pointer', color:HUB.textMuted, padding:0, display:'flex'}}>
            <Bell size={20}/>
          </button>
          <div style={{width:'32px', height:'32px', borderRadius:'50%', border:`1px solid ${HUB.border}`, background:'rgba(225,6,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, color:'#fff', fontFamily:HUB.fontBold}}>
            {state.team.name.substring(0,2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Main Slot ── */}
      <main style={{
        marginLeft:'256px', paddingTop:'88px', paddingBottom:'104px',
        paddingLeft:'32px', paddingRight:'32px', minHeight:'100vh', boxSizing:'border-box',
        position: 'relative' // needed for AnimatePresence absolute children if any, but we just use mode="wait"
      }}>
        <div style={{maxWidth:'1440px', margin:'0 auto', height: '100%'}}>
          <AnimatePresence mode="wait">
            <PageTransition id={activeScreen}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Bottom Action Bar ── */}
      <div style={{
        position:'fixed', bottom:0, left:'256px', right:0, height:'72px', zIndex:40,
        background:'rgba(26,30,46,0.6)', backdropFilter:'blur(12px)',
        borderTop:`1px solid ${HUB.border}`, padding:'0 32px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{display:'flex', gap:'4px'}}>
          {[
            { id:'market',   icon:<ShoppingCart size={18}/> },
            { id:'engineering', icon:<Wrench size={18}/> },
            { id:'standings',icon:<Activity size={18}/> },
          ].map(item => (
            <button key={item.id} onClick={() => handleNav(item.id)}
              style={{width:'44px', height:'44px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'8px', color:HUB.textMuted, background:'none', border:'none', cursor:'pointer', transition:'all 0.15s'}}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='white'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=HUB.textMuted; (e.currentTarget as HTMLElement).style.background='none'; }}
            >{item.icon}</button>
          ))}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:'10px', fontWeight:700, color:HUB.textMuted, textTransform:'uppercase', margin:0, fontFamily:HUB.fontRegular}}>Season Status</p>
            <p style={{fontSize:'12px', fontWeight:700, color:'#fff', margin:0, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em'}}>
              Day <AnimatedNumber value={state.season.currentDay || 1} /> · Round {state.season.round} / {totalRounds}
            </p>
          </div>
          <button onClick={handleSimulate} disabled={!canAdvance}
            style={{
              backgroundColor:HUB.accent, color:'#fff', padding:'10px 28px', borderRadius:'999px',
              fontSize:'11px', fontWeight:900, letterSpacing:'0.18em', textTransform:'uppercase', border:'none',
              cursor: canAdvance ? 'pointer' : 'not-allowed', opacity: canAdvance ? 1 : 0.5,
              boxShadow:'0 4px 20px rgba(225,6,0,0.3)', display:'flex', alignItems:'center', gap:'10px',
              transition:'all 0.15s', fontFamily:HUB.fontBold,
            }}
          >FAST FORWARD <FastForward size={13}/></button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}

// ── Mount / Unmount helpers ──────────────────────────────────────────────────
let layoutRoot: any = null;
let layoutNode: HTMLElement | null = null;

export function unmountLayout() {
  if (layoutRoot) { layoutRoot.unmount(); layoutRoot = null; }
  if (layoutNode?.parentNode) { layoutNode.parentNode.removeChild(layoutNode); layoutNode = null; }
  const app = document.getElementById('app');
  if (app) app.style.display = '';
}

export function mountLayout(
  appRoot: HTMLElement,
  activeScreen: string,
  content: React.ReactNode,
  onSimulate?: () => void,
) {
  const appEl = document.getElementById('app');
  if (appEl) appEl.style.display = 'none';

  if (!layoutNode) {
    layoutNode = document.createElement('div');
    layoutNode.id = 'hub-layout-root';
    document.body.appendChild(layoutNode);
    layoutRoot = createRoot(layoutNode);
  }

  layoutRoot.render(
    <HubLayout activeScreen={activeScreen} appRoot={appRoot} onSimulate={onSimulate}>
      {content}
    </HubLayout>
  );
}
