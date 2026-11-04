"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock, LockOpen, Plus, Radio, Volume2, VolumeX } from "lucide-react";
import { FocusDial, prefersReducedMotion } from "./focus-dial";
import { FocusScene } from "./focus-scene";
import { Avatar } from "./ui";
import { reachesDailyGoal } from "@/lib/dial";
import { loadSoundMuted, playLock, setSoundMuted, wakeSound } from "@/lib/dial-sound";
import type { Scene } from "@/lib/scenes";
import { formatDuration } from "@/lib/time";

const HOLD_MS = 1000;
const CLOCK_MS = 15_000;
const MAX_LABELS = 5;
const SPRING_BACK = "clip-path 320ms cubic-bezier(0.34, 1.56, 0.64, 1)";

const fillTo = (progress: number) => `inset(0 ${100 - progress * 100}% 0 0)`;

/** Fills while pressed, and calls onFull once it gets there. */
function useHold(onFull: () => void) {
  const fill = useRef<HTMLSpanElement>(null);
  const hold = useRef({ active: false, frame: 0 });
  const full = useRef(onFull);
  full.current = onFull;

  function press() {
    const h = hold.current;
    if (h.active) return;
    h.active = true;
    wakeSound();
    const startedAt = performance.now();
    const frame = (time: number) => {
      const progress = Math.min(Math.max(time - startedAt, 0) / HOLD_MS, 1);
      const el = fill.current;
      if (el) {
        el.style.transition = "none";
        el.style.clipPath = fillTo(progress);
      }
      if (progress < 1) {
        h.frame = requestAnimationFrame(frame);
        return;
      }
      h.active = false;
      full.current();
    };
    h.frame = requestAnimationFrame(frame);
  }

  function release() {
    const h = hold.current;
    if (!h.active) return;
    h.active = false;
    cancelAnimationFrame(h.frame);
    const el = fill.current;
    if (el) {
      el.style.transition = prefersReducedMotion() ? "none" : SPRING_BACK;
      el.style.clipPath = fillTo(0);
    }
  }

  return { fill, press, release, isHeld: () => hold.current.active };
}

function LabelChips({ labels, label, onChange }: { labels: string[]; label: string; onChange: (label: string) => void }) {
  const [adding, setAdding] = useState(false);
  const chips = label && !labels.includes(label) ? [label, ...labels].slice(0, MAX_LABELS) : labels;

  function commit(text: string) {
    setAdding(false);
    if (text.trim()) onChange(text.trim());
  }

  return (
    <div role="group" aria-label="What are you working on?" className="flex w-full flex-wrap justify-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChange(chip === label ? "" : chip)}
          aria-pressed={chip === label}
          className={`h-9 max-w-[180px] truncate rounded-full border px-3.5 text-sm font-bold backdrop-blur-sm transition-colors ${
            chip === label
              ? "border-white bg-white text-black [text-shadow:none]"
              : "border-white/30 bg-black/40 text-white hover:bg-black/60"
          }`}
        >
          {chip}
        </button>
      ))}
      {adding ? (
        <input
          autoFocus
          aria-label="What are you working on?"
          placeholder="What are you working on?"
          maxLength={40}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.value = "";
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          className="h-9 w-[220px] max-w-full rounded-full border border-white/60 bg-black/50 px-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/60"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          aria-label="Add something new to work on"
          className="flex h-9 items-center gap-1 rounded-full border border-dashed border-white/40 bg-black/30 px-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-black/60"
        >
          <Plus className="size-4" aria-hidden /> new
        </button>
      )}
    </div>
  );
}

type Props = {
  scene: Scene;
  goal: number;
  onGoal: (minutes: number) => void;
  label: string;
  onLabel: (label: string) => void;
  labels: string[];
  liveCount: number;
  liveUsers: { id: string; name: string; avatar: string | null }[];
  todaySec: number;
  dailyGoalMin: number;
  serverNow: number;
  timeZone: string;
  starting: boolean;
  onStart: () => void;
  footer: React.ReactNode;
};

export function FocusSetup(props: Props) {
  const { scene, goal, onGoal, label, onLabel, labels, liveCount, liveUsers, todaySec, dailyGoalMin, timeZone, starting } = props;
  const [now, setNow] = useState(props.serverNow); // same on server and client, so hydration matches
  const [muted, setMuted] = useState(false);
  const lastKey = useRef(0);

  function lockIn() {
    playLock();
    props.onStart();
  }
  const hold = useHold(lockIn);
  const latest = useRef({ hold, starting });
  latest.current = { hold, starting };

  useEffect(() => setMuted(loadSoundMuted()), []);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let clicked: Element | null = null;
    const onPress = (e: PointerEvent) => {
      clicked = (e.target as Element).closest("button");
    };
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const { hold, starting } = latest.current;
      if (e.repeat) {
        if (hold.isHeld()) e.preventDefault(); // otherwise the page scrolls
        return;
      }
      const target = e.target as HTMLElement;
      if (starting || target.closest("input, textarea, select, a, [role=dialog]")) return;
      // a button someone tabbed to keeps its own space key. One that was only clicked doesn't.
      const button = target.closest("button:not([data-hold])");
      if (button && button !== clicked) return;
      e.preventDefault();
      lastKey.current = Date.now();
      hold.press();
    }
    function onKeyUp(e: KeyboardEvent) {
      const { hold } = latest.current;
      if (e.code !== "Space" || !hold.isHeld()) return;
      e.preventDefault();
      hold.release();
    }
    const onBlur = () => latest.current.hold.release();
    window.addEventListener("pointerdown", onPress, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  function toggleMute() {
    setSoundMuted(!muted);
    setMuted(!muted);
    wakeSound();
  }

  const buttonText = (
    <>
      {starting ? <Lock className="animate-lock-snap size-5" aria-hidden /> : <LockOpen className="size-5" aria-hidden />}
      {starting ? "Locked in" : "Hold to lock in"}
    </>
  );

  return (
    <div className="w-full">
      <FocusScene scene={scene}>
        <div className="relative flex flex-col items-center gap-3 px-4 pt-4 pb-5">
          <Link
            href="/dashboard/focusing"
            className="flex h-9 items-center gap-2 rounded-full border border-white/20 bg-black/35 pr-3.5 pl-2.5 text-sm font-semibold backdrop-blur-sm hover:bg-black/55"
          >
            <Radio className="size-4 shrink-0 animate-live" style={{ color: scene.accent }} aria-hidden />
            {liveUsers.length > 0 && (
              <span className="flex -space-x-1.5" aria-hidden>
                {liveUsers.map((u) => (
                  <Avatar key={u.id} name={u.name} src={u.avatar} size={22} />
                ))}
              </span>
            )}
            {liveCount} focusing right now
          </Link>
          <button
            onClick={toggleMute}
            aria-label="Mute dial sounds"
            aria-pressed={muted}
            title={muted ? "Turn sounds on" : "Mute sounds"}
            className="absolute top-4 right-3 grid size-9 place-items-center rounded-full border border-white/20 bg-black/35 backdrop-blur-sm hover:bg-black/55"
          >
            {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          </button>

          <FocusDial value={goal} onChange={onGoal} label={label} now={now} timeZone={timeZone} accent={scene.accent} locked={starting} />

          {/* always takes up its line, so nothing shifts under a finger that's mid-drag */}
          <p role="status" className="h-4 text-xs leading-4 font-bold">
            {reachesDailyGoal(goal, todaySec, dailyGoalMin) && "this hits your daily goal 🎯"}
          </p>

          <LabelChips labels={labels} label={label} onChange={onLabel} />

          <button
            data-hold
            disabled={starting}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              hold.press();
            }}
            onPointerUp={hold.release}
            onPointerCancel={hold.release}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.repeat) return;
              e.preventDefault();
              lastKey.current = Date.now();
              hold.press();
            }}
            onKeyUp={(e) => {
              if (e.key === "Enter") hold.release();
            }}
            // screen readers and switches press without holding, so that has to start it too
            onClick={(e) => {
              if (e.detail === 0 && Date.now() - lastKey.current > HOLD_MS * 2) lockIn();
            }}
            className="btn-3d-muted relative mt-1 h-14 w-full max-w-[340px] touch-none overflow-hidden rounded-full border-2 border-white/30 bg-black/45 font-bold text-white backdrop-blur-sm select-none [-webkit-touch-callout:none]"
          >
            <span className="flex items-center justify-center gap-2">{buttonText}</span>
            <span
              ref={hold.fill}
              aria-hidden
              style={{ clipPath: fillTo(starting ? 1 : 0) }}
              className="absolute inset-0 flex items-center justify-center gap-2 bg-primary text-primary-foreground [text-shadow:none]"
            >
              {buttonText}
            </span>
          </button>
        </div>
      </FocusScene>

      <div className="mt-4 space-y-3">
        {props.footer}
        <p className="text-center text-xs text-subtle">
          Hold space to start. Today {formatDuration(todaySec)} of {formatDuration(dailyGoalMin * 60)} daily goal
        </p>
      </div>
    </div>
  );
}
