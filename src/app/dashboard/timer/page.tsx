import { requireUser } from "@/lib/auth";
import { getActiveSession } from "@/app/actions/focus";
import { getFocusingNow, getStreak, getTodaySeconds } from "@/lib/queries";
import { TimerClient } from "./timer-client";

export const metadata = { title: "Focus" };

export default async function TimerPage() {
  const user = await requireUser("/dashboard/timer");
  const [active, todaySec, live, streak] = await Promise.all([
    getActiveSession(),
    getTodaySeconds(user),
    getFocusingNow(0),
    getStreak(user),
  ]);
  return (
    <div className="mx-auto max-w-[560px] pt-4 lg:pt-10">
      <TimerClient
        active={active}
        todaySec={todaySec}
        dailyGoalMin={user.dailyGoalMin}
        liveCount={live.count}
        serverNow={Date.now()}
        savedSceneId={user.sceneId}
        streak={streak.current}
        user={{ name: user.name, username: user.username, avatar: user.avatar }}
        timeZone={user.timeZone}
      />
    </div>
  );
}
