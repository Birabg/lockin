"use client";

import "./focus-stage.css";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { SceneBackdrop } from "./scene-art";
import { Icon, type IconName } from "./icon";
import { prefersReducedMotion } from "@/lib/motion";
import type { Scene } from "@/lib/scenes";

/* The setup screen and the running session are built from these, so starting a session reads as the same screen coming alive. */

export const stageStyle = (scene: Scene) => ({ "--stage-accent": scene.accent }) as CSSProperties;

export function StageBackdrop({ scene, innerRef }: { scene: Scene; innerRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} className="stage-backdrop" aria-hidden>
      <SceneBackdrop scene={scene} priority />
      <div className="stage-veil" />
    </div>
  );
}

export function StagePill({ children, strong = false, className = "" }: { children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <span className={`stage-pill ${className}`} data-strong={strong || undefined}>
      {children}
    </span>
  );
}

/** The way out of the focus page, which has no top bar or dock. */
export function HomeLink() {
  return (
    <Link href="/dashboard" aria-label="Home" title="Home" className="stage-pill px-2.5">
      <Icon name="home" size={17} />
    </Link>
  );
}

/** "● 3 focusing right now". A link while setting up, plain text during a session so it can't navigate away. */
export function LivePill({ count, link = false }: { count: number; link?: boolean }) {
  const body = (
    <>
      <span className="stage-dot animate-live" data-tone="live" aria-hidden />
      <span>
        <span className="tabular">{count}</span> focusing<span className="max-sm:hidden"> right now</span>
      </span>
    </>
  );
  return link ? (
    <Link href="/dashboard/focusing" className="stage-pill">
      {body}
    </Link>
  ) : (
    <span className="stage-pill">{body}</span>
  );
}

type HeroProps = {
  label: string | null;
  state: string;
  clock: ReactNode;
  caption: ReactNode;
  note?: ReactNode;
  heroRef?: RefObject<HTMLDivElement | null>;
};

/** The tag and status pills, the time, and the line under it. Identical in setup and session. */
export function StageHero({ label, state, clock, caption, note, heroRef }: HeroProps) {
  return (
    <div ref={heroRef} data-stage-hero className="stage-hero">
      <div className="stage-pills">
        <StagePill strong className="max-w-[min(60vw,280px)]">
          <span className="stage-dot" aria-hidden />
          <span className="truncate" title={label || undefined}>
            {label || "Focus"}
          </span>
        </StagePill>
        <StagePill>{state}</StagePill>
      </div>
      {clock}
      <div>
        <p className="stage-caption">{caption}</p>
        <p role="status" className="stage-note">
          {note}
        </p>
      </div>
    </div>
  );
}

type RoundProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: ReactNode;
  tone?: "accent" | "ghost";
  big?: boolean;
  /** Drawn inside the disc, behind the icon: the hold ring and the lock pulse. */
  extra?: ReactNode;
};

export function RoundAction({ icon, label, tone = "ghost", big = false, extra, className = "", ...rest }: RoundProps) {
  return (
    <button {...rest} className={`stage-action ${className}`} data-tone={tone} data-big={big || undefined}>
      <span className="stage-action-disc">
        {extra}
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

/* ---- Dock ---- */

export function Dock({ children, hidden = false, label }: { children: ReactNode; hidden?: boolean; label: string }) {
  return (
    <div role="toolbar" aria-label={label} className={`stage-dock ${hidden ? "stage-hidden" : ""}`}>
      {children}
    </div>
  );
}

type DockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; text?: string };

/** Icon and label, collapsing to the icon on narrow screens. The aria-label carries the full name. */
export function DockButton({ icon, label, text, className = "", ...rest }: DockButtonProps) {
  return (
    <button aria-label={label} title={label} {...rest} className={`stage-dock-btn ${className}`}>
      <Icon name={icon} size={19} />
      <span className="stage-dock-label" aria-hidden>
        {text ?? label}
      </span>
    </button>
  );
}

export const DockDivider = ({ className = "" }: { className?: string }) => (
  <span className={`stage-dock-divider ${className}`} aria-hidden />
);

/** Which dock popover is open, closing on a press anywhere outside the dock. */
export function useDockMenu<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(null);
    }
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const toggle = (id: T) => setOpen((v) => (v === id ? null : id));
  const triggerProps = (id: T) => ({ "aria-expanded": open === id, "aria-haspopup": "dialog" as const, onClick: () => toggle(id) });
  return { open, setOpen, wrap, triggerProps, close: () => setOpen(null) };
}

/** A small panel rising from the dock. Escape closes it and puts focus back where it was. */
export function DockPopover({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const el = panel.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = el?.querySelector<HTMLElement>("[data-selected]") ?? el?.querySelector<HTMLElement>("input, button");
    first?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const inside = el?.contains(document.activeElement) || document.activeElement === document.body;
      if (inside && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div ref={panel} role="dialog" aria-label={title} className="stage-popover" data-wide={wide || undefined}>
      <div className="stage-popover-head">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close" className="stage-popover-close">
          <Icon name="close" size={18} />
        </button>
      </div>
      {children}
    </div>
  );
}

/* ---- Shared behaviour ---- */

export function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  change.catch(() => {}); // browsers can refuse, and the timer works the same without it
}

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const [can, setCan] = useState(false);
  useEffect(() => {
    setCan(document.fullscreenEnabled);
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return { fullscreen, can };
}

/* ---- Handing off from setup to session ----
   Just before a session starts, the setup screen notes where its stage and time sit. The session view
   then opens from that box and slides the time across, instead of appearing as a new page. */

type Handoff = { stage: DOMRect; hero: DOMRect };
let handoff: Handoff | null = null;

export function captureHandoff() {
  const stage = document.querySelector("[data-stage=setup]");
  const hero = stage?.querySelector("[data-stage-hero]");
  handoff = stage && hero ? { stage: stage.getBoundingClientRect(), hero: hero.getBoundingClientRect() } : null;
}

/** True when this view is taking over from the setup screen. Read once, when it mounts. */
export function useHandoff(backdrop: RefObject<HTMLElement | null>, column: RefObject<HTMLElement | null>) {
  const [from] = useState(() => handoff);
  useLayoutEffect(() => {
    handoff = null;
    if (!from || prefersReducedMotion()) return;
    const timing = { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
    const { stage, hero } = from;
    backdrop.current?.animate(
      [
        { clipPath: `inset(${stage.top}px ${innerWidth - stage.right}px ${innerHeight - stage.bottom}px ${stage.left}px)` },
        { clipPath: "inset(0px 0px 0px 0px)" },
      ],
      timing,
    );
    const now = column.current?.querySelector("[data-stage-hero]")?.getBoundingClientRect();
    if (now)
      column.current?.animate(
        [{ transform: `translate(${hero.left - now.left}px, ${hero.top - now.top}px)` }, { transform: "none" }],
        timing,
      );
  }, [from, backdrop, column]);
  return !!from;
}
