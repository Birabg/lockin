import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listQuests, type QuestTab } from "@/lib/community";
import { PageHeader } from "@/components/ui";
import { QuestGrid } from "@/components/community/quest-grid";
import { SignInPrompt } from "@/components/community/modal";

export const metadata = { title: "Quests" };

const TABS: { id: QuestTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "joined", label: "Joined" },
  { id: "ended", label: "Ended" },
];

export default async function QuestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: param } = await searchParams;
  const tab = TABS.find((t) => t.id === param)?.id ?? "active";
  const user = await getCurrentUser();
  const quests = await listQuests(user?.id ?? null, tab);

  const empty =
    tab === "joined"
      ? user
        ? "You haven’t joined any quests yet."
        : "Sign in to see the quests you joined."
      : tab === "ended"
        ? "No quests have ended yet."
        : "No quests yet. Post the first challenge.";

  return (
    <div className="mx-auto max-w-[880px]">
      <PageHeader
        title="Quests"
        subtitle="Focus challenges from the community. Join one, then lock in: finished sessions count on their own."
      />
      <nav aria-label="Quest lists" className="mb-6 flex gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "active" ? "/dashboard/quests" : `/dashboard/quests?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`h-9 rounded-full px-4 text-sm leading-9 font-bold ${
              tab === t.id ? "bg-foreground text-background" : "text-muted hover:bg-inset hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <QuestGrid key={tab} initial={quests} signedIn={!!user} empty={empty} />
      <SignInPrompt />
    </div>
  );
}
