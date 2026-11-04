import "server-only";
import { db } from "./db";
import { getStreaks } from "./queries";
import { LIVE_MS, isExpired } from "./session-math";

const person = { select: { id: true, username: true, name: true, avatar: true, timeZone: true } };
const timing = { label: true, goalMin: true, startedAt: true, pausedSec: true, pausedAt: true, lastBeatAt: true } as const;

/** Whether a session counts as live right now: running, not paused, and heard from recently. */
const isLive = (s: { pausedAt: Date | null; lastBeatAt: Date } | undefined) =>
  !!s && !s.pausedAt && Date.now() - s.lastBeatAt.getTime() < LIVE_MS;

export async function getBuddies(userId: string) {
  const rows = await db.buddy.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    orderBy: { createdAt: "desc" },
    include: { requester: person, addressee: person },
  });
  const accepted = rows.filter((r) => r.status === "ACCEPTED");
  const friends = accepted.map((r) => ({ id: r.id, user: r.requesterId === userId ? r.addressee : r.requester }));

  const [streaks, sessions] = await Promise.all([
    getStreaks(friends.map((f) => f.user)),
    db.focusSession.findMany({
      where: { status: "ACTIVE", userId: { in: friends.map((f) => f.user.id) } },
      select: { userId: true, ...timing },
    }),
  ]);
  const sessionOf = new Map(sessions.map((s) => [s.userId, s]));

  return {
    buddies: friends.map(({ id, user: { id: userId, username, name, avatar } }) => {
      const session = sessionOf.get(userId);
      return {
        id,
        user: { id: userId, username, name, avatar },
        streak: streaks.get(userId) ?? 0,
        live: isLive(session),
        label: session?.label ?? null,
      };
    }),
    incoming: rows.filter((r) => r.status === "PENDING" && r.addresseeId === userId).map((r) => ({ id: r.id, user: r.requester })),
    outgoing: rows.filter((r) => r.status === "PENDING" && r.requesterId === userId).map((r) => ({ id: r.id, user: r.addressee })),
  };
}

export type BuddyState = "none" | "outgoing" | "incoming" | "buddies";

export async function getBuddyState(viewerId: string, otherId: string): Promise<{ state: BuddyState; id: string | null }> {
  const row = await db.buddy.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: viewerId },
      ],
    },
  });
  if (!row) return { state: "none", id: null };
  if (row.status === "ACCEPTED") return { state: "buddies", id: row.id };
  return { state: row.requesterId === viewerId ? "outgoing" : "incoming", id: row.id };
}

export const getMyRooms = (userId: string) =>
  db.room.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, code: true, name: true, _count: { select: { members: true } } },
  });

export async function getRoom(code: string, viewerId: string | null) {
  const room = await db.room.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      members: {
        orderBy: { joinedAt: "asc" },
        take: 100,
        select: { user: { select: { id: true, username: true, name: true, avatar: true } } },
      },
    },
  });
  if (!room) return null;
  const ids = room.members.map((m) => m.user.id);
  const sessions = await db.focusSession.findMany({
    where: { status: "ACTIVE", userId: { in: ids } },
    select: { userId: true, ...timing },
  });
  const sessionOf = new Map(sessions.map((s) => [s.userId, s]));
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    isMember: !!viewerId && ids.includes(viewerId),
    members: room.members.map(({ user }) => {
      const s = sessionOf.get(user.id);
      return {
        user,
        session:
          s && (isLive(s) || (s.pausedAt && !isExpired(s)))
            ? {
                label: s.label,
                goalMin: s.goalMin,
                startedAt: s.startedAt.toISOString(),
                pausedSec: s.pausedSec,
                pausedAt: s.pausedAt?.toISOString() ?? null,
              }
            : null,
      };
    }),
  };
}
export type RoomView = NonNullable<Awaited<ReturnType<typeof getRoom>>>;
