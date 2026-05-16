-- Fix display name in auth (Profile + Supabase Users table)
-- Replace USER_ID and 'Art' as needed.

UPDATE auth.users
SET raw_user_meta_data = (
  COALESCE(raw_user_meta_data, '{}'::jsonb)
  - 'Art'
  - 'ecoXP'
) || jsonb_build_object(
  'name', 'Art',
  'full_name', 'Art'
)
WHERE id = 'fc324f85-0fce-444a-997d-e9e9a056af30';

UPDATE public.leaderboard_scores
SET display_name = 'Art', updated_at = NOW()
WHERE user_id = 'fc324f85-0fce-444a-997d-e9e9a056af30';
