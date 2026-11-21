import { CommunityProvider } from "@/components/community/community-provider";
import { SignInPrompt } from "@/components/community/modal";
import { TheWall } from "@/components/community/wall";

export const metadata = { title: "The wall" };

/** The whole wall on its own page, for phones and tablets where it has no column. */
export default async function WallPage() {
  return (
    <CommunityProvider wall>
      <h1 className="sr-only">The wall</h1>
      <TheWall page />
      <SignInPrompt />
    </CommunityProvider>
  );
}
