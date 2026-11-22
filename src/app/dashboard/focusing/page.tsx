import "./focusing.css";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getFocusingNow } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { PageHeader, btnPrimary } from "@/components/ui";
import { Icon } from "@/components/icon";
import { AutoRefresh } from "@/components/auto-refresh";
import { FocusingGrid } from "./focusing-grid";

export const metadata = { title: "Focusing now" };
export const dynamic = "force-dynamic";

export default async function FocusingPage() {
  const viewer = await getCurrentUser();
  const { count, sessions } = await getFocusingNow(200, viewer?.id ?? null);
  const youIn = !!viewer && sessions.some((s) => s.user.id === viewer.id);
  // time already put in across everyone's current sessions
  const together = sessions.reduce((sum, s) => sum + Math.max(0, s.goalMin * 60 - s.remaining), 0);

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="Focusing now" />
      <AutoRefresh seconds={20} />

      <header className="focus-hero">
        <span className="focus-live" data-quiet={count === 0 || undefined}>
          <span className="focus-live-dot" aria-hidden />
          {count === 0 ? "Quiet right now" : "Live"}
        </span>
        <h1 className="mt-3 text-[26px] leading-tight font-extrabold tracking-tight">
          {count === 0 ? (
            "Nobody is focusing yet"
          ) : (
            <>
              <span className="tabular">{count}</span> {count === 1 ? "person is" : "people are"} locked in
            </>
          )}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-muted">
          {count === 0
            ? "Start a session and you’ll be the first one here. Others see you while you focus."
            : `${formatDuration(together)} focused together so far in these sessions.`}
        </p>
        {!youIn && (
          <Link href="/dashboard/timer" className={`${btnPrimary} mt-4 h-10 text-sm`}>
            <Icon name="startFocus" size={15} solid /> {count === 0 ? "Start focusing" : "Join them"}
          </Link>
        )}
      </header>

      {sessions.length > 0 && <FocusingGrid sessions={sessions} viewerId={viewer?.id ?? null} serverNow={Date.now()} />}
    </div>
  );
}
