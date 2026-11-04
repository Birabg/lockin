import "server-only";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "./db";

export const limits = {
  loginIp: { max: 30, windowSec: 15 * 60 },
  loginAccount: { max: 10, windowSec: 15 * 60 },
  signup: { max: 10, windowSec: 60 * 60 },
  post: { max: 30, windowSec: 60 * 60 },
  comment: { max: 60, windowSec: 60 * 60 },
  like: { max: 60, windowSec: 60 },
  follow: { max: 60, windowSec: 60 },
  upload: { max: 20, windowSec: 60 * 60 },
  buddy: { max: 30, windowSec: 60 * 60 },
  nudge: { max: 1, windowSec: 60 * 60 },
  room: { max: 20, windowSec: 60 * 60 },
  scene: { max: 60, windowSec: 60 },
} as const;

type Limit = { max: number; windowSec: number };

async function hit(key: string, resetAt: Date) {
  try {
    return await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: { increment: 1 } } });
  } catch (e) {
    // two first hits at once: the loser's create fails, so count it as an update
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    }
    throw e;
  }
}

/** Returns true when the action is allowed. Counts live in the database so they hold across serverless instances. */
export async function allow(key: string, { max, windowSec }: Limit): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const row = await hit(key, resetAt);
  if (row.resetAt <= now) {
    await db.rateLimit.update({ where: { key }, data: { count: 1, resetAt } });
    return true;
  }
  if (Math.random() < 0.01) await db.rateLimit.deleteMany({ where: { resetAt: { lte: now } } });
  return row.count <= max;
}

/** Trusts the first x-forwarded-for entry, which Vercel sets. Behind another proxy, check that it does too. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
