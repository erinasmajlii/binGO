-- Supabase Database setup for Missions and XP tracking.
-- Run this whole script in your Supabase SQL Editor exactly once.

-- 1. Recreate the users table correctly with UUID so it matches Supabase Auth
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  points INT DEFAULT 0,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  images_reported INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the missions table
CREATE TABLE IF NOT EXISTS public.missions (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
    reward_xp INT NOT NULL
);

-- 3. Clear existing missions to avoid duplicates if re-run
TRUNCATE TABLE public.missions CASCADE;

-- 4. Insert 6 unique missions (3 daily, 3 weekly)
INSERT INTO public.missions (title, description, type, reward_xp) VALUES
('Spot & report 1 trash pile', 'Capture one clear photo of litter in your area.', 'daily', 150),
('Pick up 3 pieces of litter', 'Safely pick up and dispose of at least 3 pieces of litter today.', 'daily', 150),
('Use a reusable bottle', 'Instead of buying a plastic bottle, use a reusable one today.', 'daily', 150),

('5 verified cleanups', 'Complete five verified cleanup missions this week.', 'weekly', 500),
('Recycle 10 items', 'Find and recycle 10 different items (plastic, paper, or glass).', 'weekly', 500),
('Zero waste day', 'Go one full day without producing any non-recyclable non-compostable waste.', 'weekly', 500);

-- 5. Create user_missions tracking table
CREATE TABLE IF NOT EXISTS public.user_missions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    mission_id INT REFERENCES public.missions(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, mission_id) -- A user can only complete a specific mission once (or we can expand this later for reset logic)
);

-- 6. Setup Auth Trigger (if it doesn't already exist)
-- This automatically inserts a row into public.users when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, points, xp, level)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'name',
    0, 
    0, 
    1
  ) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to recreate safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
