"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { allow, limits } from "@/lib/rate-limit";
import { UPLOADS, isSafeKey, storage, type UploadTicket } from "@/lib/storage";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user;
}

const requestSchema = z.object({
  kind: z.enum(["avatar", "timelapse"]),
  contentType: z.string().max(40),
  size: z.number().int().positive(),
});

export async function requestUpload(
  kind: "avatar" | "timelapse",
  contentType: string,
  size: number,
): Promise<UploadTicket | { error: string }> {
  const user = await me();
  const input = requestSchema.parse({ kind, contentType, size });
  const rules = UPLOADS[input.kind];
  const ext = (rules.types as Record<string, string>)[input.contentType.split(";")[0]];
  if (!ext) return { error: "That file type isn't supported" };
  if (input.size > rules.maxBytes) return { error: "That file is too big" };
  if (!(await allow(`upload:${user.id}`, limits.upload))) return { error: "Too many uploads. Try again later." };
  return storage().createUpload(`${input.kind}s/${user.id}/${randomUUID()}.${ext}`, input.contentType.split(";")[0], input.size);
}

const keySchema = z.string().max(200).refine(isSafeKey);

/** Keys carry the owner's id, so nobody can claim a file someone else uploaded. */
const ownsKey = (key: string, kind: string, userId: string) => key.startsWith(`${kind}s/${userId}/`);

export async function saveAvatar(key: string | null) {
  const user = await me();
  const previous = user.avatar;
  if (key === null) {
    await db.user.update({ where: { id: user.id }, data: { avatar: null } });
  } else {
    const parsed = keySchema.parse(key);
    if (!ownsKey(parsed, "avatar", user.id)) throw new Error("Not your file");
    await db.user.update({ where: { id: user.id }, data: { avatar: storage().publicUrl(parsed) } });
  }
  if (previous)
    await storage()
      .remove(previous)
      .catch((e) => console.error("Old avatar not deleted", e));
  revalidatePath("/dashboard", "layout");
}

export async function attachTimelapse(postId: string, key: string) {
  const user = await me();
  const id = z.string().min(1).max(64).parse(postId);
  const parsed = keySchema.parse(key);
  if (!ownsKey(parsed, "timelapse", user.id)) throw new Error("Not your file");
  const { count } = await db.post.updateMany({ where: { id, userId: user.id }, data: { timelapseUrl: storage().publicUrl(parsed) } });
  if (count === 0) throw new Error("That post is gone");
  revalidatePath("/dashboard", "layout");
}
