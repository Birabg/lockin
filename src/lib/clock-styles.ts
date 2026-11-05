import { formatCountdown } from "./time";

export const CLOCK_STYLES = [
  { id: "ring", name: "Ring" },
  { id: "rolling", name: "Rolling" },
  { id: "flip", name: "Flip" },
  { id: "reel", name: "Reel" },
  { id: "minimal", name: "Minimal" },
] as const;

export type ClockStyle = (typeof CLOCK_STYLES)[number]["id"];

export const DEFAULT_CLOCK_STYLE: ClockStyle = "ring";

export const isClockStyle = (value: string): value is ClockStyle => CLOCK_STYLES.some((s) => s.id === value);

export const resolveClockStyle = (value: string | null | undefined): ClockStyle =>
  value && isClockStyle(value) ? value : DEFAULT_CLOCK_STYLE;

const shownSeconds = (remainingSec: number, overtime: boolean) => (overtime ? Math.abs(remainingSec) : Math.max(0, remainingSec));

/** "25:00", "1:30:00", or "+02:15" once past the goal. */
export function clockText(remainingSec: number, overtime: boolean): string {
  return `${overtime ? "+" : ""}${formatCountdown(shownSeconds(remainingSec, overtime))}`;
}

export const twoDigits = (n: number) => String(n).padStart(2, "0");

export function clockParts(remainingSec: number, overtime: boolean) {
  const total = shownSeconds(remainingSec, overtime);
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

/**
 * Where a reel number sits, given how many places it is from the centre. Numbers follow a curve,
 * so `along` runs the length of the reel (-1 to 1) and `across` is how far the curve has bent away.
 */
export function reelPlacement(offset: number, reach: number) {
  const share = Math.min(Math.abs(offset) / reach, 1);
  const angle = (offset / reach) * (Math.PI / 2) * 0.92;
  return { along: Math.sin(angle), across: 1 - Math.cos(angle), scale: 1 - 0.62 * share, opacity: (1 - share) ** 1.5 };
}

/** The reel counts through one line of seconds: down to the goal at zero, then up through overtime. */
export const reelNumber = (place: number) => twoDigits(Math.abs(place) % 60);
