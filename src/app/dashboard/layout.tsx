import { cookies } from "next/headers";
import { getActiveSession } from "@/app/actions/focus";
import { FocusHeartbeat } from "@/components/focus-heartbeat";
import { GoalAlert } from "@/components/goal-alert";
import { LiveRefresh } from "@/components/live-refresh";
import { BottomNav, MobileTopBar, Sidebar } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { getNavActivity, getStreak } from "@/lib/queries";
import { reapStaleSessions } from "@/lib/sessions";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, active, , jar] = await Promise.all([getCurrentUser(), getActiveSession(), reapStaleSessions(), cookies()]);
  const [unread, streak, activity] = user
    ? await Promise.all([getUnreadCount(user.id), getStreak(user), getNavActivity(user.id)])
    : [0, null, { buddies: false, rooms: false }];
  return (
    <div data-app-chrome className="mx-auto flex min-h-dvh max-w-[1920px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 panel focus:px-4 focus:py-2">
        Skip to content
      </a>
      <LiveRefresh />
      <FocusHeartbeat sessionId={active?.id ?? null} paused={!!active?.pausedAt} />
      <GoalAlert session={active} />
      <Sidebar
        user={user ? { name: user.name, username: user.username, avatar: user.avatar, streak: streak?.current ?? 0 } : null}
        unread={unread}
        activity={activity}
        initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED}
      />
      <div id="main" className="min-w-0 flex-1 px-4 pb-28 lg:px-8 lg:pb-10">
        <MobileTopBar signedIn={!!user} unread={unread} activity={activity} />
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
