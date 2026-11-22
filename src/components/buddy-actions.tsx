"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptBuddy, nudgeBuddy, removeBuddy, requestBuddy } from "@/app/actions/together";
import type { BuddyState } from "@/lib/social-features";
import { usePopover } from "./app-shell";
import { Icon } from "./icon";
import { toast } from "./toaster";

const pill =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap disabled:opacity-50";
const solid = `btn-3d bg-primary text-primary-foreground ${pill}`;
const ghost = `border-2 border-border bg-card text-muted hover:text-foreground ${pill}`;

type Props = { kind: "accept" | "remove" | "nudge"; id: string; label?: string; disabled?: boolean };

export function BuddyAction({ kind, id, label, disabled }: Props) {
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await (kind === "accept" ? acceptBuddy(id) : kind === "nudge" ? nudgeBuddy(id) : removeBuddy(id));
      if (res.error) toast(res.error, "error");
      else if (kind === "nudge") toast("Nudge sent");
    });
  return (
    <button onClick={run} disabled={pending || disabled} className={kind === "remove" ? ghost : solid}>
      {label ?? (kind === "accept" ? "Accept" : "Nudge")}
    </button>
  );
}

/**
 * Nudge a buddy to lock in. Once sent it stays as "Nudged" so you don't wonder whether it went;
 * while they're already focusing there's nothing to nudge, so it says that instead.
 */
export function NudgeButton({ userId, name, live }: { userId: string; name: string; live: boolean }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  if (live)
    return (
      <span className={`${pill} bg-live/12 text-live`}>
        <Icon name="time" size={15} /> Focusing
      </span>
    );
  return (
    <button
      onClick={() =>
        start(async () => {
          const res = await nudgeBuddy(userId);
          if (res.error) return toast(res.error, "error");
          setSent(true);
          toast(`Nudged ${name.split(" ")[0]} to lock in`);
        })
      }
      disabled={pending || sent}
      aria-label={sent ? `Nudged ${name}` : `Nudge ${name} to start focusing`}
      className={sent ? `${ghost} disabled:opacity-100` : solid}
    >
      <Icon name={sent ? "check" : "notifications"} size={15} /> {sent ? "Nudged" : pending ? "Sending…" : "Nudge"}
    </button>
  );
}

/** The rarer actions for a buddy, kept out of the way: their profile, and removing them (after asking). */
export function BuddyMenu({ id, name, username }: { id: string; name: string; username: string }) {
  const pop = usePopover<"menu">();
  const [, start] = useTransition();
  const remove = () => {
    pop.setOpen(null);
    if (!window.confirm(`Remove ${name} as a buddy? You'll stop seeing each other's live status here.`)) return;
    start(async () => {
      const res = await removeBuddy(id);
      if (res.error) toast(res.error, "error");
      else toast(`Removed ${name.split(" ")[0]}`);
    });
  };
  return (
    <div ref={pop.box} className="relative">
      <button
        onClick={() => pop.toggle("menu")}
        aria-expanded={pop.open === "menu"}
        aria-haspopup="menu"
        aria-label={`More for ${name}`}
        className="grid size-9 place-items-center rounded-full text-muted hover:bg-inset hover:text-foreground aria-expanded:bg-inset"
      >
        <Icon name="more" size={18} />
      </button>
      {pop.open && (
        <div role="menu" data-menu className="app-pop absolute top-[calc(100%+6px)] right-0 z-10">
          <Link role="menuitem" href={`/dashboard/u/${username}`} className="app-menu-row">
            <Icon name="profile" size={18} /> View profile
          </Link>
          <button role="menuitem" onClick={remove} className="app-menu-row text-danger">
            <Icon name="delete" size={18} /> Remove buddy
          </button>
        </div>
      )}
    </div>
  );
}

export function BuddyRequestButton({ userId, state, id }: { userId: string; state: BuddyState; id: string | null }) {
  const [pending, start] = useTransition();
  if (state === "buddies")
    return (
      <span className={ghost}>
        <Icon name="check" size={15} /> Buddies
      </span>
    );
  const send = () =>
    start(async () => {
      const res = await (state === "outgoing" && id ? removeBuddy(id) : requestBuddy(userId));
      if (res.error) toast(res.error, "error");
    });
  return (
    <button onClick={send} disabled={pending} className={state === "outgoing" ? ghost : solid}>
      {state === "none" && <Icon name="buddies" size={15} />}
      {state === "outgoing" ? "Cancel request" : state === "incoming" ? "Accept buddy" : "Add buddy"}
    </button>
  );
}
