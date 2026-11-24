import "./people.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { parsePage } from "@/lib/page";
import { getFocusingNow, getFollowCounts, listPeople, type PeopleTab, type PersonRow } from "@/lib/queries";
import { formatDuration } from "@/lib/time";
import { Avatar, PageHeader, Pager, btnPrimary } from "@/components/ui";
import { Icon } from "@/components/icon";
import { FollowButton } from "@/components/follow-button";
import { PeopleSearch } from "./people-search";

export const metadata = { title: "People" };

const TABS: { id: PeopleTab; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "following", label: "Following" },
  { id: "followers", label: "Followers" },
];

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const q = ([params.q ?? ""].flat()[0] ?? "").slice(0, 60);
  const page = parsePage(params.page);
  const viewer = await getCurrentUser();
  const tab: PeopleTab = viewer ? (TABS.find((t) => t.id === params.tab)?.id ?? "discover") : "discover";
  const showLive = tab === "discover" && !q && page === 1;

  const [{ people, hasNext }, counts, live] = await Promise.all([
    listPeople({ q, tab, page, viewerId: viewer?.id ?? null }),
    viewer ? getFollowCounts(viewer.id) : null,
    showLive ? getFocusingNow(12, viewer?.id ?? null) : null,
  ]);

  const href = (next: { tab?: PeopleTab; q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const t = next.tab ?? tab;
    const query = next.q ?? q;
    if (t !== "discover") p.set("tab", t);
    if (query) p.set("q", query);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const s = p.toString();
    return s ? `/dashboard/people?${s}` : "/dashboard/people";
  };

  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeader title="People" subtitle="Find friends to focus with." />

      <div className="people-controls">
        <PeopleSearch q={q} tab={tab} />
        {viewer && (
          <nav aria-label="Show" className="people-tabs">
            {TABS.map((t) => {
              const n = t.id === "following" ? counts?.following : t.id === "followers" ? counts?.followers : undefined;
              return (
                <Link
                  key={t.id}
                  href={href({ tab: t.id, page: 1 })}
                  aria-current={tab === t.id ? "page" : undefined}
                  className="people-tab"
                  scroll={false}
                >
                  {t.label}
                  {n !== undefined && <span className="people-tab-count tabular">{n}</span>}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      {live && live.count > 0 && (
        <section className="panel people-live" aria-labelledby="people-live-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="people-live-title" className="flex items-center gap-2 text-[14px] font-bold">
              <span className="people-live-dot" aria-hidden /> Locked In
            </h2>
            <Link href="/dashboard/locked-in" className="text-[12.5px] font-bold text-primary">
              See all {live.count}
            </Link>
          </div>
          <ul className="people-live-list">
            {live.sessions.map((s) => (
              <li key={s.user.id}>
                <Link href={`/dashboard/u/${s.user.username}`} className="people-live-item" title={s.label ?? undefined}>
                  <span className="people-live-ring">
                    <Avatar name={s.user.name} src={s.user.avatar} size={48} />
                  </span>
                  <span className="w-full truncate text-center text-[12px] font-semibold">{s.user.name.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q && page === 1 && people.length > 0 && (
        <p className="mb-2 px-1 text-[12.5px] font-semibold text-subtle" aria-live="polite">
          {hasNext ? `${people.length}+` : people.length} {people.length === 1 && !hasNext ? "match" : "matches"} for “{q}”
        </p>
      )}

      {people.length === 0 ? (
        <Empty
          tab={tab}
          q={q}
          clearHref={href({ q: "", page: 1 })}
          discoverHref={href({ tab: "discover", q: "", page: 1 })}
          everyoneHref={href({ tab: "discover", page: 1 })}
        />
      ) : (
        <ul className="panel people-list">
          {people.map((p) => (
            <PersonItem key={p.id} p={p} q={q} viewerId={viewer?.id ?? null} />
          ))}
        </ul>
      )}

      <Pager page={page} hasNext={hasNext} href={(n) => href({ page: n })} />
    </div>
  );
}

function PersonItem({ p, q, viewerId }: { p: PersonRow; q: string; viewerId: string | null }) {
  const profile = `/dashboard/u/${p.username}`;
  return (
    <li className="people-row">
      <Link href={profile} className="people-row-link" aria-label={`${p.name}, @${p.username}`} />
      <span className="people-avatar">
        <Avatar name={p.name} src={p.avatar} size={46} />
        {p.live && <span className="people-avatar-live" title="Locked In" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-bold">{highlight(p.name, q)}</span>
          {p.followsYou && <span className="people-badge">Follows you</span>}
        </span>
        <span className="block truncate text-[13px] text-muted">
          {highlight(`@${p.username}`, q.replace(/^@/, ""))}
          {p.bio && <span className="text-subtle"> · {p.bio}</span>}
        </span>
        <span className="people-meta">
          {p.live ? <span className="font-bold text-live">Locked In{p.live.label ? ` · ${p.live.label}` : ""}</span> : null}
          {!p.live && p.streak > 0 && (
            <span className="flex items-center gap-1 text-streak">
              <Icon name="streak" size={13} solid /> {p.streak} {p.streak === 1 ? "day" : "days"}
            </span>
          )}
          {!p.live && p.weekSec >= 60 && (
            <span className="flex items-center gap-1">
              <Icon name="time" size={13} /> {formatDuration(p.weekSec)} this week
            </span>
          )}
          {!p.live && p.streak === 0 && p.weekSec < 60 && <span>No focus this week yet</span>}
        </span>
      </span>

      {viewerId !== p.id && (
        <span className="people-row-action">
          <FollowButton userId={p.id} following={p.following} followsYou={p.followsYou} signedIn={!!viewerId} name={p.name} />
        </span>
      )}
    </li>
  );
}

/** Wraps the part of the text that matches the search, so you can see why someone came up. */
function highlight(text: string, q: string): ReactNode {
  const term = q.trim();
  if (!term || term === "@") return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="people-mark">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function Empty({
  tab,
  q,
  clearHref,
  discoverHref,
  everyoneHref,
}: {
  tab: PeopleTab;
  q: string;
  clearHref: string;
  discoverHref: string;
  everyoneHref: string;
}) {
  const [title, body, action] =
    q && tab !== "discover"
      ? [
          tab === "following" ? `No one you follow matches “${q}”.` : `None of your followers match “${q}”.`,
          "They might still be on Lockin.",
          <Link key="a" href={everyoneHref} className={`${btnPrimary} h-10 text-sm`}>
            Search everyone
          </Link>,
        ]
      : q
        ? [
            `No one matches “${q}”.`,
            "Check the spelling, or try part of their name or @username.",
            <Link key="a" href={clearHref} className="font-bold text-primary">
              Clear search
            </Link>,
          ]
        : tab === "following"
          ? [
              "You’re not following anyone yet",
              "Follow people to see their focus sessions in your feed and cheer them on.",
              <Link key="a" href={discoverHref} className={`${btnPrimary} h-10 text-sm`}>
                Discover people
              </Link>,
            ]
          : tab === "followers"
            ? [
                "No followers yet",
                "Share your sessions to the feed and keep your streak going. People find you through your focus.",
                <Link key="a" href="/dashboard/timer" className={`${btnPrimary} h-10 text-sm`}>
                  Start a session
                </Link>,
              ]
            : ["No one here yet", "Invite a friend and focus together.", null];
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-inset text-subtle">
        <Icon name={q ? "search" : "people"} size={22} />
      </span>
      <p className="text-[15px] font-bold">{title}</p>
      <p className="max-w-[340px] text-[13px] text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
