"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./accent-picker.css";
import { Icon } from "./icon";
import { ACCENTS, ACCENT_GROUPS, ACCENT_KEY, DEFAULT_ACCENT, readAccent, saveAccent } from "@/lib/accents";

const nameOf = (hex: string) => ACCENTS.find((a) => a.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Custom";

/** The accent this device uses, kept in sync with changes made by any other picker on the page. */
function useAccent() {
  const [hex, setHex] = useState(DEFAULT_ACCENT);
  useEffect(() => {
    setHex(readAccent());
    const sync = (e: Event) => setHex((e as CustomEvent<string>).detail);
    window.addEventListener(ACCENT_KEY, sync);
    return () => window.removeEventListener(ACCENT_KEY, sync);
  }, []);
  return hex;
}

/**
 * A palette of accent colours. Picking one re-tints the whole app straight away and is remembered
 * on this device. `compact` is the smaller version for the account menu.
 */
export function AccentPicker({ compact = false }: { compact?: boolean }) {
  const current = useAccent();
  const grid = useRef<HTMLDivElement>(null);
  const [bounce, setBounce] = useState<string | null>(null);
  const custom = !ACCENTS.some((a) => a.hex.toLowerCase() === current.toLowerCase());

  function pick(hex: string) {
    saveAccent(hex);
    setBounce(hex);
  }

  // arrow keys walk the swatches, like any radio group
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = [...(grid.current?.querySelectorAll<HTMLButtonElement>("[role=radio]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + step + items.length) % items.length;
    items[next].focus();
    items[next].click();
  }

  return (
    <div className={`accent-picker ${compact ? "accent-compact" : ""}`}>
      <div className="accent-preview">
        <span className="accent-blob" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-extrabold tracking-[-0.01em]">{nameOf(current)}</span>
          <span className="block font-mono text-[11.5px] text-muted uppercase">{current}</span>
        </span>
        <span className="accent-sample" aria-hidden>
          <Icon name="startFocus" size={14} solid /> Lock in
        </span>
      </div>

      <div ref={grid} role="radiogroup" aria-label="Accent colour" onKeyDown={onKeyDown}>
        {ACCENT_GROUPS.map((g) => (
          <div key={g.name} className="accent-group">
            <p className="accent-group-name">{g.name}</p>
            <div className="accent-row">
              {g.accents.map((a) => {
                const on = a.hex.toLowerCase() === current.toLowerCase();
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={a.name}
                    title={a.name}
                    tabIndex={on || (custom && a.hex === DEFAULT_ACCENT) ? 0 : -1}
                    onClick={() => pick(a.hex)}
                    onAnimationEnd={() => setBounce(null)}
                    data-bounce={bounce === a.hex || undefined}
                    className="accent-swatch"
                    style={{ background: a.hex }}
                  >
                    {on && <Icon name="check" size={compact ? 13 : 15} className="accent-check" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="accent-footer">
        <label className="accent-custom" data-on={custom || undefined}>
          <span className="accent-rainbow" aria-hidden>
            {custom && <span className="accent-rainbow-dot" style={{ background: current }} />}
          </span>
          Custom
          <input
            type="color"
            value={current}
            onChange={(e) => saveAccent(e.target.value)}
            aria-label="Pick any colour"
            className="sr-only"
          />
        </label>
        {current.toLowerCase() !== DEFAULT_ACCENT && (
          <button type="button" onClick={() => pick(DEFAULT_ACCENT)} className="accent-reset">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

/** The current accent as a small dot, for the menu row that opens the picker. */
export function AccentDot() {
  useAccent(); // re-renders on change; the colour itself comes from the CSS variable
  return <span className="accent-dot" aria-hidden />;
}

/** The five quick picks on Home. Phones show the first three. */
const QUICK = ["sky", "bubblegum", "mint", "sunflower", "grape"].map((id) => ACCENTS.find((a) => a.id === id)!);

/**
 * "Choose accent", in the middle of the top bar on Home: a few one-tap colours, and a rainbow
 * button that opens the whole palette.
 */
export function AccentQuick() {
  const current = useAccent();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [bounce, setBounce] = useState<string | null>(null);
  const inQuick = QUICK.some((a) => a.hex.toLowerCase() === current.toLowerCase());

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      box.current?.querySelector<HTMLElement>("[aria-expanded=true]")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="accent-quick">
      <span className="accent-quick-label" aria-hidden>
        Choose accent
      </span>
      <div role="radiogroup" aria-label="Choose accent" className="flex items-center gap-1.5">
        {QUICK.map((a, i) => {
          const on = a.hex.toLowerCase() === current.toLowerCase();
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={a.name}
              data-tip={a.name}
              onClick={() => {
                saveAccent(a.hex);
                setBounce(a.id);
              }}
              onAnimationEnd={() => setBounce(null)}
              data-bounce={bounce === a.id || undefined}
              className={`accent-drop ${i >= 3 ? "max-sm:hidden" : ""}`}
              style={{ background: a.hex }}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={inQuick ? "All accent colours" : `All accent colours, ${nameOf(current)} chosen`}
        data-tip="All colours"
        data-on={!inQuick || undefined}
        className="accent-quick-more"
      >
        <span className="accent-rainbow">{!inQuick && <span className="accent-rainbow-dot" style={{ background: current }} />}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Choose accent" className="app-pop accent-quick-pop">
          <p className="mb-2.5 text-[14.5px] font-extrabold tracking-[-0.02em]">Choose accent</p>
          <AccentPicker compact />
        </div>
      )}
    </div>
  );
}
