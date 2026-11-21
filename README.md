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
| `RESEND_API_KEY`, `EMAIL_FROM`                                                          | No        | Verification and password reset emails. Without them the reset link and resend button are hidden. |
| `EMAIL_VERIFICATION_ENFORCED`                                                           | No        | `true` restricts unverified accounts (see Email verification). Off by default.                    |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                              | No        | "Continue with Google". Without both, the button is hidden.                                       |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                              | No        | "Continue with GitHub". Without both, the button is hidden.                                       |
| `UPLOAD_DIR`                                                                            | No        | Folder for local uploads. Defaults to `.uploads`.                                                 |

The Playwright config also sets three test-only variables on its own server: `EMAIL_LOG_ONLY=1` (print emails), `EMAIL_TEST_DOMAINS=example.com` (skip the DNS check for test addresses) and `OAUTH_TEST_MODE=1` (a fake Google/GitHub, refused on Vercel). Never set them in a deployment.

## Tests

```bash
npm test                # Vitest: time, streaks, leaderboards, session maths, URL signing
npm run build           # the e2e tests run against a production build
npm run test:e2e        # Playwright: signup → focus → share → like → leaderboard
```

The e2e test needs a migrated database in `DATABASE_URL` and writes to it, so use a scratch one. Run `npx playwright install chromium` once, or set `PW_CHANNEL=chrome` to use your installed Chrome. GitHub Actions runs format, lint, typecheck, unit tests, a migration drift check, build and e2e on every push and pull request.

## What's in it

| Route                                     | What it does                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`                              | Feed (Global / Following / Timelapses tabs, grouped by day), composer, right rail with streak card + week strip, Focusing now, today's top 3 |
| `/dashboard/timer`                        | Focus timer with goal presets, label, live ring, heartbeat every 30s, finish → note + share to feed, discard                                 |
| `/dashboard/focusing`                     | Everyone with a live session                                                                                                                 |
| `/dashboard/stats`                        | Today / week / streak / all-time tiles, weekly recap, 30-day bars against your goal, time by label                                           |
| `/dashboard/leaderboard`                  | Today / week / all-time rankings with follow buttons                                                                                         |
| `/dashboard/people`                       | Search users and follow                                                                                                                      |
| `/dashboard/u/[username]`                 | Public profile: streak, total time, followers, posts                                                                                         |
| `/dashboard/settings`                     | Avatar, name, bio, daily goal, time zone, log out                                                                                            |
| `/dashboard/notifications`                | Likes, comments, follows, session starts, nudges and buddy requests                                                                          |
| `/dashboard/buddies`                      | Focus buddies: requests, streaks, live status, nudges                                                                                        |
| `/dashboard/rooms`                        | Create a live room or join one with its 6-character code                                                                                     |
| `/dashboard/rooms/[code]`                 | Everyone's timers in the room, ticking together                                                                                              |
| `/card/[username]`                        | Shareable streak card image (1200×630), also the profile's social preview                                                                    |
| `/login`, `/signup`                       | Continue with Google / GitHub, or email or username + password                                                                               |
| `/welcome`                                | First Google/GitHub sign-in: pick a username                                                                                                 |
| `/api/auth/[provider]/start`, `/callback` | Google/GitHub sign-in handoff and return                                                                                                     |
| `/forgot-password`, `/reset-password`     | One-time emailed reset link, which signs out every device                                                                                    |
| `/verify-email`                           | Where the verification email links to                                                                                                        |
| `/privacy`                                | Privacy page                                                                                                                                 |

Guests can browse the dashboard (public preview); focusing, posting, liking, commenting and following require an account.

## Email verification

- Signing up sends a link that lasts 24 hours and works once. Only its hash is stored, and sending a new one cancels the old one. "Resend email" in the dashboard banner is limited to 3 an hour.
- Resetting a password by email also verifies the address, since the link proves they own it.
- With `EMAIL_VERIFICATION_ENFORCED` unset, nobody is restricted. Unverified people just see the banner.
- With it set to `true`, unverified accounts can sign in and focus, but can't post or share sessions, comment, create quests, post takes, or appear on the leaderboard.
- Accounts made before verification existed (`legacyUnverified`) keep everything for 14 days, counted from their first visit after enforcement is turned on (`verifyGraceEndsAt`). New signups get no grace period.
- The rules are in `src/lib/verification.ts` and the emails in `src/lib/email-templates.ts`.

## Email checks at signup

New addresses (`checkNewEmail` in `src/lib/email-domain.ts`) are trimmed, lowercased and checked:

1. **Format**, with zod.
2. **Throwaway domains** are refused ("Please use a permanent email address."). The list is vendored from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0) in `src/lib/data/disposable-domains.json`. Refresh it with `npm run email:domains`.
3. **The domain must be able to receive mail**: an MX record, or with none, an A/AAAA record. A "null MX" or a domain that doesn't exist is refused ("This email domain can't receive mail. Check for typos."). The lookup gives up after 2.5 s, and if DNS itself fails the signup goes through, so a flaky resolver never blocks real people.
4. **Typos** of popular providers (`gmial.com`, `gmail.co`, `yaho.com`, `hotnail.com`…) get a "Did you mean name@gmail.com?" link that fixes the field. It never blocks.

Existing accounts aren't re-checked. Use the same function if changing your email is ever added.

## Sign in with Google and GitHub

- [arctic](https://arcticjs.dev) builds the provider URLs and swaps the code for tokens; sessions are still Lockin's own `lk_session` cookie. Google uses PKCE. Both use a signed one-time `state` cookie.
- A new Google/GitHub user picks a username on `/welcome` (checked as they type) and is verified straight away. Their `passwordHash` is null, and password sign-in tells them to use the button.
- If the provider's verified email matches a **verified** account, it's linked and signed in. If it matches an **unverified** account, they're asked to sign in with that account's password once, and then it's linked (and the address verified). GitHub only counts the primary, verified email.
- Settings → Connected accounts connects and disconnects them, but never the last way to sign in. Accounts with no password delete themselves by typing their username.
- Callback URL: `<site>/api/auth/google/callback` and `<site>/api/auth/github/callback`. The rules are in `src/lib/oauth-flow.ts`.

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
4. **Variables:** add `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` and the `S3_*` variables for Production. Add `RESEND_API_KEY` and `EMAIL_FROM` if you want verification and password reset emails.
5. **Deploy.** Vercel runs `vercel-build`, which applies pending migrations and then builds.

After the first deploy, check that you can sign up, finish a session, upload an avatar, and open `/card/<username>`. Add a custom domain? Set `APP_URL` to it so reset links and preview images use it.

Every deployment runs migrations against the database it's configured with. To keep preview deployments away from production data, give the Preview environment its own `DATABASE_URL` and `DIRECT_URL`, such as a Neon branch.

## Focus music

The Music button in the focus dock plays instruments (Lo-fi keys, Piano, Violin, Cello, Saxophone, Acoustic guitar, Flute & harp, Music box) and nature sounds (Rain, Ocean waves, Brown noise). All of them are made in the browser with Web Audio (`src/lib/ambience.ts` plays them; `src/lib/music-pieces.ts` holds each piece's chords, scale and instruments), so there are no audio files, nothing to license, and they work offline. The pieces are generative: the melody is picked as it plays, so they never loop.

People can also paste a YouTube video or playlist link (`src/lib/youtube.ts`); the YouTube section is at the top of the Music panel. It plays through YouTube's privacy-enhanced embed (youtube-nocookie.com), which needs no API key. YouTube's ads may play, and some videos don't allow embedding. A now-playing pill just above the dock shows the title, play/pause, Open on YouTube and stop. It talks to the embed over its postMessage API, which also carries the volume. YouTube links play audio only, with the embed hidden off-screen. YouTube's terms don't allow that, and YouTube can block embeds for the site.

The choice and volume are saved in the browser. The sound keeps playing between setup and the session, fades out when you leave the timer page, and comes back on your first click the next time you open it. Browsers won't start audio before you've clicked something. The Sound button is separate: it mutes only the dial clicks and the goal chime.

## Clock styles

The full-screen timer can look five ways: Ring, Rolling, Flip, Reel and Minimal. Each is a component in `src/components/clocks/` taking the same props, and `src/lib/clock-styles.ts` lists them. The choice is saved on the user as `clockStyle`. Shared posts and the small timer card always use the ring.

## Icons

Icons are from [Solar](https://www.figma.com/community/file/1166831539721848736) by 480 Design, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only the ones Lockin uses are copied into `src/components/icon-data.ts`, so nothing is fetched at runtime. To add or swap one, edit the list in `scripts/build-icons.mjs` and run `npm run icons`.

## Not built yet

- Distraction blocking and a desktop app.
- Offline support (the app installs as a PWA but has no service worker).
