import React from 'react';
import { checkAuthAndRoute } from "./auth.tsx";
import { renderToAppRoot } from "../utils/reactRoot.tsx";
import { renderFIADashboard } from "../fia/FIADashboard.tsx";
import { LandingExperience } from "./landing/LandingExperience.tsx";

export function renderLanding(root: HTMLElement) {
  renderToAppRoot(root, <LandingExperience onEnter={() => checkAuthAndRoute(root)} onFIA={() => renderFIADashboard(root)} />);
}
