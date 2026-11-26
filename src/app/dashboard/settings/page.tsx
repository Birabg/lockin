import "./settings.css";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { AccentPicker } from "@/components/accent-picker";
import { Icon } from "@/components/icon";
import { PageHeader, btnGhost } from "@/components/ui";
import { db } from "@/lib/db";
import { canSendEmail } from "@/lib/email";
import { isAdmin } from "@/lib/moderation";
import { enabledProviders } from "@/lib/oauth";
import { isProvider, oauthErrorMessage, providerName } from "@/lib/oauth-flow";
import { AvatarForm } from "./avatar-form";
import { BlockedPeople } from "./blocked-people";
import { ConnectedAccounts } from "./connected-accounts";
import { DeleteAccount } from "./delete-account";
import { EmailForm, PasswordForm, SignOutOthers } from "./security-forms";
import { FocusForm, IdentityForm } from "./profile-form";
import { SettingsNav } from "./settings-nav";

export const metadata = { title: "Settings" };

type Params = { connected?: string; oauth_error?: string; provider?: string };

const person = { id: true, username: true, name: true, avatar: true } as const;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "focus", label: "Focus" },
  { id: "appearance", label: "Appearance" },
  { id: "sign-in", label: "Sign-in" },
  { id: "privacy", label: "Privacy" },
  { id: "account", label: "Account" },
];

function Section({ id, title, body, children }: { id: string; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel set-section" aria-labelledby={`${id}-title`}>
      <header className="mb-4">
        <h2 id={`${id}-title`} className="text-[16px] font-extrabold tracking-tight">
          {title}
        </h2>
        {body && <p className="mt-1 text-[13px] text-muted">{body}</p>}
      </header>
      {children}
    </section>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser("/dashboard/settings");
  const params = await searchParams;
  const login = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      passwordHash: true,
      oauthAccounts: { select: { provider: true, email: true }, orderBy: { createdAt: "asc" } },
      blocking: { select: { blocked: { select: person } }, orderBy: { createdAt: "desc" } },
      muting: { select: { muted: { select: person } }, orderBy: { createdAt: "desc" } },
    },
  });
  const linked = login.oauthAccounts.flatMap((a) => (isProvider(a.provider) ? [{ provider: a.provider, email: a.email }] : []));
  const errorText = oauthErrorMessage(params.oauth_error, isProvider(params.provider) ? params.provider : undefined);
  const notice = errorText
    ? { text: errorText, tone: "error" as const }
    : isProvider(params.connected)
      ? { text: `${providerName(params.connected)} is connected. You can use it to sign in.`, tone: "info" as const }
      : null;
  const saved = { name: user.name, bio: user.bio ?? "", dailyGoalMin: user.dailyGoalMin, timeZone: user.timeZone };
  const admin = isAdmin(user.username);

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader title="Settings" />
      <header className="mb-4 px-1">
        <h1 className="text-[22px] leading-tight font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-muted">How you show up, how your days count, and your account.</p>
      </header>

      <div className="set-layout">
        <aside className="set-aside">
          <SettingsNav items={SECTIONS} />
          {admin && (
            <Link href="/dashboard/admin" className="set-admin">
              <Icon name="report" size={15} /> Admin
            </Link>
          )}
        </aside>

        <div className="min-w-0 space-y-3">
          <Section id="profile" title="Profile" body="What people see on your profile, in rooms and on the leaderboard.">
            <AvatarForm name={user.name} avatar={user.avatar} username={user.username} />
            <IdentityForm saved={saved} />
          </Section>

          <Section id="focus" title="Focus" body="Your daily target and the clock your days run on.">
            <FocusForm saved={saved} timeZones={[...new Set([user.timeZone, "UTC", ...Intl.supportedValuesOf("timeZone")])].sort()} />
          </Section>

          <Section id="appearance" title="Appearance" body="The colour for buttons, highlights and progress. Saved on this device.">
            <AccentPicker />
          </Section>

          <Section
            id="sign-in"
            title="Sign-in"
            body={`Ways into your account, as well as ${login.passwordHash ? "your password" : "each other"}. You always keep at least one.`}
          >
            <div className="mb-3 space-y-2">
              <EmailForm email={user.email} hasPassword={!!login.passwordHash} canEmail={canSendEmail()} />
              <PasswordForm hasPassword={!!login.passwordHash} username={user.username} />
            </div>
            <ConnectedAccounts linked={linked} available={enabledProviders()} hasPassword={!!login.passwordHash} notice={notice} />
          </Section>

          <Section id="privacy" title="Privacy & safety" body="People you’ve blocked or muted. They aren’t told.">
            <BlockedPeople blocked={login.blocking.map((b) => b.blocked)} muted={login.muting.map((m) => m.muted)} />
          </Section>

          <Section id="account" title="Account">
            <div className="set-row">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">Log out</span>
                <span className="block text-[12.5px] text-muted">Signed in as @{user.username} on this device.</span>
              </span>
              <form action={logout}>
                <button className={`${btnGhost} h-10 px-4 text-sm`}>
                  <Icon name="logout" size={15} /> Log out
                </button>
              </form>
            </div>
            <SignOutOthers />
            <DeleteAccount hasPassword={!!login.passwordHash} username={user.username} />
          </Section>

          <p className="pt-2 text-center text-xs text-subtle">
            <Link href="/privacy" className="underline">
              Privacy policy
            </Link>
            {" · "}
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
      </div>
    </div>
  );
}
