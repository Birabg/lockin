"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clock } from "./clocks/clock";
import { ClockPicker } from "./clocks/clock-picker";
import {
  Dock,
  DockButton,
  DockDivider,
  DockPopover,
  HomeLink,
  LivePill,
  RoundAction,
  StageBackdrop,
  StageHero,
  stageStyle,
  toggleFullscreen,
  useDockMenu,
  useFullscreen,
  useHandoff,
  useSoundMuted,
} from "./focus-stage";
import { Icon } from "./icon";
import { SceneGrid } from "./scene-picker";
import { brand } from "@/lib/brand";
import type { ClockStyle } from "@/lib/clock-styles";
import type { Scene } from "@/lib/scenes";

const IDLE_MS = 3000;

/** True for a few seconds after any mouse, touch or key activity. */
function useRecentActivity(enabled: boolean) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastMouse = useRef<string | null>(null);

  const wake = useCallback(() => {
    setActive(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), IDLE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;
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
  }, [wake, enabled]);

  return active || !enabled;
}

type StageProps = {
  scene: Scene;
  clockStyle: ClockStyle;
  remainingSec: number;
  totalSec: number;
  running: boolean;
  overtime: boolean;
  paused: boolean;
  /** The short state in the pill: Focusing, Paused, Overtime, Goal reached. */
  phase: string;
  /** The line under the time. */
  caption: string;
  label: string | null;
  recording: boolean;
  streak: number;
  liveCount: number;
  finishing: boolean;
  /** The wrap-up form, shown in a panel while finishing. */
  wrapUp: ReactNode;
  /** The choice shown once the goal is reached, until it's answered. */
  goalPrompt: ReactNode;
  error: string | null;
  pending: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onPickScene: (id: string) => void;
  onPickClock: (style: ClockStyle) => void;
};

type ImmersiveProps = StageProps & {
  timeZone: string;
  now: number;
  /** Fading out, so the page underneath can already be seen. */
  leaving: boolean;
  fadeIn: boolean;
  onCancelFinish: () => void;
  onMinimize: () => void;
};

/** A running session, full screen over everything. */
export function ImmersiveTimer(props: ImmersiveProps) {
  const { leaving, fadeIn, finishing, timeZone, now, goalPrompt } = props;
  const menu = useDockMenu<"scene" | "clock">();
  const recent = useRecentActivity(true);
  const screen = useFullscreen();
  const backdrop = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const handedOff = useHandoff(backdrop, column);

  const showChrome = (recent || props.paused || !!menu.open) && !finishing && !leaving && !goalPrompt;
  const hideCursor = !recent && !finishing && !menu.open && !goalPrompt;

  const keys = useRef({ finishing, menu: menu.open, leaving, onTogglePause: props.onTogglePause, onCancelFinish: props.onCancelFinish });
  keys.current = { finishing, menu: menu.open, leaving, onTogglePause: props.onTogglePause, onCancelFinish: props.onCancelFinish };
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
      if (e.code !== "Space" || k.finishing || k.menu || target.closest("button, a")) return;
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
  const fade = leaving
    ? "pointer-events-none opacity-0 transition-opacity duration-400"
    : fadeIn && !handedOff
      ? "animate-immersive-in"
      : "";

  return createPortal(
    <div
      data-immersive-view
      onClickCapture={releaseFocus}
      style={stageStyle(props.scene)}
      className={`focus-stage fixed inset-0 z-50 h-dvh w-dvw px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] sm:px-6 lg:pt-6 ${fade} ${hideCursor ? "cursor-none" : ""}`}
    >
      <StageBackdrop scene={props.scene} innerRef={backdrop} />

      <header className={`stage-top ${handedOff ? "stage-enter" : ""}`}>
        <p className="stage-top-group text-[13px] font-semibold text-[var(--stage-muted)]">
          <span className="font-black tracking-tight text-[var(--stage-text)] lowercase">{brand.name}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{date}</span>
        </p>
        <LivePill count={props.liveCount} />
      </header>

      <SessionBody {...props} column={column} handedOff={handedOff} showChrome={showChrome} />

      <div ref={menu.wrap} className={`stage-dock-wrap ${handedOff ? "stage-enter" : ""}`}>
        <StagePopovers
          menu={menu}
          scene={props.scene}
          clockStyle={props.clockStyle}
          onPickScene={props.onPickScene}
          onPickClock={props.onPickClock}
        />
        <Dock label="Session tools" hidden={!showChrome}>
          <SoundButton />
          <DockDivider />
          <DockButton icon="image" label="Background" {...menu.triggerProps("scene")} />
          <DockButton icon="clockStyle" label="Clock style" {...menu.triggerProps("clock")} />
          <DockDivider />
          {screen.can && (
            <DockButton
              icon={screen.fullscreen ? "exitFullscreen" : "fullscreen"}
              label={screen.fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
            />
          )}
          <DockButton icon="minimize" label="Minimize" onClick={props.onMinimize} />
        </Dock>
      </div>

      {finishing && (
        <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-black/40 p-4">
          <div className="stage-panel space-y-3 sm:w-[28rem]">
            {props.wrapUp}
            {props.error && <p className="text-center text-sm text-danger">{props.error}</p>}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** A running session inside the page, after minimizing. Same stage, with the sidebar still there. */
export function SessionStage(props: StageProps & { onExpand: () => void }) {
  const menu = useDockMenu<"scene" | "clock">();
  return (
    <section
      aria-label="Focus session"
      style={stageStyle(props.scene)}
      className="focus-stage min-h-dvh px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] sm:px-6 lg:pt-6"
    >
      <StageBackdrop scene={props.scene} />
      <div className="stage-top">
        <HomeLink />
        <LivePill count={props.liveCount} link />
      </div>

      <SessionBody {...props} showChrome />

      <div ref={menu.wrap} className="stage-dock-wrap">
        <StagePopovers
          menu={menu}
          scene={props.scene}
          clockStyle={props.clockStyle}
          onPickScene={props.onPickScene}
          onPickClock={props.onPickClock}
        />
        <Dock label="Session tools">
          <SoundButton />
          <DockDivider />
          <DockButton icon="image" label="Background" {...menu.triggerProps("scene")} />
          <DockButton icon="clockStyle" label="Clock style" {...menu.triggerProps("clock")} />
          <DockDivider />
          <DockButton icon="fullscreen" label="Back to the full screen view" text="Expand" onClick={props.onExpand} />
        </Dock>
      </div>

      {props.finishing && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/40 p-4">
          <div className="stage-panel space-y-3 sm:w-[28rem]">{props.wrapUp}</div>
        </div>
      )}
    </section>
  );
}

function SoundButton() {
  const sound = useSoundMuted();
  return (
    <DockButton
      icon={sound.muted ? "mute" : "sound"}
      label={sound.muted ? "Turn sounds on" : "Mute sounds"}
      text="Sound"
      onClick={sound.toggle}
    />
  );
}

function StagePopovers({
  menu,
  scene,
  clockStyle,
  onPickScene,
  onPickClock,
}: {
  menu: ReturnType<typeof useDockMenu<"scene" | "clock">>;
  scene: Scene;
  clockStyle: ClockStyle;
  onPickScene: (id: string) => void;
  onPickClock: (style: ClockStyle) => void;
}) {
  if (menu.open === "scene")
    return (
      <DockPopover title="Background" onClose={menu.close}>
        <SceneGrid current={scene} onPick={onPickScene} />
      </DockPopover>
    );
  if (menu.open === "clock")
    return (
      <DockPopover title="Clock style" onClose={menu.close} wide>
        <ClockPicker current={clockStyle} accent={scene.accent} onPick={onPickClock} />
      </DockPopover>
    );
  return null;
}

/** The time, a quiet info line, and pause, end and discard. Lines up with the setup screen. */
function SessionBody(props: StageProps & { column?: React.RefObject<HTMLDivElement | null>; handedOff?: boolean; showChrome: boolean }) {
  const { paused, pending, streak, recording, handedOff, showChrome, goalPrompt } = props;
  const enter = handedOff ? "stage-enter" : "";
  return (
    <div ref={props.column} className="stage-center">
      <StageHero
        label={props.label}
        state={props.phase}
        clock={
          <Clock
            clockStyle={props.clockStyle}
            remainingSec={props.remainingSec}
            totalSec={props.totalSec}
            running={props.running}
            paused={paused}
            overtime={props.overtime}
            accent={props.scene.accent}
          />
        }
        caption={props.caption}
        note={recording ? "● Recording screen" : null}
      />

      <div className={`stage-mid ${enter}`}>
        {goalPrompt ? (
          <div role="alertdialog" aria-label="Goal reached" className="stage-panel space-y-3">
            {goalPrompt}
          </div>
        ) : (
          streak > 0 && (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--stage-muted)]">
              <Icon name="streak" size={16} solid className="text-streak" />
              <span className="tabular">{streak}</span> day streak
            </p>
          )
        )}
      </div>

      <div
        className={`stage-actions stage-fade ${enter} ${showChrome || paused ? "" : "stage-hidden"} ${goalPrompt ? "stage-hidden" : ""}`}
      >
        <RoundAction
          onClick={props.onDiscard}
          disabled={pending}
          aria-label="Discard session"
          icon={<Icon name="delete" size={20} />}
          label="Discard"
        />
        <RoundAction
          big
          tone="accent"
          onClick={props.onTogglePause}
          disabled={pending}
          aria-label={paused ? "Resume session" : "Pause session"}
          icon={<Icon name={paused ? "startFocus" : "pause"} size={28} solid />}
          label={paused ? "Resume" : "Pause"}
        />
        <RoundAction
          onClick={props.onFinish}
          disabled={pending}
          aria-label="Finish session"
          icon={<Icon name="stop" size={20} />}
          label="End"
        />
      </div>

      {/* always takes its line, so the time sits where it did on the setup screen */}
      <p role="alert" className="min-h-5 text-center text-sm font-semibold text-danger">
        {props.finishing ? null : props.error}
      </p>
    </div>
  );
}
