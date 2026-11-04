import "server-only";
import { db } from "./db";
import { activeSeconds, isExpired, pausedSeconds, STALE_MS } from "./session-math";
import { dayKey } from "./time";

type Closable = { id: string; userId: string; startedAt: Date; pausedSec: number; pausedAt: Date | null };

/** End a session at `end` and add it to the owner's day. Safe to call twice: only the first call counts. */
export async function finishSession(s: Closable, end: Date, timeZone: string) {
  const durationSec = activeSeconds(s, end);
  return db.$transaction(async (tx) => {
    const { count } = await tx.focusSession.updateMany({
      where: { id: s.id, status: "ACTIVE" },
      data: {
        status: "DONE",
        endedAt: end,
        lastBeatAt: end,
        durationSec,
        pausedSec: pausedSeconds(s, end),
        pausedAt: null,
        activeKey: null,
      },
    });
    if (count === 0) {
      const row = await tx.focusSession.findUnique({ where: { id: s.id }, select: { durationSec: true } });
      return row?.durationSec ?? 0;
    }
    if (durationSec > 0) {
      const day = dayKey(s.startedAt, timeZone);
      await tx.dailyStat.upsert({
        where: { userId_day: { userId: s.userId, day } },
        create: { userId: s.userId, day, seconds: durationSec },
        update: { seconds: { increment: durationSec } },
      });
    }
    return durationSec;
  });
}

/** Close sessions whose tab was closed without pressing stop. */
export async function reapStaleSessions() {
  const silent = await db.focusSession.findMany({
    where: { status: "ACTIVE", lastBeatAt: { lt: new Date(Date.now() - STALE_MS) } },
    include: { user: { select: { timeZone: true } } },
  });
  for (const s of silent) {
    if (isExpired(s)) await finishSession(s, s.lastBeatAt, s.user.timeZone);
  }
}
