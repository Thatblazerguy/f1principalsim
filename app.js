import { renderLanding } from "./screens/landing.js";
import { syncDriversFromOpenF1 } from "./data/drivers.js";

async function boot() {
  await syncDriversFromOpenF1();
  renderLanding(document.getElementById("app"));
}

boot();
