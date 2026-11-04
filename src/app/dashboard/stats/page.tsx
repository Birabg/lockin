import { Clock, Flame, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStats } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Stats" };

export default async function StatsPage() {
  const user = await requireUser("/dashboard/stats");
  const s = await getStats(user);
  const goalSec = user.dailyGoalMin * 60;
  const max = Math.max(goalSec, ...s.last30.map((d) => d.sec), 1);
  const goalLine = (goalSec / max) * 100;
  const daysHit = s.last30.filter((d) => d.sec >= goalSec).length;
  const labelMax = Math.max(...s.byLabel.map((l) => l.sec), 1);

  const tiles = [
    { label: "Today", value: formatDuration(s.today), icon: Clock, tone: "text-primary" },
    { label: "This week", value: formatDuration(s.week), icon: Target, tone: "text-live" },
    { label: "Current streak", value: `${s.streak.current}d`, sub: `Best ${s.streak.best}d`, icon: Flame, tone: "text-streak" },
    { label: "All time", value: formatDuration(s.allTime), sub: `${s.sessionsCount} sessions`, icon: Trophy, tone: "text-gold" },
  ];

  return (
    <div className="mx-auto max-w-[880px] lg:pt-6">
      <PageHeader title="Stats" subtitle={`Daily goal ${formatDuration(goalSec)} · hit on ${daysHit} of the last 30 days`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
          <div key={label} className="panel p-4">
            <Icon className={`size-5 ${tone}`} />
            <p className="mt-3 text-2xl font-extrabold tabular">{value}</p>
            <p className="text-xs font-semibold text-muted">{label}</p>
            {sub && <p className="mt-0.5 text-[11px] text-subtle">{sub}</p>}
          </div>
        ))}
      </div>

      <section className="panel mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Last 30 days</h2>
          <span className="text-xs text-muted">Longest session {formatDuration(s.longestSession)}</span>
        </div>
        <div className="relative mt-6 h-44">
          <div className="absolute inset-x-0 border-t border-dashed border-primary/50" style={{ bottom: `${goalLine}%` }}>
            <span className="absolute -top-5 right-0 text-[10px] font-bold text-primary-text">goal</span>
          </div>
          <div className="flex h-full items-end gap-[3px]">
            {s.last30.map((d) => (
              <div key={d.key} className="group relative flex h-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-[4px] ${d.sec >= goalSec ? "bg-primary" : d.sec > 0 ? "bg-primary/45" : "bg-inset"}`}
                  style={{ height: `${Math.max((d.sec / max) * 100, 2)}%` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-[11px] font-bold whitespace-nowrap text-background group-hover:block">
                  {d.key.slice(5)} · {formatDuration(d.sec)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-subtle">
          <span>{s.last30[0].key.slice(5)}</span>
          <span>Today</span>
        </div>
      </section>

      <section className="panel mt-4 p-4">
        <h2 className="font-bold">What you focused on</h2>
        {s.byLabel.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Label your sessions on the Focus page to see a breakdown.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {s.byLabel.map((l) => (
              <li key={l.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{l.label}</span>
                  <span className="text-muted tabular">{formatDuration(l.sec)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-inset">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(l.sec / labelMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
