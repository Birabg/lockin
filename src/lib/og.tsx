import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { brand, LOCK_PATH } from "@/lib/brand";
import { siteUrl } from "@/lib/site";
import { isSafeKey, readLocalFile } from "@/lib/storage";

const LOCAL_MEDIA = "/media/";

/** The social preview cards (Open Graph / Twitter), in the app's own dark style. */

export const ogSize = { width: 1200, height: 630 };

export const og = {
  background: brand.background,
  foreground: "#ededef",
  muted: "#a1a1a8",
  subtle: "#8e8e96",
  primary: "#4f8ff7",
  streak: "#f5b366",
  card: "#1b1b1e",
  border: "#303035",
  /** the warm light rising from the bottom, as on the focus page */
  glow: "radial-gradient(ellipse 90% 70% at 50% 125%, rgba(245, 150, 80, 0.30), rgba(245, 150, 80, 0.08) 55%, rgba(20, 20, 22, 0) 80%)",
  /** content stays this far from the edges, since some apps crop the card */
  pad: 64,
};

/** DM Sans, the app's font, from local files so the cards never fall back to a default face. */
export async function ogFonts() {
  // written out in full so the build traces the files and ships them with the server functions
  const [regular, bold, heavy] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/dm-sans-400.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/dm-sans-700.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/dm-sans-800.woff")),
  ]);
  return [
    { name: "DM Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "DM Sans", data: heavy, weight: 800 as const, style: "normal" as const },
  ];
}

/**
 * An avatar as a PNG data URL, since the card renderer can't read the WebP the app stores.
 * Null when it can't be fetched in time, so the card shows initials instead of failing.
 */
export async function ogAvatar(src: string | null, side: number) {
  if (!src) return null;
  try {
    let bytes: Uint8Array | null;
    if (src.startsWith(LOCAL_MEDIA)) {
      // local-disk uploads (dev): read the file rather than fetch the site from itself
      const key = src.slice(LOCAL_MEDIA.length);
      bytes = isSafeKey(key) ? await readLocalFile(key) : null;
    } else {
      const res = await fetch(new URL(src, siteUrl()), { signal: AbortSignal.timeout(3000) });
      bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
    if (!bytes) return null;
    const png = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .resize(side * 2, side * 2, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The address shown at the bottom of a card. */
export const siteHost = () => new URL(siteUrl()).host;

/** The lock in a rounded square, then the wordmark, as in the top bar. */
export function OgLogo({ size = 64 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: size * 0.27,
          background: og.primary,
        }}
      >
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#ffffff">
          <path d={LOCK_PATH} />
        </svg>
      </div>
      <div style={{ marginLeft: size * 0.3, fontSize: size * 0.66, fontWeight: 800, letterSpacing: "-0.03em", color: og.foreground }}>
        {brand.name.toLowerCase()}
      </div>
    </div>
  );
}

/** The site-wide card: tagline on the left, a resting timer on the right. */
export function DefaultCard() {
  const ring = 360;
  const stroke = 6;
  const r = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: og.pad,
        background: og.background,
        backgroundImage: og.glow,
        color: og.foreground,
        fontFamily: "DM Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <OgLogo />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.035em" }}>{brand.tagline}</div>
          <div style={{ marginTop: 22, fontSize: 30, lineHeight: 1.35, color: og.muted }}>
            Track sessions, build streaks, climb the leaderboard.
          </div>
        </div>
        <div style={{ fontSize: 24, color: og.subtle }}>{siteHost()}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: ring + 40 }}>
        <div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "center", width: ring, height: ring }}>
          <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} style={{ position: "absolute", top: 0, left: 0 }}>
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
            {/* a short lit arc at the top, where the timer starts */}
            <circle
              cx={ring / 2}
              cy={ring / 2}
              r={r}
              fill="none"
              stroke={og.primary}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.08} ${circumference}`}
              transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
            />
          </svg>
          <div style={{ fontSize: 104, fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1 }}>25:00</div>
        </div>
      </div>
    </div>
  );
}
