"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { heartbeat } from "@/app/actions/focus";

const BEAT_MS = 30_000;

/** Lives in the dashboard layout so a session keeps beating on every page, not just the timer. */
export function FocusHeartbeat({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;
    const beat = () =>
      heartbeat(sessionId)
        .then((r) => {
          if (!r.alive) router.refresh();
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
  }, [sessionId, router]);

  return null;
}
