/**
 * Circuit Designer Engine
 * Handles geometry calculations, validation, and statistics for custom circuits.
 */

/**
 * Calculate distance between two points
 */
export function dist(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Calculate total polyline length from control points
 */
export function calcPolylineLength(points) {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += dist(points[i], points[i + 1]);
  }
  // close the loop
  if (points.length > 1) {
    length += dist(points[points.length - 1], points[0]);
  }
  return length;
}

/**
 * Scale pixel length to real-world km given a scale factor (px per km)
 */
export function pixelsToKm(pixels, scale = 60) {
  return pixels / scale;
}

/**
 * Calculate the angle between three points (corner angle in degrees)
 */
export function cornerAngle(p0, p1, p2) {
  const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
  const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cos) * (180 / Math.PI);
}

/**
 * Classify a corner angle into speed category
 */
export function classifyCorner(angle) {
  // angle = deviation from straight (180 = straight, 0 = hairpin)
  if (angle < 60) return 'slow'; // hairpin
  if (angle < 100) return 'medium';
  if (angle < 140) return 'fast';
  return 'kink';
}

/**
 * Calculate statistics from control points
 */
export function calculateCircuitStats(points, scale = 60) {
  if (!points || points.length < 3) {
    return null;
  }

  const pixelLength = calcPolylineLength(points);
  const lengthKm = pixelsToKm(pixelLength, scale);

  // Corner analysis
  const corners = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const angle = cornerAngle(p0, p1, p2);
    // Only count as a corner if there's a meaningful direction change
    if (angle < 165) {
      corners.push({
        index: i,
        angle,
        type: classifyCorner(angle),
      });
    }
  }

  // Segment lengths
  const segments = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    segments.push(dist(p1, p2));
  }
  const longestSegmentPx = Math.max(...segments);
  const longestStraightM = pixelsToKm(longestSegmentPx, scale) * 1000;

  // Estimate full-throttle percentage (straight + fast corners)
  const fastSegs = segments.filter((_, i) => {
    const corner = corners.find(c => c.index === i);
    return !corner || corner.type === 'fast' || corner.type === 'kink';
  });
  const fullThrottlePct = Math.round((fastSegs.reduce((a, b) => a + b, 0) / pixelLength) * 100);

  // Overtaking difficulty (based on corner types and straight lengths)
  const hairpinCount = corners.filter(c => c.type === 'slow').length;
  const overtakingDifficulty = Math.max(20, Math.min(95, 80 - hairpinCount * 8 - (longestStraightM > 1000 ? 15 : 0)));

  // Tyre severity (based on corner count and medium/slow corners)
  const hardCorners = corners.filter(c => c.type === 'slow' || c.type === 'medium').length;
  const tyreSeverity = hardCorners > 12 ? 'Very High' :
    hardCorners > 8 ? 'High' :
    hardCorners > 5 ? 'Medium' : 'Low';

  // Downforce demand (fast corners = high downforce)
  const fastCorners = corners.filter(c => c.type === 'fast').length;
  const downforceDemand = fastCorners > 8 ? 'Very High' :
    fastCorners > 5 ? 'High' :
    fastCorners > 3 ? 'Medium' : 'Low';

  // Base lap time estimate (rough model: 0.8s per 100m + corner penalties)
  const baseLapSeconds = (lengthKm * 10) + (corners.length * 2) + (hairpinCount * 3);

  return {
    lengthKm: Math.round(lengthKm * 1000) / 1000,
    cornerCount: corners.length,
    corners,
    longestStraightM: Math.round(longestStraightM),
    fullThrottlePct: Math.max(10, Math.min(90, fullThrottlePct)),
    overtakingDifficulty,
    tyreSeverity,
    downforceDemand,
    estimatedLapTime: Math.round(baseLapSeconds),
    estimatedLaps: Math.max(1, Math.round(305 / Math.max(0.1, lengthKm))), // target 305km race
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALIDATION_LIMITS = {
  minLengthKm: 3.0,
  maxLengthKm: 9.0,
  minCorners: 4,
  maxCorners: 35,
  maxLongestStraightM: 2500,
  minPoints: 4,
  minSafetyRating: 60,
};

export function validateCircuitDesign(circuit) {
  const errors = [];
  const warnings = [];

  const { points, name, startFinishIndex, pitLane } = circuit;

  // ── Hard errors ────────────────────────────────────────────────────────────
  if (!name || name.trim().length === 0) {
    errors.push({ code: 'NO_NAME', message: 'Circuit must have a name.' });
  }
  if (!points || points.length < VALIDATION_LIMITS.minPoints) {
    errors.push({ code: 'INSUFFICIENT_POINTS', message: `Circuit needs at least ${VALIDATION_LIMITS.minPoints} control points. Currently has ${points?.length || 0}.` });
    return { errors, warnings, isValid: false }; // Can't continue without points
  }

  const stats = calculateCircuitStats(points, circuit.scale || 60);
  if (!stats) {
    errors.push({ code: 'INVALID_GEOMETRY', message: 'Could not calculate circuit statistics. Check your layout.' });
    return { errors, warnings, isValid: false };
  }

  if (stats.lengthKm < VALIDATION_LIMITS.minLengthKm) {
    errors.push({ code: 'TOO_SHORT', message: `Circuit length ${stats.lengthKm.toFixed(2)} km is below the minimum ${VALIDATION_LIMITS.minLengthKm} km.` });
  }
  if (stats.lengthKm > VALIDATION_LIMITS.maxLengthKm) {
    errors.push({ code: 'TOO_LONG', message: `Circuit length ${stats.lengthKm.toFixed(2)} km exceeds maximum ${VALIDATION_LIMITS.maxLengthKm} km.` });
  }
  if (stats.cornerCount < VALIDATION_LIMITS.minCorners) {
    errors.push({ code: 'TOO_FEW_CORNERS', message: `Circuit has only ${stats.cornerCount} corners. Minimum is ${VALIDATION_LIMITS.minCorners}.` });
  }

  if (startFinishIndex === undefined || startFinishIndex === null) {
    errors.push({ code: 'NO_START_FINISH', message: 'Start/finish line not defined.' });
  }

  if (!pitLane || !pitLane.entry || !pitLane.exit) {
    errors.push({ code: 'INVALID_PIT_LANE', message: 'Pit lane entry and exit must be configured.' });
  }

  // ── Safety warnings ────────────────────────────────────────────────────────
  if (stats.longestStraightM > VALIDATION_LIMITS.maxLongestStraightM) {
    warnings.push({ code: 'EXCESSIVE_STRAIGHT', message: `Straight of ${stats.longestStraightM}m may require additional safety measures.` });
  }

  const hairpins = stats.corners.filter(c => c.angle < 50);
  if (hairpins.length > 0) {
    warnings.push({ code: 'TIGHT_CORNERS', message: `${hairpins.length} very tight corner(s) (< 50°) detected. Ensure adequate run-off.` });
  }

  if (stats.cornerCount > VALIDATION_LIMITS.maxCorners) {
    warnings.push({ code: 'TOO_MANY_CORNERS', message: `${stats.cornerCount} corners may make the circuit overly complex.` });
  }

  const trackWidth = circuit.trackWidth || 12;
  if (trackWidth < 10) {
    warnings.push({ code: 'NARROW_TRACK', message: `Track width of ${trackWidth}m may be insufficient. Recommended minimum is 10m.` });
  }

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    stats,
  };
}

// ── SVG Path Generation ───────────────────────────────────────────────────────

/**
 * Generate a smooth SVG path (using quadratic bezier curves) from control points
 */
export function generateSVGPath(points) {
  if (!points || points.length < 2) return '';

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Smooth control point
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${cpx} ${cpy}`;
  }

  // Close the loop
  const cp = {
    x: (points[points.length - 1].x + points[0].x) / 2,
    y: (points[points.length - 1].y + points[0].y) / 2,
  };
  d += ` Q ${points[points.length - 1].x} ${points[points.length - 1].y} ${cp.x} ${cp.y} Z`;

  return d;
}

// ── Preset & Procedural Track Synthesis ──────────────────────────────────────

export const TRACK_PRESETS = [
  {
    id: 'downtown_dubai',
    name: 'Downtown Dubai Street Circuit',
    country: 'United Arab Emirates',
    region: 'Middle East',
    type: 'street',
    description: 'High-speed urban spectacle threading between Burj Khalifa, Dubai Fountain, and Financial Center.',
    hostingFee: 65,
    points: [
      { x: 100, y: 380 }, { x: 200, y: 380 }, { x: 300, y: 380 }, { x: 380, y: 360 },
      { x: 440, y: 320 }, { x: 500, y: 260 }, { x: 540, y: 190 }, { x: 540, y: 120 },
      { x: 480, y: 90 }, { x: 400, y: 100 }, { x: 340, y: 150 }, { x: 280, y: 160 },
      { x: 220, y: 120 }, { x: 160, y: 140 }, { x: 110, y: 200 }, { x: 80, y: 280 }
    ],
    startFinishIndex: 0,
    pitLane: { entry: 15, exit: 1 },
  },
  {
    id: 'tokyo_bay',
    name: 'Tokyo Bay Harbor Circuit',
    country: 'Japan',
    region: 'Asia',
    type: 'street',
    description: 'Electrifying neon waterfront circuit crossing the Odaiba marina and Rainbow Bridge approach.',
    hostingFee: 58,
    points: [
      { x: 120, y: 360 }, { x: 220, y: 360 }, { x: 340, y: 360 }, { x: 440, y: 320 },
      { x: 500, y: 240 }, { x: 520, y: 160 }, { x: 460, y: 100 }, { x: 380, y: 120 },
      { x: 320, y: 180 }, { x: 240, y: 180 }, { x: 160, y: 220 }, { x: 100, y: 280 }
    ],
    startFinishIndex: 0,
    pitLane: { entry: 11, exit: 1 },
  },
  {
    id: 'copenhagen_canal',
    name: 'Copenhagen Waterfront Grand Prix',
    country: 'Denmark',
    region: 'Europe',
    type: 'street',
    description: 'Technical street circuit winding past historical canals, royal palaces, and harbor straights.',
    hostingFee: 48,
    points: [
      { x: 140, y: 340 }, { x: 260, y: 340 }, { x: 380, y: 340 }, { x: 480, y: 300 },
      { x: 500, y: 200 }, { x: 440, y: 120 }, { x: 340, y: 100 }, { x: 240, y: 120 },
      { x: 180, y: 180 }, { x: 120, y: 240 }
    ],
    startFinishIndex: 0,
    pitLane: { entry: 9, exit: 1 },
  },
  {
    id: 'vegas_strip_super',
    name: 'Vegas Neon Speedway',
    country: 'USA',
    region: 'Americas',
    type: 'street',
    description: 'Massive boulevard straights with sweeping banked chicanes through illuminated casino towers.',
    hostingFee: 70,
    points: [
      { x: 90, y: 380 }, { x: 220, y: 380 }, { x: 360, y: 380 }, { x: 500, y: 380 },
      { x: 550, y: 300 }, { x: 520, y: 200 }, { x: 440, y: 140 }, { x: 320, y: 120 },
      { x: 200, y: 140 }, { x: 120, y: 220 }, { x: 80, y: 300 }
    ],
    startFinishIndex: 0,
    pitLane: { entry: 10, exit: 1 },
  }
];

/**
 * Generate a complete track blueprint based on preset or procedural rules
 */
export function generateTrackBlueprint(options = {}) {
  const {
    name = 'Downtown Dubai Street Circuit',
    country = 'United Arab Emirates',
    region = 'Middle East',
    type = 'street',
    presetId = null,
    targetCorners = 16,
  } = options;

  let basePoints = [];
  let chosenPreset = null;

  if (presetId) {
    chosenPreset = TRACK_PRESETS.find(p => p.id === presetId);
  } else {
    chosenPreset = TRACK_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  if (chosenPreset) {
    basePoints = [...chosenPreset.points];
  } else {
    // Procedural generation around center (320, 240)
    const cx = 320;
    const cy = 240;
    const n = Math.max(8, Math.min(24, targetCorners));
    const pts = [];

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI;
      // Add organic harmonics
      const rBaseX = 180 + Math.sin(angle * 2) * 35 + Math.cos(angle * 3) * 20;
      const rBaseY = 130 + Math.cos(angle * 2) * 25 + Math.sin(angle * 3) * 15;
      const x = Math.round(Math.max(60, Math.min(580, cx + Math.cos(angle) * rBaseX)) / 10) * 10;
      const y = Math.round(Math.max(60, Math.min(420, cy + Math.sin(angle) * rBaseY)) / 10) * 10;
      pts.push({ x, y });
    }
    basePoints = pts;
  }

  const startFinishIndex = 0;
  const pitLane = {
    entry: basePoints.length - 1,
    exit: 1
  };

  const stats = calculateCircuitStats(basePoints, 60);

  return {
    id: `track-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    circuitId: name,
    name,
    country: chosenPreset?.country || country,
    region: chosenPreset?.region || region,
    type: chosenPreset?.type || type,
    description: chosenPreset?.description || `High-performance modern circuit engineered for competitive Formula 1 racing in ${country}.`,
    points: basePoints,
    trackWidth: 14,
    scale: 60,
    startFinishIndex,
    pitLane,
    stats,
    hostingFee: chosenPreset?.hostingFee || 50,
    lengthKm: stats?.lengthKm || 5.2,
    laps: stats?.estimatedLaps || 58,
    corners: stats?.cornerCount || basePoints.length,
    baseTime: stats?.estimatedLapTime || 92,
    tyreWear: stats?.tyreSeverity === 'High' ? 1.4 : 1.25,
    svgPath: generateSVGPath(basePoints),
    status: 'validated',
    licensed: true,
    createdAt: Date.now(),
  };
}

/**
 * Default new circuit template
 */
export function createNewCircuit(name = 'My Circuit') {
  return {
    id: `custom-${Date.now()}`,
    name,
    country: '',
    region: '',
    type: 'permanent',
    points: [],
    trackWidth: 12,
    scale: 60, // pixels per km
    startFinishIndex: null,
    pitLane: { entry: null, exit: null },
    elevationData: [],
    safetyRating: 75,
    notes: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft', // 'draft' | 'validated' | 'submitted'
  };
}

