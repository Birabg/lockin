import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { AccentPicker } from "@/components/accent-picker";
import { Avatar, PageHeader, btnGhost } from "@/components/ui";
import { db } from "@/lib/db";
import { enabledProviders } from "@/lib/oauth";
import { isProvider, oauthErrorMessage, providerName } from "@/lib/oauth-flow";
import { AvatarForm } from "./avatar-form";
import { ConnectedAccounts } from "./connected-accounts";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

type Params = { connected?: string; oauth_error?: string; provider?: string };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser("/dashboard/settings");
  const params = await searchParams;
  const login = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, oauthAccounts: { select: { provider: true, email: true }, orderBy: { createdAt: "asc" } } },
  });
  const linked = login.oauthAccounts.flatMap((a) => (isProvider(a.provider) ? [{ provider: a.provider, email: a.email }] : []));
  const errorText = oauthErrorMessage(params.oauth_error, isProvider(params.provider) ? params.provider : undefined);
  const notice = errorText
    ? { text: errorText, tone: "error" as const }
    : isProvider(params.connected)
      ? { text: `${providerName(params.connected)} is connected. You can use it to sign in.`, tone: "info" as const }
      : null;
  return (
    <div className="mx-auto max-w-[560px]">
      <PageHeader title="Settings" />
      <Link href={`/dashboard/u/${user.username}`} className="panel mb-4 flex items-center gap-3 p-4 hover:border-primary/40">
        <Avatar name={user.name} src={user.avatar} size={48} />
        <span>
          <span className="block font-bold">{user.name}</span>
          <span className="block text-sm text-muted">@{user.username} · view public profile</span>
        </span>
      </Link>
      <AvatarForm name={user.name} avatar={user.avatar} />
      <section className="panel mb-4 p-4" aria-labelledby="accent-title">
        <h2 id="accent-title" className="font-bold">
          Accent colour
        </h2>
        <p className="mb-3.5 text-sm text-muted">Pick the colour for buttons, highlights and progress. Saved on this device.</p>
        <AccentPicker />
      </section>
      <ProfileForm
        user={{ name: user.name, bio: user.bio ?? "", dailyGoalMin: user.dailyGoalMin, timeZone: user.timeZone }}
        timeZones={[...new Set([user.timeZone, "UTC", ...Intl.supportedValuesOf("timeZone")])].sort()}
      />
      <ConnectedAccounts linked={linked} available={enabledProviders()} hasPassword={!!login.passwordHash} notice={notice} />
      <form action={logout} className="mt-4">
        <button className={`${btnGhost} h-11 w-full text-sm text-danger`}>Log out</button>
      </form>
      <DeleteAccount hasPassword={!!login.passwordHash} username={user.username} />
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
