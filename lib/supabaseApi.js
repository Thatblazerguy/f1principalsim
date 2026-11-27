import { supabase } from './supabaseClient.js';
import { getSerializedState, state } from '../state.js';
import { saveGame, loadGame, compactSave } from '../utils/storage.js';

/**
 * =======================
 * AUTHENTICATION
 * =======================
 */

// Sign up a new user
export async function signUpUser(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      }
    }
  });
  return { data, error };
}

// Log in an existing user
export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

// Log out the current user
export async function logoutUser() {
  localStorage.removeItem("f1-play-offline");
  activeUserId = null;
  cloudLoadStatus = "unknown";
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Get the active session state
export async function getCurrentUserSession() {
  const isOffline = localStorage.getItem("f1-play-offline") === "true";
  if (isOffline) {
    return { session: { user: { id: "offline-user", email: "local@offline.com" } }, error: null };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session, error };
  } catch (err) {
    console.error("Supabase getSession failed, assuming no active cloud session:", err);
    return { session: null, error: err };
  }
}

/**
 * =======================
 * GAME STATE MANAGEMENT
 * =======================
 */

const OFFLINE_USER_ID = "offline-user";
const isOfflineMode = () => localStorage.getItem("f1-play-offline") === "true";

/**
 * Cloud writes are only allowed once we know what is in the cloud. If a load
 * failed (network error, paused database), writing would overwrite the
 * player's real save with whatever is in memory, e.g. a brand-new team.
 *   'unknown' – no load attempted yet
 *   'ok'      – load succeeded (save found or confirmed empty)
 *   'failed'  – load failed; cloud writes are blocked
 */
let cloudLoadStatus = "unknown";
let activeUserId = null;
let lastSaveResult = { ok: true, at: null, where: null, error: null };
const saveListeners = new Set();

export const getCloudLoadStatus = () => cloudLoadStatus;
export const getLastSaveResult = () => lastSaveResult;
/** Subscribe to save results (for a "Saved / Not saved" indicator). Returns an unsubscribe fn. */
export function onSaveResult(listener) {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}
function reportSave(result) {
  lastSaveResult = { ...result, at: new Date().toISOString() };
  saveListeners.forEach((fn) => { try { fn(lastSaveResult); } catch { /* ignore */ } });
}

const newer = (a, b) => (Date.parse(a || 0) || 0) > (Date.parse(b || 0) || 0);

/**
 * Load the current user's saved game.
 * Returns { data, error, status } where status is:
 *   'found'  – data.game_data holds the save
 *   'empty'  – the user genuinely has no save yet (safe to start a new career)
 *   'failed' – the save could not be read; do NOT start a new career over it
 */
export async function loadUserGameState() {
  if (isOfflineMode()) {
    activeUserId = OFFLINE_USER_ID;
    cloudLoadStatus = "ok";
    const localData = loadGame(OFFLINE_USER_ID);
    return { data: localData ? { game_data: localData } : null, error: null, status: localData ? "found" : "empty" };
  }

  let user = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    user = sessionData?.session?.user;
  } catch (err) {
    console.error("Supabase getSession failed:", err);
  }
  if (!user) {
    cloudLoadStatus = "failed";
    return { data: null, error: "Cannot load game: user not logged in", status: "failed" };
  }
  activeUserId = user.id;
  const localData = loadGame(user.id);

  try {
    const { data, error } = await supabase
      .from('user_game_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    cloudLoadStatus = "ok";

    const cloudSave = data?.game_data || null;
    // Prefer whichever copy was written last (e.g. a local save made while the
    // cloud was unreachable).
    if (localData && (!cloudSave || newer(localData._savedAt, data?.updated_at))) {
      return { data: { game_data: localData }, error: null, status: "found" };
    }
    if (cloudSave) return { data, error: null, status: "found" };
    return { data: null, error: null, status: "empty" };
  } catch (err) {
    console.error("Cloud load failed:", err);
    cloudLoadStatus = "failed";
    // This user's own local copy is still safe to play from; cloud writes stay
    // blocked until a later load succeeds.
    if (localData) return { data: { game_data: localData }, error: null, status: "found" };
    return { data: null, error: err?.message || String(err), status: "failed" };
  }
}

// Wrapper to continuously sync local state to the cloud safely via JSONB
export async function syncGame() {
  // Demo deep links (?screen=... in dev) use a throwaway team — never let it
  // overwrite the player's real local or cloud save.
  if (state.isDemo) {
    return { data: null, error: null, skipped: 'demo' };
  }
  const stateObj = compactSave(JSON.parse(getSerializedState())); // Supabase requires an object for JSONB

  const userId = isOfflineMode() ? OFFLINE_USER_ID : activeUserId;
  const localOk = saveGame(stateObj, userId);

  if (isOfflineMode()) {
    reportSave({ ok: localOk, where: "local", error: localOk ? null : "Browser storage is full" });
    return { data: { game_data: stateObj }, error: localOk ? null : "local save failed" };
  }

  if (cloudLoadStatus !== "ok") {
    reportSave({ ok: false, where: localOk ? "local" : null, error: "Cloud save paused: your cloud save could not be loaded" });
    return { data: null, error: "cloud writes blocked until the save loads", skipped: "load-failed" };
  }

  const res = await saveUserGameState({ game_data: stateObj });
  reportSave({ ok: !res.error, where: res.error ? (localOk ? "local" : null) : "cloud", error: res.error ? (res.error?.message || String(res.error)) : null });
  return res;
}

// Save/Update game progress
export async function saveUserGameState(updates) {
  if (isOfflineMode()) {
    const localData = loadGame(OFFLINE_USER_ID) || {};
    const merged = { ...localData, ...updates };
    saveGame(merged, OFFLINE_USER_ID);
    return { data: merged, error: null };
  }
  if (cloudLoadStatus !== "ok") {
    return { data: null, error: "Cloud save paused until the existing save has loaded" };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      return { data: null, error: 'Cannot save game: User not logged in' };
    }
    if (activeUserId && user.id !== activeUserId) {
      // The signed-in account changed under us; never write one career into another account.
      return { data: null, error: 'Cannot save game: account changed, reload to continue' };
    }

    const payload = {
      user_id: user.id,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // User RLS policy ensures they can only update their own row
    const { data, error } = await supabase
      .from('user_game_state')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error("[saveUserGameState] Cloud save failed:", error?.message || error);
    }
    return { data, error };
  } catch (err) {
    console.error("Supabase save failed with exception:", err);
    return { data: null, error: err };
  }
}

/**
 * =======================
 * REALTIME EXAMPLE
 * =======================
 */

// Listen to race result insertions in real-time (e.g. for a live multiplayer scoreboard)
export function subscribeToLiveRaceResults(callback) {
  const subscription = supabase
    .channel('public:race_results')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'race_results' }, payload => {
      callback(payload.new);
    })
    .subscribe();

  return subscription;
}
