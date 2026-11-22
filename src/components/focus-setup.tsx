"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Clock } from "./clocks/clock";
import { ClockPicker } from "./clocks/clock-picker";
import {
  Dock,
  DockButton,
  DockDivider,
  DockPopover,
  HomeLink,
  LivePill,
  StageBackdrop,
  StageHero,
  stageStyle,
  toggleFullscreen,
  useDockMenu,
  useFullscreen,
} from "./focus-stage";
import { Icon } from "./icon";
import { LengthTape } from "./length-tape";
import { MusicButton, MusicPanel, YouTubePill } from "./music-panel";
import { SceneGrid } from "./scene-picker";
import { reachesDailyGoal } from "@/lib/dial";
import type { ClockStyle } from "@/lib/clock-styles";
import { playLock, wakeSound } from "@/lib/dial-sound";
import { prefersReducedMotion } from "@/lib/motion";
import type { Scene } from "@/lib/scenes";
import { formatClock, formatDuration } from "@/lib/time";

const HOLD_MS = 1000;
const CLOCK_MS = 15_000;
const MAX_LABELS = 8;
const SPRING_BACK = "--hold 420ms cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Some engines put a narrow space before "PM", which would differ between server and browser. */
const endsAt = (now: number, minutes: number, timeZone: string) =>
  formatClock(new Date(now + minutes * 60_000), timeZone).replace(/\s/g, " ");

/** Drives --hold (0 to 1) on the lock while pressed: the shackle drops and the body fills. Calls onFull once it's shut. */
function useHold(onFull: () => void) {
  const target = useRef<HTMLButtonElement>(null);
  const hold = useRef({ active: false, frame: 0 });
  const full = useRef(onFull);
  full.current = onFull;

  function set(progress: number, transition: string) {
    const el = target.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.setProperty("--hold", String(progress));
  }

  function press() {
    const h = hold.current;
    if (h.active) return;
    h.active = true;
    wakeSound();
    target.current?.setAttribute("data-holding", "");
    const startedAt = performance.now();
    const frame = (time: number) => {
      const progress = Math.min(Math.max(time - startedAt, 0) / HOLD_MS, 1);
      set(progress, "none");
      if (progress < 1) {
        h.frame = requestAnimationFrame(frame);
        return;
      }
      h.active = false;
      target.current?.removeAttribute("data-holding");
      full.current();
    };
    h.frame = requestAnimationFrame(frame);
  }

  function release() {
    const h = hold.current;
    if (!h.active) return;
    h.active = false;
    cancelAnimationFrame(h.frame);
    target.current?.removeAttribute("data-holding");
    set(0, prefersReducedMotion() ? "none" : SPRING_BACK);
  }

  return { target, press, release, isHeld: () => hold.current.active };
}

function LabelChips({
  labels,
  label,
  onChange,
  locked,
}: {
  labels: string[];
  label: string;
  onChange: (label: string) => void;
  locked: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const chips = label && !labels.includes(label) ? [label, ...labels].slice(0, MAX_LABELS) : labels.slice(0, MAX_LABELS);

  function commit(text: string) {
    setAdding(false);
    if (text.trim()) onChange(text.trim());
  }

  return (
    <div role="group" aria-label="What are you working on?" className="stage-scroll-row">
      {chips.map((chip) => (
        <button
          key={chip}
          disabled={locked}
          onClick={() => onChange(chip === label ? "" : chip)}
          aria-pressed={chip === label}
          title={chip}
          className="stage-tag"
        >
          <span className="truncate">{chip}</span>
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
          className="stage-input"
        />
      ) : (
        <button
          disabled={locked}
          onClick={() => setAdding(true)}
          aria-label="Add something new to work on"
          className="stage-tag"
          data-dashed
        >
          <Icon name="add" size={14} /> new
        </button>
      )}
    </div>
  );
}

type LockProps = ButtonHTMLAttributes<HTMLButtonElement> & { locked: boolean; ref: Ref<HTMLButtonElement> };

/** The round start button. Its padlock is open at rest, closes as the ring fills, and snaps shut when it's full. */
function LockButton({ locked, ref, ...rest }: LockProps) {
  return (
    <button
      {...rest}
      ref={ref}
      data-hold
      data-big
      data-tone="accent"
      data-locked={locked || undefined}
      disabled={locked}
      className="stage-action"
    >
      <span className="stage-action-disc">
        <svg viewBox="0 0 100 100" className="stage-hold-ring" aria-hidden>
          <circle cx="50" cy="50" r="48" stroke="var(--stage-line)" />
          <circle cx="50" cy="50" r="48" stroke="var(--stage-accent)" pathLength={1} strokeDasharray="1 1" className="stage-hold-fill" />
        </svg>
        {locked && <span data-lock-pulse className="stage-hold-pulse animate-lock-pulse" aria-hidden />}
        <svg viewBox="0 0 24 24" width="30" height="30" className={`stage-padlock ${locked ? "animate-lock-snap" : ""}`} aria-hidden>
          {/* a chunky shackle with long legs, so it never leaves the body: holding just presses it home */}
          <path className="stage-padlock-shackle" d="M8.4 14V8.4a3.6 3.6 0 0 1 7.2 0V14" />
          <rect x="4.6" y="10.4" width="14.8" height="11.4" rx="3.6" fill="currentColor" />
          <path className="stage-padlock-hole" d="M12 13.9a1.7 1.7 0 0 0-.85 3.17v1.33a.85.85 0 0 0 1.7 0v-1.33A1.7 1.7 0 0 0 12 13.9z" />
        </svg>
      </span>
      <span>{locked ? "Locked in" : "Hold to lock in"}</span>
    </button>
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
  todaySec: number;
  dailyGoalMin: number;
  serverNow: number;
  timeZone: string;
  starting: boolean;
  onStart: () => void;
  clockStyle: ClockStyle;
  onClockStyle: (style: ClockStyle) => void;
  onPickScene: (id: string) => void;
  /** Extra options for the settings popover, like recording a timelapse. */
  settings: ReactNode;
  /** A short message for the top left, like the last session being logged. */
  notice: ReactNode;
  error: string | null;
};

export function FocusSetup(props: Props) {
  const { scene, goal, onGoal, label, onLabel, labels, liveCount, todaySec, dailyGoalMin, timeZone, starting } = props;
  const [now, setNow] = useState(props.serverNow); // same on server and client, so hydration matches
  const screen = useFullscreen();
  const menu = useDockMenu<"music" | "scene" | "clock" | "settings">();
  const lastKey = useRef(0);

  function lockIn() {
    menu.close();
    playLock();
    props.onStart();
  }
  const hold = useHold(lockIn);
  const latest = useRef({ hold, starting });
  latest.current = { hold, starting };

  // if starting fails, open the lock back up so it can be held again
  useEffect(() => {
    if (!starting) hold.target.current?.style.setProperty("--hold", "0");
  }, [starting, hold.target]);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  // holding space starts, the same as holding the button
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

  const total = goal * 60;
  const caption = (
    <>
      Ends at {endsAt(now, goal, timeZone)} · Today {formatDuration(todaySec)} of {formatDuration(dailyGoalMin * 60)} goal
    </>
  );

  return (
    <section
      data-stage="setup"
      data-starting={starting || undefined}
      aria-label="Focus"
      style={stageStyle(scene)}
      className="focus-stage min-h-dvh px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] sm:px-6 lg:pt-6"
    >
      <StageBackdrop scene={scene} />

      <div className="stage-top">
        <div className="stage-top-group">
          <HomeLink />
          {props.notice}
        </div>
        <div className="stage-top-group">
          <LivePill count={liveCount} link />
        </div>
      </div>

      <div className="stage-center">
        <StageHero
          label={label}
          state={starting ? "Locked in" : "Ready"}
          clock={
            <Clock
              clockStyle={props.clockStyle}
              remainingSec={total}
              totalSec={total}
              running={false}
              paused={false}
              overtime={false}
              accent={scene.accent}
            />
          }
          caption={caption}
          note={reachesDailyGoal(goal, todaySec, dailyGoalMin) ? "This session hits your daily goal" : null}
        />

        <div className="stage-mid stage-fade" data-setup-only>
          <div className="stage-setup-card">
            <LengthTape goal={goal} onGoal={onGoal} locked={starting} />
            <LabelChips labels={labels} label={label} onChange={onLabel} locked={starting} />
          </div>
        </div>

        <LockButton
          ref={hold.target}
          locked={starting}
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
        />

        <p role="alert" className="min-h-5 text-center text-sm font-semibold text-danger">
          {props.error}
        </p>
      </div>

      <div ref={menu.wrap} className="stage-dock-wrap">
        {menu.open === "music" && (
          <DockPopover title="Music" onClose={menu.close} wide>
            <MusicPanel />
          </DockPopover>
        )}
        {menu.open === "scene" && (
          <DockPopover title="Background" onClose={menu.close}>
            <SceneGrid current={scene} onPick={props.onPickScene} />
          </DockPopover>
        )}
        {menu.open === "clock" && (
          <DockPopover title="Clock style" onClose={menu.close} wide>
            <ClockPicker current={props.clockStyle} accent={scene.accent} onPick={props.onClockStyle} />
          </DockPopover>
        )}
        {menu.open === "settings" && (
          <DockPopover title="Settings" onClose={menu.close}>
            <div className="space-y-3 text-sm">
              {props.settings}
              <p className="text-[var(--stage-faint)]">
                Hold <kbd className="rounded border border-[var(--stage-line)] px-1">Space</kbd> to start. Your daily goal is{" "}
                {formatDuration(dailyGoalMin * 60)}, and you can change it in Settings.
              </p>
            </div>
          </DockPopover>
        )}
        {!menu.open && <YouTubePill />}
        <Dock label="Focus tools">
          <MusicButton {...menu.triggerProps("music")} />
          <DockDivider />
          <DockButton icon="image" label="Background" {...menu.triggerProps("scene")} />
          <DockButton icon="clockStyle" label="Clock style" {...menu.triggerProps("clock")} />
          <DockButton icon="settings" label="Settings" className="stage-fade" data-setup-only {...menu.triggerProps("settings")} />
          {screen.can && (
            <>
              <DockDivider />
              <DockButton
                icon={screen.fullscreen ? "exitFullscreen" : "fullscreen"}
                label={screen.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                onClick={toggleFullscreen}
              />
            </>
          )}
        </Dock>
      </div>
    </section>
  );
}
