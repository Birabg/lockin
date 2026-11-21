"use client";

import { useState } from "react";
import { reportContent } from "@/app/actions/safety";
import { Modal } from "@/components/community/modal";
import { toast } from "@/components/toaster";
import { btnGhost, btnPrimary } from "@/components/ui";
import { REPORT_REASONS, type ReportReason, type ReportTarget } from "@/lib/safety";

const NOUN: Record<ReportTarget, string> = { post: "post", comment: "comment", quest: "quest", take: "take", user: "account" };

/**
 * Asks why, then files the report without making anyone wait: `onReported` runs straight away so the caller can
 * hide the thing, and `onFailed` puts it back if the report doesn't go through.
 * `send` replaces the default action, for places with their own (the wall keeps its list in a provider).
 */
export function ReportDialog({
  type,
  id,
  onClose,
  onReported,
  onFailed,
  send,
}: {
  type: ReportTarget;
  id: string;
  onClose: () => void;
  onReported?: () => void;
  onFailed?: () => void;
  send?: (reason: ReportReason) => Promise<{ error?: string }>;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const noun = NOUN[type];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    onReported?.();
    onClose();
    // this component may be gone by now (the caller hid what it sat in), so only module-level things from here
    const res = await (send ? send(reason) : reportContent(type, id, reason)).catch(() => ({
      error: "Couldn't reach the server. Try again.",
    }));
    if (res.error) {
      onFailed?.();
      return toast(res.error, "error");
    }
    toast(type === "user" ? "Thanks. We'll take a look at this account." : "Thanks. We'll take a look.");
  }

  return (
    <Modal label={`Report this ${noun}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" data-report-dialog>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Report this {noun}</h2>
          <p className="mt-1 text-sm text-muted">
            {type === "user"
              ? "They won't know you reported them."
              : `They won't know who reported it. It disappears for you now, and once a few people report it, for everyone until we check it.`}
          </p>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Why are you reporting this?</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-inset"
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-[var(--primary)]"
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button disabled={!reason} className={btnPrimary}>
            Report
          </button>
        </div>
      </form>
    </Modal>
  );
}
