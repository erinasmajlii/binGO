import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type TrashCategory =
  | "cardboard"
  | "glass"
  | "metal"
  | "paper"
  | "plastic"
  | "trash";

export type CaptureRecord = {
  id: string;
  uri: string;
  category: TrashCategory;
  confidence: number;
  createdAt: number;
  points: number;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  score: number;
};

const STORAGE_KEY_PREFIX = "bingo:capture-records:v2";
const MISSION_BONUS_STORAGE_KEY_PREFIX = "bingo:mission-bonus:v1";
const SYNCED_LOCAL_XP_KEY_PREFIX = "bingo:synced-local-xp:v1";

// Static NPC players for leaderboard benchmarks
const NPC_PLAYERS: LeaderboardEntry[] = [
  { rank: 0, name: "Erina", score: 289200 },
  { rank: 0, name: "Art", score: 253000 },
  { rank: 0, name: "Kenan", score: 250000 },
];

const DATASET_COUNTS: Record<TrashCategory, number> = {
  cardboard: 403,
  glass: 501,
  metal: 410,
  paper: 594,
  plastic: 482,
  trash: 137,
};

export const CATEGORY_LABELS: Record<TrashCategory, string> = {
  cardboard: "Cardboard",
  glass: "Glass",
  metal: "Metal",
  paper: "Paper",
  plastic: "Plastic",
  trash: "General Trash",
};

export const CATEGORY_COLORS: Record<
  TrashCategory,
  { text: string; bg: string; border: string }
> = {
  cardboard: { text: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  glass: { text: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  metal: { text: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
  paper: { text: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  plastic: { text: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  trash: { text: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
};

const CATEGORIES = Object.keys(DATASET_COUNTS) as TrashCategory[];

function toConfidence(value: number): number {
  return Number(Math.max(0.61, Math.min(0.99, value)).toFixed(2));
}

function pickWeightedCategory(): TrashCategory {
  const total = CATEGORIES.reduce(
    (sum, category) => sum + DATASET_COUNTS[category],
    0,
  );
  let threshold = Math.random() * total;

  for (const category of CATEGORIES) {
    threshold -= DATASET_COUNTS[category];
    if (threshold <= 0) return category;
  }

  return "plastic";
}

function inferCategoryFromUri(uri: string): TrashCategory | null {
  const value = uri.toLowerCase();
  for (const category of CATEGORIES) {
    if (value.includes(category)) {
      return category;
    }
  }
  return null;
}

function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

async function getStorageKey(userKey?: string): Promise<string> {
  if (userKey && userKey.trim()) {
    return `${STORAGE_KEY_PREFIX}:${normalizeKeyPart(userKey)}`;
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const candidate = user?.id || user?.email;
      if (candidate) {
        return `${STORAGE_KEY_PREFIX}:${normalizeKeyPart(candidate)}`;
      }
    } catch {
      // Fallback to guest key when session lookup fails.
    }
  }

  return `${STORAGE_KEY_PREFIX}:guest`;
}

async function readRecordsForUser(userKey?: string): Promise<CaptureRecord[]> {
  const storageKey = await getStorageKey(userKey);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as CaptureRecord[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((record) =>
      Boolean(record?.id && record?.uri && record?.category),
    );
  } catch {
    return [];
  }
}

async function writeRecordsForUser(
  records: CaptureRecord[],
  userKey?: string,
): Promise<void> {
  const storageKey = await getStorageKey(userKey);
  await AsyncStorage.setItem(storageKey, JSON.stringify(records));
}

async function getMissionBonusStorageKey(userKey?: string): Promise<string> {
  if (userKey && userKey.trim()) {
    return `${MISSION_BONUS_STORAGE_KEY_PREFIX}:${normalizeKeyPart(userKey)}`;
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const candidate = user?.id || user?.email;
      if (candidate) {
        return `${MISSION_BONUS_STORAGE_KEY_PREFIX}:${normalizeKeyPart(candidate)}`;
      }
    } catch {
      // Fallback to guest key when session lookup fails.
    }
  }

  return `${MISSION_BONUS_STORAGE_KEY_PREFIX}:guest`;
}

async function readMissionBonusPoints(userKey?: string): Promise<number> {
  const storageKey = await getMissionBonusStorageKey(userKey);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as { points?: number };
    return Number(parsed?.points || 0);
  } catch {
    return 0;
  }
}

async function writeMissionBonusPoints(
  points: number,
  userKey?: string,
): Promise<void> {
  const storageKey = await getMissionBonusStorageKey(userKey);
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ points, updatedAt: Date.now() }),
  );
}

async function getSyncedLocalXpStorageKey(userKey?: string): Promise<string> {
  if (userKey && userKey.trim()) {
    return `${SYNCED_LOCAL_XP_KEY_PREFIX}:${normalizeKeyPart(userKey)}`;
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const candidate = user?.id || user?.email;
      if (candidate) {
        return `${SYNCED_LOCAL_XP_KEY_PREFIX}:${normalizeKeyPart(candidate)}`;
      }
    } catch {
      // Fallback to guest key when session lookup fails.
    }
  }

  return `${SYNCED_LOCAL_XP_KEY_PREFIX}:guest`;
}

async function readSyncedLocalXp(userKey?: string): Promise<number> {
  const storageKey = await getSyncedLocalXpStorageKey(userKey);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as { points?: number };
    return Number(parsed?.points || 0);
  } catch {
    return 0;
  }
}

async function writeSyncedLocalXp(
  points: number,
  userKey?: string,
): Promise<void> {
  const storageKey = await getSyncedLocalXpStorageKey(userKey);
  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ points, updatedAt: Date.now() }),
  );
}

async function getCurrentUserIdentity() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;

    const displayNameFromMeta = user.user_metadata?.name;
    const displayNameFromEmail = user.email?.split("@")[0];
    const displayName =
      String(displayNameFromMeta || displayNameFromEmail || "User").trim() ||
      "User";

    return {
      id: user.id,
      email: user.email ?? "",
      displayName,
    };
  } catch {
    return null;
  }
}

/**
 * Increment EcoXP in the DB for the current user.
 *
 * Strategy:
 *  1. Write to `leaderboard_scores` table.
 *     New value = max(current total_points + amount, all local XP accumulated).
 *     This means:
 *       - Hardcoded base scores (e.g. Art = 10 000) are preserved and grow.
 *       - Previously unsynced local scans are caught up in the same write.
 *  2. The `display_exp` view is read-only and will automatically reflect the changes.
 */
async function incrementUserEcoXpInDb(
  amount: number,
  userKey?: string,
): Promise<number | null> {
  if (!supabase || amount <= 0) return null;

  const identity = await getCurrentUserIdentity();
  if (!identity) return null;

  try {
    // --- Read local total (includes the new record already saved by the caller) ---
    const records = await readRecordsForUser(userKey);
    const missionBonusPoints = await readMissionBonusPoints(userKey);
    const localTotal =
      records.reduce((sum, item) => sum + item.points, 0) + missionBonusPoints;

    // ── leaderboard_scores (primary store) ───────────────────────────────
    const { data: lbRow } = await supabase
      .from("leaderboard_scores")
      .select("total_points")
      .eq("user_id", identity.id)
      .maybeSingle();

    const currentLbXp = Number((lbRow as any)?.total_points ?? 0);
    // Preserve manually-set base scores (e.g. Art = 10 000) + add new XP.
    // Also catches up previously-unsynced local scans.
    const newLbXp = Math.max(currentLbXp + amount, localTotal);

    if (lbRow !== null) {
      // Row exists → UPDATE
      const { error: lbUpdErr } = await supabase
        .from("leaderboard_scores")
        .update({
          display_name: identity.displayName,
          total_points: newLbXp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", identity.id);
      if (lbUpdErr) {
        console.error("[XP] leaderboard update error:", lbUpdErr.message);
        return null;
      }
    } else {
      // No row yet → INSERT
      const { error: lbInsErr } = await supabase
        .from("leaderboard_scores")
        .insert({
          user_id: identity.id,
          display_name: identity.displayName,
          total_points: newLbXp,
          updated_at: new Date().toISOString(),
        });
      if (lbInsErr) {
        console.error("[XP] leaderboard insert error:", lbInsErr.message);
        return null;
      }
    }

    await writeSyncedLocalXp(localTotal, userKey);
    console.log(
      `[XP] +${amount} → leaderboard=${newLbXp} localTotal=${localTotal}`,
    );
    return newLbXp;
  } catch (ex) {
    console.error("[XP] incrementUserEcoXpInDb exception:", ex);
    return null;
  }
}

async function syncCurrentUserLeaderboardScore(
  userKey?: string,
): Promise<void> {
  if (!supabase) return;

  const identity = await getCurrentUserIdentity();
  if (!identity) return;

  const records = await readRecordsForUser(userKey);
  const missionBonusPoints = await readMissionBonusPoints(userKey);
  const capturePoints = records.reduce((sum, item) => sum + item.points, 0);
  const localTotal = capturePoints + missionBonusPoints;

  try {
    // ── leaderboard_scores (primary store) ───────────────────────────────────
    const { data: lbRow } = await supabase
      .from("leaderboard_scores")
      .select("total_points")
      .eq("user_id", identity.id)
      .maybeSingle();

    const dbTotal = Number((lbRow as any)?.total_points ?? 0);
    const syncedLocalXp = await readSyncedLocalXp(userKey);
    const delta = Math.max(0, localTotal - syncedLocalXp);
    const newLbTotal =
      dbTotal > localTotal && delta === 0 ? dbTotal : dbTotal + delta;

    if (lbRow !== null) {
      const { error: lbUpdErr } = await supabase
        .from("leaderboard_scores")
        .update({
          display_name: identity.displayName,
          total_points: newLbTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", identity.id);
      if (lbUpdErr)
        console.error("[XP] sync leaderboard update error:", lbUpdErr.message);
    } else {
      const { error: lbInsErr } = await supabase
        .from("leaderboard_scores")
        .insert({
          user_id: identity.id,
          display_name: identity.displayName,
          total_points: newLbTotal,
          updated_at: new Date().toISOString(),
        });
      if (lbInsErr)
        console.error("[XP] sync leaderboard insert error:", lbInsErr.message);
    }

    await writeSyncedLocalXp(localTotal, userKey);
  } catch (ex) {
    console.error("[XP] syncCurrentUserLeaderboardScore exception:", ex);
  }
}

/**
 * Fetch authoritative EcoXP for a user from the DB.
 * Reads `display_exp` first (UNRESTRICTED, no RLS), falls back to
 * `leaderboard_scores` so older users without a display_exp row still work.
 */
export async function fetchUserEcoXpFromDb(userId: string): Promise<number> {
  if (!supabase) return 0;

  try {
    // Primary: display_exp (UNRESTRICTED – always readable)
    const { data: displayRow } = await supabase
      .from("display_exp")
      .select("ecoxp")
      .eq("user_id", userId)
      .maybeSingle();

    const displayXp = Number((displayRow as any)?.ecoxp ?? 0);
    if (displayXp > 0) return displayXp;

    // Fallback: leaderboard_scores
    const { data: lbRow } = await supabase
      .from("leaderboard_scores")
      .select("total_points")
      .eq("user_id", userId)
      .maybeSingle();

    return Number((lbRow as any)?.total_points ?? 0);
  } catch {
    return 0;
  }
}

export async function classifyTrashPhoto(
  uri: string,
): Promise<{ category: TrashCategory; confidence: number }> {
  const inferred = inferCategoryFromUri(uri);
  if (inferred) {
    return {
      category: inferred,
      confidence: toConfidence(0.86 + Math.random() * 0.1),
    };
  }

  return {
    category: pickWeightedCategory(),
    confidence: toConfidence(0.65 + Math.random() * 0.25),
  };
}

export async function saveCaptureRecord(
  uri: string,
  category: TrashCategory,
  confidence: number,
  userKey?: string,
): Promise<CaptureRecord> {
  const record: CaptureRecord = {
    id: `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    uri,
    category,
    confidence: toConfidence(confidence),
    createdAt: Date.now(),
    points: 100,
  };

  const records = await readRecordsForUser(userKey);
  records.unshift(record);

  const trimmedRecords = records.slice(0, 300);
  await writeRecordsForUser(trimmedRecords, userKey);
  await incrementUserEcoXpInDb(record.points, userKey);

  return record;
}

export async function awardMissionXp(
  points: number,
  userKey?: string,
): Promise<number> {
  const amount = Math.max(0, Number(points) || 0);
  const current = await readMissionBonusPoints(userKey);
  const updated = current + amount;
  await writeMissionBonusPoints(updated, userKey);

  const dbTotal = await incrementUserEcoXpInDb(amount, userKey);
  if (dbTotal === null) {
    await syncCurrentUserLeaderboardScore(userKey);
  }

  return updated;
}

export async function getGlobalLeaderboard(
  limit = 20,
): Promise<LeaderboardEntry[]> {
  if (!supabase) {
    // If no Supabase, return only NPCs with proper ranking
    const sorted = [...NPC_PLAYERS].sort((a, b) => b.score - a.score);
    return sorted.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("leaderboard_scores")
      .select("display_name,total_points")
      .order("total_points", { ascending: false })
      .limit(limit * 2); // Fetch extra to account for NPCs

    if (error || !Array.isArray(data)) {
      // If fetch fails, return only NPCs with proper ranking
      const sorted = [...NPC_PLAYERS].sort((a, b) => b.score - a.score);
      return sorted.slice(0, limit).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    }

    // Convert real users to LeaderboardEntry format
    const realUsers = data
      .map((row) => ({
        rank: 0, // Will be set after sorting
        name: String((row as any).display_name || "User"),
        score: Number((row as any).total_points || 0),
      }))
      .filter((row) => row.score >= 0);

    // Combine real users with NPC players
    const combinedList = [...realUsers, ...NPC_PLAYERS];

    // Sort by score descending, then by name for stable ordering
    const sorted = combinedList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });

    // Add proper ranking and return top N
    return sorted.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  } catch {
    // On any error, return NPCs with proper ranking
    const sorted = [...NPC_PLAYERS].sort((a, b) => b.score - a.score);
    return sorted.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }
}

function calculateStreak(records: CaptureRecord[]): number {
  if (records.length === 0) return 0;

  const days = new Set(
    records.map((record) => {
      const date = new Date(record.createdAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }),
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function getCaptureStats(
  userKey?: string,
  leaderboardTotal?: number,
) {
  const records = await readRecordsForUser(userKey);
  const total = records.length;
  const capturePoints = records.reduce((sum, record) => sum + record.points, 0);
  const missionBonusPoints = await readMissionBonusPoints(userKey);
  const localPoints = capturePoints + missionBonusPoints;
  const totalPoints =
    typeof leaderboardTotal === "number" && leaderboardTotal >= localPoints
      ? leaderboardTotal
      : localPoints;

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - now.getDay(),
    0,
    0,
    0,
    0,
  ).getTime();
  const todayCount = records.filter(
    (record) => record.createdAt >= startOfDay,
  ).length;
  const weekCount = records.filter(
    (record) => record.createdAt >= startOfWeek,
  ).length;

  const breakdown = CATEGORIES.map((category) => {
    const count = records.filter(
      (record) => record.category === category,
    ).length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      category,
      label: CATEGORY_LABELS[category],
      count,
      percent,
      colors: CATEGORY_COLORS[category],
    };
  }).sort((a, b) => b.count - a.count);

  const recent = records.filter((record) => record.createdAt >= startOfWeek);

  return {
    total,
    todayCount,
    weekCount,
    missionBonusPoints,
    totalPoints,
    streak: calculateStreak(records),
    weeklyRate: Number((recent.length / 7).toFixed(1)),
    breakdown,
    recentPhotos: records.slice(0, 8),
    datasetCounts: DATASET_COUNTS,
  };
}
