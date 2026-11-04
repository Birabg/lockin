import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { brand } from "./brand";
import { SPLASH, SPLASH_TOTAL, splashScript } from "./splash";

describe("splash", () => {
  it("lasts 5 seconds, inside the cap", () => {
    expect(SPLASH_TOTAL).toBe(5000);
    expect(SPLASH_TOTAL).toBeLessThan(SPLASH.cap);
  });

  it("uses the same background as the page", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(`--background: ${brand.background};`);
  });

  it("is a plain script with nothing left to fill in", () => {
    expect(() => new Function(splashScript)).not.toThrow();
    expect(splashScript).not.toContain("undefined");
  });
});
