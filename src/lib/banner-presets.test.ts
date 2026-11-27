import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_PRESETS, bannerUrl, isBannerPreset, isBannerPresetUrl } from "./banner-presets";

describe("banner presets", () => {
  it("has a 1200×300 SVG in public/ for every preset", () => {
    for (const p of BANNER_PRESETS) {
      const file = join(process.cwd(), "public", bannerUrl(p.id));
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toMatch(/^<svg [^>]*viewBox="0 0 1200 300"/);
    }
  });

  it("only accepts its own ids and urls", () => {
    expect(isBannerPreset("dusk")).toBe(true);
    expect(isBannerPreset("../dusk")).toBe(false);
    expect(isBannerPresetUrl("/banners/dusk.svg")).toBe(true);
    expect(isBannerPresetUrl("/media/banners/u1/x.jpg")).toBe(false);
    expect(isBannerPresetUrl(null)).toBe(false);
  });
});
