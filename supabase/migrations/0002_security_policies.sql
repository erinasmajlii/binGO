-- Security hardening pass. Safe to re-run.
--
-- Fixes applied here (see RELEASE_NOTES.md / audit history for context):
--
--  S1 (Critical) display_exp leaked every user's email with no RLS.
--      Fix: view no longer selects auth.users.email at all.
--
--  S2 (Critical) bins RLS allowed ANY client (including anonymous) to
--      insert/update/delete ANY row — the whole shared map could be
--      wiped or vandalized by one bad actor.
--      Fix: SELECT stays public (the map is meant to be publicly viewable),
--      but INSERT/UPDATE/DELETE now require authentication, and
--      UPDATE/DELETE are restricted to the row's owner (bins.created_by,
--      which is set server-side by the trigger in 0001_schema.sql and can
--      never be spoofed by the client).
--
--  S3 (High) leaderboard_scores.total_points was directly writable by the
--      client with no bound — any authenticated user could set their own
--      score to an arbitrary value.
--  S4 (High) XP increments were a non-atomic client-side read-modify-write,
--      which could lose XP under concurrent writes (two devices, retries).
--      Fix (both): direct client INSERT/UPDATE on leaderboard_scores is
--      revoked entirely. All XP writes now go through
--      increment_leaderboard_score(), a SECURITY DEFINER RPC that does a
--      single atomic `UPDATE ... SET total_points = total_points + $1`
--      (via INSERT ... ON CONFLICT DO UPDATE), requires auth.uid(), and
--      rejects any amount outside 1..2000 (the largest legitimate single
--      reward is the "Area mapper" weekly mission at 2000 XP).

-- ────────────────────────────────────────────────────────────────────────
-- bins policies
-- ────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow public read access on bins" ON public.bins;
CREATE POLICY "Allow public read access on bins" ON public.bins
  FOR SELECT
  TO public
  USING (TRUE);

-- Anonymous/unauthenticated policies from the old schema are gone. Only
-- "authenticated" has any INSERT/UPDATE/DELETE policy now, so anon writes
-- are denied by default (no matching policy = denied under RLS).
DROP POLICY IF EXISTS "Allow public insert on bins" ON public.bins;
DROP POLICY IF EXISTS "Authenticated users can insert bins" ON public.bins;
CREATE POLICY "Authenticated users can insert bins" ON public.bins
  FOR INSERT
  TO authenticated
  -- created_by is forced to auth.uid() server-side by trigger_set_bin_created_by;
  -- nothing client-supplied here needs checking.
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public delete on bins" ON public.bins;
DROP POLICY IF EXISTS "Owners can delete their own bins" ON public.bins;
CREATE POLICY "Owners can delete their own bins" ON public.bins
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Allow public update on bins" ON public.bins;
DROP POLICY IF EXISTS "Owners can update their own bins" ON public.bins;
CREATE POLICY "Owners can update their own bins" ON public.bins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ────────────────────────────────────────────────────────────────────────
-- leaderboard_scores policies
-- ────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS anon_select ON public.leaderboard_scores;
CREATE POLICY anon_select ON public.leaderboard_scores
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Direct client writes are revoked entirely. Row creation happens via the
-- on_auth_user_created_leaderboard trigger (0001_schema.sql); score updates
-- happen only via increment_leaderboard_score() below. Dropping these
-- policies leaves leaderboard_scores with NO insert/update policy for
-- anon/authenticated, so RLS denies all direct writes from the client.
DROP POLICY IF EXISTS auth_insert_own_score ON public.leaderboard_scores;
DROP POLICY IF EXISTS auth_update_own_score ON public.leaderboard_scores;

CREATE OR REPLACE FUNCTION public.increment_leaderboard_score(
  p_amount integer,
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
  v_max_amount CONSTANT integer := 2000; -- largest legitimate single reward (weekly "Area mapper" mission)
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_max_amount THEN
    RAISE EXCEPTION 'Invalid amount: must be between 1 and %', v_max_amount USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.leaderboard_scores (user_id, display_name, total_points, updated_at)
  VALUES (v_uid, NULLIF(TRIM(COALESCE(p_display_name, '')), ''), p_amount, NOW())
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL
  DO UPDATE SET
    total_points = public.leaderboard_scores.total_points + EXCLUDED.total_points,
    display_name = COALESCE(EXCLUDED.display_name, public.leaderboard_scores.display_name),
    updated_at = NOW()
  RETURNING total_points INTO v_new_total;

  RETURN v_new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_leaderboard_score(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_leaderboard_score(integer, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- display_exp view — PII fix
-- ────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.display_exp;

CREATE VIEW public.display_exp AS
SELECT
  u.id AS user_id,
  COALESCE(l.total_points, 0) AS ecoxp,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ) AS display_name
  -- u.email intentionally NOT selected (was the S1 PII leak — any client
  -- with the anon key could previously read every user's real email).
FROM auth.users u
LEFT JOIN public.leaderboard_scores l ON u.id = l.user_id;
