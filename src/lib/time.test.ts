import { describe, expect, it } from "vitest";
import { dayKey, formatDuration, formatTimer, isValidTimeZone, shiftDayKey, weekStartKey, weekdayLetter } from "./time";

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

  it("formats the running timer", () => {
    expect(formatTimer(0)).toBe("00:00:00");
    expect(formatTimer(3661)).toBe("01:01:01");
  });
});
