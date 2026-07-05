-- ============================================================
-- F1 Manager Save Patch — run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add the unified game_data JSONB column (safe, idempotent)
ALTER TABLE public.user_game_state 
ADD COLUMN IF NOT EXISTS game_data jsonb DEFAULT '{}'::jsonb;

-- 2. Fix RLS: Supabase upsert needs BOTH INSERT + UPDATE policies.
--    The original schema only had INSERT + UPDATE but the upsert
--    path can hit a 500 if the UPDATE policy isn't covering all cases.
--    Drop and recreate all policies for user_game_state cleanly.

DROP POLICY IF EXISTS "Users can view own game state"   ON public.user_game_state;
DROP POLICY IF EXISTS "Users can insert own game state" ON public.user_game_state;
DROP POLICY IF EXISTS "Users can update own game state" ON public.user_game_state;

CREATE POLICY "Users can view own game state"
  ON public.user_game_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game state"
  ON public.user_game_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game state"
  ON public.user_game_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Ensure updated_at column exists (older installs may be missing it)
ALTER TABLE public.user_game_state
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
