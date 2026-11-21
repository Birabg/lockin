"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icon";

/**
 * Searches as you type (after a short pause), keeps the current tab, and has a clear button.
 * It's still a plain GET form, so Enter works without JavaScript too.
 */
export function PeopleSearch({ q, tab }: { q: string; tab: string }) {
  const router = useRouter();
  const path = usePathname();
  const [value, setValue] = useState(q);
  const [shown, setShown] = useState(q);
  // what this box last searched for, so its own result coming back doesn't overwrite newer typing
  const [sent, setSent] = useState(q);
  const [pending, start] = useTransition();
  // the search changed from outside the box (a "Clear search" link, back/forward): follow it
  if (q !== shown) {
    setShown(q);
    if (q !== sent) setValue(q);
  }
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function go(next: string) {
    clearTimeout(timer.current);
    setSent(next.trim());
    const params = new URLSearchParams();
    if (tab !== "discover") params.set("tab", tab);
    if (next.trim()) params.set("q", next.trim());
    const qs = params.toString();
    start(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  // "/" jumps to the search box, like most sites
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || el.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      {tab !== "discover" && <input type="hidden" name="tab" value={tab} />}
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle">
        {pending ? <span className="people-spinner" aria-hidden /> : <Icon name="search" size={18} />}
      </span>
      <input
        ref={input}
        name="q"
        type="search"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => go(next), 280);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            setValue("");
            go("");
          }
        }}
        aria-label="Search people"
        placeholder="Search by name or @username"
        autoComplete="off"
        spellCheck={false}
        className="people-search-input"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            go("");
            input.current?.focus();
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-subtle hover:bg-card hover:text-foreground"
        >
          <Icon name="close" size={16} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-border px-1.5 text-[11px] font-bold text-subtle sm:block">
          /
        </kbd>
      )}
    </form>
  );
}
