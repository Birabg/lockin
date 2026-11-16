import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { DefaultCard, ogFonts, ogSize } from "@/lib/og";

export const alt = `${brand.name}: ${brand.tagline} ${brand.description}`;
export const size = ogSize;
export const contentType = "image/png";

/** The picture shown when a link to the site is shared. */
export default async function OpenGraphImage() {
  return new ImageResponse(<DefaultCard />, { ...ogSize, fonts: await ogFonts() });
}
