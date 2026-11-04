export const DIAL_STEP = 5;
export const DIAL_MIN = 5;
export const DIAL_MAX = 240;
const MINUTES_PER_TURN = 60;

export const clampMinutes = (minutes: number) => Math.min(Math.max(minutes, DIAL_MIN), DIAL_MAX);

export const snapMinutes = (minutes: number) => clampMinutes(Math.round(minutes / DIAL_STEP) * DIAL_STEP);

/** 25 -> "25 min", 60 -> "1h", 90 -> "1h 30m" */
export function formatDialTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Degrees clockwise from 12 o'clock, from 0 up to 360. */
export function angleFrom(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** The short way round between two angles, so 350 to 10 is +20 rather than -340. This is what lets laps count across 12 o'clock. */
export function turnBetween(from: number, to: number): number {
  const turn = (((to - from) % 360) + 360) % 360;
  return turn > 180 ? turn - 360 : turn;
}

export const minutesForTurn = (degrees: number) => (degrees / 360) * MINUTES_PER_TURN;

/** How to draw a time: full laps as inner rings, and what's left on the outer ring. Exactly 60 is one full ring, not an empty ring and a lap. */
export function dialShape(minutes: number) {
  const laps = Math.max(0, Math.ceil(minutes / MINUTES_PER_TURN) - 1);
  const fraction = (minutes - laps * MINUTES_PER_TURN) / MINUTES_PER_TURN;
  return { laps, fraction, angle: fraction * 360 };
}

/** True only when this session would carry today over the goal, not when the goal is already met. */
export function reachesDailyGoal(minutes: number, todaySec: number, dailyGoalMin: number): boolean {
  const goalSec = dailyGoalMin * 60;
  return todaySec < goalSec && todaySec + minutes * 60 >= goalSec;
}
