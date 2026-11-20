import Link from "next/link";
import { notFound } from "next/navigation";
import { decisionsFor } from "@/lib/admin-rules";
import { getAdminLog, getHiddenContent, getOpenReports, getUpcomingQuestions, searchUsersForAdmin, type Preview } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { wallDay } from "@/lib/community";
import { isAdmin } from "@/lib/moderation";
import { timeAgo } from "@/lib/time";
import { Avatar, EmptyState, inputCls } from "@/components/ui";
import { BanButton, ReportButtons, RestoreButton } from "./admin-buttons";
import { QuestionForm } from "./question-form";

export const metadata = { title: "Admin", robots: { index: false } };

const TABS = [
  { id: "reports", label: "Reports" },
  { id: "hidden", label: "Hidden" },
  { id: "users", label: "Users" },
  { id: "log", label: "Log" },
  { id: "question", label: "Question of the day" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const NOUN: Record<string, string> = {
  post: "Post",
  comment: "Comment",
  quest: "Quest",
  take: "Take",
  user: "Account",
  question: "Question",
};

function Item({ type, preview, children }: { type: string; preview: Preview | null; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-bold tracking-wide text-muted uppercase">
        {NOUN[type] ?? type}
        {preview?.author && type !== "user" && (
          <>
            {" · "}
            <Link href={`/dashboard/admin?tab=users&q=${preview.author}`} className="normal-case hover:underline">
              @{preview.author}
            </Link>
          </>
        )}
        {preview?.hidden && <span className="ml-1.5 rounded bg-danger/15 px-1.5 py-0.5 text-danger">hidden</span>}
        {preview?.banned && <span className="ml-1.5 rounded bg-danger/15 px-1.5 py-0.5 text-danger">banned</span>}
      </p>
      <p className="mt-0.5 text-sm break-words">{preview ? preview.text : <span className="text-muted italic">Already deleted</span>}</p>
      {children}
    </div>
  );
}

/** Only ADMIN_USERNAMES get this page; for everyone else it doesn't exist. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.username)) notFound();
  const params = await searchParams;
  const tab: Tab = TABS.find((t) => t.id === params.tab)?.id ?? "reports";
  const q = (params.q ?? "").slice(0, 100);

  return (
    <div className="mx-auto max-w-[760px]" data-admin>
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Admin</h1>
      <nav className="mb-5 flex flex-wrap gap-1.5" aria-label="Admin sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${t.id === tab ? "bg-primary text-primary-foreground" : "bg-inset text-muted hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "reports" && <Reports />}
      {tab === "hidden" && <Hidden />}
      {tab === "users" && <Users q={q} />}
      {tab === "log" && <Log />}
      {tab === "question" && <Questions />}
    </div>
  );
}

async function Reports() {
  const reports = await getOpenReports();
  if (reports.length === 0) return <EmptyState title="No open reports" body="Nothing's waiting for a look." />;
  return (
    <ul className="panel divide-y divide-border/60" data-section="reports">
      {reports.map((r) => (
        <li key={`${r.type}:${r.id}`} className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-start" data-report={r.id}>
          <Item type={r.type} preview={r.preview}>
            <p className="mt-1 text-[12px] text-muted">
              {r.count} {r.count === 1 ? "report" : "reports"}: {r.reasons} · last {timeAgo(r.lastAt)}
            </p>
          </Item>
          <ReportButtons type={r.type} id={r.id} decisions={r.preview || r.type === "user" ? decisionsFor(r.type) : ["dismiss"]} />
        </li>
      ))}
    </ul>
  );
}

async function Hidden() {
  const items = await getHiddenContent();
  if (items.length === 0) return <EmptyState title="Nothing hidden" body="Content hidden by reports or by you shows up here." />;
  return (
    <ul className="panel divide-y divide-border/60" data-section="hidden">
      {items.map((i) => (
        <li key={`${i.type}:${i.id}`} className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-start" data-hidden-item={i.id}>
          <Item type={i.type} preview={{ ...i.preview, hidden: false }} />
          <RestoreButton type={i.type} id={i.id} />
        </li>
      ))}
    </ul>
  );
}

async function Users({ q }: { q: string }) {
  const users = await searchUsersForAdmin(q);
  return (
    <>
      <form className="mb-4" action="/dashboard/admin">
        <input type="hidden" name="tab" value="users" />
        <input name="q" defaultValue={q} aria-label="Search users" placeholder="Username, name or email" className={inputCls} />
      </form>
      {users.length === 0 ? (
        <EmptyState title="No one matches" body={`Nobody matches “${q}”.`} />
      ) : (
        <ul className="panel divide-y divide-border/60" data-section="users">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 p-4" data-user={u.username}>
              <Avatar name={u.name} src={u.avatar} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {u.name} <span className="font-semibold text-muted">@{u.username}</span>
                  {u.bannedAt && (
                    <span className="ml-1.5 rounded bg-danger/15 px-1.5 py-0.5 text-[11px] text-danger uppercase">banned</span>
                  )}
                </p>
                <p className="truncate text-[12px] text-muted">
                  {u.email} · joined {timeAgo(u.createdAt)}
                  {u.openReports > 0 && ` · ${u.openReports} open ${u.openReports === 1 ? "report" : "reports"}`}
                </p>
              </div>
              {!isAdmin(u.username) && <BanButton id={u.id} banned={!!u.bannedAt} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Log() {
  const rows = await getAdminLog();
  if (rows.length === 0) return <EmptyState title="Nothing yet" body="Every admin action is recorded here." />;
  return (
    <ul className="panel divide-y divide-border/60 text-sm" data-section="log">
      {rows.map((r) => (
        <li key={r.id} className="p-3.5">
          <p>
            <span className="font-bold">@{r.adminUsername}</span> <span className="font-semibold">{r.action}</span>{" "}
            <span className="text-muted">{(NOUN[r.targetType] ?? r.targetType).toLowerCase()}</span>
            <span className="float-right text-[12px] text-muted">{timeAgo(r.createdAt)}</span>
          </p>
          {r.detail && <p className="mt-0.5 break-words text-muted">{r.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

async function Questions() {
  const today = wallDay();
  const upcoming = await getUpcomingQuestions(today);
  return (
    <div className="flex flex-col gap-4">
      <QuestionForm today={today} />
      <section className="panel p-5">
        <h2 className="mb-2 font-extrabold">Scheduled</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">Nothing scheduled. Days without a question use the built-in bank.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {upcoming.map((d) => (
              <li key={d.id} className="py-2.5">
                <p className="font-bold">
                  {d.day} <span className="font-semibold text-muted">· {d.question}</span>
                </p>
                <p className="text-[12px] text-muted">
                  {d.options.join(" / ")} · by @{d.createdBy?.username} · {d._count.votes} votes
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
