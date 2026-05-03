// Simple Node script to query Supabase REST for Top-3 leaderboard
// Usage: set environment variables SUPABASE_URL and SUPABASE_KEY, then run `node scripts/check_leaderboard.js`

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  process.exit(2);
}

(async () => {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/leaderboard_scores?select=display_name,total_points&order=total_points.desc&limit=3`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Request failed:', res.status, res.statusText, text);
      process.exit(3);
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error querying Supabase:', err.message || err);
    process.exit(1);
  }
})();
