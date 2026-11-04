"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user;
}

export async function toggleLike(postId: string) {
  const user = await me();
  const key = { userId_postId: { userId: user.id, postId } };
  const existing = await db.like.findUnique({ where: key });
  if (existing) await db.like.delete({ where: key });
  else await db.like.create({ data: { userId: user.id, postId } });
  revalidatePath("/dashboard");
}

export async function addComment(postId: string, body: string) {
  const user = await me();
  const text = body.trim().slice(0, 280);
  if (!text) return;
  await db.comment.create({ data: { userId: user.id, postId, body: text } });
  revalidatePath("/dashboard");
}

export async function createPost(body: string) {
  const user = await me();
  const text = body.trim().slice(0, 280);
  if (!text) return;
  await db.post.create({ data: { userId: user.id, body: text } });
  revalidatePath("/dashboard");
}

export async function toggleFollow(targetId: string) {
  const user = await me();
  if (targetId === user.id) return;
  const key = { followerId_followingId: { followerId: user.id, followingId: targetId } };
  const existing = await db.follow.findUnique({ where: key });
  if (existing) await db.follow.delete({ where: key });
  else await db.follow.create({ data: { followerId: user.id, followingId: targetId } });
  revalidatePath("/dashboard", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(160).optional(),
  dailyGoalMin: z.coerce
    .number()
    .int()
    .min(10)
    .max(16 * 60),
});

type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await me();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, bio: parsed.data.bio || null, dailyGoalMin: parsed.data.dailyGoalMin },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
