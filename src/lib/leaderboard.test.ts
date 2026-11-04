import { describe, expect, it } from "vitest";
import { rankTotals } from "./leaderboard";

const now = new Date("2026-11-04T12:00:00Z");
const all = () => true;

const running = (
  userId: string,
  minutesAgo: number,
  extra: Partial<{ timeZone: string; pausedSec: number; pausedAt: Date | null; lastBeatAt: Date }> = {},
) => ({
  userId,
  startedAt: new Date(now.getTime() - minutesAgo * 60_000),
  lastBeatAt: now,
  pausedSec: 0,
  pausedAt: null,
  timeZone: "UTC",
  ...extra,
});

describe("rankTotals", () => {
  it("ranks highest first", () => {
    const ranked = rankTotals(
      [
        { userId: "a", seconds: 100 },
        { userId: "b", seconds: 300 },
      ],
      [],
      all,
      now,
    );
    expect(ranked).toEqual([
      ["b", 300],
      ["a", 100],
    ]);
  });

  it("breaks ties in a stable order", () => {
    const rows = [
      { userId: "z", seconds: 60 },
      { userId: "m", seconds: 60 },
    ];
    expect(rankTotals(rows, [], all, now).map(([id]) => id)).toEqual(["m", "z"]);
  });

  it("leaves out people with no time", () => {
    expect(rankTotals([{ userId: "a", seconds: 0 }], [], all, now)).toEqual([]);
  });

  it("adds a running session to finished time", () => {
    expect(rankTotals([{ userId: "a", seconds: 100 }], [running("a", 10)], all, now)).toEqual([["a", 700]]);
  });

  it("ranks someone whose only time is a running session", () => {
    expect(rankTotals([{ userId: "a", seconds: 100 }], [running("b", 10)], all, now).map(([id]) => id)).toEqual(["b", "a"]);
  });

  it("leaves out paused time", () => {
    const paused = running("a", 10, { pausedSec: 240 });
    expect(rankTotals([], [paused], all, now)).toEqual([["a", 360]]);
  });

  it("checks the period against the owner's own calendar", () => {
    const late = new Date("2026-11-04T23:30:00Z");
    const session = { ...running("a", 10), startedAt: new Date(late.getTime() - 600_000), lastBeatAt: late };
    const onlyThe4th = (day: string) => day === "2026-11-04";
    expect(rankTotals([], [{ ...session, timeZone: "UTC" }], onlyThe4th, late)).toHaveLength(1);
    expect(rankTotals([], [{ ...session, timeZone: "Africa/Addis_Ababa" }], onlyThe4th, late)).toHaveLength(0);
  });
});
