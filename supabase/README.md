# Database setup

`supabase/migrations/` is the **one canonical** source of schema for this project. Apply the files in order — each is idempotent (safe to re-run).

| File | Purpose |
|---|---|
| `0001_schema.sql` | Tables (`bins`, `leaderboard_scores`), indexes, triggers |
| `0002_security_policies.sql` | RLS policies, the `increment_leaderboard_score` RPC, the `display_exp` view |
| `0003_seed_demo_data.sql` | Optional demo bins + demo leaderboard rows — skip for a clean production project |

## Applying migrations

**Supabase CLI (recommended):**

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

**Manual (SQL Editor):** open each file in order in the Supabase dashboard's SQL Editor and run it.

## Why this replaced `supabase_setup/` and `supabase/snippets/`

Those two folders held hand-maintained, duplicate copies of the same schema (meant to be pasted into the SQL Editor one file at a time) and have been removed. `supabase/migrations/` is now the only source of truth — see `RELEASE_NOTES.md` git history if you need the old files for reference.

One historical, one-off **data** patch is *not* part of the migrations (data patches for a specific real account aren't reproducible schema and shouldn't be silently re-applied by anyone who runs the migrations): a script that set one specific user's leaderboard score to 10,000 points. That was a manual admin action already applied directly to the production database; it isn't schema and won't be reapplied by these migrations.

## Design notes

- **`bins`**: publicly readable (the map is meant to be seen by everyone, including signed-out users), but INSERT/UPDATE/DELETE require authentication, and UPDATE/DELETE are restricted to the row's owner via `created_by` (set server-side by a trigger — the client cannot spoof it). This means **signed-out users can view the map but cannot add or remove bins.**
- **`leaderboard_scores`**: publicly readable. The client can no longer write to this table directly — all XP writes go through `increment_leaderboard_score(p_amount, p_display_name)`, a `SECURITY DEFINER` RPC that requires `auth.uid()`, does one atomic `total_points += p_amount`, and rejects any amount outside 1–2000.
- **`display_exp`**: a read-only view combining `auth.users` + `leaderboard_scores` for EcoXP/display-name lookups. It intentionally does **not** select `auth.users.email` — an earlier version did, which leaked every user's email to any client holding the public anon key.
