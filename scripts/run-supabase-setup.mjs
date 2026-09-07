#!/usr/bin/env node
/**
 * Run all BinGO Supabase migrations in order (linked project).
 * Usage: npm run supabase:setup
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupDir = path.join(root, "supabase", "migrations");

const files = [
  "0001_schema.sql",
  "0002_security_policies.sql",
  "0003_seed_demo_data.sql",
];

function run(file) {
  const full = path.join(setupDir, file);
  console.log(`\n>> ${file}`);
  const result = spawnSync(
    "supabase",
    ["db", "query", "--linked", "-f", full, "--agent=no"],
    { cwd: root, encoding: "utf8", shell: true },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Failed: ${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log("BinGO Supabase setup");
for (const file of files) run(file);

console.log("\n>> verify leaderboard");
const verifyQuery =
  "SELECT display_name, total_points, user_id FROM public.leaderboard_scores ORDER BY total_points DESC;";
const verify = spawnSync(
  "supabase",
  ["db", "query", "--linked", "--agent=no", "-o", "table", `"${verifyQuery}"`],
  { cwd: root, encoding: "utf8", shell: true },
);
if (verify.stdout) process.stdout.write(verify.stdout);
if (verify.stderr) process.stderr.write(verify.stderr);

console.log("\nDone.");
