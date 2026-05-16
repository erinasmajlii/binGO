-- Remove duplicate demo rows (Alice/Bob/Carol inserted twice by old scripts).
-- Safe to re-run.

DELETE FROM public.leaderboard_scores
WHERE user_id IS NULL
  AND display_name IN ('Alice', 'Bob', 'Carol')
  AND id NOT IN (
    '11111111-1111-4111-8111-111111111101'::UUID,
    '11111111-1111-4111-8111-111111111102'::UUID,
    '11111111-1111-4111-8111-111111111103'::UUID
  );

-- Verify (expect one row per name):
-- SELECT display_name, total_points, user_id
-- FROM public.leaderboard_scores
-- ORDER BY total_points DESC;
