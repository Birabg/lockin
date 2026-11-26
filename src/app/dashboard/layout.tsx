import { getActiveSession } from "@/app/actions/focus";
import { AppShell } from "@/components/app-shell";
import { FocusHeartbeat } from "@/components/focus-heartbeat";
import { GoalAlert } from "@/components/goal-alert";
import { LiveRefresh } from "@/components/live-refresh";
import { VerifyBanner, type BannerData } from "@/components/verify-banner";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { canSendEmail } from "@/lib/email";
import { verificationEnforced, verifyState } from "@/lib/verification";
import { getUnreadCount } from "@/lib/notifications";
import { getFocusingNow, getLeaderboard, getNavActivity, getStreak, getTodaySeconds, getWeekStrip } from "@/lib/queries";
import { reapStaleSessions } from "@/lib/sessions";

/** What the verification banner says, or null when there's nothing to show. */
function verifyBanner(user: CurrentUser): BannerData | null {
  const state = verifyState(user, new Date(), verificationEnforced());
  if (state.kind === "verified") return null;
  const canResend = canSendEmail();
  // with nothing enforced and no way to send, there's nothing for them to do
  if (state.kind === "unverified" && !canResend) return null;
  return {
    kind: state.kind,
    email: user.email,
    graceEndsAt: state.kind === "grace" && state.endsAt ? state.endsAt.toISOString() : null,
    canResend,
  };
}

/** How far down today's board to look for your own rank. */
const RANK_DEPTH = 50;
const DOCK_ROWS = 5;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, active] = await Promise.all([getCurrentUser(), getActiveSession(), reapStaleSessions()]);
  const timeZone = user?.timeZone ?? brand.timeZone;
  const goalMin = user?.dailyGoalMin ?? brand.defaultDailyGoalMin;
  // the same queries the home page's widgets used, now shared by the top bar and dock on every page
  const [unread, streak, activity, todaySec, week, live, board] = await Promise.all([
    user ? getUnreadCount(user.id) : 0,
    user ? getStreak(user) : null,
    user ? getNavActivity(user.id) : { buddies: false, rooms: false },
    user ? getTodaySeconds(user) : 0,
    user ? getWeekStrip(user, timeZone, goalMin) : [],
    getFocusingNow(DOCK_ROWS, user?.id ?? null),
    getLeaderboard("today", timeZone, { pageSize: RANK_DEPTH }),
  ]);
  const banner = user ? verifyBanner(user) : null;

  return (
    <div data-app-chrome className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 panel focus:px-4 focus:py-2">
        Skip to content
      </a>
      <LiveRefresh />
      <FocusHeartbeat sessionId={active?.id ?? null} paused={!!active?.pausedAt} />
      <GoalAlert session={active} />
      <AppShell
        banner={banner && <VerifyBanner data={banner} />}
        data={{
          user: user ? { id: user.id, name: user.name, username: user.username, avatar: user.avatar } : null,
          unread,
          activity,
          streak: streak?.current ?? 0,
          todaySec,
          goalMin,
          week,
          live: { count: live.count, sessions: live.sessions.map(({ label, user }) => ({ label, user })) },
          board: board.rows.slice(0, DOCK_ROWS),
          myRank: (user && board.rows.find((r) => r.user.id === user.id)?.rank) ?? null,
          inSession: !!active,
        }}
      >
        {children}
      </AppShell>
    </div>
  );
}
