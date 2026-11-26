"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Top right of the form side: the way to the other form, carrying `next` along. */
export function AuthSwitch() {
  const path = usePathname();
  const next = useSearchParams().get("next");
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const link = "font-bold text-primary hover:underline";

  if (path === "/login")
    return (
      <p className="text-[13.5px] text-muted">
        New here?{" "}
        <Link href={`/signup${q}`} className={link}>
          Create an account
        </Link>
      </p>
    );
  if (path === "/welcome") return null;
  return (
    <p className="text-[13.5px] text-muted">
      {path === "/signup" ? "Have an account? " : ""}
      <Link href={`/login${q}`} className={link}>
        {path === "/signup" ? "Sign in" : "Back to sign in"}
      </Link>
    </p>
  );
}
