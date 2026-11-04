"use client";

import type { CSSProperties } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowsIn } from "@phosphor-icons/react/dist/csr/ArrowsIn";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { Broadcast } from "@phosphor-icons/react/dist/csr/Broadcast";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ChartBar } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ChartLineUp } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { ChatCircle } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { CornersIn } from "@phosphor-icons/react/dist/csr/CornersIn";
import { CornersOut } from "@phosphor-icons/react/dist/csr/CornersOut";
import { Crown } from "@phosphor-icons/react/dist/csr/Crown";
import { Door } from "@phosphor-icons/react/dist/csr/Door";
import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree";
import { FilmSlate } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { Fire } from "@phosphor-icons/react/dist/csr/Fire";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { GlobeHemisphereWest } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { HandHeart } from "@phosphor-icons/react/dist/csr/HandHeart";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { ImageSquare } from "@phosphor-icons/react/dist/csr/ImageSquare";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";
import { LockSimpleOpen } from "@phosphor-icons/react/dist/csr/LockSimpleOpen";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Medal } from "@phosphor-icons/react/dist/csr/Medal";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { Pause } from "@phosphor-icons/react/dist/csr/Pause";
import { PencilSimpleLine } from "@phosphor-icons/react/dist/csr/PencilSimpleLine";
import { Play } from "@phosphor-icons/react/dist/csr/Play";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { ShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerSlash } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { Stop } from "@phosphor-icons/react/dist/csr/Stop";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Timer } from "@phosphor-icons/react/dist/csr/Timer";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { X } from "@phosphor-icons/react/dist/csr/X";

const ICONS = {
  home: House,
  focus: Timer,
  focusingNow: Broadcast,
  stats: ChartBar,
  leaderboard: Trophy,
  people: UsersThree,
  buddies: HandHeart,
  liveRooms: Door,
  notifications: Bell,
  startFocus: Play,
  streak: Fire,
  refresh: ArrowClockwise,
  search: MagnifyingGlass,
  like: Heart,
  comment: ChatCircle,
  views: ChartLineUp,
  share: ShareNetwork,
  delete: Trash,
  global: GlobeHemisphereWest,
  following: UsersThree,
  timelapses: FilmSlate,
  crown: Crown,
  medal: Medal,
  settings: GearSix,
  logout: SignOut,
  chevron: CaretRight,
  collapse: CaretLeft,
  compose: PencilSimpleLine,
  image: ImageSquare,
  lock: LockSimple,
  unlock: LockSimpleOpen,
  sound: SpeakerHigh,
  mute: SpeakerSlash,
  fullscreen: CornersOut,
  exitFullscreen: CornersIn,
  minimize: ArrowsIn,
  pause: Pause,
  stop: Stop,
  send: PaperPlaneRight,
  check: Check,
  close: X,
  add: Plus,
  more: DotsThree,
  profile: User,
  time: Clock,
  target: Target,
};

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  /** The filled icon in the primary colour, for the selected item. */
  active?: boolean;
  /** Overrides the duotone default without changing the colour. */
  weight?: "regular" | "duotone" | "fill";
  /** 24 in the sidebar, 20 in cards, 18 in small buttons. */
  size?: number | string;
  /** A dot on the top right corner: blue for something new, green for something live. */
  badge?: boolean | "live";
  className?: string;
  style?: CSSProperties;
};

/** Takes its colour from the text around it, so it stays readable on coloured buttons. */
export function Icon({ name, active = false, weight, size = 20, badge = false, className = "", style }: IconProps) {
  const Glyph = ICONS[name];
  const glyph = (
    <Glyph
      size={size}
      weight={weight ?? (active ? "fill" : "duotone")}
      className={`shrink-0 ${className}`}
      style={active ? { ...style, color: "var(--primary)" } : style}
      aria-hidden
    />
  );
  if (!badge) return glyph;
  return (
    <span className="relative inline-flex shrink-0">
      {glyph}
      <span
        className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background ${badge === "live" ? "bg-live" : "bg-primary"}`}
      />
    </span>
  );
}
