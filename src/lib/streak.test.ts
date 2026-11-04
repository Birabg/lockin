import { describe, expect, it } from "vitest";
import { MIN_DAY_SEC, computeStreak } from "./streak";

const days = (...keys: string[]) => new Map(keys.map((k) => [k, 600]));

describe("computeStreak", () => {
  it("is zero with no focus", () => {
    expect(computeStreak(new Map(), "2026-11-04")).toEqual({ current: 0, best: 0 });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(days("2026-11-02", "2026-11-03", "2026-11-04"), "2026-11-04").current).toBe(3);
  });

  it("isn't broken by today not being done yet", () => {
    expect(computeStreak(days("2026-11-02", "2026-11-03"), "2026-11-04").current).toBe(2);
  });

  it("breaks after a missed day", () => {
    expect(computeStreak(days("2026-11-01", "2026-11-02"), "2026-11-04").current).toBe(0);
  });

  it("needs a full minute for a day to count", () => {
    const totals = new Map([
      ["2026-11-03", MIN_DAY_SEC],
      ["2026-11-04", MIN_DAY_SEC - 1],
    ]);
    expect(computeStreak(totals, "2026-11-04")).toEqual({ current: 1, best: 1 });
  });

  it("keeps the best run separately from the current one", () => {
    const totals = days("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-04");
    expect(computeStreak(totals, "2026-11-04")).toEqual({ current: 1, best: 4 });
  });

  it("finds the best run whatever order the days arrive in", () => {
    expect(computeStreak(days("2026-10-03", "2026-10-01", "2026-10-02"), "2026-11-04").best).toBe(3);
  });

  it("runs across a month end", () => {
    expect(computeStreak(days("2026-10-31", "2026-11-01"), "2026-11-01").current).toBe(2);
  });
});
