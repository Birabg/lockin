import type { CSSProperties } from "react";
import "./clocks.css";
import "./extra-clocks.css";
import {
  BarClock,
  BoldClock,
  DigitalClock,
  DotsClock,
  HourglassClock,
  NeonClock,
  PieClock,
  TerminalClock,
  WordsClock,
} from "./extra-clocks";
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
};

const FACES = {
  ring: RingClock,
  rolling: RollingClock,
  flip: FlipClock,
  reel: ReelClock,
  minimal: MinimalClock,
  digital: DigitalClock,
  pie: PieClock,
  hourglass: HourglassClock,
  bar: BarClock,
  dots: DotsClock,
  words: WordsClock,
  neon: NeonClock,
  terminal: TerminalClock,
  bold: BoldClock,
};

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
    </div>
  );
}
