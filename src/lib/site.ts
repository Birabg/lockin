const PRODUCTION_URL = "https://lockin-beige-three.vercel.app";

/** The public address. Set by config, never read from request headers, so emailed links can't be pointed elsewhere. */
export function siteUrl() {
  // Preview deployments use their own database, so their emailed links must point back at the preview.
  // VERCEL_BRANCH_URL is set by Vercel at build time, not by the request.
  const preview = process.env.VERCEL_ENV === "preview" && (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL);
  if (preview) return `https://${preview}`;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallback = host ? `https://${host}` : process.env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3000";
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || fallback).replace(/\/$/, "");
}
