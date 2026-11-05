import { describe, expect, it } from "vitest";
import { GRACE_MS, STALE_MS, activeSeconds, goalEndsAt, isExpired, pausedSeconds, remainingSeconds, runningSeconds } from "./session-math";

const start = new Date("2026-11-04T10:00:00Z");
const after = (min: number) => new Date(start.getTime() + min * 60_000);
const base = { startedAt: start, pausedSec: 0, pausedAt: null };

describe("pausedSeconds", () => {
  const at = new Date("2026-01-01T10:00:00Z");

  it("adds a pause that's still running", () => {
    expect(pausedSeconds({ pausedSec: 60, pausedAt: new Date("2026-01-01T09:58:00Z") }, at)).toBe(180);
  });

  it("is just the saved total when not paused", () => {
    expect(pausedSeconds({ pausedSec: 60, pausedAt: null }, at)).toBe(60);
  });
});

describe("activeSeconds", () => {
  it("counts time since the start", () => {
    expect(activeSeconds(base, after(10))).toBe(600);
  });

  it("leaves out finished pauses", () => {
    expect(activeSeconds({ ...base, pausedSec: 120 }, after(10))).toBe(480);
  });

  it("stops counting during a pause", () => {
    const paused = { ...base, pausedAt: after(5) };
    expect(activeSeconds(paused, after(10))).toBe(300);
    expect(activeSeconds(paused, after(60))).toBe(300);
  });

  it("is never negative", () => {
    expect(activeSeconds({ ...base, pausedSec: 9999 }, after(1))).toBe(0);
  });
});

describe("remainingSeconds", () => {
  const goal = { ...base, goalMin: 25 };

  it("starts at the goal, and holds it for the whole first second", () => {
    expect(remainingSeconds(goal, start)).toBe(1500);
    expect(remainingSeconds(goal, new Date(start.getTime() + 900))).toBe(1500);
    expect(remainingSeconds(goal, new Date(start.getTime() + 1000))).toBe(1499);
  });

  it("reaches zero at the goal and goes below it in overtime", () => {
    expect(remainingSeconds(goal, after(25))).toBe(0);
    expect(remainingSeconds(goal, after(28))).toBe(-180);
  });

  it("freezes during a pause and carries on after", () => {
    const paused = { ...goal, pausedAt: after(10) };
    expect(remainingSeconds(paused, after(10))).toBe(900);
    expect(remainingSeconds(paused, after(40))).toBe(900);
    expect(remainingSeconds({ ...goal, pausedSec: 300 }, after(15))).toBe(900);
  });
});

describe("goalEndsAt", () => {
  it("moves later by the time spent paused", () => {
    expect(goalEndsAt({ ...base, goalMin: 25 })).toEqual(after(25));
    expect(goalEndsAt({ ...base, goalMin: 25, pausedSec: 300 })).toEqual(after(30));
  });
});

describe("runningSeconds", () => {
  it("stops adding once the session goes quiet", () => {
    const quiet = { ...base, lastBeatAt: after(5) };
    expect(runningSeconds({ ...base, lastBeatAt: after(9) }, after(10))).toBe(600);
    expect(runningSeconds(quiet, after(5 + STALE_MS / 60_000 + 30))).toBe(300);
  });
});

describe("isExpired", () => {
  const session = { ...base, goalMin: 30, lastBeatAt: after(5) };
  const ms = (d: Date) => d.getTime();

  it("keeps a recent session alive", () => {
    expect(isExpired({ ...session, lastBeatAt: after(9) }, ms(after(10)))).toBe(false);
  });

  it("keeps a quiet session open until the grace period after its goal", () => {
    expect(isExpired(session, ms(after(30)))).toBe(false);
    expect(isExpired(session, ms(after(30)) + GRACE_MS + 60_000)).toBe(true);
  });
});
