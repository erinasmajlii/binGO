#!/usr/bin/env node
/**
 * RLS regression check — reproduces, as repeatable assertions, the live
 * attack-vector verification done manually during the security hardening
 * pass. Run this after ANY change to supabase/migrations/ that touches
 * RLS policies, the increment_leaderboard_score RPC, or the display_exp
 * view, to catch an accidental regression before it reaches users.
 *
 * Scope: everything here uses only the public anon key (no real user
 * session), so it covers the anonymous attack surface — the actual
 * vulnerabilities originally found (public PII read, public writes,
 * unauthenticated RPC calls). It does NOT cover authenticated-user-A-vs-
 * user-B cross-account access, which would need two real test accounts'
 * JWTs (out of scope here — see ROADMAP.md Phase 1.5/8.2 for how to extend
 * this with real test accounts if that's ever provisioned).
 *
 * Usage: node scripts/verify-rls.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const raw = readFileSync(path.join(root, ".env"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

let failures = 0;

function report(name, pass, detail = "") {
  if (pass) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function testDisplayExpNoEmail() {
  console.log("\n[1] display_exp must never expose email");
  const res = await fetch(`${URL}/rest/v1/display_exp?select=*&limit=5`, { headers });
  const rows = await res.json();
  const leaked = Array.isArray(rows) && rows.some((row) => "email" in row);
  report("no row contains an 'email' field", res.ok && !leaked, leaked ? "email field present!" : `HTTP ${res.status}`);
}

async function testBinsAnonDeleteDenied() {
  console.log("\n[2] anon cannot delete bins");
  const before = await fetch(`${URL}/rest/v1/bins?id=eq.bin-demo-1&select=id`, { headers }).then((r) => r.json());
  if (!Array.isArray(before) || before.length === 0) {
    report("bin-demo-1 exists (seed data prerequisite)", false, "seed data missing — run supabase:setup first");
    return;
  }

  await fetch(`${URL}/rest/v1/bins?id=eq.bin-demo-1`, { method: "DELETE", headers });

  const after = await fetch(`${URL}/rest/v1/bins?id=eq.bin-demo-1&select=id`, { headers }).then((r) => r.json());
  report("bin-demo-1 still exists after anon DELETE attempt", Array.isArray(after) && after.length === 1);
}

async function testBinsAnonInsertDenied() {
  console.log("\n[3] anon cannot insert bins");
  const probeId = `rls-probe-${Date.now()}`;
  const res = await fetch(`${URL}/rest/v1/bins`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ id: probeId, latitude: 0, longitude: 0, source: "manual" }),
  });

  const inserted = res.ok;
  if (inserted) {
    // Clean up if the insert unexpectedly succeeded (would only happen if RLS regressed).
    await fetch(`${URL}/rest/v1/bins?id=eq.${probeId}`, { method: "DELETE", headers: { apikey: env.SUPABASE_SECRET_KEY ?? ANON_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY ?? ANON_KEY}` } }).catch(() => {});
  }
  report("anon INSERT on bins is rejected", !inserted, inserted ? `HTTP ${res.status} — insert succeeded!` : undefined);
}

async function testLeaderboardAnonUpdateDenied() {
  console.log("\n[4] anon cannot modify leaderboard_scores");
  const DEMO_ID = "11111111-1111-4111-8111-111111111101"; // Alice, seeded demo row
  const before = await fetch(`${URL}/rest/v1/leaderboard_scores?id=eq.${DEMO_ID}&select=total_points`, { headers }).then((r) => r.json());
  if (!Array.isArray(before) || before.length === 0) {
    report("demo leaderboard row exists (seed data prerequisite)", false, "seed data missing — run supabase:setup first");
    return;
  }
  const originalPoints = before[0].total_points;

  await fetch(`${URL}/rest/v1/leaderboard_scores?id=eq.${DEMO_ID}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ total_points: 999999999 }),
  });

  const after = await fetch(`${URL}/rest/v1/leaderboard_scores?id=eq.${DEMO_ID}&select=total_points`, { headers }).then((r) => r.json());
  report("total_points unchanged after anon PATCH attempt", Array.isArray(after) && after[0]?.total_points === originalPoints);
}

async function testRpcRequiresAuth() {
  console.log("\n[5] increment_leaderboard_score rejects anonymous callers");
  const res = await fetch(`${URL}/rest/v1/rpc/increment_leaderboard_score`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ p_amount: 100, p_display_name: "rls-probe" }),
  });
  report("RPC call without a real user session fails", !res.ok, res.ok ? "RPC succeeded for anon!" : `HTTP ${res.status} (expected)`);
}

async function testClaimMissionRequiresAuth() {
  console.log("\n[6] claim_mission rejects anonymous callers");
  const res = await fetch(`${URL}/rest/v1/rpc/claim_mission`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_category: "daily",
      p_mission_id: "rls-probe",
      p_period_key: "1970-01-01",
      p_reward_xp: 100,
      p_display_name: "rls-probe",
    }),
  });
  report("claim_mission call without a real user session fails", !res.ok, res.ok ? "RPC succeeded for anon!" : `HTTP ${res.status} (expected)`);
}

async function testMissionClaimsAnonReadDenied() {
  console.log("\n[7] anon cannot read other users' mission_claims");
  const res = await fetch(`${URL}/rest/v1/mission_claims?select=*&limit=5`, { headers });
  const rows = await res.json();
  // No SELECT policy exists for anon at all, so RLS should return zero rows
  // (PostgREST doesn't error for a policy-filtered-to-nothing read).
  report("anon sees zero mission_claims rows", res.ok && Array.isArray(rows) && rows.length === 0, `HTTP ${res.status}, ${Array.isArray(rows) ? rows.length : "?"} rows`);
}

console.log(`Running RLS regression checks against ${URL}\n(anon-key coverage only — see script header for scope)`);

await testDisplayExpNoEmail();
await testBinsAnonDeleteDenied();
await testBinsAnonInsertDenied();
await testLeaderboardAnonUpdateDenied();
await testRpcRequiresAuth();
await testClaimMissionRequiresAuth();
await testMissionClaimsAnonReadDenied();

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
