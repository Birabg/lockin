"use client";

import { useEffect, useState } from "react";
import { usePopover } from "./app-shell";

/** A short, Lockin-flavoured set: cheering people on first, then everyday feelings and study things. */
const EMOJIS = [
  "🔥", "💪", "🧠", "🎯", "🫡", "👏",
  "🙌", "💯", "⚡", "🚀", "✨", "😤",
  "😎", "😂", "🥲", "❤️", "👀", "🙏",
  "✅", "⏳", "📚", "☕", "🎧", "🌙",
];

const WIDTH = 236;

/**
 * A smiley button that opens a grid of emoji. Picking one calls `onPick` and leaves the grid open for more.
 * The grid is fixed to the viewport so a card's clipping can't cut it off, and follows the button on scroll.
 */
export function EmojiButton({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const pop = usePopover<"emoji">();
  const [at, setAt] = useState({ x: 0, y: 0 });

  function place() {
    const box = pop.box.current?.getBoundingClientRect();
    if (!box) return;
    const half = WIDTH / 2 + 8;
    setAt({ x: Math.min(Math.max(box.left + box.width / 2, half), window.innerWidth - half), y: box.top });
  }

  // keeps the grid on the button while the page scrolls or resizes
  useEffect(() => {
    if (!pop.open) return;
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place only reads the ref
  }, [pop.open]);

  function toggle() {
    place();
    pop.toggle("emoji");
  }

  return (
    <div ref={pop.box} className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label="Add an emoji"
        aria-haspopup="true"
        aria-expanded={!!pop.open}
        className="grid size-7 place-items-center rounded-full text-[17px] leading-none text-muted grayscale transition hover:bg-[var(--card)] hover:grayscale-0 aria-expanded:grayscale-0 disabled:opacity-40"
      >
        <span aria-hidden>🙂</span>
      </button>
      {pop.open && (
        <div
          role="group"
          aria-label="Emoji"
          className="app-pop emoji-pop grid grid-cols-6 gap-0.5 p-2"
          style={{ position: "fixed", width: WIDTH, left: at.x, top: at.y }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              aria-label={`Add ${e}`}
              className="grid aspect-square place-items-center rounded-xl text-[21px] leading-none transition-transform hover:scale-125 hover:bg-inset focus-visible:scale-125 focus-visible:bg-inset"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
