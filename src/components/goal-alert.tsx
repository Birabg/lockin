"use client";

import { useEffect } from "react";
import type { ActiveSession } from "@/app/actions/focus";
import { playChime } from "@/lib/dial-sound";
import { formatDuration } from "@/lib/time";
import { GOAL_PROMPT_SEC, remainingSeconds, sessionTiming } from "@/lib/session-math";

const RUNG_KEY = "lockin-goal-rung";

/** True the first time it's asked about a session, so a refresh or a second tab doesn't ring again. */
function firstToRing(sessionId: string) {
  try {
    if (localStorage.getItem(RUNG_KEY) === sessionId) return false;
    localStorage.setItem(RUNG_KEY, sessionId);
  } catch {
    // with storage blocked, a refresh can ring twice, which beats not ringing
  }
  return true;
}

function notifyGoal(goalMin: number) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Goal reached 🎯", { body: `You hit ${formatDuration(goalMin * 60)}. Keep going or wrap up.` });
  } catch {
    // Android Chrome only allows notifications from a service worker, and the chime still plays
  }
}

/** Lives in the dashboard layout, so the goal still rings if you've left the timer for another page. */
export function GoalAlert({ session }: { session: ActiveSession | null }) {
  const id = session?.id;
  const startedAt = session?.startedAt;
  const goalMin = session?.goalMin;
  const pausedSec = session?.pausedSec;
  const pausedAt = session?.pausedAt;

  useEffect(() => {
    if (!id || !startedAt || goalMin === undefined || pausedSec === undefined || pausedAt) return;
    const timing = sessionTiming({ startedAt, goalMin, pausedSec, pausedAt: null });
    const left = () => remainingSeconds(timing, new Date());

    function ring() {
      if (left() > 0 || left() <= -GOAL_PROMPT_SEC || !firstToRing(id!)) return;
      playChime();
      notifyGoal(goalMin!);
    }

    const timer = setTimeout(ring, Math.max(0, left()) * 1000);
    // a sleeping phone holds timers back, so check again on waking
    document.addEventListener("visibilitychange", ring);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", ring);
    };
  }, [id, startedAt, goalMin, pausedSec, pausedAt]);

  return null;
}
