Setup instructions to create `leaderboard_scores` in Supabase

1) Open Supabase dashboard for your project (Project ref: kslmzthdojxsbbqblrgs).
2) Go to "SQL Editor" and paste the contents of `supabase_setup/leaderboard.sql` then Run.

3) Verify results in SQL Editor with:

```sql
SELECT display_name, total_points
FROM public.leaderboard_scores
ORDER BY total_points DESC
LIMIT 3;
```

4) Ensure your project has environment variables set in your app (example `.env` or Expo env):

- `EXPO_PUBLIC_SUPABASE_URL` = https://kslmzthdojxsbbqblrgs.supabase.co
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = (your publishable anon key)

5) Quick REST check (use your publishable key; do not share key publicly):

```bash
curl -H "apikey: YOUR_PUBLISHABLE_KEY" \
     -H "Authorization: Bearer YOUR_PUBLISHABLE_KEY" \
     "https://kslmzthdojxsbbqblrgs.supabase.co/rest/v1/leaderboard_scores?select=display_name,total_points&order=total_points.desc&limit=3"
```

6) If the REST call returns `PGRST205` (table not found) or similar, ensure you've executed the SQL above.
7) If the REST call returns an empty array but SQL editor shows rows, check Row Level Security (RLS) and policies — ensure the `anon_select` policy exists as created in the SQL file.

If you'd like, after you run the SQL I can re-run the local check for Top-3 and then verify the app UI.
