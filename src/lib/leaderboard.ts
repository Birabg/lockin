import { runningSeconds } from "./session-math";
import { dayKey } from "./time";

type Finished = { userId: string; seconds: number };
type Running = Parameters<typeof runningSeconds>[0] & { userId: string; startedAt: Date; timeZone: string };

/**
 * Adds running sessions to finished totals and ranks the result, highest first, with ties in a stable order.
 * A running session counts if it started on a day inside the period, by its owner's own calendar.
 */
export function rankTotals(finished: Finished[], running: Running[], inRange: (day: string) => boolean, now: Date) {
  const totals = new Map(finished.map((row) => [row.userId, row.seconds]));
  for (const s of running) {
    if (inRange(dayKey(s.startedAt, s.timeZone))) totals.set(s.userId, (totals.get(s.userId) ?? 0) + runningSeconds(s, now));
  }
  return [...totals.entries()].filter(([, sec]) => sec > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
