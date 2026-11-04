import Link from "next/link";
import { ChevronRight, Crown, Flame, Medal, Radio } from "lucide-react";
import { Avatar } from "./ui";
import { formatDuration } from "@/lib/time";
import type { WeekDay } from "@/lib/queries";
import { brand } from "@/lib/brand";

export function StreakCard({ streak, todaySec, goalMin, week }: { streak: number; todaySec: number; goalMin: number; week: WeekDay[] }) {
  return (
    <section className="panel p-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-xl ${streak > 0 ? "bg-streak-bg text-streak" : "bg-inset text-subtle"}`}>
          <Flame className="size-5" fill={streak > 0 ? "currentColor" : "none"} />
        </span>
        <div>
          <p className="text-lg leading-tight font-extrabold">
            {streak} <span className="text-sm font-semibold text-muted">day streak</span>
          </p>
          <p className="text-xs text-muted tabular">
            Today {formatDuration(todaySec)} / {formatDuration(goalMin * 60)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5">
            <span
              title={`${d.key}: ${formatDuration(d.sec)}`}
              className={`aspect-square w-full rounded-lg border ${
                d.hit
                  ? "border-transparent bg-primary"
                  : d.sec > 0
                    ? "border-primary/40 bg-primary-light"
                    : d.isToday
                      ? "border-dashed border-muted bg-inset"
                      : "border-border bg-inset"
              } ${d.isFuture ? "opacity-40" : ""}`}
            />
            <span className={`text-[11px] font-bold ${d.isToday ? "text-foreground" : "text-subtle"}`}>{d.letter}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type LiveSession = { label: string | null; user: { id: string; username: string; name: string } };

export function FocusingNowCard({ count, sessions }: { count: number; sessions: LiveSession[] }) {
  return (
    <Link href="/dashboard/focusing" className="panel block p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-inset text-live">
          <Radio className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-bold">Focusing now</p>
          <p className="text-xs text-muted">
            {count === 0 ? "Nobody yet — be the first" : `${count} ${count === 1 ? "person" : "people"} in a session`}
          </p>
        </div>
        <ChevronRight className="size-4 text-subtle" />
      </div>
      {sessions.length > 0 && (
        <div className="mt-3 flex -space-x-1.5 overflow-hidden">
          {sessions.slice(0, 9).map((s) => (
            <span key={s.user.id} className="rounded-full ring-2 ring-card">
              <Avatar name={s.user.name} size={32} live />
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="size-4 text-gold" fill="currentColor" />;
  if (rank === 2) return <Medal className="size-4 text-silver" />;
  if (rank === 3) return <Medal className="size-4 text-bronze" />;
  return <span className="w-4 text-center text-xs font-bold text-subtle tabular">{rank}</span>;
}

type Row = { rank: number; sec: number; user: { id: string; username: string; name: string } };

export function LeaderboardCard({ rows }: { rows: Row[] }) {
  return (
    <section className="panel p-4">
      <Link href="/dashboard/leaderboard" className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-inset text-gold">
          <Crown className="size-5" />
        </span>
        <p className="flex-1 font-bold">Today’s leaderboard</p>
        <ChevronRight className="size-4 text-subtle" />
      </Link>
      <ul className="mt-3 flex flex-col gap-1">
        {rows.length === 0 && <li className="py-2 text-sm text-muted">No focus logged today yet.</li>}
        {rows.map((r) => (
          <li key={r.user.id}>
            <Link href={`/dashboard/u/${r.user.username}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-inset">
              <RankIcon rank={r.rank} />
              <Avatar name={r.user.name} size={28} />
              <span className="flex-1 truncate text-sm font-semibold">{r.user.name}</span>
              <span className="text-xs text-muted tabular">{formatDuration(r.sec)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuestBanner({ next = "/dashboard" }: { next?: string }) {
  return (
    <div className="panel flex items-center gap-3 p-3 pl-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
        <Flame className="size-[18px]" />
      </span>
      <p className="flex-1 text-[15px] font-bold">{brand.tagline} Start free.</p>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="hidden px-3 text-sm font-semibold text-muted hover:text-foreground sm:block"
      >
        Sign in
      </Link>
      <Link href="/signup" className="btn-3d rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
        Join free
      </Link>
    </div>
  );
}
