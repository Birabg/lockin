import "server-only";
import { db } from "./db";
import { getStreaksAndToday } from "./queries";
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

  const [progress, sessions] = await Promise.all([
    getStreaksAndToday(friends.map((f) => f.user)),
    db.focusSession.findMany({
      where: { status: "ACTIVE", userId: { in: friends.map((f) => f.user.id) } },
      select: { userId: true, ...timing },
    }),
  ]);
  const sessionOf = new Map(sessions.map((s) => [s.userId, s]));

  return {
    buddies: friends
      .map(({ id, user: { id: userId, username, name, avatar } }) => {
        const session = sessionOf.get(userId);
        const p = progress.get(userId);
        return {
          id,
          user: { id: userId, username, name, avatar },
          streak: p?.streak ?? 0,
          todaySec: p?.todaySec ?? 0,
          live: isLive(session),
          label: session?.label ?? null,
        };
      })
      // focusing now first, then whoever is furthest into a streak
      .sort((a, b) => Number(b.live) - Number(a.live) || b.streak - a.streak || b.todaySec - a.todaySec),
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

/**
 * The rooms someone is in, for the rooms list: a few member faces, how many are focusing right now,
 * and live rooms first so the ones worth jumping into are on top.
 */
export async function getMyRooms(userId: string) {
  const rooms = await db.room.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      name: true,
      ownerId: true,
      _count: { select: { members: true } },
      members: { orderBy: { joinedAt: "asc" }, take: 40, select: { user: { select: { id: true, name: true, avatar: true } } } },
    },
  });
  const ids = [...new Set(rooms.flatMap((r) => r.members.map((m) => m.user.id)))];
  const sessions = ids.length
    ? await db.focusSession.findMany({
        where: { status: "ACTIVE", userId: { in: ids } },
        select: { userId: true, pausedAt: true, lastBeatAt: true },
      })
    : [];
  const live = new Set(sessions.filter(isLive).map((s) => s.userId));
  return rooms
    .map(({ members, _count, ...r }) => {
      const users = members.map((m) => m.user);
      // focusing people first, so the faces shown are the live ones
      const sorted = [...users.filter((u) => live.has(u.id)), ...users.filter((u) => !live.has(u.id))];
      return {
        ...r,
        size: _count.members,
        live: users.filter((u) => live.has(u.id)).length,
        faces: sorted.slice(0, 5).map((u) => ({ ...u, live: live.has(u.id) })),
        mine: r.ownerId === userId,
      };
    })
    .sort((x, y) => Number(y.live > 0) - Number(x.live > 0) || y.live - x.live);
}

export async function getRoom(code: string, viewerId: string | null) {
  const room = await db.room.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      ownerId: true,
      createdAt: true,
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
    ownerId: room.ownerId,
    createdAt: room.createdAt.toISOString(),
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
