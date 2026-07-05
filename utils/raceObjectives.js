/**
 * raceObjectives.js
 * -----------------
 * Race weekend objective definitions.
 * Extracted here so this constant can be imported by both weekend.tsx
 * and UI sub-components (PreRaceBriefingModal, DetailedRaceReport)
 * without breaking Vite / React Fast Refresh.
 * (Fast Refresh requires component files to ONLY export components.)
 */

export const RACE_OBJECTIVES = [
  { id: 'win',          label: '🏆 Push For Win',         risk: 'High'    },
  { id: 'podium',       label: '🥈 Fight For Podium',      risk: 'Medium'  },
  { id: 'points',       label: '🎯 Finish In Points',       risk: 'Low'     },
  { id: 'conservative', label: '💰 Conservative Points',   risk: 'Minimal' },
  { id: 'gamble',       label: '🌧 Strategy Gamble',        risk: 'Extreme' },
];
