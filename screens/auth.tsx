import React, { useState } from 'react';
import { renderSetup } from "./setup.tsx";
import { renderDashboard } from "./dashboard.tsx";
import { signUpUser, loginUser, getCurrentUserSession, loadUserGameState } from "../lib/supabaseApi.js";
import { hydrateState, state } from "../state.js";
import { loadGame } from "../utils/storage.js";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { HUB, glassCard, actionBtn } from "../components/HubLayout.tsx";
import { 
  Activity, 
  Lock, 
  Terminal, 
  ShieldCheck, 
  Database, 
  Cpu, 
  CheckCircle,
  Network
} from 'lucide-react';

export async function checkAuthAndRoute(root: HTMLElement) {
  try {
    const { session } = await getCurrentUserSession();
    if (session) {
      const { data } = await loadUserGameState();
      if (data && data.game_data) {
        hydrateState(data.game_data);
        if (state.team) {
          renderDashboard(root);
          return;
        }
      }
      renderSetup(root);
    } else {
      renderAuth(root);
    }
  } catch (err) {
    renderAuth(root);
  }
}

export function renderAuth(root: HTMLElement) {
  const AuthPage = () => {
    const [mode, setMode] = useState<'login'|'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);

      try {
        if (mode === 'login') {
          const { error } = await loginUser(email, password);
          if (error) throw error;
          
          const { data } = await loadUserGameState();
          if (data && data.game_data) {
            hydrateState(data.game_data);
            if (state.team) {
              renderDashboard(root);
            } else {
              renderSetup(root);
            }
          } else {
            renderSetup(root);
          }
        } else {
          const { error } = await signUpUser(email, password, username || 'Principal');
          if (error) throw error;
          renderSetup(root);
        }
      } catch(err: any) {
        setErrorMsg(err.message || 'Authentication failed.');
        setLoading(false);
      }
    };

    const handlePlayOffline = () => {
      localStorage.setItem("f1-play-offline", "true");
      const localData = loadGame();
      if (localData) {
        hydrateState(localData);
        if (state.team) {
          renderDashboard(root);
          return;
        }
      }
      renderSetup(root);
    };

    const inputStyle = {
      width: '100%',
      background: 'rgba(0, 0, 0, 0.3)',
      border: `1px solid rgba(255, 255, 255, 0.1)`,
      padding: '14px 18px',
      borderRadius: '4px',
      color: '#fff',
      outline: 'none',
      marginBottom: '16px',
      fontFamily: HUB.fontRegular,
      fontSize: '13px',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.2s, box-shadow 0.2s',
    };

    return (
      <div style={{ 
        backgroundColor: '#070A13', 
        color: HUB.textPrimary, 
        minHeight: '100vh', 
        fontFamily: HUB.fontRegular, 
        position: 'relative', 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* Background grids & glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', 
            backgroundSize: '30px 30px',
            opacity: 0.7
          }} />
          <div style={{ position: 'absolute', top: '20%', left: '-10%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(225,6,0,0.1) 0%, transparent 70%)', filter: 'blur(90px)' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 80%)', filter: 'blur(90px)' }} />
        </div>

        {/* Top Header */}
        <header style={{ 
          position: 'relative',
          zIndex: 10,
          padding: '24px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              fontFamily: HUB.fontWide, 
              fontSize: '20px', 
              fontWeight: 900, 
              color: '#fff', 
              letterSpacing: '-0.02em',
              fontStyle: 'italic'
            }}>F1<span style={{ color: HUB.accent }}>P</span></span>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontFamily: HUB.fontBold, fontSize: '10px', color: HUB.textMuted, letterSpacing: '0.15em' }}>- Principal Simulator</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: '9px', fontFamily: HUB.fontBold, color: HUB.textMuted, letterSpacing: '0.1em' }}>ENCRYPTED SHIELD ACTIVE</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ 
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.8fr',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '0 40px',
          alignItems: 'center',
          gap: '60px'
        }}>
          {/* Left Column: Auth form */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 0' }}>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ 
                fontFamily: HUB.fontBold, 
                fontSize: '10px', 
                color: HUB.accent, 
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '8px'
              }}>TEAM OPERATIONS</span>
              
              <h2 style={{ 
                fontFamily: HUB.fontWide, 
                fontSize: '28px', 
                fontWeight: 900, 
                color: '#fff', 
                margin: '0 0 12px',
                textTransform: 'uppercase'
              }}>
                ACCESS THE PIT WALL.
              </h2>
              
              <p style={{ 
                fontFamily: HUB.fontRegular, 
                fontSize: '13px', 
                color: HUB.textMuted, 
                lineHeight: '1.6',
                margin: 0
              }}>
                Authenticate to access race strategy, driver management, car development and championship operations.
              </p>
            </div>

            {/* Toggle Modes */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '4px',
              borderRadius: '4px',
              marginBottom: '24px'
            }}>
              <button 
                onClick={() => { setMode('login'); setErrorMsg(''); }}
                style={{
                  fontFamily: HUB.fontBold,
                  fontSize: '11px',
                  color: mode === 'login' ? '#fff' : HUB.textMuted,
                  background: mode === 'login' ? HUB.accent : 'transparent',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  transition: 'all 0.15s'
                }}
              >
                SIGN IN
              </button>
              <button 
                onClick={() => { setMode('register'); setErrorMsg(''); }}
                style={{
                  fontFamily: HUB.fontBold,
                  fontSize: '11px',
                  color: mode === 'register' ? '#fff' : HUB.textMuted,
                  background: mode === 'register' ? HUB.accent : 'transparent',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  transition: 'all 0.15s'
                }}
              >
                CREATE SYSTEM ACCOUNT
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{
              ...glassCard({ padding: '32px' }),
              borderLeft: `2px solid ${HUB.accent}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}>
              {mode === 'register' && (
                <div>
                  <label style={{ fontSize: '10px', fontFamily: HUB.fontBold, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>PRINCIPAL CALLSIGN</label>
                  <input type="text" placeholder="e.g. Toto Wolff" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
                </div>
              )}

              <div>
                <label style={{ fontSize: '10px', fontFamily: HUB.fontBold, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>SECURE EMAIL ADDRESS</label>
                <input type="email" placeholder="name@team-operations.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '10px', fontFamily: HUB.fontBold, color: HUB.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>SYSTEM PASSCODE</label>
                <input type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
              </div>

              {/* Extra options */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', fontSize: '11px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: HUB.textMuted, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} style={{ accentColor: HUB.accent }} />
                  Remember console node
                </label>
                <span style={{ color: HUB.textMuted, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setErrorMsg('Reset functionality requires network administrator.')}>Reset Passcode</span>
              </div>

              {errorMsg && (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(225,6,0,0.1)', 
                  border: `1px solid ${HUB.accent}`, 
                  borderRadius: '4px', 
                  color: '#fff', 
                  fontSize: '12px', 
                  marginBottom: '16px',
                  fontFamily: HUB.fontRegular
                }}>
                  {errorMsg}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  ...actionBtn({ width: '100%', padding: '14px 24px', opacity: loading ? 0.7 : 1 }),
                  fontFamily: HUB.fontBold,
                  letterSpacing: '0.15em',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'INITIATING LINK...' : mode === 'login' ? 'ESTABLISH LINK' : 'REGISTER CREATIVE ID'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: '10px', color: HUB.textMuted, fontFamily: HUB.fontBold }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              </div>

              <button 
                type="button" 
                onClick={handlePlayOffline}
                style={{ 
                  ...actionBtn({ width: '100%', padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)' }),
                  fontFamily: HUB.fontBold,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  color: '#3b82f6',
                  boxShadow: 'none',
                  textShadow: 'none'
                }}
              >
                PLAY OFFLINE (LOCAL SAVE)
              </button>
            </form>
          </div>

          {/* Right Column: Live Operations Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '40px 0' }}>
            <div style={{
              ...glassCard({ padding: '32px' }),
              borderLeft: '2px solid #3b82f6',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              position: 'relative'
            }}>
              {/* Telemetry border/corner design */}
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
                <div style={{ width: '4px', height: '4px', background: '#3b82f6', borderRadius: '50%' }} />
                <div style={{ width: '4px', height: '4px', background: '#3b82f6', borderRadius: '50%' }} />
              </div>

              <h3 style={{ fontFamily: HUB.fontBold, fontSize: '12px', color: '#3b82f6', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 24px' }}>
                GRID TELEMETRY OVERVIEW
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {[
                  { label: "CONSTRUCTOR RANK", value: "P4", sub: "TOP 4 FIELD" },
                  { label: "BUDGET CAP STATUS", value: "$97.2M", sub: "REMAINING CAP" },
                  { label: "ACTIVE PROJECTS", value: "6 ACTIVE", sub: "R&D PIPELINE" },
                  { label: "NEXT EVENT ROUND", value: "MONACO", sub: "STREET CIRCUIT" },
                  { label: "DRIVER CONFIDENCE", value: "92%", sub: "GRID MAXIMUM" },
                  { label: "WIND TUNNEL ALLOC.", value: "74%", sub: "COMPLIANCE LEVEL" }
                ].map((item, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '9px', color: HUB.textMuted, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>{item.label}</span>
                    <span style={{ 
                      fontSize: '18px', 
                      fontFamily: HUB.fontBold, 
                      color: '#fff', 
                      display: 'block',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.03em',
                      marginBottom: '4px'
                    }}>{item.value}</span>
                    <span style={{ fontSize: '8px', color: HUB.accent, fontFamily: HUB.fontBold, letterSpacing: '0.05em' }}>{item.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Live Status Graphs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={glassCard({ padding: '20px' })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '9px', color: HUB.textMuted, letterSpacing: '0.05em' }}>DATA STREAM</span>
                  <span style={{ fontSize: '9px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '4px', height: '4px', background: '#10b981', borderRadius: '50%' }} />
                    SYNCED
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
                  {[10, 30, 20, 60, 40, 75, 30, 90, 45, 80, 25, 70].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(37,99,235,0.3)', borderRadius: '1px' }} />
                  ))}
                </div>
              </div>

              <div style={glassCard({ padding: '20px' })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '9px', color: HUB.textMuted, letterSpacing: '0.05em' }}>R&D SIMULATOR</span>
                  <span style={{ fontSize: '9px', color: HUB.accent, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '4px', height: '4px', background: HUB.accent, borderRadius: '50%' }} />
                    COMPILING
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
                  {[90, 70, 50, 80, 30, 60, 75, 20, 85, 40, 60, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(225,6,0,0.3)', borderRadius: '1px' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Status Strip */}
        <footer style={{ 
          position: 'relative',
          zIndex: 10,
          borderTop: '1px solid rgba(255,255,255,0.03)',
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { icon: <CheckCircle size={10} color="#10b981" />, text: "SYSTEM STATUS: ONLINE" },
              { icon: <Lock size={10} color="#10b981" />, text: "DATA ENCRYPTION: ACTIVE" },
              { icon: <Network size={10} color="#10b981" />, text: "TEAM NETWORK: CONNECTED" },
              { icon: <Database size={10} color="#10b981" />, text: "SEASON DATABASE: SYNCHRONIZED" }
            ].map((status, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontFamily: HUB.fontBold, color: HUB.textMuted, letterSpacing: '0.05em' }}>
                {status.icon}
                {status.text}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>CONSOLE v4.0.2</span>
        </footer>
      </div>
    );
  };

  renderToAppRoot(root, <AuthPage />);
}
