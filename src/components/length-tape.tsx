"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { DIAL_MAX, DIAL_MIN, DIAL_STEP, clampMinutes, formatDialTime } from "@/lib/dial";
import { playTick, wakeSound } from "@/lib/dial-sound";
import { prefersReducedMotion } from "@/lib/motion";

/** Room between ticks, in px. One tick is one DIAL_STEP. */
const GAP = 16;
const STEPS = (DIAL_MAX - DIAL_MIN) / DIAL_STEP;
const MARKS = Array.from({ length: STEPS + 1 }, (_, i) => DIAL_MIN + i * DIAL_STEP);
/** Quick stops, drawn as tappable labels on the tape. */
const STOPS = [25, 50, 90, 120];

const short = (m: number) => (m < 60 ? String(m) : m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : `${m / 60}h`);
const toLeft = (minutes: number) => ((minutes - DIAL_MIN) / DIAL_STEP) * GAP;
const toMinutes = (left: number) => clampMinutes(DIAL_MIN + Math.round(left / GAP) * DIAL_STEP);

/**
 * Session length as a sideways tape of minutes under a fixed needle. Scroll, drag, flick or use the arrow keys;
 * the time above follows live, and ticks shrink and fade away from the middle like a wheel turning.
 */
export function LengthTape({ goal, onGoal, locked }: { goal: number; onGoal: (minutes: number) => void; locked: boolean }) {
  const tape = useRef<HTMLDivElement>(null);
  const shown = useRef(goal); // the value the tape is sitting on, so a goal it set itself doesn't scroll it again
  const steering = useRef<number | null>(null); // set while we scroll it to a value, so the way there isn't emitted
  const drag = useRef<{ x: number; left: number; id: number } | null>(null);
  const frame = useRef(0);
  const emit = useRef(onGoal);
  emit.current = onGoal;

  /** Curves the tape: each tick gets its distance from the needle, from 0 to 1. */
  function paint() {
    const el = tape.current;
    if (!el) return;
    const half = el.clientWidth / 2;
    el.querySelectorAll<HTMLElement>("[data-tick]").forEach((tick) => {
      const d = Math.min(Math.abs(toLeft(Number(tick.dataset.tick)) - el.scrollLeft) / half, 1);
      tick.style.setProperty("--d", d.toFixed(3));
    });
  }

  function scrollTo(minutes: number, smooth: boolean) {
    const el = tape.current;
    if (!el) return;
    steering.current = minutes;
    el.scrollTo({ left: toLeft(minutes), behavior: smooth && !prefersReducedMotion() ? "smooth" : "instant" });
  }

  // land on the starting value before the first paint
  useLayoutEffect(() => {
    const el = tape.current;
    if (!el) return;
    el.scrollLeft = toLeft(goal);
    paint();
    const ro = new ResizeObserver(() => {
      el.scrollLeft = toLeft(shown.current);
      paint();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a goal set from outside (a stop, a key) glides the tape there
  useEffect(() => {
    if (goal === shown.current) return;
    shown.current = goal;
    scrollTo(goal, true);
  }, [goal]);

  // a vertical wheel turns the tape too
  useEffect(() => {
    const el = tape.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || !el) return;
      e.preventDefault();
      steering.current = null;
      el.scrollLeft += e.deltaY;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    const el = tape.current;
    if (!el) return;
    const value = toMinutes(el.scrollLeft);
    if (steering.current !== null) {
      if (value === steering.current) steering.current = null;
      return;
    }
    if (value === shown.current) return;
    shown.current = value;
    playTick();
    emit.current(value);
  }

  function nudge(minutes: number) {
    wakeSound();
    const next = clampMinutes(minutes);
    if (next === goal) return;
    playTick();
    onGoal(next);
  }

  return (
    <div className="stage-tape-wrap" data-locked={locked || undefined}>
      <div
        ref={tape}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="Session length"
        aria-valuemin={DIAL_MIN}
        aria-valuemax={DIAL_MAX}
        aria-valuenow={goal}
        aria-valuetext={formatDialTime(goal)}
        aria-disabled={locked || undefined}
        className="stage-tape"
        onScroll={onScroll}
        onScrollEnd={(e) => {
          // settle on the nearest tick once a flick or a cut-short glide comes to rest
          steering.current = null;
          onScroll();
          const el = e.currentTarget;
          const left = toLeft(toMinutes(el.scrollLeft));
          if (!drag.current && Math.abs(el.scrollLeft - left) > 0.5) el.scrollTo({ left, behavior: prefersReducedMotion() ? "instant" : "smooth" });
        }}
        onPointerDown={(e) => {
          wakeSound();
          steering.current = null;
          if (e.pointerType !== "mouse" || e.button !== 0 || (e.target as Element).closest("button")) return;
          const el = e.currentTarget;
          drag.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
          el.setPointerCapture(e.pointerId);
          el.dataset.dragging = "";
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          e.currentTarget.scrollLeft = d.left - (e.clientX - d.x);
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          drag.current = null;
          const el = e.currentTarget;
          delete el.dataset.dragging;
          // let go between ticks and it settles on the nearest one
          el.scrollTo({ left: toLeft(toMinutes(el.scrollLeft)), behavior: prefersReducedMotion() ? "instant" : "smooth" });
        }}
        onKeyDown={(e) => {
          const moves: Record<string, number> = {
            ArrowRight: DIAL_STEP,
            ArrowUp: DIAL_STEP,
            ArrowLeft: -DIAL_STEP,
            ArrowDown: -DIAL_STEP,
            PageUp: 30,
            PageDown: -30,
            Home: DIAL_MIN - goal,
            End: DIAL_MAX - goal,
          };
          if (!(e.key in moves)) return;
          e.preventDefault();
          nudge(goal + moves[e.key]);
        }}
      >
        <div className="stage-tape-track" style={{ width: STEPS * GAP }}>
          {MARKS.map((m) => {
            const stop = STOPS.includes(m);
            const major = m % 30 === 0;
            const crowded = STOPS.some((at) => at !== m && Math.abs(at - m) < 10); // a stop's label sits right there
            return (
              <span key={m} data-tick={m} data-major={major || undefined} className="stage-tape-tick" style={{ left: toLeft(m) }}>
                <span className="stage-tape-line" />
                {stop ? (
                  <button
                    tabIndex={-1}
                    disabled={locked}
                    onClick={() => nudge(m)}
                    aria-label={`Set to ${formatDialTime(m)}`}
                    aria-pressed={goal === m}
                    className="stage-tape-stop tabular"
                  >
                    {short(m)}
                  </button>
                ) : (
                  major &&
                  !crowded && (
                    <span aria-hidden className="stage-tape-num tabular">
                      {short(m)}
                    </span>
                  )
                )}
              </span>
            );
          })}
        </div>
      </div>
      <span aria-hidden className="stage-tape-needle" />
    </div>
  );
}
