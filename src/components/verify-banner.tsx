"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendVerification } from "@/app/actions/account";
import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";

export type BannerData = {
  /** unverified: nothing enforced yet. grace: older account, still allowed until `graceEndsAt`. restricted: can't post. */
  kind: "unverified" | "grace" | "restricted";
  email: string;
  /** ISO date, only for "grace" once the clock has started. */
  graceEndsAt: string | null;
  canResend: boolean;
};

function message(d: BannerData) {
  if (d.kind === "restricted") return "Verify your email to keep your streak public and to post, comment and create quests.";
  if (d.kind === "grace") {
    const by = d.graceEndsAt ? ` by ${new Date(d.graceEndsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : "";
    return `Verify your email${by} to keep your streak public and keep posting.`;
  }
  return "Verify your email address to keep your account safe.";
}

export function VerifyBanner({ data }: { data: BannerData }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const router = useRouter();

  function resend() {
    start(async () => {
      const res = await resendVerification();
      if (res.verified) {
        toast("Your email is already verified");
        router.refresh();
      } else if (res.error) {
        toast(res.error, "error");
      } else {
        setSent(true);
        toast(`Sent. Check ${data.email}`);
      }
    });
  }

  return (
    <div
      role="status"
      data-verify-banner={data.kind}
      className={`mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 px-4 py-3 text-sm ${
        data.kind === "restricted" ? "border-danger/40 bg-danger/10" : "border-primary/30 bg-primary-light"
      }`}
    >
      <Icon name="letter" size={20} />
      <p className="min-w-0 flex-1">
        <span className="font-bold">{message(data)}</span> <span className="text-muted">We sent a link to {data.email}.</span>
      </p>
      {data.canResend && (
        <button
          type="button"
          onClick={resend}
          disabled={pending || sent}
          className="rounded-full border-2 border-border bg-card px-4 py-1.5 font-bold hover:bg-inset disabled:opacity-60"
        >
          {pending ? "Sending…" : sent ? "Sent ✓" : "Resend email"}
        </button>
      )}
    </div>
  );
}
