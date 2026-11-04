/*
 * Copies an old SQLite dev database into the Postgres database in DATABASE_URL.
 *   npm run db:import -- prisma/dev.db
 * Run the migrations first. The target must be empty. Columns the old file doesn't have keep their defaults.
 * Needs Node 22.13 or newer for node:sqlite. Run npm run db:backfill afterwards.
 */
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

// parents before children, so foreign keys hold
const TABLES = ["User", "FocusSession", "DailyStat", "Post", "Like", "Comment", "Follow", "Notification", "Buddy", "Room", "RoomMember"];

type Column = { column_name: string; data_type: string };

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:import -- path/to/dev.db");

  const source = new DatabaseSync(file, { readOnly: true });
  const db = new PrismaClient();

  if ((await db.user.count()) > 0) throw new Error("The target database already has users. Import needs an empty one.");

  // all or nothing, so a failed run can simply be run again
  await db.$transaction(
    async (tx) => {
      for (const table of TABLES) {
        const exists = source.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
        if (!exists) continue;

        const target = await tx.$queryRaw<
          Column[]
        >`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${table}`;
        const types = new Map(target.map((c) => [c.column_name, c.data_type]));
        const names = (source.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[])
          .map((c) => c.name)
          .filter((n) => types.has(n));

        const convert = (name: string, value: unknown) => {
          if (value === null) return null;
          const type = types.get(name) ?? "";
          if (type.startsWith("timestamp")) return new Date(typeof value === "string" ? value : Number(value));
          if (type === "boolean") return Boolean(value);
          return value;
        };

        const rows = source.prepare(`SELECT ${names.map((n) => `"${n}"`).join(", ")} FROM "${table}"`).all() as Record<string, unknown>[];
        const columns = names.map((n) => `"${n}"`).join(", ");
        const slots = names.map((_, i) => `$${i + 1}`).join(", ");
        for (const row of rows) {
          await tx.$executeRawUnsafe(`INSERT INTO "${table}" (${columns}) VALUES (${slots})`, ...names.map((n) => convert(n, row[n])));
        }
        console.log(`${table}: ${rows.length}`);
      }
    },
    { timeout: 10 * 60_000 },
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
