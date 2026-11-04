import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getNotifications, type NotificationType } from "@/lib/notifications";
import { parsePage } from "@/lib/page";
import { timeAgo } from "@/lib/time";
import { Avatar, EmptyState, PageHeader, Pager } from "@/components/ui";
import { MarkRead } from "./mark-read";

export const metadata = { title: "Notifications" };

const TEXT: Record<NotificationType, string> = {
  LIKE: "liked your post",
  COMMENT: "commented on your post",
  FOLLOW: "started following you",
  SESSION_START: "started a focus session",
  NUDGE: "nudged you to lock in",
  BUDDY_REQUEST: "wants to be your focus buddy",
  BUDDY_ACCEPT: "is now your focus buddy",
};

const hrefFor = (type: string, username: string) =>
  type.startsWith("BUDDY") || type === "NUDGE" ? "/dashboard/buddies" : `/dashboard/u/${username}`;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser("/dashboard/notifications");
  const page = parsePage((await searchParams).page);
  const { items, hasNext } = await getNotifications(user.id, page);
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-[680px] lg:pt-6">
      <PageHeader title="Notifications" />
      {hasUnread && <MarkRead />}
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" body="Likes, comments, new followers and friends starting sessions will show up here." />
      ) : (
        <ul className="panel divide-y divide-border/60">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={hrefFor(n.type, n.actor.username)} className="flex items-center gap-3 px-4 py-3 hover:bg-inset/60">
                <Avatar name={n.actor.name} src={n.actor.avatar} size={38} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-bold">{n.actor.name}</span> {TEXT[n.type as NotificationType] ?? "did something"}
                  <span className="block text-xs text-muted" suppressHydrationWarning>
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                {!n.readAt && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} hasNext={hasNext} href={(p) => `/dashboard/notifications?page=${p}`} />
    </div>
  );
}
