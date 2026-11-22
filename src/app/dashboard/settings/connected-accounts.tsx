"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlinkProvider } from "@/app/actions/account";
import { OAuthButtons } from "@/components/oauth-buttons";
import { toast } from "@/components/toaster";
import { providerName, type Provider } from "@/lib/oauth-flow";

type Linked = { provider: Provider; email: string | null };

export function ConnectedAccounts({
  linked,
  available,
  hasPassword,
  notice,
}: {
  linked: Linked[];
  /** Providers set up on this deployment. */
  available: Provider[];
  hasPassword: boolean;
  notice: { text: string; tone: "info" | "error" } | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const methods = (hasPassword ? 1 : 0) + linked.length;
  const connectable = available.filter((p) => !linked.some((l) => l.provider === p));

  function unlink(p: Provider) {
    start(async () => {
      const res = await unlinkProvider(p);
      if (res.error) toast(res.error, "error");
      else {
        toast(`${providerName(p)} disconnected`);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {notice && <p className={`mb-3 text-sm ${notice.tone === "error" ? "text-danger" : "text-primary-text"}`}>{notice.text}</p>}
      {linked.length > 0 && (
        <ul className="mb-3 space-y-2">
          {linked.map((l) => (
            <li key={l.provider} data-linked={l.provider} className="flex items-center gap-3 rounded-xl bg-inset px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{providerName(l.provider)}</span>
                {l.email && <span className="block truncate text-sm text-muted">{l.email}</span>}
              </span>
              <button
                type="button"
                onClick={() => unlink(l.provider)}
                disabled={pending || methods <= 1}
                title={methods <= 1 ? "This is your only way to sign in" : undefined}
                className="rounded-full border border-border bg-card px-3 py-1 text-[13px] font-bold hover:bg-inset disabled:opacity-50"
              >
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}
      {connectable.length > 0 && <OAuthButtons providers={connectable} next="/dashboard/settings" intent="link" />}
      {linked.length === 0 && connectable.length === 0 && (
        <p className="text-sm text-subtle">Google and GitHub sign-in aren&apos;t set up here.</p>
      )}
    </div>
  );
}
