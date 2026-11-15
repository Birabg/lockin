import { describe, expect, it } from "vitest";
import { chapterAt, chapterRange, estimateTimelapseSec, sessionChapters } from "./chapters";

const base = { startedAt: "2026-11-15T08:00:00Z", pausedSec: 0, goalMin: 25 };

describe("sessionChapters", () => {
  it("is one locked-in chapter below the goal", () => {
    const { chapters, goalHit, pct } = sessionChapters({ ...base, durationSec: 20 * 60 });
    expect(chapters).toEqual([{ kind: "focus", from: 0, to: 1200 }]);
    expect(goalHit).toBe(false);
    expect(pct).toBeCloseTo(0.8);
  });

  it("adds a goal chapter from the goal to the end", () => {
    const { chapters, goalHit } = sessionChapters({ ...base, durationSec: 30 * 60 });
    expect(goalHit).toBe(true);
    expect(chapters).toEqual([
      { kind: "focus", from: 0, to: 1500 },
      { kind: "goal", from: 1500, to: 1800 },
    ]);
  });

  it("has no empty goal chapter when it ends right on the goal", () => {
    const { chapters, goalHit } = sessionChapters({ ...base, durationSec: 25 * 60 });
    expect(goalHit).toBe(true);
    expect(chapters).toHaveLength(1);
  });

  it("never invents breaks from the paused total", () => {
    const { chapters } = sessionChapters({ ...base, pausedSec: 600, durationSec: 30 * 60 });
    expect(chapters.some((c) => c.kind === "break")).toBe(false);
  });
});

describe("chapterRange", () => {
  it("gives clock times when the session never paused", () => {
    expect(chapterRange({ ...base, durationSec: 1800 }, { kind: "goal", from: 1500, to: 1800 }, "UTC")).toBe("8:25–8:30 AM");
  });

  it("falls back to focused time when pauses moved things", () => {
    expect(chapterRange({ ...base, pausedSec: 60, durationSec: 1800 }, { kind: "goal", from: 1500, to: 1800 }, "UTC")).toBe(
      "25:00–30:00 focused",
    );
  });
});

it("keeps both periods when a chapter crosses noon", () => {
  const s = { ...base, startedAt: "2026-11-15T11:50:00Z", durationSec: 1800 };
  expect(chapterRange(s, { kind: "goal", from: 600, to: 1800 }, "UTC")).toBe("12:00–12:20 PM");
  expect(chapterRange(s, { kind: "focus", from: 0, to: 600 }, "UTC")).toBe("11:50 AM–12:00 PM");
});

describe("chapterAt", () => {
  it("finds the chapter under a point on the strip", () => {
    const { chapters, total } = sessionChapters({ ...base, durationSec: 30 * 60 });
    expect(chapterAt(chapters, total, 0.5).kind).toBe("focus");
    expect(chapterAt(chapters, total, 0.9).kind).toBe("goal");
  });
});

describe("estimateTimelapseSec", () => {
  it("is about an hour per 30 seconds, kept in a sane range", () => {
    expect(estimateTimelapseSec(3600)).toBe(30);
    expect(estimateTimelapseSec(10)).toBe(1);
    expect(estimateTimelapseSec(36000)).toBe(60);
  });
});
