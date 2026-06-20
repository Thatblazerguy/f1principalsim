export const trackLayouts = {
  // Simple Oval
  "Oval": "M 100 50 Q 200 50 200 100 Q 200 150 100 150 Q 0 150 0 100 Q 0 50 100 50 Z",
  
  // Standard Circuit (e.g. Melbourne, Bahrain)
  "Standard": "M 50 50 L 150 50 Q 200 50 200 100 Q 200 150 150 150 L 50 150 Q 0 150 0 100 Q 0 50 50 50 Z",

  // Long Straights (e.g. Baku, Monza)
  "Fast": "M 20 80 L 180 80 Q 200 80 200 100 Q 200 120 180 120 L 20 120 Q 0 120 0 100 Q 0 80 20 80 Z",

  // Figure 8 (e.g. Suzuka)
  "Figure8": "M 50 100 C 50 50 100 50 100 100 C 100 150 150 150 150 100 C 150 50 200 50 200 100 C 200 150 100 200 50 100 Z",

  // Hairpins (e.g. Monaco, Singapore)
  "Street": "M 20 20 L 180 20 L 180 60 L 60 60 L 60 100 L 180 100 L 180 140 L 20 140 Z",
  
  // Winding (e.g. Spa, Silverstone)
  "Winding": "M 20 100 Q 50 0 100 50 T 180 100 Q 150 200 100 150 T 20 100 Z",

  // Triangle-ish
  "Triangle": "M 100 20 L 180 150 L 20 150 Z"
};

// Maps circuit names from calendar.js to a layout type
export const getTrackPath = (circuitName) => {
  const c = circuitName.toLowerCase();
  if (c.includes("monaco") || c.includes("singapore") || c.includes("marina bay") || c.includes("madrid") || c.includes("jeddah")) {
    return trackLayouts["Street"];
  }
  if (c.includes("monza") || c.includes("baku") || c.includes("las vegas")) {
    return trackLayouts["Fast"];
  }
  if (c.includes("suzuka")) {
    return trackLayouts["Figure8"];
  }
  if (c.includes("spa") || c.includes("silverstone") || c.includes("cota") || c.includes("americas")) {
    return trackLayouts["Winding"];
  }
  if (c.includes("bahrain") || c.includes("shanghai") || c.includes("miami") || c.includes("catalunya") || c.includes("red bull") || c.includes("hungaroring")) {
    return trackLayouts["Standard"];
  }
  
  return trackLayouts["Standard"]; // Fallback
};
