import { renderLanding } from "./screens/landing.tsx";
import { syncDriversFromOpenF1, drivers } from "./data/drivers.js";
import { state, resetAiTeams } from "./state.js";
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
  state.season.round = 1;
  state.season.calendar = [...calendar];
  ensureFinanceState(state);
  ensureEngineeringState(state);
}

async function boot() {
  await syncDriversFromOpenF1();
  const root = document.getElementById("app");
  const params = new URLSearchParams(window.location.search);
  const screen = params.get("screen");

  if (!screen || screen === "landing") {
    renderLanding(root);
    return;
  }

  setupDemoState();

  if (screen === "hub" || screen === "dashboard") {
    const { renderDashboard } = await import("./screens/dashboard.tsx");
    renderDashboard(root);
  } else if (screen === "engineering") {
    const { renderEngineering } = await import("./screens/engineering.tsx");
    renderEngineering(root);
  } else if (screen === "academy") {
    const { renderAcademy } = await import("./screens/academy.tsx");
    renderAcademy(root);
  } else if (screen === "drivers" || screen === "myDrivers") {
    const { renderMyDrivers } = await import("./screens/myDrivers.tsx");
    renderMyDrivers(root);
  } else if (screen === "weekend") {
    const { renderWeekend } = await import("./screens/weekend.tsx");
    renderWeekend(root);
  } else if (screen === "pitwall" || screen === "racecontrol") {
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
  } else if (screen === "fia") {
    const { renderFIADashboard } = await import("./fia/FIADashboard.tsx");
    renderFIADashboard(root);
  } else if (screen === "history") {
    const { renderHistory } = await import("./screens/history.tsx");
    renderHistory(root);
  } else if (screen === "finance") {
    const { renderFinance } = await import("./screens/finance.tsx");
    renderFinance(root);
  } else {
    renderLanding(root);
  }
}

boot();
