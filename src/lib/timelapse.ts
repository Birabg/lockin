/**
 * Screen timelapse. Samples a small frame every few seconds while a session runs, then plays the
 * frames through MediaRecorder at full speed, so an hour comes out as about 30 seconds of video.
 * Lives at module level so it keeps running when you move between dashboard pages.
 */
const WIDTH = 640;
const SAMPLE_MS = 5000;
const MAX_FRAMES = 1200; // keeps memory around 40 MB. Past this, every other frame goes and sampling slows down.
const PLAYBACK_FPS = 24;

type Capture = { stream: MediaStream; video: HTMLVideoElement; timer: number };

let capture: Capture | null = null;
let frames: Blob[] = [];
let sampleMs = SAMPLE_MS;

export const canRecordScreen = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
export const hasFrames = () => frames.length > 0;
export const isRecording = () => !!capture;

function grabFrame(video: HTMLVideoElement) {
  if (!video.videoWidth) return;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * WIDTH);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(
    (b) => {
      if (!b) return;
      frames.push(b);
      if (frames.length >= MAX_FRAMES) {
        frames = frames.filter((_, i) => i % 2 === 0);
        sampleMs *= 2;
        if (capture) {
          clearInterval(capture.timer);
          capture.timer = window.setInterval(() => grabFrame(video), sampleMs);
        }
      }
    },
    "image/jpeg",
    0.7,
  );
}

/** Must be called from a click: browsers only show the screen picker after a user gesture. */
export async function startRecording() {
  discardRecording();
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false });
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  grabFrame(video);
  const timer = window.setInterval(() => grabFrame(video), sampleMs);
  capture = { stream, video, timer };
  // the browser's own "stop sharing" button: keep what we have
  stream.getVideoTracks()[0]?.addEventListener("ended", stopRecording);
}

export function stopRecording() {
  if (!capture) return;
  clearInterval(capture.timer);
  capture.stream.getTracks().forEach((t) => t.stop());
  capture.video.srcObject = null;
  capture = null;
}

export function discardRecording() {
  stopRecording();
  frames = [];
  sampleMs = SAMPLE_MS;
}

const pickType = () =>
  ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t));

/** Turns the sampled frames into a video. Takes frames / 24 seconds. */
export async function buildTimelapse(): Promise<Blob | null> {
  stopRecording();
  const type = pickType();
  if (frames.length < 2 || !type) return null;

  const first = await createImageBitmap(frames[0]);
  const canvas = document.createElement("canvas");
  canvas.width = first.width;
  canvas.height = first.height;
  const ctx = canvas.getContext("2d");
  first.close();
  if (!ctx) return null;

  const stream = canvas.captureStream(PLAYBACK_FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start();

  for (const frame of frames) {
    const bitmap = await createImageBitmap(frame);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    await new Promise((r) => setTimeout(r, 1000 / PLAYBACK_FPS));
  }
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  frames = [];
  sampleMs = SAMPLE_MS;
  return new Blob(chunks, { type: type.split(";")[0] });
}
