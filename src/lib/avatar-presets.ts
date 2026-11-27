/** Lockin's built-in profile pictures, drawn as SVGs in public/avatars. Anyone can pick one instead of uploading. */
export const AVATAR_PRESETS = [
  { id: "lock", label: "Lock" },
  { id: "flame", label: "Flame" },
  { id: "bolt", label: "Bolt" },
  { id: "rocket", label: "Rocket" },
  { id: "moon", label: "Moon" },
  { id: "peak", label: "Peak" },
  { id: "coffee", label: "Coffee" },
  { id: "beats", label: "Beats" },
  { id: "book", label: "Book" },
  { id: "sprout", label: "Sprout" },
  { id: "cat", label: "Cat" },
  { id: "owl", label: "Owl" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

export const presetUrl = (id: AvatarPresetId) => `/avatars/${id}.svg`;

export const isAvatarPreset = (id: unknown): id is AvatarPresetId => AVATAR_PRESETS.some((p) => p.id === id);

/** True for a saved avatar that's one of ours, so nothing tries to delete it from storage. */
export const isPresetUrl = (url: string | null | undefined) => !!url && AVATAR_PRESETS.some((p) => presetUrl(p.id) === url);
