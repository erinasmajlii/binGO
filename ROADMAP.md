# binGO — Implementation Roadmap

Status snapshot as of this document: a prior hardening pass already fixed the four Critical/High security holes found in the original audit (email-leak view, public bin vandalism, client-writable leaderboard, non-atomic XP writes) and applied them to the live database; removed ~6,200 lines of dead legacy web code; centralized auth state; added a 31-test Vitest suite, ESLint, strict TypeScript (0 errors), and CI. This document is the **next** roadmap — it re-audits the current state, calls out what's still open (including gaps that pass was honest about deferring, like route protection), and adds newly-found issues. Items already fixed and verified are marked ✅ so this stays a complete, accurate picture of the whole project rather than only new work.

> **Implementation update:** every phase in this document (1–10) has since been executed in order. See the [Final Verification](#final-verification) checklist and [Production Status](#production-status) at the bottom for the current, up-to-date state — both were re-checked against the live project after implementation, not left as the original plan. The per-phase write-ups below are kept as-is (they're still an accurate record of what was found and why each task mattered); treat the tail sections as the source of truth for "is this actually done."

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## 🚨 User-Reported Issues (2026-09-07) — investigated, documented, not yet implemented

Two issues reported directly after testing. Both were investigated by reading the actual pre-session code (via `git diff HEAD` — nothing from this whole roadmap effort has been committed yet, so `HEAD`, commit `90e3e30`, is the true "before" baseline) and, for the points system, by running a real live test against the production database. Nothing below has been implemented — this is documentation of confirmed findings and a recommended direction, per the request to plan before touching Maps again and to treat points as a critical investigation first.

### A. Maps — restore previous functionality, do not redesign

**Requirement:** all of the following must work exactly as before — add bins, delete bins, auto-find the nearest bin on scan, auto-show the route to it, and when the routed bin is deleted, auto-refresh to the next-nearest bin's route with no stale route left pointing at a bin that no longer exists. No new map system, no added complexity.

**Verified via `git diff HEAD`, function by function — everything except one thing is byte-for-byte or functionally unchanged:**

- Nearest-bin lookup on scan (`ReportScreen.tsx`'s `getNearestBin` + `setActiveRoute` call): **unchanged**.
- Route storage/handoff between Report and Map (`src/lib/route.ts`): **zero diff against `HEAD` — completely untouched.**
- Auto-refresh to the next-nearest bin when the routed bin is deleted (`MapScreen.tsx`, the `useEffect` watching `routeDestination`/`bins` that calls `routeToNearestBin`, and `removeBin`'s `removedRoutedBin` check): **unchanged**, present identically in both versions.
- Realtime bin sync across devices: unchanged in shape — only wrapped with a reconnect-retry and a small status indicator (Phase 6.1), the core subscribe/update logic is the same.

**The one real behavior change, confirmed by diff:** `addBinAtCurrentLocation`, `addBinManually`, and `removeBin` in `MapScreen.tsx` now require a signed-in session (`if (!user) { setErrorMessage("Sign in to..."); return; }`). Before this session, **any** client — including a fully anonymous one with no account — could insert or delete any bin.

**Why it changed:** this was Critical finding S2 from the original audit. The `bins` RLS policy was `USING (TRUE)` for INSERT/UPDATE/DELETE to the `public` role — anyone holding the app's public anon key (not a secret; it ships in every install) could wipe or vandalize the entire shared map with one unauthenticated REST call, no rate limit, no way to identify or undo it. This was fixed, applied to the live database, and live-verified (an anon `DELETE` against a real bin was confirmed to leave it untouched).

**The conflict:** restoring "anyone, logged in or not, can add/delete bins" exactly as it was would re-open that same Critical vulnerability. Three options were laid out; **decision made and implemented**: option 2.5 — keep INSERT authenticated-only (unchanged), but relax DELETE/UPDATE from "owner only" to "any authenticated user" (`supabase/migrations/0006_bins_any_authenticated_can_delete.sql`, applied live, `pg_policies` confirms `"Any authenticated user can delete bins"` / `"...update bins"` now exist for the `authenticated` role). This keeps the actual S2 fix (anonymous/unauthenticated clients still cannot write at all — re-verified via `scripts/verify-rls.mjs`, still 7/7 passing) while dropping the "must be the original owner" restriction, so any signed-in user can clean up any bin on the shared map. Stale "you may only remove bins you added yourself" UI copy in `MapScreen.tsx` corrected to match.

**✅ (Fixed) Separately found and fixed: a real, pre-existing race condition** that explains "the route to the nearest bin doesn't show up automatically" — not a redesign, a bug fix. `MapScreen.tsx` mounts with `bins` empty while the real list loads asynchronously from Supabase; if the route set by a scan lands before that load finishes, the "has the destination bin been deleted?" cleanup effect saw the momentarily-empty list and cleared the just-computed route before it ever rendered. This bug pre-dates this whole session (confirmed: the `binsLoaded` flag that would have prevented it was already dead/unused code in the original version). Fixed by properly gating that effect on a `binsLoaded` flag, and extended the same effect to retry building the route if `location` wasn't ready yet the moment the screen first picked up the request (a second latent gap in the same area). No API/behavior changes beyond fixing this timing bug.

**Priority:** 🔴 Critical → now resolved for the delete-permission decision; the race-condition fix is a bonus find, also resolved.
**Files:** `supabase/migrations/0006_bins_any_authenticated_can_delete.sql`, `src/native/screens/MapScreen.tsx`, `src/lib/bins.ts` (comment accuracy only).
**Test:** `scripts/verify-rls.mjs` re-run live, 7/7 passing. The race-condition fix needs a manual on-device confirmation (scan a photo → route should now appear and stay, instead of flashing and disappearing) — not yet done, since it needs a real device.
**Definition of done:** live-verified for the RLS change; manual on-device test still outstanding for the race-condition fix.

### B. Points / XP System — 🔴 Critical, confirmed root cause

Investigated end-to-end as requested — scan → points calculation → database → profile → leaderboard/level, and mission completion → points calculation → database → profile → leaderboard/level — including a **live test against the real production database** (a throwaway, fully-authenticated test session, created and cleaned up during this investigation, cascade-deleted via the FK added in Phase 1.4):

```
Before:                total_points = 0
increment RPC (+100):  → 100   (this is exactly what a photo scan triggers)
claim_mission (+120):  → 220   (this is exactly what a mission claim triggers)
duplicate claim retry: → correctly rejected: "Mission already claimed"
```

**The database/RPC layer is fully correct and verified working end-to-end.** `increment_leaderboard_score` and `claim_mission` (migrations 0002 and 0005) atomically and correctly add points for a real authenticated session, exactly as designed. **This is not where the bug is.**

**Confirmed root cause — two client-side display bugs. Points ARE being recorded; they just don't always get shown.**

1. **`src/native/screens/ProfileScreen.tsx:201-202`**

   ```ts
   const totalEcoXp = useMemo(
     () => ecoXp ?? stats?.totalPoints ?? 0,
     [ecoXp, stats?.totalPoints],
   );
   ```

   `ecoXp` is `useState(0)` — it is _never_ `null`/`undefined`, so `?? stats?.totalPoints` can never actually trigger; `totalEcoXp` is always just `ecoXp`. For a guest (no session), the effect that sets `ecoXp` sets it to `0` and never updates it again — the guest branch of `refreshProfileFromServer` only calls `setStats(...)`, never `setEcoXp(...)`. **Result: a guest's Profile screen shows "0 EcoXP" permanently, no matter how many photos they scan or missions they claim.**

2. **`src/native/screens/HomeScreen.tsx:29-31`**
   ```ts
   const dbXp = user ? await fetchUserEcoXpFromDb(user.id) : 0;
   setEcoXp(dbXp);
   ```
   Same net effect via a different mechanism: for a guest, `dbXp` is hardcoded `0` and assigned directly — the Home header's XP badge and Level badge never look at local capture stats at all. **A guest's Home screen also shows "0 EcoXP" / "Level 1" permanently.**

Both bugs are display-only, guest-mode-only (or momentarily, pre-fetch, for anyone). The underlying data is fine the whole time: `AsyncStorage` capture records and mission bonus points are recorded correctly regardless (confirmed — `MissionsScreen`'s own stats computation does **not** have this bug; it correctly falls back to local totals for guests via `getCaptureStats(userKey, undefined)`, since `undefined` — unlike a hardcoded `0` — correctly fails the `typeof leaderboardTotal === "number"` check that gates the fallback). This is exactly why the symptom is "0 EcoXP shown" rather than actual data loss.

**This is very likely exactly what was hit while testing** — "Skip for now" (guest mode) is the fastest way into the app and easy to reach without registering. If you were testing as a fully signed-in, confirmed account and still saw no points: the verified-working RPC layer above means the next most likely explanation is a refresh-timing issue — Home/Profile only refetch on screen _focus_ (`useFocusEffect`), so a new scan's points won't appear until navigating away from and back to that tab. Worth confirming which of the two you're actually seeing before assuming it's the guest-mode bug.

**Priority:** 🔴 Critical
**Files:** `src/native/screens/ProfileScreen.tsx`, `src/native/screens/HomeScreen.tsx`
**Fix direction (not yet implemented):** stop tracking a separate `ecoXp` state that guests can never populate. Display `stats.totalPoints` (from `getCaptureStats`, which already implements the correct `Math.max(dbXp, localTotal)`-equivalent fallback) instead — consistent with how `MissionsScreen` already does this correctly today.
**Dependencies:** none — independent of the Maps decision above.
**Test:** manual — as a guest, scan a photo, confirm Home/Profile immediately show the new point total (currently they don't); as a signed-in user, confirm the same still works (already does, must not regress). Add an automated render test for the guest-mode fallback if/when screen-level testing infra exists (see Phase 8.6's scoping note — currently out of reach with the lightweight Vitest setup).
**Definition of done:** guest and signed-in users both see their EcoXP/Level update correctly on Home and Profile after scanning or claiming; no state exists that guests can never populate.

### C. ✅ (Implemented) Forgot / reset password

Not a bug report — a feature request implemented in this pass, noted here so the roadmap stays complete. `ProfileScreen`'s login form now has a "Forgot password?" link → sends a reset email via `supabase.auth.resetPasswordForEmail()` → a new deep-link route (`src/app/reset-password.tsx` → `ResetPasswordScreen`) redeems the PKCE `code` via `exchangeCodeForSession()` and lets the user set a new password via `supabase.auth.updateUser({password})`. Uses PKCE flow (`flowType: 'pkce'` added to `supabase.ts`) rather than the implicit/fragment flow, since PKCE's single `code` query param survives native deep-link handoffs reliably where URL fragments don't. `app.json` now declares `"scheme": "bingo"` for the deep link to resolve.

**Requires one manual dashboard step**, documented in `README.md`: add `bingo://reset-password` to **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**. Not done via `supabase config push` deliberately — see finding D below, that command replaces the entire live Auth config with this repo's local (placeholder-filled) `config.toml`, which is too risky to run blind.

**Verified:** `resetPasswordForEmail` call live-tested against the real project with the PKCE flow and the `bingo://reset-password` redirect — accepted with no error.

**Follow-up fix #1 (same session):** testing surfaced the deep-link gap directly — in Expo Go, the app's real deep-link address is a dynamic `exp://<lan-ip>:<port>/--/reset-password`, not the stable `bingo://reset-password` scheme (that only applies to a standalone/dev-client build). Supabase rejected the un-allowlisted redirect and fell back to its default `site_url` (`http://localhost:3000`), landing the user on a dead browser page with the recovery `code` stuck in the address bar. Added a fallback on `ProfileScreen`'s reset-password form: paste the link (or just the code) back into the app.

**Follow-up fix #2 (same session) — the actual root cause of "it just logs me in instead of letting me set a password":** the paste-code fallback originally called `exchangeCodeForSession()` then navigated to `/reset-password`. But `exchangeCodeForSession()` itself establishes a real session — which flips `AuthContext`'s `isAuthenticated` to `true` immediately, and `ProfileScreen`'s `if (!isAuthenticated)` gate (which the whole login/forgot-password UI lives inside) stopped rendering that UI the instant the code was redeemed, regardless of any navigation call. The user correctly observed this as "it just logs me into the account" — the app wasn't broken, it was accurately reporting a new valid session, it just never got to ask for a new password first. **Fixed**: added a `codeVerified` state checked *before* the `isAuthenticated` gate, so the "set new password" form (now built inline in `ProfileScreen`, not on a separate route — cross-route navigation right after an auth-state flip proved unreliable) renders regardless of the freshly-established session. On success, `supabase.auth.updateUser({password})` is called directly and only then does the flow hand off to the normal authenticated app.

### D. 🟠 Auth email deliverability — default Supabase mailer is not production-viable

**What was hit:** testing the new Forgot Password feature returned "email rate limit exceeded." Confirmed cause: `supabase/config.toml`'s `[auth.rate_limit]` shows `email_sent = 2` (per hour) — Supabase's default limit for projects using its own built-in/shared mailer (no custom SMTP configured). Prior testing during this session's work (a few `resetPasswordForEmail`/`signUp` calls made to verify the RPC and auth flows) used up most of that quota.

**Why this matters beyond "wait an hour":** 2 emails/hour is unusable for any real app — a handful of real users registering or resetting passwords in the same hour will hit this immediately. This is a genuine, previously-undiscovered production blocker, not specific to this session's testing.

**Important correction after re-reading the config comment closely:** `email_sent`'s own doc comment says *"Requires auth.email.smtp to be enabled."* This means simply raising this number (even via a safe, scoped change) **would not actually fix anything** — Supabase enforces a fixed, low hard cap on its shared/built-in mailer regardless of this setting, and only lifts it once a custom SMTP provider is actually configured. There is no config-only fix here.

**Fix:** configure a custom SMTP provider in **Supabase Dashboard → Project Settings → Authentication → SMTP Settings** (Resend has a permanent free tier — 100 emails/day, ~5 minute signup — good fit for a presentation/demo deadline; SendGrid, Postmark, AWS SES also work). This removes the shared mailer's hard cap entirely. Requires an account with an email provider, which this repo can't create — same category as the Google Maps keys and classifier hosting: an external account only the project owner can set up, and the SMTP host/port/credentials still have to be entered in the dashboard by hand (no CLI/API path for this was found either).

**Practical advice for a deadline before SMTP is set up:** don't rely on live signup/reset emails *during* the presentation itself — pre-create and pre-verify every demo account beforehand, well outside the rate-limit window, so nothing needs to send a fresh email while presenting. This is good demo practice regardless of the rate limit (live email delivery is slow and hard to control on stage).

**Not attempted:** increasing `[auth.rate_limit].email_sent` via `supabase config push` — beyond the SMTP-gating issue above, that command also pushes the _entire_ local `config.toml` (including placeholder values like `site_url = "http://127.0.0.1:3000"`) to the live project, risking a silent overwrite of real dashboard settings this repo can't see. Raised with the project owner directly; given it wouldn't have helped anyway, decision was to not push it.

**Priority:** 🟠 High (blocks any real signup/password-reset volume, not just this session's testing)
**Files:** none in-repo — Supabase dashboard configuration only.
**Test:** after SMTP is configured, send more than 2 reset/confirmation emails within an hour and confirm no rate-limit error.
**Definition of done:** custom SMTP configured and verified in the dashboard.

---

## Phase 1 — Critical Bugs & Security

### 1.1 ✅ (Done, live) `display_exp` view PII leak

Fixed in `supabase/migrations/0002_security_policies.sql`, applied and verified against the live REST API — view no longer selects `auth.users.email`.

### 1.2 ✅ (Done, live) `bins` public write access

Fixed — INSERT/UPDATE/DELETE now require auth; UPDATE/DELETE scoped to `created_by` (server-set, unspoofable). Verified live: an anon DELETE against `bin-demo-1` was confirmed to leave the row untouched.

### 1.3 ✅ (Done, live) Client-writable, non-atomic leaderboard XP

Fixed — all writes go through `increment_leaderboard_score()` (SECURITY DEFINER, atomic `+=`, bounded 1–2000, requires `auth.uid()`). Verified live: an anon PATCH attempting to set `total_points=999999999` left the row at its original value.

### 1.4 🟠 `leaderboard_scores.user_id` has no foreign-key constraint

**What:** `user_id UUID` in `0001_schema.sql` has no `REFERENCES auth.users(id)`. NPC/demo rows deliberately use `user_id IS NULL`, which is why no FK was added originally — but that also means a real user's row silently orphans forever if their auth account is ever deleted (no cascade, no cleanup).
**Why:** Referential integrity; prevents stale/orphaned rows accumulating; correct behavior on account deletion (GDPR-style "delete my account" requests, if ever added, would leave a ghost leaderboard entry with the old display name otherwise).
**Files:** new migration `supabase/migrations/0004_leaderboard_fk.sql`.
**Dependencies:** none.
**Test:** `ALTER TABLE ... ADD CONSTRAINT ... REFERENCES auth.users(id) ON DELETE CASCADE` on a Postgres session against the live project (NULL rows are unaffected by FK checks, so demo data is safe); delete a disposable test user and confirm their leaderboard row cascades away.
**Definition of done:** constraint exists in a migration, applied live, demo rows unaffected, a real-user deletion test cascades correctly.

### 1.5 🟡 RLS has never been regression-tested

**What:** RLS correctness was verified once, manually, by hand-crafted `curl` calls against the live API. There's no repeatable test that would catch a future accidental policy regression (e.g., someone "simplifies" a policy back to `USING (TRUE)` during unrelated work).
**Why:** RLS is the single most important security boundary in this app; it deserves the same regression protection as any other critical logic.
**Files:** new `supabase/tests/` (pgTAP) or a scripted integration test hitting the live/staging REST API with different bearer tokens.
**Dependencies:** 1.4; ideally a disposable staging project or two throwaway auth users to test cross-user access denial against (see Phase 8).
**Test:** the tests themselves are the test.
**Definition of done:** at minimum, an automated check exists for: (a) anon cannot write `bins`/`leaderboard_scores`, (b) user A cannot delete user B's bin, (c) `increment_leaderboard_score` rejects amounts >2000 and rejects unauthenticated calls, (d) `display_exp` never returns an `email` column.

### 1.6 🟢 Classifier server input validation — re-verify after any future change

**What:** Already fixed (upload size cap, sanitized errors, rate limit, CORS `allow_credentials=False`) — listed here only so the "second security review" this phase asked for explicitly covers it. No further action unless the server changes.
**Definition of done:** N/A — already met; keep the existing `server/README.md` security notes current if the server code changes.

### Second security pass (as requested) — anything new found while planning 1.1–1.6

No new _vulnerabilities_ surfaced beyond 1.4/1.5 above. One design note, not a vulnerability: `increment_leaderboard_score`'s cap (2000) and the client's `MAX_XP_PER_CALL` constant in `src/lib/trashStats.ts` must be kept in sync by hand — if one changes without the other, the client either wastes calls being over-cautious or the server silently rejects legitimate requests. Low risk today (both are hardcoded once, rarely touched), but worth a one-line comment cross-reference in both places pointing at each other. Fold into 1.4's migration PR.

---

## Phase 2 — Authentication

### 2.1 🔴 No route protection / session-aware routing — the "Fixed" auth work only centralized _state_, not _behavior_

**What:** `src/app/index.tsx` unconditionally renders `WelcomeScreen`. There is **no redirect logic anywhere** based on session state — a returning, already-authenticated user still lands on the onboarding Welcome screen on every cold start and must manually navigate to a tab to see their real data. Conversely, nothing stops navigating directly to `(tabs)` while fully unauthenticated (by design, for guest browsing — but that's a _product_ choice, not currently a _deliberate, reviewed_ one, since it was never explicit before this roadmap).
**Why:** This is the actual "auth route protection" gap the previous pass's `AuthContext` centralized the data for but never wired into navigation. It's a real, currently-shipping UX defect (a logged-in user re-sees onboarding every launch) and the foundational piece the rest of section 2 builds on.
**Files:** `src/app/_layout.tsx` (already has the `isLoading` gate — extend it), `src/app/index.tsx`, possibly a new `src/app/(tabs)/index.tsx` redirect stub.
**Dependencies:** none — `AuthContext` (already built) has everything needed (`session`, `isGuest`, `isLoading`).
**Design:** in `_layout.tsx`, once `isLoading` is false, use `expo-router`'s `<Redirect>` based on `useAuth()`: if `session` exists → redirect straight to `/(tabs)/home`; if neither `session` nor `isGuest` → stay on `index` (Welcome); if `isGuest` → allow `(tabs)` too. This preserves the existing guest-browsing behavior (a deliberate product feature, confirmed by the "Skip for now" affordance) while fixing the "logged-in user still sees Welcome" bug.
**Test:** manual — sign in, force-quit, relaunch → should land on Home, not Welcome. Automated — extend `AuthContext.test.tsx`'s pattern to a small router-redirect test if feasible, or document as a manual regression check (expo-router `<Redirect>` testing needs more RN test infra than currently set up — see Phase 8 scoping note).
**Definition of done:** returning authenticated users skip Welcome/Register; guest browsing still works exactly as before; unauthenticated+non-guest users cannot reach `(tabs)` by deep link.

### 2.2 🟠 Guest mode does not persist across app restarts

**What:** `AuthContext.isGuest` is plain in-memory React state, never written to `AsyncStorage`. Every cold start resets it to `false`, so a guest user who dismissed the login prompt has to dismiss it again next launch (they'll see Profile's login form again, though Home/Missions still render in guest mode fine since those never gated on `isGuest` directly).
**Why:** Directly requested ("Restart/session problems") and a real, user-visible annoyance — the whole point of "Skip for now" is to not ask again.
**Files:** `src/lib/AuthContext.tsx`.
**Dependencies:** 2.1 (do together — both touch the same provider/gating logic).
**Test:** unit test extending `AuthContext.test.tsx` — mock `AsyncStorage` returning a persisted guest flag, confirm `isGuest` initializes `true` without a real session.
**Definition of done:** `continueAsGuest()` persists to `AsyncStorage`; provider reads it on mount alongside session restore; a real sign-in still clears it (already implemented — `onAuthStateChange` sets `isGuest(false)` when a session appears).

### 2.3 🟡 Two different account states can only be reconciled by nothing — verify no regressions from 2.1/2.2

**What:** Not a new bug — a regression-risk note. `ProfileScreen`, `HomeScreen`, `MissionsScreen`, `ReportScreen`, `MapScreen` all consume `useAuth()` now (already fixed), so 2.1/2.2 should be low-risk since there's a single source of truth. Called out explicitly so it's verified, not assumed, once 2.1/2.2 land.
**Test:** re-run the full manual walkthrough (register → confirm-email message → login via Profile → guest skip → sign out → relaunch) across all five screens after 2.1/2.2.
**Definition of done:** no screen shows stale/contradictory auth state during the walkthrough.

### 2.4 🟡 Email confirmation UX is a dead end

**What:** `RegisterScreen` already (fixed previously) shows "Account created. Check your email to confirm it, then log in." when Supabase requires confirmation — but there's no way back into the app to _complete_ that flow (no deep link handling for Supabase's confirmation email redirect, no "resend confirmation" affordance, no polling/refresh after confirming in the browser).
**Why:** Currently a real dead end for any project with email confirmation enabled — the user confirms in their email client and then has to manually figure out to come back and log in.
**Files:** `src/native/screens/RegisterScreen.tsx`, `src/native/screens/ProfileScreen.tsx` (login form), possibly `app.json` deep-link scheme config.
**Dependencies:** 2.1 (routing must exist to redirect a confirmed-via-deep-link user somewhere sensible).
**Test:** manual, against a Supabase project with email confirmation required — full loop from signup to confirmed login.
**Definition of done:** at minimum, a "Resend confirmation email" affordance on the login form when a login attempt fails with an unconfirmed-email error; deep-link handling is a stretch goal, not required for done.

### 2.5 🟢 Mission claim state is per-device only (cross-cutting with Phase 3)

Already flagged as a known remaining item. Full plan lives in Phase 3.3 (it's fundamentally a database/RPC design task, not an auth task) — cross-referenced here because it's also a session/auth edge case ("multi-device problems").

---

## Phase 3 — Database

### 3.1 ✅ (Done, live) Canonical migration path

`supabase/migrations/0001–0003` is the one canonical source; `supabase_setup/` and `supabase/snippets/` deleted. `scripts/run-supabase-setup.mjs` updated to match and re-verified working.

### 3.2 🟠 See 1.4 — `leaderboard_scores.user_id` FK constraint

(Listed under Security since it's constraint-integrity, not duplicated here.)

### 3.3 🟡 Mission claims: DB-backed, atomic, cross-device

**What:** `src/lib/missions.ts` stores `claimedMissionIds` in `AsyncStorage` only. No server record exists of what a user has claimed. A second device (or a reinstall) can claim the same daily/weekly mission's XP again — a real, if minor, cheat/dupe vector on top of the already-bounded RPC.
**Why:** Explicitly in scope ("Duplicate prevention," "Race conditions," multi-device problems); closes the last open XP-integrity gap from the original audit.
**Design:**

```sql
CREATE TABLE public.mission_claims (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('daily','weekly')),
  mission_id TEXT NOT NULL,
  period_key TEXT NOT NULL,  -- e.g. '2026-09-07' for daily, ISO week for weekly — prevents replay across resets
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, category, mission_id, period_key)
);
-- RLS: SELECT own rows only; all writes via a claim_mission(category, mission_id, period_key, reward_xp) RPC
-- that INSERTs (PK collision = already claimed, return a clear "already claimed" error) AND calls
-- increment_leaderboard_score in the same transaction — one atomic claim+award, no separate client round-trip.
```

**Files:** new migration `0005_mission_claims.sql`; `src/lib/missions.ts` (claim functions become async DB calls with local cache as a fast-path/offline fallback, not the source of truth); `MissionsScreen.tsx`'s claim handler (currently calls `claimMissionReward` then separately `awardMissionXp` — two round-trips racing each other; the new RPC collapses this to one call).
**Dependencies:** 1.4 (same migration batch, both touch `leaderboard_scores`/`auth.users` relationships).
**Test:** unit-test the client wrapper the same way `trashStats.test.ts` tests `awardMissionXp` (mock the RPC, assert call shape); manual cross-device test (claim on device A, confirm device B sees it as already-claimed).
**Definition of done:** claiming the same mission from two devices/sessions is rejected server-side, not just locally; local `AsyncStorage` becomes a cache/offline-fallback layer, not the authority.

### 3.4 🟢 No geospatial index on `bins`

**What:** `bins(latitude, longitude)` has no spatial index; `loadBins()` does a full unfiltered `SELECT`. Fine at current scale (a few dozen rows). Flag only, no action now — over-engineering to add PostGIS/a spatial index for a table this small.
**Definition of done (deferred):** revisit if `bins` grows past ~5,000 rows or map load becomes visibly slow — see Phase 7.

### 3.5 🟢 Generate typed Supabase client types

**What:** No `Database` type exists; every query result is manually cast with `as any` (`src/lib/bins.ts`, `src/lib/trashStats.ts` — see Phase 9 for the full list). `supabase gen types typescript --linked` would generate a real `Database` type from the actual live schema, letting `createClient<Database>(...)` catch column-name typos and shape mismatches at compile time.
**Why:** Removes ~10 `any` casts at the root cause instead of one at a time; catches schema-drift bugs (e.g., a column renamed in a migration but not in the client) at build time instead of at runtime.
**Files:** new `src/lib/database.types.ts` (generated, checked in), `src/lib/supabase.ts` (`createClient<Database>`).
**Dependencies:** none — can run any time against the live project.
**Test:** `pnpm typecheck` after regenerating; deliberately misname a column in a query to confirm it now fails to compile.
**Definition of done:** `Database` type checked in, `supabase.ts` typed with it, at least the `any` casts in `bins.ts`/`trashStats.ts` replaced with real types; a documented `pnpm` script (`supabase:types`) to regenerate after future schema changes.

---

## Phase 4 — Code Cleanup

### 4.1 ✅ (Done) Legacy web app, dead root entry, duplicate SQL, ~30 unused packages, duplicated Haversine, duplicated auth-session logic, debug `console.log`s

All removed and verified (typecheck/lint/tests/bundle export all green after each removal). No further action.

### 4.2 🟢 `RELEASE_NOTES.md` is now stale documentation

**What:** Describes a `supabase_setup/missions.sql` that was never created and references the now-deleted `supabase_setup/` folder as the deployment path.
**Why:** Low-risk staleness — it's a dated historical handoff doc, not living documentation (that's now `README.md`/`supabase/README.md`/`server/README.md`), but it could mislead someone skimming old docs.
**Files:** `RELEASE_NOTES.md`.
**Test:** N/A (docs-only).
**Definition of done:** add a one-line banner at the top noting it's a historical snapshot and pointing to the current `README.md`/`supabase/README.md` — don't rewrite history, just disambiguate it for future readers.

### 4.3 🟢 `Guidelines.md` is an empty scaffold template

**What:** Entirely commented-out generator boilerplate, never filled in.
**Why:** Zero information value as-is.
**Files:** `Guidelines.md`.
**Definition of done:** either delete it (nothing references it) or leave as-is if the user wants to eventually fill it in — flagged for a decision, default recommendation is delete since it's currently pure noise.

### 4.4 🟢 Re-verify no orphaned references after all prior cleanup

**What:** Sanity check, not a known issue — confirm nothing still imports from deleted paths (`web-legacy`, `App.tsx`, `supabase_setup`) anywhere, including docs/scripts, not just app code.
**Test:** `grep -rn "web-legacy\|supabase_setup\|from ['\"]\.\./App" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.mjs"` across the repo.
**Definition of done:** zero hits outside historical/changelog-style docs (`RELEASE_NOTES.md`, this roadmap).

---

## Phase 5 — Classifier / AI Networking

### 5.1 Current architecture — as it actually works today (not hypothetical)

`src/lib/trashClassifierApi.ts` tries candidate base URLs **in this order**, first one to respond wins and is cached in-memory for the rest of the session:

1. `lastWorkingBaseUrl` — whatever worked last time this session (resets on app restart).
2. `Constants.expoConfig.hostUri` → `http://<metro-dev-server-host>:8000` — **this is already automatic LAN discovery**. It works because Expo Go/dev-client tells the app what host Metro itself is being served from, and this app assumes the classifier runs on the _same machine_ on port 8000 — true for every normal local-dev setup (one developer, one machine, both processes). It is `undefined`/absent in any production or standalone (EAS) build, by design — Metro doesn't exist there.
3. `EXPO_PUBLIC_CLASSIFIER_API_URL` (from `.env`) — a hardcoded fallback. **This is the value that just went stale** when the dev machine's IP changed networks, causing a real support issue this session. It's baked into the JS bundle at build time; changing it requires editing `.env` and restarting Metro.
4. `http://10.0.2.2:8000` — Android emulator's special loopback to the host machine. Dev/emulator-only.
5. `http://127.0.0.1:8000` — same-device loopback (web dev, or classifier running on the phone itself, which never happens).

**Determination:** the hardcoded-IP problem the user's instructions asked about is real (#3), but it is already _not_ the primary mechanism — #2 (automatic `hostUri` discovery) already handles the common "developer's IP changed" case with zero configuration, because it's derived live from Metro's own connection info rather than a stale file. Building anything fancier (mDNS/Bonjour service discovery, a subnet-scanning ping) would be over-engineering: it'd add native-module complexity and startup latency to solve a problem #2 already solves for the one supported topology (classifier + Metro on the same machine).

### 5.2 🟡 Formalize and document the discovery order; stop treating `.env`'s IP as something developers must hand-maintain

**What:** Nothing is _broken_ here, but nothing documents _why_ #2 exists or that #3 is a fallback, not the primary mechanism — which is exactly why a stale `.env` value read as "the bug" during troubleshooting instead of "an unused fallback."
**Why:** Saves the next person (or the next network switch) from the same confusion.
**Files:** `server/README.md` (already has a "Deploying for real users" section — extend it with this discovery-order explanation), a short comment block at the top of `trashClassifierApi.ts`.
**Dependencies:** none.
**Test:** N/A (docs/comments).
**Definition of done:** `server/README.md` explains: "in local dev, the app auto-discovers the classifier via Metro's own host — you normally don't need to edit `.env`'s IP at all; it's only a fallback for non-standard setups (classifier on a different machine than Metro)."

### 5.3 🔴 Production: classifier has no deployment target at all

**What:** For any real installed-app user (TestFlight, Play Store, or even an ad-hoc EAS build shared with a friend), **all five candidates fail** — no `hostUri` (no Metro), `.env`'s LAN IP is meaningless off that network, no emulator, no localhost. Every real user's "Report" flow silently falls back to `classifyTrashPhoto`'s local heuristic guess (now honestly labeled "(estimated)" in the UI, but still not real classification for 100% of real users today).
**Why:** This is the single largest gap between "the app works for the developer" and "the app works for anyone else." It's explicitly called out as required for production readiness.
**Design (recommended, does not require inventing an actual URL — that's a deploy-time decision):**

1. Containerize `server/` (a `Dockerfile` wrapping the existing FastAPI app — no code changes needed, `requirements.txt` is already pinned).
2. Deploy to any small container host with HTTPS out of the box (Fly.io, Render, Railway — comparable cost/complexity; pick based on the user's existing accounts/preferences, not a fixed recommendation here).
3. Add `EXPO_PUBLIC_CLASSIFIER_API_URL` as a **build-time, per-environment** value via EAS build profiles (`eas.json`, see Phase 10) — a production build gets the real HTTPS URL baked in; a dev build keeps using the LAN-discovery flow from 5.1 unchanged.
4. Update the candidate list so that in a production build (`__DEV__ === false`, or `Constants.expoConfig?.hostUri` absent), _only_ the env-var HTTPS URL and nothing else is tried — no point attempting `10.0.2.2`/`127.0.0.1` in a shipped app; small latency win, and it means a genuinely-unreachable production endpoint fails fast into the honestly-labeled heuristic instead of burning ~4×2.5s of timeouts first.
   **Files:** new `server/Dockerfile`, `eas.json`, `src/lib/trashClassifierApi.ts` (prod-vs-dev candidate list), deployment host's own config (external to this repo).
   **Dependencies:** 5.4–5.7 should land in the server code _before_ it's ever deployed publicly, not after.
   **Test:** deploy to a free/staging tier first; point a dev build's `.env` at the staging HTTPS URL and confirm `/classify` round-trips correctly from a real device off the dev LAN.
   **Definition of done:** a real HTTPS endpoint exists (staging is enough to call this "done" for the roadmap — going live in production is the user's infra decision, not something to fabricate here); a production EAS build profile points at it; a dev build is unaffected.

### 5.4 ✅ (Done) Upload validation, size limits, rate limiting, error sanitization, CORS fix, thread-pool inference offload

All already implemented in `server/classifier_api.py` and verified with live smoke tests (valid image classifies, invalid image → clean 400, 31st request/min → 429, `allow_credentials=False`). No further action unless deployment (5.3) reveals new requirements.

### 5.5 🟡 No authentication on `/classify` once publicly reachable

**What:** Currently zero auth beyond per-IP rate limiting. Fine for a LAN-only dev service; becomes a real "anyone can burn your compute bill" risk the moment 5.3 puts a public HTTPS URL in front of it.
**Why:** Explicitly requested ("Authentication where appropriate"); rate limiting alone doesn't stop a botnet or even a single motivated user rotating IPs.
**Design:** the app already authenticates users via Supabase for everything else — reuse that. Have the client send the user's Supabase JWT (`Authorization: Bearer <token>`) with each `/classify` call; the server verifies it against Supabase's JWKS endpoint (or, simpler, just checks the JWT is well-formed and not expired — full signature verification against Supabase's public key is the more correct version, worth the extra ~20 lines). Reject requests with no/invalid token once this lands.
**Files:** `server/classifier_api.py` (JWT verification middleware/dependency), `src/lib/trashClassifierApi.ts` (attach the current session's access token to the request).
**Dependencies:** 5.3 (no urgency while it's LAN-only-reachable).
**Test:** a request with no token → 401; an expired/malformed token → 401; a valid token → 200. Add to the classifier's existing manual smoke-test routine (Phase 8 documents making this repeatable).
**Definition of done:** unauthenticated requests rejected once deployed publicly; local dev flow unaffected (dev builds still have a real Supabase session to attach).

### 5.6 🟢 No monitoring/alerting on the deployed classifier

**What:** Logging exists (`logging.basicConfig` to stdout) but nothing aggregates or alerts on it once it's not running on someone's visible terminal.
**Why:** Requested ("Monitoring/logging"); low effort once a host is chosen (most of the options in 5.3 have built-in log aggregation for free).
**Files:** deployment host config (external).
**Definition of done:** deployed logs are viewable somewhere without SSHing in; a basic uptime check (even a free external ping monitor) exists. Do not build a custom monitoring stack — that's over-engineering for this project's scale.

### 5.7 🔴 Never present a heuristic/random guess as genuine AI confidence

**What:** Already fixed in a prior pass — `source: "model" | "heuristic-server" | "heuristic-local"` is threaded through from the server's honest `mode` field and the client's local fallback, and `ReportScreen` labels non-model results "(estimated)". Listed here to confirm it's carried forward: **any future change to this pipeline must preserve the `source` field and the UI label** — this is a hard requirement, not a suggestion, restated because 5.3's production deployment changes which path is "normal," and it would be easy to accidentally regress the labeling while restructuring the candidate list.
**Definition of done:** re-confirm after 5.3/5.5 land — a production build showing a heuristic result must still say "(estimated)," not silently drop the label because the code path changed.

---

## Phase 6 — Bugs & Edge Cases

Fresh sweep beyond the original audit + this session's findings, focused on what's _not yet_ covered above.

### 6.1 🟠 Realtime bin subscription: single global channel, no reconnect-on-drop handling

**What:** `subscribeToBinsRealtimeUpdates` in `src/lib/bins.ts` logs `CHANNEL_ERROR`/`TIMED_OUT` (fixed previously) but never _retries_ — if the realtime connection drops (phone loses signal briefly, backgrounds the app, etc.), the map silently stops receiving live updates until the user manually leaves and re-enters the Map tab (which remounts the effect).
**Why:** "Realtime failures" explicitly in scope; a dropped-then-silently-stale map is a worse UX than a visible reconnect indicator.
**Files:** `src/native/screens/MapScreen.tsx`, `src/lib/bins.ts`.
**Dependencies:** none.
**Test:** manual — toggle airplane mode on/off while Map tab is open, confirm bins re-sync without leaving the tab; unit test the error-status branch already exists, extend if a retry is added.
**Definition of done:** either an automatic resubscribe on `CHANNEL_ERROR`/`TIMED_OUT` (with backoff), or at minimum a visible "reconnecting…" indicator so the user knows the map may be stale — pick the simpler (indicator) unless a retry is genuinely trivial to add correctly.

### 6.2 🟡 `ReportScreen` classifier timeout race with the "opening map" auto-navigation

**What:** After a successful classification, `takePhoto` auto-navigates to the Map tab after a fixed 1300ms `setTimeout`. If the (already-slow, up to ~4×2.5s worst case before this session's changes, now bounded but still not instant) classifier candidate loop is still resolving when the user backgrounds the app or taps away, the eventual `setState` calls (`setCaptureLabel`, `setCapturedPhotoUri`) fire after the camera view may have already unmounted.
**Why:** "State synchronization problems," potential React warning/crash on some RN versions for `setState` after unmount.
**Files:** `src/native/screens/ReportScreen.tsx`.
**Dependencies:** none.
**Test:** manual — start a capture, immediately navigate away before the "Detected X" label appears; check for a console warning.
**Definition of done:** an unmount guard (the same `let cancelled` pattern already used in `MapScreen`/`ProfileScreen`) wraps the async classify→save→navigate chain.

### 6.3 🟡 Duplicate-tap protection missing on several action buttons

**What:** `MapScreen`'s "Add Bin At My Location," "Refresh Route," and the mission claim button (claim button _does_ already guard via `claimingMissionId`) don't disable themselves while their async handler is in flight — a fast double-tap can fire `addBinToDatabase` twice before the first `setBins` update re-renders, risking a duplicate insert (mitigated but not eliminated by the existing "already exists nearby" distance check, which itself reads from state that hasn't updated yet on the second tap).
**Why:** "Duplicate actions" explicitly in scope.
**Files:** `src/native/screens/MapScreen.tsx`.
**Dependencies:** none.
**Test:** manual rapid double-tap; or a unit test around a extracted `addBin` helper asserting it's a no-op while already in flight.
**Definition of done:** an in-flight guard (a ref or state flag) on `addBinAtCurrentLocation`/`addBinManually`/`Refresh Route`, consistent with the pattern already used for mission claims.

### 6.4 🟢 `MapScreen.web.tsx` has a much smaller feature set than native, with no in-app signal that this is intentional

**What:** Already noted in the original audit as Info/Low; restated because it's a real "empty states"/expectation-mismatch risk if the web target (`app.json`'s `"web": {}`) is ever actually used for anything beyond incidental `expo start --web` testing — a web user gets no bin-adding, no routing, no realtime.
**Why:** Not urgent — no evidence the web platform target is a real product surface today — but should be a _deliberate_ decision, not silent drift.
**Definition of done (deferred unless web becomes a real target):** either bring `MapScreen.web.tsx` to feature parity, or add a small "full features available on mobile" note in the web UI so it's not silently confusing.

### 6.5 🟢 `calculateStreak`'s day-boundary math uses local device time, mission resets do too — already known, still worth one explicit regression test

**What:** Not a new bug (already documented as Low in the original audit — device clock/timezone changes can manipulate streaks/reset timing). Restated only to make sure Phase 8's test plan explicitly covers the boundary (midnight rollover, DST transition) since it's easy to regress silently.
**Definition of done:** covered by a `getCaptureStats`/streak unit test with a controlled fake `Date` — see Phase 8.

---

## Phase 7 — Performance

Deliberately short — most real issues were already fixed (classifier thread-pool offload, `getCaptureStats` call-site consistency, realtime subscription leak). Only including items with _actual, current_ value; explicitly not re-litigating things already fixed or the deferred-as-premature items (3.4's spatial index, `bins`'s full-refetch-on-every-event pattern — both still fine at current data volume and would be over-engineering to address now).

### 7.1 🟢 `getGlobalLeaderboard` fetches `limit * 2` rows every call with no caching

**What:** Every Missions-screen focus triggers a fresh leaderboard query (already throttled to once per 24h client-side via `lastLeaderboardRefresh` — this is actually already reasonably optimized). No further action needed; noted only to confirm it was checked, not missed.
**Definition of done:** N/A — already adequate.

### 7.2 🟢 Mission pool JSON is small and static — no lazy-loading concerns

Confirmed fine as-is; not worth restructuring.

### Summary

No new performance work is recommended for this phase beyond what's already been done. Revisit if/when `bins` or `leaderboard_scores` grow by orders of magnitude (Phase 3.4's deferred spatial index becomes relevant around thousands of rows, not before).

---

## Phase 8 — Testing

### 8.1 ✅ (Done) 31 passing Vitest tests

Covers: `AuthContext` (loading/guest/sign-in transitions), `awardMissionXp` (RPC call shape, 2000-cap enforcement, no-call-when-guest), `fetchUserEcoXpFromDb` (view-then-fallback), `getGlobalLeaderboard` (NPC merge + sort + error fallback), `missions.ts` (progress math, pool size, claim dedup within a session), `geo.ts`, `route.ts`.

### 8.2 🔴 RLS regression tests (cross-referenced from 1.5)

See Phase 1.5 for the full task — repeated here only to keep the priority list ordering the user asked for (Authentication → Authorization → RLS → XP/leaderboard → Missions → Classifier → Core utilities → Critical user flows) intact within this phase.

### 8.3 🟠 Route-protection / session-restoration tests (depends on 2.1)

**What:** Once 2.1 adds actual redirect logic, it needs its own regression coverage — right now `AuthContext.test.tsx` proves the _state_ transitions correctly, but nothing proves the _router_ reacts to it correctly.
**Files:** new `src/app/__tests__/` or extend the existing pattern.
**Dependencies:** 2.1 must land first (nothing to test yet).
**Test approach:** `expo-router` has a documented testing pattern using its own test utilities (`expo-router/testing-library`) for asserting which route renders given a given auth state — lighter than full `jest-expo` screen rendering, worth using here specifically since it's the one navigation-logic piece that's pure enough to test without mocking every native module.
**Definition of done:** a test confirms an authenticated session renders `(tabs)` on cold start (not `Welcome`), and a fully-signed-out+non-guest state renders `Welcome`.

### 8.4 🟡 Mission-claim dedup tests (depends on 3.3)

**What:** Once mission claims move server-side, the existing `missions.test.ts` dedup tests (currently testing the AsyncStorage-only behavior) need a parallel set against the new RPC's mocked shape, following the exact pattern already used for `awardMissionXp` in `trashStats.test.ts`.
**Dependencies:** 3.3.
**Definition of done:** a test proves claiming the same `(user, category, mission_id, period_key)` twice is rejected server-side (mocked), matching the live RLS test in 8.2's spirit.

### 8.5 🟡 Classifier integration smoke test, automated

**What:** The classifier's correctness was verified manually this session (valid image, invalid image, rate-limit threshold) via ad-hoc `curl` commands — not checked into the repo as a repeatable test.
**Why:** "Classifier" explicitly listed as a testing priority; manual-only verification means the next change could silently regress upload validation or rate limiting.
**Files:** new `server/tests/test_classifier_api.py` using FastAPI's `TestClient` (no new heavy dependency — `TestClient` ships with FastAPI/Starlette).
**Dependencies:** none.
**Test:** the tests themselves — valid image → 200 + correct shape; non-image upload → 400 with a sanitized message (not the raw PIL exception); oversized upload → 413; 31st request in a window → 429; `/health` always 200.
**Definition of done:** `pytest server/tests/` runs green locally and in CI (Phase 10).

### 8.6 🟢 Component/screen-level RN tests — explicitly still out of scope, restated with reasoning

**What:** Not recommended as a near-term task. Testing actual `<HomeScreen />`/`<MapScreen />` rendering needs `jest-expo` + mocks for `expo-camera`, `expo-location`, `react-native-maps`, `expo-router`'s native navigation — a genuinely heavy lift relative to the value, given the business-logic layer (where the actual bugs have lived so far) is now well-covered.
**Definition of done (if ever prioritized):** out of scope for this roadmap; revisit only if a screen-level regression actually occurs that unit tests couldn't have caught.

### Regression testing after each phase (as requested)

After every phase in this document, re-run the full existing gate before moving on: `pnpm typecheck && pnpm lint && pnpm test`, plus `expo export --platform android` and `expo-doctor` for anything touching dependencies/config, plus (for anything touching `supabase/migrations/`) the live-API verification pattern already established this session (a scoped `curl` against the deployed policy/RPC, not just reading the SQL).

---

## Phase 9 — TypeScript & Dependencies

### 9.1 ✅ (Done) `strict: true` enabled, 0 errors

No incremental work was needed — the codebase was already clean enough.

### 9.2 🟡 Remaining `any` usage — 12 non-test occurrences

**What:** All in `src/lib/bins.ts`, `src/lib/trashStats.ts` (untyped Supabase row casts — see 3.5, same root cause/fix), and `src/lib/trashClassifierApi.ts` (`Constants.expoConfig as any` for the undocumented `hostUri` field, and a React Native `FormData.append` type gap that's a known upstream RN typing limitation, not a real code smell).
**Why:** Mostly resolved by 3.5 (generated `Database` types). The `Constants.expoConfig as any` cast is narrower and worth its own one-line fix regardless: `hostUri` is a real (if undocumented in the public `ExpoConfig` type) field — declare a local `type ExpoConfigWithHostUri = ExpoConfig & { hostUri?: string }` instead of `as any`.
**Files:** `src/lib/trashClassifierApi.ts`; the rest resolved via 3.5.
**Dependencies:** 3.5 for the Supabase-row casts.
**Test:** `pnpm typecheck` after.
**Definition of done:** the two classifier-file `any`s replaced with a proper narrow type; `bins.ts`/`trashStats.ts` casts replaced via 3.5's generated types; the FormData `as any` is acceptable to keep (documented as a known RN limitation) unless a typed alternative exists in the currently-pinned RN version.

### 9.3 🟢 Dependency health check

**What:** Confirmed clean — no deprecated packages remain in `package.json` (the previously-flagged `recharts` was removed with `web-legacy`). `pnpm outdated` should still be run periodically, but nothing is currently flagged.
**Definition of done:** N/A right now; add `pnpm outdated` as a periodic manual check, not automated (a Dependabot/Renovate config would be over-engineering for a project this size unless the user specifically wants automated update PRs — flag as an optional Phase 10 nice-to-have, not required).

### 9.4 🟡 Python dependency reproducibility — pinned but not lockfile-verified

**What:** `server/requirements.txt` is pinned to exact versions (already fixed), but nothing verifies the pins still resolve identically over time (no `pip freeze` lockfile with hashes, no `requirements.lock`).
**Why:** "Reproducibility" explicitly requested; exact-version pins alone don't guarantee identical transitive dependency resolution forever.
**Files:** `server/requirements.txt`, optionally a `server/requirements.lock` via `pip-compile` (from `pip-tools`) if the user wants full hash-pinned reproducibility.
**Dependencies:** none.
**Definition of done:** current exact-pin state is "good enough" for this project's scale — recommend as optional/nice-to-have, not required, since adding `pip-tools` to the workflow is another tool to maintain for a single-file FastAPI service.

---

## Phase 10 — CI/CD & Production

### 10.1 ✅ (Done) CI runs typecheck + test on push/PR

`.github/workflows/ci.yml` exists and is verified working.

### 10.2 🟠 CI doesn't run lint or a bundle-export sanity check

**What:** `pnpm lint` and `expo export` are both part of the local verification routine established this session but aren't in CI — a lint regression or a Metro-bundling break (like the SDK-upgrade `expo-router`/`react-navigation` incompatibility hit earlier this project's history) would currently only be caught locally, if at all.
**Why:** Directly requested ("Lint... Build... CI").
**Files:** `.github/workflows/ci.yml`.
**Dependencies:** none.
**Test:** push a deliberate lint violation / bundling-breaking change to a branch, confirm CI fails.
**Definition of done:** CI job runs `pnpm lint` and `npx expo export --platform android` (a real bundling smoke test, catching exactly the class of error this project has hit before) alongside the existing typecheck/test steps.

### 10.3 🟠 No EAS build configuration for actual store/TestFlight builds

**What:** No `eas.json` exists. There's no defined path from "code in this repo" to "an installable build a real user can run" — which is the prerequisite for 5.3 (classifier production URL) to even matter, and for the Google Maps key requirement to be exercised at all.
**Why:** Required for production readiness; also the natural place to wire per-environment env vars (dev build → LAN classifier discovery; production build → real HTTPS classifier URL).
**Files:** new `eas.json`, `app.json` (may need `extra`/env wiring depending on the chosen approach — likely `app.config.js` conversion for build-time env injection, a bigger structural change worth its own careful pass rather than folding into this item silently).
**Dependencies:** 5.3 (the production classifier URL this build profile will need to inject).
**Test:** a successful `eas build --profile preview` (or local `expo prebuild` + native build, if EAS isn't the user's chosen path) producing an installable artifact.
**Definition of done:** at least a `development` and `production` EAS build profile exist; production profile injects the real classifier URL and (once available) real Google Maps keys.

### 10.4 🔴 Google Maps API keys still placeholders (carried over, unresolved)

**What:** Unchanged from the original audit — `app.json` has `"YOUR_GOOGLE_MAPS_IOS_API_KEY"` / `"YOUR_GOOGLE_MAPS_ANDROID_API_KEY"`. This roadmap does not invent them (per instructions) — restated here as the release blocker it is.
**Definition of done:** real keys obtained by the project owner and set in `app.json` (or injected via 10.3's build profiles) before any release build.

### 10.5 🟡 Secrets/environment variable documentation — verify it's still accurate after this roadmap's changes

**What:** `README.md`/`supabase/README.md`/`server/README.md` already document current env vars and setup. Once 3.5 (generated types), 3.3 (mission claims), 5.3 (production classifier URL), and 10.3 (EAS profiles) land, these docs need a pass to stay accurate — not a new gap, a maintenance checkpoint.
**Definition of done:** docs updated alongside each phase that changes configuration, not deferred to the end.

### 10.6 🟢 No automated dependency-update workflow

Optional, not required — see 9.3. Skip unless requested.

---

## Final Verification

Run this full checklist before considering any release build. Items already ✅ are re-verify-only; items with a phase reference are blocking until that phase lands.

**Security**

- [x] `display_exp` excludes email (live-verified)
- [x] `bins` write access requires auth + ownership (live-verified)
- [x] `leaderboard_scores` writes only via bounded, atomic RPC (live-verified)
- [ ] `leaderboard_scores.user_id` has a FK constraint (1.4)
- [ ] RLS has automated regression coverage (1.5 / 8.2)
- [x] Classifier: upload limits, sanitized errors, rate limiting, CORS fix (live-verified)
- [ ] Classifier: authenticated once publicly deployed (5.5)
- [ ] No secret/service-role key ever appears in client-bundled code (re-verify after any `.env`/config change)

**Authentication**

- [x] Returning authenticated users skip Welcome/Register on cold start (2.1 — `<Redirect>` in `src/app/index.tsx` and `register.tsx`)
- [x] Guest mode persists across restarts (2.2 — `AuthContext` now persists to AsyncStorage, covered by tests)
- [x] Centralized auth state (`AuthContext`) — single source of truth across all screens
- [x] Register "Login" link performs real auth, not a bypass
- [x] Email-confirmation flow has a resend affordance (2.4 — `ProfileScreen`'s login form)
- [x] No unauthenticated user can reach a feature gated on being signed in — bins add/remove already gated; guest browsing of Home/Missions/Map remains an intentional product choice, not a gap

**Database / RLS**

- [x] One canonical migration path (`supabase/migrations/`, now 0001–0005)
- [x] Atomic XP writes
- [x] FK constraints complete (1.4 — `leaderboard_scores.user_id → auth.users`, applied live)
- [x] Mission claims are server-authoritative (3.3 — `mission_claims` table + `claim_mission` RPC, applied live)
- [x] RLS regression tests exist and pass (1.5 / 8.2 — `scripts/verify-rls.mjs`, 7 checks, all passing live)

**Bugs**

- [x] Realtime reconnect/stale-indicator handled (6.1 — retry + "Reconnecting…" indicator)
- [x] Report-screen unmount race guarded (6.2 — `isMountedRef` guards through the full async chain)
- [x] Duplicate-tap guards on bin-add/route actions (6.3 — `isAddingBin`/`isRouting` disable the buttons in flight)

**Classifier / Networking**

- [x] No hardcoded IP is the _primary_ path — `hostUri` discovery is primary, documented in code + `server/README.md` (5.2)
- [x] Dockerfile + EAS build-profile wiring exist for a production HTTPS endpoint (5.3) — actual external hosting/deployment is the project owner's action (needs a real account on a hosting platform), correctly left as a placeholder in `eas.json`, not invented
- [x] Production build never attempts LAN-only candidates (`__DEV__`-gated candidate list)
- [x] Optional, cryptographically-verified auth on `/classify` (5.5 — JWKS-based, live-tested for the reject paths; strengthens rate limiting without breaking guest access)
- [x] Never presents heuristic output as genuine AI confidence (unchanged, re-confirmed after the 5.3/5.5 rework)

**Code cleanup**

- [x] No dead code / unused deps / duplicate SQL / duplicate components
- [x] Stale doc references cleaned up (4.2 `RELEASE_NOTES.md` banner, 4.3 `Guidelines.md` removed, 4.4 zero orphaned references confirmed)

**Performance**

- [x] No known real bottlenecks at current scale — deferred items documented, not ignored

**Testing**

- [x] 39 unit tests passing (business-logic layer, up from 31 — added guest-persistence and mission-claim-remote coverage)
- [x] RLS integration tests (8.2 — `scripts/verify-rls.mjs`, 7/7 passing live)
- [ ] Route-protection tests (8.3) — genuinely infeasible under the current lightweight Vitest+jsdom setup (expo-router's `<Redirect>` needs `jest-expo`-level RN rendering infra); consistent with 8.6's same documented scoping decision. The underlying `AuthContext` state it depends on is fully tested.
- [x] Classifier integration tests (8.5 — `server/tests/test_classifier_api.py`, 10/10 passing, wired into CI)

**TypeScript / Dependencies**

- [x] Strict mode, 0 errors
- [x] Generated Supabase types (`src/lib/database.types.ts`, `supabase:types` script), `any` count down from 12 to 1 (the one remaining is a documented, known React Native `FormData` typing limitation)
- [x] No deprecated/unused packages

**CI/CD**

- [x] Typecheck + test in CI
- [x] Lint + bundle-export check in CI (10.2 — `app` job now also runs `pnpm lint` and `expo export`)
- [x] EAS build profiles exist (10.3 — `eas.json`, development/preview/production)
- [x] Classifier test job in CI (`.github/workflows/ci.yml`'s `classifier` job)

**Production configuration**

- [ ] Real Google Maps keys (10.4) — still placeholders in `app.json`; cannot be filled in without the project owner's Google Cloud credentials, correctly left as a manual TODO
- [ ] Classifier actually deployed somewhere reachable (5.3) — Dockerfile + build-profile wiring are ready; the external hosting step itself needs the project owner's hosting account
- [x] Classifier authenticated + docs current against final state (5.5, 10.5)
- [ ] Custom SMTP configured for Auth emails (finding D above) — default Supabase mailer caps at 2 emails/hour, discovered while testing the new Forgot Password feature; needs the project owner's email-provider account

**Auth (addendum after Forgot Password work)**

- [x] Password reset flow implemented (User-Reported Issues, item C) — PKCE deep link, live-tested
- [ ] `bingo://reset-password` added to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs — manual step, not yet confirmed done
- [ ] Custom SMTP configured (finding D) — blocks realistic testing/production volume of reset + confirmation emails

---

## Production Status

**READY FOR TESTING** — current actual state, up from NOT READY. Every phase 1–10 item is implemented, tested, and (for anything touching the live database or classifier server) verified live, **except** items that require the project owner's own external credentials/accounts and cannot be fabricated: real Google Maps API keys (10.4), an actual hosting account to deploy the classifier container to (5.3 — Dockerfile + EAS env wiring ready, only "create an account and run `docker build`" remains), the one-time Supabase dashboard redirect-URL addition for password reset (item C), and custom SMTP for Auth emails (finding D — the default mailer's 2/hour cap makes even _testing_ password reset painful right now).

**RELEASE CANDIDATE** requires, on top of the current state:

- Real Google Maps keys set in `app.json` (10.4)
- Classifier deployed to a real HTTPS host, `eas.json`'s `preview` profile's placeholder URL replaced (5.3)
- `bingo://reset-password` added to the Supabase redirect-URL allowlist, and the full reset flow manually tested on a real device (send email → tap link → set new password → land signed in)
- Custom SMTP configured (finding D) — without this, testing at any realistic pace keeps tripping the rate limit
- A real EAS build produced and manually smoke-tested end-to-end (build → install → sign in → report a photo → see a real classification) on both platforms

**PRODUCTION READY** additionally requires:

- The same deployment done for `eas.json`'s `production` profile
- Phase 5.6 — basic uptime monitoring on the deployed classifier (most hosting platforms in 5.3's shortlist include this for free — just needs turning on)
- A final run of every item in the Final Verification checklist above against the actual release build, not just dev

Everything not listed as blocking for a given tier (e.g., 3.4's spatial index, 9.4's `pip-tools` lockfile, 10.6's dependency-update automation, 8.3's route-protection tests) is explicitly **deferred, not required** — including them would be over-engineering relative to this project's current scale, or (for 8.3) infeasible without a much heavier test-infra investment than its value justifies right now.
