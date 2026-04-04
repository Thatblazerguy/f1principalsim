import { renderSetup } from "./setup.js";
import { renderDashboard } from "./dashboard.js";
import { signUpUser, loginUser, getCurrentUserSession, loadUserGameState } from "../lib/supabaseApi.js";
import { hydrateState, state } from "../state.js";

// Session check up front
export async function checkAuthAndRoute(root) {
  console.log("DEBUG: checkAuthAndRoute called.");
  try {
    const { session, error: sessionError } = await getCurrentUserSession();
    if (sessionError) {
      console.error("DEBUG: sessionError:", sessionError);
    }
    
    if (session) {
      console.log("DEBUG: Session found, loading game state...");
      const { data, error: loadError } = await loadUserGameState();
      if (loadError) {
        console.error("DEBUG: loadError:", loadError);
      }
      
      if (data && data.game_data) {
        console.log("DEBUG: Game data found, hydrating state...");
        hydrateState(data.game_data);
        // check if it successfully restored the team object natively
        if (state.team) {
          console.log("DEBUG: Team state restored, rendering dashboard.");
          renderDashboard(root);
        } else {
          console.log("DEBUG: Team state NOT restored, rendering setup.");
          renderSetup(root);
        }
        return;
      }
      console.log("DEBUG: No game data found, rendering setup.");
      renderSetup(root);
    } else {
      console.log("DEBUG: No session found, rendering auth.");
      renderAuth(root);
    }
  } catch (err) {
    console.error("DEBUG: Error in checkAuthAndRoute:", err);
    // Even on error, try to show the auth screen so the user isn't stuck
    renderAuth(root);
  }
}

export function renderAuth(root) {
  root.innerHTML = `
    <section class="setup-auth-shell animation-fade-in">
      <div class="setup-auth-panel">
        
        <div class="setup-form-side">
          <div class="setup-form-inner">
            <div class="setup-copy-block">
              <h1>Team Portal</h1>
              <p class="setup-subtitle">Authenticate to access constructor telemetry and team management systems.</p>
            </div>

            <div class="setup-auth-tabs" style="display: flex; gap: 10px; margin-bottom: 24px;">
              <button id="tabLogin" class="setup-pill" style="border-color: rgba(225,6,0,0.6); background: rgba(225,6,0,0.15); color: white;">Sign In</button>
              <button id="tabRegister" class="setup-pill" style="border-color: transparent;">Register</button>
            </div>

            <form id="authForm" class="setup-fields">
              <div id="usernameField" class="setup-glass-input" style="display: none; margin-bottom: 14px;">
                <input type="text" id="username" placeholder="Principal Name (e.g. Toto Wolff)" />
              </div>
              
              <div class="setup-glass-input" style="margin-bottom: 14px;">
                <input type="email" id="email" placeholder="Secure Email Address" required />
              </div>
              
              <div class="setup-glass-input" style="margin-bottom: 22px;">
                <input type="password" id="password" placeholder="Passcode" required />
              </div>

              <div id="authError" class="setup-error" style="margin-bottom: 14px;"></div>

              <div class="setup-actions">
                <button type="submit" id="submitAuth" class="setup-confirm-button">Access Link</button>
              </div>
            </form>
          </div>
        </div>

        <div class="setup-hero-side">
          <div class="setup-hero-image" style="background-image: url('https://images.unsplash.com/photo-1541344485523-289b4f62ca7a?auto=format&fit=crop&q=80&w=1200');"></div>
          <div class="setup-testimonials">
            <div class="setup-testimonial-card">
              <div class="setup-testimonial-meta">
                <strong>Data Encryption Active</strong>
                <span>F1 Constructor Node Connected</span>
                <p>Welcome to the 2026 Season Grid Strategy Node. Secure your session to begin structural upgrades.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  `;

  let mode = 'login'; // 'login' or 'register'
  
  const tabLogin = root.querySelector('#tabLogin');
  const tabRegister = root.querySelector('#tabRegister');
  const usernameField = root.querySelector('#usernameField');
  const submitAuth = root.querySelector('#submitAuth');
  const authError = root.querySelector('#authError');
  const authForm = root.querySelector('#authForm');

  function setMode(newMode) {
    mode = newMode;
    authError.textContent = '';
    if (mode === 'login') {
      tabLogin.style.borderColor = 'rgba(225,6,0,0.6)';
      tabLogin.style.background = 'rgba(225,6,0,0.15)';
      tabRegister.style.borderColor = 'transparent';
      tabRegister.style.background = 'rgba(255,255,255,0.06)';
      
      usernameField.style.display = 'none';
      submitAuth.textContent = 'Access Link';
    } else {
      tabRegister.style.borderColor = 'rgba(225,6,0,0.6)';
      tabRegister.style.background = 'rgba(225,6,0,0.15)';
      tabLogin.style.borderColor = 'transparent';
      tabLogin.style.background = 'rgba(255,255,255,0.06)';
      
      usernameField.style.display = 'flex';
      submitAuth.textContent = 'Register Credential';
    }
  }

  tabLogin.onclick = () => setMode('login');
  tabRegister.onclick = () => setMode('register');

  authForm.onsubmit = async (e) => {
    e.preventDefault();
    authError.textContent = '';
    submitAuth.disabled = true;
    submitAuth.textContent = 'Authenticating...';

    const email = root.querySelector('#email').value;
    const password = root.querySelector('#password').value;
    
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
        const username = root.querySelector('#username').value || 'Principal';
        const { error } = await signUpUser(email, password, username);
        if (error) throw error;
        renderSetup(root); // Advance to setup safely on fresh register
      }
    } catch(err) {
      authError.textContent = err.message || 'Authentication failed.';
      submitAuth.disabled = false;
      submitAuth.textContent = mode === 'login' ? 'Access Link' : 'Register Credential';
    }
  };
}
