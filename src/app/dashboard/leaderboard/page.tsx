import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { parsePage } from "@/lib/page";
import { getLeaderboard, type Range } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { Avatar, EmptyState, PageHeader, Pager } from "@/components/ui";
import { RankIcon } from "@/components/rail";
import { FollowButton } from "@/components/follow-button";

export const metadata = { title: "Leaderboard" };

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All time" },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ range?: string; page?: string }> }) {
  const { range: r, page: p } = await searchParams;
  const page = parsePage(p);
  const range = RANGES.find((x) => x.id === r)?.id ?? "today";
  const user = await getCurrentUser();
  const { rows, hasNext } = await getLeaderboard(range, user?.timeZone ?? brand.timeZone, { page });
  const following = user
    ? new Set((await db.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } })).map((f) => f.followingId))
    : new Set<string>();
  const myRow = user ? rows.find((x) => x.user.id === user.id) : undefined;

  return (
    <div className="mx-auto max-w-[720px] lg:pt-6">
      <PageHeader title="Leaderboard" subtitle="Ranked by total focused time." />
      <div className="mb-4 flex rounded-full border border-border bg-card p-1">
        {RANGES.map((x) => (
          <Link
            key={x.id}
            href={`/dashboard/leaderboard?range=${x.id}`}
            className={`flex-1 rounded-full py-2 text-center text-sm font-bold ${range === x.id ? "bg-background" : "text-muted hover:text-foreground"}`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {myRow && (
        <div className="mb-3 flex items-center gap-3 rounded-[var(--radius)] border border-primary/40 bg-primary-light px-4 py-3">
          <span className="text-sm font-bold text-primary-text">You’re #{myRow.rank}</span>
          <span className="ml-auto text-sm font-bold tabular">{formatDuration(myRow.sec)}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No focus logged yet" body="Start a session and you’ll be first on the board." />
      ) : (
        <ol className="panel divide-y divide-border/60">
          {rows.map((row) => (
            <li key={row.user.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid w-6 place-items-center">
                <RankIcon rank={row.rank} />
              </span>
              <Link href={`/dashboard/u/${row.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={row.user.name} src={row.user.avatar} size={38} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{row.user.name}</span>
                  <span className="block truncate text-xs text-muted">@{row.user.username}</span>
                </span>
              </Link>
              <span className="text-sm font-extrabold tabular">{formatDuration(row.sec)}</span>
              {user?.id !== row.user.id && (
                <span className="hidden sm:block">
                  <FollowButton userId={row.user.id} following={following.has(row.user.id)} signedIn={!!user} />
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <Pager page={page} hasNext={hasNext} href={(n) => `/dashboard/leaderboard?range=${range}&page=${n}`} />
    </div>
  );
}
