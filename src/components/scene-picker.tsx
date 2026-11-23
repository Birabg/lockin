"use client";

import { useState, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { SceneBackdrop } from "./scene-art";
import { categoryOf, pickerScenes, sceneCategories, toggleRainId, type Scene, type SceneCategoryId } from "@/lib/scenes";

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
      <SceneBackdrop scene={scene} sizes="120px" thumb />
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

/**
 * The backgrounds in tabs by category, opening on the chosen one's, each a grid of thumbnails, with a switch that puts rain over whichever one is
 * chosen. Lives in a dock popover on the focus screens.
 */
export function SceneGrid({ current, onPick }: { current: Scene; onPick: (id: string) => void }) {
  const rainId = toggleRainId(current);
  const raining = !!current.rain;
  // a rainy scene that isn't in the grid, like a photo with rain, still shows its dry tile as chosen
  const shown = pickerScenes.some((s) => s.id === current.id) ? current.id : current.id.replace(/\+rain$/, "");
  const [tab, setTab] = useState<SceneCategoryId>(() => categoryOf(current));
  const category = sceneCategories.find((c) => c.id === tab) ?? sceneCategories[0];

  // arrow keys move along the tabs, like any tab list
  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = sceneCategories.findIndex((c) => c.id === tab);
    const next = sceneCategories[(at + step + sceneCategories.length) % sceneCategories.length].id;
    setTab(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={raining}
        disabled={rainId === null}
        onClick={() => rainId && onPick(rainId)}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold ring-1 ring-[var(--stage-line)] hover:ring-[var(--stage-muted)] disabled:opacity-60"
      >
        <span aria-hidden className="text-[16px] leading-none">
          🌧️
        </span>
        <span className="min-w-0 flex-1">
          Make it rain
          <span className="block text-[11.5px] font-normal text-[var(--stage-muted)]">
            {rainId === null ? "This one always rains" : "Rain over any background"}
          </span>
        </span>
        <span
          aria-hidden
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${raining ? "bg-[var(--stage-accent)]" : "bg-[var(--stage-line)]"}`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${raining ? "left-[18px]" : "left-0.5"}`}
          />
        </span>
      </button>
      <div role="tablist" aria-label="Background categories" className="scene-tabs" onKeyDown={onTabKey}>
        {sceneCategories.map((c) => {
          const on = c.id === tab;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={`scene-tab-${c.id}`}
              aria-selected={on}
              aria-controls="scene-tab-panel"
              tabIndex={on ? 0 : -1}
              data-tab={c.id}
              onClick={() => setTab(c.id)}
              className="scene-tab"
            >
              {c.name}
              {/* marks the group your background is in, from any tab */}
              {c.scenes.some((s) => s.id === shown) && <span className="scene-tab-dot" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div id="scene-tab-panel" role="tabpanel" aria-labelledby={`scene-tab-${category.id}`} className="grid grid-cols-3 gap-2">
        {category.scenes.map((s) => (
          <Thumb key={s.id} scene={s} selected={s.id === shown} onPick={() => onPick(s.id)} />
        ))}
      </div>
    </div>
  );
}
