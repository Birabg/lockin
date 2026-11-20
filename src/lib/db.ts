import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma's 5s default is fine next to the database, but a laptop far from Neon pays ~200ms per query,
// which is enough for a few-statement transaction to be closed mid-way. On Vercel these finish in milliseconds.
export const db = globalForPrisma.prisma ?? new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 20_000 } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
