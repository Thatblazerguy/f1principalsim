import React, { useState } from 'react';
import { renderSetup } from "./setup.tsx";
import { renderDashboard } from "./dashboard.tsx";
import { signUpUser, loginUser, getCurrentUserSession, loadUserGameState } from "../lib/supabaseApi.js";
import { hydrateState, state } from "../state.js";
import { loadGame } from "../utils/storage.js";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { HUB, glassCard, btn, btnClass, pageTitle, pageSubtitle } from "../components/HubLayout.tsx";

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
        setErrorMsg(err.message || 'Authentication failed');
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
      height: '40px',
      background: HUB.raised,
      border: `1px solid ${HUB.borderMid}`,
      padding: '0 12px',
      borderRadius: '8px',
      color: HUB.textPrimary,
      outline: 'none',
      marginBottom: '16px',
      fontFamily: HUB.fontRegular,
      fontSize: '14px',
      boxSizing: 'border-box' as const,
      transition: `border-color 150ms ${HUB.ease}`,
    };

    const fieldLabel = { fontSize: '12px', fontFamily: HUB.fontRegular, color: HUB.textMuted, display: 'block', marginBottom: '8px' };

    const segment = (active: boolean) => ({
      fontFamily: HUB.fontBold,
      fontSize: '13px',
      color: active ? HUB.textPrimary : HUB.textMuted,
      background: active ? HUB.raised : 'transparent',
      border: 'none',
      height: '32px',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: `background-color 150ms ${HUB.ease}, color 150ms ${HUB.ease}`
    });

    const statusDot = <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: HUB.textFaint, flexShrink: 0 }} />;

    return (
      <div style={{
        backgroundColor: HUB.bg,
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
        {/* Top Header */}
        <header style={{
          padding: '24px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${HUB.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontFamily: HUB.fontWide,
              fontSize: '20px',
              fontWeight: 400,
              color: HUB.textPrimary,
              fontStyle: 'italic'
            }}>F1<span style={{ color: HUB.accent }}>P</span></span>
            <div style={{ width: '1px', height: '16px', background: HUB.borderMid }} />
            <span style={{ fontFamily: HUB.fontRegular, fontSize: '13px', color: HUB.textMuted }}>Team principal simulation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusDot}
            <span style={{ fontSize: '12px', fontFamily: HUB.fontRegular, color: HUB.textFaint }}>Encrypted connection</span>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.8fr',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '0 40px',
          alignItems: 'center',
          gap: '64px'
        }}>
          {/* Left Column: Auth form */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 0' }}>
            <div style={{ marginBottom: '32px' }}>
              {pageTitle('Access the pit wall')}
              {pageSubtitle('Sign in to manage race strategy, drivers, car development and the championship.')}
            </div>

            {/* Toggle Modes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: HUB.surface,
              border: `1px solid ${HUB.border}`,
              padding: '4px',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => { setMode('login'); setErrorMsg(''); }}
                style={segment(mode === 'login')}
              >
                Sign in
              </button>
              <button
                onClick={() => { setMode('register'); setErrorMsg(''); }}
                style={segment(mode === 'register')}
              >
                Create account
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={glassCard()}>
              {mode === 'register' && (
                <div>
                  <label style={fieldLabel}>Principal name</label>
                  <input type="text" placeholder="e.g. Toto Wolff" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
                </div>
              )}

              <div>
                <label style={fieldLabel}>Email</label>
                <input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              </div>

              <div>
                <label style={fieldLabel}>Password</label>
                <input type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
              </div>

              {/* Extra options */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: HUB.textMuted, cursor: 'pointer' }}>
                  <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} style={{ accentColor: HUB.accent }} />
                  Remember me
                </label>
                <span style={{ color: HUB.textMuted, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setErrorMsg('Password reset is not available in this build')}>Reset password</span>
              </div>

              {errorMsg && (
                <div style={{
                  padding: '12px',
                  background: HUB.raised,
                  border: '1px solid rgba(229,72,77,0.4)',
                  borderRadius: '8px',
                  color: HUB.textPrimary,
                  fontSize: '13px',
                  marginBottom: '16px',
                  fontFamily: HUB.fontRegular
                }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={btnClass('primary')}
                style={btn('primary', 'lg', { width: '100%' })}
              >
                {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '12px' }}>
                <div style={{ flex: 1, height: '1px', background: HUB.border }} />
                <span style={{ fontSize: '12px', color: HUB.textFaint }}>or</span>
                <div style={{ flex: 1, height: '1px', background: HUB.border }} />
              </div>

              <button
                type="button"
                onClick={handlePlayOffline}
                className={btnClass('secondary')}
                style={btn('secondary', 'lg', { width: '100%' })}
              >
                Play offline (local save)
              </button>
            </form>
          </div>

          {/* Right Column: Operations preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '40px 0' }}>
            <div style={glassCard()}>
              <h3 style={{ fontFamily: HUB.fontBold, fontWeight: 400, fontSize: '16px', color: HUB.textPrimary, margin: '0 0 20px' }}>
                Team overview
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[
                  { label: "Constructor rank", value: "P4", sub: "Top four" },
                  { label: "Budget cap", value: "$97.2M", sub: "Remaining" },
                  { label: "Active projects", value: "6", sub: "R&D pipeline" },
                  { label: "Next round", value: "Monaco", sub: "Street circuit" },
                  { label: "Driver confidence", value: "92%", sub: "Grid maximum" },
                  { label: "Wind tunnel allocation", value: "74%", sub: "Of regulation limit" }
                ].map((item, idx) => (
                  <div key={idx} style={{ background: HUB.raised, padding: '16px', borderRadius: '8px', border: `1px solid ${HUB.border}` }}>
                    <span style={{ fontSize: '12px', color: HUB.textMuted, display: 'block', marginBottom: '8px' }}>{item.label}</span>
                    <span style={{
                      fontSize: '22px',
                      fontFamily: HUB.fontBold,
                      color: HUB.textPrimary,
                      display: 'block',
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: '4px'
                    }}>{item.value}</span>
                    <span style={{ fontSize: '12px', color: HUB.textFaint }}>{item.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={glassCard()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '13px', color: HUB.textPrimary }}>Data stream</span>
                  <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusDot}
                    Synced
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
                  {[10, 30, 20, 60, 40, 75, 30, 90, 45, 80, 25, 70].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(237,237,237,0.2)', borderRadius: '1px' }} />
                  ))}
                </div>
              </div>

              <div style={glassCard()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontFamily: HUB.fontBold, fontSize: '13px', color: HUB.textPrimary }}>R&D simulator</span>
                  <span style={{ fontSize: '12px', color: HUB.textFaint, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusDot}
                    Compiling
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '40px' }}>
                  {[90, 70, 50, 80, 30, 60, 75, 20, 85, 40, 60, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(237,237,237,0.2)', borderRadius: '1px' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Status Strip */}
        <footer style={{
          borderTop: `1px solid ${HUB.border}`,
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {["System online", "Data encrypted", "Team network connected", "Season database synced"].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: HUB.fontRegular, color: HUB.textFaint }}>
                {statusDot}
                {text}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '12px', color: HUB.textFaint }}>v4.0.2</span>
        </footer>
      </div>
    );
  };

  renderToAppRoot(root, <AuthPage />);
}
