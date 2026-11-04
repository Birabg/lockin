/* Demo data: npm run db:seed  (all demo accounts use password "password123") */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { brand } from "../src/lib/brand";
import { rebuildStats } from "./rebuild-stats";

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

/** Seeding wipes every table, so it refuses to touch a database with real accounts in it. */
async function assertDemoOnly() {
  const demo = PEOPLE.map(([, username]) => username as string);
  const real = await db.user.count({ where: { username: { notIn: demo } } });
  if (real > 0 && !process.argv.includes("--force")) {
    throw new Error(`Refusing to seed: this would delete ${real} real account(s). Pass --force to wipe them.`);
  }
}

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

const PHOTO_COLORS = [
  ["#3b2f7a", "#e0876a"],
  ["#123b4a", "#6ec9d4"],
  ["#4a2333", "#f5b366"],
];

/** Draws a plain gradient placeholder and saves it where uploads live, returning its /media address. */
async function placeholderPhoto(userId: string, [from, to]: string[]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#g)"/>
    <circle cx="1180" cy="300" r="190" fill="#fff" opacity="0.12"/>
    <rect x="240" y="620" width="1120" height="60" rx="30" fill="#fff" opacity="0.1"/>
    <rect x="240" y="720" width="760" height="60" rx="30" fill="#fff" opacity="0.08"/>
  </svg>`;
  const key = `photos/${userId}/${randomUUID()}.webp`;
  const path = join(process.env.UPLOAD_DIR ?? ".uploads", key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer());
  return `/media/${key}`;
}

type Showcase = {
  userId: string;
  note: string;
  label: string | null;
  goalMin: number;
  focusMin: number;
  pausedMin?: number;
  endedMinAgo: number;
  photo?: string[];
};

/** A fixed post, so every kind of card is always at the top of the demo feed. */
async function showcasePost(s: Showcase) {
  const pausedMin = s.pausedMin ?? 0;
  const endedAt = new Date(Date.now() - s.endedMinAgo * 60_000);
  const session = await db.focusSession.create({
    data: {
      userId: s.userId,
      label: s.label,
      goalMin: s.goalMin,
      startedAt: new Date(endedAt.getTime() - (s.focusMin + pausedMin) * 60_000),
      endedAt,
      lastBeatAt: endedAt,
      durationSec: s.focusMin * 60,
      pausedSec: pausedMin * 60,
      status: "DONE",
    },
  });
  await db.post.create({
    data: {
      userId: s.userId,
      sessionId: session.id,
      body: s.note,
      createdAt: endedAt,
      views: rand(12, 900),
      ...(s.photo ? { mediaUrl: await placeholderPhoto(s.userId, s.photo), mediaType: "image" } : {}),
    },
  });
}

async function main() {
  await assertDemoOnly();
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
        data: {
          name,
          username,
          bio,
          email: `${username}@demo.local`,
          passwordHash,
          timeZone: brand.timeZone,
          dailyGoalMin: pick([60, 90, 120, 180]),
        },
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
            data: {
              userId: u.id,
              sessionId: session.id,
              body: pick(NOTES),
              createdAt: session.endedAt!,
              views: rand(0, 400),
              ...(Math.random() < 0.2 ? { mediaUrl: await placeholderPhoto(u.id, pick(PHOTO_COLORS)), mediaType: "image" } : {}),
            },
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

  await db.post.create({ data: { userId: users[5].id, body: "Yo I'm new here 👋", views: 37 } });
  await showcasePost({
    userId: users[0].id,
    note: "Launch copy done",
    label: "Marketing",
    goalMin: 60,
    focusMin: 91,
    endedMinAgo: 5,
    photo: PHOTO_COLORS[0],
  });
  await showcasePost({ userId: users[1].id, note: "Exactly on target", label: "Thesis", goalMin: 60, focusMin: 60, endedMinAgo: 15 });
  await showcasePost({
    userId: users[2].id,
    note: "Barely started, but it counts",
    label: "Leetcode",
    goalMin: 120,
    focusMin: 6,
    endedMinAgo: 25,
  });
  await showcasePost({
    userId: users[3].id,
    note: "Long one, one coffee break",
    label: "FYP",
    goalMin: 300,
    focusMin: 300,
    pausedMin: 10,
    endedMinAgo: 35,
  });
  await showcasePost({ userId: users[4].id, note: "No label, no photo", label: null, goalMin: 50, focusMin: 30, endedMinAgo: 45 });
  await rebuildStats(db);
  console.log(`Seeded ${users.length} users. Log in as abel / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
