import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { providerName } from "@/lib/oauth-flow";
import { readPending } from "@/lib/oauth-session";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Pick a username", robots: { index: false } };

/** First Google/GitHub sign-in: the provider has said who they are, now they pick a username. */
export default async function WelcomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const pending = await readPending("signup");
  if (!pending) redirect("/signup");
  return (
    <WelcomeForm provider={providerName(pending.provider)} email={pending.email} name={pending.name} usernameHint={pending.usernameHint} />
  );
}
