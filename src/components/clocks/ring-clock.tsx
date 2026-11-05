import { ClockDigits, GoalRing } from "../ui";
import type { ClockProps } from "./clock";
import { clockText } from "@/lib/clock-styles";

export function RingClock({ remainingSec, totalSec, overtime, accent, status }: ClockProps) {
  return (
    <GoalRing
      pct={overtime ? 1 : Math.max(0, remainingSec) / totalSec}
      size={300}
      stroke={16}
      cssSize="var(--ring)"
      color={overtime ? "var(--streak)" : accent}
      track="rgb(255 255 255 / 0.2)"
      drain
      glow={overtime}
    >
      <div className="text-center">
        <p
          className={`leading-none font-extrabold whitespace-nowrap tabular ${overtime ? "text-streak" : ""}`}
          style={{ fontSize: "calc(var(--ring) * 0.16)" }}
        >
          <ClockDigits value={clockText(remainingSec, overtime)} />
        </p>
        {status && (
          <p className="font-semibold whitespace-nowrap" style={{ fontSize: "calc(var(--ring) * 0.05)", marginTop: "0.6em" }}>
            {status}
          </p>
        )}
      </div>
    </GoalRing>
  );
}
