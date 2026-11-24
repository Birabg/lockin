import { ClockDigits } from "../ui";
import type { ClockProps } from "./clock";
import { thinDigits } from "./fonts";
import { useId } from "react";
import { GLASS, bottomSandPath, bulbPath, glassPath, glintPath, sandAt, topSandPath } from "@/lib/hourglass";
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

/* ---- Hourglass: a real one, glass in a wooden frame, the sand running down as the session does ---- */

const GLASS_OUTLINE = glassPath();
const TOP_BULB = bulbPath(1);
const BOTTOM_BULB = bulbPath(-1);
const GLINTS = [glintPath(1, -1, 0.06, 0.62, 0.74), glintPath(-1, -1, 0.06, 0.62, 0.74)];
const SHEENS = [glintPath(1, 1, 0.12, 0.42, 0.8), glintPath(-1, 1, 0.12, 0.42, 0.8)];

/** A turned wooden post: a rod with a bead at each end and one at the waist. */
function Post({ x, wood }: { x: number; wood: string }) {
  return (
    <g fill={wood}>
      <rect x={x - 2.2} y={GLASS.top} width={4.4} height={GLASS.bottom - GLASS.top} rx={1.5} />
      {[GLASS.top + 5, GLASS.neck, GLASS.bottom - 5].map((y) => (
        <ellipse key={y} cx={x} cy={y} rx={4} ry={y === GLASS.neck ? 3.4 : 2.6} />
      ))}
    </g>
  );
}

/** A cap or base: a wide plate with a narrower step towards the glass. */
function Plate({ top, wood, edge }: { top: boolean; wood: string; edge: string }) {
  const plateY = top ? 3 : 161;
  const stepY = top ? 10.5 : 156.5;
  return (
    <g>
      <rect x={2} y={plateY} width={116} height={8} rx={2.5} fill={wood} />
      <rect x={9} y={stepY} width={102} height={5} rx={1.5} fill={wood} />
      <rect x={4} y={plateY + 0.6} width={112} height={1.1} rx={0.5} fill={edge} />
    </g>
  );
}

export function HourglassClock({ remainingSec, totalSec, running, paused, overtime }: ClockProps) {
  const share = shareLeft(remainingSec, totalSec);
  const flowing = running && !paused && !overtime && share > 0;
  const sand = sandAt(share);
  // ids are per clock, since the picker shows several faces on one page
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  const streamEnd = sand.bottom ? sand.bottom.peak : GLASS.bottom - 1;
  return (
    <div className={`clock-hourglass ${thinDigits.className}`}>
      <svg viewBox="0 0 120 172" className="glass-svg" aria-hidden>
        <defs>
          <clipPath id={`${id}-top`}>
            <path d={TOP_BULB} />
          </clipPath>
          <clipPath id={`${id}-bottom`}>
            <path d={BOTTOM_BULB} />
          </clipPath>
          <linearGradient id={`${id}-wood`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#3a2213" />
            <stop offset="0.3" stopColor="#7d4b26" />
            <stop offset="0.48" stopColor="#a5703f" />
            <stop offset="0.75" stopColor="#6a3d1e" />
            <stop offset="1" stopColor="#2b190c" />
          </linearGradient>
          <linearGradient id={`${id}-post`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#3a2213" />
            <stop offset="0.45" stopColor="#a5703f" />
            <stop offset="1" stopColor="#2b190c" />
          </linearGradient>
          <linearGradient id={`${id}-sand`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f2d9a2" />
            <stop offset="1" stopColor="#c8954f" />
          </linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.13" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
          </linearGradient>
          {/* a fine speckle, so the sand reads as grains rather than paint */}
          <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="4" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.08  0 0 0 0.9 -0.35" result="specks" />
            <feComposite in="specks" in2="SourceGraphic" operator="in" result="grains" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="grains" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="60" cy="170" rx="56" ry="2.4" className="glass-shadow" />
        <Post x={6} wood={ref("post")} />

        <path d={TOP_BULB} fill={ref("glass")} />
        <path d={BOTTOM_BULB} fill={ref("glass")} />
        <g filter={ref("grain")}>
          {sand.top && <path d={topSandPath(sand.top)} fill={ref("sand")} clipPath={ref("top")} />}
          {sand.bottom && <path d={bottomSandPath(sand.bottom)} fill={ref("sand")} clipPath={ref("bottom")} />}
        </g>
        {flowing && <line x1={GLASS.centre} y1={GLASS.neck - 2} x2={GLASS.centre} y2={streamEnd} className="glass-stream" />}
        <path d={GLASS_OUTLINE} className="glass-outline" />
        {GLINTS.map((d) => (
          <path key={d} d={d} className="glass-glint" />
        ))}
        {SHEENS.map((d) => (
          <path key={d} d={d} className="glass-sheen" />
        ))}

        <Post x={114} wood={ref("post")} />
        <Plate top wood={ref("wood")} edge="rgb(255 222 180 / 0.35)" />
        <Plate top={false} wood={ref("wood")} edge="rgb(255 222 180 / 0.25)" />
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
