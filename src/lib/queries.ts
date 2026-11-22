import "server-only";
import type { Prisma } from "@prisma/client";
import { hiddenPeople, reportedBy } from "./blocks";
import { db } from "./db";
import { hiddenAuthors } from "./safety";
import { rankTotals } from "./leaderboard";
import { LIVE_MS, remainingSeconds, runningSeconds } from "./session-math";
import { computeStreak } from "./streak";
import { dayKey, hourOf, shiftDayKey, weekStartKey, weekdayLetter } from "./time";
import { leaderboardUserFilter, verificationEnforced } from "./verification";

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

/** Current streak and time focused today for many users, in the same two queries as getStreaks. */
export async function getStreaksAndToday(people: Person[]) {
  const totals = await dayTotalsFor(people);
  const now = new Date();
  return new Map(
    people.map((p) => {
      const days = totals.get(p.id) ?? new Map<string, number>();
      const today = dayKey(now, p.timeZone);
      return [p.id, { streak: computeStreak(days, today).current, todaySec: days.get(today) ?? 0 }];
    }),
  );
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

/** What the nav dots show: is a buddy, or someone in one of this user's rooms, focusing right now? */
export async function getNavActivity(userId: string) {
  const live = { sessions: { some: { status: "ACTIVE", pausedAt: null, lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) } } } };
  const [buddy, roommate] = await Promise.all([
    db.buddy.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addressee: live },
          { addresseeId: userId, requester: live },
        ],
      },
      select: { id: true },
    }),
    db.roomMember.findFirst({
      where: { userId: { not: userId }, user: live, room: { members: { some: { userId } } } },
      select: { roomId: true },
    }),
  ]);
  return { buddies: !!buddy, rooms: !!roommate };
}

export async function getFocusingNow(limit = 12, viewerId: string | null = null) {
  const { blocked } = await hiddenPeople(viewerId);
  const live = await db.focusSession.findMany({
    where: {
      status: "ACTIVE",
      pausedAt: null,
      lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) },
      user: { bannedAt: null },
      ...(blocked.length ? { userId: { notIn: blocked } } : {}),
    },
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
      .map(({ label, goalMin, user, ...timing }) => ({ label, goalMin, user, remaining: remainingSeconds({ ...timing, goalMin }, now) })),
  };
}

/** What someone works on most, for one-tap picking. Discarded sessions don't count. */
export async function getTopLabels(userId: string, limit = 5): Promise<string[]> {
  const rows = await db.focusSession.groupBy({
    by: ["label"],
    where: { userId, label: { not: null }, status: { not: "ABANDONED" } },
    orderBy: [{ _count: { label: "desc" } }, { _max: { startedAt: "desc" } }],
    take: limit,
  });
  return rows.flatMap((r) => (r.label ? [r.label] : []));
}

export type Range = "today" | "week" | "all";

/** Ranked by each person's own calendar days, for the period as the viewer's time zone sees it. */
export async function getLeaderboard(range: Range, timeZone: string, opts: { page?: number; pageSize?: number } = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const ranked = await rankedTotals(range, timeZone, (running) => offset + pageSize + 1 + running);
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

/** Where one person stands on the board for the period, or null if they haven't focused in it. */
export async function getRank(range: Range, timeZone: string, userId: string) {
  const ranked = await rankedTotals(range, timeZone);
  const i = ranked.findIndex(([id]) => id === userId);
  return i === -1 ? null : i + 1;
}

/** Everyone's total for the period, highest first. `take` limits the finished rows read, given the running count. */
async function rankedTotals(range: Range, timeZone: string, take?: (running: number) => number) {
  const today = dayKey(new Date(), timeZone);
  const from = range === "today" ? today : range === "week" ? weekStartKey(today) : null;
  const inRange = (day: string) => !from || (day >= from && day <= today);
  // suspended accounts never rank; once verification is enforced, nor do unverified ones outside their grace period
  const eligible = leaderboardUserFilter(new Date(), verificationEnforced());

  const sessions = await db.focusSession.findMany({
    where: { status: "ACTIVE", user: eligible },
    select: { userId: true, startedAt: true, lastBeatAt: true, pausedSec: true, pausedAt: true, user: { select: { timeZone: true } } },
  });
  const running = sessions.map(({ user, ...s }) => ({ ...s, timeZone: user.timeZone }));

  // Running sessions can only lift people up, so this many finished rows always covers the page.
  const finished = await db.dailyStat.groupBy({
    by: ["userId"],
    where: { ...(from && { day: { gte: from, lte: today } }), user: eligible },
    _sum: { seconds: true },
    orderBy: { _sum: { seconds: "desc" } },
    take: take?.(running.length),
  });

  const totals = finished.map((row) => ({ userId: row.userId, seconds: row._sum.seconds ?? 0 }));
  return rankTotals(totals, running, inRange, new Date());
}

export type FeedTab = "global" | "following" | "timelapses";

const FEED_PAGE = 20;

export async function getFeed(viewerId: string | null, tab: FeedTab, opts: { take?: number; authorId?: string; cursor?: string } = {}) {
  const take = opts.take ?? FEED_PAGE;
  const [people, reportedPosts, reportedComments] = await Promise.all([
    hiddenPeople(viewerId),
    reportedBy(viewerId, "post"),
    reportedBy(viewerId, "comment"),
  ]);
  // a profile's own list leaves muted posts in: you went there on purpose. Blocks always apply.
  const hideAuthors = hiddenAuthors(people, opts.authorId ? "elsewhere" : "feed");
  let where: Prisma.PostWhereInput = {};
  if (opts.authorId) {
    if (hideAuthors.includes(opts.authorId)) return { posts: [], hasMore: false };
    where = { userId: opts.authorId };
  } else if (tab === "following") {
    if (!viewerId) return { posts: [], hasMore: false };
    const follows = await db.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
    where = { userId: { in: [viewerId, ...follows.map((f) => f.followingId)].filter((id) => !hideAuthors.includes(id)) } };
  } else {
    if (tab === "timelapses") where = { mediaType: "timelapse" };
    if (hideAuthors.length) where.userId = { notIn: hideAuthors };
  }
  where.hidden = false;
  where.user = { bannedAt: null };
  if (reportedPosts.length) where.id = { notIn: reportedPosts };
  const commentWhere: Prisma.CommentWhereInput = {
    hidden: false,
    user: { bannedAt: null },
    ...(people.blocked.length ? { userId: { notIn: people.blocked } } : {}),
    ...(reportedComments.length ? { id: { notIn: reportedComments } } : {}),
  };
  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, username: true, name: true, avatar: true, timeZone: true, sceneId: true } },
      session: { select: { goalMin: true, startedAt: true, endedAt: true, durationSec: true, pausedSec: true, label: true } },
      _count: { select: { likes: true, comments: { where: commentWhere } } },
      likes: { where: { userId: viewerId ?? "__guest__" }, select: { userId: true } },
      comments: {
        where: commentWhere,
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
    mediaUrl: p.mediaUrl,
    mediaType: p.mediaType,
    views: p.views,
    createdAt: p.createdAt,
    user: { id: p.user.id, username: p.user.username, name: p.user.name, avatar: p.user.avatar, sceneId: p.user.sceneId },
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

/** Sessions are split into slices this long to place them on the 24-hour clock. */
const RHYTHM_SLICE_SEC = 300;

/**
 * The long view for the stats page: every day of the last `weeks` whole weeks (Monday first, ending
 * this week), which hours of the day the focus happened in, and the average for each weekday.
 */
export async function getFocusHistory(person: Person, weeks = 20) {
  const today = dayKey(new Date(), person.timeZone);
  const start = shiftDayKey(weekStartKey(today), -(weeks - 1) * 7);
  const [totalsByUser, sessions] = await Promise.all([
    dayTotalsFor([person], start),
    db.focusSession.findMany({
      where: { userId: person.id, status: "DONE", startedAt: { gte: addDaysAgo(weeks * 7 + 1) } },
      select: { startedAt: true, durationSec: true },
    }),
  ]);
  const totals = totalsByUser.get(person.id) ?? new Map<string, number>();

  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const key = shiftDayKey(start, i);
    return { key, sec: totals.get(key) ?? 0, future: key > today };
  });

  // when in the day it happened: each session in short slices, so a long one spreads over its hours
  const hours = Array.from({ length: 24 }, () => 0);
  for (const s of sessions) {
    if (dayKey(s.startedAt, person.timeZone) < start) continue;
    for (let t = 0; t < s.durationSec; t += RHYTHM_SLICE_SEC) {
      const slice = Math.min(RHYTHM_SLICE_SEC, s.durationSec - t);
      hours[hourOf(new Date(s.startedAt.getTime() + (t + slice / 2) * 1000), person.timeZone)] += slice;
    }
  }

  // the average for each weekday, Monday first, from the first day with focus to today, so the
  // weeks before someone started don't drag it down
  const first = days.findIndex((d) => d.sec >= 60);
  const weekdays = Array.from({ length: 7 }, (_, d) => {
    const own = first < 0 ? [] : days.filter((_, i) => i >= first && i % 7 === d && !days[i].future);
    return own.length ? own.reduce((a, x) => a + x.sec, 0) / own.length : 0;
  });

  const past = days.filter((d) => !d.future);
  const best = past.reduce<{ key: string; sec: number } | null>((top, d) => (d.sec > (top?.sec ?? 0) ? d : top), null);
  return {
    today,
    days,
    hours,
    weekdays,
    total: past.reduce((a, d) => a + d.sec, 0),
    activeDays: past.filter((d) => d.sec >= 60).length,
    bestDay: best,
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
      avatar: true,
      timeZone: true,
      dailyGoalMin: true,
      createdAt: true,
      bannedAt: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user || user.bannedAt) return null;
  // blocked either way: the profile simply doesn't exist for them
  if (viewerId && (await hiddenPeople(viewerId)).blocked.includes(user.id)) return null;
  const [isFollowing, muting] = viewerId
    ? await Promise.all([
        db.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } }).then(Boolean),
        db.mute.findUnique({ where: { muterId_mutedId: { muterId: viewerId, mutedId: user.id } } }).then(Boolean),
      ])
    : [false, false];
  return { ...user, isFollowing, muting };
}

const PEOPLE_PAGE = 30;
/** how far back "active lately" looks, for ordering and for the time shown on each row */
const ACTIVE_DAYS = 7;

export type PeopleTab = "discover" | "following" | "followers";

export type PersonRow = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  avatar: string | null;
  /** seconds focused over the last week */
  weekSec: number;
  streak: number;
  /** what they're focusing on right now, or null when they aren't */
  live: { label: string | null } | null;
  followsYou: boolean;
  following: boolean;
};

/**
 * People for the People page: everyone, the people you follow, or your followers, optionally matching a
 * search. Whoever focused most over the last week comes first, then everyone else, newest first, so the
 * list leads with people worth following rather than whoever signed up last.
 */
export async function listPeople({ q, tab, page, viewerId }: { q: string; tab: PeopleTab; page: number; viewerId: string | null }) {
  const term = q.trim();
  const { blocked } = await hiddenPeople(viewerId);
  const hidden = viewerId && tab === "discover" ? [...blocked, viewerId] : blocked;
  const where: Prisma.UserWhereInput = {
    bannedAt: null,
    ...(hidden.length ? { id: { notIn: hidden } } : {}),
    ...(term
      ? {
          OR: [{ username: { contains: term.replace(/^@/, ""), mode: "insensitive" } }, { name: { contains: term, mode: "insensitive" } }],
        }
      : {}),
    ...(viewerId && tab === "following" ? { followers: { some: { followerId: viewerId } } } : {}),
    ...(viewerId && tab === "followers" ? { following: { some: { followingId: viewerId } } } : {}),
  };

  const since = dayKey(new Date(Date.now() - ACTIVE_DAYS * 86_400_000), "UTC");
  const active = await db.dailyStat.groupBy({
    by: ["userId"],
    where: { day: { gte: since }, seconds: { gt: 0 }, user: where },
    _sum: { seconds: true },
    orderBy: { _sum: { seconds: "desc" } },
    take: 500,
  });
  const weekSec = new Map(active.map((r) => [r.userId, r._sum.seconds ?? 0]));
  const activeIds = active.map((r) => r.userId);

  // one page out of [active people..., everyone else...], with one extra to know if there's a next page
  const offset = (page - 1) * PEOPLE_PAGE;
  const fromActive = activeIds.slice(offset, offset + PEOPLE_PAGE + 1);
  const need = PEOPLE_PAGE + 1 - fromActive.length;
  const select = { id: true, name: true, username: true, bio: true, avatar: true, timeZone: true } as const;
  const [activeRows, restRows] = await Promise.all([
    fromActive.length ? db.user.findMany({ where: { id: { in: fromActive } }, select }) : [],
    need > 0
      ? db.user.findMany({
          where: activeIds.length ? { AND: [where, { id: { notIn: activeIds } }] } : where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: Math.max(0, offset - activeIds.length),
          take: need,
          select,
        })
      : [],
  ]);
  const byId = new Map(activeRows.map((r) => [r.id, r]));
  const rows = [...fromActive.flatMap((id) => byId.get(id) ?? []), ...restRows];
  const people = rows.slice(0, PEOPLE_PAGE);
  const ids = people.map((p) => p.id);

  const [streaks, live, theyFollow, iFollow] = await Promise.all([
    ids.length ? getStreaks(people) : new Map<string, number>(),
    db.focusSession.findMany({
      where: { userId: { in: ids }, status: "ACTIVE", pausedAt: null, lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) } },
      select: { userId: true, label: true },
    }),
    viewerId ? db.follow.findMany({ where: { followingId: viewerId, followerId: { in: ids } }, select: { followerId: true } }) : [],
    viewerId ? db.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true } }) : [],
  ]);
  const liveBy = new Map(live.map((s) => [s.userId, s.label]));
  const followsYou = new Set(theyFollow.map((f) => f.followerId));
  const following = new Set(iFollow.map((f) => f.followingId));

  return {
    hasNext: rows.length > PEOPLE_PAGE,
    people: people.map((p): PersonRow => ({
      id: p.id,
      name: p.name,
      username: p.username,
      bio: p.bio,
      avatar: p.avatar,
      weekSec: weekSec.get(p.id) ?? 0,
      streak: streaks.get(p.id) ?? 0,
      live: liveBy.has(p.id) ? { label: liveBy.get(p.id) ?? null } : null,
      followsYou: followsYou.has(p.id),
      following: following.has(p.id),
    })),
  };
}

/** How many people you follow and how many follow you, leaving out banned and blocked accounts. */
export async function getFollowCounts(viewerId: string) {
  const { blocked } = await hiddenPeople(viewerId);
  const visible = { bannedAt: null, ...(blocked.length ? { id: { notIn: blocked } } : {}) };
  const [following, followers] = await Promise.all([
    db.user.count({ where: { ...visible, followers: { some: { followerId: viewerId } } } }),
    db.user.count({ where: { ...visible, following: { some: { followingId: viewerId } } } }),
  ]);
  return { following, followers };
}
