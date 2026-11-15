/**
 * Feed playback: one card plays at a time, and frames grabbed from a timelapse are kept per post
 * so the filmstrip doesn't decode the video again when the card remounts.
 */
let current: { id: string; stop: () => void } | null = null;

/** Call when a card starts playing. Whatever was playing before stops. */
export function claimPlayback(id: string, stop: () => void) {
  if (current && current.id !== id) current.stop();
  current = { id, stop };
}

export function releasePlayback(id: string) {
  if (current?.id === id) current = null;
}

const frameCache = new Map<string, Promise<string[] | null>>();

const SEEK_TIMEOUT_MS = 3000;

function once(el: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), SEEK_TIMEOUT_MS);
    el.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    el.addEventListener("error", () => reject(new Error("video error")), { once: true });
  });
}

/**
 * Grabs evenly spaced stills from a timelapse, on a copy of the video, never the one that's playing.
 * Null when it can't: a file host without CORS headers taints the canvas, and some browsers won't seek
 * a recorded WebM. The filmstrip then falls back to the artwork.
 */
export function timelapseFrames(postId: string, src: string, count: number, estimateSec: number) {
  let job = frameCache.get(postId);
  if (!job) {
    job = grab(src, count, estimateSec).catch(() => null);
    frameCache.set(postId, job);
  }
  return job;
}

async function grab(src: string, count: number, estimateSec: number): Promise<string[] | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.src = src;
  try {
    await once(video, "loadeddata");
    const length = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : estimateSec;
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 108;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      video.currentTime = Math.min(length * ((i + 0.5) / count), Math.max(length - 0.05, 0));
      await once(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.6)); // throws on a tainted canvas
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
