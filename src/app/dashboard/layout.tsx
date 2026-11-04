import { getActiveSession } from "@/app/actions/focus";
import { FocusHeartbeat } from "@/components/focus-heartbeat";
import { BottomNav, MobileTopBar, Sidebar } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { reapStaleSessions } from "@/lib/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, active] = await Promise.all([getCurrentUser(), getActiveSession(), reapStaleSessions()]);
  return (
    <div className="flex min-h-dvh">
      <FocusHeartbeat sessionId={active?.id ?? null} />
      <Sidebar user={user ? { name: user.name, username: user.username } : null} />
      <div className="min-w-0 flex-1 px-4 pb-28 lg:px-8 lg:pb-10">
        <MobileTopBar />
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
