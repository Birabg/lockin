/**
 * A small server-side word filter for quests and takes. The app had none before these, so this is
 * deliberately simple: it normalises common letter swaps (4 → a, $ → s, repeated letters) and
 * matches whole words from a short blocklist. Reports catch what slips through.
 */

// kept short on purpose: obvious profanity and slurs, not every rude word
const BLOCKED = [
  "fuck",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "cunt",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "pussy",
  "whore",
  "slut",
  "retard",
  "retarded",
  "faggot",
  "fag",
  "nigger",
  "nigga",
  "chink",
  "spic",
  "kike",
  "tranny",
  "kys",
];

const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

/** Lowercase letters only, with look-alikes swapped back and stretched letters squashed ("shiiit" → "shit"). */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => SWAPS[c])
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1");
}

const WORDS = new Set(BLOCKED);

export function hasBlockedWords(text: string): boolean {
  // a word spelled out a letter at a time, like "f u c k" or "f.u.c.k", is joined back up first.
  // Only runs of single letters are joined, so ordinary words never merge into something they're not.
  const words = normalise(text)
    .replace(/\b(?:[a-z] +){2,}[a-z]\b/g, (run) => run.replace(/ +/g, ""))
    .split(/\s+/)
    .filter(Boolean);
  return words.some((w) => WORDS.has(w) || WORDS.has(w.replace(/(.)\1+/g, "$1")));
}

/** Admins can remove anything and schedule daily questions. Set ADMIN_USERNAMES="you,someone" in the environment. */
export function isAdmin(username: string | null | undefined): boolean {
  if (!username) return false;
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)
    .includes(username.toLowerCase());
}

// the reporting rules (including how many reports hide something) live in safety.ts
export { HIDE_AFTER_REPORTS } from "./safety";
