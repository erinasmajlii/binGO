# binGO

Trash-sorting / recycling gamification app. Expo Router mobile app (`src/app`, `src/native`) backed by Supabase (Postgres + Auth + Realtime), with an optional Python classifier service (`server/`) for photo trash-category detection.

See [`ROADMAP.md`](ROADMAP.md) for the current implementation status and what's left before production.

## Required configuration

The app will run without these, but several features are disabled or degraded until you provide real values.

### 1. Environment variables (`.env`)

Copy `.env.example` to `.env` and fill in:

| Variable | Required for | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Auth, database, realtime, classifier auth verification | From Supabase project settings → API |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth, database, realtime | The **anon/publishable** key — never put the service-role/secret key here, this ships in the client bundle |
| `EXPO_PUBLIC_CLASSIFIER_API_URL` | Report screen's photo classification | Fallback only in local dev — the app auto-discovers the classifier via Metro's own host; see [`server/README.md`](server/README.md). Required (as a real HTTPS URL) for production builds — set via `eas.json`, not this file, for that. |

### 2. Google Maps API keys (`app.json`)

`app.json` currently has **placeholder** values:

```json
"ios": { "config": { "googleMapsApiKey": "YOUR_GOOGLE_MAPS_IOS_API_KEY" } },
"android": { "config": { "googleMaps": { "apiKey": "YOUR_GOOGLE_MAPS_ANDROID_API_KEY" } } }
```

The Map tab works in Expo Go / dev builds without these (Expo Go bundles its own dev keys), but a **standalone/release build will not render map tiles** until you replace both placeholders with real keys.

To get keys: [Google Cloud Console](https://console.cloud.google.com/) → enable "Maps SDK for Android" and "Maps SDK for iOS" → create an API key for each (recommended: restrict each key to its respective platform + your app's bundle id / package name).

This repo intentionally does not invent or ship real keys — replace the two placeholder strings in `app.json` yourself before a release build.

### 3. Database schema

See [`supabase/README.md`](supabase/README.md) for how to apply the canonical migrations in `supabase/migrations/`.

### 4. Classifier deployment

See [`server/README.md`](server/README.md). Local dev needs no configuration (auto-discovery). Production needs a real deployed HTTPS endpoint — a `Dockerfile` is provided; deploying it to an actual host is not (depends on your chosen platform).

### 5. Password reset redirect URL (Supabase dashboard)

Forgot-password (`ProfileScreen`'s "Forgot password?" → `ResetPasswordScreen`) sends the user an email whose link redirects to `bingo://reset-password` (the app's deep-link scheme, set in `app.json`). Supabase only allows redirecting to URLs on an explicit allowlist — add this one:

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add `bingo://reset-password`.**

This repo intentionally does not push this via `supabase config push` — that command replaces the *entire* live Auth config with whatever's in the checked-in `supabase/config.toml` (which still has local-dev placeholder values like `site_url = "http://127.0.0.1:3000"`), risking silently overwriting real dashboard settings this repo can't see. Adding one URL in the dashboard is the safe way to do this.

Without this step, tapping the reset-password link in the email will fail (Supabase rejects the redirect) — the rest of the flow (sending the email, the in-app "set new password" screen) works regardless.

## Running the app

```bash
pnpm install
pnpm start        # expo start
```

## Checks

```bash
pnpm typecheck     # TypeScript, strict mode
pnpm lint          # ESLint
pnpm test          # Vitest — business-logic unit tests
pnpm verify:rls    # live RLS regression check against the linked Supabase project (anon-key coverage)
```

CI (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, and `test` on every push/PR, plus a bundle-export sanity check.

## Building for release

`eas.json` defines `development`/`preview`/`production` build profiles. `preview` and `production` need their `EXPO_PUBLIC_CLASSIFIER_API_URL` placeholders replaced with a real deployed classifier URL once one exists (see `server/README.md`). Real Google Maps keys (above) are required before a release build.
