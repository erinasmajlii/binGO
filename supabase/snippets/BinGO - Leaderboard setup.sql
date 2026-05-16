-- Leaderboard table and RLS (safe to re-run in SQL Editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.leaderboard_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  display_name TEXT,
  total_points BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Required for app upsert: onConflict: "user_id"
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_scores_user_id
  ON public.leaderboard_scores (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select ON public.leaderboard_scores;
CREATE POLICY anon_select ON public.leaderboard_scores
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS auth_insert_own_score ON public.leaderboard_scores;
CREATE POLICY auth_insert_own_score ON public.leaderboard_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS auth_update_own_score ON public.leaderboard_scores;
CREATE POLICY auth_update_own_score ON public.leaderboard_scores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.leaderboard_scores (user_id, display_name, total_points)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    0
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_leaderboard ON auth.users;
CREATE TRIGGER on_auth_user_created_leaderboard
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_leaderboard();

INSERT INTO public.leaderboard_scores (user_id, display_name, total_points)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ),
  0
FROM auth.users u
LEFT JOIN public.leaderboard_scores l ON u.id = l.user_id
WHERE l.user_id IS NULL
ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

-- Demo rows with fixed ids (no duplicates on re-run)
INSERT INTO public.leaderboard_scores (id, display_name, total_points)
VALUES
  ('11111111-1111-4111-8111-111111111101'::UUID, 'Alice', 1200),
  ('11111111-1111-4111-8111-111111111102'::UUID, 'Bob', 900),
  ('11111111-1111-4111-8111-111111111103'::UUID, 'Carol', 800)
ON CONFLICT (id) DO NOTHING;

-- Verify:
-- SELECT display_name, total_points FROM public.leaderboard_scores ORDER BY total_points DESC LIMIT 3;
