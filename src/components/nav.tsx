"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icon";
import { Avatar, Logo, btnPrimary } from "./ui";
import { logout } from "@/app/actions/auth";
import { useSidebarCollapsed } from "@/lib/use-sidebar";

type Activity = { buddies: boolean; rooms: boolean };

const SIDEBAR: { href: string; label: string; icon: IconName; signal?: keyof Activity }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/timer", label: "Focus", icon: "focus" },
  { href: "/dashboard/focusing", label: "Focusing now", icon: "focusingNow" },
  { href: "/dashboard/stats", label: "Stats", icon: "stats" },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/dashboard/people", label: "People", icon: "people" },
  { href: "/dashboard/buddies", label: "Buddies", icon: "buddies", signal: "buddies" },
  { href: "/dashboard/rooms", label: "Live rooms", icon: "liveRooms", signal: "rooms" },
];

const BOTTOM: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/timer", label: "Focus", icon: "focus" },
  { href: "/dashboard/stats", label: "Stats", icon: "stats" },
  { href: "/dashboard/leaderboard", label: "Ranks", icon: "leaderboard" },
  { href: "/dashboard/settings", label: "Profile", icon: "profile" },
];

function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === href : path.startsWith(href);
}

type NavUser = { name: string; username: string; avatar: string | null; streak: number } | null;

function UnreadCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

type SidebarProps = { user: NavUser; unread: number; activity: Activity; initialCollapsed: boolean };

const navItem =
  "icon-lift relative flex h-12 shrink-0 items-center gap-4 rounded-full text-[15.5px] leading-[23.25px] tracking-[-0.025em] transition-colors";

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
        <Icon name="more" size={20} weight="regular" />
      </button>
      {open && (
        <div className="panel absolute inset-x-0 bottom-full z-20 mb-2 p-1.5">
          <Link href={`/dashboard/u/${username}`} onClick={() => setOpen(false)} className={row}>
            <Icon name="profile" size={18} /> Profile
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)} className={row}>
            <Icon name="settings" size={18} /> Settings
          </Link>
          <form action={logout}>
            <button className={row}>
              <Icon name="logout" size={18} /> Sign out
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
      <Icon name="streak" size={14} weight="fill" className="streak-glow text-streak" />
      {days} day streak
    </span>
  );
}

const userName = "block truncate text-[14.5px] leading-[21.75px] font-extrabold tracking-[-0.025em]";

export function Sidebar({ user, unread, activity, initialCollapsed }: SidebarProps) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed(initialCollapsed);
  const inset = collapsed ? "justify-center px-0" : "pr-3 pl-3.5";
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

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
          <Icon name={collapsed ? "chevron" : "collapse"} size={18} weight="regular" />
        </button>
      </div>
      <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
        {SIDEBAR.map(({ href, label, icon, signal }) => {
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
              <Icon name={icon} size={24} active={active} badge={signal && activity[signal] ? "live" : false} className="text-muted" />
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
            <Icon name="notifications" size={24} active={path === "/dashboard/notifications"} badge={unread > 0} className="text-muted" />
            {!collapsed && "Notifications"}
            {!collapsed && <UnreadCount count={unread} />}
          </Link>
        )}
      </nav>
      <Link
        href="/dashboard/timer"
        title={collapsed ? "Start focus" : undefined}
        className={`${btnPrimary} mt-3.5 h-12 shrink-0 text-[15.5px] font-extrabold ${collapsed ? "px-0!" : ""}`}
      >
        <Icon name="startFocus" size={18} weight="fill" /> <span className={collapsed ? "sr-only" : ""}>Start focus</span>
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
        {BOTTOM.map(({ href, label, icon }) => {
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
              <Icon name={icon} size={22} active={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileTopBar({ signedIn, unread, activity }: { signedIn: boolean; unread: number; activity: Activity }) {
  return (
    <div className="flex items-center justify-between py-3 lg:hidden">
      <Logo />
      <div className="flex items-center">
        <Link
          href="/dashboard/rooms"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Live rooms"
        >
          <Icon name="liveRooms" size={22} badge={activity.rooms ? "live" : false} />
        </Link>
        <Link
          href="/dashboard/buddies"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Focus buddies"
        >
          <Icon name="buddies" size={22} badge={activity.buddies ? "live" : false} />
        </Link>
        {signedIn && (
          <Link
            href="/dashboard/notifications"
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Icon name="notifications" size={22} badge={unread > 0} />
          </Link>
        )}
        <Link
          href="/dashboard/people"
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset"
          aria-label="Find people"
        >
          <Icon name="people" size={22} />
        </Link>
      </div>
    </div>
  );
}
