"use client";

import { useEffect, useRef, useState } from "react";
import {
  DIAL_MAX,
  DIAL_MIN,
  DIAL_STEP,
  angleFrom,
  clampMinutes,
  dialShape,
  formatDialTime,
  minutesForTurn,
  snapMinutes,
  turnBetween,
} from "@/lib/dial";
import { playTick, wakeSound } from "@/lib/dial-sound";
import { formatClock } from "@/lib/time";

const SIZE = 340;
const CENTER = SIZE / 2;
const RING_R = 132;
const LAP_RADII = [114, 103, 92];
const TICKS = Array.from({ length: 12 }, (_, i) => i);
const PRESETS = [
  { minutes: 25, text: "25m", place: "top-0 left-0" },
  { minutes: 50, text: "50m", place: "top-0 right-0" },
  { minutes: 90, text: "90m", place: "right-0 bottom-0" },
  { minutes: 120, text: "2h", place: "bottom-0 left-0" },
];

/** A small overshoot for settling, and a softer one for sweeping a long way. */
const SETTLE = { stiffness: 260, damping: 20 };
const SWEEP = { stiffness: 70, damping: 13 };
type Spring = typeof SETTLE;

/** The middle of the dial, as a share of its width. Angles swing wildly this close to the centre. */
const DEAD_CENTER = 0.1;
/** Scroll distance per step. A mouse notch is more than this, and a trackpad builds up to it. */
const WHEEL_STEP = 40;
const WHEEL_GAP_MS = 45;
const WHEEL_RESET_MS = 200;

const KEY_STEPS: Record<string, number> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: 3,
  PageDown: -3,
  Home: -DIAL_MAX,
  End: DIAL_MAX,
};

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Some engines put a narrow space before "PM", which would differ between server and browser. */
const endsAt = (now: number, minutes: number, timeZone: string) =>
  formatClock(new Date(now + minutes * 60_000), timeZone).replace(/\s/g, " ");

const onControl = (target: EventTarget) => !!(target as Element).closest("button, a");

type Props = {
  value: number;
  onChange: (minutes: number) => void;
  label: string;
  now: number;
  timeZone: string;
  accent: string;
  /** The session is starting, so the dial stops taking input. */
  locked: boolean;
};

export function FocusDial({ value, onChange, label, now, timeZone, accent, locked }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(value);
  const [dragging, setDragging] = useState(false);
  const motion = useRef({ x: value, velocity: 0, frame: 0, step: value, target: value });
  const drag = useRef<{ id: number; cx: number; cy: number; deadZone: number; angle: number; raw: number } | null>(null);
  const wheel = useRef({ total: 0, at: 0, steppedAt: 0 });

  function show(x: number) {
    const m = motion.current;
    m.x = x;
    setDisplay(x);
    const step = snapMinutes(x);
    if (step !== m.step) {
      m.step = step;
      playTick();
    }
  }

  function glide(target: number, spring: Spring) {
    const m = motion.current;
    cancelAnimationFrame(m.frame);
    if (prefersReducedMotion()) {
      m.velocity = 0;
      return show(target);
    }
    let last = performance.now();
    const frame = (time: number) => {
      const dt = Math.min((time - last) / 1000, 1 / 30);
      last = time;
      m.velocity += (-spring.stiffness * (m.x - target) - spring.damping * m.velocity) * dt;
      const x = m.x + m.velocity * dt;
      if (Math.abs(x - target) < 0.02 && Math.abs(m.velocity) < 0.3) {
        m.velocity = 0;
        return show(target);
      }
      show(x);
      m.frame = requestAnimationFrame(frame);
    };
    m.frame = requestAnimationFrame(frame);
  }

  function choose(minutes: number, spring: Spring) {
    const m = motion.current;
    const next = snapMinutes(minutes);
    if (next !== m.target) {
      m.target = next;
      onChange(next);
    }
    glide(next, spring);
  }

  function nudgeBy(steps: number) {
    if (!locked) choose(motion.current.target + steps * DIAL_STEP, SETTLE);
  }
  const nudge = useRef(nudgeBy);
  nudge.current = nudgeBy;

  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.frame);
  }, []);

  // React's own wheel listener can't stop the page scrolling
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) return; // pinch to zoom
      e.preventDefault();
      const w = wheel.current;
      if (e.timeStamp - w.at > WHEEL_RESET_MS) w.total = 0;
      w.at = e.timeStamp;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const pixels = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * WHEEL_STEP : delta;
      w.total = Math.min(Math.max(w.total + pixels, -WHEEL_STEP), WHEEL_STEP);
      if (Math.abs(w.total) < WHEEL_STEP || e.timeStamp - w.steppedAt < WHEEL_GAP_MS) return;
      nudge.current(w.total < 0 ? 1 : -1);
      w.total = 0;
      w.steppedAt = e.timeStamp;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked || e.button !== 0 || drag.current || onControl(e.target)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const distance = Math.hypot(e.clientX - cx, e.clientY - cy);
    const deadZone = rect.width * DEAD_CENTER;
    if (distance < deadZone || distance > rect.width / 2) return;
    const m = motion.current;
    cancelAnimationFrame(m.frame);
    m.velocity = 0;
    wakeSound();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.pointerType !== "touch" && knob.current) {
      knob.current.focus({ preventScroll: true }); // keeps the keyboard working after a drag
      knob.current.style.outline = "none"; // Chrome rings anything focused from code, and the ring is only for keyboards
    }
    // measured from where it is, so grabbing the far side of the ring doesn't make the knob jump there
    drag.current = { id: e.pointerId, cx, cy, deadZone, angle: angleFrom(cx, cy, e.clientX, e.clientY), raw: m.x };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < d.deadZone / 2) return;
    const angle = angleFrom(d.cx, d.cy, e.clientX, e.clientY);
    // clamped as it goes, so turning back from a limit responds straight away
    d.raw = clampMinutes(d.raw + minutesForTurn(turnBetween(d.angle, angle)));
    d.angle = angle;
    show(d.raw);
    const next = snapMinutes(d.raw);
    const m = motion.current;
    if (next !== m.target) {
      m.target = next;
      onChange(next);
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    wakeSound(); // phones only allow audio once a finger lifts
    glide(motion.current.target, SETTLE);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    e.currentTarget.style.outline = "";
    const steps = KEY_STEPS[e.key];
    if (steps === undefined) return;
    e.preventDefault();
    wakeSound();
    nudgeBy(steps);
  }

  const shown = snapMinutes(display);
  const { laps, fraction, angle } = dialShape(Math.min(Math.max(display, 0.01), DIAL_MAX));

  return (
    <div
      ref={box}
      data-dial
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // stops the press taking focus back off the knob, or selecting the text
      onMouseDown={(e) => {
        if (!onControl(e.target)) e.preventDefault();
      }}
      className={`@container relative aspect-square w-full max-w-[340px] touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
        {TICKS.map((i) => (
          <line
            key={i}
            x1={CENTER + RING_R + 13}
            x2={CENTER + RING_R + (i % 3 === 0 ? 22 : 18)}
            y1={CENTER}
            y2={CENTER}
            transform={`rotate(${i * 30} ${CENTER} ${CENTER})`}
            stroke="white"
            strokeOpacity={i % 3 === 0 ? 0.7 : 0.4}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
        <circle cx={CENTER} cy={CENTER} r={RING_R} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth={14} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_R}
          fill="none"
          stroke={accent}
          strokeWidth={14}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${fraction} 1`}
        />
        {LAP_RADII.map((r, i) => (
          <circle
            key={r}
            data-lap={i < laps ? "" : undefined}
            cx={CENTER}
            cy={CENTER}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={6}
            className="transition-opacity duration-150"
            opacity={i < laps ? 0.75 : 0}
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
        <div
          ref={knob}
          role="slider"
          tabIndex={0}
          aria-label="Session length"
          aria-valuemin={DIAL_MIN}
          aria-valuemax={DIAL_MAX}
          aria-valuenow={value}
          aria-valuetext={`${formatDialTime(value)}, ends at ${endsAt(now, value, timeZone)}`}
          aria-disabled={locked || undefined}
          onKeyDown={onKeyDown}
          onBlur={(e) => (e.currentTarget.style.outline = "")}
          className={`absolute top-[11.18%] left-1/2 size-[30px] -translate-1/2 rounded-full border-[3px] bg-white shadow-[0_2px_8px_rgb(0_0_0/0.5)] transition-[scale] duration-150 ${dragging ? "scale-125" : ""}`}
          style={{ borderColor: accent }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && <p className="mb-1 max-w-[46cqw] truncate text-xs font-bold">{label}</p>}
        <p className="text-[13cqw] leading-none font-extrabold tracking-tight whitespace-nowrap tabular">{formatDialTime(shown)}</p>
        <p className="mt-2 text-sm font-semibold whitespace-nowrap">ends at {endsAt(now, shown, timeZone)}</p>
      </div>

      {PRESETS.map(({ minutes, text, place }) => (
        <button
          key={minutes}
          onClick={() => {
            wakeSound();
            if (!locked) choose(minutes, SWEEP);
          }}
          aria-label={`Set to ${formatDialTime(minutes)}`}
          aria-pressed={value === minutes}
          className={`absolute ${place} h-8 min-w-11 rounded-full border px-2.5 text-xs font-bold backdrop-blur-sm transition-colors ${
            value === minutes
              ? "border-white bg-white text-black [text-shadow:none]"
              : "border-white/30 bg-black/40 text-white hover:bg-black/60"
          }`}
        >
          {text}
        </button>
      ))}

      {locked && (
        <span
          data-lock-pulse
          className="animate-lock-pulse pointer-events-none absolute inset-[11%] rounded-full border-4"
          style={{ borderColor: accent }}
        />
      )}
    </div>
  );
}
