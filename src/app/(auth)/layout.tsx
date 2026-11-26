import "./auth.css";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { brand } from "@/lib/brand";
import { AuthShowcase } from "./auth-showcase";
import { AuthSwitch } from "./auth-switch";

/** Sign in, sign up and the account pages: the scenes on the left, the form on the right. Phones get the form alone. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <AuthShowcase />

      <section className="auth-side">
        <header className="flex items-center justify-between gap-4">
          <Logo />
          <Suspense>
            <AuthSwitch />
          </Suspense>
        </header>

        <main id="main" className="auth-main">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>

        <footer className="flex items-center justify-between gap-4 text-[12.5px] text-subtle">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </footer>
      </section>
    </div>
  );
}
