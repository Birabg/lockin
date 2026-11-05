import { brand } from "./brand";

const DAY = 86_400_000;
const HOUR = 3_600_000;

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

/** 1500 -> "25:00", 5400 -> "1:30:00" */
export function formatCountdown(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  const rest = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return h ? `${h}:${rest}` : rest;
}

const tickFormats = new Map<string, Intl.DateTimeFormat>();

/** "9p", or "9:30p" when it isn't on the hour */
function formatTick(date: Date, timeZone: string): string {
  let format = tickFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true });
    tickFormats.set(timeZone, format);
  }
  const parts = format.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const minute = part("minute");
  return `${part("hour")}${minute === "00" ? "" : `:${minute}`}${part("dayPeriod").charAt(0).toLowerCase()}`;
}

/** How far past the hour a moment is on that zone's clock. Half-hour zones make this differ from UTC. */
function msPastHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, minute: "numeric", second: "numeric" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (part("minute") * 60 + part("second")) * 1000 + date.getMilliseconds();
}

/**
 * Places a session on a timeline of whole hours. The span is an even number of hours,
 * so the middle tick lands on the hour too.
 */
export function sessionWindow(start: Date, end: Date, timeZone: string) {
  const startMs = start.getTime();
  const endMs = Math.max(end.getTime(), startMs);
  const from = startMs - msPastHour(start, timeZone);
  const hours = Math.max(1, Math.ceil((endMs - from) / HOUR));
  const span = (hours + (hours % 2)) * HOUR;
  const widthPct = Math.max(((endMs - startMs) / span) * 100, 2); // a very short session still shows
  return {
    leftPct: Math.min(((startMs - from) / span) * 100, 100 - widthPct),
    widthPct,
    ticks: [from, from + span / 2, from + span].map((t) => formatTick(new Date(t), timeZone)),
  };
}

/** 950 -> "950", 1240 -> "1.2K" */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
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
