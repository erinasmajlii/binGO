-- binGO canonical schema baseline.
-- Safe to re-run (idempotent) against a fresh project OR the existing production
-- project — running this brings either one to the current desired schema state.
--
-- This file supersedes and consolidates the old supabase_setup/ and
-- supabase/snippets/ manual SQL-editor scripts, which have been removed.
-- See supabase/README.md for how to apply migrations.

-- ────────────────────────────────────────────────────────────────────────
-- bins: shared public map markers
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bins (
  id TEXT PRIMARY KEY,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('current', 'manual')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Column may already exist from the pre-migration schema; safe to re-run.
ALTER TABLE public.bins ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bins_created_at ON public.bins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bins_created_by ON public.bins (created_by);

ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_bins_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_bins_updated_at ON public.bins;
CREATE TRIGGER trigger_update_bins_updated_at
  BEFORE UPDATE ON public.bins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bins_updated_at();

-- Server-assigned ownership: the client can never set/spoof created_by.
-- This is what makes the owner-only UPDATE/DELETE policies in
-- 0002_security_policies.sql meaningful.
CREATE OR REPLACE FUNCTION public.set_bin_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_bin_created_by ON public.bins;
CREATE TRIGGER trigger_set_bin_created_by
  BEFORE INSERT ON public.bins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bin_created_by();

-- ────────────────────────────────────────────────────────────────────────
-- leaderboard_scores: per-user EcoXP total
-- ────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.leaderboard_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  display_name TEXT,
  total_points BIGINT DEFAULT 0 CHECK (total_points >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_scores_user_id
  ON public.leaderboard_scores (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.leaderboard_scores ENABLE ROW LEVEL SECURITY;

-- Auto-create a leaderboard row (0 points) whenever a new auth user signs up.
-- SECURITY DEFINER: bypasses RLS, which is fine — it only ever inserts a
-- fresh zero-point row keyed to the newly-created user's own id.
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

-- Backfill leaderboard rows for any existing auth user who doesn't have one yet.
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

-- ────────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bins;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard_scores;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
