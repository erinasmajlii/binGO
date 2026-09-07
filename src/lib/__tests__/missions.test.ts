import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearMockAsyncStorage } from "./setup";
import {
  getDailyMissions,
  getWeeklyMissions,
  getMissionProgress,
  claimMissionReward,
  isMissionClaimed,
  claimMissionRemote,
  syncClaimedMissionsFromServer,
} from "../missions";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

function makeSelectBuilder(result: { data: any; error: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  clearMockAsyncStorage();
  mocks.rpc.mockReset();
  mocks.from.mockReset();
});

describe("getMissionProgress", () => {
  const mission = {
    id: "x",
    title: "t",
    description: "d",
    reward: "+100 EcoXP",
    rewardXP: 100,
    progressScope: "today" as const,
    progressTarget: 5,
    progressLabel: "reports today",
  };

  it("computes percent and completed correctly below target", () => {
    const progress = getMissionProgress(mission, { todayCount: 2, weekCount: 0 });
    expect(progress.current).toBe(2);
    expect(progress.target).toBe(5);
    expect(progress.percent).toBe(40);
    expect(progress.completed).toBe(false);
  });

  it("clamps progress at the target and marks completed", () => {
    const progress = getMissionProgress(mission, { todayCount: 9, weekCount: 0 });
    expect(progress.current).toBe(5);
    expect(progress.percent).toBe(100);
    expect(progress.completed).toBe(true);
  });

  it("never returns a negative or NaN percent for weird inputs", () => {
    const progress = getMissionProgress(mission, { todayCount: -3, weekCount: 0 });
    expect(progress.current).toBe(0);
    expect(progress.percent).toBe(0);
    expect(Number.isNaN(progress.percent)).toBe(false);
  });
});

describe("getDailyMissions / getWeeklyMissions", () => {
  it("returns exactly 5 daily missions with unique ids", async () => {
    const missions = await getDailyMissions();
    expect(missions).toHaveLength(5);
    expect(new Set(missions.map((m) => m.id)).size).toBe(5);
  });

  it("returns exactly 5 weekly missions with unique ids", async () => {
    const missions = await getWeeklyMissions();
    expect(missions).toHaveLength(5);
    expect(new Set(missions.map((m) => m.id)).size).toBe(5);
  });

  it("returns the same set on a second call within the same window (cached)", async () => {
    const first = await getDailyMissions();
    const second = await getDailyMissions();
    expect(second.map((m) => m.id).sort()).toEqual(first.map((m) => m.id).sort());
  });
});

describe("claimMissionReward / isMissionClaimed", () => {
  it("a mission is not claimed until claimMissionReward is called", async () => {
    const missions = await getDailyMissions();
    const target = missions[0];
    expect(await isMissionClaimed("daily", target.id)).toBe(false);

    await claimMissionReward("daily", target.id);
    expect(await isMissionClaimed("daily", target.id)).toBe(true);
  });

  it("claiming the same mission twice does not duplicate it in claimedMissionIds", async () => {
    const missions = await getDailyMissions();
    const target = missions[0];

    const state1 = await claimMissionReward("daily", target.id);
    const state2 = await claimMissionReward("daily", target.id);

    expect(state1.claimedMissionIds.filter((id) => id === target.id)).toHaveLength(1);
    expect(state2.claimedMissionIds.filter((id) => id === target.id)).toHaveLength(1);
  });

  it("claiming a daily mission does not affect weekly claim state", async () => {
    const daily = await getDailyMissions();
    const weekly = await getWeeklyMissions();

    await claimMissionReward("daily", daily[0].id);

    expect(await isMissionClaimed("weekly", weekly[0].id)).toBe(false);
  });
});

describe("claimMissionRemote", () => {
  it("calls claim_mission with the mission's own reward amount and marks it claimed locally on success", async () => {
    mocks.rpc.mockResolvedValue({ data: 220, error: null });

    const missions = await getDailyMissions("user-1");
    const target = missions[0];

    const result = await claimMissionRemote("daily", target, "Testy", "user-1");

    expect(result).toEqual({ status: "claimed", newTotal: 220 });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_mission", {
      p_category: "daily",
      p_mission_id: target.id,
      p_period_key: expect.any(String),
      p_reward_xp: target.rewardXP,
      p_display_name: "Testy",
    });
    expect(await isMissionClaimed("daily", target.id, "user-1")).toBe(true);
  });

  it("treats a unique-violation (already claimed on another device) as already_claimed, not an error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "Mission already claimed" },
    });

    const missions = await getDailyMissions("user-2");
    const target = missions[0];

    const result = await claimMissionRemote("daily", target, "Testy", "user-2");

    expect(result).toEqual({ status: "already_claimed" });
    // The local cache is synced to match server truth even though this
    // call didn't grant new XP.
    expect(await isMissionClaimed("daily", target.id, "user-2")).toBe(true);
  });

  it("surfaces a real error (e.g. an invalid amount rejected server-side) without marking it claimed", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "22003", message: "Invalid amount: must be between 1 and 2000" },
    });

    const missions = await getDailyMissions("user-3");
    const target = missions[0];

    const result = await claimMissionRemote("daily", target, "Testy", "user-3");

    expect(result.status).toBe("error");
    expect(await isMissionClaimed("daily", target.id, "user-3")).toBe(false);
  });
});

describe("syncClaimedMissionsFromServer", () => {
  it("merges server-reported claims into the local cache", async () => {
    const missions = await getDailyMissions("user-4");
    const alreadyClaimedRemotely = missions[1];

    mocks.from.mockReturnValue(
      makeSelectBuilder({ data: [{ mission_id: alreadyClaimedRemotely.id }], error: null }),
    );

    expect(await isMissionClaimed("daily", alreadyClaimedRemotely.id, "user-4")).toBe(false);

    await syncClaimedMissionsFromServer("daily", "user-4");

    expect(await isMissionClaimed("daily", alreadyClaimedRemotely.id, "user-4")).toBe(true);
  });

  it("leaves the local cache untouched if the server read fails", async () => {
    const missions = await getDailyMissions("user-5");
    mocks.from.mockReturnValue(makeSelectBuilder({ data: null, error: { message: "boom" } }));

    await syncClaimedMissionsFromServer("daily", "user-5");

    expect(await isMissionClaimed("daily", missions[0].id, "user-5")).toBe(false);
  });
});
