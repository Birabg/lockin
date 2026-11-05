import type { CSSProperties } from "react";
import { ICONS } from "./icon-data";

export type IconName = keyof typeof ICONS;

type Looks = { line: string; active?: string; solid?: string };

type IconProps = {
  name: IconName;
  /** The bold duotone icon in the primary colour, for the selected item. */
  active?: boolean;
  /** The filled icon, in whatever colour it already has. */
  solid?: boolean;
  /** 26 in the sidebar, 20 in cards, 18 in small buttons. */
  size?: number | string;
  /** A small ring and dot on the top right corner: blue for something new, green for something live. */
  badge?: boolean | "live";
  className?: string;
  style?: CSSProperties;
};

/** Takes its colour from the text around it, so it stays readable on coloured buttons. */
export function Icon({ name, active = false, solid = false, size = 20, badge = false, className = "", style }: IconProps) {
  const looks: Looks = ICONS[name];
  const glyph = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={active ? { ...style, color: "var(--primary)" } : style}
      aria-hidden
      // the markup comes from icon-data.ts, never from a user
      dangerouslySetInnerHTML={{ __html: (active && looks.active) || (solid && looks.solid) || looks.line }}
    />
  );
  if (!badge) return glyph;
  const tone = badge === "live" ? ["border-live", "bg-live"] : ["border-primary", "bg-primary"];
  return (
    <span className="relative inline-flex shrink-0">
      {glyph}
      <span
        data-badge
        className={`absolute -top-0.5 -right-0.5 grid size-2.5 place-items-center rounded-full border-[1.5px] bg-background ring-2 ring-background ${tone[0]}`}
      >
        <span className={`size-1 rounded-full ${tone[1]}`} />
      </span>
    </span>
  );
}
