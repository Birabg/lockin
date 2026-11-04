import { useEffect } from "react";

/** Asks to keep the screen on, where the browser can. Browsers drop the lock on hidden tabs, so it's taken again on return. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    async function acquire() {
      if (lock || document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) return void next.release();
        lock = next;
        next.addEventListener("release", () => {
          if (lock === next) lock = null;
        });
      } catch {
        // low battery or a browser policy can refuse, and the session runs fine without it
      }
    }

    function release() {
      void lock?.release();
      lock = null;
    }

    const onVisibility = () => (document.visibilityState === "visible" ? void acquire() : release());

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [active]);
}
