"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { isActive, usePopover, type ChromeData } from "./app-shell";
import { FocusModeMenu } from "./focus-mode-menu";
import { Icon, type IconName } from "./icon";
import { LeaderboardCard, StreakCard } from "./rail";
import { Avatar, LockMark } from "./ui";
import { formatDuration } from "@/lib/time";

type Pop = "streak" | "more" | "live" | "rank" | "focus";

const MORE = [
  { href: "/dashboard/locked-in", label: "Locked In", icon: "focusingNow" },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
] as const;

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 220;
const EDGE = 8;

/** The floating dock: your streak, the main pages, Lock in, and who's live. 768px and up. */
export function AppDock({ data, path }: { data: ChromeData; path: string }) {
  const { user, live, myRank } = data;
  const pop = usePopover<Pop>();
  const openedBy = useRef<"hover" | "click">("click");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bar = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const moreActive = MORE.some((m) => isActive(path, m.href));

  // hover opens on a mouse, and a click pins it open. Touch and keyboard just click.
  function hover(id: Pop | null) {
    clearTimeout(timer.current);
    if (id) {
      timer.current = setTimeout(() => {
        if (pop.open && openedBy.current === "click") return;
        openedBy.current = "hover";
        pop.setOpen(id);
      }, HOVER_OPEN_MS);
    } else if (openedBy.current === "hover") {
      timer.current = setTimeout(() => pop.setOpen(null), HOVER_CLOSE_MS);
    }
  }
  function click(id: Pop) {
    clearTimeout(timer.current);
    if (pop.open === id && openedBy.current === "click") return pop.setOpen(null);
    openedBy.current = "click";
    pop.setOpen(id);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const trigger = (id: Pop) => ({
    "aria-expanded": pop.open === id,
    "aria-haspopup": "dialog" as const,
    "data-dock-item": "",
    onClick: () => click(id),
    onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && hover(id),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType === "mouse" && hover(null),
  });

  // the dot under the active page slides from item to item
  useLayoutEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>("[aria-current=page], [data-active]");
    const d = dot.current;
    if (!d) return;
    if (!el) {
      d.style.opacity = "0";
      return;
    }
    d.style.opacity = "1";
    d.style.transform = `translateX(${el.offsetLeft + el.offsetWidth / 2 - 2}px)`;
  }, [path]);

  // arrow keys move along the dock
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = [...(bar.current?.querySelectorAll<HTMLElement>("[data-dock-item]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  const goal = formatDuration(data.goalMin * 60);

  return (
    <nav aria-label="Main" ref={pop.box} className="app-dock-wrap">
      <div ref={bar} className="app-dock" onKeyDown={onKeyDown}>
        {user && (
          <>
            <button
              {...trigger("streak")}
              aria-label={`${data.streak} day streak, today ${formatDuration(data.todaySec)} of ${goal}`}
              className="app-dock-btn"
              data-text
            >
              <span className="app-flame" data-off={data.streak === 0 || undefined}>
                <Icon name="streak" size={18} solid={data.streak > 0} />
              </span>
              <span aria-hidden>
                {data.streak}
                <span className="app-dock-extra">
                  {" "}
                  <span className="text-subtle">·</span> {formatDuration(data.todaySec)}/{goal}
                </span>
              </span>
            </button>
            <span className="app-dock-divider" aria-hidden />
          </>
        )}

        <DockLink href="/dashboard" icon="home" label="Home" path={path} />
        <DockLink href="/dashboard/stats" icon="stats" label="Stats" path={path} />
        <DockLink href="/dashboard/people" icon="people" label="People" path={path} />

        {/* in a session it goes straight back to it; otherwise it asks which kind of focus */}
        {data.inSession ? (
          <Link href="/dashboard/timer" data-dock-item className="app-dock-primary">
            <LockMark className="size-[24px] shrink-0 overflow-visible" /> Lock in
          </Link>
        ) : (
          <button
            aria-expanded={pop.open === "focus"}
            aria-haspopup="dialog"
            data-dock-item
            onClick={() => click("focus")}
            className="app-dock-primary"
          >
            <LockMark className="size-[24px] shrink-0 overflow-visible" /> Lock in
          </button>
        )}

        <DockLink href="/dashboard/buddies" icon="buddies" label="Buddies" path={path} badge={data.activity.buddies} />
        <DockLink href="/dashboard/rooms" icon="liveRooms" label="Live rooms" path={path} badge={data.activity.rooms} />
        <button {...trigger("more")} aria-label="More pages" data-tip="More" data-active={moreActive || undefined} className="app-dock-btn">
          <Icon name="more" size={24} />
        </button>

        <span className="app-dock-divider" aria-hidden />

        <button
          {...trigger("live")}
          aria-label={`${live.count} locked in right now`}
          data-tip="Locked In"
          className="app-dock-btn"
          data-text
        >
          <Icon name="focusingNow" size={23} className="text-live" />
          <span aria-hidden>{live.count}</span>
        </button>
        <button
          {...trigger("rank")}
          aria-label={myRank ? `You're number ${myRank} today` : "Today's leaderboard"}
          data-tip="Today's leaderboard"
          className="app-dock-btn"
          data-text={myRank ? "" : undefined}
        >
          <Icon name="crown" size={22} solid className="text-gold" />
          {myRank && <span aria-hidden>#{myRank}</span>}
        </button>

        <span ref={dot} className="app-dock-dot" aria-hidden />
      </div>

      {pop.open && (
        <DockPopover
          openId={pop.open}
          dock={bar}
          onPointerEnter={() => clearTimeout(timer.current)}
          onPointerLeave={(e) => e.pointerType === "mouse" && hover(null)}
          label={{ streak: "Your streak", more: "More pages", live: "Locked In", rank: "Today's leaderboard", focus: "Lock in" }[pop.open]}
        >
          {pop.open === "streak" && (
            <StreakCard streak={data.streak} todaySec={data.todaySec} goalMin={data.goalMin} week={data.week} bare />
          )}
          {pop.open === "more" && (
            <div className="p-1.5">
              {MORE.map((m) => (
                <Link key={m.href} href={m.href} aria-current={isActive(path, m.href) ? "page" : undefined} className="app-menu-row">
                  <Icon name={m.icon} size={18} /> {m.label}
                </Link>
              ))}
            </div>
          )}
          {pop.open === "focus" && <FocusModeMenu onPick={() => pop.setOpen(null)} />}
          {pop.open === "live" && <LiveList data={data} />}
          {pop.open === "rank" && (
            <>
              <LeaderboardCard rows={data.board} bare />
              {myRank && myRank > data.board.length && (
                <p className="border-t border-border/50 px-3.5 py-2.5 text-[12.5px] text-muted">
                  You’re <span className="tabular text-foreground">#{myRank}</span> today
                </p>
              )}
            </>
          )}
        </DockPopover>
      )}
    </nav>
  );
}

function DockLink({
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
  const active = isActive(path, href);
  return (
    <Link
      href={href}
      data-dock-item
      aria-label={label}
      data-tip={label}
      aria-current={active ? "page" : undefined}
      className="app-dock-btn"
    >
      <Icon name={icon} size={24} active={active} badge={badge ? "live" : false} />
    </Link>
  );
}

function LiveList({ data }: { data: ChromeData }) {
  const { count, sessions } = data.live;
  return (
    <div className="p-3.5">
      <p className="text-[14.5px] font-semibold tracking-[-0.025em]">Locked In</p>
      <p className="text-[12.5px] text-muted">
        {count === 0 ? "Nobody yet. Be the first." : `${count} ${count === 1 ? "person" : "people"} in a session`}
      </p>
      {sessions.length > 0 && (
        <ul className="-mx-1.5 mt-2">
          {sessions.map((s) => (
            <li key={s.user.id}>
              <Link href={`/dashboard/u/${s.user.username}`} className="flex h-11 items-center gap-2.5 rounded-2xl p-1.5 hover:bg-inset">
                <Avatar name={s.user.name} src={s.user.avatar} size={30} live />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.user.name}</span>
                {s.label && <span className="max-w-[40%] truncate text-[12px] text-muted">{s.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/dashboard/locked-in"
        className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-primary-text hover:underline"
      >
        See everyone locked in <Icon name="chevron" size={14} />
      </Link>
    </div>
  );
}

type PopoverProps = {
  openId: string;
  dock: React.RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
  onPointerEnter: () => void;
  onPointerLeave: (e: React.PointerEvent) => void;
};

/** Rises from the dock over its trigger, kept inside the window at the edges. */
function DockPopover({ openId, dock, label, children, onPointerEnter, onPointerLeave }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    // measured after the trigger has been marked open, so it can be found
    const el = panel.current;
    const anchor = dock.current?.querySelector<HTMLElement>("[aria-expanded=true]");
    if (!el || !anchor || !dock.current) return;
    const a = anchor.getBoundingClientRect();
    const d = dock.current.getBoundingClientRect();
    const width = el.offsetWidth;
    const left = Math.min(Math.max(a.left + a.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
    setAt({ left, bottom: window.innerHeight - d.top + 10 });
  }, [openId, dock]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="app-pop fixed w-[300px] max-w-[calc(100vw-16px)]"
      style={at ? { left: at.left, bottom: at.bottom } : { visibility: "hidden", left: 0, bottom: 0 }}
    >
      {children}
    </div>
  );
}
