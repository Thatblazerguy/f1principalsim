-- Run this snippet in your Supabase SQL Editor to add the unified save container.
ALTER TABLE public.user_game_state 
ADD COLUMN IF NOT EXISTS game_data jsonb DEFAULT '{}'::jsonb;
