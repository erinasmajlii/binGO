-- Add referential integrity between leaderboard_scores.user_id and auth.users.
-- Safe to re-run. NPC/demo rows use user_id IS NULL and are unaffected by
-- FK checks. Confirmed zero orphaned rows before this migration was written.
--
-- ON DELETE CASCADE: if a real user's auth account is ever deleted, their
-- leaderboard row is cleaned up automatically instead of becoming a
-- permanent ghost entry with a stale display name.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_scores_user_id_fkey'
  ) THEN
    ALTER TABLE public.leaderboard_scores
      ADD CONSTRAINT leaderboard_scores_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
