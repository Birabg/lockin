"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Ellipsis,
  Flame,
  Handshake,
  Home,
  LogOut,
  Play,
  Radio,
  Settings,
  Timer,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Avatar, Logo, btnPrimary } from "./ui";
import { logout } from "@/app/actions/auth";
import { useSidebarCollapsed } from "@/lib/use-sidebar";

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

type NavUser = { name: string; username: string; avatar: string | null; streak: number } | null;

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

const navItem =
  "relative flex h-12 shrink-0 items-center gap-4 rounded-full text-[15.5px] leading-[23.25px] tracking-[-0.025em] transition-colors";
const navIcon = "size-[23px] shrink-0";

function UserMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row = "flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium hover:bg-inset";
  return (
    <div ref={box} className="shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-inset hover:text-foreground"
      >
        <Ellipsis className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div className="panel absolute inset-x-0 bottom-full z-20 mb-2 p-1.5">
          <Link href={`/dashboard/u/${username}`} onClick={() => setOpen(false)} className={row}>
            <User className="size-[18px]" aria-hidden /> Profile
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)} className={row}>
            <Settings className="size-[18px]" aria-hidden /> Settings
          </Link>
          <form action={logout}>
            <button className={row}>
              <LogOut className="size-[18px]" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function StreakLine({ days }: { days: number }) {
  if (days === 0) return <span className="block truncate text-[12.5px] leading-[18.75px] text-muted">No streak yet</span>;
  return (
    <span className="flex items-center gap-1 truncate text-[12.5px] leading-[18.75px] text-muted tabular-nums">
      <Flame className="size-3.5 shrink-0 text-streak" fill="currentColor" aria-hidden />
      {days} day streak
    </span>
  );
}

const userName = "block truncate text-[14.5px] leading-[21.75px] font-extrabold tracking-[-0.025em]";

export function Sidebar({ user, unread, initialCollapsed }: SidebarProps) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed(initialCollapsed);
  const inset = collapsed ? "justify-center px-0" : "pr-3 pl-3.5";
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Toggle = collapsed ? ChevronRight : ChevronLeft;

  return (
    <aside
      className={`sticky top-0 ml-[min(4vw,76.8px)] hidden h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-auto px-3 py-4 whitespace-nowrap transition-[width] duration-200 [scrollbar-width:none] lg:flex ${
        collapsed ? "w-[72px]" : "w-(--sidebar-width)"
      }`}
    >
      <div className={`flex shrink-0 items-center ${collapsed ? "flex-col gap-3" : "h-8 justify-between pl-3.5"}`}>
        <Logo compact={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-inset/60 hover:text-foreground"
        >
          <Toggle className="size-[18px]" strokeWidth={2.2} aria-hidden />
        </button>
      </div>
      <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
        {SIDEBAR.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`${navItem} ${inset} ${
                active
                  ? "bg-inset font-extrabold text-foreground"
                  : "font-medium text-foreground/80 hover:bg-inset/60 hover:text-foreground"
              }`}
            >
              <Icon className={`${navIcon} ${active ? "text-primary" : ""}`} strokeWidth={2} />
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
            className={`${navItem} ${inset} ${
              path === "/dashboard/notifications"
                ? "bg-inset font-extrabold text-foreground"
                : "font-medium text-foreground/80 hover:bg-inset/60 hover:text-foreground"
            }`}
          >
            <Bell className={`${navIcon} ${path === "/dashboard/notifications" ? "text-primary" : ""}`} strokeWidth={2} />
            {!collapsed && "Notifications"}
            <UnreadBadge count={unread} compact={collapsed} />
          </Link>
        )}
      </nav>
      <Link
        href="/dashboard/timer"
        title={collapsed ? "Start focus" : undefined}
        className={`${btnPrimary} mt-3.5 h-12 shrink-0 text-[15.5px] font-extrabold ${collapsed ? "px-0!" : ""}`}
      >
        <Play className="size-[18px] shrink-0 fill-current" /> <span className={collapsed ? "sr-only" : ""}>Start focus</span>
      </Link>

      <div className="relative mt-auto pt-4">
        {user ? (
          <div className={`flex h-14 items-center ${collapsed ? "justify-center" : "gap-1 rounded-full p-2 hover:bg-inset/60"}`}>
            <Link
              href="/dashboard/settings"
              title={collapsed ? user.name : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-full ${collapsed ? "" : "flex-1"}`}
            >
              <Avatar name={user.name} src={user.avatar} size={40} />
              <span className={collapsed ? "sr-only" : "min-w-0"}>
                <span className={userName}>{user.name}</span>
                <StreakLine days={user.streak} />
              </span>
            </Link>
            {!collapsed && <UserMenu username={user.username} />}
          </div>
        ) : (
          <div className={`flex h-14 items-center gap-3 ${collapsed ? "justify-center" : "p-2"}`} title={collapsed ? "Guest" : undefined}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-inset text-sm font-bold text-muted">G</span>
            <span className={collapsed ? "sr-only" : ""}>
              <span className={userName}>Guest</span>
              <span className="block text-[12.5px] leading-[18.75px] text-muted">Public preview</span>
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
