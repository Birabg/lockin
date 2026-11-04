import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl font-black">404</p>
      <p className="text-muted">That page doesn’t exist.</p>
      <Link href="/dashboard" className={`${btnPrimary} h-11 text-sm`}>
        Back home
      </Link>
    </div>
  );
}
