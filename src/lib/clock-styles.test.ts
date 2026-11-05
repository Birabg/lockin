import { describe, expect, it } from "vitest";
import { clockParts, clockText, reelNumber, reelPlacement, resolveClockStyle } from "./clock-styles";

describe("clockText", () => {
  it("shows MM:SS under an hour and H:MM:SS over", () => {
    expect(clockText(599, false)).toBe("09:59");
    expect(clockText(3725, false)).toBe("1:02:05");
  });
  it("holds at zero until overtime, then counts up with a plus", () => {
    expect(clockText(-4, false)).toBe("00:00");
    expect(clockText(-75, true)).toBe("+01:15");
    expect(clockText(-3725, true)).toBe("+1:02:05");
  });
});

describe("clockParts", () => {
  it("splits the time into units", () => {
    expect(clockParts(3725, false)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    expect(clockParts(-61, true)).toEqual({ hours: 0, minutes: 1, seconds: 1 });
    expect(clockParts(-61, false)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

describe("resolveClockStyle", () => {
  it("falls back to the ring", () => {
    expect(resolveClockStyle("flip")).toBe("flip");
    expect(resolveClockStyle("nope")).toBe("ring");
    expect(resolveClockStyle(null)).toBe("ring");
  });
});

describe("reel", () => {
  it("is largest and brightest in the centre, and gone at its ends", () => {
    expect(reelPlacement(0, 7)).toEqual({ along: 0, across: 0, scale: 1, opacity: 1 });
    const end = reelPlacement(-7, 7);
    expect(end.opacity).toBe(0);
    expect(end.along).toBeLessThan(0);
    expect(end.across).toBeGreaterThan(0.8);
  });
  it("wraps at a minute and passes through zero into overtime", () => {
    expect(reelNumber(-61)).toBe("01");
    expect(reelNumber(0)).toBe("00");
    expect(reelNumber(75)).toBe("15");
  });
});
