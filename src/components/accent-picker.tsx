"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./accent-picker.css";
import { Icon } from "./icon";
import { ACCENTS, ACCENT_GROUPS, ACCENT_KEY, DEFAULT_ACCENT, readAccent, saveAccent } from "@/lib/accents";

const nameOf = (hex: string) => ACCENTS.find((a) => a.hex.toLowerCase() === hex.toLowerCase())?.name ?? "Custom";

/** The accent this device uses, kept in sync with changes made from any other tab or component. */
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
 * on this device. Lives on the Settings page.
 */
export function AccentPicker() {
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
    <div className="accent-picker">
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
                    {on && <Icon name="check" size={15} className="accent-check" />}
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
