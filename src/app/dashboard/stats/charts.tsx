import { formatDuration, formatHour } from "@/lib/time";

/** Colours for subjects, in order. The first is the accent. */
export const SUBJECT_COLORS = ["var(--primary)", "var(--live)", "var(--streak)", "#a78bfa", "#f472b6", "#38bdf8"];

const dayName = (key: string, style: "long" | "short" = "short") =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en", { weekday: style, month: "short", day: "numeric", timeZone: "UTC" });

/** Today's progress towards the goal, with the percentage in the middle. Past the goal it turns green and keeps a second lap. */
export function GoalRing({ sec, goalSec, size = 132 }: { sec: number; goalSec: number; size?: number }) {
  const r = 52;
  const ratio = goalSec ? sec / goalSec : 0;
  const pct = Math.round(ratio * 100);
  const done = ratio >= 1;
  return (
    <div className="stats-ring relative shrink-0" style={{ width: size, height: size }} data-done={done || undefined}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} className="stats-ring-track" />
        <circle cx="60" cy="60" r={r} pathLength={1} className="stats-ring-fill" style={{ strokeDashoffset: 1 - Math.min(ratio, 1) }} />
        {ratio > 1 && (
          <circle
            cx="60"
            cy="60"
            r={r}
            pathLength={1}
            className="stats-ring-lap"
            style={{ strokeDashoffset: 1 - Math.min(ratio - 1, 1) }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-brand text-[30px] leading-none font-bold tabular">
          {pct}
          <span className="text-[15px] text-muted">%</span>
        </span>
        <span className="mt-1 text-[11px] font-semibold text-muted">{done ? "goal hit" : "of goal"}</span>
      </div>
    </div>
  );
}

/** Mon..Sun of this week as dots: filled once the goal was hit, a ring for focus short of it, today outlined. */
export function WeekDots({
  days,
}: {
  days: { key: string; letter: string; sec: number; hit: boolean; isToday: boolean; isFuture: boolean }[];
}) {
  return (
    <ol className="flex gap-1.5" aria-label="This week">
      {days.map((d) => (
        <li key={d.key} className="flex flex-col items-center gap-1">
          <span
            className="stats-weekdot"
            data-state={d.hit ? "hit" : d.sec >= 60 ? "some" : d.isFuture ? "future" : "none"}
            data-today={d.isToday || undefined}
            title={`${dayName(d.key)} · ${formatDuration(d.sec)}`}
          />
          <span className={`text-[10.5px] font-bold ${d.isToday ? "text-foreground" : "text-subtle"}`}>{d.letter}</span>
        </li>
      ))}
    </ol>
  );
}

/** The last 30 days as bars, against a dashed goal line and a dotted line for the average. */
export function DayBars({ days, goalSec }: { days: { key: string; sec: number }[]; goalSec: number }) {
  const max = Math.max(goalSec * 1.15, ...days.map((d) => d.sec), 1);
  const avg = days.reduce((a, d) => a + d.sec, 0) / Math.max(days.length, 1);
  return (
    <div>
      <div className="relative h-48">
        <div className="stats-line stats-line-goal" style={{ bottom: `${(goalSec / max) * 100}%` }}>
          <span>goal {formatDuration(goalSec)}</span>
        </div>
        {avg > 0 && (
          <div className="stats-line stats-line-avg" style={{ bottom: `${(avg / max) * 100}%` }}>
            <span>avg {formatDuration(avg)}</span>
          </div>
        )}
        <ol className="flex h-full items-end gap-[3px]">
          {days.map((d, i) => (
            <li key={d.key} className="stats-bar-col group">
              <span
                className="stats-bar"
                data-state={d.sec >= goalSec ? "hit" : d.sec > 0 ? "some" : "none"}
                data-today={i === days.length - 1 || undefined}
                style={{ height: `${Math.max((d.sec / max) * 100, 2.5)}%` }}
              />
              <span className="stats-tip">
                {dayName(d.key)} · <b>{formatDuration(d.sec)}</b>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-subtle">
        <span>{dayName(days[0].key)}</span>
        <span>{dayName(days[Math.floor(days.length / 2)].key)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** A 24-hour clock with a bar for each hour, as long as the focus that happened in it. Midnight at the top. */
export function RhythmClock({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1);
  const peak = hours.indexOf(Math.max(...hours));
  const any = hours.some((h) => h > 0);
  const inner = 46;
  const outer = 92;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[250px]">
      <svg viewBox="-124 -114 248 228" className="size-full" role="img" aria-label="Focus by hour of the day">
        {[inner, (inner + outer) / 2, outer].map((r) => (
          <circle key={r} r={r} className="stats-grid" />
        ))}
        {hours.map((sec, h) => {
          const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
          const a2 = ((h + 1) / 24) * Math.PI * 2 - Math.PI / 2;
          const len = inner + (sec / max) * (outer - inner);
          const pad = 0.035;
          const p = (r: number, ang: number) => `${(Math.cos(ang) * r).toFixed(2)} ${(Math.sin(ang) * r).toFixed(2)}`;
          const d = `M ${p(inner, a + pad)} L ${p(len, a + pad)} A ${len} ${len} 0 0 1 ${p(len, a2 - pad)} L ${p(inner, a2 - pad)} A ${inner} ${inner} 0 0 0 ${p(inner, a + pad)} Z`;
          return (
            <path
              key={h}
              d={d}
              className="stats-rhythm-bar"
              data-peak={(any && h === peak) || undefined}
              data-empty={!sec || undefined}
              style={sec ? { opacity: 0.35 + (sec / max) * 0.65 } : undefined}
            >
              <title>{`${formatHour(h)}: ${formatDuration(sec)}`}</title>
            </path>
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
          return (
            <text key={h} x={Math.cos(a) * 103} y={Math.sin(a) * 103 + 3.5} className="stats-axis" textAnchor="middle">
              {formatHour(h).replace(" ", "").toLowerCase()}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        {any ? (
          <>
            <span className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Peak</span>
            <span className="font-brand text-[20px] leading-tight font-bold">{formatHour(peak)}</span>
          </>
        ) : (
          <span className="text-[12px] text-muted">No data yet</span>
        )}
      </div>
    </div>
  );
}

/** The average for each weekday as a radar, with the daily goal drawn as a dashed ring for scale. */
export function WeekRadar({ weekdays, goalSec }: { weekdays: number[]; goalSec: number }) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = Math.max(goalSec, ...weekdays, 1);
  const R = 80;
  const pt = (i: number, r: number) => {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const poly = (r: (i: number) => number) =>
    labels
      .map((_, i) =>
        pt(i, r(i))
          .map((v) => v.toFixed(2))
          .join(","),
      )
      .join(" ");
  const best = weekdays.indexOf(Math.max(...weekdays));
  return (
    <svg
      viewBox="-115 -105 230 215"
      className="mx-auto w-full max-w-[270px]"
      role="img"
      aria-label="Average focus for each day of the week"
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(() => R * f)} className="stats-grid" />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1="0" y1="0" x2={x} y2={y} className="stats-grid" />;
      })}
      <polygon points={poly(() => (goalSec / max) * R)} className="stats-radar-goal" />
      <polygon points={poly((i) => Math.max((weekdays[i] / max) * R, 2))} className="stats-radar-shape" />
      {labels.map((l, i) => {
        const [x, y] = pt(i, Math.max((weekdays[i] / max) * R, 2));
        const [lx, ly] = pt(i, R + 15);
        return (
          <g key={l}>
            <circle cx={x} cy={y} r={weekdays[i] ? 3.2 : 0} className="stats-radar-dot">
              <title>{`${l}: ${formatDuration(weekdays[i])} on average`}</title>
            </circle>
            <text
              x={lx}
              y={ly + 3.5}
              textAnchor="middle"
              className="stats-axis"
              data-best={(weekdays[best] > 0 && i === best) || undefined}
            >
              {l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Subjects as a donut, the total in the middle. */
export function SubjectDonut({ subjects, total }: { subjects: { label: string; sec: number }[]; total: number }) {
  const gap = subjects.length > 1 ? 0.006 : 0;
  const parts = subjects.map((s) => (total ? s.sec / total : 0));
  // where each slice starts: the sum of the slices before it
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + p, 0));
  return (
    <div className="relative size-[150px] shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="48" className="stats-ring-track" style={{ strokeWidth: 14 }} />
        {subjects.map((s, i) => (
          <circle
            key={s.label}
            cx="60"
            cy="60"
            r="48"
            pathLength={1}
            className="stats-donut-part"
            style={{
              stroke: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
              strokeDasharray: `${Math.max(parts[i] - gap, 0.002)} 1`,
              strokeDashoffset: -starts[i],
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-brand text-[22px] leading-none font-bold">{formatDuration(total)}</span>
        <span className="mt-1 text-[11px] font-semibold text-muted">all time</span>
      </div>
    </div>
  );
}

const MONTH = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });

/** How full a day was against the goal: nothing, some, half, the goal, double the goal. */
function level(sec: number, goalSec: number) {
  if (sec < 60) return 0;
  const r = sec / goalSec;
  return r >= 2 ? 4 : r >= 1 ? 3 : r >= 0.5 ? 2 : 1;
}

/** Every day of the last weeks as a square, one column per week, shaded against the daily goal. */
export function Heatmap({
  days,
  goalSec,
  today,
}: {
  days: { key: string; sec: number; future: boolean }[];
  goalSec: number;
  today: string;
}) {
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const startsMonth = (w: typeof days) => w.some((d) => d.key.endsWith("-01"));
  // the first column names its month too, unless a new month starts within two weeks and the labels would collide
  const labelFirst = !weeks.slice(0, 3).some(startsMonth);
  return (
    <div className="stats-heat-scroll">
      <div className="stats-heat" style={{ gridTemplateColumns: `30px repeat(${weeks.length}, 13px)` }}>
        <span />
        {weeks.map((w, i) => {
          const first = w.find((d) => d.key.endsWith("-01")) ?? (i === 0 && labelFirst ? w[0] : null);
          return (
            <span key={w[0].key} className="stats-heat-month">
              {first ? MONTH(first.key) : ""}
            </span>
          );
        })}
        {Array.from({ length: 7 }, (_, row) => (
          <Row key={row} row={row} weeks={weeks} goalSec={goalSec} today={today} />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  weeks,
  goalSec,
  today,
}: {
  row: number;
  weeks: { key: string; sec: number; future: boolean }[][];
  goalSec: number;
  today: string;
}) {
  return (
    <>
      <span className="stats-heat-day">{["Mon", "", "Wed", "", "Fri", "", "Sun"][row]}</span>
      {weeks.map((w) => {
        const d = w[row];
        if (!d) return <span key={`${row}-${w[0].key}`} />;
        return (
          <span
            key={d.key}
            className="stats-heat-cell group"
            data-level={d.future ? undefined : level(d.sec, goalSec)}
            data-future={d.future || undefined}
            data-today={d.key === today || undefined}
          >
            {!d.future && (
              <span className="stats-tip">
                {dayName(d.key)} · <b>{formatDuration(d.sec)}</b>
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-subtle">
      Less
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} className="stats-heat-cell !size-[11px]" data-level={l} />
      ))}
      More
    </div>
  );
}
