import { describe, expect, it } from "vitest";
import { angleFrom, dialShape, formatDialTime, minutesForTurn, reachesDailyGoal, snapMinutes, turnBetween } from "./dial";

describe("snapMinutes", () => {
  it("rounds to the nearest 5", () => {
    expect(snapMinutes(27.4)).toBe(25);
    expect(snapMinutes(27.5)).toBe(30);
  });
  it("stays between 5 minutes and 4 hours", () => {
    expect(snapMinutes(0)).toBe(5);
    expect(snapMinutes(-20)).toBe(5);
    expect(snapMinutes(720)).toBe(240);
  });
});

describe("formatDialTime", () => {
  it.each([
    [5, "5 min"],
    [25, "25 min"],
    [60, "1h"],
    [90, "1h 30m"],
    [120, "2h"],
    [235, "3h 55m"],
  ])("%i", (minutes, text) => expect(formatDialTime(minutes)).toBe(text));
});

describe("angleFrom", () => {
  it.each([
    [0, -10, 0],
    [10, 0, 90],
    [0, 10, 180],
    [-10, 0, 270],
  ])("(%i, %i) is %i degrees", (x, y, degrees) => expect(angleFrom(0, 0, x, y)).toBeCloseTo(degrees));
});

describe("turnBetween", () => {
  it("goes forward across 12 o'clock", () => expect(turnBetween(350, 10)).toBe(20));
  it("goes backward across 12 o'clock", () => expect(turnBetween(10, 350)).toBe(-20));
  it("handles a plain turn", () => expect(turnBetween(90, 120)).toBe(30));

  it("adds up to a whole lap in steps, whichever way round", () => {
    const wrap = (angle: number) => ((angle % 360) + 360) % 360;
    const walk = (step: number) => {
      let total = 0;
      for (let i = 0; i < 36; i++) total += turnBetween(wrap(i * step), wrap((i + 1) * step));
      return minutesForTurn(total);
    };
    expect(walk(10)).toBeCloseTo(60);
    expect(walk(-10)).toBeCloseTo(-60);
  });
});

describe("dialShape", () => {
  it.each([
    [25, 0, 25 / 60],
    [60, 0, 1],
    [65, 1, 5 / 60],
    [90, 1, 0.5],
    [120, 1, 1],
    [125, 2, 5 / 60],
    [240, 3, 1],
  ])("%i minutes", (minutes, laps, fraction) => {
    const shape = dialShape(minutes);
    expect(shape.laps).toBe(laps);
    expect(shape.fraction).toBeCloseTo(fraction);
  });
});

describe("reachesDailyGoal", () => {
  it("is true once this session gets there", () => {
    expect(reachesDailyGoal(30, 30 * 60, 60)).toBe(true);
    expect(reachesDailyGoal(25, 30 * 60, 60)).toBe(false);
  });
  it("is false when the goal is already met", () => expect(reachesDailyGoal(30, 60 * 60, 60)).toBe(false));
});
