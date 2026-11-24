import "../rooms.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveRoom, joinRoom } from "@/app/actions/together";
import { requireUser } from "@/lib/auth";
import { getRoom } from "@/lib/social-features";
import { Avatar, btnPrimary } from "@/components/ui";
import { Icon } from "@/components/icon";
import { CopyButton } from "@/components/copy-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { RoomGrid } from "./room-grid";
import { RoomMenu } from "./leave-room";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `Room ${code.toUpperCase()}` };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const viewer = await requireUser(`/dashboard/rooms/${code}`);
  const room = await getRoom(code.toUpperCase(), viewer.id);
  if (!room) notFound();

  const focusing = room.members.filter((m) => m.session && !m.session.pausedAt).length;
  const invite = `/dashboard/rooms/${room.code}`;

  return (
    <div className="mx-auto max-w-[880px]">
      {room.isMember && <AutoRefresh seconds={15} />}

      <Link href="/dashboard/rooms" className="room-back">
        <Icon name="chevron" size={16} className="rotate-180" /> Rooms
      </Link>

      <header className="panel room-head">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] leading-tight font-extrabold tracking-tight">{room.name}</h1>
          <p className={`mt-1 flex items-center gap-1.5 text-[13px] font-semibold ${focusing ? "text-live" : "text-muted"}`}>
            {focusing > 0 && <span className="rooms-live-dot" aria-hidden />}
            {focusing > 0
              ? `${focusing} of ${room.members.length} locked in`
              : room.members.length === 1
                ? "Just you so far. Invite a friend to focus with."
                : `${room.members.length} in the room, all quiet`}
            {room.ownerId === viewer.id && <span className="rooms-badge ml-1">Yours</span>}
          </p>
        </div>
        <div className="room-head-actions">
          <CopyButton text={room.code} label={`Copy room code ${room.code}`} className="rooms-code rooms-code-lg">
            <span className="font-mono tracking-[0.14em]">{room.code}</span>
          </CopyButton>
          <CopyButton text={invite} share={{ title: `Join ${room.name} on Lockin` }} className="room-invite">
            Invite
          </CopyButton>
          {room.isMember && <RoomMenu leave={leaveRoom.bind(null, room.id)} name={room.name} />}
        </div>
      </header>

      {room.isMember ? (
        <RoomGrid members={room.members} serverNow={Date.now()} viewerId={viewer.id} />
      ) : (
        <section className="panel room-join">
          <span className="rooms-faces">
            {room.members.slice(0, 6).map(({ user }) => (
              <span key={user.id} className="rooms-face">
                <Avatar name={user.name} src={user.avatar} size={40} />
              </span>
            ))}
          </span>
          <p className="text-[16px] font-bold">You’ve been invited to focus together</p>
          <p className="max-w-[360px] text-[13px] text-muted">
            Join to see everyone’s timers live, and let them see yours when you start a session.
          </p>
          <form
            action={async (form) => {
              "use server";
              await joinRoom(undefined, form);
            }}
            className="mt-2 w-full max-w-[280px]"
          >
            <input type="hidden" name="code" value={room.code} />
            <button className={`${btnPrimary} h-11 w-full text-sm`}>Join this room</button>
          </form>
        </section>
      )}
    </div>
  );
}
