"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { toast } from "./toaster";

/**
 * Copies text and says so: the icon turns into a tick for a moment. When `share` is set and the device
 * has a share sheet (phones), it opens that instead, which is how people actually send links there.
 */
export function CopyButton({
  text,
  children,
  className = "",
  label,
  share,
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  /** accessible name when there's no visible text */
  label?: string;
  share?: { title: string };
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const url = text.startsWith("/") ? `${location.origin}${text}` : text;
    if (share && navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: share.title, url });
        return;
      } catch {
        // dismissed, or not allowed: fall back to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      toast("Couldn't copy. Select it and copy instead.", "error");
    }
  }

  return (
    <button type="button" onClick={copy} aria-label={label} className={className} data-copied={done || undefined}>
      <Icon name={done ? "check" : share ? "share" : "copy"} size={16} className={done ? "text-live" : ""} />
      {children}
      <span className="sr-only" aria-live="polite">
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}
