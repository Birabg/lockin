import "server-only";
import { db } from "./db";
import { addDays, dayKey, startOfDay, startOfWeek, weekdayLetter } from "./time";

/** With no heartbeat for this long, time stops counting until the client checks back in. */
const STALE_MS = 3 * 60_000;
/** "Focusing now" = active session with a heartbeat this recent. */
const LIVE_MS = 90_000;
/** How long past its goal a silent session (locked phone, sleeping laptop) can still be picked back up. */
const GRACE_MS = 10 * 60_000;

const secondsBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));

type SessionTimes = { startedAt: Date; lastBeatAt: Date; goalMin: number };

/** A silent session survives until its goal + grace, so locking your phone mid-session doesn't end it. */
export function isExpired(s: SessionTimes, now = Date.now()) {
  const goalEnd = s.startedAt.getTime() + s.goalMin * 60_000 + GRACE_MS;
  return now > Math.max(s.lastBeatAt.getTime() + STALE_MS, goalEnd);
}

/** End a session at its last heartbeat. Returns the seconds credited. */
export async function closeAtLastBeat(s: SessionTimes & { id: string }) {
  const durationSec = secondsBetween(s.startedAt, s.lastBeatAt);
  await db.focusSession.updateMany({
    where: { id: s.id, status: "ACTIVE" },
    data: { status: "DONE", endedAt: s.lastBeatAt, durationSec },
  });
  return durationSec;
}

/** Time to show for a running session: a silent one only counts up to its last heartbeat. */
function runningSeconds(s: { startedAt: Date; lastBeatAt: Date }, now: Date) {
  const silent = now.getTime() - s.lastBeatAt.getTime() > STALE_MS;
  return secondsBetween(s.startedAt, silent ? s.lastBeatAt : now);
}

/** Close sessions whose tab was closed without pressing stop. */
export async function reapStaleSessions() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const silent = await db.focusSession.findMany({
    where: { status: "ACTIVE", lastBeatAt: { lt: cutoff } },
    select: { id: true, startedAt: true, lastBeatAt: true, goalMin: true },
  });
  await Promise.all(silent.filter((s) => isExpired(s)).map(closeAtLastBeat));
}

/** Seconds focused per user since `from` (finished + still-running sessions). */
async function totalsSince(from: Date, userIds?: string[]) {
  const where = { startedAt: { gte: from }, ...(userIds ? { userId: { in: userIds } } : {}) };
  const [done, active] = await Promise.all([
    db.focusSession.groupBy({ by: ["userId"], where: { ...where, status: "DONE" }, _sum: { durationSec: true } }),
    db.focusSession.findMany({ where: { ...where, status: "ACTIVE" }, select: { userId: true, startedAt: true, lastBeatAt: true } }),
  ]);
  const totals = new Map<string, number>();
  for (const row of done) totals.set(row.userId, row._sum.durationSec ?? 0);
  const now = new Date();
  for (const a of active) totals.set(a.userId, (totals.get(a.userId) ?? 0) + runningSeconds(a, now));
  return totals;
}

/** dayKey -> seconds for one user over the last `days` days. */
export async function dailyTotals(userId: string, days: number) {
  const from = startOfDay(addDays(new Date(), -(days - 1)));
  const sessions = await db.focusSession.findMany({
    where: { userId, startedAt: { gte: from }, status: { in: ["DONE", "ACTIVE"] } },
    select: { startedAt: true, lastBeatAt: true, durationSec: true, status: true },
  });
  const now = new Date();
  const map = new Map<string, number>();
  for (const s of sessions) {
    const sec = s.status === "ACTIVE" ? runningSeconds(s, now) : s.durationSec;
    const k = dayKey(s.startedAt);
    map.set(k, (map.get(k) ?? 0) + sec);
  }
  return map;
}

const MIN_DAY_SEC = 60; // a day counts toward the streak after 1 focused minute

export async function getStreak(userId: string) {
  const totals = await dailyTotals(userId, 400);
  const today = new Date();
  let current = 0;
  // today not done yet doesn't break the streak
  let i = (totals.get(dayKey(today)) ?? 0) >= MIN_DAY_SEC ? 0 : 1;
  while ((totals.get(dayKey(addDays(today, -i))) ?? 0) >= MIN_DAY_SEC) {
    current++;
    i++;
  }
  let best = 0;
  let run = 0;
  for (let d = 399; d >= 0; d--) {
    if ((totals.get(dayKey(addDays(today, -d))) ?? 0) >= MIN_DAY_SEC) best = Math.max(best, ++run);
    else run = 0;
  }
  return { current, best };
}

export async function getStreaks(userIds: string[]) {
  const unique = [...new Set(userIds)];
  const entries = await Promise.all(unique.map(async (id) => [id, (await getStreak(id)).current] as const));
  return new Map(entries);
}

export type WeekDay = { key: string; letter: string; sec: number; hit: boolean; isToday: boolean; isFuture: boolean };

/** Monday..Sunday of the current week, for the streak card strip. */
export async function getWeekStrip(userId: string | null, goalMin: number): Promise<WeekDay[]> {
  const monday = startOfWeek();
  const totals = userId ? await dailyTotals(userId, 8) : new Map<string, number>();
  const todayKey = dayKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = dayKey(date);
    const sec = totals.get(key) ?? 0;
    return { key, letter: weekdayLetter(date), sec, hit: sec >= goalMin * 60, isToday: key === todayKey, isFuture: key > todayKey };
  });
}

export async function getTodaySeconds(userId: string) {
  return (await totalsSince(startOfDay(), [userId])).get(userId) ?? 0;
}

export async function getFocusingNow(limit = 12) {
  const live = await db.focusSession.findMany({
    where: { status: "ACTIVE", lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) } },
    orderBy: { startedAt: "asc" },
    select: {
      startedAt: true,
      label: true,
      goalMin: true,
      user: { select: { id: true, username: true, name: true } },
    },
  });
  return { count: live.length, sessions: live.slice(0, limit) };
}

export type Range = "today" | "week" | "all";

export async function getLeaderboard(range: Range, limit = 50) {
  const from = range === "today" ? startOfDay() : range === "week" ? startOfWeek() : new Date(0);
  const totals = await totalsSince(from);
  const top = [...totals.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const users = await db.user.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, username: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return top.flatMap(([id, sec], i) => {
    const user = byId.get(id);
    return user ? [{ rank: i + 1, user, sec }] : [];
  });
}

export type FeedTab = "global" | "following";

export async function getFeed(viewerId: string | null, tab: FeedTab, opts: { take?: number; authorId?: string } = {}) {
  const take = opts.take ?? 20;
  let where: { userId?: string | { in: string[] } } = {};
  if (opts.authorId) {
    where = { userId: opts.authorId };
  } else if (tab === "following") {
    if (!viewerId) return [];
    const follows = await db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    where = { userId: { in: [viewerId, ...follows.map((f) => f.followingId)] } };
  }
  const posts = await db.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, username: true, name: true } },
      session: { select: { goalMin: true, startedAt: true, endedAt: true, durationSec: true, label: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: viewerId ?? "__guest__" }, select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, body: true, createdAt: true, user: { select: { username: true, name: true } } },
      },
    },
  });
  const streaks = await getStreaks(posts.map((p) => p.user.id));
  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    createdAt: p.createdAt,
    user: p.user,
    streak: streaks.get(p.user.id) ?? 0,
    session: p.session,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    liked: p.likes.length > 0,
    comments: p.comments,
  }));
}
export type FeedPost = Awaited<ReturnType<typeof getFeed>>[number];

export async function getStats(userId: string) {
  const totals = await dailyTotals(userId, 30);
  const today = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, -(29 - i));
    const key = dayKey(date);
    return { key, letter: weekdayLetter(date), sec: totals.get(key) ?? 0 };
  });
  const [allTime, sessionsCount, byLabel, streak, longest] = await Promise.all([
    db.focusSession.aggregate({ where: { userId, status: "DONE" }, _sum: { durationSec: true } }),
    db.focusSession.count({ where: { userId, status: "DONE", durationSec: { gte: 60 } } }),
    db.focusSession.groupBy({
      by: ["label"],
      where: { userId, status: "DONE" },
      _sum: { durationSec: true },
      orderBy: { _sum: { durationSec: "desc" } },
      take: 6,
    }),
    getStreak(userId),
    db.focusSession.findFirst({ where: { userId, status: "DONE" }, orderBy: { durationSec: "desc" }, select: { durationSec: true } }),
  ]);
  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => dayKey(addDays(startOfWeek(), i))));
  return {
    today: totals.get(dayKey(today)) ?? 0,
    week: last30.filter((d) => weekKeys.has(d.key)).reduce((a, d) => a + d.sec, 0),
    allTime: allTime._sum.durationSec ?? 0,
    sessionsCount,
    longestSession: longest?.durationSec ?? 0,
    streak,
    last30,
    byLabel: byLabel.map((l) => ({ label: l.label ?? "Untitled", sec: l._sum.durationSec ?? 0 })),
  };
}

export async function getProfile(username: string, viewerId: string | null) {
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      createdAt: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) return null;
  const isFollowing = viewerId
    ? !!(await db.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }))
    : false;
  return { ...user, isFollowing };
}
