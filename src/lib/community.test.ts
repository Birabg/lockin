import { afterEach, describe, expect, it } from "vitest";
import { hasBlockedWords, isAdmin } from "./moderation";
import { endsIn, noteTilt, questEnd, questGoalText, questMet, questShare, sessionCounts } from "./quests";
import { QUESTION_BANK, bankQuestion, heat, votePercents } from "./wall";

const quest = {
  type: "solo",
  targetMinutes: 150,
  targetSessions: null,
  minSessionMin: 50,
  tag: null,
  startsAt: new Date("2026-11-15T00:00:00Z"),
  endsAt: new Date("2026-11-20T00:00:00Z"),
};
const joined = new Date("2026-11-15T08:00:00Z");
const session = (o: Partial<{ endedAt: Date; durationSec: number; label: string | null }> = {}) => ({
  endedAt: new Date("2026-11-16T10:00:00Z"),
  durationSec: 55 * 60,
  label: "deep work",
  ...o,
});

describe("sessionCounts", () => {
  it("counts a long enough session inside the window", () => {
    expect(sessionCounts(quest, joined, session())).toBe(true);
  });
  it("skips sessions that are too short, too early, too late, or before joining", () => {
    expect(sessionCounts(quest, joined, session({ durationSec: 40 * 60 }))).toBe(false);
    expect(sessionCounts(quest, joined, session({ endedAt: new Date("2026-11-21T00:00:00Z") }))).toBe(false);
    expect(sessionCounts(quest, joined, session({ endedAt: new Date("2026-11-15T07:00:00Z") }))).toBe(false);
  });
  it("matches the tag without caring about case", () => {
    const tagged = { ...quest, tag: "Deep Work" };
    expect(sessionCounts(tagged, joined, session())).toBe(true);
    expect(sessionCounts(tagged, joined, session({ label: "reading" }))).toBe(false);
    expect(sessionCounts(tagged, joined, session({ label: null }))).toBe(false);
  });
});

describe("progress", () => {
  it("is the share of the target, capped at full", () => {
    expect(questShare(quest, 75 * 60, 1)).toBe(0.5);
    expect(questShare(quest, 300 * 60, 4)).toBe(1);
    expect(questMet(quest, 150 * 60, 3)).toBe(true);
  });
  it("needs both targets when there are two", () => {
    const both = { targetMinutes: 60, targetSessions: 3 };
    expect(questShare(both, 60 * 60, 1)).toBeCloseTo(1 / 3);
    expect(questMet(both, 60 * 60, 3)).toBe(true);
  });
  it("describes the goal", () => {
    expect(questGoalText({ targetMinutes: null, targetSessions: 3, minSessionMin: 50 })).toBe("3 × 50m");
    expect(questGoalText({ targetMinutes: 300, targetSessions: null, minSessionMin: null })).toBe("5h");
    expect(questGoalText({ targetMinutes: 90, targetSessions: 2, minSessionMin: null })).toBe("90m + 2 sessions");
  });
});

describe("notes", () => {
  it("tilt between -2 and 2 degrees, the same every time", () => {
    for (const id of ["a", "clx1", "quest-42", "zzzzzzzzzz"]) {
      const t = noteTilt(id);
      expect(t).toBeGreaterThanOrEqual(-2);
      expect(t).toBeLessThanOrEqual(2);
      expect(noteTilt(id)).toBe(t);
    }
  });
  it("say when they end", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(endsIn(new Date("2026-11-17T13:00:00Z"), now)).toBe("ends in 2d");
    expect(endsIn(new Date("2026-11-15T17:00:00Z"), now)).toBe("ends in 5h");
    expect(endsIn(new Date("2026-11-15T12:20:00Z"), now)).toBe("ends in 20m");
    expect(endsIn(new Date("2026-11-15T11:00:00Z"), now)).toBe("ended");
  });
});

describe("the wall", () => {
  it("picks the same bank question for a day, and every question has 2–4 options", () => {
    expect(bankQuestion("2026-11-15")).toBe(bankQuestion("2026-11-15"));
    expect(bankQuestion("2026-11-15")).not.toBe(bankQuestion("2026-11-16"));
    expect(QUESTION_BANK.every((q) => q.options.length >= 2 && q.options.length <= 4)).toBe(true);
  });
  it("splits votes into percents that add up to 100", () => {
    expect(votePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(votePercents([0, 0])).toEqual([0, 0]);
    expect(votePercents([3, 1]).reduce((a, b) => a + b)).toBe(100);
  });
  it("cools takes down with age", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(heat(5, new Date("2026-11-15T11:00:00Z"), now)).toBeGreaterThan(heat(5, new Date("2026-11-14T12:00:00Z"), now));
  });
});

describe("moderation", () => {
  const before = process.env.ADMIN_USERNAMES;
  afterEach(() => {
    process.env.ADMIN_USERNAMES = before;
  });
  it("catches blocked words, including common disguises", () => {
    expect(hasBlockedWords("this is sh1t")).toBe(true);
    expect(hasBlockedWords("f u c k this")).toBe(true);
    expect(hasBlockedWords("SHIIIIT")).toBe(true);
  });
  it("leaves normal text alone", () => {
    expect(hasBlockedWords("Lo-fi beats > silence, fight me")).toBe(false);
    expect(hasBlockedWords("Scunthorpe has a nice class schedule")).toBe(false);
    expect(hasBlockedWords("I passed my assessment")).toBe(false);
  });
  it("reads admins from the environment", () => {
    process.env.ADMIN_USERNAMES = "Birag, onyx";
    expect(isAdmin("birag")).toBe(true);
    expect(isAdmin("someone")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("questEnd", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  it("uses the poster's own midnight for today, at least an hour out", () => {
    const midnight = new Date("2026-11-15T20:59:59Z");
    expect(questEnd("today", now, midnight)).toEqual(midnight);
    expect(questEnd("today", now, new Date("2026-11-15T12:20:00Z")).getTime()).toBe(now.getTime() + 3_600_000);
  });
  it("ignores a today that is more than a day away, and adds days for the others", () => {
    expect(questEnd("today", now, new Date("2026-11-20T00:00:00Z")).getTime() - now.getTime()).toBeLessThanOrEqual(86_400_000);
    expect(questEnd("3d", now).getTime() - now.getTime()).toBe(72 * 3_600_000);
  });
});
