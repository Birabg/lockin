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

export type Scene = ImageScene | DrawnScene;

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

export const scenes: Scene[] = [...imageScenes, ...drawnScenes];

export const isSceneId = (id: string) => scenes.some((s) => s.id === id);

/** A saved id can outlive its scene, so anything unknown falls back to the first one. */
export const resolveScene = (id: string | null | undefined): Scene => scenes.find((s) => s.id === id) ?? scenes[0];
