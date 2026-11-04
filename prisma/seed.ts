/* Demo data: npm run db:seed  (all demo accounts use password "password123") */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DAY = 86_400_000;
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(xs: T[]) => xs[rand(0, xs.length - 1)];

const PEOPLE = [
  ["Abel Tesfaye", "abel", "Shipping a side project every month"],
  ["Hana Bekele", "hana", "Med student. Coffee + flashcards"],
  ["Dawit Alemu", "dawit", "Backend dev, NestJS fan"],
  ["Meron Girma", "meron", "Designing things people like"],
  ["Yonas Haile", "yonas", "FYP season 😮‍💨"],
  ["Selam Tadesse", "selam", "Learning to code in public"],
  ["Kidus Mekonnen", "kidus", null],
  ["Liya Assefa", "liya", "Writing my thesis one session at a time"],
] as const;

const LABELS = ["FYP", "Leetcode", "Design", "Thesis", "Reading", "Freelance", "Marketing", null];
const NOTES = [
  "Session done",
  "8hr lockin",
  "one of those productive nights",
  "Weekend grind 🔥",
  "Finally fixed that bug",
  "Deep work > busy work",
  "Building sth",
  "Chapter 3 done ✅",
];
const COMMENTS = ["let's gooo", "consistency 🔥", "respect", "same energy today", "how do you stay focused this long?", "🫡"];

async function main() {
  await db.$transaction([
    db.like.deleteMany(),
    db.comment.deleteMany(),
    db.post.deleteMany(),
    db.focusSession.deleteMany(),
    db.follow.deleteMany(),
    db.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("password123", 10);
  const users = [];
  for (const [name, username, bio] of PEOPLE) {
    users.push(
      await db.user.create({
        data: { name, username, bio, email: `${username}@demo.local`, passwordHash, dailyGoalMin: pick([60, 90, 120, 180]) },
      }),
    );
  }

  const now = Date.now();
  for (const u of users) {
    const activeDays = rand(5, 14);
    for (let d = activeDays - 1; d >= 0; d--) {
      if (Math.random() < 0.15 && d > 0) continue; // the odd missed day
      const sessionsToday = rand(1, 3);
      for (let s = 0; s < sessionsToday; s++) {
        const durationSec = rand(15, 150) * 60;
        const startedAt = new Date(now - d * DAY - rand(1, 10) * 3_600_000 - s * 3 * 3_600_000);
        if (startedAt.getTime() + durationSec * 1000 > now) continue;
        const goalMin = pick([25, 50, 60, 90, 120]);
        const session = await db.focusSession.create({
          data: {
            userId: u.id,
            label: pick(LABELS),
            goalMin,
            startedAt,
            endedAt: new Date(startedAt.getTime() + durationSec * 1000),
            lastBeatAt: new Date(startedAt.getTime() + durationSec * 1000),
            durationSec,
            status: "DONE",
          },
        });
        if (Math.random() < 0.35) {
          const post = await db.post.create({
            data: { userId: u.id, sessionId: session.id, body: pick(NOTES), createdAt: session.endedAt! },
          });
          for (const liker of users)
            if (liker.id !== u.id && Math.random() < 0.45) await db.like.create({ data: { userId: liker.id, postId: post.id } });
          if (Math.random() < 0.4) {
            const c = pick(users.filter((x) => x.id !== u.id));
            await db.comment.create({
              data: { userId: c.id, postId: post.id, body: pick(COMMENTS), createdAt: new Date(post.createdAt.getTime() + 600_000) },
            });
          }
        }
      }
    }
  }

  // two people "focusing now" (they drop off after ~3 min without a heartbeat)
  for (const u of users.slice(0, 2)) {
    await db.focusSession.create({
      data: {
        userId: u.id,
        label: pick(LABELS),
        goalMin: 60,
        startedAt: new Date(now - rand(5, 40) * 60_000),
        lastBeatAt: new Date(),
        status: "ACTIVE",
      },
    });
  }

  for (const a of users)
    for (const b of users)
      if (a.id !== b.id && Math.random() < 0.4) await db.follow.create({ data: { followerId: a.id, followingId: b.id } });

  await db.post.create({ data: { userId: users[5].id, body: "Yo I'm new here 👋" } });
  console.log(`Seeded ${users.length} users. Log in as abel / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
