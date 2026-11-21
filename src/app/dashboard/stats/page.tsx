import "./stats.css";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { requireUser } from "@/lib/auth";
import { getFocusHistory, getStats, getWeekStrip, getWeeklyRecap } from "@/lib/queries";
import { formatDuration, formatHour } from "@/lib/time";
import { btnPrimary } from "@/components/ui";
import { DayBars, GoalRing, HeatLegend, Heatmap, RhythmClock, SUBJECT_COLORS, SubjectDonut, WeekDots, WeekRadar } from "./charts";
import { ShareCard } from "./share-card";

export const metadata = { title: "Stats" };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HISTORY_WEEKS = 20;

export default async function StatsPage() {
  const user = await requireUser("/dashboard/stats");
  const goalSec = user.dailyGoalMin * 60;
  const [s, recap, history, week] = await Promise.all([
    getStats(user),
    getWeeklyRecap(user, user.dailyGoalMin),
    getFocusHistory(user, HISTORY_WEEKS),
    getWeekStrip(user, user.timeZone, user.dailyGoalMin),
  ]);

  const change = recap.thisWeek - recap.lastWeekSoFar;
  const daysHit = s.last30.filter((d) => d.sec >= goalSec).length;
  const left = goalSec - s.today;

  // subjects: the top few, and the rest of the time as "Other" so the donut adds up
  const named = s.byLabel.map((l) => ({ label: l.label === "Untitled" ? "General" : l.label, sec: l.sec }));
  const rest = s.allTime - named.reduce((a, l) => a + l.sec, 0);
  const subjects = rest >= 60 ? [...named, { label: "Other", sec: rest }] : named;
  const subjectTotal = subjects.reduce((a, l) => a + l.sec, 0);

  const chips: { icon: IconName; tone: string; value: string; sub: string; lit?: boolean; subTone?: string }[] = [
    {
      icon: "streak",
      tone: "text-streak",
      lit: s.streak.current > 0,
      value: `${s.streak.current} ${s.streak.current === 1 ? "day" : "days"}`,
      sub: `best ${s.streak.best}d`,
    },
    {
      icon: "target",
      tone: "text-live",
      value: formatDuration(s.week),
      sub: change === 0 ? "this week" : `${change > 0 ? "▲" : "▼"} ${formatDuration(Math.abs(change))} vs last wk`,
      subTone: change > 0 ? "text-live" : change < 0 ? "text-danger" : undefined,
    },
    {
      icon: "leaderboard",
      tone: "text-gold",
      value: formatDuration(s.allTime),
      sub: `${s.sessionsCount} ${s.sessionsCount === 1 ? "session" : "sessions"}`,
    },
  ];

  const insights = buildInsights({
    hours: history.hours,
    weekdays: history.weekdays,
    change,
    streak: s.streak,
    daysHit,
    longest: s.longestSession,
    bestDay: history.bestDay,
  });

  return (
    <div className="stats-page">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">Stats</h1>
          <p className="text-[13px] text-muted">
            Daily goal {formatDuration(goalSec)} · hit on {daysHit} of the last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareCard username={user.username} />
          <Link href="/dashboard/timer" className={`${btnPrimary} h-10 text-sm`}>
            <Icon name="startFocus" size={16} solid /> Start focus
          </Link>
        </div>
      </header>

      {/* ---- Today ---- */}
      <section className="panel stats-hero">
        <div className="flex items-center gap-5">
          <GoalRing sec={s.today} goalSec={goalSec} />
          <div className="stats-today min-w-0">
            <p className="text-[13px] font-semibold text-muted">Today</p>
            <p className="mt-0.5 flex items-baseline gap-1.5 tabular">
              <span className="font-brand text-[44px] leading-none font-bold">{formatDuration(s.today)}</span>
              <span className="text-[15px] font-semibold text-subtle">/ {formatDuration(goalSec)}</span>
            </p>
            <p className={`mt-1.5 text-[13px] font-semibold ${left <= 0 ? "text-live" : "text-muted"}`}>
              {s.today === 0
                ? "Nothing yet today. One session gets the ring moving."
                : left > 0
                  ? `${formatDuration(left)} to go`
                  : left === 0
                    ? "Goal hit, right on time"
                    : `Goal hit, ${formatDuration(-left)} extra`}
            </p>
            <div className="mt-3">
              <WeekDots days={week} />
            </div>
          </div>
        </div>

        <ul className="stats-chips">
          {chips.map((c) => (
            <li key={c.icon} className="stats-chip">
              <span className={`stats-chip-icon ${c.tone}`}>
                <Icon name={c.icon} size={20} solid={c.lit ?? true} className={c.lit ? "streak-glow" : ""} />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] leading-tight font-extrabold tabular">{c.value}</span>
                <span className={`line-clamp-2 block text-[12px] leading-[1.3] font-semibold ${c.subTone ?? "text-muted"}`}>{c.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- The last month, and what it says ---- */}
      <div className="stats-grid-main">
        <section className="panel stats-card lg:col-span-2">
          <CardHead title="Last 30 days" aside={`Longest session ${formatDuration(s.longestSession)}`} />
          <DayBars days={s.last30} goalSec={goalSec} />
        </section>

        <section className="panel stats-card">
          <CardHead title="Insights" />
          {insights.length === 0 ? (
            <p className="text-[13px] text-muted">Finish a few sessions and patterns will show up here.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {insights.map((i) => (
                <li key={i.text} className="stats-insight">
                  <span className={`stats-insight-icon ${i.tone}`}>
                    <Icon name={i.icon} size={16} solid />
                  </span>
                  <span className="text-[13px] leading-[1.4]">{i.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Patterns ---- */}
      <div className="stats-grid-main">
        <section className="panel stats-card">
          <CardHead title="Focus rhythm" aside="When you focus" />
          <RhythmClock hours={history.hours} />
        </section>

        <section className="panel stats-card">
          <CardHead title="Week shape" aside="Average per day" />
          <WeekRadar weekdays={history.weekdays} goalSec={goalSec} />
          <div className="mt-1 flex justify-center gap-4 text-[11px] font-semibold text-subtle">
            <span className="flex items-center gap-1.5">
              <span className="stats-key stats-key-shape" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="stats-key stats-key-goal" /> Goal
            </span>
          </div>
        </section>

        <section className="panel stats-card">
          <CardHead title="Subjects" aside={`${named.length} ${named.length === 1 ? "subject" : "subjects"}`} />
          {subjects.length === 0 ? (
            <p className="text-[13px] text-muted">Label your sessions on the Focus page to see where your time goes.</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <SubjectDonut subjects={subjects} total={subjectTotal} />
              <ul className="flex w-full flex-col gap-2">
                {subjects.map((l, i) => (
                  <li key={l.label} className="flex items-center gap-2.5 text-[13px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{l.label}</span>
                    <span className="text-muted tabular">{formatDuration(l.sec)}</span>
                    <span className="w-10 text-right text-[12px] text-subtle tabular">
                      {Math.round((l.sec / Math.max(subjectTotal, 1)) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ---- The long view ---- */}
      <section className="panel stats-card mt-3">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <dl className="flex flex-wrap gap-x-7 gap-y-2">
            {[
              [`Last ${HISTORY_WEEKS} weeks`, formatDuration(history.total)],
              ["Active days", String(history.activeDays)],
              ["Best day", history.bestDay ? formatDuration(history.bestDay.sec) : "–"],
              ["Best streak", `${s.streak.best}d`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] font-semibold text-muted">{k}</dt>
                <dd className="font-brand text-[22px] leading-tight font-bold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <HeatLegend />
        </div>
        <Heatmap days={history.days} goalSec={goalSec} today={history.today} />
      </section>
    </div>
  );
}

function CardHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {aside && <span className="truncate text-[12px] font-semibold text-subtle">{aside}</span>}
    </div>
  );
}

type Insight = { icon: IconName; tone: string; text: string };

/** Plain-language takeaways from the numbers, most useful first. Only the ones there's data for. */
function buildInsights(d: {
  hours: number[];
  weekdays: number[];
  change: number;
  streak: { current: number; best: number };
  daysHit: number;
  longest: number;
  bestDay: { key: string; sec: number } | null;
}): Insight[] {
  const out: Insight[] = [];
  const { current, best } = d.streak;

  if (current > 0 && current >= best)
    out.push({ icon: "streak", tone: "text-streak", text: `You're on your best streak ever: ${current} days. Keep it going today.` });
  else if (current > 0)
    out.push({
      icon: "streak",
      tone: "text-streak",
      text: `${best - current + 1} more days and you beat your best streak of ${best} days.`,
    });
  else out.push({ icon: "streak", tone: "text-streak", text: "Focus today to start a new streak." });

  if (d.hours.some((h) => h > 0)) {
    const peak = d.hours.indexOf(Math.max(...d.hours));
    out.push({ icon: "time", tone: "text-primary", text: `You focus most around ${formatHour(peak)}. Protect that hour.` });
  }

  if (d.weekdays.some((w) => w > 0)) {
    const top = d.weekdays.indexOf(Math.max(...d.weekdays));
    out.push({
      icon: "target",
      tone: "text-live",
      text: `${WEEKDAYS[top]}s are your strongest, at ${formatDuration(d.weekdays[top])} on average.`,
    });
  }

  if (d.change !== 0)
    out.push({
      icon: "stats",
      tone: d.change > 0 ? "text-live" : "text-danger",
      text:
        d.change > 0
          ? `${formatDuration(d.change)} ahead of this point last week.`
          : `${formatDuration(-d.change)} behind this point last week. A short session closes the gap.`,
    });

  out.push({ icon: "check", tone: "text-live", text: `Goal hit on ${d.daysHit} of the last 30 days.` });

  if (d.longest > 0) out.push({ icon: "medal", tone: "text-gold", text: `Longest session: ${formatDuration(d.longest)}.` });

  return out.slice(0, 5);
}
