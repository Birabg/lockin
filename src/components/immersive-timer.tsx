"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock } from "./clocks/clock";
import { ClockPicker } from "./clocks/clock-picker";
import { FocusScene } from "./focus-scene";
import { Icon } from "./icon";
import { PickerSheet, ScenePanel } from "./scene-picker";
import { Avatar } from "./ui";
import { brand } from "@/lib/brand";
import type { ClockStyle } from "@/lib/clock-styles";
import type { Scene } from "@/lib/scenes";
import { formatDuration } from "@/lib/time";

const IDLE_MS = 3000;

function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  change.catch(() => {}); // browsers can refuse, and the timer works the same without it
}

/** True for a few seconds after any mouse, touch or key activity. */
function useRecentActivity() {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastMouse = useRef<string | null>(null);

  const wake = useCallback(() => {
    setActive(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), IDLE_MS);
  }, []);

  useEffect(() => {
    // browsers send a mousemove when the page changes under a still cursor, so only real movement counts
    function onMouse(e: globalThis.MouseEvent) {
      const at = `${e.screenX},${e.screenY}`;
      if (lastMouse.current === at) return;
      const first = lastMouse.current === null;
      lastMouse.current = at;
      if (!first) wake();
    }
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [wake]);

  return active;
}

type Props = {
  scene: Scene;
  clockStyle: ClockStyle;
  remainingSec: number;
  totalSec: number;
  running: boolean;
  status: string;
  overtime: boolean;
  paused: boolean;
  label: string | null;
  recording: boolean;
  streak: number;
  todaySec: number;
  user: { name: string; username: string; avatar: string | null };
  timeZone: string;
  now: number;
  /** Fading out, so the page underneath can already be seen. */
  leaving: boolean;
  fadeIn: boolean;
  finishing: boolean;
  /** The wrap-up form, shown in a glass panel while finishing. */
  wrapUp: ReactNode;
  /** The choice shown once the goal is reached, until it's answered. */
  goalPrompt: ReactNode;
  error: string | null;
  pending: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
  onCancelFinish: () => void;
  onDiscard: () => void;
  onMinimize: () => void;
  onPickScene: (id: string) => void;
  onPickClock: (style: ClockStyle) => void;
};

const barButton = "grid size-11 place-items-center rounded-full text-white hover:bg-white/15 disabled:opacity-50";

// everything is sized from these, so one layout holds from a phone to a 4K screen
const fluid = {
  "--ring": "clamp(200px, 46vmin, 1100px)",
  "--text": "clamp(14px, 2.6vmin, 56px)",
  "--pad": "clamp(16px, 4vmin, 96px)",
} as CSSProperties;

export function ImmersiveTimer(props: Props) {
  const { scene, clockStyle, remainingSec, totalSec, running, status, overtime, paused } = props;
  const { label, recording, streak, todaySec, user, timeZone, now } = props;
  const {
    leaving,
    fadeIn,
    finishing,
    wrapUp,
    goalPrompt,
    error,
    pending,
    onPickScene,
    onPickClock,
    onFinish,
    onDiscard,
    onMinimize,
    onTogglePause,
  } = props;
  const recent = useRecentActivity();
  const [picking, setPicking] = useState<"scene" | "clock" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const showBar = recent && !finishing && !picking && !leaving && !goalPrompt;
  const hideCursor = !recent && !finishing && !picking && !goalPrompt;

  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled);
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const keys = useRef({ finishing, picking, leaving, onTogglePause, onCancelFinish: props.onCancelFinish });
  keys.current = { finishing, picking, leaving, onTogglePause, onCancelFinish: props.onCancelFinish };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keys.current;
      if (k.leaving) return;
      // escape only ever backs out of a panel. The session keeps running.
      if (e.key === "Escape") return k.finishing ? k.onCancelFinish() : undefined;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;
      if (e.key.toLowerCase() === "f") return toggleFullscreen();
      if (e.code !== "Space" || k.finishing || k.picking || target.closest("button, a")) return;
      e.preventDefault();
      k.onTogglePause();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // after a click the button keeps focus, and space would then press it instead of pausing
  function releaseFocus(e: MouseEvent) {
    if (e.detail > 0 && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  const date = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(now);
  const centred = clockStyle === "ring" ? "portrait:justify-center" : "justify-center";
  const fade = leaving ? "pointer-events-none opacity-0 transition-opacity duration-400" : fadeIn ? "animate-immersive-in" : "";

  return createPortal(
    <div
      data-immersive-view
      style={{ ...fluid, fontSize: "var(--text)" }}
      className={`fixed inset-0 z-50 h-dvh w-dvw ${fade} ${hideCursor ? "cursor-none" : ""}`}
    >
      <FocusScene scene={scene} fullscreen>
        <div
          className="flex size-full flex-col"
          style={{
            padding:
              "max(var(--pad), env(safe-area-inset-top)) max(var(--pad), env(safe-area-inset-right)) max(var(--pad), env(safe-area-inset-bottom)) max(var(--pad), env(safe-area-inset-left))",
          }}
        >
          <header className="flex items-center justify-between font-bold">
            <span className="font-black tracking-tight lowercase" style={{ fontSize: "1.3em" }}>
              {brand.name}
            </span>
            <span>{date}</span>
          </header>

          <div
            className={`flex min-h-0 flex-1 items-center justify-center ${clockStyle === "ring" ? "portrait:flex-col" : "flex-col"}`}
            style={{ gap: clockStyle === "ring" ? "clamp(20px, 8vmin, 200px)" : "clamp(16px, 4vmin, 96px)" }}
          >
            <Clock
              clockStyle={clockStyle}
              remainingSec={remainingSec}
              totalSec={totalSec}
              running={running}
              paused={paused}
              overtime={overtime}
              accent={scene.accent}
              status={status}
            />
            {clockStyle !== "minimal" && (
              <div className={`min-w-0 ${clockStyle === "ring" ? "portrait:text-center" : "text-center"}`}>
                <p className={`flex items-center gap-[0.5em] font-extrabold ${centred}`} style={{ fontSize: "1.6em" }}>
                  <span className="size-[0.55em] shrink-0 rounded-full" style={{ background: scene.accent }} aria-hidden />
                  <span className="truncate">{label ?? "Focus"}</span>
                </p>
                <p className={`mt-[0.5em] flex items-center gap-[0.4em] font-semibold ${centred}`}>
                  {streak > 0 && (
                    <>
                      <Icon name="streak" size="1em" solid className="streak-glow text-streak" />
                      <span className="tabular">{streak}d</span>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span className="tabular">{formatDuration(todaySec)}</span> today
                </p>
                {clockStyle !== "ring" && !paused && <p className="mt-[0.5em] font-semibold">{status}</p>}
                {recording && <p className="mt-[0.5em] font-bold">● Recording screen</p>}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-4 font-semibold">
            <span className="flex min-w-0 items-center gap-[0.6em]">
              <Avatar name={user.name} src={user.avatar} cssSize="2.2em" />
              <span className="truncate">{user.name}</span>
            </span>
            <span className="truncate">@{user.username}</span>
          </footer>
        </div>

        {error && !finishing && (
          <p role="alert" className="absolute inset-x-4 top-[20%] text-center text-sm font-bold text-white">
            {error}
          </p>
        )}

        {/* kept mounted so it can fade, and sits above the name row so it covers as little as possible */}
        <div
          role="toolbar"
          aria-label="Session controls"
          onClickCapture={releaseFocus}
          style={{ bottom: "calc(var(--pad) + 3em)" }}
          className={`absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/40 p-1 backdrop-blur-md transition-opacity duration-300 [text-shadow:none] ${
            showBar ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            onClick={onTogglePause}
            disabled={pending}
            aria-label={paused ? "Resume session" : "Pause session"}
            title={paused ? "Resume" : "Pause"}
            className={barButton}
          >
            <Icon name={paused ? "startFocus" : "pause"} />
          </button>
          <button onClick={onFinish} disabled={pending} aria-label="Finish session" title="Finish" className={barButton}>
            <Icon name="stop" />
          </button>
          <button onClick={onDiscard} disabled={pending} aria-label="Discard session" title="Discard" className={barButton}>
            <Icon name="delete" />
          </button>
          <button onClick={() => setPicking("scene")} aria-label="Change background" title="Background" className={barButton}>
            <Icon name="image" />
          </button>
          <button onClick={() => setPicking("clock")} aria-label="Change clock style" title="Clock style" className={barButton}>
            <Icon name="clockStyle" />
          </button>
          {canFullscreen && (
            <button
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              className={barButton}
            >
              <Icon name={fullscreen ? "exitFullscreen" : "fullscreen"} />
            </button>
          )}
          <button onClick={onMinimize} aria-label="Minimize" title="Minimize" className={barButton}>
            <Icon name="minimize" />
          </button>
        </div>

        {picking === "scene" && <ScenePanel current={scene} onPick={onPickScene} onClose={() => setPicking(null)} centered />}
        {picking === "clock" && (
          <PickerSheet title="Clock style" onClose={() => setPicking(null)} centered wide>
            <ClockPicker current={clockStyle} accent={scene.accent} onPick={onPickClock} />
          </PickerSheet>
        )}

        {goalPrompt && !picking && (
          <div
            role="alertdialog"
            aria-label="Goal reached"
            style={{ bottom: "calc(var(--pad) + 3em)" }}
            className="absolute left-1/2 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 space-y-3 rounded-3xl border border-white/15 bg-black/55 p-4 text-[15px] backdrop-blur-xl [text-shadow:none]"
          >
            {goalPrompt}
          </div>
        )}

        {finishing && (
          <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/30 p-4 text-[15px] [text-shadow:none]">
            <div className="w-full max-w-md space-y-3 rounded-3xl border border-white/15 bg-black/55 p-5 backdrop-blur-xl">
              {wrapUp}
              {error && <p className="text-center text-sm text-danger">{error}</p>}
            </div>
          </div>
        )}
      </FocusScene>
    </div>,
    document.body,
  );
}
