"use client";

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
      className={`relative aspect-[4/3] overflow-hidden rounded-xl ring-1 transition-shadow ${
        selected ? "ring-2 ring-[var(--stage-text)]" : "ring-[var(--stage-line)] hover:ring-[var(--stage-muted)]"
      }`}
    >
      {scene.kind === "image" ? (
        <Image src={scene.thumb} alt="" fill sizes="120px" className="object-cover" />
      ) : (
        <DrawnBackdrop scene={scene} />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-1.5 py-1 text-left text-[11px] font-semibold text-white">
        {scene.title}
      </span>
      {selected && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-[var(--stage-fill-active)] text-[var(--stage-on-active)]">
          <Icon name="check" size={14} />
        </span>
      )}
    </button>
  );
}

/** The backgrounds, as a grid of thumbnails. Lives in a dock popover on the focus screens. */
export function SceneGrid({ current, onPick }: { current: Scene; onPick: (id: string) => void }) {
  return (
    <div role="group" aria-label="Backgrounds" className="grid grid-cols-3 gap-2">
      {scenes.map((s) => (
        <Thumb key={s.id} scene={s} selected={s.id === current.id} onPick={() => onPick(s.id)} />
      ))}
    </div>
  );
}
