import { shiftDayKey } from "./time";

export const MIN_DAY_SEC = 60; // a day counts toward the streak after 1 focused minute

/** Current and best run of consecutive days. Today not being done yet doesn't break the current run. */
export function computeStreak(totals: Map<string, number>, todayKey: string) {
  const counted = (key: string) => (totals.get(key) ?? 0) >= MIN_DAY_SEC;

  let current = 0;
  let day = counted(todayKey) ? todayKey : shiftDayKey(todayKey, -1);
  while (counted(day)) {
    current++;
    day = shiftDayKey(day, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of [...totals.keys()].filter(counted).sort()) {
    run = previous && shiftDayKey(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return { current, best };
}
