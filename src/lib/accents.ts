/**
 * Accent colours. One hex fills every --primary token (the button, its 3D edge, the soft tint and
 * readable text), so any colour works, including a custom one.
 *
 * The choice is kept per device in localStorage and applied by a tiny script in <head>, so the
 * page paints in the right colour with no flash and no server round trip.
 */
export type Accent = { id: string; name: string; hex: string };

export const DEFAULT_ACCENT = "#4f8ff7";

/** Grouped for the picker. Every colour reads on the dark background. */
export const ACCENT_GROUPS: { name: string; accents: Accent[] }[] = [
  {
    name: "Pastel",
    accents: [
      { id: "cotton-candy", name: "Cotton candy", hex: "#ffb3d9" },
      { id: "peach", name: "Peach", hex: "#ffbe98" },
      { id: "butter", name: "Butter", hex: "#ffe08a" },
      { id: "pistachio", name: "Pistachio", hex: "#bfe6a1" },
      { id: "mint", name: "Mint", hex: "#9ef0cf" },
      { id: "baby-blue", name: "Baby blue", hex: "#a8d8ff" },
      { id: "periwinkle", name: "Periwinkle", hex: "#b4b8ff" },
      { id: "lilac", name: "Lilac", hex: "#d4b3ff" },
    ],
  },
  {
    name: "Bright",
    accents: [
      { id: "strawberry", name: "Strawberry", hex: "#ff5c7a" },
      { id: "coral", name: "Coral", hex: "#ff7a5c" },
      { id: "tangerine", name: "Tangerine", hex: "#ff9f1c" },
      { id: "sunflower", name: "Sunflower", hex: "#ffd23f" },
      { id: "lime", name: "Lime", hex: "#a3e635" },
      { id: "emerald", name: "Emerald", hex: "#34d399" },
      { id: "aqua", name: "Aqua", hex: "#22d3ee" },
      { id: "sky", name: "Sky", hex: DEFAULT_ACCENT },
      { id: "iris", name: "Iris", hex: "#7c7cff" },
      { id: "grape", name: "Grape", hex: "#a66bff" },
      { id: "orchid", name: "Orchid", hex: "#e879f9" },
      { id: "bubblegum", name: "Bubblegum", hex: "#ff6ec7" },
    ],
  },
  {
    name: "Deep",
    accents: [
      { id: "cherry", name: "Cherry", hex: "#d6334f" },
      { id: "rust", name: "Rust", hex: "#c8553d" },
      { id: "honey", name: "Honey", hex: "#d99a1e" },
      { id: "olive", name: "Olive", hex: "#8a9a3b" },
      { id: "forest", name: "Forest", hex: "#2f9e6a" },
      { id: "teal", name: "Teal", hex: "#14a3a3" },
      { id: "ocean", name: "Ocean", hex: "#2b6fd6" },
      { id: "indigo", name: "Indigo", hex: "#5b4fd6" },
      { id: "plum", name: "Plum", hex: "#9b3fb5" },
      { id: "berry", name: "Berry", hex: "#c23a7e" },
    ],
  },
  {
    name: "Soft neutrals",
    accents: [
      { id: "sand", name: "Sand", hex: "#d8c3a5" },
      { id: "latte", name: "Latte", hex: "#c49a7a" },
      { id: "sage", name: "Sage", hex: "#a3b8a0" },
      { id: "slate", name: "Slate", hex: "#9aa5b8" },
      { id: "silver", name: "Silver", hex: "#d4d4d8" },
    ],
  },
];

export const ACCENTS = ACCENT_GROUPS.flatMap((g) => g.accents);

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Every --primary token from one colour. Falls back to the default for anything that isn't #rrggbb. */
export function accentTokens(hex: string) {
  return tokensFor(isHex(hex) ? hex : DEFAULT_ACCENT);
}

export const ACCENT_KEY = "lockin-accent";

/** Writes the tokens onto <html>. Inline styles beat the stylesheet, so this is all a change takes. */
export function applyAccent(hex: string) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(accentTokens(hex))) root.setProperty(k, v);
}

export function saveAccent(hex: string) {
  applyAccent(hex);
  try {
    if (hex.toLowerCase() === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, hex);
  } catch {
    // private mode: it still applies for this visit
  }
  window.dispatchEvent(new CustomEvent(ACCENT_KEY, { detail: hex }));
}

export function readAccent(): string {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return isHex(v) ? v : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Runs in <head> before anything paints. Any failure just leaves the default colour. */
export const accentScript = `(function(){try{var h=localStorage.getItem("${ACCENT_KEY}");if(!h||!/^#[0-9a-f]{6}$/i.test(h))return;var t=(${tokensFor.toString()})(h),s=document.documentElement.style;for(var k in t)s.setProperty(k,t[k])}catch(e){}})()`;

/**
 * The maths behind accentTokens. Self-contained, with no imports or outside helpers, because
 * accentScript stringifies it into the page head.
 */
function tokensFor(hex: string): Record<string, string> {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (a: number[]) =>
    "#" +
    a
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const mix = (a: number[], b: number[], t: number) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  // WCAG relative luminance
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const c = rgb(hex);
  const lum = 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  return {
    "--primary": toHex(c),
    // dark text on light accents, white on deep ones, whichever has more contrast
    "--primary-foreground": (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? "#111113" : "#ffffff",
    // the button's 3D edge
    "--primary-shadow": toHex(mix(c, [0, 0, 0], 0.32)),
    // a soft tint over --background (#141416)
    "--primary-light": toHex(mix([20, 20, 22], c, 0.16)),
    // text on the dark background, lifted toward white so deep accents stay readable
    "--primary-text": toHex(mix(c, [255, 255, 255], lum < 0.25 ? 0.55 : 0.4)),
  };
}
