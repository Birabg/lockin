import { ImageResponse } from "next/og";

const LOCK = "M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#8b80f9" }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="#0a0a0b">
        <path d={LOCK} />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
