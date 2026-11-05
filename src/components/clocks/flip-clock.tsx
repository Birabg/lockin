import type { ClockProps } from "./clock";
import { boldDigits } from "./fonts";
import { useChange } from "./use-change";
import { clockParts, twoDigits } from "@/lib/clock-styles";

function Half({ side, value, flap }: { side: "top" | "bottom"; value: string; flap?: boolean }) {
  return (
    <span className={`flip-half flip-${side} ${flap ? "flip-flap" : ""}`}>
      <span className="flip-number">{value}</span>
    </span>
  );
}

/**
 * Four halves: the new top and the old bottom stay still, while the old top folds down
 * and the new bottom lands over them. The last flap stays put, so nothing has to reset afterwards.
 */
function FlipCard({ value, label, small = false }: { value: number; label: string; small?: boolean }) {
  const { now, before } = useChange(twoDigits(value));
  return (
    <span className="flip-card" data-small={small || undefined}>
      <Half side="top" value={now} />
      <Half side="bottom" value={before ?? now} />
      {before !== null && (
        <span key={now}>
          <Half side="top" value={before} flap />
          <Half side="bottom" value={now} flap />
        </span>
      )}
      <span className="flip-tag">{label}</span>
    </span>
  );
}

export function FlipClock({ remainingSec, overtime }: ClockProps) {
  const { hours, minutes, seconds } = clockParts(remainingSec, overtime);
  return (
    <div className={`clock-flip ${boldDigits.className}`}>
      {overtime && <span className="clock-sign">+</span>}
      {hours > 0 && <FlipCard value={hours} label="HR" />}
      <FlipCard value={minutes} label="MIN" />
      <FlipCard value={seconds} label="SEC" small />
    </div>
  );
}
