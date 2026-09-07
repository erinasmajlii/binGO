# Classifier service

FastAPI service that classifies a trash photo into one of 6 categories (`cardboard`, `glass`, `metal`, `paper`, `plastic`, `trash`).

## Modes

`GET /health` and every `POST /classify` response report a `mode` field, honestly:

- `"model"` — a trained MobileNetV2 checkpoint is present at `server/models/trash_classifier.pth` and is doing real inference.
- `"fallback"` — no checkpoint is present; predictions come from `heuristic_infer()`, a hand-coded color/texture heuristic. This is **not** a trained model — it's a reasonable-effort guess based on brightness/saturation/edge statistics, useful for development but not production-accurate.

The app reads this `mode` field and labels the result "(estimated)" in the UI whenever it isn't real model output — see `src/lib/trashClassifierApi.ts` and `src/native/screens/ReportScreen.tsx`. If the server can't be reached at all, the app falls further back to a local random guess (`source: "heuristic-local"` in `src/lib/trashStats.ts`), which is also always labeled as an estimate, never presented as AI output.

## How the app finds this server (local dev)

`src/lib/trashClassifierApi.ts` tries a few candidate addresses, in order — see the comment block at the top of that file for the full list. The short version: **in local dev, you normally don't need to configure anything.** The app automatically discovers this server's address via `Constants.expoConfig.hostUri` (the same host Metro is being served from), so it follows you across network changes with zero configuration, as long as this server runs on the same machine as your Expo dev server, on port 8000.

`EXPO_PUBLIC_CLASSIFIER_API_URL` in `.env` is only a **fallback/override** — for a non-standard setup (classifier running on a different machine than Metro), or in a production build where automatic discovery isn't available at all (see below).

## Running locally

```bash
pip install -r requirements.txt
python classifier_api.py   # listens on 0.0.0.0:8000
```

## Authentication

`/classify` accepts an **optional** `Authorization: Bearer <supabase-access-token>` header. The app attaches the current user's session token automatically when one exists (see `trashClassifierApi.ts`).

- **No token** → request is allowed (rate-limited per IP). The app doesn't gate photo classification behind login, so guests must keep working.
- **A token is present** → it's cryptographically verified against this Supabase project's JWKS endpoint (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, ES256). An invalid/expired/forged token is rejected with 401 rather than silently ignored. A valid token's user id is used to rate-limit that account specifically, instead of by IP (harder to evade than IP rotation).
- Reads `EXPO_PUBLIC_SUPABASE_URL` from the repo root `.env` (via `python-dotenv`) — the same value the app itself uses, not a separate/invented one. If that's not set, verification silently no-ops (every request behaves like the "no token" case) — safe default for a bare local setup with no auth wiring yet.

## Deploying for real users

A LAN address is a development-only setup — it is unreachable for anyone not on that exact Wi-Fi network. Before shipping to real users:

1. Build the container: `docker build -t bingo-classifier .` (see `Dockerfile` in this directory — wraps this same app, no code changes needed).
2. Deploy it somewhere internet-reachable with HTTPS (a small container host — Fly.io, Render, Railway, or a GPU-enabled host if you want to serve the real trained model faster). This repo does not include that specific deployment step — it depends on which platform/account you use.
3. Point `EXPO_PUBLIC_CLASSIFIER_API_URL` at the real HTTPS URL for production builds specifically (see the root `eas.json` — the `production` build profile is where this belongs, not the shared `.env` used for local dev).

## Security notes

- CORS: `allow_origins=["*"]`, `allow_credentials=False` (no cookies/credentialed requests are ever made to this API — pairing `*` with credentials would be a real misconfiguration, so credentials stay off).
- Upload size capped at 8 MB; rejected before and after reading the body.
- Rate limited (30 requests/minute, per authenticated user id when available, else per IP).
- Errors returned to the client are sanitized — raw exceptions are logged server-side only, never echoed back.
- Model inference runs in a thread pool, off the event loop, so one slow classification doesn't stall `/health` or other concurrent requests.
- See "Authentication" above for the bearer-token handling.

This service is meant to sit behind your own infrastructure, not assume production-scale public traffic on its own — if ever deployed somewhere with real load, put it behind a reverse proxy / CDN and consider infrastructure-level rate limiting in addition to the in-process limiter here.
