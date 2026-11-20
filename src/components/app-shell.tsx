"use client";

import "./app-chrome.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { AccentDot, AccentPicker, AccentQuick } from "./accent-picker";
import { AppDock } from "./app-dock";
import { Icon, type IconName } from "./icon";
import { StreakCard } from "./rail";
import { Avatar, Logo } from "./ui";
import { logout } from "@/app/actions/auth";
import type { WeekDay } from "@/lib/queries";

type Person = { id: string; username: string; name: string; avatar: string | null };

/** Everything the chrome shows, fetched once by the dashboard layout and kept fresh by LiveRefresh. */
export type ChromeData = {
  user: { id: string; name: string; username: string; avatar: string | null } | null;
  unread: number;
  activity: { buddies: boolean; rooms: boolean };
  streak: number;
  todaySec: number;
  goalMin: number;
  week: WeekDay[];
  live: { count: number; sessions: { label: string | null; user: Person }[] };
  board: { rank: number; sec: number; user: Person }[];
  /** Your place on today's board, when you're in the top 50. */
  myRank: number | null;
};

export const isActive = (path: string, href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

const TITLES: [prefix: string, title: string][] = [
  ["/dashboard/stats", "Stats"],
  ["/dashboard/leaderboard", "Leaderboard"],
  ["/dashboard/people", "People"],
  ["/dashboard/buddies", "Focus buddies"],
  ["/dashboard/rooms", "Live rooms"],
  ["/dashboard/notifications", "Notifications"],
  ["/dashboard/focusing", "Focusing now"],
  ["/dashboard/settings", "Settings"],
  ["/dashboard/quests", "Quests"],
  ["/dashboard/wall", "The wall"],
  ["/dashboard/u/", "Profile"],
];
const titleFor = (path: string) => TITLES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "";

/** Open state for a menu or popover: closes on Escape, a press outside, or moving to another page. */
export function usePopover<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(null), [path]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      box.current?.querySelector<HTMLElement>("[aria-expanded=true]")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, box, toggle: (id: T) => setOpen((v) => (v === id ? null : id)) };
}

/** The top bar, the dock and the mobile nav round every dashboard page. The focus page owns the whole screen. */
export function AppShell({ data, banner, children }: { data: ChromeData; banner?: ReactNode; children: ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/dashboard/timer")) return <main id="main">{children}</main>;
  return (
    <>
      <TopBar data={data} path={path} />
      <main id="main" className="app-main">
        {banner}
        {children}
      </main>
      <AppDock data={data} path={path} />
      <MobileNav path={path} />
    </>
  );
}

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

function TopBar({ data, path }: { data: ChromeData; path: string }) {
  const scrolled = useScrolled();
  const { user, unread } = data;
  const menu = usePopover<"account" | "accent" | "more">();
  const [sheet, setSheet] = useState(false);

  return (
    <header className="app-topbar" data-scrolled={scrolled || undefined}>
      <div className="app-topbar-inner">
        <div className="flex min-w-0 items-center">
          <Logo compact className="sm:hidden" />
          <Logo className="max-sm:hidden" />
        </div>

        <div className="app-topbar-center">
          {path === "/dashboard" ? <AccentQuick /> : <span className="app-title">{titleFor(path)}</span>}
        </div>

        <div ref={menu.box} className="app-topbar-actions relative">
          <Link href="/dashboard/people" aria-label="Search people" data-tip="Search" className="app-icon-btn max-sm:hidden">
            <Icon name="search" size={21} />
          </Link>
          {user && (
            <Link
              href="/dashboard/notifications"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              aria-current={path === "/dashboard/notifications" ? "page" : undefined}
              data-tip="Notifications"
              className="app-icon-btn"
            >
              <Icon name="notifications" size={21} badge={unread > 0} />
            </Link>
          )}
          {user && (
            <button onClick={() => setSheet(true)} aria-label={`${data.streak} day streak`} className="app-streak-chip relative md:hidden">
              <Icon name="streak" size={15} solid={data.streak > 0} />
              {data.streak}
            </button>
          )}

          {/* on phones, the pages the bottom nav has no room for */}
          <button
            onClick={() => menu.toggle("more")}
            aria-label="More pages"
            aria-expanded={menu.open === "more"}
            aria-haspopup="true"
            className="app-icon-btn md:hidden"
          >
            <Icon name="more" size={21} />
          </button>
          {menu.open === "more" && (
            <div className="app-pop absolute top-full right-0 mt-2" data-menu>
              <MenuLink href="/dashboard/wall" icon="comment" label="Wall" path={path} />
              <MenuLink href="/dashboard/quests" icon="target" label="Quests" path={path} />
              <MenuLink href="/dashboard/people" icon="search" label="Find people" path={path} />
              <MenuLink href="/dashboard/focusing" icon="focusingNow" label="Focusing now" path={path} />
              <MenuLink href="/dashboard/buddies" icon="buddies" label="Buddies" path={path} badge={data.activity.buddies} />
              <MenuLink href="/dashboard/rooms" icon="liveRooms" label="Live rooms" path={path} badge={data.activity.rooms} />
            </div>
          )}

          {user ? (
            <>
              <button
                onClick={() => menu.setOpen((v) => (v === "account" || v === "accent" ? null : "account"))}
                aria-label="Account menu"
                aria-expanded={menu.open === "account" || menu.open === "accent"}
                aria-haspopup="true"
                className="app-icon-btn ml-1"
              >
                <Avatar name={user.name} src={user.avatar} size={32} />
              </button>
              {menu.open === "accent" && (
                <div
                  role="dialog"
                  aria-label="Accent colour"
                  className="app-pop absolute top-full right-0 mt-2 w-[min(340px,calc(100vw-24px))] p-3"
                >
                  <div className="mb-2.5 flex items-center gap-1">
                    <button
                      onClick={() => menu.setOpen("account")}
                      aria-label="Back to account menu"
                      className="grid size-8 place-items-center rounded-full text-muted hover:bg-inset hover:text-foreground"
                    >
                      <Icon name="chevron" size={16} className="rotate-180" />
                    </button>
                    <p className="text-[14.5px] font-extrabold tracking-[-0.02em]">Accent colour</p>
                  </div>
                  <AccentPicker compact />
                </div>
              )}
              {menu.open === "account" && (
                <div className="app-pop absolute top-full right-0 mt-2" data-menu>
                  <p className="truncate px-3 pt-1.5 pb-2 text-[12.5px] text-muted">@{user.username}</p>
                  <MenuLink href={`/dashboard/u/${user.username}`} icon="profile" label="Profile" path={path} />
                  <MenuLink href="/dashboard/settings" icon="settings" label="Settings" path={path} />
                  <button onClick={() => menu.setOpen("accent")} className="app-menu-row">
                    <AccentDot /> Accent colour
                    <Icon name="chevron" size={16} className="ml-auto text-subtle" />
                  </button>
                  <form action={logout}>
                    <button className="app-menu-row">
                      <Icon name="logout" size={18} /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="ml-1 flex items-center gap-1">
              <Link
                href={`/login?next=${encodeURIComponent(path)}`}
                className="flex h-10 items-center rounded-full px-2 text-[13px] font-semibold whitespace-nowrap text-muted hover:text-foreground sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="btn-3d flex h-9 items-center rounded-full bg-primary px-3 text-[13px] sm:px-4 font-bold whitespace-nowrap text-primary-foreground"
              >
                Join free
              </Link>
            </div>
          )}
        </div>
      </div>

      {sheet && user && (
        <StreakSheet onClose={() => setSheet(false)}>
          <StreakCard streak={data.streak} todaySec={data.todaySec} goalMin={data.goalMin} week={data.week} bare />
        </StreakSheet>
      )}
    </header>
  );
}

function MenuLink({
  href,
  icon,
  label,
  path,
  badge = false,
}: {
  href: string;
  icon: IconName;
  label: string;
  path: string;
  badge?: boolean;
}) {
  return (
    <Link href={href} aria-current={isActive(path, href) ? "page" : undefined} className="app-menu-row">
      <Icon name={icon} size={18} badge={badge ? "live" : false} /> {label}
    </Link>
  );
}

function StreakSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const close = useRef(onClose);
  close.current = onClose;
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (path !== first.current) close.current();
  }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // out on the body, so the sticky top bar's layer can't put it under the bottom nav
  return createPortal(
    <>
      <div className="app-sheet-backdrop" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Your streak" className="app-sheet">
        <div className="mb-1 flex justify-end">
          <button autoFocus onClick={onClose} aria-label="Close" className="app-icon-btn">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}

const MOBILE: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/stats", label: "Stats", icon: "stats" },
  { href: "/dashboard/leaderboard", label: "Ranks", icon: "leaderboard" },
  { href: "/dashboard/settings", label: "Profile", icon: "profile" },
];

function MobileNav({ path }: { path: string }) {
  const item = ({ href, label, icon }: (typeof MOBILE)[number]) => {
    const active = isActive(path, href);
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined} className="app-mobile-item">
        <Icon name={icon} size={26} active={active} />
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="app-mobile-nav">
      <div className="app-mobile-bar">
        {MOBILE.slice(0, 2).map(item)}
        <Link href="/dashboard/timer" aria-label="Focus" className="app-mobile-focus">
          <Icon name="startFocus" size={28} solid />
        </Link>
        {MOBILE.slice(2).map(item)}
      </div>
    </nav>
  );
}
