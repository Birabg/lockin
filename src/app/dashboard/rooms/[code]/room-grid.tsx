"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, ClockDigits, GoalRing } from "@/components/ui";
import { remainingSeconds, sessionTiming } from "@/lib/session-math";
import type { RoomView } from "@/lib/social-features";
import { formatCountdown, formatDuration } from "@/lib/time";

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
        const left = session ? remainingSeconds(sessionTiming(session), new Date(now)) : 0;
        const over = !!session && left <= 0;
        return (
          <li key={user.id} className="panel flex flex-col items-center gap-3 p-4 text-center">
            <Link href={`/dashboard/u/${user.username}`} className="flex items-center gap-2 font-bold">
              <Avatar name={user.name} src={user.avatar} size={28} live={!!session && !session.pausedAt} />
              <span className="truncate">{user.name}</span>
            </Link>
            <GoalRing pct={session ? (over ? 1 : left / (session.goalMin * 60)) : 0} size={116} stroke={8} drain glow={over}>
              <span className={`text-lg font-extrabold tabular ${over ? "text-streak" : ""}`}>
                {session ? <ClockDigits value={over ? `+${formatCountdown(-left)}` : formatCountdown(left)} /> : "—"}
              </span>
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
