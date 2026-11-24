/** The wall's question bank. A day with no question scheduled by an admin gets one of these. */
export const QUESTION_BANK: { question: string; options: string[] }[] = [
  { question: "Best time of day to lock in?", options: ["Early morning", "Afternoon", "Late night"] },
  { question: "Music while you focus?", options: ["Lo-fi", "Silence", "Rain sounds", "Whatever's on"] },
  { question: "Pomodoro or long sessions?", options: ["25/5 forever", "50/10", "Until I drop"] },
  { question: "Your focus fuel?", options: ["Coffee", "Tea", "Water", "Energy drink"] },
  { question: "Phone during a session?", options: ["Other room", "Face down", "Right next to me 😬"] },
  { question: "Study spot?", options: ["Desk", "Library", "Café", "Bed (no judgement)"] },
  { question: "Hardest part of locking in?", options: ["Starting", "Staying", "Stopping to rest"] },
  { question: "Notes on paper or on screen?", options: ["Paper", "Screen", "Both"] },
  { question: "How many tabs open right now?", options: ["Under 5", "5–20", "20+", "I don't want to talk about it"] },
  { question: "Reward after a long session?", options: ["Snack", "Walk", "Game", "Nap"] },
  { question: "Work with friends or alone?", options: ["Friends", "Alone", "Depends on the task"] },
  { question: "To-do list style?", options: ["App", "Paper", "In my head", "What list?"] },
  { question: "Best break activity?", options: ["Stretch", "Scroll", "Snack", "Stare at a wall"] },
  { question: "Deadline energy?", options: ["Done early", "Right on time", "Last minute hero"] },
  { question: "Weekend sessions?", options: ["Yes, grind", "Light ones", "Weekends are sacred"] },
  { question: "Camera on in study rooms?", options: ["Always", "Sometimes", "Never"] },
  { question: "Lights for locking in?", options: ["Bright", "Warm lamp", "Dark mode life"] },
  { question: "Longest you've focused in one go?", options: ["Under 1h", "1–2h", "2–4h", "4h+"] },
  { question: "Background for focus?", options: ["Rain", "City", "Library", "Beach"] },
  { question: "Clock style you like most?", options: ["Ring", "Flip", "Digital", "Hourglass"] },
  { question: "First thing you do after waking?", options: ["Phone", "Water", "Exercise", "Back to sleep"] },
  { question: "Multitasking?", options: ["Superpower", "Myth", "Only for easy stuff"] },
  { question: "Learn best by…", options: ["Reading", "Watching", "Doing", "Teaching others"] },
  { question: "Snack of champions?", options: ["Fruit", "Chips", "Chocolate", "Nuts"] },
  { question: "Goal for this week?", options: ["More hours", "Better streak", "Finish a project", "Just show up"] },
  { question: "Standing desk?", options: ["Love it", "Tried it, no", "Want one"] },
  { question: "When you lose focus you…", options: ["Take a break", "Push through", "Switch tasks"] },
  { question: "Exam season mood?", options: ["Calm", "Coffee-powered", "Panic", "Not my season"] },
  { question: "Plan your day the night before?", options: ["Always", "Sometimes", "Never"] },
  { question: "Best focus month?", options: ["January", "September", "Whenever deadlines hit"] },
];

/** The same question for everyone on a given day, cycling through the bank. */
export function bankQuestion(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return QUESTION_BANK[((n % QUESTION_BANK.length) + QUESTION_BANK.length) % QUESTION_BANK.length];
}

export const TAKE_MAX = 140;

/** Percent of votes for each option, rounded, adding up to 100 (largest remainder). */
export function votePercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}

/** How "hot" a take is: reactions, cooled by age. */
export function heat(reactions: number, createdAt: Date, now = new Date()) {
  const hours = Math.max(0, (now.getTime() - createdAt.getTime()) / 3_600_000);
  return (reactions + 1) / Math.pow(hours + 2, 1.4);
}
