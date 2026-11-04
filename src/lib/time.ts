import { brand } from "./brand";

const DAY = 86_400_000;

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD" for the calendar day in a time zone. */
export function dayKey(date: Date, timeZone: string): string {
  let format = dayFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", { timeZone });
    dayFormats.set(timeZone, format);
  }
  return format.format(date);
}

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Move a day key by whole calendar days. Pure date maths, so daylight saving can't skip a day. */
export function shiftDayKey(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY).toISOString().slice(0, 10);
}

/** The Monday of the week containing a day key. */
export function weekStartKey(key: string): string {
  const weekday = new Date(keyToUtc(key)).getUTCDay(); // 0 = Sun
  return shiftDayKey(key, -((weekday + 6) % 7));
}

export function weekdayLetter(key: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "narrow" }).format(keyToUtc(key));
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const defaultTimeZone = brand.timeZone;

export function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDayHeading(date: Date, timeZone: string): string {
  const today = dayKey(new Date(), timeZone);
  const key = dayKey(date, timeZone);
  if (key === today) return "Today";
  if (key === shiftDayKey(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date);
}

/** 5400 -> "1h 30m", 90 -> "1m", 0 -> "0m" */
export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** 01:05:09 style clock for the running timer */
export function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
