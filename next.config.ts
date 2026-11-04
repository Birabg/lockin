import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a stylesheet holds back the first paint, which is a blank white page on a slow connection
  experimental: { inlineCss: true },
  serverExternalPackages: ["bcryptjs"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
