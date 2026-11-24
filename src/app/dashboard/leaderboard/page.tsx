import "./leaderboard.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { parsePage } from "@/lib/page";
import { getLeaderboard, getStanding, type Range } from "@/lib/queries";
import { LIVE_MS } from "@/lib/session-math";
import { formatDuration, secondsUntilReset } from "@/lib/time";
import { Avatar, PageHeader, Pager, btnPrimary } from "@/components/ui";
import { Icon } from "@/components/icon";
import { FollowButton } from "@/components/follow-button";

export const metadata = { title: "Leaderboard" };

const RANGES: { id: Range; label: string; period: string }[] = [
  { id: "today", label: "Today", period: "today" },
  { id: "week", label: "This week", period: "this week" },
  { id: "all", label: "All time", period: "all time" },
];

type Row = Awaited<ReturnType<typeof getLeaderboard>>["rows"][number];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ range?: string; page?: string }> }) {
  const { range: r, page: p } = await searchParams;
  const page = parsePage(p);
  const range = RANGES.find((x) => x.id === r) ?? RANGES[0];
  const user = await getCurrentUser();
  const timeZone = user?.timeZone ?? brand.timeZone;

  const [{ rows, hasNext, topSec }, standing, follows] = await Promise.all([
    getLeaderboard(range.id, timeZone, { page }),
    user ? getStanding(range.id, timeZone, user.id) : null,
    user ? db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }) : [],
  ]);
  const following = new Set(follows.map((f) => f.followingId));
  const live = new Set(
    rows.length
      ? (
          await db.focusSession.findMany({
            where: {
              userId: { in: rows.map((x) => x.user.id) },
              status: "ACTIVE",
              pausedAt: null,
              lastBeatAt: { gte: new Date(Date.now() - LIVE_MS) },
            },
            select: { userId: true },
          })
        ).map((s) => s.userId)
      : [],
  );

  const podium = page === 1 && rows.length >= 3 ? rows.slice(0, 3) : [];
  const list = podium.length ? rows.slice(3) : rows;
  const reset = range.id === "all" ? null : secondsUntilReset(range.id, timeZone);

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Leaderboard" />

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">Leaderboard</h1>
          <p className="mt-1 text-[13px] text-muted">Ranked by time focused {range.period}.</p>
        </div>
        {reset !== null && (
          <span className="lb-reset">
            <Icon name="refresh" size={14} /> Resets in {formatDuration(Math.max(60, Math.floor(reset / 60) * 60))}
          </span>
        )}
      </header>

      <nav aria-label="Period" className="lb-tabs">
        {RANGES.map((x) => (
          <Link
            key={x.id}
            href={`/dashboard/leaderboard?range=${x.id}`}
            aria-current={range.id === x.id ? "page" : undefined}
            className="lb-tab"
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {standing && <Standing standing={standing} period={range.period} />}

      {rows.length === 0 ? (
        <section className="panel lb-empty">
          <span className="lb-empty-icon">
            <Icon name="crown" size={24} />
          </span>
          <p className="text-[15px] font-bold">The board is empty {range.period === "all time" ? "" : range.period}</p>
          <p className="max-w-[320px] text-[13px] text-muted">Start a session and you’ll be first on it.</p>
          <Link href="/dashboard/timer" className={`${btnPrimary} mt-2 h-10 text-sm`}>
            <Icon name="startFocus" size={16} solid /> Lock in
          </Link>
        </section>
      ) : (
        <>
          {podium.length > 0 && (
            <ol className="lb-podium" aria-label="Top three">
              {[podium[1], podium[0], podium[2]].map((row) => (
                <li key={row.user.id} className="lb-place" data-rank={row.rank} data-you={row.user.id === user?.id || undefined}>
                  <Link href={`/dashboard/u/${row.user.username}`} className="lb-place-person">
                    <span className="lb-place-avatar">
                      {row.rank === 1 && <Icon name="crown" size={22} solid className="lb-crown" />}
                      <Avatar name={row.user.name} src={row.user.avatar} cssSize="var(--lb-avatar)" live={live.has(row.user.id)} />
                    </span>
                    <span className="w-full truncate text-[14px] font-bold">
                      {row.user.id === user?.id ? "You" : row.user.name.split(" ")[0]}
                    </span>
                    <span className="text-[16px] font-extrabold tabular">{formatDuration(row.sec)}</span>
                  </Link>
                  <span className="lb-plinth" aria-label={`Rank ${row.rank}`}>
                    {row.rank}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {list.length > 0 && (
            <ol className="panel lb-list" start={list[0].rank}>
              {list.map((row) => (
                <ListRow
                  key={row.user.id}
                  row={row}
                  topSec={topSec}
                  you={row.user.id === user?.id}
                  live={live.has(row.user.id)}
                  signedIn={!!user}
                  following={following.has(row.user.id)}
                />
              ))}
            </ol>
          )}
        </>
      )}
      <Pager page={page} hasNext={hasNext} href={(n) => `/dashboard/leaderboard?range=${range.id}&page=${n}`} />
    </div>
  );
}

function Standing({
  standing,
  period,
}: {
  standing: { rank: number | null; sec: number; gap: number | null; total: number };
  period: string;
}) {
  const { rank, sec, gap, total } = standing;
  return (
    <section className="lb-standing" aria-label="Your standing">
      {rank ? (
        <>
          <span className="lb-standing-rank">
            <span className="text-[11px] font-bold tracking-wider text-primary-text uppercase">You</span>
            <span className="text-[26px] leading-none font-extrabold tabular">#{rank}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold">
              {formatDuration(sec)} {period} <span className="font-semibold text-muted">· of {total}</span>
            </span>
            <span className="block text-[12.5px] font-semibold text-muted">
              {rank === 1
                ? "You’re on top. Keep it that way."
                : gap !== null
                  ? `${formatDuration(Math.max(gap, 60))} more to pass #${rank - 1}`
                  : ""}
            </span>
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">You’re not on the board {period === "all time" ? "yet" : period}</span>
          <span className="block text-[12.5px] font-semibold text-muted">One focused minute gets you on it.</span>
        </span>
      )}
      <Link href="/dashboard/timer" className={`${btnPrimary} h-10 shrink-0 text-sm`}>
        <Icon name="startFocus" size={15} solid /> {rank === 1 ? "Focus" : "Climb"}
      </Link>
    </section>
  );
}

function ListRow({
  row,
  topSec,
  you,
  live,
  signedIn,
  following,
}: {
  row: Row;
  topSec: number;
  you: boolean;
  live: boolean;
  signedIn: boolean;
  following: boolean;
}) {
  return (
    <li className="lb-row" data-you={you || undefined}>
      <span className="lb-rank tabular">{row.rank}</span>
      <Link href={`/dashboard/u/${row.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={row.user.name} src={row.user.avatar} size={38} live={live} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-bold">{row.user.name}</span>
            {you && <span className="lb-you">You</span>}
          </span>
          <span className="lb-bar" aria-hidden>
            <span style={{ width: `${Math.max(3, (row.sec / Math.max(topSec, 1)) * 100)}%` }} />
          </span>
        </span>
      </Link>
      <span className="w-[64px] text-right text-[14px] font-extrabold tabular">{formatDuration(row.sec)}</span>
      {!you && (
        <span className="hidden sm:block">
          <FollowButton userId={row.user.id} following={following} signedIn={signedIn} name={row.user.name} />
        </span>
      )}
      {you && <span className="hidden w-[92px] sm:block" />}
    </li>
  );
}
