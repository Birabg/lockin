"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Play, Radio, Timer, Trophy, User, Users } from "lucide-react";
import { Avatar, Logo, btnPrimary } from "./ui";

const SIDEBAR = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/timer", label: "Focus", icon: Timer },
  { href: "/dashboard/focusing", label: "Focusing now", icon: Radio },
  { href: "/dashboard/stats", label: "Stats", icon: BarChart3 },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/people", label: "People", icon: Users },
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

type NavUser = { name: string; username: string } | null;

export function Sidebar({ user }: { user: NavUser }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
      <Logo className="px-3" />
      <nav className="mt-7 flex flex-col gap-1">
        {SIDEBAR.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                active ? "bg-inset text-foreground" : "text-sidebar-foreground hover:bg-inset/60 hover:text-foreground"
              }`}
            >
              <Icon className={`size-[19px] ${active ? "text-primary" : ""}`} strokeWidth={2.2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link href="/dashboard/timer" className={`${btnPrimary} mt-6 h-12 text-[15px]`}>
        <Play className="size-4 fill-current" /> Start focus
      </Link>

      <div className="mt-auto">
        {user ? (
          <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-inset">
            <Avatar name={user.name} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{user.name}</span>
              <span className="block truncate text-xs text-muted">@{user.username}</span>
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid size-[34px] place-items-center rounded-full bg-inset text-sm font-bold text-muted">G</span>
            <span>
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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="flex w-full max-w-[560px] items-center justify-between rounded-full border border-border bg-[#0f0f11]/95 p-1.5 backdrop-blur">
        {BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
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

export function MobileTopBar() {
  return (
    <div className="flex items-center justify-between py-3 lg:hidden">
      <Logo />
      <Link href="/dashboard/people" className="grid size-10 place-items-center rounded-full text-muted hover:bg-inset" aria-label="Find people">
        <Users className="size-5" />
      </Link>
    </div>
  );
}
