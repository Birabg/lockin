import { requireUser } from "@/lib/auth";
import { getActiveSession } from "@/app/actions/focus";
import { getFocusingNow, getStreak, getTodaySeconds, getTopLabels } from "@/lib/queries";
import { TimerClient } from "./timer-client";

export const metadata = { title: "Focus" };

export default async function TimerPage() {
  const user = await requireUser("/dashboard/timer");
  const [active, todaySec, live, streak, labels] = await Promise.all([
    getActiveSession(),
    getTodaySeconds(user),
    getFocusingNow(3),
    getStreak(user),
    getTopLabels(user.id),
  ]);
  return (
    <div className="mx-auto max-w-[560px] pt-4 lg:pt-10">
      <TimerClient
        active={active}
        todaySec={todaySec}
        dailyGoalMin={user.dailyGoalMin}
        liveCount={live.count}
        liveUsers={live.sessions.map((s) => s.user)}
        labels={labels}
        serverNow={Date.now()}
        savedSceneId={user.sceneId}
        savedClockStyle={user.clockStyle}
        streak={streak.current}
        user={{ name: user.name, username: user.username, avatar: user.avatar }}
        timeZone={user.timeZone}
      />
    </div>
  );
}
