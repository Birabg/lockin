/*
 * Demo quests, a question of the day and hot takes, for development only:
 *   npm run db:seed:community
 * It only adds rows (it never wipes), creates the demo authors if they're missing (password "password123"),
 * and can be run again: it replaces its own demo rows. `npm run db:seed` calls it too.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { brand } from "../src/lib/brand";
import { dayKey } from "../src/lib/time";

const HOUR = 3_600_000;
const AUTHORS = [
  ["Abel Tesfaye", "abel"],
  ["Hana Bekele", "hana"],
  ["Dawit Alemu", "dawit"],
  ["Meron Girma", "meron"],
] as const;

const QUESTS = [
  { title: "3 × 50m deep sessions before Friday", type: "solo", targetSessions: 3, minSessionMin: 50, color: "butter", hours: 70 },
  { title: "Study group: 20 hours together this week", type: "group", targetMinutes: 1200, color: "mint", hours: 150 },
  { title: "Morning lock-in: 90 minutes today", type: "solo", targetMinutes: 90, color: "lilac", hours: 10 },
] as const;

const TAKES = [
  "Lo-fi playlists are just elevator music with better branding.",
  "If you plan your day the night before, you've already won half of it.",
  "Phone in another room > any focus app ever made.",
  "50/10 beats 25/5 and it's not even close.",
];

function refuseInProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to add demo community data in production.");
  }
}

export async function seedCommunity(db: PrismaClient) {
  refuseInProduction();
  const passwordHash = await bcrypt.hash("password123", 10);
  const authors = [];
  for (const [name, username] of AUTHORS) {
    authors.push(
      await db.user.upsert({
        where: { username },
        create: { name, username, email: `${username}@demo.local`, passwordHash, timeZone: brand.timeZone },
        update: {},
      }),
    );
  }
  const ids = authors.map((a) => a.id);

  // replace earlier demo rows from these authors
  await db.quest.deleteMany({ where: { creatorId: { in: ids }, title: { in: QUESTS.map((q) => q.title) } } });
  await db.take.deleteMany({ where: { authorId: { in: ids }, body: { in: TAKES } } });

  const now = Date.now();
  for (const [i, q] of QUESTS.entries()) {
    const creator = authors[i];
    const joiners = authors.filter((_, j) => j !== i).slice(0, 2 + (i % 2));
    await db.quest.create({
      data: {
        creatorId: creator.id,
        title: q.title,
        type: q.type,
        targetMinutes: "targetMinutes" in q ? q.targetMinutes : null,
        targetSessions: "targetSessions" in q ? q.targetSessions : null,
        minSessionMin: "minSessionMin" in q ? q.minSessionMin : null,
        color: q.color,
        startsAt: new Date(now - 6 * HOUR),
        endsAt: new Date(now + q.hours * HOUR),
        participants: {
          create: [creator, ...joiners].map((u, k) => ({
            userId: u.id,
            joinedAt: new Date(now - (k + 1) * HOUR),
            progressSec: (k + 1) * (q.type === "group" ? 95 : 25) * 60,
            progressSessions: k === 0 ? 1 : 0,
          })),
        },
      },
    });
  }

  for (const [i, body] of TAKES.entries()) {
    const take = await db.take.create({
      data: { authorId: authors[i].id, body, createdAt: new Date(now - (i * 3 + 1) * HOUR) },
    });
    const reactors = authors.filter((_, j) => j !== i);
    await db.takeReaction.createMany({
      data: reactors.map((u, k) => ({ takeId: take.id, userId: u.id, value: (i + k) % 3 === 0 ? "disagree" : "agree" })),
    });
  }

  // today's question, unless real people already voted on today's
  const day = dayKey(new Date(), brand.timeZone);
  const today = await db.dailyQuestion.findUnique({ where: { day }, include: { votes: { select: { userId: true } } } });
  const realVotes = today?.votes.filter((v) => !ids.includes(v.userId)).length ?? 0;
  if (realVotes === 0) {
    const question = await db.dailyQuestion.upsert({
      where: { day },
      create: { day, question: "Best time of day to lock in?", options: ["Early morning", "Afternoon", "Late night"] },
      update: { question: "Best time of day to lock in?", options: ["Early morning", "Afternoon", "Late night"] },
    });
    await db.questionVote.deleteMany({ where: { questionId: question.id } });
    await db.questionVote.createMany({
      data: authors.map((u, i) => ({ questionId: question.id, userId: u.id, option: [0, 2, 2, 1][i] })),
    });
  }

  console.log(`Added ${QUESTS.length} demo quests, ${TAKES.length} takes and today's question.`);
}

// run on its own: npm run db:seed:community
if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/seed-community.ts")) {
  const db = new PrismaClient();
  seedCommunity(db)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
