import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Mission = {
  id: string;
  title: string;
  description: string;
  reward: string;
  rewardXP: number;
  progressScope: "today" | "week";
  progressTarget: number;
  progressLabel: string;
};

export type MissionCategory = "daily" | "weekly";

export type StoredMissions = {
  category: MissionCategory;
  missions: Mission[];
  lastFetchedAt: number;
  nextRefreshAt: number;
  claimedMissionIds: string[];
};

export type MissionProgressContext = {
  todayCount: number;
  weekCount: number;
};

export type MissionProgress = {
  current: number;
  target: number;
  percent: number;
  completed: boolean;
};

export type ClaimMissionResult =
  | { status: "claimed"; newTotal: number }
  | { status: "already_claimed" }
  | { status: "error"; message: string };

const STORAGE_KEY_DAILY = "bingo_missions_daily_v1";
const STORAGE_KEY_WEEKLY = "bingo_missions_weekly_v1";

function getStorageKey(base: string, userKey: string): string {
  return `${base}:${userKey}`;
}

// Sample mission pools - in a real app, these would come from an API
const DAILY_MISSION_POOL: Mission[] = [
  {
    id: "daily-1",
    title: "Spot & report 1 trash pile",
    description: "Capture one clear photo of litter in your area.",
    reward: "+120 EcoXP",
    rewardXP: 120,
    progressScope: "today",
    progressTarget: 1,
    progressLabel: "reports today",
  },
  {
    id: "daily-2",
    title: "Report 2 trash locations",
    description: "Find and report two different trash locations today.",
    reward: "+240 EcoXP",
    rewardXP: 240,
    progressScope: "today",
    progressTarget: 2,
    progressLabel: "reports today",
  },
  {
    id: "daily-3",
    title: "Classify 3 items",
    description: "Classify three different types of trash.",
    reward: "+150 EcoXP",
    rewardXP: 150,
    progressScope: "today",
    progressTarget: 3,
    progressLabel: "reports today",
  },
  {
    id: "daily-4",
    title: "Visit a new location",
    description: "Report trash from a location you haven't been to before.",
    reward: "+180 EcoXP",
    rewardXP: 180,
    progressScope: "today",
    progressTarget: 2,
    progressLabel: "reports today",
  },
  {
    id: "daily-5",
    title: "Photo streak",
    description: "Take and report photos at 3 different times today.",
    reward: "+200 EcoXP",
    rewardXP: 200,
    progressScope: "today",
    progressTarget: 3,
    progressLabel: "reports today",
  },
];

const WEEKLY_MISSION_POOL: Mission[] = [
  {
    id: "weekly-1",
    title: "5 verified cleanups",
    description: "Complete five verified cleanup missions this week.",
    reward: "+1,200 EcoXP",
    rewardXP: 1200,
    progressScope: "week",
    progressTarget: 5,
    progressLabel: "reports this week",
  },
  {
    id: "weekly-2",
    title: "Cover all waste types",
    description: "Report trash from all 6 waste categories this week.",
    reward: "+1,500 EcoXP",
    rewardXP: 1500,
    progressScope: "week",
    progressTarget: 6,
    progressLabel: "reports this week",
  },
  {
    id: "weekly-3",
    title: "Consistency champion",
    description: "Report trash on at least 5 different days this week.",
    reward: "+1,000 EcoXP",
    rewardXP: 1000,
    progressScope: "week",
    progressTarget: 5,
    progressLabel: "reports this week",
  },
  {
    id: "weekly-4",
    title: "Community cleaner",
    description: "Encourage 3 friends to join and start reporting.",
    reward: "+800 EcoXP",
    rewardXP: 800,
    progressScope: "week",
    progressTarget: 3,
    progressLabel: "reports this week",
  },
  {
    id: "weekly-5",
    title: "Area mapper",
    description: "Report trash from 10 different locations this week.",
    reward: "+2,000 EcoXP",
    rewardXP: 2000,
    progressScope: "week",
    progressTarget: 10,
    progressLabel: "reports this week",
  },
];

function getRandomMissions(pool: Mission[], count: number): Mission[] {
  // Fisher-Yates: sort(() => 0.5 - Math.random()) is a well-known broken
  // shuffle that does not produce a uniform permutation.
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, pool.length));
}

function getNow(): number {
  return Date.now();
}

function getMidnightTonight(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return tomorrow.getTime();
}

function getNextWeekReset(): number {
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, 0, 0, 0, 0);
  return nextMonday.getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * A stable key identifying the current reset period for a category (e.g.
 * '2026-09-07' for daily, or the Monday date of the current week for
 * weekly). Sent to the claim_mission RPC so the server can enforce
 * "once per period" independent of any device's local clock quirks beyond
 * this key itself — it only needs to change when a new period starts.
 */
function getPeriodKey(category: MissionCategory): string {
  const now = new Date();

  if (category === "daily") {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
}

async function loadStoredMissions(key: string): Promise<StoredMissions | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredMissions;
    if (
      !parsed ||
      typeof parsed.lastFetchedAt !== "number" ||
      typeof parsed.nextRefreshAt !== "number" ||
      !Array.isArray(parsed.missions)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function saveStoredMissions(key: string, missions: StoredMissions): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(missions));
  } catch {
    // Ignore storage errors
  }
}

async function ensureStoredMissions(category: MissionCategory, userKey = "guest"): Promise<StoredMissions> {
  const key = getStorageKey(category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY, userKey);
  const stored = await loadStoredMissions(key);
  const now = getNow();

  if (stored && now < stored.nextRefreshAt) {
    return {
      ...stored,
      claimedMissionIds: Array.isArray(stored.claimedMissionIds) ? stored.claimedMissionIds : [],
    };
  }

  const pool = category === "daily" ? DAILY_MISSION_POOL : WEEKLY_MISSION_POOL;
  const missions = getRandomMissions(pool, 5);

  const updated: StoredMissions = {
    category,
    missions,
    lastFetchedAt: now,
    nextRefreshAt: category === "daily" ? getMidnightTonight() : getNextWeekReset(),
    claimedMissionIds: [],
  };

  await saveStoredMissions(key, updated);
  return updated;
}

export async function getDailyMissions(userKey = "guest"): Promise<Mission[]> {
  const stored = await ensureStoredMissions("daily", userKey);
  return stored.missions;
}

export async function getWeeklyMissions(userKey = "guest"): Promise<Mission[]> {
  const stored = await ensureStoredMissions("weekly", userKey);
  return stored.missions;
}

export async function getDailyMissionState(userKey = "guest"): Promise<StoredMissions> {
  return ensureStoredMissions("daily", userKey);
}

export async function getWeeklyMissionState(userKey = "guest"): Promise<StoredMissions> {
  return ensureStoredMissions("weekly", userKey);
}

export async function getFirstDailyMission(userKey = "guest"): Promise<Mission | null> {
  const missions = await getDailyMissions(userKey);
  return missions.length > 0 ? missions[0] : null;
}

export async function getFirstWeeklyMission(userKey = "guest"): Promise<Mission | null> {
  const missions = await getWeeklyMissions(userKey);
  return missions.length > 0 ? missions[0] : null;
}

export async function forceMissionsRefresh(category: MissionCategory, userKey = "guest"): Promise<Mission[]> {
  const key = getStorageKey(category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY, userKey);
  const pool = category === "daily" ? DAILY_MISSION_POOL : WEEKLY_MISSION_POOL;
  const now = getNow();
  const nextRefresh = category === "daily" ? getMidnightTonight() : getNextWeekReset();

  const missions = getRandomMissions(pool, 5);

  const updated: StoredMissions = {
    category,
    missions,
    lastFetchedAt: now,
    nextRefreshAt: nextRefresh,
    claimedMissionIds: [],
  };

  await saveStoredMissions(key, updated);
  return missions;
}

export function getMissionProgress(mission: Mission, context: MissionProgressContext): MissionProgress {
  const target = Number.isFinite(mission.progressTarget) && mission.progressTarget > 0 ? mission.progressTarget : 1;
  const sourceCount = mission.progressScope === "today" ? context.todayCount : context.weekCount;
  const current = Number.isFinite(sourceCount) ? Math.max(0, Math.min(sourceCount, target)) : 0;
  const percent = Math.max(0, Math.min(100, Math.round((current / target) * 100)));

  return {
    current,
    target,
    percent,
    completed: current >= target,
  };
}

/**
 * Local-only claim bookkeeping. This is the fast-path cache that drives the
 * "Claimed" UI state instantly — it is NOT the source of truth for whether
 * XP was actually granted once a real user session exists (see
 * claimMissionRemote below, which is server-authoritative and dedupes
 * across devices). Guests (no session) have no server to claim against, so
 * this remains the only bookkeeping for them.
 */
export async function claimMissionReward(
  category: MissionCategory,
  missionId: string,
  userKey = "guest",
): Promise<StoredMissions> {
  const key = getStorageKey(category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY, userKey);
  const state = await ensureStoredMissions(category, userKey);

  if (state.claimedMissionIds.includes(missionId)) {
    return state;
  }

  const updated: StoredMissions = {
    ...state,
    claimedMissionIds: [...state.claimedMissionIds, missionId],
  };

  await saveStoredMissions(key, updated);
  return updated;
}

export async function isMissionClaimed(
  category: MissionCategory,
  missionId: string,
  userKey = "guest",
): Promise<boolean> {
  const state = await ensureStoredMissions(category, userKey);
  return state.claimedMissionIds.includes(missionId);
}

/**
 * Server-authoritative claim: atomically records the claim in
 * `mission_claims` and awards XP via the `claim_mission` RPC in one
 * transaction (see supabase/migrations/0005_mission_claims.sql). A second
 * device (or a reinstall) attempting to claim the same
 * (category, mission, period) is rejected with "already_claimed" instead of
 * granting XP twice.
 *
 * Requires a real session — callers should fall back to the local-only
 * claimMissionReward()+manual XP bookkeeping for guests.
 */
export async function claimMissionRemote(
  category: MissionCategory,
  mission: Mission,
  displayName: string,
  userKey = "guest",
): Promise<ClaimMissionResult> {
  if (!supabase) {
    return { status: "error", message: "Not connected to the server." };
  }

  const { data, error } = await supabase.rpc("claim_mission", {
    p_category: category,
    p_mission_id: mission.id,
    p_period_key: getPeriodKey(category),
    p_reward_xp: mission.rewardXP,
    p_display_name: displayName,
  });

  if (error) {
    const alreadyClaimed =
      error.code === "23505" || error.message.toLowerCase().includes("already claimed");

    if (alreadyClaimed) {
      // Server says it's already claimed (e.g. from another device) —
      // sync the local cache so the UI reflects that immediately.
      await claimMissionReward(category, mission.id, userKey);
      return { status: "already_claimed" };
    }

    return { status: "error", message: error.message };
  }

  await claimMissionReward(category, mission.id, userKey);
  return { status: "claimed", newTotal: Number(data ?? 0) };
}

/**
 * Pulls the current user's own claimed-mission rows for this category's
 * active period from the server and merges them into the local cache, so a
 * second device shows "Claimed" correctly even before anyone taps claim on
 * it. RLS already scopes mission_claims reads to the caller's own rows.
 */
export async function syncClaimedMissionsFromServer(
  category: MissionCategory,
  userKey = "guest",
): Promise<void> {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from("mission_claims")
      .select("mission_id")
      .eq("category", category)
      .eq("period_key", getPeriodKey(category));

    if (error || !Array.isArray(data)) return;

    const state = await ensureStoredMissions(category, userKey);
    const remoteIds = data.map((row) => row.mission_id);
    const merged = Array.from(new Set([...state.claimedMissionIds, ...remoteIds]));

    if (merged.length !== state.claimedMissionIds.length) {
      const key = getStorageKey(category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY, userKey);
      await saveStoredMissions(key, { ...state, claimedMissionIds: merged });
    }
  } catch {
    // Best-effort sync — local cache stays as-is if this fails (e.g. offline).
  }
}
