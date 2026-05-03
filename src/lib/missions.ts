import AsyncStorage from "@react-native-async-storage/async-storage";

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

const STORAGE_KEY_DAILY = "bingo_missions_daily_v1";
const STORAGE_KEY_WEEKLY = "bingo_missions_weekly_v1";

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
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
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

async function ensureStoredMissions(category: MissionCategory): Promise<StoredMissions> {
  const key = category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY;
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

export async function getDailyMissions(): Promise<Mission[]> {
  const stored = await ensureStoredMissions("daily");
  return stored.missions;
}

export async function getWeeklyMissions(): Promise<Mission[]> {
  const stored = await ensureStoredMissions("weekly");
  return stored.missions;
}

export async function getDailyMissionState(): Promise<StoredMissions> {
  return ensureStoredMissions("daily");
}

export async function getWeeklyMissionState(): Promise<StoredMissions> {
  return ensureStoredMissions("weekly");
}

export async function getFirstDailyMission(): Promise<Mission | null> {
  const missions = await getDailyMissions();
  return missions.length > 0 ? missions[0] : null;
}

export async function getFirstWeeklyMission(): Promise<Mission | null> {
  const missions = await getWeeklyMissions();
  return missions.length > 0 ? missions[0] : null;
}

export async function forceMissionsRefresh(category: MissionCategory): Promise<Mission[]> {
  const key = category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY;
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

export async function claimMissionReward(category: MissionCategory, missionId: string): Promise<StoredMissions> {
  const key = category === "daily" ? STORAGE_KEY_DAILY : STORAGE_KEY_WEEKLY;
  const state = await ensureStoredMissions(category);

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

export async function isMissionClaimed(category: MissionCategory, missionId: string): Promise<boolean> {
  const state = await ensureStoredMissions(category);
  return state.claimedMissionIds.includes(missionId);
}
