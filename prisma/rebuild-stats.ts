import type { PrismaClient } from "@prisma/client";
import { dayKey } from "../src/lib/time";

/** Recompute DailyStat from sessions and make sure each user has at most one ACTIVE session. Safe to re-run. */
export async function rebuildStats(db: PrismaClient) {
  const users = await db.user.findMany({ select: { id: true, timeZone: true } });
  const zones = new Map(users.map((u) => [u.id, u.timeZone]));

  const active = await db.focusSession.findMany({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  const kept = new Set<string>();
  for (const s of active) {
    if (kept.has(s.userId)) {
      const durationSec = Math.max(0, Math.round((s.lastBeatAt.getTime() - s.startedAt.getTime()) / 1000));
      await db.focusSession.update({ where: { id: s.id }, data: { status: "DONE", endedAt: s.lastBeatAt, durationSec, activeKey: null } });
    } else {
      kept.add(s.userId);
      await db.focusSession.update({ where: { id: s.id }, data: { activeKey: s.userId } });
    }
  }

  const done = await db.focusSession.findMany({
    where: { status: "DONE", durationSec: { gt: 0 } },
    select: { userId: true, startedAt: true, durationSec: true },
  });
  const totals = new Map<string, { userId: string; day: string; seconds: number }>();
  for (const s of done) {
    const day = dayKey(s.startedAt, zones.get(s.userId) ?? "UTC");
    const row = totals.get(`${s.userId}|${day}`) ?? { userId: s.userId, day, seconds: 0 };
    row.seconds += s.durationSec;
    totals.set(`${s.userId}|${day}`, row);
  }
  await db.$transaction([db.dailyStat.deleteMany(), db.dailyStat.createMany({ data: [...totals.values()] })]);
  return { sessions: done.length, days: totals.size };
}
