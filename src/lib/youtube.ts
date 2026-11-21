/**
 * YouTube links people paste into the Music menu. Played in YouTube's own embedded player, so
 * there's no API key, and YouTube's ads and rules apply as they would on youtube.com.
 */

export type YouTubeLink = { video: string | null; list: string | null };

const VIDEO = /^[\w-]{11}$/;
const LIST = /^[\w-]{10,80}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const video = (v: string | null | undefined) => (v && VIDEO.test(v) ? v : null);
const list = (v: string | null | undefined) => (v && LIST.test(v) ? v : null);

/** Reads a video or playlist out of anything YouTube links look like, or null if it isn't one. */
export function parseYouTube(input: string): YouTubeLink | null {
  const text = input.trim();
  if (!text) return null;
  if (VIDEO.test(text)) return { video: text, list: null };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let v: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") v = video(parts[0]);
  else if (HOSTS.has(host)) {
    if (parts[0] === "watch") v = video(url.searchParams.get("v"));
    else if (["embed", "shorts", "live", "v"].includes(parts[0]) && parts[1] !== "videoseries") v = video(parts[1]);
    else if (parts[0] !== "playlist") return null;
  } else return null;

  const l = list(url.searchParams.get("list"));
  return v || l ? { video: v, list: l } : null;
}

/** Checks a link read back from storage, which anyone could have edited. */
export function cleanYouTube(value: unknown): YouTubeLink | null {
  if (!value || typeof value !== "object") return null;
  const v = video((value as YouTubeLink).video);
  const l = list((value as YouTubeLink).list);
  return v || l ? { video: v, list: l } : null;
}

/** The privacy-enhanced player, playing straight away and looping. `origin` lets the page set its volume. */
export function youTubeEmbedUrl(link: YouTubeLink, origin: string): string {
  const params = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0", enablejsapi: "1", origin });
  if (link.list) params.set("list", link.list);
  else if (link.video) {
    params.set("loop", "1");
    params.set("playlist", link.video); // a single video only loops when it's also its own playlist
  }
  const path = link.video ? link.video : "videoseries";
  return `https://www.youtube-nocookie.com/embed/${path}?${params}`;
}

export function youTubeWatchUrl(link: YouTubeLink): string {
  if (link.video) return `https://www.youtube.com/watch?v=${link.video}${link.list ? `&list=${link.list}` : ""}`;
  return `https://www.youtube.com/playlist?list=${link.list}`;
}
