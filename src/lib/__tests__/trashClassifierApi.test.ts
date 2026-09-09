import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearMockAsyncStorage } from "./setup";
import { classifyTrashPhotoWithModel } from "../trashClassifierApi";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
  },
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { hostUri: undefined } },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

beforeEach(() => {
  clearMockAsyncStorage();
  vi.restoreAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  delete (process.env as any).EXPO_PUBLIC_CLASSIFIER_API_URL;
});

describe("classifyTrashPhotoWithModel", () => {
  it("uses the server's prediction and reports source 'model' when mode is 'model'", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: "plastic", confidence: 0.93, mode: "model" }),
      }),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.category).toBe("plastic");
    expect(result.confidence).toBe(0.93);
    expect(result.source).toBe("model");
  });

  it("reports source 'heuristic-server' when the server itself is only in fallback mode", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: "metal", confidence: 0.5, mode: "fallback" }),
      }),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.category).toBe("metal");
    expect(result.source).toBe("heuristic-server");
  });

  it("falls back to a local heuristic guess when the classifier is completely unreachable (network failure)", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network request failed")),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    // Never silently presented as real AI output when nothing could be reached.
    expect(result.source).toBe("heuristic-local");
    expect(["cardboard", "glass", "metal", "paper", "plastic", "trash"]).toContain(result.category);
  });

  it("falls back to a local heuristic guess when the classifier responds with an error status", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.source).toBe("heuristic-local");
  });

  it("falls back to a local heuristic guess when the server returns a category outside the known set", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: "banana-peel", confidence: 0.9, mode: "model" }),
      }),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.source).toBe("heuristic-local");
  });

  it("clamps an out-of-range confidence value into [0, 1]", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: "glass", confidence: 1.4, mode: "model" }),
      }),
    );

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("handles multiple consecutive scans independently (no shared/stale state between calls)", async () => {
    process.env.EXPO_PUBLIC_CLASSIFIER_API_URL = "http://classifier.example";
    const responses = [
      { category: "paper", confidence: 0.8, mode: "model" },
      { category: "glass", confidence: 0.6, mode: "model" },
      { category: "trash", confidence: 0.4, mode: "model" },
    ];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => ({
        ok: true,
        json: async () => responses[call++],
      })),
    );

    const first = await classifyTrashPhotoWithModel("file://a.jpg");
    const second = await classifyTrashPhotoWithModel("file://b.jpg");
    const third = await classifyTrashPhotoWithModel("file://c.jpg");

    expect([first.category, second.category, third.category]).toEqual(["paper", "glass", "trash"]);
  });

  it("falls back to a local heuristic guess when no classifier endpoint is reachable at all (classifier unavailable)", async () => {
    // No EXPO_PUBLIC_CLASSIFIER_API_URL, no dev hostUri, __DEV__ candidates
    // (127.0.0.1 etc.) still get attempted but all fail here.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const result = await classifyTrashPhotoWithModel("file://photo.jpg");

    expect(result.source).toBe("heuristic-local");
  });
});
