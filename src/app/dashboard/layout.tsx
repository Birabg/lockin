import { getActiveSession } from "@/app/actions/focus";
import { FocusHeartbeat } from "@/components/focus-heartbeat";
import { LiveRefresh } from "@/components/live-refresh";
import { BottomNav, MobileTopBar, Sidebar } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { reapStaleSessions } from "@/lib/sessions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, active] = await Promise.all([getCurrentUser(), getActiveSession(), reapStaleSessions()]);
  const unread = user ? await getUnreadCount(user.id) : 0;
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 panel focus:px-4 focus:py-2">
        Skip to content
      </a>
      <LiveRefresh />
      <FocusHeartbeat sessionId={active?.id ?? null} paused={!!active?.pausedAt} />
      <Sidebar user={user ? { name: user.name, username: user.username, avatar: user.avatar } : null} unread={unread} />
      <div id="main" className="min-w-0 flex-1 px-4 pb-28 lg:px-8 lg:pb-10">
        <MobileTopBar signedIn={!!user} unread={unread} />
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
