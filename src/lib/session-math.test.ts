import { describe, expect, it } from "vitest";
import { GRACE_MS, STALE_MS, activeSeconds, isExpired, runningSeconds } from "./session-math";

const start = new Date("2026-11-04T10:00:00Z");
const after = (min: number) => new Date(start.getTime() + min * 60_000);
const base = { startedAt: start, pausedSec: 0, pausedAt: null };

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
