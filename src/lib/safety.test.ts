import { describe, expect, it } from "vitest";
import { blockedEither, HIDE_AFTER_REPORTS, hiddenAuthors, isReportReason, isReportTarget, REPORT_REASONS, shouldHide } from "./safety";

describe("report targets and reasons", () => {
  it("accepts every content type and people", () => {
    for (const t of ["post", "comment", "quest", "take", "user"]) expect(isReportTarget(t)).toBe(true);
    expect(isReportTarget("room")).toBe(false);
    expect(isReportTarget(undefined)).toBe(false);
  });
  it("accepts only the listed reasons", () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(["spam", "harassment", "inappropriate", "other"]);
    expect(isReportReason("spam")).toBe(true);
    expect(isReportReason("because")).toBe(false);
    expect(isReportReason(null)).toBe(false);
  });
});

describe("shouldHide", () => {
  it("hides content once enough different people report it", () => {
    for (const t of ["post", "comment", "quest", "take"] as const) {
      expect(shouldHide(t, HIDE_AFTER_REPORTS - 1)).toBe(false);
      expect(shouldHide(t, HIDE_AFTER_REPORTS)).toBe(true);
      expect(shouldHide(t, HIDE_AFTER_REPORTS + 5)).toBe(true);
    }
  });
  it("never hides a person automatically", () => {
    expect(shouldHide("user", 100)).toBe(false);
  });
  it("keeps the threshold at 3", () => {
    expect(HIDE_AFTER_REPORTS).toBe(3);
  });
});

describe("blockedEither", () => {
  const rows = [
    { blockerId: "me", blockedId: "a" },
    { blockerId: "b", blockedId: "me" },
    { blockerId: "me", blockedId: "a" },
    { blockerId: "x", blockedId: "y" },
  ];
  it("counts blocks in both directions, once each, and ignores other people's", () => {
    expect(blockedEither("me", rows).sort()).toEqual(["a", "b"]);
  });
  it("is empty without blocks", () => {
    expect(blockedEither("me", [])).toEqual([]);
  });
});

describe("hiddenAuthors", () => {
  const p = { blocked: ["a", "b"], muted: ["b", "c"] };
  it("hides blocked and muted people in the feed", () => {
    expect(hiddenAuthors(p, "feed").sort()).toEqual(["a", "b", "c"]);
  });
  it("hides only blocked people elsewhere", () => {
    expect(hiddenAuthors(p, "elsewhere").sort()).toEqual(["a", "b"]);
  });
});
