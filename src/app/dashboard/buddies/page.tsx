import Link from "next/link";
import { Flame } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBuddies } from "@/lib/social-features";
import { Avatar, EmptyState, PageHeader, SectionTitle, btnPrimary } from "@/components/ui";
import { BuddyAction } from "@/components/buddy-actions";

export const metadata = { title: "Focus buddies" };

export default async function BuddiesPage() {
  const user = await requireUser("/dashboard/buddies");
  const { buddies, incoming, outgoing } = await getBuddies(user.id);

  return (
    <div className="mx-auto max-w-[680px] lg:pt-6">
      <PageHeader title="Focus buddies" subtitle="Keep each other honest. See their streak and live status, and nudge them to lock in." />

      {incoming.length > 0 && (
        <>
          <SectionTitle>Requests</SectionTitle>
          <ul className="panel divide-y divide-border/60">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={r.user.name} src={r.user.avatar} size={40} />
                <Link href={`/dashboard/u/${r.user.username}`} className="min-w-0 flex-1 truncate font-bold">
                  {r.user.name}
                </Link>
                <BuddyAction kind="accept" id={r.id} />
                <BuddyAction kind="remove" id={r.id} label="Decline" />
              </li>
            ))}
          </ul>
        </>
      )}

      {buddies.length === 0 && incoming.length === 0 ? (
        <EmptyState
          title="No buddies yet"
          body="Open someone’s profile and send a buddy request."
          action={
            <Link href="/dashboard/people" className={`${btnPrimary} h-10 text-sm`}>
              Find people
            </Link>
          }
        />
      ) : (
        buddies.length > 0 && (
          <>
            <SectionTitle>Your buddies</SectionTitle>
            <ul className="panel divide-y divide-border/60">
              {buddies.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={b.user.name} src={b.user.avatar} size={44} live={b.live} />
                  <Link href={`/dashboard/u/${b.user.username}`} className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{b.user.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {b.live ? `Focusing now${b.label ? ` · ${b.label}` : ""}` : "Not focusing"}
                    </span>
                  </Link>
                  <span className="flex items-center gap-1 text-sm font-bold text-streak tabular">
                    <Flame className="size-4" fill="currentColor" aria-hidden />
                    <span className="sr-only">Streak</span>
                    {b.streak}d
                  </span>
                  <div className="flex w-full justify-end gap-2 sm:w-auto">
                    <BuddyAction kind="nudge" id={b.user.id} disabled={b.live} />
                    <BuddyAction kind="remove" id={b.id} label="Remove" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {outgoing.length > 0 && (
        <>
          <SectionTitle>Waiting on</SectionTitle>
          <ul className="panel divide-y divide-border/60">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={r.user.name} src={r.user.avatar} size={40} />
                <span className="min-w-0 flex-1 truncate font-bold">{r.user.name}</span>
                <BuddyAction kind="remove" id={r.id} label="Cancel" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
