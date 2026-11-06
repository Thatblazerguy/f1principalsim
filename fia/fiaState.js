/**
 * FIA Organization – State Management
 * Completely separate from Team Principal career (uses its own localStorage key).
 * Shares circuit definitions and team roster references from existing data.
 */

export const FIA_SAVE_KEY = 'f1-fia-save';

// ── Default Regulations ─────────────────────────────────────────────────────
export const DEFAULT_REGULATIONS = {
  technical: {
    minCarWeight: { value: 800, unit: 'kg', min: 750, max: 900, supported: true, label: 'Minimum Car Weight' },
    costCap: { value: 145, unit: '$M', min: 80, max: 250, supported: true, label: 'Cost Cap' },
    maxPowerUnitTokens: { value: 3, unit: 'tokens', min: 1, max: 8, supported: false, label: 'PU Development Tokens' },
    activeAero: { value: false, unit: 'bool', supported: false, label: 'Active Aerodynamics Allowed' },
  },
  sporting: {
    pointsSystem: {
      value: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
      supported: true,
      label: 'Points Allocation (P1–P10)',
    },
    fastestLapPoint: { value: true, unit: 'bool', supported: true, label: 'Fastest Lap Bonus Point' },
    sprintPoints: {
      value: [8, 7, 6, 5, 4, 3, 2, 1],
      supported: true,
      label: 'Sprint Points (P1–P8)',
    },
    maxSprintWeekends: { value: 6, unit: 'races', min: 0, max: 12, supported: true, label: 'Max Sprint Weekends' },
    maxCalendarSize: { value: 24, unit: 'races', min: 10, max: 30, supported: true, label: 'Maximum Calendar Size' },
    minCalendarSize: { value: 16, unit: 'races', min: 8, max: 24, supported: true, label: 'Minimum Calendar Size' },
    maxGridSize: { value: 22, unit: 'cars', min: 10, max: 26, supported: true, label: 'Maximum Grid Size' },
    raceDistance: { value: 305, unit: 'km', min: 200, max: 500, supported: false, label: 'Minimum Race Distance' },
    qualifyingFormat: { value: 'knockout', options: ['knockout', 'single-lap', 'aggregate'], supported: false, label: 'Qualifying Format' },
  },
  financial: {
    prizePool: { value: 1200, unit: '$M', min: 500, max: 3000, supported: false, label: 'Total Prize Pool' },
    entryFee: { value: 0.5, unit: '$M', min: 0, max: 5, supported: false, label: 'Team Entry Fee' },
    financialPenaltyMultiplier: { value: 1.0, unit: 'x', min: 0.5, max: 3.0, supported: false, label: 'Financial Penalty Multiplier' },
  },
};

// ── Default FIA Career ───────────────────────────────────────────────────────
export function createDefaultFIACareer(name = 'FIA Career', startYear = 2026) {
  return {
    careerName: name,
    startYear,
    currentYear: startYear,
    governanceMode: 'full_authority', // 'full_authority' | 'realistic'
    approvalRating: 75,
    finances: {
      budget: 500, // $M available for FIA operations
      annualRevenue: 1200,
      annualExpenditure: 0,
      history: [],
    },
    regulations: JSON.parse(JSON.stringify(DEFAULT_REGULATIONS)),
    pendingDecisions: [],
    resolvedDecisions: [],
    seasonHistory: [],
    circuitLicenses: {}, // circuitId -> license record
    hostingContracts: {}, // circuitId -> contract
    calendarDrafts: [],
    approvedCalendars: [],
    entryApplications: [],
    customCircuits: [], // Player-created circuits
    notifications: [],
    createdAt: Date.now(),
    lastSaved: Date.now(),
  };
}

// ── Active FIA Career (in-memory singleton) ──────────────────────────────────
export let fiaCareer = null;

export function setFIACareer(career) {
  fiaCareer = career;
}

export function getFIACareer() {
  return fiaCareer;
}

// ── Persistence ──────────────────────────────────────────────────────────────
export function saveFIACareer() {
  if (!fiaCareer) return;
  fiaCareer.lastSaved = Date.now();
  localStorage.setItem(FIA_SAVE_KEY, JSON.stringify(fiaCareer));
}

export function loadFIACareer() {
  try {
    const raw = localStorage.getItem(FIA_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migration: ensure regulation blocks exist
    if (!parsed.regulations) parsed.regulations = JSON.parse(JSON.stringify(DEFAULT_REGULATIONS));
    if (!parsed.customCircuits) parsed.customCircuits = [];
    if (!parsed.calendarDrafts) parsed.calendarDrafts = [];
    if (!parsed.approvedCalendars) parsed.approvedCalendars = [];
    if (!parsed.entryApplications) parsed.entryApplications = [];
    return parsed;
  } catch {
    return null;
  }
}

export function deleteFIACareer() {
  localStorage.removeItem(FIA_SAVE_KEY);
  fiaCareer = null;
}

export function hasFIASave() {
  return !!localStorage.getItem(FIA_SAVE_KEY);
}

// ── License helpers ──────────────────────────────────────────────────────────
export const LICENSE_STATUS = {
  DRAFT: 'draft',
  AWAITING_INSPECTION: 'awaiting_inspection',
  CONDITIONALLY_APPROVED: 'conditionally_approved',
  LICENSED: 'licensed',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
};

export function getLicenseForCircuit(career, circuitId) {
  return career.circuitLicenses[circuitId] || null;
}

export function isCircuitEligible(career, circuitId) {
  const lic = getLicenseForCircuit(career, circuitId);
  if (!lic) return false;
  return lic.status === LICENSE_STATUS.LICENSED || lic.status === LICENSE_STATUS.CONDITIONALLY_APPROVED;
}

export function setCircuitLicense(career, circuitId, status, notes = '') {
  career.circuitLicenses[circuitId] = {
    circuitId,
    status,
    notes,
    updatedAt: Date.now(),
  };
}

// ── Calendar validation ──────────────────────────────────────────────────────
export function validateCalendar(circuits, career) {
  const errors = [];
  const warnings = [];
  const regs = career.regulations.sporting;
  const maxSize = regs.maxCalendarSize.value;
  const minSize = regs.minCalendarSize.value;
  const maxSprints = regs.maxSprintWeekends.value;

  if (circuits.length < minSize)
    errors.push({ type: 'error', code: 'MIN_RACES', message: `Calendar has only ${circuits.length} races. Minimum is ${minSize}.` });
  if (circuits.length > maxSize)
    errors.push({ type: 'error', code: 'MAX_RACES', message: `Calendar has ${circuits.length} races. Maximum is ${maxSize}.` });

  const ids = circuits.map(c => c.circuitId || c.circuit);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0)
    errors.push({ type: 'error', code: 'DUPLICATES', message: `Duplicate circuits: ${[...new Set(dupes)].join(', ')}` });

  const sprintCount = circuits.filter(c => c.sprint).length;
  if (sprintCount > maxSprints)
    warnings.push({ type: 'warning', code: 'SPRINT_LIMIT', message: `${sprintCount} sprint weekends exceeds recommended limit of ${maxSprints}.` });

  // Unlicensed circuits
  circuits.forEach(c => {
    const id = c.circuitId || c.circuit;
    if (!isCircuitEligible(career, id)) {
      warnings.push({ type: 'warning', code: 'UNLICENSED', message: `"${c.name || id}" is not licensed for racing.`, circuitId: id });
    }
  });

  return { errors, warnings, isValid: errors.length === 0 };
}

// ── Calendar scorecard ───────────────────────────────────────────────────────
export function calculateCalendarScorecard(circuits, career) {
  const contractRevenue = circuits.reduce((sum, c) => {
    const contract = career.hostingContracts[c.circuitId || c.circuit];
    return sum + (contract?.hostingFee || 0);
  }, 0);

  const regions = [...new Set(circuits.map(c => c.country || 'Unknown'))];
  const sprintCount = circuits.filter(c => c.sprint).length;

  const continentMap = {
    Australia: 'Oceania', China: 'Asia', Japan: 'Asia', Bahrain: 'Middle East',
    'Saudi Arabia': 'Middle East', USA: 'Americas', Canada: 'Americas', Monaco: 'Europe',
    Spain: 'Europe', Austria: 'Europe', UK: 'Europe', Belgium: 'Europe', Hungary: 'Europe',
    Netherlands: 'Europe', Italy: 'Europe', Azerbaijan: 'Europe', Singapore: 'Asia',
    Mexico: 'Americas', Brazil: 'Americas', Qatar: 'Middle East', UAE: 'Middle East',
  };

  const continents = [...new Set(circuits.map(c => continentMap[c.country] || 'Other'))];

  return {
    totalRaces: circuits.length,
    estimatedRevenue: contractRevenue || circuits.length * 40, // $M estimate
    sprintWeekends: sprintCount,
    regionsRepresented: regions.length,
    continentsRepresented: continents.length,
    europeanRaces: circuits.filter(c => continentMap[c.country] === 'Europe').length,
    estimatedLogisticsCost: circuits.length * 12, // $M rough estimate
  };
}

// ── FIA Events ───────────────────────────────────────────────────────────────
export const FIA_EVENT_TEMPLATES = [
  {
    id: 'circuit_safety_concern',
    title: 'Circuit Safety Concern',
    description: 'Safety inspectors have flagged {circuit} for inadequate run-off areas at Turn 12.',
    choices: [
      { id: 'require_modifications', label: 'Require modifications before racing', approvalDelta: +5, budgetDelta: 0 },
      { id: 'conditional_approval', label: 'Grant conditional approval with warnings', approvalDelta: -3, budgetDelta: 0 },
      { id: 'remove_from_calendar', label: 'Remove from the calendar', approvalDelta: -8, budgetDelta: +15 },
    ],
  },
  {
    id: 'hosting_dispute',
    title: 'Hosting Fee Dispute',
    description: '{circuit} promoter threatens to pull out unless the hosting fee is reduced by 20%.',
    choices: [
      { id: 'accept_reduction', label: 'Accept the 20% reduction', approvalDelta: +3, budgetDelta: -8 },
      { id: 'negotiate', label: 'Negotiate a 10% reduction', approvalDelta: +1, budgetDelta: -4 },
      { id: 'call_bluff', label: 'Hold firm — call the bluff', approvalDelta: -5, budgetDelta: 0 },
    ],
  },
  {
    id: 'new_team_application',
    title: 'New Team Entry Application',
    description: 'A new manufacturer has applied for a grid slot starting next season.',
    choices: [
      { id: 'approve', label: 'Approve the application', approvalDelta: +6, budgetDelta: +5 },
      { id: 'conditional', label: 'Conditional approval pending financial audit', approvalDelta: +2, budgetDelta: 0 },
      { id: 'reject', label: 'Reject the application', approvalDelta: -4, budgetDelta: 0 },
    ],
  },
  {
    id: 'regulation_protest',
    title: 'Team Regulation Protest',
    description: 'Three constructors have formally protested the latest technical directive.',
    choices: [
      { id: 'uphold_directive', label: 'Uphold the directive', approvalDelta: -2, budgetDelta: 0 },
      { id: 'review_directive', label: 'Commission a technical review', approvalDelta: +4, budgetDelta: -2 },
      { id: 'rescind_directive', label: 'Rescind the directive', approvalDelta: +8, budgetDelta: 0 },
    ],
  },
];

export function generateRandomEvent(career) {
  const template = FIA_EVENT_TEMPLATES[Math.floor(Math.random() * FIA_EVENT_TEMPLATES.length)];
  return {
    ...template,
    instanceId: `${template.id}-${Date.now()}`,
    resolved: false,
    createdAt: Date.now(),
  };
}
