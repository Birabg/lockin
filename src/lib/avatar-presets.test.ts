import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, isAvatarPreset, isPresetUrl, presetUrl } from "./avatar-presets";

describe("avatar presets", () => {
  it("has an SVG in public/ for every preset", () => {
    for (const p of AVATAR_PRESETS) {
      const file = join(process.cwd(), "public", presetUrl(p.id));
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toMatch(/^<svg [^>]*viewBox="0 0 256 256"/);
    }
  });

  it("only accepts its own ids and urls", () => {
    expect(isAvatarPreset("owl")).toBe(true);
    expect(isAvatarPreset("../owl")).toBe(false);
    expect(isPresetUrl("/avatars/owl.svg")).toBe(true);
    expect(isPresetUrl("/media/avatars/u1/x.png")).toBe(false);
    expect(isPresetUrl(null)).toBe(false);
  });
});
