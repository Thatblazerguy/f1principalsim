/** Where on the car / team the brand appears — each slot can hold one sponsor deal. */
export const SPONSOR_SLOTS = [
  {
    key: "title",
    label: "Title sponsor",
    blurb: "Naming rights and lead branding across the team and broadcasts.",
  },
  {
    key: "kit",
    label: "Kit & livery",
    blurb: "Race suits, garage, and main body colours alongside your identity.",
  },
  {
    key: "sidepod",
    label: "Sidepod",
    blurb: "Large panels on the sides — high visibility for TV and fans.",
  },
  {
    key: "rearWing",
    label: "Rear wing",
    blurb: "Endplates and beam wing — strong camera-facing placement every lap.",
  },
  {
    key: "halo",
    label: "Halo",
    blurb: "Central survival cell strip seen from onboard and heli shots.",
  },
];

export const sponsors = [
  {
    id: "apex",
    name: "Apex Dynamics",
    category: "Tech Partner",
    signingBonus: 18,
    raceBonus: 7,
    description: "High-tech analytics partner focused on long-term team growth and performance bonuses.",
  },
  {
    id: "ignition",
    name: "Ignition Energy",
    category: "Energy Brand",
    signingBonus: 25,
    raceBonus: 5,
    description: "Big up-front cash injection with a steady race-by-race support package.",
  },
  {
    id: "scarlet",
    name: "Scarlet Motors",
    category: "Auto Group",
    signingBonus: 12,
    raceBonus: 10,
    description: "Lower signing fee, but stronger recurring race payouts for every completed weekend.",
  },
  {
    id: "vector",
    name: "Vector Cloud",
    category: "Software",
    signingBonus: 15,
    raceBonus: 6,
    description: "Infrastructure and simulation tools — solid midfield commercial package.",
  },
  {
    id: "helix",
    name: "Helix Logistics",
    category: "Industrial",
    signingBonus: 20,
    raceBonus: 5,
    description: "Global freight and operations partner with balanced fees and per-race fees.",
  },
  {
    id: "pulse",
    name: "Pulse Media",
    category: "Broadcast",
    signingBonus: 10,
    raceBonus: 8,
    description: "Content and fan engagement partner — lighter upfront, stronger race cheques.",
  },
];
