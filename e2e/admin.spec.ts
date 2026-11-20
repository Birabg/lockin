import { randomBytes, randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
// each admin click waits on the action and a page refresh, many round trips to a remote dev database
const slow = expect.configure({ timeout: 45_000 });
test.afterAll(() => db.$disconnect());

const PASSWORD = "password123";
// playwright.config.ts makes this the test server's only admin
const ADMIN = "e2e_admin";

async function person(username = `ad${randomBytes(3).toString("hex")}`) {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  return db.user.upsert({
    where: { username },
    create: { username, name: `Person ${username}`, email: `${username}@example.com`, passwordHash, emailVerifiedAt: new Date() },
    update: { passwordHash, bannedAt: null },
  });
}

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(username);
  await page.locator("[name=password]").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("the admin page doesn't exist for anyone else", async ({ page }) => {
  const someone = await person();
  await signIn(page, someone.username);
  await page.waitForURL("**/dashboard**");
  await page.goto("/dashboard/admin");
  await expect(page.getByText("That page doesn’t exist.")).toBeVisible();
  await expect(page.locator("[data-admin]")).toHaveCount(0);
});

test("hide a reported post, restore it, ban and unban, schedule a question, all logged", async ({ page }) => {
  test.setTimeout(240_000);
  const [admin, them, r1, r2] = await Promise.all([person(ADMIN), person(), person(), person()]);
  const tag = randomBytes(3).toString("hex");
  const post = await db.post.create({ data: { userId: them.id, body: `Admin check ${tag}` } });
  await db.report.createMany({
    data: [r1, r2].map((r) => ({ reporterId: r.id, targetType: "post", targetId: post.id, reason: "spam" })),
  });

  await signIn(page, admin.username);
  await page.waitForURL("**/dashboard**");

  // reports: two spam reports on the post; hide it
  await page.goto("/dashboard/admin");
  const row = page.locator(`[data-report="${post.id}"]`);
  await expect(row).toContainText(`Admin check ${tag}`);
  await expect(row).toContainText("2 reports: spam ×2");
  await row.getByRole("button", { name: "Hide" }).click();
  await slow(row).toHaveCount(0);
  expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).hidden).toBe(true);
  expect(await db.report.count({ where: { targetId: post.id, resolvedAt: null } })).toBe(0);

  // hidden: restore it
  await page.goto("/dashboard/admin?tab=hidden");
  const hidden = page.locator(`[data-hidden-item="${post.id}"]`);
  await hidden.getByRole("button", { name: "Restore" }).click();
  await slow(hidden).toHaveCount(0);
  expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).hidden).toBe(false);

  // users: ban them, and they can't sign in
  await page.goto(`/dashboard/admin?tab=users&q=${them.username}`);
  const user = page.locator(`[data-user="${them.username}"]`);
  page.once("dialog", (d) => d.accept());
  await user.getByRole("button", { name: "Ban", exact: true }).click();
  await slow(user.getByRole("button", { name: "Unban" })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: them.id } })).bannedAt).not.toBeNull();

  // question of the day: a day far enough ahead that no one has voted on it
  const day = `20${40 + randomInt(50)}-0${1 + randomInt(9)}-1${randomInt(10)}`;
  await page.goto("/dashboard/admin?tab=question");
  await page.getByLabel("Day", { exact: true }).fill(day);
  await page.getByLabel("Question", { exact: true }).fill(`Test question ${tag}?`);
  await page.getByLabel("Option 1", { exact: true }).fill("Yes");
  await page.getByLabel("Option 2", { exact: true }).fill("No");
  await page.getByRole("button", { name: "Schedule" }).click();
  await slow(page.getByText(`Test question ${tag}?`)).toBeVisible();

  // the log has all of it
  await page.goto("/dashboard/admin?tab=log");
  const log = page.locator("[data-section=log]");
  await expect(log).toContainText(`hide post`);
  await expect(log).toContainText(`restore post`);
  await expect(log).toContainText(`ban account`);
  await expect(log).toContainText(`Test question ${tag}?`);
  const actions = await db.adminAction.findMany({
    where: { adminId: admin.id, createdAt: { gte: post.createdAt } },
    select: { action: true },
  });
  expect(actions.map((a) => a.action).sort()).toEqual(["ban", "hide", "question", "restore"]);

  // the banned account is refused at sign-in
  await page.context().clearCookies();
  await signIn(page, them.username);
  await slow(page.locator("form [role=alert]")).toContainText("This account has been suspended.");

  // unban, and they can sign in again
  await signIn(page, admin.username);
  await page.waitForURL("**/dashboard**");
  await page.goto(`/dashboard/admin?tab=users&q=${them.username}`);
  await page.locator(`[data-user="${them.username}"]`).getByRole("button", { name: "Unban" }).click();
  await slow(page.locator(`[data-user="${them.username}"]`).getByRole("button", { name: "Ban", exact: true })).toBeVisible();
  expect((await db.user.findUniqueOrThrow({ where: { id: them.id } })).bannedAt).toBeNull();

  await db.dailyQuestion.deleteMany({ where: { day } });
});
