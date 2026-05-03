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
      displayName,
    };
  } catch {
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

  try {
    await supabase.from("leaderboard_scores").upsert(
      {
        user_id: identity.id,
        display_name: identity.displayName,
        total_points: capturePoints + missionBonusPoints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch {
    // Keep local flow resilient when leaderboard sync fails.
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
  await syncCurrentUserLeaderboardScore(userKey);

  return record;
}

export async function awardMissionXp(
  points: number,
  userKey?: string,
): Promise<number> {
  const current = await readMissionBonusPoints(userKey);
  const updated = current + Math.max(0, Number(points) || 0);
  await writeMissionBonusPoints(updated, userKey);
  await syncCurrentUserLeaderboardScore(userKey);
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

export async function getCaptureStats(userKey?: string) {
  const records = await readRecordsForUser(userKey);
  const total = records.length;
  const capturePoints = records.reduce((sum, record) => sum + record.points, 0);
  const missionBonusPoints = await readMissionBonusPoints(userKey);
  const totalPoints = capturePoints + missionBonusPoints;

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
