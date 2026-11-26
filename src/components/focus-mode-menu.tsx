"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { FOCUS_MODES, focusHref } from "@/lib/focus-mode";

/** What Lock in opens: the two ways to focus, each going to the timer set up for it. */
export function FocusModeMenu({ onPick }: { onPick?: () => void }) {
  return (
    <div className="p-1.5">
      <p className="px-2.5 pt-1.5 pb-1 text-[12.5px] font-semibold text-muted">How do you want to focus?</p>
      {FOCUS_MODES.map((m) => (
        <Link key={m.id} href={focusHref(m.id)} onClick={onPick} data-tall className="app-menu-row">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary-text">
            <Icon name={m.id === "pomodoro" ? "pomodoro" : "startFocus"} size={18} solid />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">{m.label}</span>
            <span className="block text-[12.5px] font-medium text-muted">{m.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
