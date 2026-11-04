import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/toaster";
import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/site";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-app" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
  // setting icons here turns off the automatic tag for app/icon.svg, so every icon has to be listed
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
    ],
    apple: "/pwa-icon/192",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
