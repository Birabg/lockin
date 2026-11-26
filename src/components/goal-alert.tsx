"use client";

import { useEffect } from "react";
import type { ActiveSession } from "@/app/actions/focus";
import { playChime } from "@/lib/dial-sound";
import { formatDuration } from "@/lib/time";
import {
  GOAL_PROMPT_SEC,
  activeSeconds,
  planSeconds,
  pomodoroOf,
  pomodoroPhase,
  sessionTiming,
  type Pomodoro,
} from "@/lib/session-math";

const RUNG_KEY = "lockin-goal-rung";

/** True the first time it's asked about this moment, so a refresh or a second tab doesn't ring again. */
function firstToRing(key: string) {
  try {
    if (localStorage.getItem(RUNG_KEY) === key) return false;
    localStorage.setItem(RUNG_KEY, key);
  } catch {
    // with storage blocked, a refresh can ring twice, which beats not ringing
  }
  return true;
}

function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    // Android Chrome only allows notifications from a service worker, and the chime still plays
  }
}

/** What a Pomodoro says as a phase ends: `at` is the running second the new phase starts. */
function pomodoroMessage(p: Pomodoro, at: number): [string, string] {
  const next = pomodoroPhase(p, at);
  if (next.kind === "focus") {
    const of = next.round <= p.rounds ? ` of ${p.rounds}` : "";
    return ["Back to focus 🍅", `Round ${next.round}${of}: ${formatDuration(p.workMin * 60)}.`];
  }
  const long = next.kind === "long";
  return [long ? "Long break ☕" : "Break time ☕", `Round ${next.round} done. Rest for ${formatDuration(next.length)}.`];
}

/**
 * Lives in the dashboard layout, so it still rings if you've left the timer for another page:
 * at the goal, and on a Pomodoro as each focus round and break ends.
 */
export function GoalAlert({ session }: { session: ActiveSession | null }) {
  const id = session?.id;
  const startedAt = session?.startedAt;
  const goalMin = session?.goalMin;
  const pausedSec = session?.pausedSec;
  const pausedAt = session?.pausedAt;
  const workMin = session?.workMin ?? null;
  const breakMin = session?.breakMin ?? null;
  const longBreakMin = session?.longBreakMin ?? null;
  const rounds = session?.rounds ?? null;

  useEffect(() => {
    if (!id || !startedAt || goalMin === undefined || pausedSec === undefined || pausedAt) return;
    const plan = { goalMin, workMin, breakMin, longBreakMin, rounds };
    const timing = sessionTiming({ startedAt, pausedSec, pausedAt: null, ...plan });
    const pomo = pomodoroOf(plan);
    const goalAt = planSeconds(plan); // running seconds when the goal lands
    const running = () => activeSeconds(timing, new Date());
    let timer: ReturnType<typeof setTimeout> | undefined;

    /** The next moment to ring at, in running seconds: the goal, or for a Pomodoro the end of the current phase. */
    function nextAt(t: number) {
      if (!pomo) return goalAt;
      const phase = pomodoroPhase(pomo, t);
      return t - phase.into + phase.length;
    }

    function ring(at: number) {
      if (at === goalAt) {
        if (!firstToRing(id!)) return;
        playChime();
        const done = formatDuration(goalMin! * 60);
        if (pomo) notify("All rounds done 🎯", `${pomo.rounds} rounds, ${done} of focus. Keep going or wrap up.`);
        else notify("Goal reached 🎯", `You hit ${done}. Keep going or wrap up.`);
        return;
      }
      if (!pomo || !firstToRing(`${id}:${at}`)) return;
      playChime();
      notify(...pomodoroMessage(pomo, at));
    }

    // rings at each moment as it comes. A moment that has just passed (a timer held back by a sleeping
    // phone) still rings, but not one long gone, so reopening a laptop doesn't play a backlog.
    let pending = nextAt(running());
    function check() {
      const t = running();
      if (t >= pending) {
        if (t - pending < GOAL_PROMPT_SEC) ring(pending);
        pending = nextAt(t);
      }
      // a plain timer has one moment, the goal
      if (!pomo && t >= goalAt) return;
      clearTimeout(timer);
      timer = setTimeout(check, Math.max(0, pending - t) * 1000 + 50);
    }
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [id, startedAt, goalMin, pausedSec, pausedAt, workMin, breakMin, longBreakMin, rounds]);

  return null;
}
