import type { ClockProps } from "./clock";
import { thinDigits } from "./fonts";
import { useChange } from "./use-change";
import { clockParts, twoDigits } from "@/lib/clock-styles";

/** Keyed by value, so the digit that leaves is the same element that arrived and its animation restarts. */
function RollingDigit({ value }: { value: string }) {
  const { now, before } = useChange(value);
  return (
    <span className="roll-digit">
      {before !== null && (
        <span key={before} className="roll-out">
          {before}
        </span>
      )}
      <span key={now} className={before === null ? "" : "roll-in"}>
        {now}
      </span>
    </span>
  );
}

function Group({ value, label }: { value: number; label: string }) {
  const [tens, ones] = twoDigits(value);
  return (
    <span className="roll-group">
      <span className="roll-digits">
        <RollingDigit value={tens} />
        <RollingDigit value={ones} />
      </span>
      <span className="roll-label">{label}</span>
    </span>
  );
}

const Dots = () => (
  <span className="roll-dots">
    <i />
    <i />
  </span>
);

export function RollingClock({ remainingSec, overtime }: ClockProps) {
  const { hours, minutes, seconds } = clockParts(remainingSec, overtime);
  return (
    <div className={`clock-rolling ${thinDigits.className}`}>
      {overtime && <span className="clock-sign">+</span>}
      {hours > 0 && (
        <>
          <Group value={hours} label="Hours" />
          <Dots />
        </>
      )}
      <Group value={minutes} label="Minutes" />
      <Dots />
      <Group value={seconds} label="Seconds" />
    </div>
  );
}
