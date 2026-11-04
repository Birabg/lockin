"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "./icon";
import { DrawnBackdrop } from "./focus-scene";
import { scenes, type Scene } from "@/lib/scenes";

function Thumb({ scene, selected, onPick }: { scene: Scene; selected: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      aria-pressed={selected}
      data-selected={selected || undefined}
      className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 ${selected ? "border-primary" : "border-transparent"}`}
    >
      {scene.kind === "image" ? (
        <Image src={scene.thumb} alt="" fill sizes="120px" className="object-cover" />
      ) : (
        <DrawnBackdrop scene={scene} />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-1 text-left text-[11px] font-semibold text-white">
        {scene.title}
      </span>
      {selected && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Icon name="check" size={14} weight="regular" />
        </span>
      )}
    </button>
  );
}

type PanelProps = {
  current: Scene;
  onPick: (id: string) => void;
  onClose: () => void;
  /** Centred above the bottom of the screen, instead of hanging from a button. */
  centered?: boolean;
};

/** A popover on desktop and a bottom sheet on mobile, from one element. */
export function ScenePanel({ current, onPick, onClose, centered = false }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("[data-selected]")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const desktop = centered
    ? "sm:inset-x-auto sm:bottom-24 sm:left-1/2 sm:-translate-x-1/2"
    : "sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 sm:bg-transparent" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-label="Choose a background"
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[16px] text-foreground [text-shadow:none] sm:w-[360px] sm:rounded-2xl ${desktop}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Background</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-muted hover:bg-inset">
            <Icon name="close" size={18} weight="regular" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {scenes.map((s) => (
            <Thumb key={s.id} scene={s} selected={s.id === current.id} onPick={() => onPick(s.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

export function ScenePicker({ current, onPick }: { current: Scene; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1.5 text-sm font-bold text-muted hover:text-foreground"
      >
        <Icon name="image" size={18} /> Background
      </button>
      {open && (
        <ScenePanel
          current={current}
          onPick={onPick}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </div>
  );
}
