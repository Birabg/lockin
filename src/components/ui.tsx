import Link from "next/link";
import { brand } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/dashboard" className={`flex items-center gap-2 text-[22px] font-black tracking-tight ${className}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
          <path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z" />
        </svg>
      </span>
      <span className="lowercase">{brand.name}</span>
    </Link>
  );
}

const PALETTE = ["#8b80f9", "#4ade80", "#f5b366", "#6ec9d4", "#e85a6e", "#d4b06f", "#a78bfa", "#60a5fa"];

type AvatarProps = { name: string; src?: string | null; size?: number; live?: boolean };

export function Avatar({ name, src, size = 36, live = false }: AvatarProps) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = PALETTE[h % PALETTE.length];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote hosts vary by deployment, and these are already 256px
        <img src={src} alt="" width={size} height={size} className="size-full rounded-full object-cover" />
      ) : (
        <span
          className="grid size-full place-items-center rounded-full font-bold text-[#0a0a0b]"
          style={{ background: bg, fontSize: size * 0.38 }}
          aria-hidden
        >
          {initials}
        </span>
      )}
      {live && (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-live" aria-label="focusing now" />
      )}
    </span>
  );
}

export function GoalRing({
  pct,
  size = 64,
  stroke = 6,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 1);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--inset)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pt-5 pb-2 text-[11px] font-bold tracking-[0.08em] text-subtle uppercase">{children}</h2>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-bold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-[720px] animate-pulse space-y-3 lg:pt-6" role="status" aria-label="Loading">
      <div className="h-8 w-40 rounded-lg bg-inset" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="panel h-24" />
      ))}
    </div>
  );
}

export function Pager({ page, hasNext, href }: { page: number; hasNext: boolean; href: (page: number) => string }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm font-bold">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-primary">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-subtle">Page {page}</span>
      {hasNext ? (
        <Link href={href(page + 1)} className="text-primary">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export const btnPrimary =
  "btn-3d inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50";
export const btnGhost =
  "btn-3d-muted inline-flex items-center justify-center gap-2 rounded-full border-2 border-border bg-card px-5 font-bold text-foreground hover:bg-inset";
export const inputCls =
  "w-full rounded-xl border-2 border-border bg-inset px-4 py-3 text-[15px] outline-none placeholder:text-subtle focus:border-primary";
