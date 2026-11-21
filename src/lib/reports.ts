import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { shouldHide, type ReportReason, type ReportTarget } from "./safety";

/** Who owns a target, or null if it's gone (or already hidden). */
async function ownerOf(type: ReportTarget, id: string): Promise<string | null> {
  switch (type) {
    case "post":
      return (await db.post.findFirst({ where: { id, hidden: false }, select: { userId: true } }))?.userId ?? null;
    case "comment":
      return (await db.comment.findFirst({ where: { id, hidden: false }, select: { userId: true } }))?.userId ?? null;
    case "quest":
      return (await db.quest.findFirst({ where: { id, hidden: false }, select: { creatorId: true } }))?.creatorId ?? null;
    case "take":
      return (await db.take.findFirst({ where: { id, hidden: false }, select: { authorId: true } }))?.authorId ?? null;
    case "user":
      return (await db.user.findUnique({ where: { id }, select: { id: true } }))?.id ?? null;
  }
}

async function hide(type: ReportTarget, id: string) {
  if (type === "post") await db.post.updateMany({ where: { id }, data: { hidden: true } });
  else if (type === "comment") await db.comment.updateMany({ where: { id }, data: { hidden: true } });
  else if (type === "quest") await db.quest.updateMany({ where: { id }, data: { hidden: true } });
  else if (type === "take") await db.take.updateMany({ where: { id }, data: { hidden: true } });
}

/**
 * One report per person per target; reporting again updates the reason and reopens it if an admin had dismissed it.
 * Enough different people with open reports hide content for everyone (people themselves are left to admins).
 */
export async function fileReport(
  reporterId: string,
  type: ReportTarget,
  targetId: string,
  reason: ReportReason,
): Promise<{ error?: string }> {
  const owner = await ownerOf(type, targetId);
  if (!owner) return { error: "That's already gone." };
  if (owner === reporterId) return { error: "You can't report your own." };

  try {
    await db.report.upsert({
      where: { reporterId_targetType_targetId: { reporterId, targetType: type, targetId } },
      create: { reporterId, targetType: type, targetId, reason },
      update: { reason, resolvedAt: null },
    });
  } catch (e) {
    // two reports racing: the other one won, which is fine
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  const count = await db.report.count({ where: { targetType: type, targetId, resolvedAt: null } });
  if (shouldHide(type, count)) await hide(type, targetId);
  return {};
}
