import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { DefaultCard, og, ogAvatar, OgLogo, ogFonts, ogSize, siteHost } from "@/lib/og";
import { getRank, getStreak } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { colorFor } from "@/components/ui";

export const alt = `A ${brand.name} profile: streak, focus time and this week's rank`;
export const size = ogSize;
export const contentType = "image/png";

const AVATAR = 168;

/** A profile's preview card. Public fields only; an unknown username gets the site-wide card. */
export default async function ProfileImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const fonts = await ogFonts();
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, avatar: true, timeZone: true },
  });
  if (!user) return new ImageResponse(<DefaultCard />, { ...ogSize, fonts });

  const [streak, total, rank, avatar] = await Promise.all([
    getStreak(user),
    // the same total the profile page shows
    db.focusSession.aggregate({ where: { userId: user.id, status: "DONE" }, _sum: { durationSec: true } }),
    getRank("week", user.timeZone, user.id),
    ogAvatar(user.avatar, AVATAR),
  ]);

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const stat = (value: string, label: string, color: string = og.foreground) => (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 64 }}>
      <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 24, color: og.muted }}>{label}</div>
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
        padding: og.pad,
        background: og.background,
        backgroundImage: og.glow,
        color: og.foreground,
        fontFamily: "DM Sans",
      }}
    >
      <OgLogo size={56} />
      <div style={{ display: "flex", alignItems: "center" }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page
          <img src={avatar} alt="" width={AVATAR} height={AVATAR} style={{ borderRadius: AVATAR, objectFit: "cover" }} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: AVATAR,
              height: AVATAR,
              borderRadius: AVATAR,
              background: colorFor(user.name),
              color: og.background,
              fontSize: AVATAR * 0.38,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 40, maxWidth: 820 }}>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1 }}>{user.name}</div>
          <div style={{ marginTop: 6, fontSize: 32, color: og.muted }}>{`@${user.username}`}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex" }}>
          {stat(`${streak.current}d 🔥`, "Streak", og.streak)}
          {stat(formatDuration(total._sum.durationSec ?? 0), "Focused")}
          {stat(rank ? `#${rank}` : "—", "This week", og.primary)}
        </div>
        <div style={{ fontSize: 22, color: og.subtle }}>{siteHost()}</div>
      </div>
    </div>,
    { ...ogSize, fonts, emoji: "twemoji" },
  );
}
