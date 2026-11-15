"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Clock } from "./clock";
import { Icon } from "../icon";
import { CLOCK_STYLES, type ClockStyle } from "@/lib/clock-styles";

// passes 10:00, so the previews show several digits changing at once
const PREVIEW_FROM = 604;
const PREVIEW_TO = 592;

const PREVIEW_SIZES: Record<ClockStyle, CSSProperties> = {
  ring: { "--ring": "58px" } as CSSProperties,
  rolling: { "--clock-size": "21px" } as CSSProperties,
  flip: { "--clock-size": "20px" } as CSSProperties,
  reel: { "--clock-size": "19px", "--reel-size": "10px" } as CSSProperties,
  minimal: { "--clock-size": "27px" } as CSSProperties,
  digital: { "--clock-size": "26px" } as CSSProperties,
  pie: { "--clock-size": "22px" } as CSSProperties,
  hourglass: { "--clock-size": "26px" } as CSSProperties,
  bar: { "--clock-size": "24px" } as CSSProperties,
  dots: { "--clock-size": "22px" } as CSSProperties,
  words: { "--clock-size": "12px" } as CSSProperties,
  neon: { "--clock-size": "26px" } as CSSProperties,
  terminal: { "--clock-size": "22px" } as CSSProperties,
  bold: { "--clock-size": "26px" } as CSSProperties,
};

type Props = { current: ClockStyle; accent: string; onPick: (style: ClockStyle) => void };

/** Small cards that each run their own clock, for choosing one. */
export function ClockPicker({ current, accent, onPick }: Props) {
  const [remaining, setRemaining] = useState(PREVIEW_FROM);

  useEffect(() => {
    const id = setInterval(() => setRemaining((n) => (n <= PREVIEW_TO ? PREVIEW_FROM : n - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div role="group" aria-label="Clock style" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CLOCK_STYLES.map(({ id, name }) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          aria-pressed={id === current}
          data-selected={id === current || undefined}
          className={`overflow-hidden rounded-2xl bg-black/30 text-left ring-1 transition-shadow ${
            id === current ? "ring-2 ring-[var(--stage-text)]" : "ring-[var(--stage-line)] hover:ring-[var(--stage-muted)]"
          }`}
        >
          <span aria-hidden className="clock-preview relative grid h-[70px] place-items-center overflow-hidden" style={PREVIEW_SIZES[id]}>
            <Clock clockStyle={id} remainingSec={remaining} totalSec={1500} running paused={false} overtime={false} accent={accent} />
          </span>
          <span className="flex items-center justify-between px-2 pb-1.5 text-xs font-semibold text-[var(--stage-text)]">
            {name}
            {id === current && <Icon name="check" size={13} />}
          </span>
        </button>
      ))}
    </div>
  );
}
