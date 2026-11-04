"use client";

import { useTransition } from "react";
import { acceptBuddy, nudgeBuddy, removeBuddy, requestBuddy } from "@/app/actions/together";
import type { BuddyState } from "@/lib/social-features";
import { toast } from "./toaster";

const pill = "rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-50";
const solid = `btn-3d bg-primary text-primary-foreground ${pill}`;
const ghost = `border-2 border-border bg-card text-muted ${pill}`;

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

export function BuddyRequestButton({ userId, state, id }: { userId: string; state: BuddyState; id: string | null }) {
  const [pending, start] = useTransition();
  if (state === "buddies") return <span className={ghost}>Buddies</span>;
  const send = () =>
    start(async () => {
      const res = await (state === "outgoing" && id ? removeBuddy(id) : requestBuddy(userId));
      if (res.error) toast(res.error, "error");
    });
  return (
    <button onClick={send} disabled={pending} className={state === "outgoing" ? ghost : solid}>
      {state === "outgoing" ? "Cancel request" : state === "incoming" ? "Accept buddy" : "Add buddy"}
    </button>
  );
}
