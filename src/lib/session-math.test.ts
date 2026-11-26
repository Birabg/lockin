import { describe, expect, it } from "vitest";
import {
  DEFAULT_POMODORO,
  GRACE_MS,
  STALE_MS,
  activeSeconds,
  clampPomodoro,
  focusedSeconds,
  goalEndsAt,
  isExpired,
  pausedSeconds,
  planSeconds,
  pomodoroOf,
  pomodoroPhase,
  remainingSeconds,
  runningSeconds,
} from "./session-math";

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

describe("Pomodoro", () => {
  // the classic: 25 focus, 5 break, a 15 long break after every 4th round, 4 rounds planned
  const classic = { workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 };
  const pomo = { ...base, ...classic, goalMin: 100 };
  const min = (m: number) => m * 60;

  it("only treats a session with all four settings as a Pomodoro", () => {
    expect(pomodoroOf({ goalMin: 25 })).toBeNull();
    expect(pomodoroOf({ goalMin: 25, workMin: null, breakMin: null, longBreakMin: null, rounds: null })).toBeNull();
    expect(pomodoroOf(pomo)).toEqual(classic);
  });

  it("takes turns between focus and breaks, with a long break after the 4th round", () => {
    const at = (m: number) => pomodoroPhase(classic, min(m));
    expect(at(0)).toMatchObject({ kind: "focus", round: 1, into: 0, length: min(25), focusSec: 0 });
    expect(at(24)).toMatchObject({ kind: "focus", round: 1, focusSec: min(24) });
    expect(at(25)).toMatchObject({ kind: "break", round: 1, into: 0, length: min(5), focusSec: min(25) });
    expect(at(29)).toMatchObject({ kind: "break", round: 1, focusSec: min(25) });
    expect(at(30)).toMatchObject({ kind: "focus", round: 2, into: 0, focusSec: min(25) });
    // rounds 1–4 with three short breaks: 4×25 + 3×5 = 115 minutes in
    expect(at(115)).toMatchObject({ kind: "long", round: 4, into: 0, length: min(15), focusSec: min(100) });
    expect(at(129)).toMatchObject({ kind: "long", round: 4, focusSec: min(100) });
  });

  it("carries on past the plan, starting the next set of rounds after the long break", () => {
    expect(pomodoroPhase(classic, min(130))).toMatchObject({ kind: "focus", round: 5, into: 0, focusSec: min(100) });
    expect(pomodoroPhase(classic, min(130 + 115))).toMatchObject({ kind: "long", round: 8, focusSec: min(200) });
  });

  it("works with odd lengths and a single round", () => {
    const odd = { workMin: 50, breakMin: 10, longBreakMin: 30, rounds: 1 };
    expect(pomodoroPhase(odd, min(50))).toMatchObject({ kind: "break", round: 1, length: min(10) });
    expect(planSeconds({ goalMin: 50, ...odd })).toBe(min(50));
  });

  it("plans the focus rounds and only the breaks between them", () => {
    expect(planSeconds(pomo)).toBe(min(115));
    expect(planSeconds({ goalMin: 150, ...classic, rounds: 6 })).toBe(min(6 * 25 + 4 * 5 + 15));
    expect(planSeconds({ goalMin: 40 })).toBe(min(40));
  });

  it("counts only focus, never breaks or pauses", () => {
    expect(focusedSeconds(pomo, after(27))).toBe(min(25));
    expect(focusedSeconds(pomo, after(35))).toBe(min(30));
    // paused for 10 minutes: the same point in the schedule, 10 minutes later
    expect(focusedSeconds({ ...pomo, pausedSec: min(10) }, after(45))).toBe(min(30));
    expect(focusedSeconds({ ...base, goalMin: 25 }, after(27))).toBe(min(27));
  });

  it("counts the goal down in focus, so it holds still through a break", () => {
    expect(remainingSeconds(pomo, after(25))).toBe(min(75));
    expect(remainingSeconds(pomo, after(29))).toBe(min(75));
    expect(remainingSeconds(pomo, after(115))).toBe(0);
    expect(remainingSeconds(pomo, after(125))).toBe(0);
  });

  it("ends the goal with the last focus round, breaks and pauses included", () => {
    expect(goalEndsAt(pomo)).toEqual(after(115));
    expect(goalEndsAt({ ...pomo, pausedSec: min(5) })).toEqual(after(120));
  });

  it("keeps a quiet Pomodoro alive through its breaks", () => {
    const quiet = { ...pomo, lastBeatAt: after(5) };
    expect(isExpired(quiet, after(115).getTime())).toBe(false);
    expect(isExpired(quiet, after(115).getTime() + GRACE_MS + 60_000)).toBe(true);
  });

  it("counts a running Pomodoro's focus for the leaderboard", () => {
    expect(runningSeconds({ ...pomo, lastBeatAt: after(34) }, after(35))).toBe(min(30));
  });

  it("holds settings to their limits and falls back to the classic", () => {
    expect(clampPomodoro({ workMin: 500, breakMin: 0, longBreakMin: "20", rounds: 2.4 })).toEqual({
      workMin: 90,
      breakMin: 1,
      longBreakMin: 20,
      rounds: 2,
    });
    expect(clampPomodoro({})).toEqual(DEFAULT_POMODORO);
    expect(clampPomodoro({ workMin: "nope", rounds: null })).toEqual(DEFAULT_POMODORO);
  });
});
