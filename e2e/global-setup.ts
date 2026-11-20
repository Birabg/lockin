import { PrismaClient } from "@prisma/client";

/**
 * Rate-limit counters live in the database, so repeated local runs would eventually hit "Too many attempts"
 * (10 signups an hour per IP). Clear the counters for this machine's own addresses before each run.
 * Only keys for localhost are touched; CI starts from an empty database anyway.
 */
export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    await db.rateLimit.deleteMany({ where: { OR: [{ key: { endsWith: ":::1" } }, { key: { endsWith: ":127.0.0.1" } }] } });
  } finally {
    await db.$disconnect();
  }
}
