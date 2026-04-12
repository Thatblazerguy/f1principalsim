import { logoutUser } from "../lib/supabaseApi.js";
import React from "react";
import { createRoot } from "react-dom/client";
import NavHeader from "../components/ui/nav-header.tsx";

export function buildHubNav(active) {
  return `
    <header class="hub-nav glass">
      <div class="hub-nav-brand">
        <span class="hub-nav-mark">F1</span>
        <div>
          <p class="hub-nav-kicker">Create A Team</p>
          <strong>Command Hub</strong>
        </div>
      </div>
      <nav class="hub-nav-links">
        <div id="hubNavReact" data-active="${active}"></div>
      </nav>
    </header>
  `;
}

export function wireHubNav(root, handlers) {
  const navMount = root.querySelector("#hubNavReact");
  if (!navMount) return;

  const activeKey = navMount.getAttribute("data-active") || "dashboard";
  const navItems = [
    { key: "dashboard", label: "Dashboard" },
    { key: "weekend", label: "Race Weekend" },
    { key: "upgrade", label: "Upgrade Car" },
    { key: "drivers", label: "My Drivers" },
    { key: "teams", label: "Teams" },
    { key: "sponsors", label: "Sponsors" },
    { key: "market", label: "Driver Market" },
    { key: "calendar", label: "Calendar" },
    { key: "standings", label: "Standings" },
  ];

  const rootReact = createRoot(navMount);
  rootReact.render(
    React.createElement(NavHeader, {
      items: navItems,
      activeKey,
      onSelect: key => {
        const handlerId = `nav${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        const handler = handlers[handlerId];
        if (typeof handler === "function") handler();
      },
      onLogout: async () => {
        await logoutUser();
        window.location.reload();
      },
    })
  );
}
