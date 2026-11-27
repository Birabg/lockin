/** Lockin's built-in profile banners, drawn as 1200×300 SVGs in public/banners. */
export const BANNER_PRESETS = [
  { id: "dusk", label: "Dusk" },
  { id: "aurora", label: "Aurora" },
  { id: "ocean", label: "Ocean" },
  { id: "sunrise", label: "Sunrise" },
  { id: "forest", label: "Forest" },
  { id: "city", label: "Night city" },
  { id: "grid", label: "Grid" },
  { id: "pastel", label: "Pastel" },
] as const;

export type BannerPresetId = (typeof BANNER_PRESETS)[number]["id"];

export const bannerUrl = (id: BannerPresetId) => `/banners/${id}.svg`;

export const isBannerPreset = (id: unknown): id is BannerPresetId => BANNER_PRESETS.some((p) => p.id === id);

/** True for a saved banner that's one of ours, so nothing tries to delete it from storage. */
export const isBannerPresetUrl = (url: string | null | undefined) => !!url && BANNER_PRESETS.some((p) => bannerUrl(p.id) === url);
