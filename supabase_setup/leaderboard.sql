-- Supabase: Create leaderboard_scores table and policies

-- Enable the pgcrypto extension for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard_scores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  display_name text,
  total_points bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security if you plan to use anon/public keys
ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

-- Allow anonymous SELECTs (read) from the table
CREATE POLICY anon_select ON public.leaderboard_scores
  FOR SELECT
  TO anon
  USING (true);

-- OPTIONAL: allow authenticated users to upsert their own score (adjust logic to your app)
-- CREATE POLICY auth_upsert ON public.leaderboard_scores
--   FOR INSERT, UPDATE
--   TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- Insert sample rows for testing
INSERT INTO public.leaderboard_scores (display_name, total_points)
VALUES
  ('Alice', 1200),
  ('Bob', 900),
  ('Carol', 800)
ON CONFLICT DO NOTHING;

-- Run the following check (in Supabase SQL editor) to confirm:
-- SELECT display_name, total_points FROM public.leaderboard_scores ORDER BY total_points DESC LIMIT 3;
