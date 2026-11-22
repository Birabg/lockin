"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetches the page's server data every so often while the tab is visible, and straight away when you
 * come back to it, so live status (who's focusing) doesn't go stale. Renders nothing.
 */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
