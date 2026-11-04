import { Logo } from "@/components/ui";
import { brand } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo />
      <p className="mt-2 mb-8 text-sm text-muted">{brand.tagline}</p>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
