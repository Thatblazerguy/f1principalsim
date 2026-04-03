export function buildHubNav(active) {
  const items = [
    { id: "navDashboard", label: "Dashboard", key: "dashboard" },
    { id: "navWeekend", label: "Race Weekend", key: "weekend" },
    { id: "navUpgrade", label: "Upgrade Car", key: "upgrade" },
    { id: "navDrivers", label: "My Drivers", key: "drivers" },
    { id: "navTeams", label: "Teams", key: "teams" },
    { id: "navSponsors", label: "Sponsors", key: "sponsors" },
    { id: "navMarket", label: "Driver Market", key: "market" },
    { id: "navCalendar", label: "Calendar", key: "calendar" },
    { id: "navStandings", label: "Standings", key: "standings" },
  ];

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
        ${items
          .map(
            item => `
              <button
                id="${item.id}"
                class="hub-nav-link ${active === item.key ? "hub-nav-link-active" : ""}"
              >
                ${item.label}
              </button>
            `
          )
          .join("")}
      </nav>
    </header>
  `;
}

export function wireHubNav(root, handlers) {
  Object.entries(handlers).forEach(([id, handler]) => {
    const el = root.querySelector(`#${id}`);
    if (el) el.onclick = handler;
  });
}
