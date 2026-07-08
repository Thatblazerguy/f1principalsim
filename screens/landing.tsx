import React from 'react';
import { checkAuthAndRoute } from "./auth.tsx";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { HUB, glassCard, actionBtn } from "../components/HubLayout.tsx";
import { 
  Trophy, 
  Wrench, 
  TrendingUp, 
  Users, 
  Activity,
  Cpu,
  Shield,
  Gauge
} from 'lucide-react';

export function renderLanding(root: HTMLElement) {
  const LandingPage = () => {
    // Scroll handler to scroll to features
    const scrollToFeatures = () => {
      document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
      <div style={{ 
        backgroundColor: '#070A13', 
        color: HUB.textPrimary, 
        minHeight: '100vh', 
        fontFamily: HUB.fontRegular, 
        position: 'relative', 
        overflowX: 'hidden' 
      }}>
        {/* Subtle grid and glowing background overlays */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          {/* Telemetry Grid Pattern */}
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', 
            backgroundSize: '40px 40px',
            opacity: 0.8
          }} />
          
          {/* Faint Circuit Line Graphic Overlay */}
          <svg style={{ position: 'absolute', top: '10%', right: '-10%', width: '80%', height: '80%', opacity: 0.05, transform: 'rotate(-15deg)' }} viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="0.5">
            <path d="M10,50 Q20,30 40,30 T80,50 T40,70 Z" />
            <path d="M15,50 Q25,35 40,35 T75,50 T40,65 Z" strokeDasharray="2 2" />
          </svg>

          {/* Premium Glowing Accents */}
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(225,6,0,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '800px', height: '800px', background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        </div>

        {/* Outer container */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: '0 40px' }}>
          
          {/* Top Bar Header */}
          <header style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            height: '90px', 
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                fontFamily: HUB.fontWide, 
                fontSize: '24px', 
                fontWeight: 900, 
                color: '#fff', 
                letterSpacing: '-0.02em',
                fontStyle: 'italic'
              }}>
                F1<span style={{ color: HUB.accent }}>P</span>
              </span>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ 
                fontFamily: HUB.fontBold, 
                fontSize: '11px', 
                color: HUB.textMuted, 
                letterSpacing: '0.2em' 
              }}>- Principal Simulator</span>
            </div>
            
            <button 
              onClick={() => checkAuthAndRoute(root)}
              style={{
                fontFamily: HUB.fontBold,
                fontSize: '11px',
                color: '#fff',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '10px 24px',
                borderRadius: '6px',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = HUB.accent; e.currentTarget.style.background = 'rgba(225,6,0,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              TELEMETRY PORTAL
            </button>
          </header>

          {/* Hero Section */}
          <section style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '60px', 
            alignItems: 'center', 
            minHeight: 'calc(80vh - 90px)',
            padding: '60px 0'
          }}>
            {/* Left Column - Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '6px 14px', 
                background: 'rgba(225,6,0,0.08)', 
                border: `1px solid rgba(225,6,0,0.25)`, 
                borderRadius: '4px', 
                marginBottom: '24px' 
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: HUB.accent, animation: 'pulse 2s infinite' }} />
                <span style={{ 
                  fontFamily: HUB.fontBold, 
                  fontSize: '10px', 
                  fontWeight: 700, 
                  color: HUB.accent, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.2em' 
                }}>TEAM PRINCIPAL SIMULATOR</span>
              </div>

              <h1 style={{ 
                fontFamily: HUB.fontWide, 
                fontSize: '44px', 
                fontWeight: 900, 
                lineHeight: '1.15', 
                letterSpacing: '-0.02em', 
                margin: '0 0 24px', 
                textTransform: 'uppercase',
                color: '#fff',
                maxWidth: '600px'
              }}>
                RUN THE TEAM.<br />
                BUILD THE CAR.<br />
                WIN THE CHAMPIONSHIP.
              </h1>

              <p style={{ 
                fontFamily: HUB.fontRegular, 
                fontSize: '15px', 
                color: HUB.textMuted, 
                lineHeight: '1.6', 
                maxWidth: '520px', 
                margin: '0 0 40px' 
              }}>
                Manage drivers, engineers, finances, car development and race strategy across an entire Formula 1 season.
              </p>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => checkAuthAndRoute(root)} 
                  style={{ ...actionBtn({ padding: '16px 36px', fontSize: '12px' }) }}
                >
                  START YOUR CAREER <span style={{ marginLeft: '8px' }}>→</span>
                </button>
                <button 
                  onClick={scrollToFeatures}
                  style={{
                    fontFamily: HUB.fontBold,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#fff',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '16px 32px',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                >
                  EXPLORE FEATURES
                </button>
              </div>

            </div>

            {/* Right Column - Premium Visual Showcase */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '480px' }}>
              
              {/* Radial background red glow beneath the graphics */}
              <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(225,6,0,0.18) 0%, transparent 70%)', filter: 'blur(50px)', zIndex: 0 }} />

              {/* Decorative Tech Grid Lines & Circuit Ring */}
              <div style={{
                position: 'absolute',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                border: '1px dashed rgba(255,255,255,0.04)',
                animation: 'spin 120s linear infinite',
                zIndex: 0
              }} />

              {/* Main Visual Panel - Glass Strategy Dashboard Layer */}
              <div style={{
                ...glassCard({ padding: '24px', width: '380px', height: '240px', position: 'relative', zIndex: 2 }),
                borderLeft: `3px solid ${HUB.accent}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontFamily: HUB.fontBold, fontSize: '10px', color: HUB.accent, letterSpacing: '0.15em' }}>LIVE TELEMETRY</span>
                    <span style={{ fontSize: '9px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px', fontFamily: HUB.fontMono }}>ROUND 18: SPINNING</span>
                  </div>
                  <h4 style={{ fontFamily: HUB.fontBold, fontSize: '15px', color: '#fff', margin: '0 0 4px' }}>MONACO GP — PIT STRATEGY</h4>
                  <p style={{ fontSize: '11px', color: HUB.textMuted, margin: 0 }}>Driver A: SOFT | Lap 24/78</p>
                </div>
                
                {/* Visual Telemetry Chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px', margin: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  {[45, 60, 30, 80, 50, 75, 40, 95, 60, 85, 35, 70, 55, 90, 65].map((h, i) => (
                    <div key={i} style={{ 
                      flex: 1, 
                      height: `${h}%`, 
                      background: i % 3 === 0 ? HUB.accent : 'rgba(255,255,255,0.15)', 
                      borderRadius: '1px' 
                    }} />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: HUB.textMuted }}>ESTIMATED GAP</span>
                  <span style={{ fontSize: '13px', fontFamily: HUB.fontBold, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em' }}>+1.854s (P1)</span>
                </div>
              </div>

              {/* Overlapping Secondary Glass Card - Car Development Panel */}
              <div style={{
                ...glassCard({ padding: '16px', width: '220px', position: 'absolute', top: '20px', left: '-20px', zIndex: 3 }),
                boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                transform: 'rotate(-4deg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Wrench size={14} color={HUB.accent} />
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '10px', color: '#fff', letterSpacing: '0.1em' }}>AERO PERFORMANCE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '20px', fontFamily: HUB.fontBold, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', color: '#fff' }}>94.2</span>
                  <span style={{ fontSize: '10px', color: '#10b981' }}>+2.4 LEVEL</span>
                </div>
              </div>

              {/* Overlapping Third Glass Card - Driver Status */}
              <div style={{
                ...glassCard({ padding: '16px', width: '220px', position: 'absolute', bottom: '20px', right: '-20px', zIndex: 3 }),
                boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                transform: 'rotate(3deg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={14} color="#3b82f6" />
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '10px', color: '#fff', letterSpacing: '0.1em' }}>TYRE DEGRADATION</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '42%', background: '#ef4444' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '9px', color: HUB.textMuted }}>
                  <span>42% LEFT</span>
                  <span>MED</span>
                </div>
              </div>

            </div>
          </section>

          {/* Statistics Bar Section */}
          <section style={{ 
            padding: '40px 0', 
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '80px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              {[
                { count: "10", label: "TEAMS", kicker: "GRID CONSTRUCTORS" },
                { count: "20", label: "DRIVERS", kicker: "ACTIVE SEATS" },
                { count: "24", label: "RACES", kicker: "SEASON CHAMPIONSHIP" },
                { count: "$145M", label: "COST CAP", kicker: "FINANCIAL SYSTEM" }
              ].map((stat, i) => (
                <div key={i} style={{
                  ...glassCard({ padding: '24px 32px' }),
                  borderBottom: `2px solid ${i === 3 ? HUB.accent : 'rgba(255,255,255,0.05)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontFamily: HUB.fontRegular, fontSize: '9px', color: HUB.textMuted, letterSpacing: '0.15em' }}>{stat.kicker}</span>
                  <span style={{ 
                    fontFamily: HUB.fontBold, 
                    fontSize: '28px', 
                    color: '#fff', 
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.03em',
                    lineHeight: 1.2
                  }}>{stat.count}</span>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '11px', color: HUB.accent, letterSpacing: '0.1em' }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Feature Showcase Section */}
          <section id="features-section" style={{ paddingBottom: '120px' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
              <span style={{ fontFamily: HUB.fontBold, fontSize: '11px', color: HUB.accent, letterSpacing: '0.2em' }}>COMMAND CENTER</span>
              <h2 style={{ 
                fontFamily: HUB.fontWide, 
                fontSize: '28px', 
                color: '#fff', 
                marginTop: '8px', 
                marginBottom: '16px',
                textTransform: 'uppercase'
              }}>
                GAMEPLAY HIGHLIGHTS
              </h2>
              <p style={{ fontFamily: HUB.fontRegular, fontSize: '14px', color: HUB.textMuted, maxWidth: '600px', margin: '0 auto' }}>
                Every department requires your guidance. Master each vertical to build a dominant motorsport dynasty.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
              {[
                {
                  icon: <Users size={22} color={HUB.accent} />,
                  title: "Driver Market",
                  desc: "Recruit future champions. Monitor the grid rosters, negotiate salaries, poach drivers from AI teams, or keep a promising junior in your reserve seat."
                },
                {
                  icon: <Wrench size={22} color={HUB.accent} />,
                  title: "Car Development",
                  desc: "Design upgrades and improve performance. Direct your engineering budget into upgrades for aero, chassis, engine reliability, and overall vehicle pace."
                },
                {
                  icon: <Activity size={22} color={HUB.accent} />,
                  title: "Race Strategy",
                  desc: "Make critical decisions during race weekends. Direct pit stop timings, manage tire wear modifiers, and mitigate mechanical risk on the fly."
                },
                {
                  icon: <TrendingUp size={22} color={HUB.accent} />,
                  title: "Team Operations",
                  desc: "Manage staff, facilities and finances. Sign sponsorships deals, increase team prestige level, and balance budget limits under the strict cost cap regulations."
                }
              ].map((feat, i) => (
                <div key={i} style={{
                  ...glassCard({ padding: '32px' }),
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'flex-start',
                  transition: 'transform 0.2s, border-color 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(225,6,0,0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                >
                  <div style={{
                    background: 'rgba(225,6,0,0.1)',
                    border: '1px solid rgba(225,6,0,0.2)',
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {feat.icon}
                  </div>
                  <div>
                    <h4 style={{ fontFamily: HUB.fontBold, fontSize: '16px', color: '#fff', margin: '0 0 8px' }}>{feat.title}</h4>
                    <p style={{ fontFamily: HUB.fontRegular, fontSize: '13px', color: HUB.textMuted, lineHeight: '1.6', margin: 0 }}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Global Keyframes CSS Style */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}} />
      </div>
    );
  };

  renderToAppRoot(root, <LandingPage />);
}
