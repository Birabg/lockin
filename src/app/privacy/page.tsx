import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata = { title: "Privacy" };

const SECTIONS = [
  [
    "What we store",
    "Your name, username, email, a hashed password, time zone, focus sessions, posts, comments, likes, follows, and any avatar or photo you upload. We count how many people viewed each post, once per person per day, and clear the record of who viewed it after a few days.",
  ],
  [
    "What others can see",
    "Your profile, streak, total focus time, posts and comments are public, including to people without an account. So is whether you're focusing right now.",
  ],
  [
    "Photos and timelapses",
    "A photo you add to a session is attached to your post, where anyone can see it. We resize it and remove its location data. Recording is off unless you turn it on for a session, and your browser asks before sharing your screen. A finished timelapse is attached to your post, where anyone can watch it, so avoid recording anything private. Deleting the post deletes the photo or video.",
  ],
  [
    "Cookies and storage",
    "One cookie keeps you signed in. Your browser also remembers your chosen timer background. There are no advertising or tracking cookies.",
  ],
  [
    "Who handles your data",
    "The app runs on third-party hosting, database, file storage and email services, which process data on our behalf. We don't sell it.",
  ],
  [
    "Deleting your data",
    "You can delete your account in Settings. That removes your profile, sessions, posts, comments, likes, avatar, photos and timelapses.",
  ],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-primary">
        ← {brand.name}
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold">Privacy</h1>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="mt-6">
          <h2 className="font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </section>
      ))}
    </main>
  );
}
