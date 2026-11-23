"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./floating-timer.css";
import { Icon } from "./icon";
import { SceneBackdrop } from "./scene-art";
import { Clock } from "./clocks/clock";
import { clockSizeStyle } from "./clocks/clock-picker";
import type { ClockStyle } from "@/lib/clock-styles";
import { brand } from "@/lib/brand";
import type { Scene } from "@/lib/scenes";

/**
 * The floating timer: a small window that stays on top of every other app while you work. It's a
 * Document Picture-in-Picture window (Chrome and Edge), and React draws into it through a portal, so
 * it shows the same live session and its buttons act on it directly.
 *
 * It comes in three sizes, each designed for its size: compact (just the time), normal, and full
 * (the whole focus screen in miniature). The window keeps to its size: browsers let people drag a
 * picture-in-picture window's edges, so the design never stretches, and the window springs back the
 * moment it's touched (resizing needs a click, so that's the first chance it gets).
 */

export type FloatMode = "mini" | "normal" | "full";

export const FLOAT_MODES: { id: FloatMode; name: string }[] = [
  { id: "mini", name: "Compact" },
  { id: "normal", name: "Normal" },
  { id: "full", name: "Full" },
];

const SIZES: Record<FloatMode, { width: number; height: number }> = {
  mini: { width: 264, height: 72 },
  normal: { width: 352, height: 128 },
  full: { width: 320, height: 432 },
};

/** The most a clock face is blown up from its picker preview in each size; within that it fills its space. */
const CLOCK_MAX: Record<FloatMode, number> = { mini: 2.4, normal: 2.6, full: 3.6 };

const MODE_KEY = "lockin-float-mode";
const isMode = (v: unknown): v is FloatMode => v === "mini" || v === "normal" || v === "full";

type PipApi = { requestWindow(opts?: { width?: number; height?: number }): Promise<Window>; window: Window | null };
const pipApi = () =>
  typeof window === "undefined" ? undefined : (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;

/** Puts the window back to its size. The frame around it stays the same, so the outer size follows. */
function fitTo(w: Window, mode: FloatMode) {
  const { width, height } = SIZES[mode];
  if (Math.abs(w.innerWidth - width) < 2 && Math.abs(w.innerHeight - height) < 2) return;
  // a picture-in-picture frame is a thin title bar; anything bigger isn't this window's own frame
  const frame = (outer: number, inner: number) => (outer - inner >= 0 && outer - inner <= 80 ? outer - inner : 0);
  try {
    w.resizeTo(width + frame(w.outerWidth, w.innerWidth), height + frame(w.outerHeight, w.innerHeight));
  } catch {
    // only allowed right after a click; it tries again on the next one
  }
}

/** Copies the page's styles into the new window, so it has the same fonts, colours and classes. */
function copyStyles(to: Document) {
  for (const node of document.querySelectorAll('style, link[rel="stylesheet"]')) to.head.appendChild(node.cloneNode(true));
  for (const name of ["class", "style"]) {
    const v = document.documentElement.getAttribute(name);
    if (v) to.documentElement.setAttribute(name, v);
  }
}

const setTitle = (w: Window, title: string) => {
  w.document.title = title;
};

/** Opens and closes the floating window, and keeps it to the chosen size. `can` is false where browsers have no such window. */
export function useFloatingWindow() {
  const [can, setCan] = useState(false);
  const [win, setWin] = useState<Window | null>(null);
  const [mode, setModeState] = useState<FloatMode>("normal");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    setCan(!!pipApi());
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (isMode(saved)) setModeState(saved);
    } catch {
      // normal it is
    }
  }, []);

  const setMode = useCallback((next: FloatMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // it still switches for now
    }
    const w = pipApi()?.window;
    if (w) fitTo(w, next);
  }, []);

  const close = useCallback(() => {
    pipApi()?.window?.close();
    setWin(null);
  }, []);

  const open = useCallback(async () => {
    const api = pipApi();
    if (!api) return;
    if (api.window) return api.window.focus();
    try {
      const w = await api.requestWindow(SIZES[modeRef.current]);
      copyStyles(w.document);
      setTitle(w, brand.name);
      w.document.body.className = "float-body";
      w.addEventListener("pagehide", () => setWin(null), { once: true });
      setWin(w);
    } catch {
      // it needs a click to open, and the browser can refuse; the page timer carries on either way
    }
  }, []);

  // dragged to another size: try to spring back straight away, and again on the next touch
  useEffect(() => {
    if (!win) return;
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => fitTo(win, mode), 150);
    };
    const onDown = () => fitTo(win, mode);
    win.addEventListener("resize", onResize);
    win.addEventListener("pointerdown", onDown, true);
    return () => {
      clearTimeout(t);
      win.removeEventListener("resize", onResize);
      win.removeEventListener("pointerdown", onDown, true);
    };
  }, [win, mode]);

  // the window belongs to the session on this page, so it goes when the page does
  useEffect(() => close, [close]);

  return { can, win, mode, setMode, open, close, toggle: () => (win ? close() : void open()) };
}

type FloatingProps = {
  win: Window;
  mode: FloatMode;
  onMode: (mode: FloatMode) => void;
  scene: Scene;
  clockStyle: ClockStyle;
  clock: string;
  label: string | null;
  phase: string;
  caption: string;
  streak: number;
  remainingSec: number;
  totalSec: number;
  running: boolean;
  paused: boolean;
  overtime: boolean;
  pending: boolean;
  onTogglePause: () => void;
  onFinish: () => void;
};

export function FloatingTimer({ win, mode, onMode, onTogglePause, ...p }: FloatingProps) {
  const progress = p.overtime || p.totalSec <= 0 ? 1 : Math.min(1, Math.max(0, 1 - p.remainingSec / p.totalSec));
  const title = p.label || "Focus";

  // space pauses, and 1 2 3 pick the size, while the little window has focus
  const keys = useRef({ onTogglePause, onMode });
  keys.current = { onTogglePause, onMode };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        keys.current.onTogglePause();
      }
      const pick = FLOAT_MODES[Number(e.key) - 1];
      if (pick) keys.current.onMode(pick.id);
    }
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [win]);

  useEffect(() => {
    setTitle(win, `${p.clock} · ${brand.name}`);
  }, [win, p.clock]);

  const lock = <LockRing progress={progress} paused={p.paused} pending={p.pending} onClick={onTogglePause} ringed={mode !== "full"} />;
  const face = (
    <FitClock key={mode} clockStyle={p.clockStyle} max={CLOCK_MAX[mode]}>
      <Clock
        clockStyle={p.clockStyle}
        remainingSec={p.remainingSec}
        totalSec={p.totalSec}
        running={p.running}
        paused={p.paused}
        overtime={p.overtime}
        accent={p.scene.accent}
      />
    </FitClock>
  );
  const switcher = <ModeSwitch mode={mode} onMode={onMode} />;
  const finish = () => {
    p.onFinish();
    window.focus(); // the wrap-up is on the page
  };

  return createPortal(
    <div
      className="float"
      data-mode={mode}
      data-running={p.running || undefined}
      data-paused={p.paused || undefined}
      data-over={p.overtime || undefined}
      style={{ ["--float-accent" as string]: p.scene.accent, ...SIZES[mode] }}
    >
      <div className="float-backdrop" aria-hidden>
        <SceneBackdrop scene={p.scene} thumb={mode !== "full"} sizes={`${SIZES[mode].width}px`} />
        <div className="float-veil" />
      </div>

      {mode === "mini" && (
        <div className="float-mini">
          {lock}
          {face}
          <div className="float-hover">{switcher}</div>
        </div>
      )}

      {mode === "normal" && (
        <div className="float-normal">
          {lock}
          <div className="float-main">
            <p className="float-head">
              <span className="float-label">{title}</span>
              <span className="float-phase">{p.phase}</span>
            </p>
            {face}
          </div>
          <div className="float-side">
            <div className="float-hover">{switcher}</div>
            <div className="float-buttons">
              <button
                type="button"
                className="float-round"
                data-main
                onClick={onTogglePause}
                disabled={p.pending}
                aria-label={p.paused ? "Resume session" : "Pause session"}
                title={p.paused ? "Resume" : "Pause"}
              >
                <Icon name={p.paused ? "startFocus" : "pause"} size={15} solid />
              </button>
              <button
                type="button"
                className="float-round"
                onClick={finish}
                disabled={p.pending}
                aria-label="Finish session"
                title="End session"
              >
                <Icon name="stop" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "full" && (
        <div className="float-full">
          <div className="float-full-top">
            <p className="float-head">
              <span className="float-label">{title}</span>
              <span className="float-phase">{p.phase}</span>
            </p>
            {switcher}
          </div>
          <div className="float-dial">
            {lock}
            {face}
          </div>
          <p className="float-caption">{p.caption}</p>
          {p.streak > 0 && (
            <p className="float-streak">
              <Icon name="streak" size={14} solid className="text-streak" /> {p.streak} day streak
            </p>
          )}
          <div className="float-full-actions">
            <button type="button" className="float-pill" data-main onClick={onTogglePause} disabled={p.pending}>
              <Icon name={p.paused ? "startFocus" : "pause"} size={16} solid />
              {p.paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className="float-pill" onClick={finish} disabled={p.pending}>
              <Icon name="stop" size={15} />
              End
            </button>
          </div>
        </div>
      )}
    </div>,
    win.document.body,
  );
}

/**
 * Clock faces come in every shape (a wide reel, a tall timer, a round ring), so each one is measured at
 * its picker size and scaled to fill the space it has here. It refits when the face changes size, like
 * the time growing an hour.
 */
function FitClock({ clockStyle, max, children }: { clockStyle: ClockStyle; max: number; children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const face = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const b = box.current;
    const f = face.current;
    const view = b?.ownerDocument.defaultView;
    if (!b || !f || !view) return;
    const fit = () => {
      const w = f.offsetWidth;
      const h = f.offsetHeight;
      const pad = view.getComputedStyle(b);
      const room = (size: number, a: string, z: string) => size - parseFloat(a) - parseFloat(z);
      const roomW = room(b.clientWidth, pad.paddingLeft, pad.paddingRight);
      const roomH = room(b.clientHeight, pad.paddingTop, pad.paddingBottom);
      if (!w || !h || roomW <= 0 || roomH <= 0) return;
      const k = Math.min(roomW / w, roomH / h, max);
      f.style.transform = `scale(${Math.round(k * 1000) / 1000})`;
    };
    fit();
    // the observer has to come from the window the clock is drawn in
    const watch = new view.ResizeObserver(fit);
    watch.observe(b);
    watch.observe(f);
    return () => watch.disconnect();
  }, [max, clockStyle]);

  return (
    <span ref={box} className="float-clock clock-preview">
      <span ref={face} className="float-clock-face" style={clockSizeStyle(clockStyle)}>
        {children}
      </span>
    </span>
  );
}

/** The padlock in a progress ring. Shut while you focus, it pops open on pause, and tapping it does that. */
function LockRing(props: { progress: number; paused: boolean; pending: boolean; onClick: () => void; ringed: boolean }) {
  const { progress, paused, pending, onClick, ringed } = props;
  return (
    <button
      type="button"
      className="float-lock"
      onClick={onClick}
      disabled={pending}
      aria-label={paused ? "Resume session" : "Pause session"}
      title={paused ? "Tap to lock back in" : "Tap to pause"}
    >
      {ringed && (
        <svg viewBox="0 0 48 48" className="float-lock-ring" aria-hidden>
          <circle cx="24" cy="24" r="21" pathLength={1} className="float-track" />
          <circle cx="24" cy="24" r="21" pathLength={1} className="float-fill" style={{ strokeDashoffset: 1 - progress }} />
        </svg>
      )}
      <svg viewBox="0 0 24 24" className="float-padlock" aria-hidden>
        <path className="float-shackle" d="M8.4 14V8.4a3.6 3.6 0 0 1 7.2 0V14" />
        <rect x="4.6" y="10.4" width="14.8" height="11.4" rx="3.6" fill="currentColor" />
        <path className="float-keyhole" d="M12 13.9a1.7 1.7 0 0 0-.85 3.17v1.33a.85.85 0 0 0 1.7 0v-1.33A1.7 1.7 0 0 0 12 13.9z" />
      </svg>
    </button>
  );
}

/** Three little windows, one per size. */
function ModeSwitch({ mode, onMode }: { mode: FloatMode; onMode: (mode: FloatMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Floating timer size" className="float-switch">
      {FLOAT_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === mode}
          aria-label={m.name}
          title={`${m.name} (${FLOAT_MODES.indexOf(m) + 1})`}
          onClick={() => onMode(m.id)}
        >
          <svg viewBox="0 0 20 20" aria-hidden>
            {m.id === "mini" ? (
              <rect x="2.5" y="7" width="15" height="6" rx="3" />
            ) : m.id === "normal" ? (
              <rect x="2.5" y="5" width="15" height="10" rx="2.6" />
            ) : (
              <rect x="5" y="2.5" width="10" height="15" rx="2.6" />
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}
