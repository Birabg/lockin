const PRODUCTION_URL = "https://lockin-beige-three.vercel.app";

/** The public address. Set by config, never read from request headers, so emailed links can't be pointed elsewhere. */
export function siteUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const fallback = host ? `https://${host}` : process.env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3000";
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || fallback).replace(/\/$/, "");
}
