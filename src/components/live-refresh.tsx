"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 20_000;

/**
 * Re-fetches the current page's server data on a timer while the tab is visible. That one call keeps
 * "Focusing now", the leaderboard, the feed and the unread badge fresh, and React keeps typed text and scroll.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, EVERY_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
  return null;
}
