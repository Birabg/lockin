import Link from "next/link";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { formatDuration } from "@/lib/time";
import type { WeekDay } from "@/lib/queries";
import { brand } from "@/lib/brand";

const railTitle = "text-[14.5px] leading-[21.75px] font-semibold tracking-[-0.025em]";

export function StreakCard({ streak, todaySec, goalMin, week }: { streak: number; todaySec: number; goalMin: number; week: WeekDay[] }) {
  return (
    <section className="panel p-3.5">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-10 place-items-center rounded-xl ${streak > 0 ? "bg-streak-bg text-streak" : "bg-inset text-subtle"}`}>
          <Icon name="streak" size={22} solid={streak > 0} className={streak > 0 ? "streak-glow" : ""} />
        </span>
        <div>
          <p className="text-[18px] leading-[18px] font-extrabold tracking-[-0.45px]">
            {streak} <span className="text-[12.5px] font-bold tracking-normal text-muted">day streak</span>
          </p>
          <p className="mt-1 text-[12.5px] leading-[18.75px] text-muted tabular-nums">
            Today {formatDuration(todaySec)} / {formatDuration(goalMin * 60)}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 border-t border-border/50 pt-2.5">
        {week.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1">
            <span
              title={`${d.key}: ${formatDuration(d.sec)}`}
              className={`h-[30px] w-full rounded-xl border ${
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

type LiveSession = { label: string | null; user: { id: string; username: string; name: string; avatar: string | null } };

export function FocusingNowCard({ count, sessions }: { count: number; sessions: LiveSession[] }) {
  return (
    <Link href="/dashboard/focusing" className="panel block p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-inset text-live">
          <Icon name="focusingNow" size={20} />
        </span>
        <div className="flex-1">
          <p className={railTitle}>Focusing now</p>
          <p className="text-[12.5px] leading-[18.75px] text-muted">
            {count === 0 ? "Nobody yet — be the first" : `${count} ${count === 1 ? "person" : "people"} in a session`}
          </p>
        </div>
        <Icon name="chevron" size={16} className="text-subtle" />
      </div>
      {sessions.length > 0 && (
        <div className="mt-3 flex -space-x-1.5 overflow-hidden">
          {sessions.slice(0, 9).map((s) => (
            <span key={s.user.id} className="rounded-full ring-2 ring-card">
              <Avatar name={s.user.name} src={s.user.avatar} size={32} live />
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Icon name="crown" size={18} solid className="text-gold" />;
  if (rank === 2) return <Icon name="medal" size={18} className="text-silver" />;
  if (rank === 3) return <Icon name="medal" size={18} className="text-bronze" />;
  return <span className="w-[18px] text-center text-xs font-bold text-subtle tabular">{rank}</span>;
}

type Row = { rank: number; sec: number; user: { id: string; username: string; name: string; avatar: string | null } };

export function LeaderboardCard({ rows }: { rows: Row[] }) {
  return (
    <section className="panel p-3.5">
      <Link href="/dashboard/leaderboard" className="flex items-center gap-2.5 border-b border-border/50 pb-2.5">
        <span className="grid size-8 place-items-center rounded-xl bg-inset text-gold">
          <Icon name="crown" size={18} />
        </span>
        <p className={`${railTitle} flex-1`}>Today’s leaderboard</p>
        <Icon name="chevron" size={16} className="text-subtle" />
      </Link>
      <ul className="-mx-1.5 mt-1 flex flex-col">
        {rows.length === 0 && <li className="px-1.5 py-2 text-[13.5px] text-muted">No focus logged today yet.</li>}
        {rows.map((r) => (
          <li key={r.user.id}>
            <Link href={`/dashboard/u/${r.user.username}`} className="flex h-11 items-center gap-2.5 rounded-2xl p-1.5 hover:bg-inset">
              <RankIcon rank={r.rank} />
              <Avatar name={r.user.name} src={r.user.avatar} size={32} />
              <span className="flex-1 truncate text-[13.5px] leading-[20.25px] font-semibold tracking-[-0.025em]">{r.user.name}</span>
              <span className="text-[12.5px] leading-[18.75px] text-muted tabular">{formatDuration(r.sec)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GuestBanner({ next = "/dashboard" }: { next?: string }) {
  return (
    <div className="panel flex items-center gap-3 px-3.5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
        <Icon name="streak" size={20} solid />
      </span>
      <p className="flex-1 text-sm font-bold">{brand.tagline} Start free.</p>
      <Link
        href={`/login?next=${encodeURIComponent(next)}`}
        className="hidden px-3 text-[12.5px] font-semibold text-muted hover:text-foreground sm:block"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="btn-3d flex h-9 items-center rounded-full bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground"
      >
        Join free
      </Link>
    </div>
  );
}
