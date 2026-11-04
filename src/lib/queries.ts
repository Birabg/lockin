import "server-only";
import { db } from "./db";
import { LIVE_MS, activeSeconds, runningSeconds } from "./session-math";
import { computeStreak } from "./streak";
import { dayKey, shiftDayKey, weekStartKey, weekdayLetter } from "./time";

type Person = { id: string; timeZone: string };
type DayTotals = Map<string, number>;

/**
 * day -> seconds for each user, days being that user's own calendar days.
 * Two queries however many users: finished time from DailyStat, plus any running session.
 */
async function dayTotalsFor(people: Person[], fromDay?: string) {
  const ids = [...new Set(people.map((p) => p.id))];
  const zones = new Map(people.map((p) => [p.id, p.timeZone]));
  const [stats, running] = await Promise.all([
    db.dailyStat.findMany({
      where: { userId: { in: ids }, ...(fromDay ? { day: { gte: fromDay } } : {}) },
      select: { userId: true, day: true, seconds: true },
    }),
    db.focusSession.findMany({
      where: { userId: { in: ids }, status: "ACTIVE" },
      select: { userId: true, startedAt: true, lastBeatAt: true, pausedSec: true, pausedAt: true },
    }),
  ]);
  const totals = new Map<string, DayTotals>(ids.map((id) => [id, new Map()]));
  const add = (userId: string, day: string, seconds: number) => {
    const days = totals.get(userId);
    days?.set(day, (days.get(day) ?? 0) + seconds);
  };
  for (const s of stats) add(s.userId, s.day, s.seconds);
  const now = new Date();
  for (const s of running) {
    const day = dayKey(s.startedAt, zones.get(s.userId) ?? "UTC");
    if (!fromDay || day >= fromDay) add(s.userId, day, runningSeconds(s, now));
  }
  return totals;
}

export async function getStreak(person: Person) {
  const totals = await dayTotalsFor([person]);
  return computeStreak(totals.get(person.id) ?? new Map(), dayKey(new Date(), person.timeZone));
}

/** Current streaks for many users in two queries. */
export async function getStreaks(people: Person[]) {
  const totals = await dayTotalsFor(people);
  const now = new Date();
  return new Map(people.map((p) => [p.id, computeStreak(totals.get(p.id) ?? new Map(), dayKey(now, p.timeZone)).current]));
}

export type WeekDay = { key: string; letter: string; sec: number; hit: boolean; isToday: boolean; isFuture: boolean };

/** Monday..Sunday of the current week, for the streak card strip. */
export async function getWeekStrip(person: Person | null, timeZone: string, goalMin: number): Promise<WeekDay[]> {
  const todayKey = dayKey(new Date(), timeZone);
  const monday = weekStartKey(todayKey);
  const totals = person ? ((await dayTotalsFor([person], monday)).get(person.id) ?? new Map<string, number>()) : new Map<string, number>();
  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDayKey(monday, i);
    const sec = totals.get(key) ?? 0;
    return { key, letter: weekdayLetter(key), sec, hit: sec >= goalMin * 60, isToday: key === todayKey, isFuture: key > todayKey };
  });
}

export async function getTodaySeconds(person: Person) {
  const today = dayKey(new Date(), person.timeZone);
  return (await dayTotalsFor([person], today)).get(person.id)?.get(today) ?? 0;
}

export async function getFocusingNow(limit = 12) {
  const live = await db.focusSession.findMany({
    where: { status: "ACTIVE", pausedAt: null, lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) } },
    orderBy: { startedAt: "asc" },
    select: {
      startedAt: true,
      pausedSec: true,
      pausedAt: true,
      label: true,
      goalMin: true,
      user: { select: { id: true, username: true, name: true, avatar: true } },
    },
  });
  const now = new Date();
  return {
    count: live.length,
    sessions: live
      .slice(0, limit)
      .map(({ label, goalMin, user, ...timing }) => ({ label, goalMin, user, sec: activeSeconds(timing, now) })),
  };
}

export type Range = "today" | "week" | "all";

/** Ranked by each person's own calendar days, for the period as the viewer's time zone sees it. */
export async function getLeaderboard(range: Range, timeZone: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const today = dayKey(new Date(), timeZone);
  const from = range === "today" ? today : range === "week" ? weekStartKey(today) : null;
  const inRange = (day: string) => !from || (day >= from && day <= today);

  const running = await db.focusSession.findMany({
    where: { status: "ACTIVE" },
    select: { userId: true, startedAt: true, lastBeatAt: true, pausedSec: true, pausedAt: true, user: { select: { timeZone: true } } },
  });

  // Running sessions can only lift people up, so this many finished rows always covers the page.
  const finished = await db.dailyStat.groupBy({
    by: ["userId"],
    where: from ? { day: { gte: from, lte: today } } : {},
    _sum: { seconds: true },
    orderBy: { _sum: { seconds: "desc" } },
    take: offset + pageSize + 1 + running.length,
  });

  const totals = new Map(finished.map((row) => [row.userId, row._sum.seconds ?? 0]));
  const now = new Date();
  for (const s of running) {
    if (inRange(dayKey(s.startedAt, s.user.timeZone))) totals.set(s.userId, (totals.get(s.userId) ?? 0) + runningSeconds(s, now));
  }

  const ranked = [...totals.entries()].filter(([, sec]) => sec > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const slice = ranked.slice(offset, offset + pageSize);
  const users = await db.user.findMany({
    where: { id: { in: slice.map(([id]) => id) } },
    select: { id: true, username: true, name: true, avatar: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const rows = slice.flatMap(([id, sec], i) => {
    const user = byId.get(id);
    return user ? [{ rank: offset + i + 1, user, sec }] : [];
  });
  return { rows, hasNext: ranked.length > offset + pageSize };
}

export type FeedTab = "global" | "following" | "timelapses";

const FEED_PAGE = 20;

export async function getFeed(viewerId: string | null, tab: FeedTab, opts: { take?: number; authorId?: string; cursor?: string } = {}) {
  const take = opts.take ?? FEED_PAGE;
  let where: { userId?: string | { in: string[] }; timelapseUrl?: { not: null } } = {};
  if (opts.authorId) {
    where = { userId: opts.authorId };
  } else if (tab === "following") {
    if (!viewerId) return { posts: [], hasMore: false };
    const follows = await db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    where = { userId: { in: [viewerId, ...follows.map((f) => f.followingId)] } };
  } else if (tab === "timelapses") {
    where = { timelapseUrl: { not: null } };
  }
  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, username: true, name: true, avatar: true, timeZone: true } },
      session: { select: { goalMin: true, startedAt: true, endedAt: true, durationSec: true, label: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId: viewerId ?? "__guest__" }, select: { userId: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, body: true, createdAt: true, user: { select: { username: true, name: true, avatar: true } } },
      },
    },
  });
  const page = rows.slice(0, take);
  const streaks = await getStreaks(page.map((p) => p.user));
  const posts = page.map((p) => ({
    id: p.id,
    body: p.body,
    timelapseUrl: p.timelapseUrl,
    createdAt: p.createdAt,
    user: { id: p.user.id, username: p.user.username, name: p.user.name, avatar: p.user.avatar },
    streak: streaks.get(p.user.id) ?? 0,
    session: p.session,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    liked: p.likes.length > 0,
    comments: p.comments.toReversed(), // newest 20, shown oldest first
  }));
  return { posts, hasMore: rows.length > take };
}
export type FeedPost = Awaited<ReturnType<typeof getFeed>>["posts"][number];

export async function getStats(person: Person) {
  const userId = person.id;
  const today = dayKey(new Date(), person.timeZone);
  const totals = (await dayTotalsFor([person], shiftDayKey(today, -29))).get(userId) ?? new Map<string, number>();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const key = shiftDayKey(today, i - 29);
    return { key, letter: weekdayLetter(key), sec: totals.get(key) ?? 0 };
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
    getStreak(person),
    db.focusSession.findFirst({ where: { userId, status: "DONE" }, orderBy: { durationSec: "desc" }, select: { durationSec: true } }),
  ]);
  const monday = weekStartKey(today);
  return {
    today: totals.get(today) ?? 0,
    week: last30.filter((d) => d.key >= monday).reduce((a, d) => a + d.sec, 0),
    allTime: allTime._sum.durationSec ?? 0,
    sessionsCount,
    longestSession: longest?.durationSec ?? 0,
    streak,
    last30,
    byLabel: byLabel.map((l) => ({ label: l.label ?? "Untitled", sec: l._sum.durationSec ?? 0 })),
  };
}

export async function getWeeklyRecap(person: Person, goalMin: number) {
  const today = dayKey(new Date(), person.timeZone);
  const monday = weekStartKey(today);
  const lastMonday = shiftDayKey(monday, -7);
  const totals = (await dayTotalsFor([person], lastMonday)).get(person.id) ?? new Map<string, number>();

  const days = Array.from({ length: 7 }, (_, i) => shiftDayKey(monday, i)).filter((d) => d <= today);
  const sum = (keys: string[]) => keys.reduce((a, k) => a + (totals.get(k) ?? 0), 0);
  const sameDaysLastWeek = days.map((d) => shiftDayKey(d, -7));
  const best = days.reduce<{ day: string; sec: number } | null>((top, day) => {
    const sec = totals.get(day) ?? 0;
    return sec > (top?.sec ?? 0) ? { day, sec } : top;
  }, null);

  const sessions = await db.focusSession.findMany({
    where: { userId: person.id, status: "DONE", startedAt: { gte: addDaysAgo(8) } },
    select: { startedAt: true, durationSec: true, label: true },
  });
  const labels = new Map<string, number>();
  let sessionCount = 0;
  for (const s of sessions) {
    if (dayKey(s.startedAt, person.timeZone) < monday) continue;
    sessionCount++;
    if (s.label) labels.set(s.label, (labels.get(s.label) ?? 0) + s.durationSec);
  }

  return {
    thisWeek: sum(days),
    lastWeekSoFar: sum(sameDaysLastWeek),
    daysFocused: days.filter((d) => (totals.get(d) ?? 0) >= 60).length,
    goalDays: days.filter((d) => (totals.get(d) ?? 0) >= goalMin * 60).length,
    daysSoFar: days.length,
    bestDay: best,
    topLabel: [...labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    sessionCount,
  };
}

const addDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function getProfile(username: string, viewerId: string | null) {
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      avatar: true,
      timeZone: true,
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

const PEOPLE_PAGE = 30;

export async function searchPeople(q: string, page: number) {
  const term = q.trim();
  const rows = await db.user.findMany({
    where: term ? { OR: [{ username: { contains: term.toLowerCase() } }, { name: { contains: term } }] } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PEOPLE_PAGE,
    take: PEOPLE_PAGE + 1,
    select: { id: true, name: true, username: true, bio: true, avatar: true },
  });
  return { people: rows.slice(0, PEOPLE_PAGE), hasNext: rows.length > PEOPLE_PAGE };
}
