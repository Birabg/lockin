import Link from "next/link";
import { getFocusingNow } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { Avatar, EmptyState, PageHeader, btnPrimary } from "@/components/ui";

export const metadata = { title: "Focusing now" };
export const dynamic = "force-dynamic";

export default async function FocusingPage() {
  const { count, sessions } = await getFocusingNow(200);
  const now = Date.now();
  return (
    <div className="mx-auto max-w-[720px] lg:pt-6">
      <PageHeader title="Focusing now" subtitle={`${count} ${count === 1 ? "person is" : "people are"} in a session right now.`} />
      {sessions.length === 0 ? (
        <EmptyState
          title="It’s quiet"
          body="Nobody is focusing at the moment. Start a session and others will see you here."
          action={<Link href="/dashboard/timer" className={`${btnPrimary} h-10 text-sm`}>Start focus</Link>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => {
            const sec = Math.round((now - s.startedAt.getTime()) / 1000);
            return (
              <li key={s.user.id}>
                <Link href={`/dashboard/u/${s.user.username}`} className="panel flex items-center gap-3 p-4 hover:border-primary/40">
                  <Avatar name={s.user.name} size={44} live />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.user.name}</span>
                    <span className="block truncate text-xs text-muted">{s.label ?? "Deep work"}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-extrabold tabular">{formatDuration(sec)}</span>
                    <span className="block text-[11px] text-subtle">of {formatDuration(s.goalMin * 60)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
