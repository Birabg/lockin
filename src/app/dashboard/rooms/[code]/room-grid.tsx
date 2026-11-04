"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, GoalRing } from "@/components/ui";
import { activeSeconds } from "@/lib/session-math";
import type { RoomView } from "@/lib/social-features";
import { formatDuration, formatTimer } from "@/lib/time";

type Session = NonNullable<RoomView["members"][number]["session"]>;

const elapsed = (s: Session, now: number) =>
  activeSeconds(
    { startedAt: new Date(s.startedAt), pausedSec: s.pausedSec, pausedAt: s.pausedAt ? new Date(s.pausedAt) : null },
    new Date(now),
  );

export function RoomGrid({ members, serverNow }: { members: RoomView["members"]; serverNow: number }) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map(({ user, session }) => {
        const sec = session ? elapsed(session, now) : 0;
        return (
          <li key={user.id} className="panel flex flex-col items-center gap-3 p-4 text-center">
            <Link href={`/dashboard/u/${user.username}`} className="flex items-center gap-2 font-bold">
              <Avatar name={user.name} src={user.avatar} size={28} live={!!session && !session.pausedAt} />
              <span className="truncate">{user.name}</span>
            </Link>
            <GoalRing pct={session ? sec / (session.goalMin * 60) : 0} size={116} stroke={8}>
              <span className="text-lg font-extrabold tabular">{session ? formatTimer(sec) : "—"}</span>
            </GoalRing>
            <p className="min-h-4 truncate text-xs text-muted">
              {!session
                ? "Not focusing"
                : session.pausedAt
                  ? "Paused"
                  : `${session.label ?? "Deep work"} · ${formatDuration(session.goalMin * 60)} goal`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
