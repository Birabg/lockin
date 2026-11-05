import { useState } from "react";

/** The value now and the one it just replaced. Nothing was replaced on first show, so a refresh doesn't animate. */
export function useChange<T>(value: T) {
  const [shown, setShown] = useState<{ now: T; before: T | null }>({ now: value, before: null });
  if (shown.now !== value) setShown({ now: value, before: shown.now });
  return shown;
}
