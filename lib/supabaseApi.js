import { supabase } from './supabaseClient.js';
import { getSerializedState } from '../state.js';

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
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Get the active session state
export async function getCurrentUserSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session, error };
}

/**
 * =======================
 * GAME STATE MANAGEMENT
 * =======================
 */

// Load the current user's saved game progress
export async function loadUserGameState() {
  // 1. Get current logged-in user
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    return { data: null, error: 'Cannot load game: User not logged in' };
  }

  // 2. Fetch their unique row from user_game_state table
  // We use simple select('*') now because their entire rich state is natively inside the game_data payload
  const { data, error } = await supabase
    .from('user_game_state')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error("DEBUG loadUserGameState error:", error);
  }
  return { data, error };
}

// Wrapper to continuously sync local state to the cloud safely via JSONB
export async function syncGame() {
  const jsonString = getSerializedState();
  const stateObj = JSON.parse(jsonString); // Supabase requires an object for JSONB
  const res = await saveUserGameState({ game_data: stateObj });
  if (res.error) {
    console.error("DEBUG syncGame error:", res.error);
    alert("Save Failed! Did you run the f1_save_patch.sql script in Supabase?");
  }
  return res;
}

// Save/Update game progress
export async function saveUserGameState(updates) {
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
  // We use upsert with onConflict user_id in case the initial signup trigger failed to populate the row for older users
  const { data, error } = await supabase
    .from('user_game_state')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error("DEBUG saveUserGameState error:", error);
  }
  return { data, error };
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
