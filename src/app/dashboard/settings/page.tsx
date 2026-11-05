import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Avatar, PageHeader, btnGhost } from "@/components/ui";
import { AvatarForm } from "./avatar-form";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  return (
    <div className="mx-auto max-w-[560px] lg:pt-6">
      <PageHeader title="Profile" />
      <Link href={`/dashboard/u/${user.username}`} className="panel mb-4 flex items-center gap-3 p-4 hover:border-primary/40">
        <Avatar name={user.name} src={user.avatar} size={48} />
        <span>
          <span className="block font-bold">{user.name}</span>
          <span className="block text-sm text-muted">@{user.username} · view public profile</span>
        </span>
      </Link>
      <AvatarForm name={user.name} avatar={user.avatar} />
      <ProfileForm
        user={{ name: user.name, bio: user.bio ?? "", dailyGoalMin: user.dailyGoalMin, timeZone: user.timeZone }}
        timeZones={[...new Set([user.timeZone, "UTC", ...Intl.supportedValuesOf("timeZone")])].sort()}
      />
      <form action={logout} className="mt-4">
        <button className={`${btnGhost} h-11 w-full text-sm text-danger`}>Log out</button>
      </form>
      <DeleteAccount />
      <p className="mt-4 text-center text-xs">
        <Link href="/privacy" className="text-subtle underline">
          Privacy
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-subtle">
        Icons:{" "}
        <a href="https://www.figma.com/community/file/1166831539721848736" className="underline" target="_blank" rel="noreferrer">
          Solar by 480 Design
        </a>
        ,{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
      </p>
    </div>
  );
}
