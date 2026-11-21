"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { banUser, decideReport, restoreContent, unbanUser } from "@/app/actions/admin";
import { toast } from "@/components/toaster";
import type { ReportDecision } from "@/lib/admin-rules";

type Action = { label: string; run: () => Promise<{ error?: string }>; done: string; confirm?: string; danger?: boolean };

/** A row of admin buttons. Each refreshes the page when it's done, so the row moves to where it now belongs. */
function Buttons({ actions }: { actions: Action[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a.label}
          disabled={pending}
          onClick={() => {
            if (a.confirm && !window.confirm(a.confirm)) return;
            start(async () => {
              const res = await a.run().catch(() => ({ error: "Couldn't reach the server. Try again." }));
              if (res.error) return toast(res.error, "error");
              toast(a.done);
              router.refresh();
            });
          }}
          className={`h-8 rounded-full border px-3 text-[13px] font-bold disabled:opacity-50 ${
            a.danger ? "border-danger/40 text-danger hover:bg-danger/10" : "border-border hover:bg-inset"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

const LABELS: Record<ReportDecision, Omit<Action, "run">> = {
  dismiss: { label: "Dismiss", done: "Dismissed" },
  hide: { label: "Hide", done: "Hidden" },
  delete: { label: "Delete", done: "Deleted", confirm: "Delete this for good? It can't be undone.", danger: true },
  ban: {
    label: "Ban",
    done: "Banned",
    confirm: "Ban this account? They're signed out and everything they posted is hidden.",
    danger: true,
  },
};

export function ReportButtons({ type, id, decisions }: { type: string; id: string; decisions: ReportDecision[] }) {
  return <Buttons actions={decisions.map((d) => ({ ...LABELS[d], run: () => decideReport(type, id, d) }))} />;
}

export function RestoreButton({ type, id }: { type: string; id: string }) {
  return <Buttons actions={[{ label: "Restore", done: "Restored", run: () => restoreContent(type, id) }]} />;
}

export function BanButton({ id, banned }: { id: string; banned: boolean }) {
  return (
    <Buttons
      actions={[banned ? { label: "Unban", done: "Unbanned", run: () => unbanUser(id) } : { ...LABELS.ban, run: () => banUser(id) }]}
    />
  );
}
