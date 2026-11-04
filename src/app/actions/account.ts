"use server";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { canSendEmail, sendEmail } from "@/lib/email";
import { allow, clientIp, limits } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
import { storage } from "@/lib/storage";

type FormState = { error?: string; sent?: boolean } | undefined;

const TOO_MANY = "Too many attempts. Try again later.";
const RESET_MS = 60 * 60_000;

// only the hash is stored, so a leaked database can't be used to reset passwords
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function emailResetLink(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId: user.id } }),
    db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MS) } }),
  ]);
  await sendEmail({
    to: email,
    subject: `Reset your ${brand.name} password`,
    text: `Use this link to choose a new password. It works once and expires in 1 hour.\n\n${siteUrl()}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

/** Answers the same way whether or not the account exists, and sends after responding so timing doesn't tell either. */
export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  if (!canSendEmail()) return { error: "Password reset isn't available right now" };
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email" };
  const allowed = (await allow(`reset-ip:${await clientIp()}`, limits.resetIp)) && (await allow(`reset:${email.data}`, limits.resetEmail));
  if (!allowed) return { error: TOO_MANY };
  after(() => emailResetLink(email.data).catch((e) => console.error("Reset email failed", e)));
  return { sent: true };
}

const resetSchema = z.object({
  token: z.string().min(20).max(100),
  // bcrypt only reads the first 72 bytes
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be 72 characters or fewer"),
});

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await allow(`reset-ip:${await clientIp()}`, limits.resetIp))) return { error: TOO_MANY };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const used = await db.$transaction(async (tx) => {
    const row = await tx.passwordReset.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
    if (!row || row.expiresAt <= new Date()) return false;
    // whoever deletes the row wins, so a link can't be used twice
    const { count } = await tx.passwordReset.deleteMany({ where: { id: row.id } });
    if (count === 0) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, passwordChangedAt: new Date() } });
    return true;
  });
  if (!used) return { error: "That link has expired. Ask for a new one." };

  await destroySession();
  redirect("/login?reset=1");
}

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first" };
  if (!(await allow(`delete:${user.id}`, limits.loginAccount))) return { error: TOO_MANY };

  const password = z.string().min(1).max(200).safeParse(form.get("password"));
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!password.success || !row || !(await bcrypt.compare(password.data, row.passwordHash))) return { error: "That password isn't right" };

  const posts = await db.post.findMany({ where: { userId: user.id, mediaUrl: { not: null } }, select: { mediaUrl: true } });
  const files = [user.avatar, ...posts.map((p) => p.mediaUrl)].filter((url): url is string => !!url);

  await db.$transaction(async (tx) => {
    // rooms outlive their creator, so the people still in them aren't thrown out
    const rooms = await tx.room.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        members: { where: { userId: { not: user.id } }, orderBy: { joinedAt: "asc" }, take: 1, select: { userId: true } },
      },
    });
    for (const room of rooms) {
      if (room.members[0]) await tx.room.update({ where: { id: room.id }, data: { ownerId: room.members[0].userId } });
    }
    await tx.user.delete({ where: { id: user.id } });
  });

  const removed = await Promise.allSettled(files.map(async (url) => storage().remove(url)));
  for (const r of removed) if (r.status === "rejected") console.error("File not deleted", r.reason);

  await destroySession();
  redirect("/");
}
