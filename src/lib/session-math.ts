/** With no heartbeat for this long, time stops counting until the client checks back in. */
export const STALE_MS = 3 * 60_000;
/** "Focusing now" = active session with a heartbeat this recent. */
export const LIVE_MS = 90_000;
/** How long past its goal a silent session (locked phone, sleeping laptop) can still be picked back up. */
export const GRACE_MS = 10 * 60_000;
/** With no answer for this long after the goal, a session moves into overtime by itself. */
export const GOAL_PROMPT_SEC = 5 * 60;

type Timing = { startedAt: Date; pausedSec: number; pausedAt: Date | null };

/** A session as it comes from the server, with its dates still strings. */
export function sessionTiming<T extends { startedAt: string; pausedAt: string | null }>(s: T) {
  return { ...s, startedAt: new Date(s.startedAt), pausedAt: s.pausedAt ? new Date(s.pausedAt) : null };
}

/** Focused seconds up to `at`, leaving out paused time. */
export function activeSeconds(s: Timing, at: Date): number {
  const end = s.pausedAt && s.pausedAt < at ? s.pausedAt : at;
  return Math.max(0, Math.round((end.getTime() - s.startedAt.getTime()) / 1000) - s.pausedSec);
}

/** All paused time up to `at`, including a pause that's still running. */
export function pausedSeconds(s: Pick<Timing, "pausedSec" | "pausedAt">, at: Date): number {
  const open = s.pausedAt && s.pausedAt < at ? Math.round((at.getTime() - s.pausedAt.getTime()) / 1000) : 0;
  return s.pausedSec + open;
}

/**
 * Seconds until the goal, and below zero once past it. Worked out from the session itself rather than
 * a counter, so a refresh, a second tab or a sleeping phone all land on the same number.
 */
export function remainingSeconds(s: Timing & { goalMin: number }, at: Date): number {
  const end = s.pausedAt && s.pausedAt < at ? s.pausedAt : at;
  const focusedMs = end.getTime() - s.startedAt.getTime() - s.pausedSec * 1000;
  return Math.ceil((s.goalMin * 60_000 - focusedMs) / 1000);
}

/** When the goal lands if the session isn't paused again. */
export function goalEndsAt(s: Pick<Timing, "startedAt" | "pausedSec"> & { goalMin: number }): Date {
  return new Date(s.startedAt.getTime() + (s.goalMin * 60 + s.pausedSec) * 1000);
}

/** Time to show for a running session: a silent one only counts up to its last heartbeat. */
export function runningSeconds(s: Timing & { lastBeatAt: Date }, now: Date): number {
  const silent = now.getTime() - s.lastBeatAt.getTime() > STALE_MS;
  return activeSeconds(s, silent ? s.lastBeatAt : now);
}

/** A silent session survives until its goal + grace, so locking your phone mid-session doesn't end it. */
export function isExpired(s: Timing & { lastBeatAt: Date; goalMin: number }, now = Date.now()): boolean {
  const goalEnd = goalEndsAt(s).getTime() + GRACE_MS;
  return now > Math.max(s.lastBeatAt.getTime() + STALE_MS, goalEnd);
}
