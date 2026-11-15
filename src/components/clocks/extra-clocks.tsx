import { ClockDigits } from "../ui";
import type { ClockProps } from "./clock";
import { thinDigits } from "./fonts";
import { clockParts, clockText, clockWords, shareLeft, twoDigits } from "@/lib/clock-styles";

/*
 * More clock faces. Like the others they size themselves from --clock-size, so the same face
 * fills the focus screen or fits a picker card.
 */

/* ---- Digital: a seven-segment LED ---- */

// which segments each digit lights: top, top right, bottom right, bottom, bottom left, top left, middle
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abfgcd",
};

const SEGMENT_SHAPES: Record<string, { x: number; y: number; width: number; height: number }> = {
  a: { x: 12, y: 4, width: 36, height: 8 },
  b: { x: 50, y: 12, width: 8, height: 36 },
  c: { x: 50, y: 52, width: 8, height: 36 },
  d: { x: 12, y: 88, width: 36, height: 8 },
  e: { x: 2, y: 52, width: 8, height: 36 },
  f: { x: 2, y: 12, width: 8, height: 36 },
  g: { x: 12, y: 46, width: 36, height: 8 },
};

function SegmentDigit({ digit }: { digit: string }) {
  const lit = SEGMENTS[digit] ?? "";
  return (
    <svg viewBox="0 0 60 100" className="seg-digit">
      {Object.entries(SEGMENT_SHAPES).map(([id, r]) => (
        <rect key={id} {...r} rx="4" className={lit.includes(id) ? "seg-on" : "seg-off"} />
      ))}
    </svg>
  );
}

export function DigitalClock({ remainingSec, overtime }: ClockProps) {
  const text = clockText(remainingSec, overtime);
  return (
    <div className="clock-digital">
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <SegmentDigit key={i} digit={ch} />
        ) : ch === ":" ? (
          <span key={i} className="seg-colon">
            <i />
            <i />
          </span>
        ) : (
          <span key={i} className="seg-sign">
            {ch}
          </span>
        ),
      )}
    </div>
  );
}

/* ---- Timer: a wedge that shrinks round the dial, like a kitchen timer ---- */

function wedge(share: number) {
  if (share >= 0.9999) return "M100 100 m-82 0 a82 82 0 1 0 164 0 a82 82 0 1 0 -164 0";
  if (share <= 0) return "";
  const angle = share * Math.PI * 2;
  const x = 100 + 82 * Math.sin(angle);
  const y = 100 - 82 * Math.cos(angle);
  return `M100 100 L100 18 A82 82 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export function PieClock({ remainingSec, totalSec, overtime }: ClockProps) {
  // a full amber dial through overtime
  const share = overtime ? 1 : shareLeft(remainingSec, totalSec);
  return (
    <div className={`clock-pie ${thinDigits.className}`}>
      <svg viewBox="0 0 200 200" className="pie-dial">
        <circle cx="100" cy="100" r="96" className="pie-face" />
        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            x1="100"
            y1={i % 5 ? 8 : 5}
            x2="100"
            y2={i % 5 ? 13 : 16}
            transform={`rotate(${i * 6} 100 100)`}
            className="pie-tick"
            strokeWidth={i % 5 ? 1 : 2}
          />
        ))}
        <path d={wedge(share)} className="pie-wedge" />
        <circle cx="100" cy="100" r="9" className="pie-knob" />
      </svg>
      <p className="pie-time">
        <ClockDigits value={clockText(remainingSec, overtime)} />
      </p>
    </div>
  );
}

/* ---- Hourglass: the sand runs down as the session does ---- */

export function HourglassClock({ remainingSec, totalSec, running, paused, overtime }: ClockProps) {
  const share = shareLeft(remainingSec, totalSec);
  const flowing = running && !paused && !overtime && share > 0;
  // the top bulb holds what's left, settled at the neck; the bottom fills from the floor
  const topY = 80 - share * 62;
  const bottomY = 152 - (1 - share) * 62;
  return (
    <div className={`clock-hourglass ${thinDigits.className}`}>
      <svg viewBox="0 0 120 172" className="glass-svg">
        <defs>
          <clipPath id="glass-top">
            <path d="M18 16 H102 C102 52 70 64 62 82 H58 C50 64 18 52 18 16Z" />
          </clipPath>
          <clipPath id="glass-bottom">
            <path d="M58 90 H62 C70 108 102 120 102 156 H18 C18 120 50 108 58 90Z" />
          </clipPath>
        </defs>
        <rect x="18" y={topY} width="84" height={82 - topY} className="glass-sand" clipPath="url(#glass-top)" />
        <rect x="18" y={bottomY} width="84" height={156 - bottomY} className="glass-sand" clipPath="url(#glass-bottom)" />
        {flowing && <line x1="60" y1="82" x2="60" y2={bottomY} className="glass-stream" />}
        <path
          d="M18 16 C18 52 50 64 58 86 C50 108 18 120 18 156 M102 16 C102 52 70 64 62 86 C70 108 102 120 102 156"
          className="glass-outline"
        />
        <rect x="8" y="6" width="104" height="10" rx="4" className="glass-cap" />
        <rect x="8" y="156" width="104" height="10" rx="4" className="glass-cap" />
      </svg>
      <p className="glass-time">
        <ClockDigits value={clockText(remainingSec, overtime)} />
      </p>
    </div>
  );
}

/* ---- Bar: big numerals over a bar that drains ---- */

export function BarClock({ remainingSec, totalSec, overtime }: ClockProps) {
  return (
    <div className={`clock-bar ${thinDigits.className}`}>
      <p className="bar-time">
        <ClockDigits value={clockText(remainingSec, overtime)} />
      </p>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${(overtime ? 1 : shareLeft(remainingSec, totalSec)) * 100}%` }} />
      </span>
    </div>
  );
}

/* ---- Dots: sixty dots, going out one by one ---- */

export function DotsClock({ remainingSec, totalSec, overtime }: ClockProps) {
  const lit = overtime ? 60 : Math.ceil(shareLeft(remainingSec, totalSec) * 60);
  return (
    <div className={`clock-dots ${thinDigits.className}`}>
      <p className="dots-time">
        <ClockDigits value={clockText(remainingSec, overtime)} />
      </p>
      <span className="dots-grid">
        {Array.from({ length: 60 }, (_, i) => (
          <i key={i} data-on={i < lit || undefined} />
        ))}
      </span>
    </div>
  );
}

/* ---- Words: the time as a sentence ---- */

export function WordsClock({ remainingSec, overtime }: ClockProps) {
  const { minutes, seconds, hours } = clockParts(remainingSec, overtime);
  return (
    <div className="clock-words">
      <p className="words-line">{clockWords(remainingSec, overtime)}</p>
      {(hours > 0 || minutes > 0) && <p className={`words-small ${thinDigits.className}`}>and {twoDigits(seconds)} seconds</p>}
    </div>
  );
}

/* ---- Neon: glowing tube numerals ---- */

export function NeonClock({ remainingSec, overtime }: ClockProps) {
  return (
    <p className={`clock-neon ${thinDigits.className}`}>
      <ClockDigits value={clockText(remainingSec, overtime)} />
    </p>
  );
}

/* ---- Terminal: a prompt with a blinking cursor ---- */

export function TerminalClock({ remainingSec, overtime, paused }: ClockProps) {
  return (
    <div className="clock-terminal">
      <p className="term-prompt">
        <span>~/focus</span> $ {paused ? "pause" : overtime ? "overtime" : "lock-in"}
      </p>
      <p className="term-time">
        {clockText(remainingSec, overtime)}
        <span className="term-cursor" />
      </p>
    </div>
  );
}

/* ---- Bold: chunky numerals, the colons pulsing each second ---- */

export function BoldClock({ remainingSec, overtime }: ClockProps) {
  return (
    <p className={`clock-bold ${thinDigits.className}`}>
      {[...clockText(remainingSec, overtime)].map((ch, i) =>
        ch === ":" ? (
          <span key={`${i}-${remainingSec}`} className="bold-colon">
            :
          </span>
        ) : (
          <span key={i} className={/\d/.test(ch) ? "bold-digit" : undefined}>
            {ch}
          </span>
        ),
      )}
    </p>
  );
}
