-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  username text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Teams (Global Read-Only reference data)
CREATE TABLE public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  base_performance integer,
  budget integer
);

-- 3. Drivers (Global Read-Only reference data)
CREATE TABLE public.drivers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  skill_level integer NOT NULL,
  salary integer NOT NULL,
  portrait_url text,
  team_id uuid REFERENCES public.teams(id) -- Optional relationship if drivers belong to default teams
);

-- 4. Races (Global Read-Only reference data)
CREATE TABLE public.races (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  track_image_url text,
  laps integer NOT NULL,
  season_order integer NOT NULL
);

-- 5. User Game State
CREATE TABLE public.user_game_state (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL UNIQUE,
  selected_team_id uuid REFERENCES public.teams(id),
  driver_1_id uuid REFERENCES public.drivers(id),
  driver_2_id uuid REFERENCES public.drivers(id),
  current_season integer DEFAULT 1,
  current_race_index integer DEFAULT 1,
  points integer DEFAULT 0,
  budget numeric DEFAULT 0,
  standings_position integer DEFAULT 1,
  car_upgrades jsonb DEFAULT '{}'::jsonb, -- Store dynamic upgrade progress 
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Race Results
CREATE TABLE public.race_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  race_id uuid REFERENCES public.races(id) NOT NULL,
  driver_id uuid REFERENCES public.drivers(id) NOT NULL,
  position integer NOT NULL,
  points_awarded integer NOT NULL,
  completion_time numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Ensure UUID extension is enabled (usually is by default on Supabase)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_results ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Global Data (Teams, Drivers, Races): Everyone can read, no one can insert/update (except Supabase admins)
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Anyone can view races" ON public.races FOR SELECT USING (true);

-- User Game State: Users can do full CRUD only on their own game state
CREATE POLICY "Users can view own game state" ON public.user_game_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own game state" ON public.user_game_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own game state" ON public.user_game_state FOR UPDATE USING (auth.uid() = user_id);

-- Race Results: Users can do full CRUD only on their own race results
CREATE POLICY "Users can view own race results" ON public.race_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own race results" ON public.race_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own race results" ON public.race_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own race results" ON public.race_results FOR DELETE USING (auth.uid() = user_id);

-- Create a Trigger to Automatically Add a Profile and Default State on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into Profiles
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  
  -- Insert a default User Game State
  INSERT INTO public.user_game_state (user_id)
  VALUES (new.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run handle_new_user when an auth.user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
