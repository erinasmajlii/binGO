import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearMockAsyncStorage } from "./setup";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

function makeQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const SESSION_USER = {
  data: {
    session: {
      user: { id: "user-1", email: "test@example.com", user_metadata: { name: "Testy" } },
    },
  },
};
const NO_SESSION = { data: { session: null } };

beforeEach(() => {
  clearMockAsyncStorage();
  mocks.getSession.mockReset();
  mocks.rpc.mockReset();
  mocks.from.mockReset();
});

describe("classifyTrashPhoto (offline fallback guess)", () => {
  it("always returns a valid category, a confidence in [0,1], and marks itself as a local heuristic", async () => {
    const { classifyTrashPhoto } = await import("../trashStats");
    const result = await classifyTrashPhoto("file:///data/user/0/app/cache/photo123.jpg");

    expect(["cardboard", "glass", "metal", "paper", "plastic", "trash"]).toContain(result.category);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.source).toBe("heuristic-local");
  });
});

describe("awardMissionXp", () => {
  it("sends the reward amount to the atomic RPC with the user's display name", async () => {
    mocks.getSession.mockResolvedValue(SESSION_USER);
    mocks.rpc.mockResolvedValue({ data: 220, error: null });
    mocks.from.mockReturnValue(makeQueryBuilder({ data: [], error: null }));

    const { awardMissionXp } = await import("../trashStats");
    await awardMissionXp(120, "user-1");

    expect(mocks.rpc).toHaveBeenCalledWith("increment_leaderboard_score", {
      p_amount: 120,
      p_display_name: "Testy",
    });
  });

  it("never sends more than MAX_XP_PER_CALL (2000) in one RPC call, even if asked to", async () => {
    mocks.getSession.mockResolvedValue(SESSION_USER);
    mocks.rpc.mockResolvedValue({ data: 2000, error: null });
    mocks.from.mockReturnValue(makeQueryBuilder({ data: [], error: null }));

    const { awardMissionXp } = await import("../trashStats");
    await awardMissionXp(999999, "user-1");

    const call = mocks.rpc.mock.calls[0];
    expect(call[1].p_amount).toBeLessThanOrEqual(2000);
  });

  it("does not call the RPC at all when there is no session (guest)", async () => {
    mocks.getSession.mockResolvedValue(NO_SESSION);

    const { awardMissionXp } = await import("../trashStats");
    await awardMissionXp(100, "guest");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("fetchUserEcoXpFromDb", () => {
  it("prefers the display_exp view when it has a positive value", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "display_exp") return makeQueryBuilder({ data: { ecoxp: 450 }, error: null });
      return makeQueryBuilder({ data: { total_points: 999 }, error: null });
    });

    const { fetchUserEcoXpFromDb } = await import("../trashStats");
    expect(await fetchUserEcoXpFromDb("user-1")).toBe(450);
  });

  it("falls back to leaderboard_scores when display_exp has no data yet", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "display_exp") return makeQueryBuilder({ data: { ecoxp: 0 }, error: null });
      return makeQueryBuilder({ data: { total_points: 777 }, error: null });
    });

    const { fetchUserEcoXpFromDb } = await import("../trashStats");
    expect(await fetchUserEcoXpFromDb("user-1")).toBe(777);
  });
});

describe("getGlobalLeaderboard", () => {
  it("merges real users with NPC players and sorts by score descending", async () => {
    mocks.from.mockReturnValue(
      makeQueryBuilder({
        data: [
          { display_name: "RealUser", total_points: 5000 },
          { display_name: "AnotherUser", total_points: 100 },
        ],
        error: null,
      }),
    );

    const { getGlobalLeaderboard } = await import("../trashStats");
    const board = await getGlobalLeaderboard(10);

    const scores = board.map((e) => e.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(board.some((e) => e.name === "RealUser")).toBe(true);
    // NPC benchmark players should still be present in the merged list.
    expect(board.some((e) => e.name === "Erina")).toBe(true);
  });

  it("falls back to NPC-only ranking when the query errors", async () => {
    mocks.from.mockReturnValue(makeQueryBuilder({ data: null, error: { message: "boom" } }));

    const { getGlobalLeaderboard } = await import("../trashStats");
    const board = await getGlobalLeaderboard(10);

    expect(board.length).toBeGreaterThan(0);
    expect(board.every((e) => ["Erina", "Art", "Kenan"].includes(e.name))).toBe(true);
  });
});
