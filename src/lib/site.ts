/** The public address. Set by config, never read from request headers, so emailed links can't be pointed elsewhere. */
export function siteUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL ?? (host ? `https://${host}` : "http://localhost:3000")).replace(/\/$/, "");
}
