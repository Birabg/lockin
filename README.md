# Lockin

**Live:** https://lockin-beige-three.vercel.app

A social focus-timer app: run focus sessions, keep a daily streak, see who's focusing right now, share sessions to a feed and climb the leaderboard.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS v4 · Prisma + Postgres · JWT cookie auth (jose + bcryptjs)

## Run it

You need Node 22 or newer and a Postgres database. A free [Neon](https://neon.tech) project works, or run one locally:

```bash
docker run -d --name lockin-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lockin -p 5432:5432 postgres:17
```

```bash
npm install
cp .env.example .env          # set AUTH_SECRET and your database URLs
npm run db:deploy             # applies the migrations
npm run db:seed               # optional demo data (login: abel / password123)
npm run dev                   # http://localhost:3000
```

## Environment variables

| Variable                                                                                | Required  | What it is                                                                                        |
| --------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                          | Yes       | Postgres connection the app uses. On Neon, the pooled string.                                     |
| `DIRECT_URL`                                                                            | Yes       | Direct Postgres connection for migrations. Locally, the same as `DATABASE_URL`.                   |
| `AUTH_SECRET`                                                                           | Yes       | Signs login cookies. Generate with `openssl rand -base64 32`. Production refuses the placeholder. |
| `APP_URL`                                                                               | No        | Public address for social preview images. Vercel supplies its own.                                |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | On Vercel | Bucket for avatars, photos and timelapses.                                                        |
| `S3_REGION`                                                                             | No        | Defaults to `auto`, which suits R2.                                                               |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                          | No        | Password reset emails. Without them the reset link is hidden in production.                       |
| `UPLOAD_DIR`                                                                            | No        | Folder for local uploads. Defaults to `.uploads`.                                                 |

## Tests

```bash
npm test                # Vitest: time, streaks, leaderboards, session maths, URL signing
npm run build           # the e2e tests run against a production build
npm run test:e2e        # Playwright: signup → focus → share → like → leaderboard
```

The e2e test needs a migrated database in `DATABASE_URL` and writes to it, so use a scratch one. Run `npx playwright install chromium` once, or set `PW_CHANNEL=chrome` to use your installed Chrome. GitHub Actions runs format, lint, typecheck, unit tests, a migration drift check, build and e2e on every push and pull request.

## What's in it

| Route                                 | What it does                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                          | Feed (Global / Following / Timelapses tabs, grouped by day), composer, right rail with streak card + week strip, Focusing now, today's top 3 |
| `/dashboard/timer`                    | Focus timer with goal presets, label, live ring, heartbeat every 30s, finish → note + share to feed, discard                                 |
| `/dashboard/focusing`                 | Everyone with a live session                                                                                                                 |
| `/dashboard/stats`                    | Today / week / streak / all-time tiles, weekly recap, 30-day bars against your goal, time by label                                           |
| `/dashboard/leaderboard`              | Today / week / all-time rankings with follow buttons                                                                                         |
| `/dashboard/people`                   | Search users and follow                                                                                                                      |
| `/dashboard/u/[username]`             | Public profile: streak, total time, followers, posts                                                                                         |
| `/dashboard/settings`                 | Avatar, name, bio, daily goal, time zone, log out                                                                                            |
| `/dashboard/notifications`            | Likes, comments, follows, session starts, nudges and buddy requests                                                                          |
| `/dashboard/buddies`                  | Focus buddies: requests, streaks, live status, nudges                                                                                        |
| `/dashboard/rooms`                    | Create a live room or join one with its 6-character code                                                                                     |
| `/dashboard/rooms/[code]`             | Everyone's timers in the room, ticking together                                                                                              |
| `/card/[username]`                    | Shareable streak card image (1200×630), also the profile's social preview                                                                    |
| `/login`, `/signup`                   | Email or username + password                                                                                                                 |
| `/forgot-password`, `/reset-password` | One-time emailed reset link, which signs out every device                                                                                    |
| `/privacy`                            | Privacy page                                                                                                                                 |

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

**Photos** can be added when finishing a session (5MB at most). The original goes straight to storage, then the server resizes it to 1600px WebP with sharp, which also drops location data, and deletes the original.

**Timelapses** are opt-in on the timer. The browser asks to share a screen, keeps a small frame every 5 s, and turns them into a sped-up WebM when the session ends. Recording survives moving between pages, but not a full page reload.

## Changing the database

Edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name what_changed` and commit the new folder in `prisma/migrations`. CI fails if the schema and the migrations disagree.

## Moving from the old SQLite database

```bash
npm run db:deploy                       # on an empty Postgres database
npm run db:import -- prisma/dev.db      # copies your accounts, sessions and posts
npm run db:backfill                     # sets time zones and rebuilds daily totals
```

## Focus backgrounds

The timer card can show a photo or a drawn theme. Each person's choice is saved to their account and kept in `localStorage` for people without one.

To add a photo, put a `.webp` (up to 2560px wide) in `public/scenes` and a 240px copy in `public/scenes/thumbs`, then add a line to `imageScenes` in `src/lib/scenes.ts` with an accent color for the ring. Full-size originals stay in `scene-originals/`, which git ignores.

## Rebrand

- Name, tagline, fallback time zone, default goal: `src/lib/brand.ts`
- Colors: the `--primary*` tokens at the top of `src/app/globals.css`
- Logo mark: `Logo` in `src/components/ui.tsx`

## Deploying to Vercel with Neon

1. **Database:** create a [Neon](https://neon.tech) project and copy two connection strings: pooled (`DATABASE_URL`) and direct (`DIRECT_URL`).
2. **Media:** create a Cloudflare R2 or S3 bucket, turn on public access, and create an access key with read and write permission. Add this CORS rule, with your site's address:

   ```json
   [{ "AllowedOrigins": ["https://your-site.vercel.app"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"] }]
   ```

3. **Project:** import the repo on [Vercel](https://vercel.com/new). It finds Next.js by itself.
4. **Variables:** add `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` and the `S3_*` variables for Production. Add `RESEND_API_KEY` and `EMAIL_FROM` if you want password resets.
5. **Deploy.** Vercel runs `vercel-build`, which applies pending migrations and then builds.

After the first deploy, check that you can sign up, finish a session, upload an avatar, and open `/card/<username>`. Add a custom domain? Set `APP_URL` to it so reset links and preview images use it.

Every deployment runs migrations against the database it's configured with. To keep preview deployments away from production data, give the Preview environment its own `DATABASE_URL` and `DIRECT_URL`, such as a Neon branch.

## Not built yet

- Distraction blocking and a desktop app.
- Offline support (the app installs as a PWA but has no service worker).
