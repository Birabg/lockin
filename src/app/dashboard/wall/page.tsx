import { CommunityProvider } from "@/components/community/community-provider";
import { SignInPrompt } from "@/components/community/modal";
import { TheWall } from "@/components/community/wall";
import { AdminQuestion } from "@/components/community/admin-question";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/moderation";
import { wallDay } from "@/lib/community";

export const metadata = { title: "The wall" };

/** The whole wall on its own page, for phones and tablets where it has no column. */
export default async function WallPage() {
  const user = await getCurrentUser();
  return (
    <CommunityProvider wall>
      <h1 className="sr-only">The wall</h1>
      <TheWall page />
      {isAdmin(user?.username) && <AdminQuestion today={wallDay()} />}
      <SignInPrompt />
    </CommunityProvider>
  );
}
