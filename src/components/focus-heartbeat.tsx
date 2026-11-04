"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { heartbeat } from "@/app/actions/focus";

const BEAT_MS = 30_000;

let channel: BroadcastChannel | null = null;

function focusChannel() {
  if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("lockin-focus");
  return channel;
}

/** Tell other tabs the session changed. A channel doesn't hear its own messages, so this tab won't refresh itself. */
export function notifyFocusChange() {
  focusChannel()?.postMessage("changed");
}

/** Lives in the dashboard layout so a session keeps beating on every page, not just the timer. */
export function FocusHeartbeat({ sessionId, paused }: { sessionId: string | null; paused: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const ch = focusChannel();
    if (!ch) return;
    const onChange = () => router.refresh();
    ch.addEventListener("message", onChange);
    return () => ch.removeEventListener("message", onChange);
  }, [router]);

  useEffect(() => {
    if (!sessionId) return;
    const beat = () =>
      heartbeat(sessionId)
        .then((r) => {
          // ended or paused on another device
          if (!r.alive || r.paused !== paused) router.refresh();
        })
        .catch(() => {});
    beat();
    const id = setInterval(beat, BEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, paused, router]);

  return null;
}
