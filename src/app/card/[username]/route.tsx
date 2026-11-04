import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { getStreak } from "@/lib/queries";
import { formatDuration } from "@/lib/time";

/** Shareable streak card, also used as the social preview for profiles. */
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await db.user.findUnique({ where: { username }, select: { id: true, name: true, username: true, timeZone: true } });
  if (!user) return new Response("Not found", { status: 404 });

  const [streak, total] = await Promise.all([
    getStreak(user),
    db.dailyStat.aggregate({ where: { userId: user.id }, _sum: { seconds: true } }),
  ]);

  const stat = (value: string, label: string, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 72 }}>
      <div style={{ fontSize: 96, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 30, color: "#b4c0d3" }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 72,
        background: "#0a0f1a",
        color: "#e8edf5",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#4f8ff7" }}>{brand.name.toLowerCase()}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 64, fontWeight: 800 }}>{user.name}</div>
        <div style={{ fontSize: 32, color: "#b4c0d3" }}>{`@${user.username}`}</div>
      </div>
      <div style={{ display: "flex" }}>
        {stat(`${streak.current}d`, "Current streak", "#f5b366")}
        {stat(`${streak.best}d`, "Best streak", "#e8edf5")}
        {stat(formatDuration(total._sum.seconds ?? 0), "Focused", "#4f8ff7")}
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
