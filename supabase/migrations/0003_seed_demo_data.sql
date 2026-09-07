-- Optional demo/seed data. Safe to re-run. Skip this file entirely for a
-- clean production project with no demo content.

INSERT INTO public.bins (id, latitude, longitude, source) VALUES
  ('bin-demo-1', 41.3275, 19.8187, 'current'),
  ('bin-demo-2', 41.3278, 19.8190, 'manual'),
  ('bin-demo-3', 41.3272, 19.8184, 'current')
ON CONFLICT (id) DO NOTHING;

-- Demo leaderboard rows with fixed ids (user_id IS NULL — these are not
-- real accounts, so the owner-only bins policies and the leaderboard RPC's
-- auth.uid() check never apply to them; they're purely cosmetic reference
-- rows for local development).
INSERT INTO public.leaderboard_scores (id, display_name, total_points)
VALUES
  ('11111111-1111-4111-8111-111111111101'::UUID, 'Alice', 1200),
  ('11111111-1111-4111-8111-111111111102'::UUID, 'Bob', 900),
  ('11111111-1111-4111-8111-111111111103'::UUID, 'Carol', 800)
ON CONFLICT (id) DO NOTHING;
