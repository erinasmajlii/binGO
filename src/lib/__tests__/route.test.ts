import { describe, it, expect, beforeEach } from "vitest";
import { clearMockAsyncStorage } from "./setup";
import { setActiveRoute, getActiveRoute, clearActiveRoute } from "../route";
import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(() => {
  clearMockAsyncStorage();
});

describe("active route storage", () => {
  const destination = { id: "bin-1", latitude: 41.32, longitude: 19.81, source: "manual" as const };

  it("returns null when nothing has been set", async () => {
    expect(await getActiveRoute()).toBeNull();
  });

  it("round-trips a route through set/get", async () => {
    await setActiveRoute({ destination, createdAt: 123 });
    const route = await getActiveRoute();
    expect(route?.destination).toEqual(destination);
    expect(route?.createdAt).toBe(123);
  });

  it("clears the stored route", async () => {
    await setActiveRoute({ destination, createdAt: 1 });
    await clearActiveRoute();
    expect(await getActiveRoute()).toBeNull();
  });

  it("rejects malformed stored JSON instead of returning garbage", async () => {
    await AsyncStorage.setItem("bingo_active_route_v1", JSON.stringify({ destination: { id: 5 } }));
    expect(await getActiveRoute()).toBeNull();
  });
});
