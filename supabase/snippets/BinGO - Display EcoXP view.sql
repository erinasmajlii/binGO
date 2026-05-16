-- User EcoXP + display name view (safe to re-run)

DROP VIEW IF EXISTS public.display_exp;

CREATE VIEW public.display_exp AS
SELECT
  u.id AS user_id,
  COALESCE(l.total_points, 0) AS ecoxp,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ) AS display_name,
  u.email
FROM auth.users u
LEFT JOIN public.leaderboard_scores l ON u.id = l.user_id;

-- Test:
-- SELECT * FROM public.display_exp ORDER BY ecoxp DESC;
