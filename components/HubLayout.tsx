import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, Flag, Wrench, Users, Activity,
  Bell, FastForward, LogOut, ShoppingCart, Star,
  Trophy, CalendarDays, DollarSign, GraduationCap, History,
  Menu, MoreHorizontal, X, Crosshair, Shield, Sun, Moon
} from 'lucide-react';
import { state } from '../state.js';
import { getTrackPath } from '../data/realTrackLayouts.js';
import { canSimulateNextDay, simulateNextDay, getRoundRaceDay, formatSeasonDate } from '../utils/seasonTimeline.js';
import { syncGame, logoutUser } from '../lib/supabaseApi.js';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, AnimatedNumber, microTransition } from './ui/motion.tsx';
import { CommandPalette, CommandPaletteTrigger } from './CommandPalette.tsx';
import { SeasonSimulator, type AdvanceRequest } from './season/SeasonSimulator.tsx';

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Graphite ramp, one accent (racing red), display type family.
// Two palettes. HUB holds the active one: applyTheme() swaps the values and the
// layout remounts, so inline styles, SVG attributes and canvas charts all
// repaint. Stylesheets read the matching CSS variables set on <html data-theme>.
export const HUB_THEMES = {
  dark: {
    bg: '#060607', sidebar: '#08080a', surface: 'rgba(17,17,19,0.94)', raised: '#1c1c1f',
    accent: '#E10600', accentInk: '#ff4d47', accentSoft: 'rgba(225,6,0,0.12)',
    textPrimary: '#ededed', textSecondary: '#a1a1a6', textMuted: '#a1a1a6', textFaint: '#85858b',
    border: 'rgba(237,237,237,0.1)', borderMid: 'rgba(237,237,237,0.14)',
    positive: '#4cc38a', negative: '#e5484d', warning: '#d9a43a',
    tyre: { soft: '#e5484d', medium: '#e8c547', hard: '#ededed', inter: '#4cc38a', wet: '#4a8fe0' } as Record<string, string>,
  },
  light: {
    bg: '#f3f3f1', sidebar: '#ebebe8', surface: 'rgba(255,255,255,0.96)', raised: '#ecece9',
    accent: '#E10600', accentInk: '#c20500', accentSoft: 'rgba(225,6,0,0.08)',
    textPrimary: '#141416', textSecondary: '#4d4d53', textMuted: '#4d4d53', textFaint: '#66666c',
    border: 'rgba(22,22,26,0.12)', borderMid: 'rgba(22,22,26,0.18)',
    positive: '#17804f', negative: '#c4323a', warning: '#8f6210',
    tyre: { soft: '#d6363c', medium: '#c49a12', hard: '#8e8e94', inter: '#1f9e63', wet: '#2f74c9' } as Record<string, string>,
  },
};
export type ThemePref = 'dark' | 'light' | 'system';
export const HUB = {
  ...HUB_THEMES.dark,
  radius:       '14px',
  ease:         'cubic-bezier(0.22, 1, 0.36, 1)',
  fontWide:     "'Formula1-Wide', sans-serif",
  fontBold:     "'Formula1-Bold', sans-serif",
  fontRegular:  "'Formula1-Regular', sans-serif",
  fontMono:     "'Formula1-Bold', sans-serif",
  fontSans:     "'Formula1-Regular', sans-serif",
};

const THEME_KEY = 'f1p-theme';
export function getThemePref(): ThemePref {
  try { const v = localStorage.getItem(THEME_KEY); if (v === 'dark' || v === 'light' || v === 'system') return v; } catch { /* storage blocked */ }
  return 'system';
}
export function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref !== 'system') return pref;
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch { return 'dark'; }
}
/** Switch palettes: HUB values, <html data-theme>, and the Tailwind/shadcn `dark` class. */
export function applyTheme(pref: ThemePref = getThemePref()) {
  const mode = resolveTheme(pref);
  Object.assign(HUB, HUB_THEMES[mode]);
  HUB.tyre = { ...HUB_THEMES[mode].tyre };
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle('dark', mode === 'dark');
  }
  return mode;
}
export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage blocked: still applies for this session */ }
  const mode = applyTheme(pref);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('f1p-theme', { detail: mode }));
  return mode;
}
if (typeof window !== 'undefined') applyTheme();

export const tyreDot = (compound: string, size = 8) => {
  const key = String(compound || '').toLowerCase().replace(/[^a-z]/g, '');
  const alias: Record<string, string> = { s: 'soft', m: 'medium', h: 'hard', i: 'inter', w: 'wet', intermediate: 'inter', intermediates: 'inter' };
  const color = HUB.tyre[key] || HUB.tyre[alias[key]] || HUB.tyre[key.slice(0, 5)] || HUB.textFaint;
  return <span aria-hidden style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', border: `2px solid ${color}`, boxSizing: 'border-box', flexShrink: 0 }} />;
};

// ─── Shared card / section styles ─────────────────────────────────────────────
export const glassCard = (extra = {}) => ({
  background:     HUB.surface,
  border:         `1px solid ${HUB.border}`,
  borderRadius:   HUB.radius,
  padding:        '24px',
  fontFamily:     HUB.fontRegular,
  ...extra,
});

export const statCell = (extra = {}) => ({
  background:   HUB.raised,
  border:       `1px solid ${HUB.border}`,
  borderRadius: '10px',
  padding:      '12px 16px',
  ...extra,
});

export const pill = (active = false) => ({
  padding:         '4px 10px',
  borderRadius:    '6px',
  fontSize:        '12px',
  fontWeight:      400,
  border:          `1px solid ${active ? 'rgba(225,6,0,0.4)' : HUB.border}`,
  backgroundColor: active ? HUB.accentSoft : HUB.raised,
  color:           active ? HUB.textPrimary : HUB.textMuted,
  fontFamily:      HUB.fontRegular,
  cursor:          'default',
});

// ─── Buttons ──────────────────────────────────────────────────────────────────
// One system for every button and CTA. Pair the style with the class so hover,
// focus and disabled states come from style.css:
//   <button className={btnClass('secondary')} style={btn('secondary', 'sm')}>
// primary   — the one action that moves the game forward in this view (red)
// secondary — every other action (raised graphite + hairline)
// ghost     — low-emphasis actions, back links, icon buttons in toolbars
// danger    — destructive actions (release, cancel pit, reject): negative text, not a red fill
export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type BtnSize = 'sm' | 'md' | 'lg';
const BTN_SIZES: Record<BtnSize, React.CSSProperties> = {
  sm: { height: '32px', padding: '0 12px', fontSize: '13px', gap: '6px' },
  md: { height: '36px', padding: '0 16px', fontSize: '13px', gap: '8px' },
  lg: { height: '48px', padding: '0 24px', fontSize: '14px', gap: '8px' },
};
// Liquid glass (components/ui/liquid-glass-button.tsx): the light ring and refraction come
// from the .hub-btn-* pseudo-elements in style.css; these set the tint underneath.
const BTN_VARIANTS: Record<BtnVariant, React.CSSProperties> = {
  // colours are CSS variables so they follow the theme without recomputing
  primary:   { backgroundColor: 'rgba(225,6,0,0.82)', color: '#fff', border: '1px solid transparent', boxShadow: 'none', fontFamily: HUB.fontBold },
  secondary: { backgroundColor: 'rgba(var(--ink),0.045)', color: 'var(--hub-t1)', border: '1px solid transparent', boxShadow: 'none', fontFamily: HUB.fontBold },
  ghost:     { backgroundColor: 'transparent', color: 'var(--hub-t2)', border: '1px solid transparent', boxShadow: 'none', fontFamily: HUB.fontRegular },
  danger:    { backgroundColor: 'rgba(229,72,77,0.08)', color: 'var(--hub-neg)', border: '1px solid transparent', boxShadow: 'none', fontFamily: HUB.fontBold },
};
export const btn = (variant: BtnVariant = 'secondary', size: BtnSize = 'md', extra: React.CSSProperties = {}): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '999px', fontWeight: 400, lineHeight: 1, whiteSpace: 'nowrap',
  cursor: 'pointer', margin: 0, boxSizing: 'border-box',
  ...BTN_SIZES[size], ...BTN_VARIANTS[variant], ...extra,
});
export const btnClass = (variant: BtnVariant = 'secondary', extra = '') => `hub-btn hub-btn-${variant}${extra ? ' ' + extra : ''}`;
/** Square icon-only button. Always pass an aria-label. */
export const iconBtn = (size: BtnSize = 'md', extra: React.CSSProperties = {}): React.CSSProperties =>
  btn('ghost', size, { padding: 0, width: BTN_SIZES[size].height, ...extra });

/** @deprecated use btn('primary', size) with btnClass('primary') */
export const actionBtn = (extra: React.CSSProperties = {}) => btn('primary', 'md', extra);

export const sectionLabel = (text: string) => (
  <p style={{
    fontSize:'14px', fontWeight:400, color:HUB.textFaint,
    margin:'0 0 12px', fontFamily:HUB.fontRegular,
  }}>{text}</p>
);

export const pageTitle = (text: string) => (
  <h2 className="hub-title" key={text} style={{
    fontSize:'clamp(28px, calc(2.6*var(--vw)), 40px)', fontWeight:400, color:HUB.textPrimary,
    margin:'0 0 12px', fontFamily:HUB.fontWide, lineHeight:1.05,
    textTransform:'uppercase',
  }}>
    {String(text).split(' ').map((w, i, all) => (
      <React.Fragment key={i}>
        <span className="hub-w"><span style={{ animationDelay: `${i * 45}ms` }}>{w}</span></span>{i < all.length - 1 ? ' ' : ''}
      </React.Fragment>
    ))}
  </h2>
);

export const pageSubtitle = (text: string) => (
  <p style={{fontSize:'14px', color:HUB.textMuted, margin:'0', lineHeight:1.5, fontFamily:HUB.fontRegular, maxWidth:'60ch'}}>{text}</p>
);

export const statLabel = (text: string) => (
  <p style={{fontSize:'12px', fontWeight:400, color:HUB.textFaint, margin:'0 0 4px', fontFamily:HUB.fontRegular}}>{text}</p>
);

export const statValue = (text: string | number, color: string = HUB.textPrimary) => (
  <p style={{
    fontSize:'22px', fontWeight:400, color, margin:0,
    fontFamily:HUB.fontMono,
    fontVariantNumeric: 'tabular-nums',
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => resolveTheme(getThemePref()));
  const toggleTheme = () => setThemePref(themeMode === 'dark' ? 'light' : 'dark');
  // Follow the system setting until the player picks a theme
  useEffect(() => {
    if (getThemePref() !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setThemeMode(applyTheme('system'));
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  useEffect(() => {
    const on = (e: Event) => setThemeMode((e as CustomEvent).detail);
    const flip = () => setThemePref(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    window.addEventListener('f1p-theme', on);
    window.addEventListener('f1p-theme-toggle', flip);
    return () => { window.removeEventListener('f1p-theme', on); window.removeEventListener('f1p-theme-toggle', flip); };
  }, []);
  const canAdvance = canSimulateNextDay(state);
  const totalRounds = Math.min(state.season.totalRounds || 24, 24);

  // Navigate between game screens without tearing down the layout.
  // We simply call the screen's render function — mountLayout() handles
  // re-rendering in place if the hub-layout-root node already exists.
  const navigate = (renderFn: (r: HTMLElement) => void) => {
    renderFn(appRoot);
  };

  // ── Advance time: the season clock panel ──
  // Every entry point (bottom bar, mobile button, dashboard Next Race card, ⌘K)
  // opens the same panel, which advances days through simulateNextDay.
  const [sim, setSim] = useState<{ open: boolean; auto: AdvanceRequest | null }>({ open: false, auto: null });
  const openSim = (auto: AdvanceRequest | null = null) => setSim({ open: true, auto });
  useEffect(() => {
    const on = (e: Event) => openSim((e as CustomEvent).detail?.autoStart ?? null);
    window.addEventListener('f1p:advance-time', on);
    return () => window.removeEventListener('f1p:advance-time', on);
  }, []);

  // ⌘K "Skip to race day": open the clock and run it to the weekend
  const handleSimulate = async () => {
    if (!canAdvance) return;
    openSim({ mode: 'race' });
  };

  // Lazy-import nav targets to avoid circular deps — screens import each other
  const navItems = [
    { id: 'dashboard',    icon: <LayoutDashboard size={16} strokeWidth={1.5}/>, label: 'Dashboard',     group: null },
    { id: 'weekend',      icon: <Flag size={16} strokeWidth={1.5}/>,            label: 'Race weekend',  group: null },
    null, // divider
    { id: 'engineering',  icon: <Wrench size={16} strokeWidth={1.5}/>,          label: 'Engineering',     group: 'Team' },
    { id: 'drivers',      icon: <Users size={16} strokeWidth={1.5}/>,           label: 'Drivers',  group: 'Team' },
    { id: 'academy',      icon: <GraduationCap size={16} strokeWidth={1.5}/>,   label: 'Academy',   group: 'Team' },
    { id: 'market',       icon: <ShoppingCart size={16} strokeWidth={1.5}/>,    label: 'Driver market',   group: 'Team' },
    { id: 'sponsors',     icon: <Star size={16} strokeWidth={1.5}/>,            label: 'Sponsors', group: 'Team' },
    { id: 'finance',      icon: <DollarSign size={16} strokeWidth={1.5}/>,      label: 'Finance', group: 'Team' },
    null, // divider
    { id: 'teams',        icon: <Trophy size={16} strokeWidth={1.5}/>,          label: 'Teams', group: 'Championship' },
    { id: 'standings',    icon: <Activity size={16} strokeWidth={1.5}/>,        label: 'Standings', group: 'Championship' },
    { id: 'calendar',     icon: <CalendarDays size={16} strokeWidth={1.5}/>,    label: 'Calendar',  group: 'Championship' },
    { id: 'history',      icon: <History size={16} strokeWidth={1.5}/>,         label: 'History',  group: 'Championship' },
    { id: 'fia',          icon: <Shield size={16} strokeWidth={1.5}/>,          label: 'FIA mode', group: 'Championship' },
  ];

  const handleNav = async (id: string) => {
    if (id === activeScreen) return;
    await renderScreen(id);
  };

  const renderScreen = async (id: string) => {
    if (id === 'fia') {
      const { renderFIADashboard } = await import('../fia/FIADashboard.tsx');
      renderFIADashboard(document.getElementById('app')!);
      setIsDrawerOpen(false);
      return;
    }
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
    const { renderEngineering }= await import('../screens/engineering.tsx');
    const { renderHistory }    = await import('../screens/history.tsx');

    const isSeasonOver = state.season.round > totalRounds ||
      (state.weekendProgress?.raceComplete && state.season.round === totalRounds);

    const map: Record<string, () => void> = {
      dashboard:   () => navigate(renderDashboard),
      weekend:     () => navigate(isSeasonOver ? renderOffseason : renderWeekend),
      engineering: () => navigate(renderEngineering),
      drivers:     () => navigate(renderMyDrivers),
      academy:     () => navigate(renderAcademy),
      market:      () => navigate(renderMarket),
      sponsors:    () => navigate(renderSponsors),
      finance:     () => navigate(renderFinance),
      teams:       () => navigate(renderTeams),
      standings:   () => navigate(renderLeaderboard),
      calendar:    () => navigate(renderCalendar),
      history:     () => navigate(renderHistory),
    };
    map[id]?.();
    setIsDrawerOpen(false); // Close drawer on navigation
  };

  const closeSim = async (changed: boolean) => {
    setSim({ open: false, auto: null });
    if (!changed) return;
    if (onSimulate) onSimulate();
    else await renderScreen(activeScreen);
  };
  const enterWeekend = () => { void renderScreen('weekend'); };
  const seasonOver = state.season.round > totalRounds;
  const advanceLabel = seasonOver ? 'Plan offseason' : canAdvance ? 'Advance time' : 'Race weekend';
  const onAdvanceClick = () => (seasonOver ? renderScreen('weekend') : openSim());

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Error signing out:", err);
    }
    unmountLayout();
    window.location.reload();
  };

  let prevGroup: string | null = 'NONE';
  const isRaceOrDashboard = activeScreen === 'dashboard' || activeScreen === 'weekend';

  return (
    <div style={{fontFamily:HUB.fontSans, backgroundColor:HUB.bg, color:HUB.textPrimary, minHeight:'calc(100*var(--vh))'}}>

      {/* ── Mobile Drawer Overlay ── */}
      {isDrawerOpen && (
        <div 
          className="mobile-drawer-overlay show-on-mobile" 
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar / Drawer ── */}
      <aside 
        className={`desktop-sidebar mobile-drawer ${isDrawerOpen ? 'open' : ''}`}
        style={{
          position:'fixed', left:0, top:0, height:'calc(100*var(--vh))', width:'256px', zIndex:101,
          backgroundColor:HUB.sidebar, borderRight:`1px solid ${HUB.border}`,
          display:'flex', flexDirection:'column', padding:'24px 0',
        }}
      >
        <div style={{padding:'0 24px', marginBottom:'32px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{ fontFamily: HUB.fontWide, fontStyle: 'italic', fontSize: '16px', color: HUB.textPrimary, marginBottom: '16px' }}>F1<span style={{ color: HUB.accent }}>P</span></div>
            <h1 style={{
              fontSize: '15px',
              fontWeight: 400,
              color: HUB.textPrimary,
              margin: 0,
              fontFamily: HUB.fontBold,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '200px'
            }}>
              {state.team.name}
            </h1>
            <p style={{fontSize:'12px', color:HUB.textFaint, marginTop:'4px', marginBottom:0, fontFamily:HUB.fontRegular}}>
              Season {state.season.year || 1} · Round {state.season.round}
            </p>
          </div>
          <button
            className={btnClass('ghost', 'show-on-mobile')}
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close menu"
            style={iconBtn('sm')}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <nav style={{flex:1, padding:'0 12px', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto', scrollbarWidth:'none'}}>
          {navItems.map((item, i) => {
            if (!item) {
              return <div key={`div-${i}`} style={{height:'16px'}} />;
            }
            const showGroupLabel = item.group && item.group !== prevGroup;
            prevGroup = item.group;
            const isActive = item.id === activeScreen;
            return (
              <React.Fragment key={item.id}>
                {showGroupLabel && (
                  <p style={{fontSize:'12px', color:HUB.textFaint, padding:'0 12px', margin:'0 0 6px', fontFamily:HUB.fontRegular}}>
                    {item.group}
                  </p>
                )}
                <button onClick={() => handleNav(item.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    height:'34px', padding:'0 12px', borderRadius:'8px', flexShrink:0,
                    color: isActive ? HUB.textPrimary : HUB.textMuted,
                    border:'none',
                    cursor: isActive ? 'default' : 'pointer',
                    fontSize:'14px', fontWeight:400,
                    transition:'color 150ms, background-color 150ms',
                    width:'100%', textAlign:'left', boxSizing:'border-box',
                    fontFamily:HUB.fontBold,
                    position: 'relative',
                    background: 'transparent'
                  }}
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color=HUB.textPrimary; (e.currentTarget as HTMLElement).style.background='rgba(var(--ink),0.04)'; }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.color=HUB.textMuted; (e.currentTarget as HTMLElement).style.background='transparent'; }}}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: HUB.raised,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        zIndex: 0
                      }}
                    >
                      <span style={{ position:'absolute', left:0, top:'9px', bottom:'9px', width:'2px', borderRadius:'2px', background:HUB.accent }} />
                    </motion.div>
                  )}
                  <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit' }}>
                    <span style={{ width:16, display:'flex', color: isActive ? HUB.textPrimary : HUB.textFaint }}>{item.icon}</span>{item.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div style={{padding:'16px 12px 0', marginTop:'auto', display:'flex', flexDirection:'column', gap:'4px', borderTop:`1px solid ${HUB.border}`}}>
          <button
            onClick={handleLogout}
            className={btnClass('ghost')}
            style={btn('ghost', 'sm', { height: '34px', justifyContent: 'flex-start', gap: '10px', fontSize: '14px', width: '100%' })}
          >
            <LogOut size={16} strokeWidth={1.5}/> Log out
          </button>
          <motion.button 
            onClick={() => { setIsDrawerOpen(false); void onAdvanceClick(); }}
            whileTap={{ scale: 0.98 }}
            transition={microTransition}
            className={btnClass('primary', 'show-on-mobile')}
            style={btn('primary', 'md', { width: '100%', marginTop: '8px' })}
          >{advanceLabel} <FastForward size={16} strokeWidth={1.5}/></motion.button>
        </div>
      </aside>

      {/* ── Top Header ── */}
      <header className="mobile-header" style={{
        position:'fixed', top:0, left:'256px', right:0, height:'64px', zIndex:40,
        background:'rgba(var(--bg-rgb),0.82)',
        borderBottom:`1px solid ${HUB.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <button
            className={btnClass('ghost', 'show-on-mobile')}
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu"
            style={iconBtn('md', { color: HUB.textPrimary })}
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <span style={{fontSize:'14px', color:HUB.textPrimary, fontFamily:HUB.fontRegular}}>
            {state.season.calendar?.find((r: any) => r.round === state.season.round)?.name || 'Season complete'}
          </span>
          <span className="hide-on-mobile" style={{fontSize:'13px', color:HUB.textFaint, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums'}}>
            {formatSeasonDate(state.season.year || 1, state.season.currentDay || 1)} · Round {state.season.round} of {totalRounds}
          </span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <CommandPaletteTrigger />
          <button onClick={toggleTheme} className={btnClass('ghost')} style={iconBtn('md')}
            aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}>
            {themeMode === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          <button onClick={() => handleNav('standings')} className={btnClass('ghost')} aria-label="Standings" title="Standings" style={iconBtn('md')}>
            <Bell size={18} strokeWidth={1.5}/>
          </button>
          <div style={{width:'32px', height:'32px', borderRadius:'50%', border:`1px solid ${HUB.border}`, background:HUB.raised, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:400, color:HUB.textPrimary, fontFamily:HUB.fontBold}}>
            {state.team.name.substring(0,2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Stage: the landing's studio, carried into the app ── */}
      <HubStage />

      {/* ── Main Slot ── */}
      <main style={{
        marginLeft:'256px', paddingTop:'96px', paddingBottom:'112px',
        paddingLeft:'40px', paddingRight:'40px', minHeight:'calc(100*var(--vh))', boxSizing:'border-box',
        position: 'relative', zIndex: 1 // needed for AnimatePresence absolute children if any, but we just use mode="wait"
      }}>
        <div style={{maxWidth:'1440px', margin:'0 auto', height: '100%'}}>
          <AnimatePresence mode="wait">
            <PageTransition id={activeScreen}>
              {/* remount on theme change so every inline style repaints with the new palette */}
              <React.Fragment key={themeMode}>{children}</React.Fragment>
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Bottom Action Bar (Desktop) ── */}
      <div className="hide-on-mobile" style={{
        position:'fixed', bottom:0, left:'256px', right:0, height:'72px', zIndex:40,
        background:'rgba(var(--bg-rgb),0.82)',
        borderTop:`1px solid ${HUB.border}`, padding:'0 32px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{display:'flex', gap:'4px'}}>
          {[
            { id:'market',   icon:<ShoppingCart size={16} strokeWidth={1.5}/>, label:'Driver market' },
            { id:'engineering', icon:<Wrench size={16} strokeWidth={1.5}/>, label:'Engineering' },
            { id:'standings',icon:<Activity size={16} strokeWidth={1.5}/>, label:'Standings' },
          ].map(item => (
            <button key={item.id} onClick={() => handleNav(item.id)} title={item.label} aria-label={item.label}
              className={btnClass('ghost')}
              style={iconBtn('md')}
            >{item.icon}</button>
          ))}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:'12px', color:HUB.textFaint, margin:0, fontFamily:HUB.fontRegular}}>Next race in</p>
            <p style={{fontSize:'13px', color:HUB.textPrimary, margin:0, fontFamily:HUB.fontMono, fontVariantNumeric:'tabular-nums'}}>
              {Math.max(0, getRoundRaceDay(state.season.round) - (state.season.currentDay || 1))} days
            </p>
          </div>
          <button onClick={() => void onAdvanceClick()}
            className={btnClass('primary')}
            style={btn('primary', 'md')}
            aria-haspopup="dialog"
            title={seasonOver ? undefined : 'Open the season clock'}
          >{advanceLabel} <FastForward size={16} strokeWidth={1.5}/></button>
        </div>
      </div>

      {/* ── Bottom Navigation Bar (Mobile) ── */}
      <div className="show-on-mobile" style={{
        position:'fixed', bottom:0, left:0, right:0, height:'72px', zIndex:40,
        background:HUB.sidebar,
        borderTop:`1px solid ${HUB.border}`, padding:'0 16px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        {[
          { id:'dashboard',   icon:<LayoutDashboard size={20} strokeWidth={1.5}/>, label: 'Hub' },
          { id:'weekend',     icon:<Flag size={20} strokeWidth={1.5}/>,            label: 'Race' },
          { id:'engineering', icon:<Wrench size={20} strokeWidth={1.5}/>,          label: 'Eng' },
          { id:'drivers',     icon:<Users size={20} strokeWidth={1.5}/>,           label: 'Drivers' },
          { id:'finance',     icon:<DollarSign size={20} strokeWidth={1.5}/>,      label: 'Finance' },
        ].map(item => (
          <button key={item.id} onClick={() => handleNav(item.id)}
            style={{
              flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px',
              color: activeScreen === item.id ? HUB.textPrimary : HUB.textFaint,
              background:'none', border:'none', cursor:'pointer', transition:'color 150ms', padding: 0, height: '100%',
              fontFamily: HUB.fontRegular, fontSize: '11px'
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={() => setIsDrawerOpen(true)}
          style={{
            flex: 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px',
            color: HUB.textFaint, background:'none', border:'none', cursor:'pointer', transition:'color 150ms', padding: 0, height: '100%',
            fontFamily: HUB.fontRegular, fontSize: '11px'
          }}
        >
          <MoreHorizontal size={20} strokeWidth={1.5}/>
          <span>More</span>
        </button>
      </div>

      {/* ── Floating Action Button (Mobile) ── */}
      {isRaceOrDashboard && (
        <button
          className="show-on-mobile"
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '16px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: HUB.accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 39,
            cursor: 'pointer'
          }}
          onClick={() => handleNav('weekend')}
        >
          <Crosshair size={24} />
        </button>
      )}

      <CommandPalette activeScreen={activeScreen} appRoot={appRoot} navItems={navItems.filter(Boolean) as any}
        onNav={handleNav} onSkipToRaceDay={handleSimulate} onSimulate={onSimulate} onLogout={handleLogout} />

      <SeasonSimulator open={sim.open} autoStart={sim.auto} onClose={closeSim} onEnterWeekend={enterWeekend} />
    </div>
  );
}

/** Fixed backdrop: vignette, a key light from above, and the next circuit drawn as a faint line. */
function HubStage() {
  const round = (state.season.calendar || []).find((r: any) => r.round === state.season.round);
  const d = getTrackPath(round?.name || 'British Grand Prix');
  return (
    <div className="hub-stage" aria-hidden>
      <svg className="hub-stage-track" viewBox="-40 -40 580 580" preserveAspectRatio="xMidYMid meet">
        <path d={d} fill="none" style={{ stroke: 'rgba(var(--ink),0.08)' }} strokeWidth="1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
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
    const existingNode = document.getElementById('hub-layout-root');
    if (existingNode) {
      existingNode.remove();
    }
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
