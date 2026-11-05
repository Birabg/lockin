import type { CSSProperties } from "react";
import "./clocks.css";
import { FlipClock } from "./flip-clock";
import { MinimalClock } from "./minimal-clock";
import { ReelClock } from "./reel-clock";
import { RingClock } from "./ring-clock";
import { RollingClock } from "./rolling-clock";
import { clockText, type ClockStyle } from "@/lib/clock-styles";

export type ClockProps = {
  /** Below zero once past the goal. */
  remainingSec: number;
  totalSec: number;
  running: boolean;
  paused: boolean;
  overtime: boolean;
  accent: string;
  /** The line inside the ring. The other styles leave it to the page around them. */
  status?: string;
};

const FACES = { ring: RingClock, rolling: RollingClock, flip: FlipClock, reel: ReelClock, minimal: MinimalClock };

export function Clock({ clockStyle, ...props }: ClockProps & { clockStyle: ClockStyle }) {
  const Face = FACES[clockStyle];
  return (
    <div
      role="timer"
      aria-label={clockText(props.remainingSec, props.overtime)}
      className="clock"
      data-clock={clockStyle}
      data-paused={props.paused || undefined}
      data-overtime={props.overtime || undefined}
      style={{ "--clock-accent": props.accent } as CSSProperties}
    >
      <div className="clock-face" aria-hidden>
        <Face {...props} />
      </div>
      {/* the ring already says so on its own status line */}
      {props.paused && clockStyle !== "ring" && <p className="clock-paused">Paused</p>}
    </div>
  );
}
