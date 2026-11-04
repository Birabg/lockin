const MUTE_KEY = "lockin-dial-muted";
const MIN_GAP_MS = 28; // a fast sweep crosses many steps, and every one of them clicking turns into a buzz

let context: AudioContext | null = null;
let muted = false;
let lastTick = 0;

function audio() {
  if (!context && typeof AudioContext !== "undefined") context = new AudioContext();
  return context;
}

/** Browsers keep audio off until someone interacts, so call this from a real press. */
export function wakeSound() {
  if (!muted)
    audio()
      ?.resume()
      .catch(() => {});
}

function click(from: number, to: number, volume: number, ms: number, delayMs = 0) {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + delayMs / 1000;
  const end = start + ms / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end);
}

function buzz(ms: number) {
  // Chrome complains about vibrating before the first tap, which a mouse wheel can do
  if (typeof navigator.vibrate === "function" && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(ms);
}

export function playTick() {
  const now = performance.now();
  if (now - lastTick < MIN_GAP_MS) return;
  lastTick = now;
  buzz(5);
  if (!muted) click(1500, 500, 0.05, 28);
}

export function playLock() {
  buzz(20);
  if (muted) return;
  click(900, 240, 0.12, 60);
  click(420, 130, 0.14, 90, 55);
}

export function setSoundMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // only means it won't be remembered next time
  }
}

export function loadSoundMuted() {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}
