import { ClockDigits, GoalRing } from "../ui";
import type { ClockProps } from "./clock";
import { thinDigits } from "./fonts";
import { clockText } from "@/lib/clock-styles";

/** A hairline ring that drains as the session runs, round the same light numerals as the other styles. */
export function RingClock({ remainingSec, totalSec, overtime, accent }: ClockProps) {
  return (
    <GoalRing
      pct={overtime ? 1 : Math.max(0, remainingSec) / totalSec}
      size={300}
      stroke={2.5}
      cssSize="var(--ring)"
      color={overtime ? "var(--streak)" : accent}
      track="rgb(255 255 255 / 0.1)"
      drain
      glow={overtime}
    >
      <p className={`clock-ring-time ${thinDigits.className}`}>
        <ClockDigits value={clockText(remainingSec, overtime)} />
      </p>
    </GoalRing>
  );
}
