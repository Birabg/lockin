/* One-time upgrade for databases made before per-user time zones: npm run db:backfill */
import { PrismaClient } from "@prisma/client";
import { brand } from "../src/lib/brand";
import { rebuildStats } from "./rebuild-stats";

const db = new PrismaClient();

async function main() {
  // accounts from before this change never had a zone, and the app used brand.timeZone for them
  const { count } = await db.user.updateMany({ where: { timeZone: "UTC" }, data: { timeZone: brand.timeZone } });
  const stats = await rebuildStats(db);
  console.log(`Set the time zone on ${count} users. Rebuilt ${stats.days} day totals from ${stats.sessions} sessions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
