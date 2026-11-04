import { recordViews } from "@/app/actions/social";

const FLUSH_MS = 3000;

const seen = new Set<string>();
const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = queue.splice(0, 50);
  if (queue.length > 0) timer = setTimeout(flush, FLUSH_MS);
  // a lost view isn't worth bothering anyone about
  recordViews(ids).catch(() => {});
}

/** Batches what's scrolled past, so a feed costs one request every few seconds at most. */
export function trackView(postId: string) {
  if (seen.has(postId)) return;
  seen.add(postId);
  queue.push(postId);
  timer ??= setTimeout(flush, FLUSH_MS);
}
