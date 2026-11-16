import { brand } from "@/lib/brand";

/**
 * The Open Graph fields every page shares. A page that sets its own `openGraph` replaces the parent's
 * whole object, so it spreads this in first.
 */
export const siteOpenGraph = { type: "website", siteName: brand.name, locale: "en_US" } as const;
