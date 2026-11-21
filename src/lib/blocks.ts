import "server-only";
import { cache } from "react";
import { db } from "./db";
import { blockedEither } from "./safety";

/**
 * Who this viewer can't see: everyone in a block with them (either direction), and who they muted.
 * Cached per request, since the feed, the dock and the wall all ask.
 */
export const hiddenPeople = cache(async (viewerId: string | null): Promise<{ blocked: string[]; muted: string[] }> => {
  if (!viewerId) return { blocked: [], muted: [] };
  const [blocks, mutes] = await Promise.all([
    db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } }),
    db.mute.findMany({ where: { muterId: viewerId }, select: { mutedId: true } }),
  ]);
  return { blocked: blockedEither(viewerId, blocks), muted: mutes.map((m) => m.mutedId) };
});

/** True if either of the two has blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return !!row;
}

/** What `viewerId` reported, so it disappears for them straight away, before enough reports hide it for everyone. */
export async function reportedBy(viewerId: string | null, targetType: "post" | "comment" | "quest" | "take"): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await db.report.findMany({ where: { reporterId: viewerId, targetType }, select: { targetId: true } });
  return rows.map((r) => r.targetId);
}
