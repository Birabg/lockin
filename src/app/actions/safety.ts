"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { allow, limits } from "@/lib/rate-limit";
import { fileReport } from "@/lib/reports";
import { isReportReason, isReportTarget } from "@/lib/safety";

type Result = { error?: string };

const SIGN_IN = "Sign in to do that";
const SLOW_DOWN = "You're doing that too fast. Try again in a bit.";
const idSchema = z.string().min(1).max(64);

// No revalidatePath here: every page these touch is dynamic, and re-rendering the whole dashboard inside the
// action made the dialog wait on it. The client hides what changed right away, or calls router.refresh().

async function target(targetId: string): Promise<{ me: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  const id = idSchema.safeParse(targetId);
  if (!id.success || id.data === user.id) return { error: "You can't do that to yourself" };
  if (!(await allow(`safety:${user.id}`, limits.safety))) return { error: SLOW_DOWN };
  if (!(await db.user.findUnique({ where: { id: id.data }, select: { id: true } }))) return { error: "That account is gone" };
  return { me: user.id };
}

/**
 * Blocks someone: they disappear for each other, and the ties between them (follows both ways, a buddy pairing
 * or request, and notifications between them) are removed, so nothing keeps connecting the two.
 */
export async function blockUser(targetId: string): Promise<Result> {
  const t = await target(targetId);
  if ("error" in t) return t;
  const { me } = t;
  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId: me, blockedId: targetId } },
      create: { blockerId: me, blockedId: targetId },
      update: {},
    }),
    db.follow.deleteMany({
      where: {
        OR: [
          { followerId: me, followingId: targetId },
          { followerId: targetId, followingId: me },
        ],
      },
    }),
    db.buddy.deleteMany({
      where: {
        OR: [
          { requesterId: me, addresseeId: targetId },
          { requesterId: targetId, addresseeId: me },
        ],
      },
    }),
    db.notification.deleteMany({
      where: {
        OR: [
          { userId: me, actorId: targetId },
          { userId: targetId, actorId: me },
        ],
      },
    }),
    // a mute is pointless on top of a block
    db.mute.deleteMany({ where: { muterId: me, mutedId: targetId } }),
  ]);
  return {};
}

export async function unblockUser(targetId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  await db.block.deleteMany({ where: { blockerId: user.id, blockedId: idSchema.parse(targetId) } });
  return {};
}

/** Hides their posts from your feed. They aren't told and nothing else changes. */
export async function muteUser(targetId: string): Promise<Result> {
  const t = await target(targetId);
  if ("error" in t) return t;
  await db.mute.upsert({
    where: { muterId_mutedId: { muterId: t.me, mutedId: targetId } },
    create: { muterId: t.me, mutedId: targetId },
    update: {},
  });
  return {};
}

export async function unmuteUser(targetId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  await db.mute.deleteMany({ where: { muterId: user.id, mutedId: idSchema.parse(targetId) } });
  return {};
}

/** Reports a post, comment, quest, take or person, with a reason. */
export async function reportContent(targetType: string, targetId: string, reason: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN };
  if (!isReportTarget(targetType) || !isReportReason(reason)) return { error: "Pick a reason" };
  const id = idSchema.safeParse(targetId);
  if (!id.success) return { error: "That's already gone." };
  if (!(await allow(`report:${user.id}`, limits.report))) return { error: SLOW_DOWN };
  return fileReport(user.id, targetType, id.data, reason);
}
