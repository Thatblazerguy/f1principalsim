import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronDown, CloudSun } from 'lucide-react';
import { HUB, btn, btnClass, tyreDot } from '../../components/HubLayout.tsx';
import { story, SECTIONS, local, smooth, window01, TYRE } from './story';
import { PitWallPreview } from './PitWallPreview';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

// Landing CTAs use the LiquidButton component directly; the rest of the app gets the same look through btn()/btnClass().
const CTA_PRIMARY = 'rounded-full bg-primary/80 text-white hover:bg-primary/90';
const CTA_SECONDARY = 'rounded-full text-foreground';
const CTA_FONT: React.CSSProperties = { fontFamily: "'Formula1-Bold', sans-serif", fontWeight: 400, fontSize: 14 };

gsap.registerPlugin(ScrollTrigger);

const loadScene = () => import('./Scene');
const Scene = lazy(loadScene);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

/** Splits text into word spans for staggered reveals. */
function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return <>{words.map((w, i) => <React.Fragment key={i}><span className="lx-w"><span>{w}</span></span>{i < words.length - 1 ? ' ' : ''}</React.Fragment>)}</>;
}

/* ── Boot sequence ─────────────────────────────────────────────────────────── */
const BOOT_LINES = ['Power unit', 'Gearbox', 'Telemetry link', 'Tyre blankets', 'Pit wall'];

function Boot({ ready: sceneReady, onDone, quick }: { ready: boolean; onDone: () => void; quick: boolean }) {
  let ready = sceneReady;
  const [lines, setLines] = useState(0);
  const [lights, setLights] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (quick) return;
    const id = setInterval(() => setLines(n => Math.min(BOOT_LINES.length, n + 1)), 170);
    return () => clearInterval(id);
  }, [quick]);
  // never hold the visitor longer than ~7s, even on a slow device
  const [forced, setForced] = useState(false);
  useEffect(() => { const id = setTimeout(() => setForced(true), 7000); return () => clearTimeout(id); }, []);
  ready = ready || forced;
  useEffect(() => {
    if (!ready) return;
    if (quick) { const id = setTimeout(onDone, 250); return () => clearTimeout(id); }
    if (lines < BOOT_LINES.length) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i <= 5) setLights(i);
      else { clearInterval(id); setTimeout(() => { setOut(true); setTimeout(onDone, 420); }, 380 + Math.random() * 300); }
    }, 190);
    return () => clearInterval(id);
  }, [ready, lines, quick, onDone]);
  const pct = Math.round(((ready ? 1 : 0.7) * (quick ? 1 : lines / BOOT_LINES.length)) * 100);
  return (
    <motion.div className="lx-boot" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
      <div className="lx-boot-inner">
        <div className="lx-boot-mark">F1<span>P</span></div>
        <div className="lx-boot-lights" aria-hidden>
          {[0, 1, 2, 3, 4].map(i => <span key={i} className={!out && lights > i ? 'on' : ''} />)}
        </div>
        <ul className="lx-boot-lines">
          {BOOT_LINES.map((l, i) => (
            <li key={l} style={{ opacity: quick || i < lines ? 1 : 0 }}><span>{l}</span><span>{quick || i < lines ? 'Ready' : ''}</span></li>
          ))}
        </ul>
        <div className="lx-boot-bar"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
        <p className="lx-boot-status">{out ? 'Lights out' : lights > 0 ? 'Formation complete' : ready ? 'Systems ready' : 'Loading car'}</p>
      </div>
    </motion.div>
  );
}

/* ── Strategy HUD, updated from the scroll position without re-rendering ──── */
function StrategyHud() {
  const lap = useRef<HTMLSpanElement>(null);
  const sector = useRef<HTMLSpanElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const gap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = local(3);
      const l = Math.max(1, Math.round(p * 52));
      if (lap.current) lap.current.textContent = String(l);
      if (sector.current) sector.current.textContent = `S${Math.min(3, Math.floor(((p * 1.15) % 1) * 3) + 1)}`;
      if (marker.current) marker.current.style.left = `${p * 100}%`;
      if (gap.current) gap.current.textContent = `+${(2.4 - p * 1.9).toFixed(3)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="lx-hud">
      <div className="lx-hud-row">
        <div><span className="lx-k">Lap</span><span className="lx-v"><span ref={lap}>1</span> / 52</span></div>
        <div><span className="lx-k">Sector</span><span className="lx-v" ref={sector}>S1</span></div>
        <div><span className="lx-k">Gap to P1</span><span className="lx-v" ref={gap}>+2.400</span></div>
      </div>
      <div>
        <span className="lx-k">Tyre strategy</span>
        <div className="lx-stints">
          <span style={{ flex: 18 }}>{tyreDot('soft', 10)} Soft · 18 laps</span>
          <span style={{ flex: 20 }}>{tyreDot('medium', 10)} Medium · 20</span>
          <span style={{ flex: 14 }}>{tyreDot('hard', 10)} Hard · 14</span>
          <span className="lx-stint-marker" ref={marker} />
        </div>
        <div className="lx-pits"><span>Pit lap 18</span><span>Pit lap 38</span></div>
      </div>
      <div className="lx-hud-row">
        <div><span className="lx-k">Weather</span><span className="lx-v lx-v-icon"><CloudSun size={14} strokeWidth={1.5} /> Dry · 21°C</span></div>
        <div><span className="lx-k">Rain risk</span><span className="lx-v">20% from lap 40</span></div>
      </div>
    </div>
  );
}

/* ── Static fallback (no WebGL) ───────────────────────────────────────────── */
function StaticHero() {
  return <div className="lx-static-visual"><PitWallPreview /></div>;
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export function LandingExperience({ onEnter, onFIA }: { onEnter: () => void; onFIA: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const cutRef = useRef<HTMLDivElement>(null);
  const raceCopy = useRef<HTMLDivElement>(null);
  const [webgl] = useState(hasWebGL);
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [mobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [quickBoot] = useState(() => { try { return sessionStorage.getItem('f1p-booted') === '1'; } catch { return false; } });
  const [sceneReady, setSceneReady] = useState(!webgl);
  const [booted, setBooted] = useState(false);

  story.reduced = reduced;
  story.mobile = mobile;

  // Start fetching the 3D chunk immediately, behind the boot screen
  useEffect(() => { if (webgl) loadScene(); }, [webgl]);

  // Smooth scroll + scroll → story position
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    story.t = 0;
    const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;
    let tickerFn: ((time: number) => void) | null = null;
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      tickerFn = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }

    const ctx = gsap.context(() => {
      const sections = SECTIONS.map(id => root.current!.querySelector<HTMLElement>(`#lx-${id}`)!);
      ScrollTrigger.create({
        trigger: root.current, start: 'top top', end: 'bottom bottom',
        onUpdate: () => {
          let t = 0;
          const vh = window.innerHeight;
          // each section's story completes when its sticky frame releases; the last screen holds while it scrolls away.
          // Screen-space rects keep this right under page zoom.
          sections.forEach((s, i) => {
            const r = s.getBoundingClientRect();
            if (r.top <= 0) t = i + Math.min(1, -r.top / Math.max(1, r.height - vh));
          });
          story.t = t;
          // black cut between the launch and the sunset
          if (cutRef.current) cutRef.current.style.opacity = String(window01(t, 4.975, 5.0, 0.03));
          const part = t >= 1 && t < 2 ? Math.round((t - 1.08) / 0.164) : -1;
          root.current!.querySelectorAll<HTMLElement>('.lx-parts li').forEach((li, i) => li.classList.toggle('is-active', i === part));
          if (raceCopy.current) {
            const on = t > 4.73 && t < 5;
            raceCopy.current.classList.toggle('is-in', on);
          }
        },
      });

      // Staggered copy reveals, one per section
      gsap.utils.toArray<HTMLElement>('.lx-reveal').forEach(el => {
        const words = el.querySelectorAll('.lx-w > span');
        const extras = el.querySelectorAll('.lx-fade');
        const tl = gsap.timeline({ paused: true });
        if (reduced) {
          tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        } else {
          tl.fromTo(words, { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.045 })
            .fromTo(extras, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 }, '-=0.6');
        }
        ScrollTrigger.create({
          trigger: el.closest('.lx-section'), start: el.dataset.start || 'top 55%', end: el.dataset.end || 'bottom 45%',
          onEnter: () => tl.play(), onEnterBack: () => tl.play(), onLeave: () => tl.reverse(), onLeaveBack: () => tl.reverse(),
        });
      });
    }, root);

    const onMove = (e: PointerEvent) => {
      story.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      story.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.classList.add('lx-html');

    return () => {
      window.removeEventListener('pointermove', onMove);
      ctx.revert();
      if (tickerFn) gsap.ticker.remove(tickerFn);
      lenis?.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove('lx-html');
      story.t = 0;
    };
  }, [reduced]);

  const finishBoot = React.useCallback(() => {
    setBooted(true);
    try { sessionStorage.setItem('f1p-booted', '1'); } catch {}
    lenisRef.current?.start();
    ScrollTrigger.refresh();
    // play the hero reveal immediately
    requestAnimationFrame(() => window.dispatchEvent(new Event('scroll')));
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.2 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  const nav = btn('ghost', 'sm', { fontSize: '14px' });

  return (
    <div ref={root} className={`lx ${booted ? 'is-booted' : ''} ${webgl ? '' : 'no-webgl'}`}>
      {/* 3D stage, fixed behind the story */}
      <div className="lx-stage" aria-hidden>
        {webgl && (
          <Suspense fallback={null}>
            <Scene onReady={() => setSceneReady(true)} />
          </Suspense>
        )}
        <div className="lx-vignette" />
        <div className="lx-cut" ref={cutRef} />
      </div>

      <AnimatePresence>{!booted && <Boot key="boot" ready={sceneReady} quick={quickBoot || reduced} onDone={finishBoot} />}</AnimatePresence>

      <header className="lx-nav">
        <a className="lx-logo" href="#" onClick={e => { e.preventDefault(); scrollTo('lx-hero'); }} aria-label="F1P home">
          F1<span>P</span>
        </a>
        <nav>
          <button className={btnClass('ghost', 'hide-on-mobile')} style={nav} onClick={() => scrollTo('lx-engineering')}>Simulation</button>
          <button className={btnClass('ghost', 'hide-on-mobile')} style={nav} onClick={onFIA}>FIA mode</button>
          <button className={btnClass('ghost')} style={{ ...nav, color: HUB.textPrimary }} onClick={onEnter}>Log in</button>
        </nav>
      </header>

      <main>
        {/* 1 · Hero */}
        <section id="lx-hero" className="lx-section" style={{ height: 'calc(220*var(--vh))' }}>
          <div className="lx-sticky lx-hero">
            <div className="lx-copy lx-reveal" data-start="top bottom" data-end="35% top">
              <p className="lx-kicker lx-fade">F1P · Team principal simulation</p>
              <h1 className="lx-h1"><Words text="Your team." /><br /><Words text="Your strategy." /><br /><Words text="Your legacy." /></h1>
              <p className="lx-sub lx-fade">Take control of every decision. Build your team, engineer your car and compete for motorsport supremacy.</p>
              <div className="lx-ctas lx-fade">
                <LiquidButton size="xl" className={CTA_PRIMARY} style={CTA_FONT} onClick={onEnter}>Enter the paddock</LiquidButton>
                <LiquidButton size="xl" className={CTA_SECONDARY} style={CTA_FONT} onClick={() => scrollTo('lx-engineering')}>Explore the simulation</LiquidButton>
              </div>
            </div>
            {!webgl && <StaticHero />}
            <div className="lx-scroll-cue lx-fade-in"><span>Scroll</span><ChevronDown size={16} strokeWidth={1.5} /></div>
          </div>
        </section>

        {/* 2 · Engineering */}
        <section id="lx-engineering" className="lx-section" style={{ height: 'calc(520*var(--vh))' }}>
          <div className="lx-sticky">
            <div className="lx-copy lx-copy-low lx-reveal" data-start="top 60%" data-end="bottom 40%">
              <p className="lx-kicker lx-fade">The engineering behind speed</p>
              <h2 className="lx-h2"><Words text="Every millimetre matters." /></h2>
              <p className="lx-sub lx-fade">Performance isn't found on the track alone. It is engineered long before the lights go out.</p>
            </div>
            <ol className="lx-parts lx-fade-in" aria-label="Car components">
              {['Front wing', 'Suspension', 'Tyres', 'Power unit', 'Rear wing and DRS', 'Airflow'].map((p, i) => <li key={p} data-part={i}>{p}</li>)}
            </ol>
          </div>
        </section>

        {/* 3 · Team */}
        <section id="lx-team" className="lx-section" style={{ height: 'calc(300*var(--vh))' }}>
          <div className="lx-sticky">
            <div className="lx-copy lx-copy-low lx-reveal" data-start="top 60%" data-end="bottom 40%">
              <p className="lx-kicker lx-fade">Build your championship team</p>
              <h2 className="lx-h2"><Words text="More than just a driver." /></h2>
              <p className="lx-sub lx-fade">Manage the people, resources and decisions that determine your team's future.</p>
              <ul className="lx-features lx-fade">
                {['Driver management', 'Staff recruitment', 'Financial management', 'Research and development', 'Team facilities', 'Sponsorships'].map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* 4 · Strategy */}
        <section id="lx-strategy" className="lx-section" style={{ height: 'calc(360*var(--vh))' }}>
          <div className="lx-sticky lx-strategy">
            <div className="lx-copy lx-reveal" data-start="top 50%" data-end="bottom 50%">
              <p className="lx-kicker lx-fade">Strategy is everything · Silverstone</p>
              <h2 className="lx-h2"><Words text="The race is won before the lights go out." /></h2>
              <p className="lx-sub lx-fade">Every pit stop, tyre decision and strategic gamble can change the championship.</p>
            </div>
            <div className="lx-reveal lx-hud-wrap" data-start="top 40%" data-end="bottom 50%">
              <div className="lx-fade"><StrategyHud /></div>
            </div>
            {!webgl && <div className="lx-static-visual"><PitWallPreview /></div>}
          </div>
        </section>

        {/* 5 · Race weekend */}
        <section id="lx-race" className="lx-section" style={{ height: 'calc(320*var(--vh))' }}>
          <div className="lx-sticky">
            <div className="lx-copy lx-copy-low lx-reveal" data-start="top 60%" data-end="70% 40%">
              <p className="lx-kicker lx-fade">Race weekend · Grid</p>
              <p className="lx-sub lx-fade">Five lights. Then everything you built is tested at once.</p>
            </div>
            <div className="lx-race-copy" ref={raceCopy}>
              <h2 className="lx-h2 lx-h2-xl">From the garage<br />to glory.</h2>
            </div>
          </div>
        </section>

        {/* 6 · Legacy */}
        <section id="lx-legacy" className="lx-section" style={{ height: 'calc(200*var(--vh))' }}>
          <div className="lx-sticky lx-legacy">
            <div className="lx-copy lx-copy-center lx-reveal" data-start="top 40%" data-end="bottom top">
              <p className="lx-kicker lx-fade">Your legacy begins</p>
              <h2 className="lx-h2 lx-h2-xl"><Words text="The grid is waiting." /></h2>
              <p className="lx-sub lx-fade">Your decisions. Your drivers. Your championship.</p>
              <div className="lx-ctas lx-fade">
                <LiquidButton size="xl" className={CTA_PRIMARY} style={CTA_FONT} onClick={onEnter}>Start your career</LiquidButton>
                <LiquidButton size="xl" className={CTA_SECONDARY} style={CTA_FONT} onClick={onFIA}><span className="inline-flex items-center gap-2"><Shield size={16} strokeWidth={1.5} /> Play as the FIA</span></LiquidButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lx-footer">
        <span>F1P · A motorsport team management game</span>
        <span>An independent fan-made game, not affiliated with any racing series or governing body</span>
      </footer>
    </div>
  );
}
