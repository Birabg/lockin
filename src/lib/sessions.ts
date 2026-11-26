import "server-only";
import { applyQuestProgress } from "./community";
import { db } from "./db";
import { focusedSeconds, isExpired, pausedSeconds, STALE_MS, type Plan } from "./session-math";
import { dayKey } from "./time";

type Closable = Plan & { id: string; userId: string; startedAt: Date; pausedSec: number; pausedAt: Date | null; label?: string | null };

/** End a session at `end` and add it to the owner's day. Safe to call twice: only the first call counts. */
export async function finishSession(s: Closable, end: Date, timeZone: string) {
  // a Pomodoro's breaks aren't focus, so only its focus rounds count
  const durationSec = focusedSeconds(s, end);
  const { seconds, counted } = await db.$transaction(async (tx) => {
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
      return { seconds: row?.durationSec ?? 0, counted: false };
    }
    if (durationSec > 0) {
      const day = dayKey(s.startedAt, timeZone);
      await tx.dailyStat.upsert({
        where: { userId_day: { userId: s.userId, day } },
        create: { userId: s.userId, day, seconds: durationSec },
        update: { seconds: { increment: durationSec } },
      });
    }
    return { seconds: durationSec, counted: true };
  });
  // Quests this session counts towards. Only the call that closed the session gets here, so it counts once.
  // It runs after the transaction (several queries would make it slow), and a failure never undoes the session.
  if (counted && seconds > 0) {
    await applyQuestProgress({ userId: s.userId, endedAt: end, durationSec: seconds, label: s.label ?? null }).catch((e) =>
      console.error("quest progress failed", e),
    );
  }
  return seconds;
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
