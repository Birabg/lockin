import { ImageResponse } from "next/og";
import { brand, LOCK_PATH } from "@/lib/brand";

export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The picture shown when a link to the site is shared. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: brand.background,
        color: "#e8edf5",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            marginRight: 28,
            borderRadius: 24,
            background: "#4f8ff7",
          }}
        >
          <svg width={58} height={58} viewBox="0 0 24 24" fill={brand.background}>
            <path d={LOCK_PATH} />
          </svg>
        </div>
        <div style={{ fontSize: 56 }}>{brand.name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 104, lineHeight: 1.1 }}>{brand.tagline}</div>
        <div style={{ marginTop: 28, maxWidth: 940, fontSize: 36, lineHeight: 1.35, color: "#b4c0d3" }}>{brand.description}</div>
      </div>
    </div>,
    size,
  );
}
