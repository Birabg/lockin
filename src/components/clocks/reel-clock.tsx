"use client";

import { memo, useEffect, useRef } from "react";
import { ClockDigits } from "../ui";
import type { ClockProps } from "./clock";
import { boldDigits } from "./fonts";
import { prefersReducedMotion } from "../focus-dial";
import { clockParts, reelNumber, reelPlacement, twoDigits } from "@/lib/clock-styles";

const MAX_REACH = 7;
const SLOTS = MAX_REACH * 2 + 1;
const slots = Array.from({ length: SLOTS }, (_, i) => i);
const wrap = (n: number) => ((n % SLOTS) + SLOTS) % SLOTS;

/**
 * Its numbers are moved straight on the page, once a frame, so React never re-renders them.
 * They only ever change transform and opacity, and a number's text only when it wraps round to the far end.
 */
const ReelStrip = memo(function ReelStrip({ remainingSec, running }: { remainingSec: number; running: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const numbers = useRef<(HTMLSpanElement | null)[]>([]);
  const places = useRef<(number | null)[]>(slots.map(() => null));
  const size = useRef({ width: 0, height: 0, reach: MAX_REACH });
  const tick = useRef({ remainingSec, at: 0 });

  function paint(progress: number) {
    const { width, height, reach } = size.current;
    const flat = width > height; // a strip under the time on a portrait phone
    const position = progress - tick.current.remainingSec;
    const first = Math.round(position) - MAX_REACH;
    slots.forEach((slot) => {
      const el = numbers.current[slot];
      if (!el) return;
      const place = first + wrap(slot - first);
      if (places.current[slot] !== place) {
        places.current[slot] = place;
        el.textContent = reelNumber(place);
      }
      const { along, across, scale, opacity } = reelPlacement(place - position, reach);
      const at = flat
        ? `translate3d(${width / 2 + (along * width) / 2}px, ${across * height * 0.5}px, 0) translate(-50%, 0)`
        : `translate3d(${across * width * 0.8}px, ${height / 2 + (along * height) / 2}px, 0) translate(0, -50%)`;
      el.style.transform = `${at} scale(${scale})`;
      el.style.opacity = String(opacity);
    });
  }
  const latestPaint = useRef(paint);
  latestPaint.current = paint;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // a short reel shows fewer numbers, rather than squeezing them together
      const fits = Math.max(width, height) / (parseFloat(getComputedStyle(el).fontSize) * 2.4);
      size.current = { width, height, reach: Math.min(MAX_REACH, Math.max(2, Math.floor(fits))) };
      latestPaint.current(0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    tick.current = { remainingSec, at: performance.now() };
    if (!running || prefersReducedMotion()) latestPaint.current(0);
  }, [remainingSec, running]);

  useEffect(() => {
    if (!running || prefersReducedMotion()) return;
    let frame = 0;
    const step = (time: number) => {
      latestPaint.current(Math.min(Math.max(time - tick.current.at, 0) / 1000, 1));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return (
    <div ref={box} className="reel-strip" aria-hidden>
      {slots.map((slot) => (
        <span
          key={slot}
          ref={(el) => {
            numbers.current[slot] = el;
          }}
          className="reel-number"
        />
      ))}
    </div>
  );
});

function Unit({ value, label, current = false }: { value: number; label: string; current?: boolean }) {
  return (
    <span className="reel-unit" data-current={current || undefined}>
      <span className="reel-value">
        <ClockDigits value={twoDigits(value)} />
      </span>
      <span className="reel-label">{label}</span>
    </span>
  );
}

export function ReelClock({ remainingSec, running, overtime }: ClockProps) {
  const { hours, minutes, seconds } = clockParts(remainingSec, overtime);
  return (
    <div className={`clock-reel ${boldDigits.className}`}>
      <div className="reel-row">
        {overtime && <span className="clock-sign">+</span>}
        {hours > 0 && <Unit value={hours} label="hrs" />}
        <Unit value={minutes} label="min" />
        <Unit value={seconds} label="sec" current />
      </div>
      <ReelStrip remainingSec={remainingSec} running={running} />
    </div>
  );
}
