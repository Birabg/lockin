import "./rooms.css";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyRooms } from "@/lib/social-features";
import { Avatar, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icon";
import { CopyButton } from "@/components/copy-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { RoomForms } from "./room-forms";

export const metadata = { title: "Live rooms" };

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "add", title: "Make a room", body: "Name it for what you’re doing: a class, a team, a study group." },
  { icon: "share", title: "Share the code", body: "Friends join with the 6-character code or the invite link." },
  { icon: "time", title: "Focus together", body: "Everyone’s timer shows live, so nobody slacks off alone." },
];

export default async function RoomsPage() {
  const user = await requireUser("/dashboard/rooms");
  const rooms = await getMyRooms(user.id);
  const liveTotal = rooms.reduce((a, r) => a + r.live, 0);

  return (
    <div className="mx-auto max-w-[760px]">
      <AutoRefresh seconds={30} />
      <PageHeader title="Live rooms" />

      <section className="panel rooms-hero">
        <div className="rooms-hero-copy">
          <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">Focus together</h1>
          <p className="mt-1 text-[13.5px] text-muted">Open a room, share the code, and see everyone’s timers tick live.</p>
        </div>
        <RoomForms />
      </section>

      <div className="mt-6 mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[15px] font-bold">
          Your rooms {rooms.length > 0 && <span className="text-subtle tabular">· {rooms.length}</span>}
        </h2>
        {liveTotal > 0 && (
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-live">
            <span className="rooms-live-dot" aria-hidden /> {liveTotal} focusing now
          </span>
        )}
      </div>

      {rooms.length === 0 ? (
        <section className="panel rooms-empty">
          <p className="text-[15px] font-bold">No rooms yet</p>
          <p className="mt-1 text-[13px] text-muted">Here’s how it works:</p>
          <ol className="rooms-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rooms-step">
                <span className="rooms-step-icon">
                  <Icon name={s.icon} size={18} />
                  <span className="rooms-step-n">{i + 1}</span>
                </span>
                <span className="text-[13.5px] font-bold">{s.title}</span>
                <span className="text-[12.5px] leading-snug text-muted">{s.body}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <ul className="rooms-grid">
          {rooms.map((r) => (
            <li key={r.id} className="panel rooms-card" data-live={r.live > 0 || undefined}>
              <Link href={`/dashboard/rooms/${r.code}`} className="rooms-card-link" aria-label={`Open ${r.name}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-[15.5px] font-bold">{r.name}</span>
                    {r.mine && <span className="rooms-badge">Yours</span>}
                  </p>
                  <p className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold ${r.live ? "text-live" : "text-subtle"}`}>
                    {r.live > 0 && <span className="rooms-live-dot" aria-hidden />}
                    {r.live > 0 ? `${r.live} focusing now` : "Quiet right now"}
                    <span className="text-subtle">
                      · {r.size} {r.size === 1 ? "member" : "members"}
                    </span>
                  </p>
                </div>
                <Icon name="chevron" size={18} className="mt-1 text-subtle" />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="rooms-faces" aria-label={`${r.size} ${r.size === 1 ? "member" : "members"}`}>
                  {r.faces.map((u) => (
                    <span key={u.id} className="rooms-face" data-live={u.live || undefined}>
                      <Avatar name={u.name} src={u.avatar} size={30} />
                    </span>
                  ))}
                  {r.size > r.faces.length && <span className="rooms-face-more tabular">+{r.size - r.faces.length}</span>}
                </span>
                <CopyButton text={r.code} label={`Copy room code ${r.code}`} className="rooms-code">
                  <span className="font-mono tracking-[0.12em]">{r.code}</span>
                </CopyButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
