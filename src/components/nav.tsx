"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  DoorOpen,
  Handshake,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Radio,
  Timer,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Avatar, Logo, btnPrimary } from "./ui";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";

const SIDEBAR = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/timer", label: "Focus", icon: Timer },
  { href: "/dashboard/focusing", label: "Focusing now", icon: Radio },
  { href: "/dashboard/stats", label: "Stats", icon: BarChart3 },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/people", label: "People", icon: Users },
  { href: "/dashboard/buddies", label: "Buddies", icon: Handshake },
  { href: "/dashboard/rooms", label: "Live rooms", icon: DoorOpen },
];

const BOTTOM = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/timer", label: "Focus", icon: Timer },
  { href: "/dashboard/stats", label: "Stats", icon: BarChart3 },
  { href: "/dashboard/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/dashboard/settings", label: "Profile", icon: User },
];

function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === href : path.startsWith(href);
}

type NavUser = { name: string; username: string; avatar: string | null } | null;

function UnreadBadge({ count, compact }: { count: number; compact: boolean }) {
  if (count === 0) return null;
  return (
    <span
      className={`grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground ${
        compact ? "absolute top-0.5 right-0.5" : "ml-auto"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

type SidebarProps = { user: NavUser; unread: number; initialCollapsed: boolean };

export function Sidebar({ user, unread, initialCollapsed }: SidebarProps) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const item = collapsed ? "justify-center px-0" : "px-3";

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? SIDEBAR_COLLAPSED : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col overflow-x-clip border-r border-border bg-sidebar px-3 py-5 whitespace-nowrap transition-[width] duration-200 lg:flex ${
        collapsed ? "w-[72px]" : "w-[220px]"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "flex-col gap-3" : "justify-between pl-3"}`}>
        <Logo compact={collapsed} />
        <button
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-sidebar-foreground transition-colors hover:bg-inset/60 hover:text-foreground"
        >
          <Toggle className="size-[19px]" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      <nav aria-label="Main" className={`flex flex-col gap-1 ${collapsed ? "mt-4" : "mt-7"}`}>
        {SIDEBAR.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-xl py-2.5 text-[15px] font-semibold transition-colors ${item} ${
                active ? "bg-inset text-foreground" : "text-sidebar-foreground hover:bg-inset/60 hover:text-foreground"
              }`}
            >
              <Icon className={`size-[19px] shrink-0 ${active ? "text-primary" : ""}`} strokeWidth={2.2} />
              <span className={collapsed ? "sr-only" : ""}>{label}</span>
            </Link>
          );
        })}
        {user && (
          <Link
            href="/dashboard/notifications"
            aria-current={path === "/dashboard/notifications" ? "page" : undefined}
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            title={collapsed ? "Notifications" : undefined}
            className={`relative flex items-center gap-3 rounded-xl py-2.5 text-[15px] font-semibold text-sidebar-foreground transition-colors hover:bg-inset/60 hover:text-foreground ${item}`}
          >
            <Bell className="size-[19px] shrink-0" strokeWidth={2.2} />
            {!collapsed && "Notifications"}
            <UnreadBadge count={unread} compact={collapsed} />
          </Link>
        )}
      </nav>
      <Link
        href="/dashboard/timer"
        title={collapsed ? "Start focus" : undefined}
        className={`${btnPrimary} mt-6 h-12 text-[15px] ${collapsed ? "px-0!" : ""}`}
      >
        <Play className="size-4 shrink-0 fill-current" /> <span className={collapsed ? "sr-only" : ""}>Start focus</span>
      </Link>

      <div className="mt-auto">
        {user ? (
          <Link
            href="/dashboard/settings"
            title={collapsed ? user.name : undefined}
            className={`flex items-center gap-3 rounded-xl py-2 hover:bg-inset ${collapsed ? "justify-center" : "px-2"}`}
          >
            <Avatar name={user.name} src={user.avatar} size={34} />
            <span className={collapsed ? "sr-only" : "min-w-0"}>
              <span className="block truncate text-sm font-bold">{user.name}</span>
              <span className="block truncate text-xs text-muted">@{user.username}</span>
            </span>
          </Link>
        ) : (
          <div className={`flex items-center gap-3 py-2 ${collapsed ? "justify-center" : "px-2"}`} title={collapsed ? "Guest" : undefined}>
            <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-inset text-sm font-bold text-muted">G</span>
            <span className={collapsed ? "sr-only" : ""}>
              <span className="block text-sm font-bold">Guest</span>
              <span className="block text-xs text-muted">Public preview</span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="flex w-full max-w-[560px] items-center justify-between rounded-full border border-border bg-[#0d1421]/95 p-1.5 backdrop-blur">
        {BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-bold ${
                active ? "bg-primary-light text-primary" : "text-sidebar-foreground"
              }`}
            >
              <Icon className="size-5" strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileTopBar({ signedIn, unread }: { signedIn: boolean; unread: number }) {
  return (
    <div className="flex items-center justify-between py-3 lg:hidden">
      <Logo />
      <div className="flex items-center">
        <Link
          href="/dashboard/rooms"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Live rooms"
        >
          <DoorOpen className="size-5" />
        </Link>
        <Link
          href="/dashboard/buddies"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Focus buddies"
        >
          <Handshake className="size-5" />
        </Link>
        {signedIn && (
          <Link
            href="/dashboard/notifications"
            className="relative grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-primary" />}
          </Link>
        )}
        <Link
          href="/dashboard/people"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Find people"
        >
          <Users className="size-5" />
        </Link>
      </div>
    </div>
  );
}
