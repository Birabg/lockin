import "server-only";
import type { Prisma } from "@prisma/client";
import { hiddenPeople, reportedBy } from "./blocks";
import { brand } from "./brand";
import { db } from "./db";
import { questMet, sessionCounts } from "./quests";
import { dayKey } from "./time";
import { bankQuestion, heat } from "./wall";

/* ---------------- Quest progress, from finished sessions ---------------- */

/**
 * Credits a finished session to every quest its owner joined that it counts towards, and marks
 * quests done when they reach their target. finishSession calls it once per session, right after
 * the session is first counted.
 */
export async function applyQuestProgress(s: { userId: string; endedAt: Date; durationSec: number; label: string | null }) {
  const joined = await db.questParticipant.findMany({
    where: {
      userId: s.userId,
      completedAt: null,
      quest: { hidden: false, completedAt: null, startsAt: { lte: s.endedAt }, endsAt: { gte: s.endedAt } },
    },
    include: { quest: true },
  });
  for (const p of joined) {
    if (!sessionCounts(p.quest, p.joinedAt, s)) continue;
    const mine = await db.questParticipant.update({
      where: { questId_userId: { questId: p.questId, userId: s.userId } },
      data: { progressSec: { increment: s.durationSec }, progressSessions: { increment: 1 } },
    });
    if (p.quest.type === "solo") {
      if (questMet(p.quest, mine.progressSec, mine.progressSessions)) {
        await db.questParticipant.update({
          where: { questId_userId: { questId: p.questId, userId: s.userId } },
          data: { completedAt: s.endedAt },
        });
      }
      continue;
    }
    // group: everyone's time together
    const sum = await db.questParticipant.aggregate({
      where: { questId: p.questId },
      _sum: { progressSec: true, progressSessions: true },
    });
    if (questMet(p.quest, sum._sum.progressSec ?? 0, sum._sum.progressSessions ?? 0)) {
      await db.quest.update({ where: { id: p.questId }, data: { completedAt: s.endedAt } });
      await db.questParticipant.updateMany({ where: { questId: p.questId, completedAt: null }, data: { completedAt: s.endedAt } });
    }
  }
}

/* ---------------- The quest board ---------------- */

/**
 * What a viewer shouldn't see: what they reported (gone for them straight away, before enough reports hide
 * it for everyone) and anything by someone in a block with them.
 */
async function questFilter(viewerId: string | null): Promise<Prisma.QuestWhereInput> {
  const [reported, { blocked }] = await Promise.all([reportedBy(viewerId, "quest"), hiddenPeople(viewerId)]);
  return {
    hidden: false,
    ...(reported.length ? { id: { notIn: reported } } : {}),
    ...(blocked.length ? { creatorId: { notIn: blocked } } : {}),
  };
}

const questSelect = {
  id: true,
  creatorId: true,
  title: true,
  description: true,
  type: true,
  targetMinutes: true,
  targetSessions: true,
  minSessionMin: true,
  tag: true,
  color: true,
  startsAt: true,
  endsAt: true,
  completedAt: true,
  createdAt: true,
  creator: { select: { username: true, name: true } },
} satisfies Prisma.QuestSelect;

type QuestRow = Prisma.QuestGetPayload<{ select: typeof questSelect }>;

export type BoardQuest = QuestRow & {
  joinCount: number;
  recentJoins: number;
  /** Group quests: everyone's progress. Solo: just yours. */
  progressSec: number;
  progressSessions: number;
  me: { joined: boolean; progressSec: number; progressSessions: number; completedAt: Date | null } | null;
  /** Done for you: a finished group quest, or your solo target met. */
  done: boolean;
  mine: boolean;
};

async function decorate(rows: QuestRow[], viewerId: string | null): Promise<BoardQuest[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((q) => q.id);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [counts, recent, sums, mine] = await Promise.all([
    db.questParticipant.groupBy({ by: ["questId"], where: { questId: { in: ids } }, _count: true }),
    db.questParticipant.groupBy({ by: ["questId"], where: { questId: { in: ids }, joinedAt: { gte: dayAgo } }, _count: true }),
    db.questParticipant.groupBy({
      by: ["questId"],
      where: { questId: { in: ids } },
      _sum: { progressSec: true, progressSessions: true },
    }),
    viewerId ? db.questParticipant.findMany({ where: { questId: { in: ids }, userId: viewerId } }) : Promise.resolve([]),
  ]);
  const by = <T extends { questId: string }>(list: T[]) => new Map(list.map((x) => [x.questId, x]));
  const countMap = by(counts);
  const recentMap = by(recent);
  const sumMap = by(sums);
  const mineMap = by(mine);
  return rows.map((q) => {
    const p = mineMap.get(q.id);
    const sum = sumMap.get(q.id)?._sum;
    const group = q.type === "group";
    return {
      ...q,
      joinCount: countMap.get(q.id)?._count ?? 0,
      recentJoins: recentMap.get(q.id)?._count ?? 0,
      progressSec: group ? (sum?.progressSec ?? 0) : (p?.progressSec ?? 0),
      progressSessions: group ? (sum?.progressSessions ?? 0) : (p?.progressSessions ?? 0),
      me: p ? { joined: true, progressSec: p.progressSec, progressSessions: p.progressSessions, completedAt: p.completedAt } : null,
      done: group ? !!q.completedAt : !!p?.completedAt,
      mine: !!viewerId && q.creatorId === viewerId,
    };
  });
}

/** Most joined in the last day first, then ending soonest. Anything you've finished sinks to the bottom. */
function rank(a: BoardQuest, b: BoardQuest) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.recentJoins !== b.recentJoins) return b.recentJoins - a.recentJoins;
  return a.endsAt.getTime() - b.endsAt.getTime();
}

export async function getQuestBoard(viewerId: string | null, limit = 5) {
  const rows = await db.quest.findMany({
    where: { ...(await questFilter(viewerId)), endsAt: { gt: new Date() } },
    orderBy: { endsAt: "asc" },
    take: 60,
    select: questSelect,
  });
  const quests = (await decorate(rows, viewerId)).sort(rank);
  return { quests: quests.slice(0, limit), total: quests.length };
}

export type QuestTab = "active" | "joined" | "ended";

export async function listQuests(viewerId: string | null, tab: QuestTab) {
  const now = new Date();
  const where: Prisma.QuestWhereInput =
    tab === "ended"
      ? { hidden: false, endsAt: { lte: now } }
      : tab === "joined"
        ? { hidden: false, participants: { some: { userId: viewerId ?? "__guest__" } } }
        : { hidden: false, endsAt: { gt: now } };
  const rows = await db.quest.findMany({
    where: { ...where, ...(await questFilter(viewerId)) },
    orderBy: tab === "ended" ? { endsAt: "desc" } : { endsAt: "asc" },
    take: 60,
    select: questSelect,
  });
  const quests = await decorate(rows, viewerId);
  return tab === "active" ? quests.sort(rank) : quests;
}

/** The detail popover: rules, the top people and your progress. */
export async function getQuestDetail(id: string, viewerId: string | null) {
  const filter = await questFilter(viewerId);
  const row = await db.quest.findFirst({ where: { ...filter, AND: [{ id }] }, select: questSelect });
  if (!row) return null;
  const [quest] = await decorate([row], viewerId);
  const { blocked } = await hiddenPeople(viewerId);
  const top = await db.questParticipant.findMany({
    where: { questId: id, ...(blocked.length ? { userId: { notIn: blocked } } : {}) },
    orderBy: [{ progressSec: "desc" }, { joinedAt: "asc" }],
    take: 5,
    select: {
      progressSec: true,
      progressSessions: true,
      completedAt: true,
      user: { select: { username: true, name: true, avatar: true } },
    },
  });
  return { quest, top };
}

/* ---------------- The wall ---------------- */

export const wallDay = (now = new Date()) => dayKey(now, brand.timeZone);

/** Today's question. When no admin scheduled one, the bank's question for today is saved so votes have something to attach to. */
async function todaysQuestion() {
  const day = wallDay();
  const found = await db.dailyQuestion.findUnique({ where: { day } });
  if (found) return found;
  const q = bankQuestion(day);
  return db.dailyQuestion.upsert({ where: { day }, create: { day, question: q.question, options: q.options }, update: {} });
}

export async function getQuestion(viewerId: string | null) {
  const q = await todaysQuestion();
  const [groups, mine] = await Promise.all([
    db.questionVote.groupBy({ by: ["option"], where: { questionId: q.id }, _count: true }),
    viewerId ? db.questionVote.findUnique({ where: { questionId_userId: { questionId: q.id, userId: viewerId } } }) : null,
  ]);
  const counts = q.options.map((_, i) => groups.find((g) => g.option === i)?._count ?? 0);
  return { id: q.id, day: q.day, question: q.question, options: q.options, counts, myVote: mine?.option ?? null };
}

export type WallSort = "new" | "hot";
export const TAKES_PAGE = 6;

const takeSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { username: true, name: true, avatar: true } },
} satisfies Prisma.TakeSelect;

export async function getTakes(viewerId: string | null, sort: WallSort, offset: number, limit = TAKES_PAGE) {
  let rows: Prisma.TakeGetPayload<{ select: typeof takeSelect }>[];
  let hasMore: boolean;
  const [skip, { blocked }] = await Promise.all([reportedBy(viewerId, "take"), hiddenPeople(viewerId)]);
  const notBlocked = blocked.length ? { authorId: { notIn: blocked } } : {};
  if (sort === "new") {
    rows = await db.take.findMany({
      where: { hidden: false, id: { notIn: skip }, ...notBlocked },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit + 1,
      select: takeSelect,
    });
    hasMore = rows.length > limit;
    rows = rows.slice(0, limit);
  } else {
    // hot: the last week's takes, ranked by reactions cooled by age
    const recent = await db.take.findMany({
      where: { hidden: false, id: { notIn: skip }, ...notBlocked, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { ...takeSelect, _count: { select: { reactions: true } } },
    });
    const now = new Date();
    recent.sort((a, b) => heat(b._count.reactions, b.createdAt, now) - heat(a._count.reactions, a.createdAt, now));
    hasMore = recent.length > offset + limit;
    rows = recent.slice(offset, offset + limit).map((t) => ({ id: t.id, body: t.body, createdAt: t.createdAt, author: t.author }));
  }
  const ids = rows.map((t) => t.id);
  const [groups, mine] = await Promise.all([
    db.takeReaction.groupBy({ by: ["takeId", "value"], where: { takeId: { in: ids } }, _count: true }),
    viewerId ? db.takeReaction.findMany({ where: { takeId: { in: ids }, userId: viewerId } }) : Promise.resolve([]),
  ]);
  const count = (id: string, value: string) => groups.find((g) => g.takeId === id && g.value === value)?._count ?? 0;
  const takes = rows.map((t) => ({
    ...t,
    agree: count(t.id, "agree"),
    disagree: count(t.id, "disagree"),
    myReaction: (mine.find((r) => r.takeId === t.id)?.value ?? null) as "agree" | "disagree" | null,
  }));
  return { takes, hasMore };
}

export type WallQuestion = Awaited<ReturnType<typeof getQuestion>>;
export type WallTake = Awaited<ReturnType<typeof getTakes>>["takes"][number];
