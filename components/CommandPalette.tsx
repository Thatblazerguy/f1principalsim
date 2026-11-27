import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, CornerDownLeft, FastForward, Flag, LogOut, Moon, Search, Shield, SkipForward, Sun } from 'lucide-react';
import { state } from '../state.js';
import { canSimulateNextDay, simulateNextDay } from '../utils/seasonTimeline.js';
import { syncGame } from '../lib/supabaseApi.js';
import { useDialogFocus } from './useDialogFocus.ts';
import './command-palette.css';

type NavItem = { id: string; label: string; icon: React.ReactNode; group: string | null };
type Command = { key: string; label: string; hint: string; icon: React.ReactNode; run: () => void | Promise<void>; disabled?: boolean; current?: boolean; keywords?: string };

const RECENT_KEY = 'f1p.commandPalette.recent';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((k: unknown) => typeof k === 'string'); } catch { return []; } };
const pushRecent = (key: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([key, ...readRecent().filter(k => k !== key)].slice(0, 5))); } catch { /* storage unavailable */ } };

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Subsequence fuzzy match. Returns a score (higher is better) and matched indices, or null. */
function fuzzy(query: string, text: string): { score: number; hits: number[] } | null {
  if (!query) return { score: 0, hits: [] };
  const q = query.toLowerCase(), t = text.toLowerCase();
  const hits: number[] = [];
  let score = 0, ti = 0, prev = -2;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += 1;
    if (found === prev + 1) score += 3;                         // contiguous run
    if (found === 0 || /[\s-]/.test(t[found - 1])) score += 4;  // word start
    score -= Math.min(3, (found - ti) * 0.1);                   // gap penalty
    hits.push(found); prev = found; ti = found + 1;
  }
  return { score: score - t.length * 0.01, hits };
}

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{[...text].map((c, i) => set.has(i) ? <mark key={i}>{c}</mark> : <React.Fragment key={i}>{c}</React.Fragment>)}</>;
}

interface Props {
  activeScreen: string;
  appRoot: HTMLElement;
  navItems: NavItem[];
  onNav: (id: string) => void | Promise<void>;
  onSkipToRaceDay: () => void | Promise<void>;
  onSimulate?: () => void;
  onLogout: () => void | Promise<void>;
}

/**
 * ⌘K / Ctrl+K command palette. Screens come from HubLayout's own nav list and
 * run through its handleNav; actions call the same handlers HubLayout's buttons use.
 */
export function CommandPalette({ activeScreen, appRoot, navItems, onNav, onSkipToRaceDay, onSimulate, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('f1p:command-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('f1p:command-palette', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setRecent(readRecent()); } }, [open]);
  const close = () => setOpen(false);
  useDialogFocus(open, panelRef, close, inputRef);

  const canAdvance = open && canSimulateNextDay(state);

  // The dashboard mounts without an onSimulate refresher; re-render it the same way its nav entry does.
  const refreshAfterSimulate = async () => {
    if (onSimulate) { onSimulate(); return; }
    if (activeScreen === 'dashboard') { const { renderDashboard } = await import('../screens/dashboard.tsx'); renderDashboard(appRoot); }
  };

  const commands: Command[] = useMemo(() => {
    const screens: Command[] = navItems.map(item => ({
      key: `screen:${item.id}`,
      label: item.label,
      hint: item.id === activeScreen ? 'Current screen' : item.group || 'Screen',
      icon: item.icon,
      current: item.id === activeScreen,
      run: () => onNav(item.id),
    }));
    const actions: Command[] = [
      { key: 'action:simulate-day', label: 'Simulate 1 day', hint: 'Advance the season clock', icon: <SkipForward size={16} strokeWidth={1.5} />, disabled: !canAdvance, keywords: 'advance next day',
        run: async () => { const r = simulateNextDay(state); if (!r.advanced) return; await syncGame(); await refreshAfterSimulate(); } },
      { key: 'action:skip-race-day', label: 'Skip to race day', hint: 'Run the season clock to the next race', icon: <FastForward size={16} strokeWidth={1.5} />, disabled: !canAdvance, keywords: 'advance fast forward time calendar season clock',
        run: () => onSkipToRaceDay() },
      { key: 'action:weekend', label: 'Go to race weekend', hint: 'Practice, qualifying and race', icon: <Flag size={16} strokeWidth={1.5} />, current: activeScreen === 'weekend', run: () => onNav('weekend') },
      { key: 'action:calendar', label: 'Open calendar', hint: 'Season schedule', icon: <CalendarDays size={16} strokeWidth={1.5} />, current: activeScreen === 'calendar', run: () => onNav('calendar') },
      { key: 'action:fia', label: 'FIA mode', hint: 'Governing body view', icon: <Shield size={16} strokeWidth={1.5} />, run: () => onNav('fia') },
      { key: 'action:theme', label: document.documentElement.dataset.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode', hint: 'Appearance', icon: document.documentElement.dataset.theme === 'light' ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />, keywords: 'theme appearance dark light colour color',
        run: () => { window.dispatchEvent(new Event('f1p-theme-toggle')); } },
      { key: 'action:logout', label: 'Log out', hint: 'Sign out of F1P', icon: <LogOut size={16} strokeWidth={1.5} />, keywords: 'sign out', run: () => onLogout() },
    ];
    // "FIA mode" is both a nav screen and a quick action — list it once, as an action.
    return [...screens.filter(s => s.key !== 'screen:fia'), ...actions];
  }, [navItems, activeScreen, canAdvance, onNav, onSkipToRaceDay, onLogout, onSimulate]);

  const sections = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const byKey = new Map(commands.map(c => [c.key, c]));
      const rec = recent.map(k => byKey.get(k)).filter(Boolean) as Command[];
      const recSet = new Set(rec.map(c => c.key));
      return [
        { title: 'Recent', items: rec.map(c => ({ c, hits: [] as number[] })) },
        { title: 'Actions', items: commands.filter(c => c.key.startsWith('action:') && !recSet.has(c.key)).map(c => ({ c, hits: [] as number[] })) },
        { title: 'Screens', items: commands.filter(c => c.key.startsWith('screen:') && !recSet.has(c.key)).map(c => ({ c, hits: [] as number[] })) },
      ].filter(s => s.items.length);
    }
    const scored = commands
      .map(c => {
        const m = fuzzy(q, c.label);
        const k = !m && c.keywords ? fuzzy(q, c.keywords) : null;
        const best = m || (k ? { score: k.score - 2, hits: [] } : null);
        if (!best) return null;
        const recency = recent.indexOf(c.key);
        return { c, hits: best.hits, score: best.score + (recency >= 0 ? 2 - recency * 0.3 : 0) };
      })
      .filter(Boolean) as { c: Command; hits: number[]; score: number }[];
    scored.sort((a, b) => b.score - a.score);
    return scored.length ? [{ title: 'Results', items: scored }] : [];
  }, [query, commands, recent]);

  const flat = sections.flatMap(s => s.items.map(i => i.c));
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runCommand = async (c: Command | undefined) => {
    if (!c || c.disabled) return;
    pushRecent(c.key);
    setOpen(false);
    if (c.current) return;
    await c.run();
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + flat.length) % flat.length); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(flat.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCommand(flat[active]); }
  };

  let idx = -1;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="f1p-cmdk-root" key="cmdk">
          <motion.div className="f1p-cmdk-overlay" onClick={close}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }} />
          <motion.div ref={panelRef} className="f1p-cmdk" role="dialog" aria-modal="true" aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99, transition: { duration: 0.15 } }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="f1p-cmdk-field">
              <Search size={16} strokeWidth={1.5} aria-hidden />
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onInputKey}
                placeholder="Search screens and actions" aria-label="Search screens and actions"
                role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
                spellCheck={false} autoComplete="off" />
              <kbd className="f1p-cmdk-kbd">Esc</kbd>
            </div>
            <div ref={listRef} id={listId} role="listbox" aria-label="Commands" className="f1p-cmdk-list">
              {sections.length === 0 && <p className="f1p-cmdk-empty">No screen or action matches "{query}".</p>}
              {sections.map(section => (
                <div key={section.title} role="group" aria-label={section.title}>
                  <p className="f1p-cmdk-group">{section.title}</p>
                  {section.items.map(({ c, hits }) => {
                    idx += 1;
                    const i = idx;
                    const isActive = i === active;
                    return (
                      <div key={c.key} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={isActive} aria-disabled={c.disabled || undefined}
                        className={`f1p-cmdk-item${isActive ? ' is-active' : ''}${c.disabled ? ' is-disabled' : ''}`}
                        onPointerMove={() => { if (active !== i) setActive(i); }}
                        onClick={() => runCommand(c)}>
                        {isActive && (
                          <motion.span layoutId="f1p-cmdk-highlight" className="f1p-cmdk-highlight"
                            transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }} />
                        )}
                        <span className="f1p-cmdk-icon">{c.icon}</span>
                        <span className="f1p-cmdk-label"><Highlight text={c.label} hits={hits} /></span>
                        <span className="f1p-cmdk-hint">{c.disabled ? 'Not available now' : c.current ? 'You are here' : c.hint}</span>
                        {isActive && !c.disabled && <CornerDownLeft className="f1p-cmdk-enter" size={14} strokeWidth={1.5} aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="f1p-cmdk-foot" aria-hidden>
              <span><kbd className="f1p-cmdk-kbd">↑</kbd><kbd className="f1p-cmdk-kbd">↓</kbd> to move</span>
              <span><kbd className="f1p-cmdk-kbd">Enter</kbd> to open</span>
              <span><kbd className="f1p-cmdk-kbd">{isMac() ? '⌘' : 'Ctrl'}</kbd><kbd className="f1p-cmdk-kbd">K</kbd> to toggle</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Header trigger with a keycap hint. Opens the palette mounted in HubLayout. */
export function CommandPaletteTrigger() {
  return (
    <button type="button" className="f1p-cmdk-trigger hub-btn hub-btn-ghost" aria-label="Open command palette"
      aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
      onClick={() => window.dispatchEvent(new Event('f1p:command-palette'))}>
      <Search size={16} strokeWidth={1.5} aria-hidden />
      <span className="f1p-cmdk-trigger-text">Search</span>
      <span className="f1p-cmdk-trigger-keys" aria-hidden>
        <kbd className="f1p-cmdk-kbd">{isMac() ? '⌘' : 'Ctrl'}</kbd><kbd className="f1p-cmdk-kbd">K</kbd>
      </span>
    </button>
  );
}
