import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  categoryOf,
  drawnScenes,
  imageScenes,
  isSceneId,
  pickerScenes,
  resolveScene,
  sceneCategories,
  scenes,
  toggleRainId,
} from "./scenes";

describe("scenes", () => {
  it("has unique ids", () => {
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
    expect(new Set(pickerScenes.map((s) => s.id)).size).toBe(pickerScenes.length);
  });

  it("keeps the drawn themes as options", () => {
    expect(drawnScenes.map((s) => s.id)).toEqual(["ember", "dusk", "forest", "night"]);
  });

  it("puts every background in exactly one category", () => {
    const grouped = sceneCategories.flatMap((c) => c.scenes.map((s) => s.id));
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(scenes.map((s) => s.id).sort());
    expect(sceneCategories.every((c) => c.scenes.length > 0)).toBe(true);
  });

  it("knows a scene's category, rainy twins included", () => {
    expect(categoryOf(resolveScene("milky-way"))).toBe("night");
    expect(categoryOf(resolveScene("willow-pond+rain"))).toBe("nature");
    expect(categoryOf(resolveScene("rain"))).toBe("rain");
    expect(categoryOf(resolveScene("black-hole"))).toBe("space");
    expect(categoryOf(resolveScene("golden-retriever"))).toBe("pets");
  });

  it("has a file and a thumbnail for every photo", () => {
    for (const s of imageScenes) {
      expect(existsSync(join("public", s.image)), s.image).toBe(true);
      expect(existsSync(join("public", s.thumb)), s.thumb).toBe(true);
    }
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
