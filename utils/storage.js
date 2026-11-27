/**
 * Local save slot.
 *
 * Saves are keyed per user so two accounts on the same browser never load each
 * other's career. Every save is stamped with `_savedAt` so we can tell whether
 * the local copy or the cloud copy is newer.
 */

const LEGACY_KEY = "f1-save";
const OFFLINE_USER = "offline-user";

/** How many of the most recent races keep their full replay in the save. */
export const REPLAYS_KEPT = 3;

export const saveKeyFor = (userId) => `${LEGACY_KEY}:${userId || OFFLINE_USER}`;

/**
 * Strip the heavy per-race replay snapshots from all but the latest races.
 * One replay is ~200 KB, so a full season of them overflows localStorage's
 * ~5 MB quota. Returns a new object; the input is not mutated.
 */
export function compactSave(saveObj) {
  if (!saveObj || !Array.isArray(saveObj.raceHistory)) return saveObj;
  const history = saveObj.raceHistory;
  const keepFrom = Math.max(0, history.length - REPLAYS_KEPT);
  return {
    ...saveObj,
    raceHistory: history.map((race, i) =>
      i >= keepFrom || !race?.replayData ? race : { ...race, replayData: null }),
  };
}

/**
 * Write the save. Returns true on success, false if the browser refused it
 * (quota exceeded, storage disabled). Never throws.
 */
export function saveGame(saveObj, userId) {
  const stamped = { ...compactSave(saveObj), _savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(saveKeyFor(userId), JSON.stringify(stamped));
    return true;
  } catch (err) {
    // Last resort: drop every replay and try once more.
    try {
      const minimal = {
        ...stamped,
        raceHistory: (stamped.raceHistory || []).map((race) => ({ ...race, replayData: null })),
      };
      localStorage.setItem(saveKeyFor(userId), JSON.stringify(minimal));
      return true;
    } catch (err2) {
      console.error("Local save failed:", err2);
      return false;
    }
  }
}

export function loadGame(userId) {
  try {
    const raw = localStorage.getItem(saveKeyFor(userId));
    if (raw) return JSON.parse(raw);
    // Saves made before per-user keys lived in a single shared slot. Only the
    // offline profile inherits it, so a signed-in account can never pick up
    // another person's career from it.
    if (!userId || userId === OFFLINE_USER) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      return legacy ? JSON.parse(legacy) : null;
    }
    return null;
  } catch (err) {
    console.error("Local save could not be read:", err);
    return null;
  }
}

/** ISO timestamp of when a save object was written, or null if unknown. */
export const savedAtOf = (saveObj) => saveObj?._savedAt || null;
