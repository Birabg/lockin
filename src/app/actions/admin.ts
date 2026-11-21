"use server";

import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { banProblem, isContentType, isDecisionFor, snippet, type AdminActionKind, type ContentType } from "@/lib/admin-rules";
import { wallDay } from "@/lib/community";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/moderation";
import { allow, limits } from "@/lib/rate-limit";
import { isReportTarget, type ReportTarget } from "@/lib/safety";
import { storage } from "@/lib/storage";

type Result = { error?: string };

const NOT_ALLOWED = "Only admins can do that.";
const GONE = "That's already gone.";
const idSchema = z.string().min(1).max(64);

/** Every action checks this itself: a hidden page isn't a permission check. */
async function admin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && isAdmin(user.username) ? user : null;
}

async function log(by: CurrentUser, action: AdminActionKind, targetType: string, targetId: string, detail?: string | null) {
  await db.adminAction.create({
    data: { adminId: by.id, adminUsername: by.username, action, targetType, targetId, detail: detail ? snippet(detail, 140) : null },
  });
}

/** A line for the log, read before the thing changes (or is deleted). */
async function describe(type: ReportTarget, id: string): Promise<string | null> {
  const by = (u: { username: string } | undefined) => (u ? `@${u.username}: ` : "");
  switch (type) {
    case "post": {
      const p = await db.post.findUnique({ where: { id }, select: { body: true, user: { select: { username: true } } } });
      return p && by(p.user) + p.body;
    }
    case "comment": {
      const c = await db.comment.findUnique({ where: { id }, select: { body: true, user: { select: { username: true } } } });
      return c && by(c.user) + c.body;
    }
    case "quest": {
      const q = await db.quest.findUnique({ where: { id }, select: { title: true, creator: { select: { username: true } } } });
      return q && by(q.creator) + q.title;
    }
    case "take": {
      const t = await db.take.findUnique({ where: { id }, select: { body: true, author: { select: { username: true } } } });
      return t && by(t.author) + t.body;
    }
    case "user": {
      const u = await db.user.findUnique({ where: { id }, select: { username: true } });
      return u && `@${u.username}`;
    }
  }
}

async function setHidden(type: ContentType, id: string, hidden: boolean) {
  const where = { id };
  if (type === "post") await db.post.updateMany({ where, data: { hidden } });
  else if (type === "comment") await db.comment.updateMany({ where, data: { hidden } });
  else if (type === "quest") await db.quest.updateMany({ where, data: { hidden } });
  else await db.take.updateMany({ where, data: { hidden } });
}

async function deleteContent(type: ContentType, id: string) {
  if (type === "post") {
    const post = await db.post.findUnique({ where: { id }, select: { mediaUrl: true } });
    await db.$transaction([db.notification.deleteMany({ where: { postId: id } }), db.post.deleteMany({ where: { id } })]);
    // the same as the author deleting it: the file goes too, the session and its stats stay
    if (post?.mediaUrl)
      await storage()
        .remove(post.mediaUrl)
        .catch((e) => console.error("Post media not deleted", post.mediaUrl, e));
  } else if (type === "comment") await db.comment.deleteMany({ where: { id } });
  else if (type === "quest") await db.quest.deleteMany({ where: { id } });
  else await db.take.deleteMany({ where: { id } });
}

const resolveReports = (type: string, id: string) =>
  db.report.updateMany({ where: { targetType: type, targetId: id, resolvedAt: null }, data: { resolvedAt: new Date() } });

async function setBan(by: CurrentUser, userId: string, ban: boolean): Promise<Result> {
  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, bannedAt: true } });
  if (!target) return { error: GONE };
  if (ban) {
    const problem = banProblem(target, by, isAdmin);
    if (problem) return { error: problem };
    if (target.bannedAt) return {};
  } else if (!target.bannedAt) return {};
  await db.user.update({ where: { id: userId }, data: { bannedAt: ban ? new Date() : null } });
  await log(by, ban ? "ban" : "unban", "user", userId, `@${target.username}`);
  return {};
}

/**
 * Deals with every open report on one thing. Dismiss means it's fine (and un-hides it if reports had);
 * hide and delete act on the content; ban suspends a reported person.
 */
export async function decideReport(targetType: string, targetId: string, decision: string): Promise<Result> {
  const by = await admin();
  if (!by) return { error: NOT_ALLOWED };
  if (!isReportTarget(targetType) || !isDecisionFor(targetType, decision)) return { error: "That doesn't apply here." };
  const id = idSchema.parse(targetId);
  if (!(await allow(`admin:${by.id}`, limits.admin))) return { error: "Slow down a little." };

  const detail = await describe(targetType, id);
  if (decision === "ban") {
    const res = await setBan(by, id, true);
    if (res.error) return res;
  } else if (isContentType(targetType)) {
    if (!detail && decision !== "dismiss") return { error: GONE };
    if (decision === "delete") await deleteContent(targetType, id);
    else await setHidden(targetType, id, decision === "hide");
  }
  await Promise.all([resolveReports(targetType, id), decision !== "ban" && log(by, decision, targetType, id, detail)]);
  return {};
}

/** Brings back hidden content and closes its open reports, so the next reports start from zero. */
export async function restoreContent(targetType: string, targetId: string): Promise<Result> {
  const by = await admin();
  if (!by) return { error: NOT_ALLOWED };
  if (!isContentType(targetType)) return { error: "That can't be restored." };
  const id = idSchema.parse(targetId);
  const detail = await describe(targetType, id);
  if (!detail) return { error: GONE };
  await setHidden(targetType, id, false);
  await Promise.all([resolveReports(targetType, id), log(by, "restore", targetType, id, detail)]);
  return {};
}

export async function banUser(userId: string): Promise<Result> {
  const by = await admin();
  if (!by) return { error: NOT_ALLOWED };
  const id = idSchema.parse(userId);
  const res = await setBan(by, id, true);
  if (!res.error) await resolveReports("user", id);
  return res;
}

export async function unbanUser(userId: string): Promise<Result> {
  const by = await admin();
  if (!by) return { error: NOT_ALLOWED };
  return setBan(by, idSchema.parse(userId), false);
}

/** Set the wall's question for a day, today or later. Days without one use the built-in bank. */
export async function scheduleQuestion(input: { day: string; question: string; options: string[] }): Promise<Result> {
  const by = await admin();
  if (!by) return { error: NOT_ALLOWED };
  if (!(await allow(`question:${by.id}`, limits.question))) return { error: "Slow down a little." };
  const parsed = z
    .object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      question: z.string().trim().min(5, "The question needs at least 5 characters").max(120),
      options: z.array(z.string().trim().min(1).max(40)).min(2, "Give at least 2 options").max(4),
    })
    .safeParse({ ...input, options: input.options.filter((o) => o.trim()) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { day, question, options } = parsed.data;
  if (day < wallDay()) return { error: "Pick today or a later day" };
  const existing = await db.dailyQuestion.findUnique({ where: { day }, include: { _count: { select: { votes: true } } } });
  if (existing && existing._count.votes > 0) return { error: "People already voted on that day's question" };
  const row = await db.dailyQuestion.upsert({
    where: { day },
    create: { day, question, options, createdById: by.id },
    update: { question, options, createdById: by.id },
  });
  await log(by, "question", "question", row.id, `${day}: ${question}`);
  return {};
}
