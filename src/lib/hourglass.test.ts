import { describe, expect, it } from "vitest";
import { GLASS, bottomSandPath, bulbPath, glassPath, halfWidth, sandAt, topSandPath } from "./hourglass";

describe("hourglass", () => {
  it("is widest in the bulb and pinches to the neck", () => {
    expect(halfWidth(1)).toBeCloseTo(GLASS.neckRadius);
    expect(Math.max(...[0.1, 0.2, 0.3].map(halfWidth))).toBeGreaterThan(GLASS.radius * 0.9);
    expect(halfWidth(0.9)).toBeLessThan(halfWidth(0.5));
  });

  it("starts with all the sand on top and none below", () => {
    const s = sandAt(1);
    expect(s.bottom).toBeNull();
    expect(s.top?.dip).toBe(0);
    expect(s.top!.y).toBeGreaterThan(GLASS.top); // a real glass isn't filled to the brim
  });

  it("ends with it all below", () => {
    const s = sandAt(0);
    expect(s.top).toBeNull();
    expect(s.bottom!.peak).toBeGreaterThan(GLASS.neck);
  });

  it("drops the top and raises the pile as time runs out", () => {
    let last = sandAt(0.95);
    for (const share of [0.8, 0.6, 0.4, 0.2, 0.05]) {
      const s = sandAt(share);
      expect(s.top!.y).toBeGreaterThan(last.top!.y);
      expect(s.bottom!.y).toBeLessThanOrEqual(last.bottom!.y);
      expect(s.bottom!.peak).toBeLessThan(last.bottom!.peak);
      last = s;
    }
  });

  it("moves slowly through the wide part and quickly near the neck, like real sand", () => {
    const fall = (a: number, b: number) => sandAt(b).top!.y - sandAt(a).top!.y;
    expect(fall(0.9, 0.8)).toBeLessThan(fall(0.2, 0.1));
  });

  it("never piles up into the neck", () => {
    for (let share = 0; share <= 1; share += 0.05) {
      const s = sandAt(share);
      if (s.bottom) expect(s.bottom.peak).toBeGreaterThan(GLASS.neck);
    }
  });

  it("draws closed shapes", () => {
    expect(bulbPath(1)).toMatch(/^M.*Z$/);
    expect(bulbPath(-1)).toMatch(/^M.*Z$/);
    expect(glassPath().match(/M/g)).toHaveLength(2);
    expect(topSandPath(sandAt(0.5).top!)).toMatch(/Z$/);
    expect(bottomSandPath(sandAt(0.5).bottom!)).toMatch(/Z$/);
  });
});
