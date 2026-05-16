Setup instructions for Supabase (project: `tacrqjndguhlbsugxbal`)

Run these in **SQL Editor** in order (each file is safe to re-run):

1. `bins.sql` — bins table + RLS
2. `leaderboard.sql` — leaderboard table + RLS
3. `cleanup_leaderboard_duplicates.sql` — removes duplicate Alice/Bob/Carol rows
4. `display_exp_view.sql` — user EcoXP view
5. `realtime.sql` — realtime for bins + leaderboard
6. `upsert_user_score.sql` — add/update one user (edit UUID/name/points)

**Do not** use old saved queries in the dashboard if they contain typos like `asSELECT`, `uescapeLEFT JOIN`, or duplicated `CREATE VIEW` blocks.

### SQL Editor sidebar (one-time cleanup)

Supabase API cannot delete/create saved queries from CLI. In the dashboard SQL Editor sidebar, delete these **old** private snippets (broken copies):

- User EcoXP Display View (both duplicates)
- User EcoXP and Display Names View
- Fetch Users with EcoXP Leaderboard Points
- Retrieve Registered Users
- Leaderboard Top Scorers Ranking
- Add Tables to Realtime Publication
- Leaderboard Scores Table Setup
- Bins table with public RLS policies
- Bins table with geospatial indexing and public RLS policies

Then create **New query** for each file in `supabase/snippets/` (copy/paste content, save with the same filename).

Or run everything from terminal: `npm run supabase:setup`

---

Legacy note (older project ref `kslmzthdojxsbbqblrgs`):

1) Open Supabase dashboard for your project.
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
