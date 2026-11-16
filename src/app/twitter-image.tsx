import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { DefaultCard, ogFonts, ogSize } from "@/lib/og";

// the same card as opengraph-image.tsx (Next needs these exports written out in each file)
export const alt = `${brand.name}: ${brand.tagline} ${brand.description}`;
export const size = ogSize;
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(<DefaultCard />, { ...ogSize, fonts: await ogFonts() });
}
