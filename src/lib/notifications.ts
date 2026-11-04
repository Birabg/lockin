import "server-only";
import { db } from "./db";

export type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "SESSION_START" | "NUDGE" | "BUDDY_REQUEST" | "BUDDY_ACCEPT";

export async function notify(n: { userId: string; actorId: string; type: NotificationType; postId?: string }) {
  if (n.userId === n.actorId) return;
  await db.notification.create({ data: n });
}

export async function unnotify(n: { userId: string; actorId: string; type: NotificationType; postId?: string }) {
  await db.notification.deleteMany({ where: n });
}

const QUIET_MS = 60 * 60_000;

/** Tell followers a friend started focusing, at most once an hour so short sessions don't spam them. */
export async function notifySessionStart(actorId: string, sessionId: string) {
  const recent = await db.focusSession.count({
    where: { userId: actorId, id: { not: sessionId }, startedAt: { gte: new Date(Date.now() - QUIET_MS) } },
  });
  if (recent > 0) return;
  const followers = await db.follow.findMany({ where: { followingId: actorId }, select: { followerId: true }, take: 500 });
  if (followers.length) {
    await db.notification.createMany({ data: followers.map((f) => ({ userId: f.followerId, actorId, type: "SESSION_START" })) });
  }
}

export const getUnreadCount = (userId: string) => db.notification.count({ where: { userId, readAt: null } });

const PAGE = 30;

export async function getNotifications(userId: string, page: number) {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE,
    take: PAGE + 1,
    select: {
      id: true,
      type: true,
      postId: true,
      readAt: true,
      createdAt: true,
      actor: { select: { username: true, name: true, avatar: true } },
    },
  });
  return { items: rows.slice(0, PAGE), hasNext: rows.length > PAGE };
}
