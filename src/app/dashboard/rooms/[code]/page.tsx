import { notFound } from "next/navigation";
import { leaveRoom, joinRoom } from "@/app/actions/together";
import { requireUser } from "@/lib/auth";
import { getRoom } from "@/lib/social-features";
import { PageHeader, btnGhost, btnPrimary } from "@/components/ui";
import { RoomGrid } from "./room-grid";

export const metadata = { title: "Live room" };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const viewer = await requireUser(`/dashboard/rooms/${code}`);
  const room = await getRoom(code.toUpperCase(), viewer.id);
  if (!room) notFound();

  const focusing = room.members.filter((m) => m.session).length;

  return (
    <div className="mx-auto max-w-[880px] lg:pt-6">
      <PageHeader title={room.name} subtitle={`${focusing} of ${room.members.length} focusing · Room code ${room.code}`} />
      {room.isMember ? (
        <RoomGrid members={room.members} serverNow={Date.now()} />
      ) : (
        <form
          action={async (form) => {
            "use server";
            await joinRoom(undefined, form);
          }}
          className="panel p-4"
        >
          <input type="hidden" name="code" value={room.code} />
          <button className={`${btnPrimary} h-11 w-full text-sm`}>Join this room</button>
        </form>
      )}
      {room.isMember && (
        <form action={leaveRoom.bind(null, room.id)} className="mt-4">
          <button className={`${btnGhost} h-10 text-sm`}>Leave room</button>
        </form>
      )}
    </div>
  );
}
