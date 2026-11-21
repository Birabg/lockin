/** Feed playback: one card plays at a time. */
let current: { id: string; stop: () => void } | null = null;

/** Call when a card starts playing. Whatever was playing before stops. */
export function claimPlayback(id: string, stop: () => void) {
  if (current && current.id !== id) current.stop();
  current = { id, stop };
}

export function releasePlayback(id: string) {
  if (current?.id === id) current = null;
}
