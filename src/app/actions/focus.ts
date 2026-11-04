"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifySessionStart } from "@/lib/notifications";
import { finishSession, reapStaleSessions } from "@/lib/sessions";
import { isExpired } from "@/lib/session-math";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to focus");
  return user;
}

export type ActiveSession = {
  id: string;
  startedAt: string;
  goalMin: number;
  label: string | null;
  pausedSec: number;
  pausedAt: string | null;
};

type SessionRow = { id: string; startedAt: Date; goalMin: number; label: string | null; pausedSec: number; pausedAt: Date | null };

const toActive = (s: SessionRow): ActiveSession => ({
  id: s.id,
  startedAt: s.startedAt.toISOString(),
  goalMin: s.goalMin,
  label: s.label,
  pausedSec: s.pausedSec,
  pausedAt: s.pausedAt?.toISOString() ?? null,
});

const idSchema = z.string().min(1).max(64);
const startSchema = z.object({
  goalMin: z
    .number()
    .finite()
    .transform((n) => Math.min(Math.max(Math.round(n) || 25, 5), 12 * 60)),
  label: z.string().trim().max(40),
});
const stopSchema = z.object({ share: z.boolean(), note: z.string().trim().max(280) });

export async function getActiveSession(): Promise<ActiveSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  await reapStaleSessions(); // never hand back a session that's already dead
  const s = await db.focusSession.findUnique({ where: { activeKey: user.id } });
  return s ? toActive(s) : null;
}

export async function startFocus(goalMin: number, label: string): Promise<ActiveSession> {
  const user = await me();
  const input = startSchema.parse({ goalMin, label });
  const existing = await getActiveSession();
  if (existing) return existing;
  try {
    const s = await db.focusSession.create({
      data: { userId: user.id, activeKey: user.id, goalMin: input.goalMin, label: input.label || null },
    });
    await notifySessionStart(user.id, s.id);
    revalidatePath("/dashboard", "layout");
    return toActive(s);
  } catch (e) {
    // another tab started one first: the unique activeKey stops a second, so join that one
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await db.focusSession.findUnique({ where: { activeKey: user.id } });
      if (winner) return toActive(winner);
    }
    throw e;
  }
}

/**
 * Called every ~30s from any dashboard page so others see you in "Focusing now".
 * alive: false tells the client the session is over. An expired session can't be revived,
 * otherwise a laptop waking up would add the whole night to it.
 */
export async function heartbeat(sessionId: string) {
  const user = await me();
  const id = idSchema.parse(sessionId);
  const s = await db.focusSession.findFirst({ where: { id, userId: user.id, status: "ACTIVE" } });
  if (!s) return { alive: false, paused: false };
  if (isExpired(s)) {
    await finishSession(s, s.lastBeatAt, user.timeZone);
    return { alive: false, paused: false };
  }
  await db.focusSession.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { lastBeatAt: new Date() } });
  return { alive: true, paused: !!s.pausedAt };
}

export async function pauseFocus(sessionId: string): Promise<ActiveSession | null> {
  const user = await me();
  const id = idSchema.parse(sessionId);
  const now = new Date();
  await db.focusSession.updateMany({
    where: { id, userId: user.id, status: "ACTIVE", pausedAt: null },
    data: { pausedAt: now, lastBeatAt: now },
  });
  revalidatePath("/dashboard", "layout");
  const s = await db.focusSession.findFirst({ where: { id, userId: user.id, status: "ACTIVE" } });
  return s ? toActive(s) : null;
}

export async function resumeFocus(sessionId: string): Promise<ActiveSession | null> {
  const user = await me();
  const id = idSchema.parse(sessionId);
  const s = await db.focusSession.findFirst({ where: { id, userId: user.id, status: "ACTIVE" } });
  if (!s) return null;
  if (!s.pausedAt) return toActive(s);
  const now = new Date();
  const pausedFor = Math.max(0, Math.round((now.getTime() - s.pausedAt.getTime()) / 1000));
  await db.focusSession.updateMany({
    where: { id, status: "ACTIVE", pausedAt: s.pausedAt },
    data: { pausedAt: null, pausedSec: { increment: pausedFor }, lastBeatAt: now },
  });
  revalidatePath("/dashboard", "layout");
  const fresh = await db.focusSession.findFirst({ where: { id, userId: user.id, status: "ACTIVE" } });
  return fresh ? toActive(fresh) : null;
}

export async function stopFocus(sessionId: string, opts: { share: boolean; note: string }) {
  const user = await me();
  const id = idSchema.parse(sessionId);
  const { share, note } = stopSchema.parse(opts);
  const s = await db.focusSession.findFirst({ where: { id, userId: user.id } });
  if (!s || s.status === "ABANDONED") return { ok: false as const };

  // A session that was already closed still gets its note and post, with the time it was credited.
  const durationSec =
    s.status === "ACTIVE" ? await finishSession(s, isExpired(s) ? s.lastBeatAt : new Date(), user.timeZone) : s.durationSec;

  let postId: string | null = null;
  if (share && durationSec >= 60) {
    const body = note || s.label || "Session done";
    const post = await db.post.upsert({ where: { sessionId: s.id }, create: { userId: user.id, sessionId: s.id, body }, update: {} });
    postId = post.id;
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true as const, durationSec, postId };
}

export async function discardFocus(sessionId: string) {
  const user = await me();
  const id = idSchema.parse(sessionId);
  await db.focusSession.updateMany({
    where: { id, userId: user.id, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date(), durationSec: 0, pausedAt: null, activeKey: null },
  });
  revalidatePath("/dashboard", "layout");
}
