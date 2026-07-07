import { supabase } from './supabaseClient.js';
import { getSerializedState } from '../state.js';
import { saveGame, loadGame } from '../utils/storage.js';

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

// Load the current user's saved game progress
export async function loadUserGameState() {
  const isOffline = localStorage.getItem("f1-play-offline") === "true";
  if (isOffline) {
    const localData = loadGame();
    return { data: localData ? { game_data: localData } : null, error: null };
  }

  try {
    // 1. Get current logged-in user
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      return { data: null, error: 'Cannot load game: User not logged in' };
    }

    // 2. Fetch their unique row from user_game_state table
    const { data, error } = await supabase
      .from('user_game_state')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error("DEBUG loadUserGameState error:", error);
      // Fallback to local storage if supabase returns an error (e.g. paused DB)
      const localData = loadGame();
      if (localData) {
        console.log("Supabase error. Loaded fallback game from localStorage.");
        return { data: { game_data: localData }, error: null };
      }
    }
    return { data, error };
  } catch (err) {
    console.error("Supabase load failed with exception, falling back to localStorage:", err);
    const localData = loadGame();
    return { data: localData ? { game_data: localData } : null, error: null };
  }
}

// Wrapper to continuously sync local state to the cloud safely via JSONB
export async function syncGame() {
  const jsonString = getSerializedState();
  const stateObj = JSON.parse(jsonString); // Supabase requires an object for JSONB
  
  // Always write a local backup to localStorage on every sync!
  try {
    saveGame(stateObj);
  } catch (err) {
    console.error("Failed to write local backup save:", err);
  }

  const isOffline = localStorage.getItem("f1-play-offline") === "true";
  if (isOffline) {
    return { data: { game_data: stateObj }, error: null };
  }

  const res = await saveUserGameState({ game_data: stateObj });
  if (res.error) {
    console.log("[syncGame] Could not save to cloud:", res.error?.message || res.error);
  }
  return res;
}

// Save/Update game progress
export async function saveUserGameState(updates) {
  const isOffline = localStorage.getItem("f1-play-offline") === "true";
  if (isOffline) {
    const localData = loadGame() || {};
    const merged = { ...localData, ...updates };
    saveGame(merged);
    return { data: merged, error: null };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      return { data: null, error: 'Cannot save game: User not logged in' };
    }

    // Ensure updated_at is refreshed
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
      console.log("[saveUserGameState] Cloud save failed:", error?.message || error);
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
