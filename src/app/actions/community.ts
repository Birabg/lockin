"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getQuestBoard,
  getQuestDetail,
  getQuestion,
  getTakes,
  listQuests,
  TAKES_PAGE,
  wallDay,
  type QuestTab,
  type WallSort,
} from "@/lib/community";
import { db } from "@/lib/db";
import { verifyGate } from "@/lib/email-verify";
import { isBlockedBetween } from "@/lib/blocks";
import { hasBlockedWords, isAdmin } from "@/lib/moderation";
import { fileReport } from "@/lib/reports";
import { BLOCKED_MESSAGE, isReportReason } from "@/lib/safety";
import { QUEST_COLORS, QUEST_DESCRIPTION_MAX, QUEST_LENGTHS, QUEST_TITLE_MAX, questEnd } from "@/lib/quests";
import { allow, limits } from "@/lib/rate-limit";
import { TAKE_MAX } from "@/lib/wall";

type Result = { error?: string };

const SIGN_IN = "Sign in to do that";
const SLOW_DOWN = "You're doing that too fast. Try again in a bit.";
const RUDE = "Let's keep it friendly. Try different words.";

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const id = z.string().min(1).max(64);

/* ---------------- Reads, for the panels and pages ---------------- */

/** Who is looking, for the panels: guests get a sign-in prompt instead of actions. */
async function viewer() {
  const user = await getCurrentUser();
  return { user, viewer: user ? { username: user.username, name: user.name, avatar: user.avatar, admin: isAdmin(user.username) } : null };
}
export type Viewer = Awaited<ReturnType<typeof viewer>>["viewer"];

export async function loadQuestBoard(limit = 5) {
  const { user, viewer: v } = await viewer();
  const board = await getQuestBoard(user?.id ?? null, Math.min(Math.max(limit, 1), 12));
  return { ...board, viewer: v };
}

export async function loadQuests(tab: QuestTab) {
  const user = await getCurrentUser();
  return listQuests(user?.id ?? null, z.enum(["active", "joined", "ended"]).parse(tab));
}

export async function loadQuestDetail(questId: string) {
  const user = await getCurrentUser();
  const detail = await getQuestDetail(id.parse(questId), user?.id ?? null);
  if (!detail) return null;
  return { ...detail, signedIn: !!user, canDelete: detail.quest.mine || isAdmin(user?.username) };
}

/** The question and a page of takes. A refresh asks for everything already on screen, from the top, with `limit`. */
export async function loadWall(sort: WallSort, offset = 0, limit = TAKES_PAGE) {
  const { user, viewer: v } = await viewer();
  const s = z.enum(["new", "hot"]).parse(sort);
  const o = z.number().int().min(0).max(300).parse(offset);
  const l = z.number().int().min(1).max(60).parse(limit);
  const [question, takes] = await Promise.all([o === 0 ? getQuestion(user?.id ?? null) : null, getTakes(user?.id ?? null, s, o, l)]);
  return { question, ...takes, viewer: v };
}

/* ---------------- Quests ---------------- */

const questSchema = z
  .object({
    title: z.string().trim().min(3, "Give it a title").max(QUEST_TITLE_MAX, `Keep the title under ${QUEST_TITLE_MAX} characters`),
    description: z.string().trim().max(QUEST_DESCRIPTION_MAX).optional().default(""),
    type: z.enum(["solo", "group"]),
    targetMinutes: z.number().int().min(10).max(10_000).nullable(),
    targetSessions: z.number().int().min(1).max(100).nullable(),
    minSessionMin: z.number().int().min(5).max(480).nullable(),
    tag: z.string().trim().max(40).nullable(),
    length: z.enum(Object.keys(QUEST_LENGTHS) as [keyof typeof QUEST_LENGTHS, ...(keyof typeof QUEST_LENGTHS)[]]),
    customEnd: z.string().datetime().nullable(),
    color: z.enum(Object.keys(QUEST_COLORS) as [keyof typeof QUEST_COLORS, ...(keyof typeof QUEST_COLORS)[]]),
  })
  .refine((q) => q.targetMinutes || q.targetSessions, { message: "Set a target in minutes or sessions" });

export type NewQuest = z.input<typeof questSchema>;

export async function createQuest(input: NewQuest): Promise<Result & { id?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const parsed = questSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const q = parsed.data;
  const gate = verifyGate(user);
  if (gate) return { error: gate };
  if (hasBlockedWords(`${q.title} ${q.description} ${q.tag ?? ""}`)) return { error: RUDE };

  const now = new Date();
  const endsAt = questEnd(q.length, now, q.customEnd ? new Date(q.customEnd) : undefined);
  if (endsAt.getTime() <= now.getTime() + 30 * 60_000) return { error: "Pick an end at least 30 minutes away" };
  if (endsAt.getTime() > now.getTime() + 31 * 86_400_000) return { error: "Quests can run for a month at most" };
  if (!(await allow(`quest:${user.id}`, limits.quest))) return { error: "That's 3 quests today. Post more tomorrow." };

  const quest = await db.quest.create({
    data: {
      creatorId: user.id,
      title: q.title,
      description: q.description || null,
      type: q.type,
      targetMinutes: q.targetMinutes,
      targetSessions: q.targetSessions,
      minSessionMin: q.minSessionMin,
      tag: q.tag || null,
      color: q.color,
      startsAt: now,
      endsAt,
      // the poster is in by default
      participants: { create: { userId: user.id } },
    },
  });
  return { id: quest.id };
}

export async function joinQuest(questId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  if (!(await allow(`join:${user.id}`, limits.join))) return { error: SLOW_DOWN };
  const quest = await db.quest.findFirst({ where: { id: id.parse(questId), hidden: false }, select: { endsAt: true } });
  if (!quest || quest.endsAt <= new Date()) return { error: "That quest has ended" };
  await db.questParticipant.create({ data: { questId, userId: user.id } }).catch((e) => {
    if (!isDuplicate(e)) throw e;
  });
  return {};
}

export async function leaveQuest(questId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  await db.questParticipant.deleteMany({ where: { questId: id.parse(questId), userId: user.id } });
  return {};
}

export async function deleteQuest(questId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const where = isAdmin(user.username) ? { id: id.parse(questId) } : { id: id.parse(questId), creatorId: user.id };
  const { count } = await db.quest.deleteMany({ where });
  return count ? {} : { error: "You can only delete your own quests" };
}

/* ---------------- The wall ---------------- */

export async function vote(questionId: string, option: number): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  if (!(await allow(`vote:${user.id}`, limits.vote))) return { error: SLOW_DOWN };
  const q = await db.dailyQuestion.findUnique({ where: { id: id.parse(questionId) }, select: { options: true } });
  if (!q || !Number.isInteger(option) || option < 0 || option >= q.options.length) return { error: "That poll is gone" };
  try {
    await db.questionVote.create({ data: { questionId, userId: user.id, option } });
  } catch (e) {
    if (isDuplicate(e)) return { error: "You already voted on this one" };
    throw e;
  }
  return {};
}

/** Agree, disagree, or null to take your reaction back. */
export async function reactToTake(takeId: string, value: "agree" | "disagree" | null): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  if (!(await allow(`react:${user.id}`, limits.react))) return { error: SLOW_DOWN };
  const tid = id.parse(takeId);
  const v = z.enum(["agree", "disagree"]).nullable().parse(value);
  if (v === null) {
    await db.takeReaction.deleteMany({ where: { takeId: tid, userId: user.id } });
    return {};
  }
  const take = await db.take.findFirst({ where: { id: tid, hidden: false }, select: { authorId: true } });
  if (!take) return { error: "That take is gone" };
  if (await isBlockedBetween(user.id, take.authorId)) return { error: BLOCKED_MESSAGE };
  await db.takeReaction.upsert({
    where: { takeId_userId: { takeId: tid, userId: user.id } },
    create: { takeId: tid, userId: user.id, value: v },
    update: { value: v },
  });
  return {};
}

export async function postTake(body: string): Promise<Result & { id?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const text = z.string().trim().min(3, "Say a little more").max(TAKE_MAX, `Keep it under ${TAKE_MAX} characters`).safeParse(body);
  if (!text.success) return { error: text.error.issues[0]?.message };
  const gate = verifyGate(user);
  if (gate) return { error: gate };
  if (hasBlockedWords(text.data)) return { error: RUDE };
  if (!(await allow(`take:${user.id}`, limits.take))) return { error: "That's 10 takes today. The wall needs a break from you 😄" };
  const take = await db.take.create({ data: { authorId: user.id, body: text.data } });
  return { id: take.id };
}

export async function deleteTake(takeId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const where = isAdmin(user.username) ? { id: id.parse(takeId) } : { id: id.parse(takeId), authorId: user.id };
  const { count } = await db.take.deleteMany({ where });
  return count ? {} : { error: "You can only delete your own takes" };
}

/** One report per person per item, with a reason. Enough different people hide it (see fileReport). */
export async function report(targetType: "quest" | "take", targetId: string, reason: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  if (!isReportReason(reason)) return { error: "Pick a reason" };
  if (!(await allow(`report:${user.id}`, limits.report))) return { error: SLOW_DOWN };
  return fileReport(user.id, z.enum(["quest", "take"]).parse(targetType), id.parse(targetId), reason);
}

/** Admins only: set the question for a day, today or later. */
export async function scheduleQuestion(input: { day: string; question: string; options: string[] }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.username)) return { error: "Only admins can schedule questions" };
  if (!(await allow(`question:${user.id}`, limits.question))) return { error: SLOW_DOWN };
  const parsed = z
    .object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      question: z.string().trim().min(5).max(120),
      options: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
    })
    .safeParse({ ...input, options: input.options.filter((o) => o.trim()) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { day, question, options } = parsed.data;
  if (day < wallDay()) return { error: "Pick today or a later day" };
  const existing = await db.dailyQuestion.findUnique({ where: { day }, include: { _count: { select: { votes: true } } } });
  if (existing && existing._count.votes > 0) return { error: "People already voted on that day's question" };
  await db.dailyQuestion.upsert({
    where: { day },
    create: { day, question, options, createdById: user.id },
    update: { question, options, createdById: user.id },
  });
  return {};
}
