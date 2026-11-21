"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type BreakdownTab = {
  id: string;
  label: string;
  /** a short note on what the chart covers, shown beside the title */
  aside: string;
  chart: ReactNode;
  facts?: { label: string; value: string; tone?: string }[];
};

/** One card for the ways of slicing your focus: by day, by hour, by weekday and by subject, behind tabs. */
export function Breakdown({ tabs }: { tabs: BreakdownTab[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  function onKey(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -active, End: tabs.length - 1 - active }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">Focus breakdown</h2>
          <p className="truncate text-[12px] font-semibold text-subtle">{tabs[active].aside}</p>
        </div>
        <div role="tablist" aria-label="Break down by" className="stats-tabs" onKeyDown={onKey}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${base}-${t.id}-tab`}
              aria-selected={i === active}
              aria-controls={`${base}-${t.id}`}
              tabIndex={i === active ? 0 : -1}
              className="stats-tab"
              onClick={() => setActive(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-${t.id}`}
          aria-labelledby={`${base}-${t.id}-tab`}
          hidden={i !== active}
          className="stats-panel"
        >
          <div className="stats-panel-chart">{t.chart}</div>
          {t.facts && t.facts.length > 0 && (
            <dl className="stats-facts">
              {t.facts.map((f) => (
                <div key={f.label} className="stats-fact">
                  <dt className="truncate text-[11.5px] font-semibold text-muted">{f.label}</dt>
                  <dd className={`truncate text-[16px] leading-tight font-extrabold tabular ${f.tone ?? ""}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </>
  );
}
