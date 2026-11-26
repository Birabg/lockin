/** With no heartbeat for this long, time stops counting until the client checks back in. */
export const STALE_MS = 3 * 60_000;
/** "Focusing now" = active session with a heartbeat this recent. */
export const LIVE_MS = 90_000;
/** How long past its goal a silent session (locked phone, sleeping laptop) can still be picked back up. */
export const GRACE_MS = 10 * 60_000;
/** With no answer for this long after the goal, a session moves into overtime by itself. */
export const GOAL_PROMPT_SEC = 5 * 60;

type Timing = { startedAt: Date; pausedSec: number; pausedAt: Date | null };

/* ---------- Pomodoro ---------- */

/** A long break comes after every this many focus rounds. */
export const LONG_BREAK_EVERY = 4;

export type Pomodoro = { workMin: number; breakMin: number; longBreakMin: number; rounds: number };

/** The limits the setup screen and the server both hold a Pomodoro to. */
export const POMODORO_LIMITS = {
  workMin: { min: 5, max: 90, step: 5 },
  breakMin: { min: 1, max: 30, step: 1 },
  longBreakMin: { min: 5, max: 60, step: 5 },
  rounds: { min: 1, max: 12, step: 1 },
} as const satisfies Record<keyof Pomodoro, { min: number; max: number; step: number }>;

export const DEFAULT_POMODORO: Pomodoro = { workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4 };

/** Keeps each setting whole and inside its limits, falling back to the classic 25/5/15 × 4. */
export function clampPomodoro(p: Partial<Record<keyof Pomodoro, unknown>>): Pomodoro {
  const one = (key: keyof Pomodoro) => {
    const { min, max } = POMODORO_LIMITS[key];
    const raw = p[key];
    const n = typeof raw === "number" || typeof raw === "string" ? Math.round(Number(raw)) : NaN;
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : DEFAULT_POMODORO[key];
  };
  return { workMin: one("workMin"), breakMin: one("breakMin"), longBreakMin: one("longBreakMin"), rounds: one("rounds") };
}

/** A session's plan as stored on its row. The four Pomodoro columns are null on a plain timer. */
export type Plan = {
  goalMin: number;
  workMin?: number | null;
  breakMin?: number | null;
  longBreakMin?: number | null;
  rounds?: number | null;
};

/** Just the Pomodoro columns: enough to tell focus from breaks, without the goal. */
type Rounds = Omit<Plan, "goalMin"> & { goalMin?: number };

/** The Pomodoro a session runs, or null for a plain timer. */
export function pomodoroOf(s: Rounds): Pomodoro | null {
  if (!s.workMin || s.breakMin == null || s.longBreakMin == null || !s.rounds) return null;
  return { workMin: s.workMin, breakMin: s.breakMin, longBreakMin: s.longBreakMin, rounds: s.rounds };
}

export type PomodoroPhase = {
  kind: "focus" | "break" | "long";
  /** 1-based. During a break, the round that just ended. It keeps counting past the plan if you keep going. */
  round: number;
  /** Seconds into this phase, and how long the phase is. */
  into: number;
  length: number;
  /** Focused seconds so far, breaks left out. */
  focusSec: number;
};

/** The break after a round (1-based): a long one after every 4th. */
const breakAfter = (p: Pomodoro, round: number) => (round % LONG_BREAK_EVERY === 0 ? p.longBreakMin : p.breakMin) * 60;

/**
 * Where a Pomodoro stands after `activeSec` seconds of running (pauses already left out).
 * Focus and breaks take turns, with a long break after every 4th round, and carry on past the plan.
 */
export function pomodoroPhase(p: Pomodoro, activeSec: number): PomodoroPhase {
  const work = p.workMin * 60;
  const cycle = LONG_BREAK_EVERY * work + (LONG_BREAK_EVERY - 1) * p.breakMin * 60 + p.longBreakMin * 60;
  const t = Math.max(0, activeSec);
  const cycles = Math.floor(t / cycle);
  const before = cycles * LONG_BREAK_EVERY; // rounds finished in earlier cycles
  let left = t - cycles * cycle;
  for (let i = 1; ; i++) {
    const round = before + i;
    const focusBefore = (round - 1) * work;
    if (left < work) return { kind: "focus", round, into: left, length: work, focusSec: focusBefore + left };
    left -= work;
    const pause = breakAfter(p, round);
    // the last break of the cycle is the long one, and it soaks up any rounding left over
    if (left < pause || i >= LONG_BREAK_EVERY) {
      const kind = round % LONG_BREAK_EVERY === 0 ? "long" : "break";
      return { kind, round, into: Math.min(left, pause), length: pause, focusSec: focusBefore + work };
    }
    left -= pause;
  }
}

/** Running seconds (pauses left out) until the plan's last focus round ends: the breaks between rounds count, the one after doesn't. */
export function planSeconds(s: Plan): number {
  const p = pomodoroOf(s);
  if (!p) return s.goalMin * 60;
  let sec = p.rounds * p.workMin * 60;
  for (let round = 1; round < p.rounds; round++) sec += breakAfter(p, round);
  return sec;
}

/** Focused seconds for `activeSec` of running: all of it on a plain timer, only the focus rounds on a Pomodoro. */
export function focusOf(s: Rounds, activeSec: number): number {
  const p = pomodoroOf(s);
  return p ? pomodoroPhase(p, activeSec).focusSec : activeSec;
}

/* ---------- Timing ---------- */

/** A session as it comes from the server, with its dates still strings. */
export function sessionTiming<T extends { startedAt: string; pausedAt: string | null }>(s: T) {
  return { ...s, startedAt: new Date(s.startedAt), pausedAt: s.pausedAt ? new Date(s.pausedAt) : null };
}

/** Running milliseconds up to `at`, leaving out paused time. A Pomodoro's breaks still run. */
function runningMs(s: Timing, at: Date): number {
  const end = s.pausedAt && s.pausedAt < at ? s.pausedAt : at;
  return end.getTime() - s.startedAt.getTime() - s.pausedSec * 1000;
}

/** Seconds the session has run up to `at`, leaving out paused time. On a Pomodoro this includes its breaks. */
export function activeSeconds(s: Timing, at: Date): number {
  return Math.max(0, Math.round(runningMs(s, at) / 1000));
}

/** Focused seconds up to `at`: running time without pauses, and without a Pomodoro's breaks. What a session counts for. */
export function focusedSeconds(s: Timing & Rounds, at: Date): number {
  return focusOf(s, activeSeconds(s, at));
}

/** All paused time up to `at`, including a pause that's still running. */
export function pausedSeconds(s: Pick<Timing, "pausedSec" | "pausedAt">, at: Date): number {
  const open = s.pausedAt && s.pausedAt < at ? Math.round((at.getTime() - s.pausedAt.getTime()) / 1000) : 0;
  return s.pausedSec + open;
}

/**
 * Focus seconds still to go before the goal, and below zero once past it. Worked out from the session itself rather than
 * a counter, so a refresh, a second tab or a sleeping phone all land on the same number. A Pomodoro's breaks don't count.
 */
export function remainingSeconds(s: Timing & Plan, at: Date): number {
  const ms = runningMs(s, at);
  const focused = pomodoroOf(s) ? focusOf(s, Math.max(0, ms) / 1000) : ms / 1000;
  return Math.ceil(s.goalMin * 60 - focused);
}

/** When the goal lands if the session isn't paused again. For a Pomodoro, when its last focus round ends. */
export function goalEndsAt(s: Pick<Timing, "startedAt" | "pausedSec"> & Plan): Date {
  return new Date(s.startedAt.getTime() + (planSeconds(s) + s.pausedSec) * 1000);
}

/** Focus time to show for a running session: a silent one only counts up to its last heartbeat. */
export function runningSeconds(s: Timing & Rounds & { lastBeatAt: Date }, now: Date): number {
  const silent = now.getTime() - s.lastBeatAt.getTime() > STALE_MS;
  return focusedSeconds(s, silent ? s.lastBeatAt : now);
}

/** A silent session survives until its goal + grace, so locking your phone mid-session doesn't end it. */
export function isExpired(s: Timing & Plan & { lastBeatAt: Date }, now = Date.now()): boolean {
  const goalEnd = goalEndsAt(s).getTime() + GRACE_MS;
  return now > Math.max(s.lastBeatAt.getTime() + STALE_MS, goalEnd);
}

/** What a query selects so the functions above know a session's plan. */
export const PLAN_FIELDS = { goalMin: true, workMin: true, breakMin: true, longBreakMin: true, rounds: true } as const;
