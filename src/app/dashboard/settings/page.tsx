import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Avatar, PageHeader, btnGhost } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  return (
    <div className="mx-auto max-w-[560px] lg:pt-6">
      <PageHeader title="Profile" />
      <Link href={`/dashboard/u/${user.username}`} className="panel mb-4 flex items-center gap-3 p-4 hover:border-primary/40">
        <Avatar name={user.name} size={48} />
        <span>
          <span className="block font-bold">{user.name}</span>
          <span className="block text-sm text-muted">@{user.username} · view public profile</span>
        </span>
      </Link>
      <ProfileForm user={{ name: user.name, bio: user.bio ?? "", dailyGoalMin: user.dailyGoalMin }} />
      <form action={logout} className="mt-4">
        <button className={`${btnGhost} h-11 w-full text-sm text-danger`}>Log out</button>
      </form>
    </div>
  );
}
