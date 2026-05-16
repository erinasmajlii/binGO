-- Add or update one user on the leaderboard (safe to re-run).
-- Replace user_id, display_name, and total_points as needed.

INSERT INTO public.leaderboard_scores (user_id, display_name, total_points)
VALUES (
  'fc324f85-0fce-444a-997d-e9e9a056af30'::UUID,
  'At',
  10000
)
ON CONFLICT (user_id) WHERE user_id IS NOT NULL
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  total_points = EXCLUDED.total_points,
  updated_at = NOW();
