"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notify, unnotify } from "@/lib/notifications";
import { getFeed, type FeedTab } from "@/lib/queries";
import { allow, limits } from "@/lib/rate-limit";
import { isValidTimeZone } from "@/lib/time";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user;
}

const SLOW_DOWN = "You're doing that too fast. Try again in a bit.";

const idSchema = z.string().min(1).max(64);
const bodySchema = z.string().trim().min(1, "Write something first").max(280, "Keep it under 280 characters");

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

type Result = { error?: string };

export async function toggleLike(postId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(postId);
  if (!(await allow(`like:${user.id}`, limits.like))) return { error: SLOW_DOWN };
  const post = await db.post.findUnique({ where: { id }, select: { userId: true } });
  if (!post) return { error: "That post is gone" };
  const note = { userId: post.userId, actorId: user.id, type: "LIKE", postId: id } as const;
  const { count } = await db.like.deleteMany({ where: { userId: user.id, postId: id } });
  if (count > 0) {
    await unnotify(note);
  } else {
    await db.like.create({ data: { userId: user.id, postId: id } }).catch((e) => {
      if (!isDuplicate(e)) throw e;
    });
    await notify(note);
  }
  revalidatePath("/dashboard");
  return {};
}

export type NewComment = { id: string; body: string; createdAt: Date; user: { username: string; name: string; avatar: string | null } };

export async function addComment(postId: string, body: string): Promise<Result & { comment?: NewComment }> {
  const user = await me();
  const id = idSchema.parse(postId);
  const text = bodySchema.safeParse(body);
  if (!text.success) return { error: text.error.issues[0].message };
  if (!(await allow(`comment:${user.id}`, limits.comment))) return { error: SLOW_DOWN };
  const post = await db.post.findUnique({ where: { id }, select: { userId: true } });
  if (!post) return { error: "That post is gone" };
  const comment = await db.comment.create({
    data: { userId: user.id, postId: id, body: text.data },
    select: { id: true, body: true, createdAt: true, user: { select: { username: true, name: true, avatar: true } } },
  });
  await notify({ userId: post.userId, actorId: user.id, type: "COMMENT", postId: id });
  revalidatePath("/dashboard");
  return { comment };
}

export async function createPost(body: string): Promise<Result> {
  const user = await me();
  const text = bodySchema.safeParse(body);
  if (!text.success) return { error: text.error.issues[0].message };
  if (!(await allow(`post:${user.id}`, limits.post))) return { error: SLOW_DOWN };
  await db.post.create({ data: { userId: user.id, body: text.data } });
  revalidatePath("/dashboard");
  return {};
}

export async function toggleFollow(targetId: string): Promise<Result> {
  const user = await me();
  const id = idSchema.parse(targetId);
  if (id === user.id) return { error: "You can't follow yourself" };
  if (!(await allow(`follow:${user.id}`, limits.follow))) return { error: SLOW_DOWN };
  if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) return { error: "That account is gone" };
  const note = { userId: id, actorId: user.id, type: "FOLLOW" } as const;
  const { count } = await db.follow.deleteMany({ where: { followerId: user.id, followingId: id } });
  if (count > 0) {
    await unnotify(note);
  } else {
    await db.follow.create({ data: { followerId: user.id, followingId: id } }).catch((e) => {
      if (!isDuplicate(e)) throw e;
    });
    await notify(note);
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

const feedPageSchema = z.object({
  tab: z.enum(["global", "following", "timelapses"]),
  cursor: idSchema,
  authorId: idSchema.optional(),
});

/** The next page of a feed, for infinite scroll. Guests can read it too. */
export async function loadMoreFeed(input: { tab: FeedTab; cursor: string; authorId?: string }) {
  const { tab, cursor, authorId } = feedPageSchema.parse(input);
  const viewer = await getCurrentUser();
  return getFeed(viewer?.id ?? null, tab, { cursor, authorId });
}

export async function markNotificationsRead() {
  const user = await me();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/dashboard", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(40),
  bio: z.string().trim().max(160).optional(),
  dailyGoalMin: z.coerce.number().int().min(10).max(960),
  timeZone: z.string().max(64).refine(isValidTimeZone, "Pick a valid time zone"),
});

type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await me();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, bio, dailyGoalMin, timeZone } = parsed.data;
  await db.user.update({ where: { id: user.id }, data: { name, bio: bio || null, dailyGoalMin, timeZone } });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
