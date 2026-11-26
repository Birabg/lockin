"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { activeSeconds, pomodoroOf, pomodoroPhase, remainingSeconds, sessionTiming, type Plan } from "@/lib/session-math";
import { formatDuration } from "@/lib/time";

type Session = {
  label: string | null;
  goalMin: number;
  remaining: number;
  timing: Plan & { startedAt: string; pausedSec: number; pausedAt: string | null };
  user: { id: string; username: string; name: string; avatar: string | null };
};

const R = 27;
const C = 2 * Math.PI * R;

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Everyone's session, counting down live until the next refresh. A Pomodoro's clock holds still through its breaks. */
export function FocusingGrid({ sessions, viewerId, serverNow }: { sessions: Session[]; viewerId: string | null; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // you first, then in the order they started
  const ordered = [...sessions].sort((a, b) => Number(b.user.id === viewerId) - Number(a.user.id === viewerId));

  return (
    <ul className="focus-grid" aria-label="People locked in">
      {ordered.map((s) => {
        const goal = s.goalMin * 60;
        const timing = sessionTiming(s.timing);
        const remaining = remainingSeconds(timing, new Date(now));
        const pomo = pomodoroOf(timing);
        const onBreak = !!pomo && pomodoroPhase(pomo, activeSeconds(timing, new Date(now))).kind !== "focus";
        const over = remaining <= 0;
        const progress = Math.min(1, Math.max(0, 1 - remaining / goal));
        const you = s.user.id === viewerId;
        return (
          <li key={s.user.id}>
            <Link
              href={`/dashboard/u/${s.user.username}`}
              className="panel focus-card"
              data-you={you || undefined}
              data-over={over || undefined}
            >
              <span className="focus-ring">
                <svg viewBox="0 0 60 60" aria-hidden>
                  <circle cx="30" cy="30" r={R} className="focus-ring-track" />
                  <circle cx="30" cy="30" r={R} className="focus-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
                </svg>
                <Avatar name={s.user.name} src={s.user.avatar} size={44} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{you ? "You" : s.user.name}</span>
                <span className="focus-label">{onBreak ? "On a break" : (s.label ?? "Deep work")}</span>
              </span>
              <span className="shrink-0 text-right">
                <span
                  className="focus-clock tabular"
                  aria-label={over ? "Goal reached" : `${formatDuration(Math.ceil(remaining / 60) * 60)} left`}
                >
                  {over ? `+${clock(-remaining)}` : clock(remaining)}
                </span>
                <span className="block text-[11px] font-semibold text-subtle">
                  {over ? "past goal" : `left of ${formatDuration(goal)}`}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
