import { describe, expect, it } from "vitest";
import { cleanYouTube, parseYouTube, youTubeEmbedUrl, youTubeWatchUrl } from "./youtube";

const ID = "jfKfPfyJRdk";
const LIST = "PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo";

describe("reading YouTube links", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc123`,
    `youtu.be/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  ${ID}  `,
  ])("finds the video in %s", (input) => {
    expect(parseYouTube(input)).toEqual({ video: ID, list: null });
  });

  it("keeps the playlist with a video, and reads playlist-only links", () => {
    expect(parseYouTube(`https://www.youtube.com/watch?v=${ID}&list=${LIST}`)).toEqual({ video: ID, list: LIST });
    expect(parseYouTube(`https://www.youtube.com/playlist?list=${LIST}`)).toEqual({ video: null, list: LIST });
  });

  it.each([
    "",
    "lofi beats",
    "https://example.com/watch?v=jfKfPfyJRdk",
    "https://youtube.com.evil.example/watch?v=jfKfPfyJRdk",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/watch?v=jfKfPfyJRdk%22onload",
    "javascript:alert(1)",
  ])("refuses %s", (input) => {
    expect(parseYouTube(input)).toBeNull();
  });

  it("only trusts well-formed ids read back from storage", () => {
    expect(cleanYouTube({ video: ID, list: null })).toEqual({ video: ID, list: null });
    expect(cleanYouTube({ video: "<script>", list: null })).toBeNull();
    expect(cleanYouTube("x")).toBeNull();
    expect(cleanYouTube(null)).toBeNull();
  });
});

describe("the player", () => {
  it("loops a single video by making it its own playlist", () => {
    const url = new URL(youTubeEmbedUrl({ video: ID, list: null }, "http://localhost:3000"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe(`/embed/${ID}`);
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("loop")).toBe("1");
    expect(url.searchParams.get("playlist")).toBe(ID);
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("http://localhost:3000");
  });

  it("plays a playlist", () => {
    const url = new URL(youTubeEmbedUrl({ video: null, list: LIST }, "https://lockin.example"));
    expect(url.pathname).toBe("/embed/videoseries");
    expect(url.searchParams.get("list")).toBe(LIST);
    expect(url.searchParams.get("loop")).toBeNull();
  });

  it("links back to YouTube", () => {
    expect(youTubeWatchUrl({ video: ID, list: null })).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(youTubeWatchUrl({ video: null, list: LIST })).toBe(`https://www.youtube.com/playlist?list=${LIST}`);
  });
});
