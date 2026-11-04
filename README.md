# Lockin

A social focus-timer app: run focus sessions, keep a daily streak, see who's focusing right now, share sessions to a feed and climb the leaderboard. Layout and interaction model modelled on nuzz.space, under its own name and colors.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS v4 · Prisma (SQLite in dev, Postgres in prod) · JWT cookie auth (jose + bcryptjs)

## Run it

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET to a long random string
npx prisma db push            # creates prisma/dev.db
npm run db:seed               # optional demo data (login: abel / password123)
npm run dev                   # http://localhost:3000
```

## What's in it

| Route                      | What it does                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`               | Feed (Global / Following / Timelapses tabs, grouped by day), composer, right rail with streak card + week strip, Focusing now, today's top 3 |
| `/dashboard/timer`         | Focus timer with goal presets, label, live ring, heartbeat every 30s, finish → note + share to feed, discard                                 |
| `/dashboard/focusing`      | Everyone with a live session                                                                                                                 |
| `/dashboard/stats`         | Today / week / streak / all-time tiles, weekly recap, 30-day bars against your goal, time by label                                           |
| `/dashboard/leaderboard`   | Today / week / all-time rankings with follow buttons                                                                                         |
| `/dashboard/people`        | Search users and follow                                                                                                                      |
| `/dashboard/u/[username]`  | Public profile: streak, total time, followers, posts                                                                                         |
| `/dashboard/settings`      | Avatar, name, bio, daily goal, time zone, log out                                                                                            |
| `/dashboard/notifications` | Likes, comments, follows, session starts, nudges and buddy requests                                                                          |
| `/dashboard/buddies`       | Focus buddies: requests, streaks, live status, nudges                                                                                        |
| `/dashboard/rooms`         | Create a live room or join one with its 6-character code                                                                                     |
| `/dashboard/rooms/[code]`  | Everyone's timers in the room, ticking together                                                                                              |
| `/card/[username]`         | Shareable streak card image (1200×630), also the profile's social preview                                                                    |
| `/login`, `/signup`        | Email or username + password                                                                                                                 |

Guests can browse the dashboard (public preview); focusing, posting, liking, commenting and following require an account.

## How the live parts work

- **Focusing now**: an `ACTIVE` session whose `lastBeatAt` is under 90 s old. Every dashboard page sends a heartbeat every 30 s and on tab focus (`FocusHeartbeat` in the dashboard layout).
- **Going quiet**: with no heartbeat for 3 min (locked phone, closed tab), a session stops adding to totals but stays open until 10 min past its goal. Come back before then and the whole session counts.
- **Closed tabs**: after that, the session is closed at its last heartbeat and can't be revived (`isExpired`, `reapStaleSessions`). You can still save a note and share it.
- **Pause**: paused time is stored on the session (`pausedSec`, `pausedAt`) and left out of `durationSec`.
- **One session at a time**: `activeKey` holds the user id while a session is `ACTIVE`, and its unique index stops a second one. Other tabs follow along through a `BroadcastChannel`.
- **Days**: each user has a `timeZone`, taken from the browser at signup and editable in settings. Finished time is added to `DailyStat` for the user's own calendar day that the session started on.
- **Streak**: consecutive days with at least 1 focused minute; today not being done yet doesn't break it.
- **Leaderboard**: "today" and "this week" are the viewer's dates, matched against each person's own calendar days.
- **Live updates**: the dashboard polls. `LiveRefresh` calls `router.refresh()` every 20 s while the tab is visible, and timers tick on the client between polls. Server-sent events would hold a serverless function open per viewer on Vercel, so polling is the better fit here. It is one component if you want to replace it.
- **Rate limits**: counters live in the `RateLimit` table so they hold across serverless instances. Limits are in `src/lib/rate-limit.ts`.

## Media storage

The browser uploads files straight to storage, so large videos never pass through a server function.

- **Local disk** (default in dev): files go to `UPLOAD_DIR` (`.uploads`) and are served from `/media`.
- **S3 or Cloudflare R2**: set the `S3_*` variables in `.env.example`. The bucket needs a CORS rule allowing `PUT` from your site. URLs are signed in `src/lib/s3-presign.ts`, with no AWS SDK.

**Timelapses** are opt-in on the timer. The browser asks to share a screen, keeps a small frame every 5 s, and turns them into a sped-up WebM when the session ends. Recording survives moving between pages, but not a full page reload.

## Upgrading an existing database

After pulling schema changes on a database with data in it:

```bash
npx prisma db push
npm run db:backfill   # sets time zones and rebuilds DailyStat from sessions
```

## Rebrand

- Name, tagline, fallback time zone, default goal: `src/lib/brand.ts`
- Colors: the `--primary*` tokens at the top of `src/app/globals.css`
- Logo mark: `Logo` in `src/components/ui.tsx`

## Deploying

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`.
2. Set `DATABASE_URL` (Neon / Supabase / Railway) and `AUTH_SECRET` in your host (e.g. Vercel).
3. `npx prisma db push`, then deploy. The `build` script runs `prisma generate`.

## Not built yet

- Distraction blocking and a desktop app.
- Offline support (the app installs as a PWA but has no service worker).
