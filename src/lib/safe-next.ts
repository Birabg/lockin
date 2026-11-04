const FALLBACK = "/dashboard";
const BASE = "http://lockin.invalid";

/**
 * Only allow redirects to paths on this site. Parsing with URL matches how browsers read the
 * value, so tricks like "//evil.com" and "/\evil.com" resolve to another origin and get rejected.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return FALLBACK;
  try {
    const url = new URL(value, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
