import { ImageResponse } from "next/og";
import { LOCK_MARK } from "@/lib/brand";

/**
 * The logo's padlock as a PNG, for emails: mail apps won't show SVG.
 * "mark" is the top bar's blue lock, shut. "open" is a big green one, its shackle lifted and swung out, waiting to be locked.
 * Drawn at 3x so it stays sharp on retina screens.
 */
const VARIANTS = {
  mark: { size: 96, color: "#4f8ff7", hole: "#111113", lift: 0, swing: 0, box: "0 0 28 28" },
  open: { size: 216, color: "#4ade80", hole: "#0f1f15", lift: 3, swing: 18, box: "-2.5 -4 33 33" },
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const v = VARIANTS[(await params).variant as keyof typeof VARIANTS] ?? VARIANTS.mark;
  const { body, keyholeTop, keyholeSlot } = LOCK_MARK;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <svg width={v.size} height={v.size} viewBox={v.box}>
        <path
          d={LOCK_MARK.shackle}
          transform={`translate(0 ${-v.lift}) rotate(${v.swing} 19 13)`}
          fill="none"
          stroke={v.color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <rect {...body} fill={v.color} />
        <circle {...keyholeTop} fill={v.hole} />
        <rect {...keyholeSlot} fill={v.hole} />
      </svg>
    </div>,
    { width: v.size, height: v.size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
