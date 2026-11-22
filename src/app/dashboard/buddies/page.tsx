import "./buddies.css";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { requireUser } from "@/lib/auth";
import { getBuddies } from "@/lib/social-features";
import { formatDuration } from "@/lib/time";
import { Avatar, PageHeader, btnPrimary } from "@/components/ui";
import { BuddyAction, BuddyMenu, NudgeButton } from "@/components/buddy-actions";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Focus buddies" };

const PERKS: { icon: IconName; title: string; body: string }[] = [
  { icon: "focusingNow", title: "See them live", body: "Know the moment your buddy sits down to focus." },
  { icon: "streak", title: "Streaks side by side", body: "Nobody wants to be the one who breaks the chain." },
  { icon: "notifications", title: "Nudge each other", body: "One tap tells them it’s time to lock in." },
];

export default async function BuddiesPage() {
  const user = await requireUser("/dashboard/buddies");
  const { buddies, incoming, outgoing } = await getBuddies(user.id);
  const live = buddies.filter((b) => b.live).length;

  return (
    <div className="mx-auto max-w-[760px]">
      <AutoRefresh seconds={30} />
      <PageHeader title="Focus buddies" />

      {(buddies.length > 0 || incoming.length > 0) && (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">Focus buddies</h1>
            <p className="mt-1 text-[13px] text-muted">Keep each other honest. Nudge a buddy when they’ve gone quiet.</p>
          </div>
          {buddies.length > 0 && (
            <p className={`flex items-center gap-1.5 text-[13px] font-bold ${live ? "text-live" : "text-subtle"}`}>
              {live > 0 && <span className="buddies-live-dot" aria-hidden />}
              {live > 0 ? `${live} of ${buddies.length} focusing now` : `${buddies.length} ${buddies.length === 1 ? "buddy" : "buddies"}`}
            </p>
          )}
        </header>
      )}

      {incoming.length > 0 && (
        <section className="panel buddies-requests" aria-labelledby="buddy-requests">
          <h2 id="buddy-requests" className="mb-2 flex items-center gap-2 text-[14px] font-bold">
            Buddy requests <span className="buddies-count">{incoming.length}</span>
          </h2>
          <ul className="flex flex-col gap-1">
            {incoming.map((r) => (
              <li key={r.id} className="buddies-request">
                <Link href={`/dashboard/u/${r.user.username}`} className="flex min-w-0 flex-[1_1_220px] items-center gap-3">
                  <Avatar name={r.user.name} src={r.user.avatar} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{r.user.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">wants to be your focus buddy</span>
                  </span>
                </Link>
                <span className="ml-auto flex shrink-0 gap-2">
                  <BuddyAction kind="remove" id={r.id} label="Decline" />
                  <BuddyAction kind="accept" id={r.id} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {buddies.length === 0 && incoming.length === 0 ? (
        <section className="panel buddies-empty">
          <span className="buddies-empty-icon">
            <Icon name="buddies" size={26} />
          </span>
          <h1 className="text-[20px] font-extrabold tracking-tight">Focus is easier with a buddy</h1>
          <p className="max-w-[380px] text-[13.5px] text-muted">
            Pair up with a friend to keep each other going. Send a request from anyone’s profile.
          </p>
          <ul className="buddies-perks">
            {PERKS.map((p) => (
              <li key={p.title} className="buddies-perk">
                <span className="buddies-perk-icon">
                  <Icon name={p.icon} size={18} />
                </span>
                <span className="text-[13.5px] font-bold">{p.title}</span>
                <span className="text-[12.5px] leading-snug text-muted">{p.body}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/people" className={`${btnPrimary} mt-1 h-11 text-sm`}>
            <Icon name="people" size={17} /> Find a buddy
          </Link>
        </section>
      ) : (
        buddies.length > 0 && (
          <ul className="buddies-grid">
            {buddies.map((b) => (
              <li key={b.id} className="panel buddy-card" data-live={b.live || undefined}>
                <div className="flex items-start gap-3">
                  <Link href={`/dashboard/u/${b.user.username}`} className="buddy-avatar" aria-label={`${b.user.name}’s profile`}>
                    <Avatar name={b.user.name} src={b.user.avatar} size={52} />
                    {b.live && <span className="buddy-avatar-live" aria-hidden />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/u/${b.user.username}`} className="block truncate text-[15.5px] font-bold hover:underline">
                      {b.user.name}
                    </Link>
                    <p className={`truncate text-[12.5px] font-semibold ${b.live ? "text-live" : "text-subtle"}`}>
                      {b.live ? `Focusing now${b.label ? ` · ${b.label}` : ""}` : `@${b.user.username}`}
                    </p>
                  </div>
                  <BuddyMenu id={b.id} name={b.user.name} username={b.user.username} />
                </div>

                <dl className="buddy-stats">
                  <div className="buddy-stat">
                    <dt>Streak</dt>
                    <dd className={b.streak > 0 ? "text-streak" : "text-subtle"}>
                      <Icon name="streak" size={16} solid={b.streak > 0} className={b.streak > 0 ? "streak-glow" : ""} />
                      {b.streak} {b.streak === 1 ? "day" : "days"}
                    </dd>
                  </div>
                  <div className="buddy-stat">
                    <dt>Today</dt>
                    <dd className={b.todaySec >= 60 ? "" : "text-subtle"}>
                      <Icon name="time" size={16} />
                      {b.todaySec >= 60 ? formatDuration(b.todaySec) : "Not yet"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex justify-end">
                  <NudgeButton userId={b.user.id} name={b.user.name} live={b.live} />
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {outgoing.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 px-1 text-[13px] font-bold text-muted">
            Waiting on <span className="text-subtle tabular">· {outgoing.length}</span>
          </h2>
          <ul className="panel buddies-waiting">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/dashboard/u/${r.user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.user.name} src={r.user.avatar} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold">{r.user.name}</span>
                    <span className="block text-[12px] text-subtle">Request sent</span>
                  </span>
                </Link>
                <BuddyAction kind="remove" id={r.id} label="Cancel" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
