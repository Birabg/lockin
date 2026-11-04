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

| Route | What it does |
|---|---|
| `/dashboard` | Feed (Global / Following / Timelapses tabs, grouped by day), composer, right rail with streak card + week strip, Focusing now, today's top 3 |
| `/dashboard/timer` | Focus timer with goal presets, label, live ring, heartbeat every 30s, finish → note + share to feed, discard |
| `/dashboard/focusing` | Everyone with a live session |
| `/dashboard/stats` | Today / week / streak / all-time tiles, 30-day bars against your goal, time by label |
| `/dashboard/leaderboard` | Today / week / all-time rankings with follow buttons |
| `/dashboard/people` | Search users and follow |
| `/dashboard/u/[username]` | Public profile: streak, total time, followers, posts |
| `/dashboard/settings` | Name, bio, daily goal, log out |
| `/login`, `/signup` | Email or username + password |

Guests can browse the dashboard (public preview); focusing, posting, liking, commenting and following require an account.

## How the live parts work

- **Focusing now**: an `ACTIVE` session whose `lastBeatAt` is under 90 s old. Every dashboard page sends a heartbeat every 30 s and on tab focus (`FocusHeartbeat` in the dashboard layout).
- **Going quiet**: with no heartbeat for 3 min (locked phone, closed tab), a session stops adding to totals but stays open until 10 min past its goal. Come back before then and the whole session counts.
- **Closed tabs**: after that, the session is closed at its last heartbeat and can't be revived (`isExpired`, `reapStaleSessions`). You can still save a note and share it.
- **Streak**: consecutive days with at least 1 focused minute; today not being done yet doesn't break it. Days are computed in `brand.timeZone`.

## Rebrand

- Name, tagline, time zone, default goal: `src/lib/brand.ts`
- Colors: the `--primary*` tokens at the top of `src/app/globals.css`
- Logo mark: `Logo` in `src/components/ui.tsx`

## Deploying

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`.
2. Set `DATABASE_URL` (Neon / Supabase / Railway) and `AUTH_SECRET` in your host (e.g. Vercel).
3. `npx prisma db push`, then deploy. The `build` script runs `prisma generate`.

## Not built yet

- **Timelapses** – needs screen capture + media storage (e.g. UploadThing / S3). The tab is in place with an empty state.
- Notifications page, live rooms, focus buddies, distraction blocking, desktop app.
- Real-time push (the feed and "focusing now" refresh on navigation; add polling or a websocket service for live updates).
