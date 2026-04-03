import { renderSetup } from "./setup.js";

export function renderLanding(root) {
  root.innerHTML = `
    <section class="landing-shell">
      <div class="landing-backdrop" aria-hidden="true">
        <div class="landing-noise"></div>
        <div class="landing-orb landing-orb-left"></div>
        <div class="landing-orb landing-orb-right"></div>
        <div class="landing-grid"></div>
      </div>

      <div class="landing-panel glass">
        <div class="landing-pill">
          <span class="landing-pill-dot"></span>
          Team Principal Simulator
        </div>

        <div class="landing-copy">
          <p class="landing-kicker">Build the next Formula 1 powerhouse</p>
          <h1>Run your team, shape the car, chase the championship.</h1>
          <p class="landing-description">
            Start from the garage floor and make every call count. Choose your
            drivers, manage your budget, and guide a brand-new constructor from
            launch day to title contention.
          </p>
        </div>

        <div class="landing-actions">
          <button id="start" class="landing-primary">
            <span>Start Your Team</span>
            <span class="landing-arrow" aria-hidden="true">→</span>
          </button>
          <div class="landing-note">No tutorial wall. You go straight into team setup.</div>
        </div>

        <div class="landing-stats" aria-label="game highlights">
          <div class="landing-stat-card">
            <span class="landing-stat-value">10</span>
            <span class="landing-stat-label">Rival teams to beat</span>
          </div>
          <div class="landing-stat-card">
            <span class="landing-stat-value">2</span>
            <span class="landing-stat-label">Drivers to sign</span>
          </div>
          <div class="landing-stat-card">
            <span class="landing-stat-value">1</span>
            <span class="landing-stat-label">Championship goal</span>
          </div>
        </div>
      </div>
    </section>
  `;
  document.getElementById("start").onclick = () => renderSetup(root);
}
