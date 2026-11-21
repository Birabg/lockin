import "server-only";
import { snippet, tallyReasons, type ContentType } from "./admin-rules";
import { db } from "./db";
import type { ReportTarget } from "./safety";

export type Preview = { text: string; author: string | null; hidden: boolean; banned?: boolean; createdAt?: Date };

const key = (type: string, id: string) => `${type}:${id}`;

/** What each reported or hidden thing says and who made it, fetched in one query per type. */
async function previews(items: readonly { type: string; id: string }[]): Promise<Map<string, Preview>> {
  const ids = (t: string) => [...new Set(items.filter((i) => i.type === t).map((i) => i.id))];
  const author = { select: { username: true } } as const;
  const [posts, comments, quests, takes, users] = await Promise.all([
    db.post.findMany({
      where: { id: { in: ids("post") } },
      select: { id: true, body: true, mediaType: true, hidden: true, createdAt: true, user: author },
    }),
    db.comment.findMany({
      where: { id: { in: ids("comment") } },
      select: { id: true, body: true, hidden: true, createdAt: true, user: author },
    }),
    db.quest.findMany({
      where: { id: { in: ids("quest") } },
      select: { id: true, title: true, hidden: true, createdAt: true, creator: author },
    }),
    db.take.findMany({ where: { id: { in: ids("take") } }, select: { id: true, body: true, hidden: true, createdAt: true, author } }),
    db.user.findMany({
      where: { id: { in: ids("user") } },
      select: { id: true, username: true, name: true, bannedAt: true, createdAt: true },
    }),
  ]);
  const map = new Map<string, Preview>();
  for (const p of posts)
    map.set(key("post", p.id), {
      text: snippet(p.body + (p.mediaType ? ` [${p.mediaType}]` : ""), 160),
      author: p.user.username,
      hidden: p.hidden,
      createdAt: p.createdAt,
    });
  for (const c of comments)
    map.set(key("comment", c.id), { text: snippet(c.body, 160), author: c.user.username, hidden: c.hidden, createdAt: c.createdAt });
  for (const q of quests)
    map.set(key("quest", q.id), { text: snippet(q.title, 160), author: q.creator.username, hidden: q.hidden, createdAt: q.createdAt });
  for (const t of takes)
    map.set(key("take", t.id), { text: snippet(t.body, 160), author: t.author.username, hidden: t.hidden, createdAt: t.createdAt });
  for (const u of users)
    map.set(key("user", u.id), {
      text: `${u.name} (@${u.username})`,
      author: u.username,
      hidden: false,
      banned: !!u.bannedAt,
      createdAt: u.createdAt,
    });
  return map;
}

export type OpenReport = {
  type: ReportTarget;
  id: string;
  count: number;
  reasons: string;
  lastAt: Date;
  /** Null when the thing is gone (its author deleted it, or the account was deleted). */
  preview: Preview | null;
};

/** Open reports grouped by what they're about, most recently reported first. */
export async function getOpenReports(limit = 50): Promise<OpenReport[]> {
  const rows = await db.report.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { targetType: true, targetId: true, reason: true, createdAt: true },
  });
  const groups = new Map<string, { type: ReportTarget; id: string; reasons: (string | null)[]; lastAt: Date }>();
  for (const r of rows) {
    const g = groups.get(key(r.targetType, r.targetId));
    if (g) g.reasons.push(r.reason);
    else
      groups.set(key(r.targetType, r.targetId), {
        type: r.targetType as ReportTarget,
        id: r.targetId,
        reasons: [r.reason],
        lastAt: r.createdAt,
      });
  }
  const list = [...groups.values()].slice(0, limit);
  const seen = await previews(list);
  return list.map((g) => ({
    type: g.type,
    id: g.id,
    count: g.reasons.length,
    reasons: tallyReasons(g.reasons),
    lastAt: g.lastAt,
    preview: seen.get(key(g.type, g.id)) ?? null,
  }));
}

export type HiddenItem = { type: ContentType; id: string; preview: Preview };

/** Everything hidden right now, by reports or by an admin, newest first. */
export async function getHiddenContent(limit = 50): Promise<HiddenItem[]> {
  const pick = { where: { hidden: true }, orderBy: { createdAt: "desc" as const }, take: limit, select: { id: true } };
  const [posts, comments, quests, takes] = await Promise.all([
    db.post.findMany(pick),
    db.comment.findMany(pick),
    db.quest.findMany(pick),
    db.take.findMany(pick),
  ]);
  const items = [
    ...posts.map((x) => ({ type: "post" as const, id: x.id })),
    ...comments.map((x) => ({ type: "comment" as const, id: x.id })),
    ...quests.map((x) => ({ type: "quest" as const, id: x.id })),
    ...takes.map((x) => ({ type: "take" as const, id: x.id })),
  ];
  const seen = await previews(items);
  return items
    .flatMap((i) => {
      const preview = seen.get(key(i.type, i.id));
      return preview ? [{ ...i, preview }] : [];
    })
    .sort((a, b) => (b.preview.createdAt?.getTime() ?? 0) - (a.preview.createdAt?.getTime() ?? 0))
    .slice(0, limit);
}

/** Find people by username, name or email, with how many open reports they have. Newest accounts first. */
export async function searchUsersForAdmin(q: string, limit = 30) {
  const term = q.trim();
  const users = await db.user.findMany({
    where: term
      ? {
          OR: [
            { username: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: [{ bannedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, username: true, name: true, email: true, avatar: true, createdAt: true, bannedAt: true },
  });
  const reports = await db.report.groupBy({
    by: ["targetId"],
    where: { targetType: "user", resolvedAt: null, targetId: { in: users.map((u) => u.id) } },
    _count: true,
  });
  const open = new Map(reports.map((r) => [r.targetId, r._count]));
  return users.map((u) => ({ ...u, openReports: open.get(u.id) ?? 0 }));
}

export const getAdminLog = (limit = 100) =>
  db.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, adminUsername: true, action: true, targetType: true, targetId: true, detail: true, createdAt: true },
  });

/** Questions already scheduled for today or later. */
export const getUpcomingQuestions = (fromDay: string) =>
  db.dailyQuestion.findMany({
    where: { day: { gte: fromDay }, createdById: { not: null } },
    orderBy: { day: "asc" },
    take: 30,
    select: {
      id: true,
      day: true,
      question: true,
      options: true,
      createdBy: { select: { username: true } },
      _count: { select: { votes: true } },
    },
  });
