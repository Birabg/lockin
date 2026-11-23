export type ImageScene = { kind: "image"; id: string; title: string; image: string; thumb: string; accent: string };

export type DrawnScene = {
  kind: "drawn";
  id: string;
  title: string;
  accent: string;
  sky: [top: string, bottom: string];
  glow: string;
  ridges: [far: string, middle: string, near: string];
  stars?: boolean;
};

/** Illustrations drawn in code, in src/components/scene-art.tsx. */
export type ArtName = "rain" | "beach" | "city" | "library" | "window";

export type ArtScene = {
  kind: "art";
  id: string;
  title: string;
  accent: string;
  art: ArtName;
  /** Top and bottom of the sky, for places that only need the scene's colours, like the feed's filmstrip. */
  sky: [top: string, bottom: string];
};

/** `rain` lays animated rain over the scene. Any background can have it. */
export type Scene = (ImageScene | DrawnScene | ArtScene) & { rain?: boolean };

const photo = (id: string, title: string, accent: string): ImageScene => ({
  kind: "image",
  id,
  title,
  image: `/scenes/${id}.webp`,
  thumb: `/scenes/thumbs/${id}.webp`,
  accent,
});

/** Files live in public/scenes, with a 240px copy in public/scenes/thumbs. */
export const imageScenes: ImageScene[] = [
  photo("rainy-night-cafe", "Night café", "#f2a65a"),
  photo("amber-bookshelves", "Bookshelves", "#ef8f6a"),
  photo("candlelit-desk", "Candlelit desk", "#e6c88a"),
  photo("rainy-city-window", "City window", "#8ec5e8"),
  photo("cozy-reading-nook", "Reading nook", "#a9cc9c"),
  photo("golden-radio", "Old radio", "#f0b46c"),
  photo("sunlit-desk", "Sunlit desk", "#f5c27a"),
  photo("sunset-lake", "Sunset lake", "#ffad5c"),
  photo("golden-field", "Golden field", "#f2c27a"),
  photo("summer-sky", "Summer sky", "#8fd3e6"),
  photo("flower-street", "Flower street", "#ffa766"),
  photo("willow-pond", "Willow pond", "#b5d98a"),
  photo("misty-pines", "Misty pines", "#a8d5b0"),
  photo("night-meadow", "Night meadow", "#b9d6c2"),
  photo("mountain-stars", "Mountain stars", "#ffb36b"),
  photo("violet-sky", "Violet sky", "#d0a8ff"),
  photo("milky-way", "Milky Way", "#f0b27a"),
  photo("starry-trees", "Starry trees", "#e8c08f"),
  photo("earth-orbit", "Orbit", "#8fc2ff"),
  photo("windmill-farm", "Windmill farm", "#f4b98a"),
  photo("tree-road", "Tree road", "#e2b866"),
  photo("black-hole", "Black hole", "#9cc4ff"),
  photo("green-valley", "Green valley", "#9fd8a0"),
  photo("golden-black-hole", "Event horizon", "#ffc069"),
  photo("river-house", "River house", "#9ad6c4"),
  photo("snow-castle", "Snow castle", "#c3d2e4"),
  photo("castle-sunset", "Castle sunset", "#f6b26b"),
  photo("two-suns", "Two suns", "#ffb27a"),
  photo("moon-birds", "Moon and birds", "#f8a78a"),
  photo("misty-trees", "Golden mist", "#f2c46e"),
  photo("golden-coast", "Golden coast", "#f5ae5f"),
  photo("harbour-city", "Harbour", "#7fd0e8"),
  photo("eiffel-tower", "Paris", "#8cc4f2"),
  photo("earth-milky-way", "Earth at night", "#a9c6ff"),
  photo("hill-road", "Hill road", "#f6bd6a"),
  photo("sleepy-cat", "Sleepy cat", "#b9dc8c"),
  photo("orange-kitten", "Kitten", "#f5b37f"),
  photo("golden-retriever", "Good dog", "#e8c27e"),
];

/** Need no files, so the timer still has backgrounds if the images are removed. */
export const drawnScenes: DrawnScene[] = [
  {
    kind: "drawn",
    id: "ember",
    title: "Ember",
    accent: "#ff9a5c",
    sky: ["#2a0f12", "#a8432a"],
    glow: "#ffb067",
    ridges: ["#6b2620", "#42171a", "#220c10"],
  },
  {
    kind: "drawn",
    id: "dusk",
    title: "Dusk",
    accent: "#c9a2ff",
    sky: ["#1d1538", "#7a4a8c"],
    glow: "#f6a6b2",
    ridges: ["#4a2f6b", "#2f1e4d", "#180f2e"],
  },
  {
    kind: "drawn",
    id: "forest",
    title: "Forest",
    accent: "#8fdcae",
    sky: ["#0e2420", "#3f7a5e"],
    glow: "#cfe8a9",
    ridges: ["#1f5240", "#143a2e", "#0a211b"],
  },
  {
    kind: "drawn",
    id: "night",
    title: "Night",
    accent: "#9db8ff",
    sky: ["#05070f", "#1c2a4e"],
    glow: "#e6ecff",
    ridges: ["#18233f", "#101a30", "#080d1a"],
    stars: true,
  },
];

/** Drawn in code, so they need no files either. */
export const artScenes: ArtScene[] = [
  { kind: "art", id: "rain", title: "Rain", accent: "#9fc4e8", art: "rain", sky: ["#232a36", "#5b6676"] },
  { kind: "art", id: "beach", title: "Beach", accent: "#ffb38a", art: "beach", sky: ["#1f1a3d", "#f29b72"] },
  { kind: "art", id: "city", title: "City", accent: "#b59cff", art: "city", sky: ["#0b1026", "#3a2a5c"] },
  { kind: "art", id: "library", title: "Library", accent: "#e8b06a", art: "library", sky: ["#2a1c14", "#4a3020"] },
  { kind: "art", id: "window", title: "Window view", accent: "#f2a07a", art: "window", sky: ["#2b3d6b", "#e8a07a"] },
];

const base: Scene[] = [...imageScenes, ...drawnScenes, ...artScenes];

/** Rain on any background is the background's id with this on the end, like "city+rain". */
export const RAIN = "+rain";

/** The Rain scene is rainy by itself, so it has no "+rain" twin. */
const alwaysRains = (s: Scene) => s.kind === "art" && s.art === "rain";

export const withRain = (s: Scene): Scene => (s.rain ? s : { ...s, id: s.id + RAIN, title: `${s.title} + rain`, rain: true });

const find = (id: string) => base.find((s) => s.id === id);

/** Every scene, including each one's rainy version. */
export const scenes: Scene[] = base.map((s) => (alwaysRains(s) ? { ...s, rain: true } : s));

export const isSceneId = (id: string) => {
  const dry = id.endsWith(RAIN) ? id.slice(0, -RAIN.length) : id;
  const s = find(dry);
  return !!s && !(id.endsWith(RAIN) && alwaysRains(s));
};

/** The id with rain switched on or off. Null when that can't change, as with the Rain scene itself. */
export function toggleRainId(scene: Scene): string | null {
  if (scene.id.endsWith(RAIN)) return scene.id.slice(0, -RAIN.length);
  if (scene.rain) return null;
  return scene.id + RAIN;
}

/** A saved id can outlive its scene, so anything unknown falls back to the café. */
export function resolveScene(id: string | null | undefined): Scene {
  if (id && isSceneId(id)) {
    if (id.endsWith(RAIN)) return withRain(find(id.slice(0, -RAIN.length))!);
    return scenes.find((s) => s.id === id)!;
  }
  return scenes[0];
}

/** The picker's groups. Every background is in exactly one; rain goes over any of them with the switch. */
export const SCENE_CATEGORIES = [
  {
    id: "cozy",
    name: "Cozy",
    ids: [
      "rainy-night-cafe",
      "amber-bookshelves",
      "candlelit-desk",
      "cozy-reading-nook",
      "golden-radio",
      "sunlit-desk",
      "library",
      "window",
    ],
  },
  {
    id: "golden",
    name: "Golden hour",
    ids: [
      "sunset-lake",
      "golden-field",
      "summer-sky",
      "flower-street",
      "windmill-farm",
      "misty-trees",
      "golden-coast",
      "hill-road",
      "moon-birds",
      "beach",
      "ember",
      "dusk",
    ],
  },
  {
    id: "nature",
    name: "Nature",
    ids: ["willow-pond", "misty-pines", "night-meadow", "green-valley", "tree-road", "river-house", "forest"],
  },
  { id: "night", name: "Night sky", ids: ["mountain-stars", "violet-sky", "milky-way", "starry-trees", "night"] },
  { id: "space", name: "Space", ids: ["black-hole", "golden-black-hole", "earth-milky-way", "earth-orbit"] },
  { id: "fantasy", name: "Fantasy", ids: ["snow-castle", "castle-sunset", "two-suns"] },
  { id: "rain", name: "Rain & city", ids: ["rain", "city", "rainy-city-window", "harbour-city", "eiffel-tower"] },
  { id: "pets", name: "Pets", ids: ["sleepy-cat", "orange-kitten", "golden-retriever"] },
] as const;

export type SceneCategoryId = (typeof SCENE_CATEGORIES)[number]["id"];

export const sceneCategories: { id: SceneCategoryId; name: string; scenes: Scene[] }[] = SCENE_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  scenes: c.ids.map((id) => resolveScene(id)),
}));

/** The group a scene is in, going by its dry twin for a rainy one. */
export function categoryOf(scene: Scene): SceneCategoryId {
  const dry = scene.id.endsWith(RAIN) ? scene.id.slice(0, -RAIN.length) : scene.id;
  return sceneCategories.find((c) => c.scenes.some((s) => s.id === dry))?.id ?? sceneCategories[0].id;
}

/** Every background in picker order. */
export const pickerScenes: Scene[] = sceneCategories.flatMap((c) => c.scenes);
