import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatCount,
  formatCountdown,
  formatDuration,
  isValidTimeZone,
  sessionWindow,
  shiftDayKey,
  weekStartKey,
  weekdayLetter,
} from "./time";

describe("sessionWindow", () => {
  it("places a session by its real times on whole hours", () => {
    const w = sessionWindow(new Date("2026-01-01T21:30:00Z"), new Date("2026-01-01T23:00:00Z"), "UTC");
    expect(w.ticks).toEqual(["9p", "10p", "11p"]);
    expect(w.leftPct).toBe(25);
    expect(w.widthPct).toBe(75);
  });

  it("runs past midnight", () => {
    const w = sessionWindow(new Date("2026-01-01T21:10:00Z"), new Date("2026-01-02T00:50:00Z"), "UTC");
    expect(w.ticks).toEqual(["9p", "11p", "1a"]);
  });

  it("uses the clock of half-hour zones", () => {
    const w = sessionWindow(new Date("2026-01-01T15:45:00Z"), new Date("2026-01-01T16:15:00Z"), "Asia/Kolkata");
    expect(w.ticks).toEqual(["9p", "10p", "11p"]);
    expect(w.leftPct).toBe(12.5);
  });

  it("keeps a tiny session visible and inside the track", () => {
    const w = sessionWindow(new Date("2026-01-01T21:59:50Z"), new Date("2026-01-01T22:00:00Z"), "UTC");
    expect(w.widthPct).toBe(2);
    expect(w.leftPct + w.widthPct).toBeLessThanOrEqual(100);
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatCountdown(1500)).toBe("25:00");
    expect(formatCountdown(59)).toBe("00:59");
    expect(formatCountdown(3599)).toBe("59:59");
  });

  it("adds hours from an hour up", () => {
    expect(formatCountdown(3600)).toBe("1:00:00");
    expect(formatCountdown(5409)).toBe("1:30:09");
  });

  it("stops at zero", () => {
    expect(formatCountdown(-5)).toBe("00:00");
  });
});

describe("formatCount", () => {
  it("shortens big numbers", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(1240)).toBe("1.2K");
  });
});

describe("dayKey", () => {
  const instant = new Date("2026-03-10T23:30:00Z");

  it("uses the person's own calendar", () => {
    expect(dayKey(instant, "UTC")).toBe("2026-03-10");
    expect(dayKey(instant, "Africa/Addis_Ababa")).toBe("2026-03-11");
    expect(dayKey(instant, "America/Los_Angeles")).toBe("2026-03-10");
  });

  it("handles the far edges of the time zone map", () => {
    const noon = new Date("2026-06-15T12:00:00Z");
    expect(dayKey(noon, "Pacific/Kiritimati")).toBe("2026-06-16");
    expect(dayKey(noon, "Pacific/Pago_Pago")).toBe("2026-06-15");
  });

  it("stays right across a daylight saving change", () => {
    expect(dayKey(new Date("2026-03-08T07:59:00Z"), "America/Los_Angeles")).toBe("2026-03-07");
    expect(dayKey(new Date("2026-03-08T08:01:00Z"), "America/Los_Angeles")).toBe("2026-03-08");
  });
});

describe("shiftDayKey", () => {
  it("crosses months, years and leap days", () => {
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDayKey("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDayKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDayKey("2026-05-05", 0)).toBe("2026-05-05");
  });
});

describe("weekStartKey", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartKey("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(weekStartKey("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStartKey("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStartKey("2027-01-01")).toBe("2026-12-28"); // across a new year
  });
});

describe("weekdayLetter", () => {
  it("names the day from the key alone", () => {
    expect(weekdayLetter("2026-11-02")).toBe("M");
    expect(weekdayLetter("2026-11-08")).toBe("S");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and refuses the rest", () => {
    expect(isValidTimeZone("Africa/Addis_Ababa")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(59 * 60)).toBe("59m");
    expect(formatDuration(3 * 3600)).toBe("3h");
    expect(formatDuration(2 * 3600 + 24 * 60)).toBe("2h 24m");
  });
});
