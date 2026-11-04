import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyRooms } from "@/lib/social-features";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { RoomForms } from "./room-forms";

export const metadata = { title: "Live rooms" };

export default async function RoomsPage() {
  const user = await requireUser("/dashboard/rooms");
  const rooms = await getMyRooms(user.id);

  return (
    <div className="mx-auto max-w-[680px] lg:pt-6">
      <PageHeader title="Live rooms" subtitle="Focus together and watch everyone’s timers in one place." />
      <RoomForms />
      <SectionTitle>Your rooms</SectionTitle>
      {rooms.length === 0 ? (
        <EmptyState title="No rooms yet" body="Create one and share its code, or join a friend’s." />
      ) : (
        <ul className="panel divide-y divide-border/60">
          {rooms.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/rooms/${r.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-inset/60">
                <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                <span className="text-xs text-muted">
                  {r._count.members} {r._count.members === 1 ? "person" : "people"}
                </span>
                <span className="font-mono text-xs font-bold text-primary-text">{r.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
