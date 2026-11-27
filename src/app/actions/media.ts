"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAvatarPreset, isPresetUrl, presetUrl, type AvatarPresetId } from "@/lib/avatar-presets";
import { resizePhoto } from "@/lib/photo";
import { allow, limits } from "@/lib/rate-limit";
import { bannerUrl, isBannerPreset, isBannerPresetUrl, type BannerPresetId } from "@/lib/banner-presets";
import { UPLOADS, UPLOADS_OFF, isSafeKey, storage, uploadsEnabled, type UploadKind, type UploadTicket } from "@/lib/storage";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user;
}

const requestSchema = z.object({
  kind: z.enum(["avatar", "banner", "timelapse", "photo"]),
  contentType: z.string().max(40),
  size: z.number().int().positive(),
});

export async function requestUpload(
  kind: UploadKind,
  contentType: string,
  size: number,
): Promise<UploadTicket | { error: string }> {
  const user = await me();
  if (!uploadsEnabled()) return { error: UPLOADS_OFF };
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
  const parsed = key === null ? null : keySchema.parse(key);
  if (parsed && !ownsKey(parsed, "avatar", user.id)) throw new Error("Not your file");
  await setAvatar(user, parsed && storage().publicUrl(parsed));
}

/** Picks one of the built-in pictures. Works even where uploads are switched off. */
export async function chooseAvatar(id: AvatarPresetId) {
  const user = await me();
  if (!isAvatarPreset(id)) throw new Error("That picture isn’t one of ours");
  await setAvatar(user, presetUrl(id));
}

async function setAvatar(user: { id: string; avatar: string | null }, url: string | null) {
  const previous = user.avatar;
  if (previous === url) return;
  await db.user.update({ where: { id: user.id }, data: { avatar: url } });
  // a built-in picture is shared by everyone who picked it, so only uploads get deleted
  if (previous && !isPresetUrl(previous))
    await storage()
      .remove(previous)
      .catch((e) => console.error("Old avatar not deleted", e));
  revalidatePath("/dashboard", "layout");
}

export async function saveBanner(key: string | null) {
  const user = await me();
  const parsed = key === null ? null : keySchema.parse(key);
  if (parsed && !ownsKey(parsed, "banner", user.id)) throw new Error("Not your file");
  await setBanner(user.id, parsed && storage().publicUrl(parsed));
}

/** Picks one of the built-in banners. Works even where uploads are switched off. */
export async function chooseBanner(id: BannerPresetId) {
  const user = await me();
  if (!isBannerPreset(id)) throw new Error("That banner isn’t one of ours");
  await setBanner(user.id, bannerUrl(id));
}

async function setBanner(userId: string, url: string | null) {
  const { banner: previous } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { banner: true } });
  if (previous === url) return;
  await db.user.update({ where: { id: userId }, data: { banner: url } });
  if (previous && !isBannerPresetUrl(previous))
    await storage()
      .remove(previous)
      .catch((e) => console.error("Old banner not deleted", e));
  revalidatePath("/dashboard", "layout");
}

export async function attachTimelapse(postId: string, key: string) {
  const user = await me();
  const id = z.string().min(1).max(64).parse(postId);
  const parsed = keySchema.parse(key);
  if (!ownsKey(parsed, "timelapse", user.id)) throw new Error("Not your file");
  const { count } = await db.post.updateMany({
    where: { id, userId: user.id },
    data: { mediaUrl: storage().publicUrl(parsed), mediaType: "timelapse" },
  });
  if (count === 0) throw new Error("That post is gone");
  revalidatePath("/dashboard", "layout");
}

/**
 * The browser uploads the original, because a 5MB file is too big to pass through a Vercel function.
 * Only the resized copy is kept, so what's stored has been decoded as a real image and has no location data.
 */
export async function attachPhoto(postId: string, key: string): Promise<{ error?: string }> {
  const user = await me();
  const id = z.string().min(1).max(64).parse(postId);
  const parsed = keySchema.parse(key);
  if (!ownsKey(parsed, "photo", user.id)) throw new Error("Not your file");
  const store = storage();
  try {
    const original = await store.read(parsed);
    if (!original) return { error: "That upload didn't finish. Try again." };
    const webp = await resizePhoto(original).catch(() => null);
    if (!webp) return { error: "That file isn't an image we can read" };

    const resized = `photos/${user.id}/${randomUUID()}.webp`;
    await store.write(resized, webp, "image/webp");
    const { count } = await db.post.updateMany({
      where: { id, userId: user.id, mediaUrl: null },
      data: { mediaUrl: store.publicUrl(resized), mediaType: "image" },
    });
    if (count === 0) {
      await store.remove(store.publicUrl(resized));
      return { error: "That post can't take a photo" };
    }
    revalidatePath("/dashboard", "layout");
    return {};
  } finally {
    await store.remove(store.publicUrl(parsed)).catch((e) => console.error("Original photo not deleted", e));
  }
}
