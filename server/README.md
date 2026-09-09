# Classifier service

FastAPI service that classifies a trash photo into one of 6 categories (`cardboard`, `glass`, `metal`, `paper`, `plastic`, `trash`).

## Training the real model

See `DATASET.md` for the dataset (TrashNet, MIT license) and full reproduction steps. Short version:

```bash
pip install -r server/requirements-train.txt   # adds dataset/eval tooling on top of requirements.txt
python server/prepare_dataset.py               # validates + splits the dataset (writes split_manifest.json)
python server/train_classifier.py              # trains, writes server/models/trash_classifier.pth + class_names.json + training_config.json
python server/evaluate_classifier.py           # scores the held-out test split, writes server/models/evaluation_report.json
```

`trash_classifier.pth` is gitignored (binary, regenerable) — `class_names.json`, `training_config.json`, and `evaluation_report.json` are tracked, since they're the actual record of what was trained and how well it performs.

## Modes

`GET /health` and every `POST /classify` response report a `mode` field, honestly:

- `"model"` — a trained MobileNetV2 checkpoint is present at `server/models/trash_classifier.pth` and is doing real inference.
- `"fallback"` — no checkpoint is present; predictions come from `heuristic_infer()`, a hand-coded color/texture heuristic. This is **not** a trained model — it's a reasonable-effort guess based on brightness/saturation/edge statistics, useful for development but not production-accurate.

The app reads this `mode` field and labels the result "(estimated)" in the UI whenever it isn't real model output — see `src/lib/trashClassifierApi.ts` and `src/native/screens/ReportScreen.tsx`. If the server can't be reached at all, the app falls further back to a local random guess (`source: "heuristic-local"` in `src/lib/trashStats.ts`), which is also always labeled as an estimate, never presented as AI output.

## How the app finds this server (local dev)

`src/lib/trashClassifierApi.ts` tries a few candidate addresses, in order — see the comment block at the top of that file for the full list. The short version: **in local dev, you normally don't need to configure anything.** The app automatically discovers this server's address via `Constants.expoConfig.hostUri` (the same host Metro is being served from), so it follows you across network changes with zero configuration, as long as this server runs on the same machine as your Expo dev server, on port 8000.

`EXPO_PUBLIC_CLASSIFIER_API_URL` in `.env` is only a **fallback/override** — for a non-standard setup (classifier running on a different machine than Metro), or in a production build where automatic discovery isn't available at all (see below).

## Running locally

Each developer creates their own virtual environment — `.venv/` is machine-specific (absolute paths baked into its activation scripts) and is gitignored; never commit it or hardcode a path into it (`package.json`'s `ai:start` used to do exactly that and broke for every teammate — it now just runs `python`, relying on your venv being active).

```bash
# from the repo root
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell — run this in every new terminal before using ai:* scripts
# source .venv/bin/activate       # macOS/Linux equivalent

pip install -r server/requirements.txt
python server/classifier_api.py   # listens on 0.0.0.0:8000
```

Or, once the venv is activated, `pnpm ai:install` + `pnpm ai:start` (and `pnpm start:all` runs this alongside the Expo dev server) — these only work correctly while the venv is active in that same terminal, since they resolve to whatever `python` is first on `PATH`.

## Authentication

`/classify` accepts an **optional** `Authorization: Bearer <supabase-access-token>` header. The app attaches the current user's session token automatically when one exists (see `trashClassifierApi.ts`).

- **No token** → request is allowed (rate-limited per IP). The app doesn't gate photo classification behind login, so guests must keep working.
- **A token is present** → it's cryptographically verified against this Supabase project's JWKS endpoint (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, ES256). An invalid/expired/forged token is rejected with 401 rather than silently ignored. A valid token's user id is used to rate-limit that account specifically, instead of by IP (harder to evade than IP rotation).
- Reads `EXPO_PUBLIC_SUPABASE_URL` from the repo root `.env` (via `python-dotenv`) — the same value the app itself uses, not a separate/invented one. If that's not set, verification silently no-ops (every request behaves like the "no token" case) — safe default for a bare local setup with no auth wiring yet.

## Deploying for real users

A LAN address is a development-only setup — it is unreachable for anyone not on that exact Wi-Fi network (and unreachable at all from a deployed web build, e.g. Vercel — Vercel only hosts the frontend, it cannot run this Python service). Before shipping to real users:

1. `Dockerfile` in this directory wraps this same app — `server/models/trash_classifier.pth` is tracked in git (not gitignored, unlike the raw dataset) specifically so a from-scratch build has it, and the CMD respects a platform-provided `$PORT`. No code changes needed for any of the platforms below.
2. Deploy it somewhere internet-reachable with HTTPS:
   - **Railway** (recommended — fastest to get running from a GitHub repo): New Project → Deploy from GitHub repo → select this repo → set **Root Directory** to `server` (so it builds `server/Dockerfile`, not the repo root) → Deploy. Railway auto-detects the Dockerfile and injects `$PORT` itself.
   - Render / Fly.io also work the same way (point them at `server/` as the build context).
3. Once deployed, hit `<your-url>/health` — confirm `"mode": "model"` (not `"fallback"`) and `"weightsExists": true`.
4. Point `EXPO_PUBLIC_CLASSIFIER_API_URL` at that HTTPS URL:
   - For the Vercel web build: Vercel dashboard → Project → Settings → Environment Variables → add `EXPO_PUBLIC_CLASSIFIER_API_URL` → redeploy.
   - For a native production build: the root `eas.json`'s `production` profile (not the shared `.env` used for local dev).

## Security notes

- CORS: `allow_origins=["*"]`, `allow_credentials=False` (no cookies/credentialed requests are ever made to this API — pairing `*` with credentials would be a real misconfiguration, so credentials stay off).
- Upload size capped at 8 MB; rejected before and after reading the body.
- Rate limited (30 requests/minute, per authenticated user id when available, else per IP).
- Errors returned to the client are sanitized — raw exceptions are logged server-side only, never echoed back.
- Model inference runs in a thread pool, off the event loop, so one slow classification doesn't stall `/health` or other concurrent requests.
- See "Authentication" above for the bearer-token handling.

This service is meant to sit behind your own infrastructure, not assume production-scale public traffic on its own — if ever deployed somewhere with real load, put it behind a reverse proxy / CDN and consider infrastructure-level rate limiting in addition to the in-process limiter here.
