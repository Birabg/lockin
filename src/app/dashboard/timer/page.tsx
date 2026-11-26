import { requireUser } from "@/lib/auth";
import { getActiveSession } from "@/app/actions/focus";
import { getFocusingNow, getStreak, getTodaySeconds, getTopLabels } from "@/lib/queries";
import { isFocusMode } from "@/lib/focus-mode";
import { TimerClient } from "./timer-client";

export const metadata = { title: "Focus" };

export default async function TimerPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: param } = await searchParams;
  // Timelapse or Pomodoro, picked from the Lock in menu
  const mode = isFocusMode(param) ? param : null;
  const user = await requireUser(mode ? `/dashboard/timer?mode=${mode}` : "/dashboard/timer");
  const [active, todaySec, live, streak, labels] = await Promise.all([
    getActiveSession(),
    getTodaySeconds(user),
    getFocusingNow(0),
    getStreak(user),
    getTopLabels(user.id),
  ]);
  return (
    // the focus stage owns the whole screen: no top bar or dock here
    <div>
      <TimerClient
        active={active}
        todaySec={todaySec}
        dailyGoalMin={user.dailyGoalMin}
        liveCount={live.count}
        labels={labels}
        serverNow={Date.now()}
        savedSceneId={user.sceneId}
        savedClockStyle={user.clockStyle}
        streak={streak.current}
        timeZone={user.timeZone}
        initialMode={mode}
      />
    </div>
  );
}
