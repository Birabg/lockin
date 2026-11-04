import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePage } from "@/lib/page";
import { searchPeople } from "@/lib/queries";
import { Avatar, PageHeader, Pager, inputCls } from "@/components/ui";
import { FollowButton } from "@/components/follow-button";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string }> }) {
  const params = await searchParams;
  const q = [params.q ?? ""].flat()[0];
  const page = parsePage(params.page);
  const viewer = await getCurrentUser();
  const { people, hasNext } = await searchPeople(q, page);
  const following = viewer
    ? new Set((await db.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true } })).map((f) => f.followingId))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-[680px] lg:pt-6">
      <PageHeader title="People" subtitle="Find friends to focus with." />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Search by name or @username" className={inputCls} />
      </form>
      <ul className="panel divide-y divide-border/60">
        {people.length === 0 && <li className="p-4 text-sm text-muted">No one matches “{q}”.</li>}
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/dashboard/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={p.name} size={40} />
              <span className="min-w-0">
                <span className="block truncate font-bold">{p.name}</span>
                <span className="block truncate text-xs text-muted">{p.bio || `@${p.username}`}</span>
              </span>
            </Link>
            {viewer?.id !== p.id && <FollowButton userId={p.id} following={following.has(p.id)} signedIn={!!viewer} />}
          </li>
        ))}
      </ul>
      <Pager page={page} hasNext={hasNext} href={(p) => `/dashboard/people?${new URLSearchParams({ q, page: String(p) })}`} />
    </div>
  );
}
