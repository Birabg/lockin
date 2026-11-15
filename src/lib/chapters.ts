import { formatClock, formatCountdown } from "./time";

/**
 * A session's filmstrip, measured in focused seconds (paused time left out), which is the clock a
 * session counts and the one the goal is set against.
 *
 * Only the total paused time is stored, not when each pause happened, so there are no break
 * chapters: placing them would mean making them up. "break" stays in the type for when pauses are recorded.
 */
export type ChapterKind = "focus" | "break" | "goal";
export type Chapter = { kind: ChapterKind; from: number; to: number };

export type ChapterSession = { startedAt: Date | string; durationSec: number; pausedSec: number; goalMin: number };

export const CHAPTER_NAMES: Record<ChapterKind, string> = { focus: "Locked in", break: "Break", goal: "Goal" };

export function sessionChapters(s: ChapterSession) {
  const total = Math.max(1, s.durationSec);
  const goal = s.goalMin * 60;
  const goalHit = s.durationSec >= goal;
  const chapters: Chapter[] =
    goalHit && goal < total
      ? [
          { kind: "focus", from: 0, to: goal },
          { kind: "goal", from: goal, to: total },
        ]
      : [{ kind: "focus", from: 0, to: total }];
  return { total, chapters, goalHit, pct: s.durationSec / goal };
}

/**
 * The real time range of a chapter. Exact only when the session never paused: otherwise the pauses
 * moved it by an unknown amount, so it says how far into the focused time it was instead.
 */
export function chapterRange(s: ChapterSession, c: Chapter, timeZone: string): string {
  if (s.pausedSec > 0) return `${formatCountdown(c.from)}–${formatCountdown(c.to)} focused`;
  const start = new Date(s.startedAt).getTime();
  const at = (sec: number) => formatClock(new Date(start + sec * 1000), timeZone);
  const [from, to] = [at(c.from), at(c.to)].map((t) => t.replace(/\s/g, " "));
  // "11:25–11:31 AM", but "11:58 AM–12:04 PM" when it crosses noon
  const period = (t: string) => t.slice(-2);
  return period(from) === period(to) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

/** Which chapter a point on the strip (0 to 1) falls in. */
export function chapterAt(chapters: Chapter[], total: number, fraction: number): Chapter {
  const sec = fraction * total;
  return chapters.find((c) => sec >= c.from && sec <= c.to) ?? chapters[chapters.length - 1];
}

/**
 * About how long a timelapse runs before its file says: one frame every 5 seconds, played at 24 a second.
 * Browsers often report Infinity for a recorded WebM until it has played through, so the player needs this.
 */
export const estimateTimelapseSec = (wallSec: number) => Math.min(Math.max(wallSec / 120, 1), 60);
