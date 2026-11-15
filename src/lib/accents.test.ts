import { describe, expect, it } from "vitest";
import { ACCENTS, DEFAULT_ACCENT, accentScript, accentTokens, isHex } from "./accents";

describe("accents", () => {
  it("has plenty of unique, valid colours, including the default", () => {
    expect(ACCENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
    expect(ACCENTS.every((a) => isHex(a.hex))).toBe(true);
    expect(ACCENTS.some((a) => a.hex === DEFAULT_ACCENT)).toBe(true);
  });

  it("puts dark text on light accents and white text on deep ones", () => {
    expect(accentTokens("#ffe08a")["--primary-foreground"]).toBe("#111113");
    expect(accentTokens("#5b4fd6")["--primary-foreground"]).toBe("#ffffff");
  });

  it("derives a darker edge and a lighter text shade", () => {
    const t = accentTokens("#4f8ff7");
    expect(t["--primary"]).toBe("#4f8ff7");
    expect(parseInt(t["--primary-shadow"].slice(1, 3), 16)).toBeLessThan(0x4f);
    expect(parseInt(t["--primary-text"].slice(1, 3), 16)).toBeGreaterThan(0x4f);
  });

  it("falls back to the default for junk", () => {
    expect(accentTokens("red")["--primary"]).toBe(DEFAULT_ACCENT);
  });

  it("head script applies the same tokens the app does", () => {
    const set: Record<string, string> = {};
    const g = globalThis as Record<string, unknown>;
    g.localStorage = { getItem: () => "#a66bff" };
    g.document = { documentElement: { style: { setProperty: (k: string, v: string) => (set[k] = v) } } };
    new Function(accentScript)();
    delete g.localStorage;
    delete g.document;
    expect(set).toEqual(accentTokens("#a66bff"));
  });
});
