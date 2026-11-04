import { brand } from "./brand";

const TZ = brand.timeZone;
const DAY = 86_400_000;

/** Offset (ms) of TZ from UTC at a given instant. */
function tzOffset(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" for the calendar day in TZ. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** Start of the TZ calendar day containing `date`, as a real instant. */
export function startOfDay(date = new Date()): Date {
  const [y, m, d] = dayKey(date).split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffset(new Date(guess)));
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * DAY);
}

/** Start of the week (Monday) in TZ. */
export function startOfWeek(date = new Date()): Date {
  const sod = startOfDay(date);
  const weekday = new Date(sod.getTime() + tzOffset(sod)).getUTCDay(); // 0 = Sun
  const back = (weekday + 6) % 7;
  return startOfDay(addDays(sod, -back));
}

export function weekdayLetter(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "narrow" }).format(date);
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDayHeading(date: Date): string {
  const today = dayKey(new Date());
  const key = dayKey(date);
  if (key === today) return "Today";
  if (key === dayKey(addDays(new Date(), -1))) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(date);
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

/** 1h 05m 09s style clock for the running timer */
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
