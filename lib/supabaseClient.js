import { createClient } from '@supabase/supabase-js';

// Supabase URL and Key are now loaded from the .env file via Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Please check your environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).");
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : {
      auth: { 
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
        signUp: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
        signOut: async () => ({ error: null })
      },
      from: () => ({ 
        select: () => ({ 
          eq: () => ({ 
            single: async () => ({ data: null, error: null }) 
          }),
          single: async () => ({ data: null, error: null })
        }),
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: null })
          })
        })
      }),
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) })
    };
