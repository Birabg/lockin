"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, ClockDigits, GoalRing, btnPrimary } from "@/components/ui";
import { Icon } from "@/components/icon";
import { remainingSeconds, sessionTiming } from "@/lib/session-math";
import type { RoomView } from "@/lib/social-features";
import { formatCountdown, formatDuration } from "@/lib/time";

type Member = RoomView["members"][number];

/**
 * Everyone in the room. People with a timer running get a big ring that counts down live; everyone else
 * is a small chip underneath, so the eye goes to who's actually working.
 */
export function RoomGrid({ members, serverNow, viewerId }: { members: Member[]; serverNow: number; viewerId: string }) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = (m: Member) => (m.session ? remainingSeconds(sessionTiming(m.session), new Date(now)) : 0);
  // running first (soonest to finish first), then paused; you lead your own group
  const active = members
    .filter((m) => m.session)
    .sort(
      (a, b) =>
        Number(!!a.session?.pausedAt) - Number(!!b.session?.pausedAt) ||
        Number(b.user.id === viewerId) - Number(a.user.id === viewerId) ||
        left(a) - left(b),
    );
  const idle = members.filter((m) => !m.session).sort((a, b) => Number(b.user.id === viewerId) - Number(a.user.id === viewerId));
  const viewerIdle = idle.some((m) => m.user.id === viewerId);

  return (
    <>
      {active.length === 0 ? (
        <section className="panel room-quiet">
          <span className="room-quiet-icon">
            <Icon name="time" size={22} />
          </span>
          <p className="text-[15px] font-bold">Nobody’s focusing yet</p>
          <p className="max-w-[320px] text-[13px] text-muted">Start a session and it shows up here for everyone in the room.</p>
          <Link href="/dashboard/timer" className={`${btnPrimary} mt-2 h-10 text-sm`}>
            <Icon name="startFocus" size={16} solid /> Start focusing
          </Link>
        </section>
      ) : (
        <ul className="room-grid">
          {active.map((m) => {
            const { user, session } = m;
            if (!session) return null;
            const l = left(m);
            const over = l <= 0;
            const paused = !!session.pausedAt;
            const you = user.id === viewerId;
            return (
              <li key={user.id} className="panel room-card" data-paused={paused || undefined} data-you={you || undefined}>
                <Link href={`/dashboard/u/${user.username}`} className="flex max-w-full items-center gap-2">
                  <Avatar name={user.name} src={user.avatar} size={26} live={!paused} />
                  <span className="truncate text-[14px] font-bold">{user.name}</span>
                  {you && <span className="room-you">You</span>}
                </Link>
                <GoalRing
                  pct={over ? 1 : l / (session.goalMin * 60)}
                  size={128}
                  stroke={8}
                  drain
                  glow={over}
                  color={paused ? "var(--subtle-foreground)" : over ? "var(--streak)" : "var(--primary)"}
                >
                  <span className="flex flex-col items-center">
                    <span className={`text-[22px] leading-none font-extrabold tabular ${over ? "text-streak" : ""}`}>
                      <ClockDigits value={over ? `+${formatCountdown(-l)}` : formatCountdown(l)} />
                    </span>
                    <span className="mt-1 text-[10.5px] font-bold tracking-wider text-subtle uppercase">
                      {paused ? "Paused" : over ? "Over goal" : "left"}
                    </span>
                  </span>
                </GoalRing>
                <p className="w-full truncate text-[12.5px] font-semibold text-muted">
                  {session.label ?? "Deep work"} <span className="text-subtle">· {formatDuration(session.goalMin * 60)} goal</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {idle.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2.5 px-1 text-[13px] font-bold text-muted">
            Not focusing <span className="text-subtle tabular">· {idle.length}</span>
          </h2>
          <ul className="room-idle">
            {idle.map(({ user }) => (
              <li key={user.id}>
                <Link href={`/dashboard/u/${user.username}`} className="room-idle-chip">
                  <Avatar name={user.name} src={user.avatar} size={28} />
                  <span className="truncate">{user.name}</span>
                  {user.id === viewerId && <span className="room-you">You</span>}
                </Link>
              </li>
            ))}
          </ul>
          {viewerIdle && active.length > 0 && (
            <Link href="/dashboard/timer" className={`${btnPrimary} mt-4 h-11 w-full text-sm sm:w-auto`}>
              <Icon name="startFocus" size={16} solid /> Join in, start focusing
            </Link>
          )}
        </section>
      )}
    </>
  );
}
