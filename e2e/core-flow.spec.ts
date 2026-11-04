import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const run = randomBytes(3).toString("hex");

test.afterAll(() => db.$disconnect());

async function signUp(browser: Browser, name: string, username: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/signup");
  await page.fill("[name=name]", name);
  await page.fill("[name=username]", username);
  await page.fill("[name=email]", `${username}@example.com`);
  await page.fill("[name=password]", "password123");
  await page.getByRole("button", { name: "Join free" }).click();
  await page.waitForURL("**/dashboard**");
  return page;
}

test("signup, focus, share, like, leaderboard", async ({ browser }) => {
  const focuser = `f${run}`;
  const liker = `l${run}`;
  const note = `Finished the essay ${run}`;

  const page = await signUp(browser, `Focus ${run}`, focuser);

  await page.goto("/dashboard/timer");
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden(); // the session owns the screen

  // sessions under a minute aren't posted, so move this one 20 minutes into the past instead of waiting
  const user = await db.user.findUniqueOrThrow({ where: { username: focuser } });
  const startedAt = new Date(Date.now() - 20 * 60_000);
  await db.focusSession.updateMany({ where: { userId: user.id, status: "ACTIVE" }, data: { startedAt } });
  await page.reload();

  await page.locator("[data-immersive-view]").waitFor();
  await page.mouse.move(300, 300); // the controls stay hidden until there's activity
  await page.mouse.move(320, 320);
  await page.getByRole("button", { name: "Finish session" }).click();
  await page.getByPlaceholder(/how did it go/i).fill(note);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Start focus" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  await page.goto("/dashboard");

  await expect(page.getByText(note)).toBeVisible();
  expect(await db.post.count({ where: { userId: user.id, sessionId: { not: null } } })).toBe(1);

  const other = await signUp(browser, `Like ${run}`, liker);
  await other.goto("/dashboard");
  const card = other.locator("article", { hasText: note });
  await card.getByRole("button", { name: /^Like/ }).click();
  await expect.poll(() => db.like.count({ where: { post: { userId: user.id } } })).toBe(1);

  await other.goto("/dashboard/leaderboard");
  await expect(other.getByRole("link", { name: new RegExp(`Focus ${run}`) }).first()).toBeVisible();

  await page.goto("/dashboard/notifications");
  await expect(page.getByText(/liked/i).first()).toBeVisible();
});
