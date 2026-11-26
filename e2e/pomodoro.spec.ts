import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const run = randomBytes(3).toString("hex");

test.afterAll(() => db.$disconnect());

async function signUp(page: Page, username: string) {
  await page.goto("/signup");
  await page.fill("[name=name]", `Pomo ${run}`);
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");
}

async function holdToStart(page: Page) {
  await page.getByRole("button", { name: "Hold to lock in" }).hover();
  await page.mouse.down();
  await page.locator("[data-immersive-view]").waitFor();
  await page.mouse.up();
}

/** Moves the running session's start back, as if it had been going this many minutes. */
async function ranFor(username: string, minutes: number) {
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  const startedAt = new Date(Date.now() - minutes * 60_000);
  await db.focusSession.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { startedAt, lastBeatAt: new Date() } });
}

test("Lock in asks Timelapse or Pomodoro, and a Pomodoro counts only its focus rounds", async ({ page }) => {
  const username = `p${run}`;
  await signUp(page, username);

  // the dock's Lock in opens a menu with the two ways to focus
  await page.goto("/dashboard/stats");
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Lock in" }).click();
  const menu = page.getByRole("dialog", { name: "Lock in" });
  await expect(menu.getByRole("link", { name: /Timelapse/ })).toHaveAttribute("href", "/dashboard/timer?mode=timelapse");
  await menu.getByRole("link", { name: /Pomodoro/ }).click();
  await page.waitForURL("**/dashboard/timer?mode=pomodoro");

  // set up: Pomodoro picked, the classic 25/5/15 × 4 to start from
  await expect(page.getByRole("radio", { name: "Pomodoro" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("group", { name: "Focus", exact: true })).toContainText("25m");
  await page.getByRole("button", { name: "More rounds" }).click();
  await page.getByRole("button", { name: "Less rounds" }).click();
  await expect(page.getByRole("group", { name: "Rounds" })).toContainText("4");
  await expect(page.getByText(/4 rounds · Ends at/)).toBeVisible();

  await holdToStart(page);
  const view = page.locator("[data-immersive-view]");
  await expect(view).toContainText("Round 1 of 4");
  await expect(view).toContainText("Break at");
  await expect(page).toHaveTitle(/^(25:00|24:\d\d) focus/);

  const user = await db.user.findUniqueOrThrow({ where: { username } });
  const row = await db.focusSession.findFirstOrThrow({ where: { userId: user.id, status: "ACTIVE" } });
  expect(row).toMatchObject({ workMin: 25, breakMin: 5, longBreakMin: 15, rounds: 4, goalMin: 100 });

  // 27 minutes in: the first break, two minutes into it
  await ranFor(username, 27);
  await page.reload();
  await expect(view).toContainText("Break");
  await expect(view).toContainText("Focus again at");
  // three minutes of break left at the reload, less however long the page took
  await expect(page).toHaveTitle(/^0?[23]:\d\d break/);

  // 116 minutes in: all four rounds done, a minute into the long break
  await ranFor(username, 116);
  await page.reload();
  const prompt = page.getByRole("alertdialog", { name: "Goal reached" });
  await expect(prompt).toBeVisible({ timeout: 8000 });
  await expect(prompt).toContainText("All 4 rounds done");
  await expect(prompt).toContainText("1h 40m");
  await prompt.getByRole("button", { name: "Finish & save" }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Hold to lock in" })).toBeVisible();

  // only the four focus rounds count: 100 minutes, not the 116 it ran
  const saved = await db.focusSession.findFirstOrThrow({ where: { userId: user.id, status: "DONE" } });
  expect(saved.durationSec).toBe(100 * 60);

  // the mode sticks for next time
  await page.goto("/dashboard/timer");
  await expect(page.getByRole("radio", { name: "Pomodoro" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Timelapse" }).click();
  await expect(page.getByRole("slider", { name: "Session length" })).toBeVisible();
});
