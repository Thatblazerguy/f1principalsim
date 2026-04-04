import { Team } from "../game/team.js";
import { drivers } from "../data/drivers.js";
import { assignReplacementReserve } from "../data/teams.js";
import { state, resetAiTeams } from "../state.js";
import { renderDashboard } from "./dashboard.js";
import { syncGame } from "../lib/supabaseApi.js";

const teamTiers = [
  {
    id: "tier1",
    name: "Tier 1",
    tagline: "The Frontrunners",
    why: "Championship contenders from day one. Fast everywhere, stable under pressure, and built to fight for wins immediately.",
    ovr: 94,
    specs: { aero: 95, chassis: 94, reliability: 93, ovr: 94 },
  },
  {
    id: "tier2",
    name: "Tier 2",
    tagline: "The Podium Hunters",
    why: "Strong enough to steal wins if the leaders wobble. Reliable, balanced, and always in the top-five conversation.",
    ovr: 90,
    specs: { aero: 90, chassis: 89, reliability: 90, ovr: 90 },
  },
  {
    id: "tier3",
    name: "Tier 3",
    tagline: "The Midfield Scrappers",
    why: "A proper points-fighting package. Driver quality and smart upgrades will decide whether you break into the upper midfield.",
    ovr: 86,
    specs: { aero: 84, chassis: 86, reliability: 87, ovr: 86 },
  },
  {
    id: "tier4",
    name: "Tier 4",
    tagline: "The Backmarkers & Project Teams",
    why: "A long-build project. You start with clear weaknesses and have to develop your way into the fight.",
    ovr: 80,
    specs: { aero: 78, chassis: 79, reliability: 82, ovr: 80 },
  },
];

const engineProviders = [
  {
    id: "mercedes",
    name: "Mercedes",
    perk: "+5% Reliability",
    price: 25,
    tradeoff: 'The "Safe" bet; fewer mechanical DNFs.',
    effects: { reliability: 5, performance: 1.2, retirementModifier: -0.003 },
  },
  {
    id: "ferrari",
    name: "Ferrari",
    perk: "+5% Aero/Drag",
    price: 28,
    tradeoff: 'The "Speed" bet; tighter car packaging.',
    effects: { aero: 5, performance: 1.5, qualifyingBoost: 0.5 },
  },
  {
    id: "rbpt",
    name: "RBPT-Ford",
    perk: "+3% Chassis Grip",
    price: 22,
    tradeoff: 'The "Agility" bet; better in low-speed corners.',
    effects: { chassis: 3, performance: 1.0, raceBoost: 0.35 },
  },
  {
    id: "audi",
    name: "Audi",
    perk: "+10% Energy Recovery",
    price: 20,
    tradeoff: 'The "Tech" bet; more battery power per lap.',
    effects: { performance: 0.9, qualifyingBoost: 0.25, raceBoost: 0.6 },
  },
  {
    id: "honda",
    name: "Honda",
    perk: "+5% Top Speed",
    price: 24,
    tradeoff: 'The "Power" bet; dominant on straights.',
    effects: { performance: 1.3, paceBoost: 0.45 },
  },
  {
    id: "custom",
    name: "Custom",
    perk: "-5% Reliability",
    price: 0,
    tradeoff: "High Risk: Zero cost, but high DNF chance.",
    effects: { reliability: -5, performance: -0.6, retirementModifier: 0.004 },
  },
];

export function renderSetup(root) {
  const availableDrivers = drivers
    .filter(driver => driver.startupEligible)
    .sort((a, b) => b.market - a.market || a.signingFee - b.signingFee);

  const defaultTier = teamTiers[2];
  const defaultEngine = engineProviders[5];

  root.innerHTML = `
    <section class="setup-auth-shell">
      <div class="setup-auth-panel">
        <section class="setup-form-side">
          <div class="setup-form-inner">
            <div class="setup-copy-block">
              <p class="setup-eyebrow">Team Registration</p>
              <h1>Create Your Team</h1>
              <p class="setup-subtitle">Choose your identity, team tier, power unit strategy, and two launch drivers.</p>
            </div>

            <div class="setup-fields">
              <label for="teamName">Team Name</label>
              <div class="setup-glass-input">
                <input id="teamName" placeholder="Enter your team name" />
              </div>

              <label for="budget">Starting Budget</label>
              <div class="setup-glass-input">
                <select id="budget">
                  <option value="150">Low ($150M)</option>
                  <option value="300">Medium ($300M)</option>
                  <option value="500">High ($500M)</option>
                  <option value="800">Billionaire ($800M)</option>
                </select>
              </div>

              <label for="seasonLength">Races Per Season</label>
              <div class="setup-glass-input">
                <select id="seasonLength">
                  <option value="6">Short Season (6 races)</option>
                  <option value="16">Standard Season (16 races)</option>
                  <option value="24" selected>Full Season (24 races)</option>
                </select>
              </div>
            </div>

            <div class="setup-driver-head setup-origin-head">
              <h3>Choose Team Tier</h3>
              <span id="originTier" class="setup-pill">${defaultTier.name} • OVR ${defaultTier.ovr}</span>
            </div>

            <div id="teamOrigins" class="setup-origin-grid">
              ${teamTiers
                .map(tier => `
                  <button
                    type="button"
                    class="setup-origin-card ${tier.id === defaultTier.id ? "setup-origin-card-active" : ""}"
                    data-origin="${tier.id}"
                  >
                    <span class="setup-origin-tier">2026 Baseline</span>
                    <strong>${tier.name}</strong>
                    <span class="setup-origin-tagline">${tier.tagline}</span>
                    <span class="setup-origin-ovr">OVR ${tier.ovr}</span>
                  </button>
                `)
                .join("")}
            </div>

            <div id="originPreview" class="setup-origin-preview glass"></div>

            <div class="setup-driver-head setup-origin-head">
              <h3>Choose Engine Manufacturer</h3>
              <span id="enginePrice" class="setup-pill">${defaultEngine.name} • FREE</span>
            </div>

            <div id="engineProviders" class="setup-origin-grid setup-engine-grid">
              ${engineProviders
                .map(engine => `
                  <button
                    type="button"
                    class="setup-origin-card ${engine.id === defaultEngine.id ? "setup-origin-card-active" : ""}"
                    data-engine="${engine.id}"
                  >
                    <span class="setup-origin-tier">Provider</span>
                    <strong>${engine.name}</strong>
                    <span class="setup-origin-tagline">${engine.perk}</span>
                    <span class="setup-origin-ovr">${engine.price === 0 ? "FREE" : `$${engine.price}M`}</span>
                  </button>
                `)
                .join("")}
            </div>

            <div id="enginePreview" class="setup-origin-preview glass"></div>

            <div class="setup-driver-head">
              <h3>Select Drivers</h3>
              <span id="driverCount" class="setup-pill">0 / 2 selected</span>
            </div>

            <div id="drivers" class="driver-list setup-driver-list"></div>

            <div class="setup-budget-row">
              <p id="budgetRemaining" class="setup-pill setup-budget-pill">Remaining budget: --</p>
              <p class="setup-helper-copy">Driver signing fees and engine supplier costs are deducted before the season starts.</p>
            </div>

            <p id="setupError" class="setup-error"></p>

            <div class="setup-actions">
              <button id="confirm" class="setup-confirm-button" disabled>Create Team</button>
            </div>
          </div>
        </section>

        <section class="setup-hero-side">
          <div
            class="setup-hero-image"
            style="background-image: url('https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=1600&q=80');"
          ></div>

          <div class="setup-testimonials">
            <article class="setup-testimonial-card">
              <img src="https://randomuser.me/api/portraits/women/57.jpg" alt="Sarah Chen" />
              <div>
                <strong>Sarah Chen</strong>
                <span>@sarahdigital</span>
                <p>Starting with the right tier and power unit makes the first season feel like an actual long-term strategy call.</p>
              </div>
            </article>
            <article class="setup-testimonial-card setup-testimonial-card-secondary">
              <img src="https://randomuser.me/api/portraits/men/64.jpg" alt="Marcus Johnson" />
              <div>
                <strong>Marcus Johnson</strong>
                <span>@marcustech</span>
                <p>The engine choice adds real personality. Cheap and risky, or expensive and stable, the trade-off is visible immediately.</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  `;

  const list = document.getElementById("drivers");
  const teamNameInput = document.getElementById("teamName");
  const budgetSelect = document.getElementById("budget");
  const seasonLengthSelect = document.getElementById("seasonLength");
  const confirmBtn = document.getElementById("confirm");
  const driverCount = document.getElementById("driverCount");
  const budgetRemaining = document.getElementById("budgetRemaining");
  const setupError = document.getElementById("setupError");
  const originTier = document.getElementById("originTier");
  const originPreview = document.getElementById("originPreview");
  const teamOriginsGrid = document.getElementById("teamOrigins");
  const enginePrice = document.getElementById("enginePrice");
  const enginePreview = document.getElementById("enginePreview");
  const engineProvidersGrid = document.getElementById("engineProviders");

  let selectedTier = defaultTier;
  let selectedEngine = defaultEngine;

  availableDrivers.forEach(driver => {
    list.innerHTML += `
      <label class="driver-item setup-driver-item">
        <input type="checkbox" value="${driver.name}" />
        <span class="setup-driver-meta">
          <strong>${driver.name}</strong>
          <span>${driver.roleLabel} · Fee $${driver.signingFee}M · Salary $${driver.salary}M</span>
        </span>
      </label>
    `;
  });

  const renderTierPreview = () => {
    originTier.textContent = `${selectedTier.name} • OVR ${selectedTier.ovr}`;
    originPreview.innerHTML = `
      <div>
        <p class="setup-eyebrow">2026 Tier Baseline</p>
        <h3>${selectedTier.name}</h3>
        <p class="setup-subtitle">${selectedTier.why}</p>
      </div>
      <div class="setup-origin-stats">
        <div class="setup-origin-stat"><span>OVR</span><strong>${selectedTier.ovr}</strong></div>
        <div class="setup-origin-stat"><span>Aero / Drag</span><strong>${selectedTier.specs.aero}</strong></div>
        <div class="setup-origin-stat"><span>Chassis / Grip</span><strong>${selectedTier.specs.chassis}</strong></div>
        <div class="setup-origin-stat"><span>Reliability</span><strong>${selectedTier.specs.reliability}</strong></div>
      </div>
    `;
  };

  const renderEnginePreview = () => {
    enginePrice.textContent = `${selectedEngine.name} • ${selectedEngine.price === 0 ? "FREE" : `$${selectedEngine.price}M`}`;
    enginePreview.innerHTML = `
      <div>
        <p class="setup-eyebrow">Power Unit Choice</p>
        <h3>${selectedEngine.name}</h3>
        <p class="setup-subtitle">${selectedEngine.tradeoff}</p>
      </div>
      <div class="setup-origin-stats">
        <div class="setup-origin-stat"><span>Perk / Buff</span><strong>${selectedEngine.perk}</strong></div>
        <div class="setup-origin-stat"><span>Price</span><strong>${selectedEngine.price === 0 ? "FREE" : `$${selectedEngine.price}M`}</strong></div>
      </div>
    `;
  };

  const updateSetupState = () => {
    const selected = [...root.querySelectorAll("input[type=checkbox]:checked")];
    const teamName = teamNameInput.value.trim();
    const budget = Number(budgetSelect.value);
    const selectedDrivers = selected
      .map(entry => drivers.find(driver => driver.name === entry.value))
      .filter(Boolean);
    const totalSigningFees = selectedDrivers.reduce((sum, driver) => sum + (driver.signingFee ?? driver.salary ?? 0), 0);
    const totalUpfrontCost = totalSigningFees + selectedEngine.price;
    const remainingBudget = budget - totalUpfrontCost;
    const validSelection = selectedDrivers.length === 2;

    driverCount.textContent = `${selectedDrivers.length} / 2 selected`;
    budgetRemaining.textContent = `Remaining budget: $${remainingBudget}M`;
    confirmBtn.disabled = !teamName || !validSelection || remainingBudget < 0;

    if (!teamName && selectedDrivers.length > 0) {
      setupError.textContent = "Add a team name to continue.";
      return;
    }
    if (remainingBudget < 0) {
      setupError.textContent = "Your selected drivers and engine package exceed the starting budget.";
      return;
    }
    if (teamName && !validSelection) {
      setupError.textContent = "Select exactly 2 drivers.";
      return;
    }
    setupError.textContent = "";
  };

  teamNameInput.addEventListener("input", updateSetupState);
  budgetSelect.addEventListener("change", updateSetupState);
  seasonLengthSelect.addEventListener("change", updateSetupState);

  teamOriginsGrid.onclick = event => {
    const button = event.target.closest("[data-origin]");
    if (!button) return;

    const nextTier = teamTiers.find(tier => tier.id === button.dataset.origin);
    if (!nextTier) return;

    selectedTier = nextTier;
    teamOriginsGrid.querySelectorAll("[data-origin]").forEach(entry => {
      entry.classList.toggle("setup-origin-card-active", entry.dataset.origin === selectedTier.id);
    });
    renderTierPreview();
    updateSetupState();
  };

  engineProvidersGrid.onclick = event => {
    const button = event.target.closest("[data-engine]");
    if (!button) return;

    const nextEngine = engineProviders.find(engine => engine.id === button.dataset.engine);
    if (!nextEngine) return;

    selectedEngine = nextEngine;
    engineProvidersGrid.querySelectorAll("[data-engine]").forEach(entry => {
      entry.classList.toggle("setup-origin-card-active", entry.dataset.engine === selectedEngine.id);
    });
    renderEnginePreview();
    updateSetupState();
  };

  root.querySelectorAll("input[type=checkbox]").forEach(entry => {
    entry.addEventListener("change", updateSetupState);
  });

  renderTierPreview();
  renderEnginePreview();
  updateSetupState();

  confirmBtn.onclick = async () => {
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Finalizing Team...";
      const name = teamNameInput.value.trim();
      const budget = Number(budgetSelect.value);
      const totalRounds = Number(seasonLengthSelect.value);
      const selected = [...root.querySelectorAll("input[type=checkbox]:checked")];
      const selectedDrivers = selected
        .map(entry => drivers.find(driver => driver.name === entry.value))
        .filter(Boolean);
      const totalSigningFees = selectedDrivers.reduce((sum, driver) => sum + (driver.signingFee ?? driver.salary ?? 0), 0);
      const totalUpfrontCost = totalSigningFees + selectedEngine.price;

      if (!name || selectedDrivers.length !== 2) {
        setupError.textContent = "Enter team name and select exactly 2 drivers.";
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Create Team";
        return;
      }

      if (totalUpfrontCost > budget) {
        setupError.textContent = "Your selected drivers and engine package exceed the starting budget.";
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Create Team";
        return;
      }

      resetAiTeams();

      selectedDrivers.forEach(driver => {
        const sourceTeam = state.aiTeams.find(team => team.reserveDriver?.name === driver.name);
        if (!sourceTeam) return;
        sourceTeam.reserveDriver = null;
        assignReplacementReserve(state.aiTeams, sourceTeam.name, selectedDrivers.map(entry => entry.name));
      });

      const team = new Team(name, budget - totalUpfrontCost, selectedTier.ovr + (selectedEngine.effects.performance || 0));
      team.powerUnit = selectedEngine.name;
      team.specs = {
        ...selectedTier.specs,
        aero: selectedTier.specs.aero + (selectedEngine.effects.aero || 0),
        chassis: selectedTier.specs.chassis + (selectedEngine.effects.chassis || 0),
        reliability: selectedTier.specs.reliability + (selectedEngine.effects.reliability || 0),
        ovr: selectedTier.ovr + (selectedEngine.effects.performance || 0),
      };
      team.originTemplate = selectedTier.name;
      team.engineProfile = selectedEngine;
      selectedDrivers.forEach(driver => team.signDriver(driver));

      state.team = team;
      state.season = { round: 1, year: 1, totalRounds };
      state.standings = { drivers: {}, teams: {} };
      state.bestFinishes = {};
      state.signedSponsors = {};

      // Cloud save the state so if they log out, it's not lost
      await syncGame();

      renderDashboard(root);
    } catch (error) {
      console.error(error);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Create Team";
      setupError.textContent = `Could not create team: ${error.message}`;
    }
  };
}
