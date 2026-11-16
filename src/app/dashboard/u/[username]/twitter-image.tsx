import ProfileImage from "./opengraph-image";
import { brand } from "@/lib/brand";
import { ogSize } from "@/lib/og";

// the same card as opengraph-image.tsx; without this file, the site-wide twitter-image would apply here
export const alt = `A ${brand.name} profile: streak, focus time and this week's rank`;
export const size = ogSize;
export const contentType = "image/png";

export default ProfileImage;
