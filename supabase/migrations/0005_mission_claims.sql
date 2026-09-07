-- Server-authoritative mission claims. Safe to re-run.
--
-- Problem this fixes: mission claim state previously lived only in
-- per-device AsyncStorage (src/lib/missions.ts), so the same mission could
-- be claimed for XP twice — once per device, or again after a reinstall.
-- This table + RPC make a claim atomic and enforced once per
-- (user, category, mission, period) regardless of device.

CREATE TABLE IF NOT EXISTS public.mission_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('daily', 'weekly')),
  mission_id TEXT NOT NULL,
  -- A stable key identifying the reset period this claim belongs to (e.g.
  -- '2026-09-07' for a daily mission, or the Monday date of the ISO week
  -- for a weekly one). Computed client-side to match missions.ts's existing
  -- (device-local-time-based) reset boundaries — the server doesn't need to
  -- know that logic, only that a new period_key means a fresh claim window.
  period_key TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category, mission_id, period_key)
);

ALTER TABLE public.mission_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own mission claims" ON public.mission_claims;
CREATE POLICY "Users can read their own mission claims" ON public.mission_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for any role: all writes go through
-- claim_mission() below (SECURITY DEFINER, bypasses RLS internally).

CREATE OR REPLACE FUNCTION public.claim_mission(
  p_category text,
  p_mission_id text,
  p_period_key text,
  p_reward_xp integer,
  p_display_name text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new_total bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_category NOT IN ('daily', 'weekly') THEN
    RAISE EXCEPTION 'Invalid category' USING ERRCODE = '22023';
  END IF;

  IF p_mission_id IS NULL OR length(trim(p_mission_id)) = 0
     OR p_period_key IS NULL OR length(trim(p_period_key)) = 0 THEN
    RAISE EXCEPTION 'Invalid mission or period key' USING ERRCODE = '22023';
  END IF;

  -- Claim first, award second: if this insert fails (already claimed this
  -- period on any device), the function aborts before any XP is granted —
  -- same transaction, so nothing partially applies.
  BEGIN
    INSERT INTO public.mission_claims (user_id, category, mission_id, period_key)
    VALUES (v_uid, p_category, p_mission_id, p_period_key);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Mission already claimed' USING ERRCODE = '23505';
  END;

  -- Reuses increment_leaderboard_score's own auth + bounds (1..2000)
  -- validation — one place enforces the cap, not two copies that could
  -- drift out of sync.
  v_new_total := public.increment_leaderboard_score(p_reward_xp, p_display_name);

  RETURN v_new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mission(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_mission(text, text, text, integer, text) TO authenticated;
