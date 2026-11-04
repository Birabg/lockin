"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { closeAtLastBeat, isExpired, reapStaleSessions } from "@/lib/queries";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to focus");
  return user;
}

export type ActiveSession = { id: string; startedAt: string; goalMin: number; label: string | null };

export async function getActiveSession(): Promise<ActiveSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  await reapStaleSessions(); // never hand back a session that's already dead
  const s = await db.focusSession.findFirst({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  return s ? { id: s.id, startedAt: s.startedAt.toISOString(), goalMin: s.goalMin, label: s.label } : null;
}

export async function startFocus(goalMin: number, label: string): Promise<ActiveSession> {
  const user = await me();
  const existing = await getActiveSession();
  if (existing) return existing;
  const goal = Math.min(Math.max(Math.round(goalMin) || 25, 5), 12 * 60);
  const s = await db.focusSession.create({
    data: { userId: user.id, goalMin: goal, label: label.trim().slice(0, 40) || null },
  });
  revalidatePath("/dashboard", "layout");
  return { id: s.id, startedAt: s.startedAt.toISOString(), goalMin: s.goalMin, label: s.label };
}

/**
 * Called every ~30s from any dashboard page so others see you in "Focusing now".
 * alive: false tells the client the session is over. An expired session can't be revived,
 * otherwise a laptop waking up would add the whole night to it.
 */
export async function heartbeat(sessionId: string) {
  const user = await me();
  const s = await db.focusSession.findFirst({ where: { id: sessionId, userId: user.id, status: "ACTIVE" } });
  if (!s) return { alive: false };
  if (isExpired(s)) {
    await closeAtLastBeat(s);
    return { alive: false };
  }
  await db.focusSession.updateMany({ where: { id: s.id, status: "ACTIVE" }, data: { lastBeatAt: new Date() } });
  return { alive: true };
}

export async function stopFocus(sessionId: string, opts: { share: boolean; note: string }) {
  const user = await me();
  const s = await db.focusSession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!s || s.status === "ABANDONED") return { ok: false as const };

  // A session that was already closed still gets its note and post, with the time it was credited.
  let durationSec = s.durationSec;
  if (s.status === "ACTIVE") {
    if (isExpired(s)) {
      durationSec = await closeAtLastBeat(s);
    } else {
      const endedAt = new Date();
      durationSec = Math.max(0, Math.round((endedAt.getTime() - s.startedAt.getTime()) / 1000));
      await db.focusSession.updateMany({
        where: { id: s.id, status: "ACTIVE" },
        data: { status: "DONE", endedAt, lastBeatAt: endedAt, durationSec },
      });
    }
  }

  if (opts.share && durationSec >= 60) {
    const body = opts.note.trim().slice(0, 280) || s.label || "Session done";
    await db.post.upsert({ where: { sessionId: s.id }, create: { userId: user.id, sessionId: s.id, body }, update: {} });
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true as const, durationSec };
}

export async function discardFocus(sessionId: string) {
  const user = await me();
  await db.focusSession.updateMany({
    where: { id: sessionId, userId: user.id, status: "ACTIVE" },
    data: { status: "ABANDONED", endedAt: new Date(), durationSec: 0 },
  });
  revalidatePath("/dashboard", "layout");
}
