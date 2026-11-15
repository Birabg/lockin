import { describe, expect, it } from "vitest";
import { drawnScenes, isSceneId, pickerScenes, resolveScene, scenes, toggleRainId } from "./scenes";

describe("scenes", () => {
  it("has unique ids", () => {
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
    expect(new Set(pickerScenes.map((s) => s.id)).size).toBe(pickerScenes.length);
  });

  it("keeps the drawn themes as options", () => {
    expect(drawnScenes.map((s) => s.id)).toEqual(["ember", "dusk", "forest", "night"]);
  });

  it("offers the new moods, rainy twins included", () => {
    expect(pickerScenes.slice(0, 8).map((s) => s.title)).toEqual([
      "Rain",
      "Beach",
      "City",
      "City + rain",
      "Library",
      "Library + rain",
      "Window view",
      "Window view + rain",
    ]);
  });

  it("finds a saved scene", () => {
    expect(resolveScene("dusk").id).toBe("dusk");
  });

  it("puts rain on any background", () => {
    const s = resolveScene("rainy-night-cafe+rain");
    expect(s.rain).toBe(true);
    expect(s.kind).toBe("image");
    expect(resolveScene("city").rain).toBeFalsy();
    expect(resolveScene("rain").rain).toBe(true);
  });

  it("toggles rain, except on the Rain scene", () => {
    expect(toggleRainId(resolveScene("beach"))).toBe("beach+rain");
    expect(toggleRainId(resolveScene("beach+rain"))).toBe("beach");
    expect(toggleRainId(resolveScene("rain"))).toBeNull();
  });

  it("falls back to the first scene", () => {
    expect(resolveScene("deleted-scene")).toBe(scenes[0]);
    expect(resolveScene(null)).toBe(scenes[0]);
    expect(scenes[0].id).toBe("rainy-night-cafe");
  });

  it("only accepts ids that exist", () => {
    expect(isSceneId("ember")).toBe(true);
    expect(isSceneId("ember+rain")).toBe(true);
    expect(isSceneId("ember+rain+rain")).toBe(false);
    expect(isSceneId("rain+rain")).toBe(false);
    expect(isSceneId("ember; drop table")).toBe(false);
  });
});
