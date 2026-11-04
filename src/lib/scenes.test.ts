import { describe, expect, it } from "vitest";
import { drawnScenes, isSceneId, resolveScene, scenes } from "./scenes";

describe("scenes", () => {
  it("has unique ids", () => {
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
  });

  it("keeps the drawn themes as options", () => {
    expect(drawnScenes.map((s) => s.id)).toEqual(["ember", "dusk", "forest", "night"]);
  });

  it("finds a saved scene", () => {
    expect(resolveScene("dusk").id).toBe("dusk");
  });

  it("falls back to the first scene", () => {
    expect(resolveScene("deleted-scene")).toBe(scenes[0]);
    expect(resolveScene(null)).toBe(scenes[0]);
  });

  it("only accepts ids that exist", () => {
    expect(isSceneId("ember")).toBe(true);
    expect(isSceneId("ember; drop table")).toBe(false);
  });
});
