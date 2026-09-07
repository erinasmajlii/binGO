import { describe, it, expect } from "vitest";
import { distanceInMeters, formatDistance } from "../geo";

describe("distanceInMeters", () => {
  it("returns 0 for identical points", () => {
    expect(distanceInMeters(41.3275, 19.8187, 41.3275, 19.8187)).toBe(0);
  });

  it("matches the known quarter-meridian distance (equator to pole) within 0.2%", () => {
    // A textbook reference distance: ~10,007.5 km, independent of any
    // city-coordinate guesswork.
    const d = distanceInMeters(0, 0, 90, 0);
    expect(d).toBeGreaterThan(9_987_000);
    expect(d).toBeLessThan(10_028_000);
  });

  it("is symmetric", () => {
    const a = distanceInMeters(41.3275, 19.8187, 41.33, 19.82);
    const b = distanceInMeters(41.33, 19.82, 41.3275, 19.8187);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("formatDistance", () => {
  it("renders null as an empty string", () => {
    expect(formatDistance(null)).toBe("");
  });

  it("renders sub-kilometer distances in meters", () => {
    expect(formatDistance(42)).toBe("42 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("renders kilometer-plus distances in km with 2 decimals", () => {
    expect(formatDistance(1000)).toBe("1.00 km");
    expect(formatDistance(15500)).toBe("15.50 km");
  });
});
