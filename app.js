import "./tailwind.css";
import { renderLanding } from "./screens/landing.tsx";
import { syncDriversFromOpenF1, drivers } from "./data/drivers.js";
import { state, resetAiTeams } from "./state.js";
import { reconcileRosters } from "./data/teams.js";
import { Team } from "./game/team.js";
import { ensureFinanceState } from "./utils/financeSystem.js";
import { ensureEngineeringState } from "./utils/engineeringSystem.js";
import { calendar } from "./data/calendar.js";

function setupDemoState() {
  resetAiTeams();
  const team = new Team("Scuderia Ferrari HP", 84, 94);
  team.powerUnit = "Ferrari";
  team.specs = { aero: 95, chassis: 94, reliability: 93, ovr: 94 };
  const d1 = drivers.find(d => d.name === "Charles Leclerc") || drivers[0];
  const d2 = drivers.find(d => d.name === "Lewis Hamilton") || drivers[1];
  if (d1) team.signDriver(d1);
  if (d2) team.signDriver(d2);
  state.team = team;
  reconcileRosters(state.team, state.aiTeams); // AI Ferrari can't keep Leclerc/Hamilton too
  state.season.round = 1;
  state.season.calendar = [...calendar];
  // Throwaway team: syncGame() must never save this over the player's real save.
  state.isDemo = true;
  ensureFinanceState(state);
  ensureEngineeringState(state);
}

async function renderRaceControlDemo(root) {
  const { RaceControl } = await import("./screens/RaceControl.tsx");
  const { renderToAppRoot } = await import("./utils/reactRoot.tsx");
  const React = (await import("react")).default;
  const track = calendar[0];
  const qualifyingGrid = [
    { driver: state.team.drivers[0], team: state.team, grid: 1, time: "1:29.179" },
    { driver: state.team.drivers[1], team: state.team, grid: 2, time: "1:29.312" },
    ...state.aiTeams.flatMap(t => t.drivers.map((d, i) => ({ driver: d, team: t, grid: 3 + i, time: "1:29.800" })))
  ].slice(0, 20);
  renderToAppRoot(root, React.createElement(RaceControl, {
    teams: [state.team, ...state.aiTeams],
    track,
    laps: track.laps || 57,
    qualifyingGrid,
    selectedStrategies: { [state.team.drivers[0].name]: 'Soft -> Hard (1 Stop)', [state.team.drivers[1].name]: 'Medium -> Hard (1 Stop)' },
    selectedObjective: { title: 'Double Podium Finish', target: 'P1-P3' },
    weekendContext: null,
    onRaceComplete: () => {}
  }));
}

/** Dev-only deep links (`?screen=weekend`) that open a screen with a demo team. */
const DEMO_SCREENS = {
  hub:         async (root) => (await import("./screens/dashboard.tsx")).renderDashboard(root),
  dashboard:   async (root) => (await import("./screens/dashboard.tsx")).renderDashboard(root),
  engineering: async (root) => (await import("./screens/engineering.tsx")).renderEngineering(root),
  academy:     async (root) => (await import("./screens/academy.tsx")).renderAcademy(root),
  drivers:     async (root) => (await import("./screens/myDrivers.tsx")).renderMyDrivers(root),
  myDrivers:   async (root) => (await import("./screens/myDrivers.tsx")).renderMyDrivers(root),
  weekend:     async (root) => (await import("./screens/weekend.tsx")).renderWeekend(root),
  pitwall:     renderRaceControlDemo,
  racecontrol: renderRaceControlDemo,
  fia:         async (root) => (await import("./fia/FIADashboard.tsx")).renderFIADashboard(root),
  history:     async (root) => (await import("./screens/history.tsx")).renderHistory(root),
  finance:     async (root) => (await import("./screens/finance.tsx")).renderFinance(root),
};

async function boot() {
  await syncDriversFromOpenF1();
  const root = document.getElementById("app");
  const params = new URLSearchParams(window.location.search);
  const screen = params.get("screen");

  // In-app navigation never updates the URL, so a leftover ?screen= would send
  // every reload (including Vite hot reloads) back to that screen with demo data.
  // Read it once, then drop it.
  if (screen) {
    params.delete("screen");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
  }

  const openDemo = import.meta.env.DEV && screen ? DEMO_SCREENS[screen] : null;
  if (!openDemo) {
    renderLanding(root);
    return;
  }

  setupDemoState();
  await openDemo(root);
}

boot();
