import { ImageResponse } from "next/og";
import { LOCK_PATH } from "@/lib/brand";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#4f8ff7" }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="#0a0f1a">
        <path d={LOCK_PATH} />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
